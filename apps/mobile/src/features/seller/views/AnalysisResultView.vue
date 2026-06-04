<template>
  <div class="size-full bg-white text-gray-900 flex flex-col">
    <header class="px-4 py-4 flex items-center border-b">
      <button class="p-2" @click="router.back()"><ArrowLeft :size="24" /></button>
      <h1 class="ml-3 text-lg">LP 감정 결과</h1>
    </header>

    <main v-if="report" class="flex-1 overflow-y-auto p-4 space-y-5">
      <section class="rounded-lg overflow-hidden border">
        <img :src="report.imageDataUrl" alt="대표 이미지" class="w-full aspect-square object-cover bg-gray-100" />
        <div class="p-4">
          <div class="flex items-center gap-2 text-blue-600 mb-2">
            <BadgeCheck :size="18" />
            <span class="text-sm">Vinyl-Check 감정</span>
          </div>
          <h2 class="text-xl">{{ report.selectedCandidate.title }}</h2>
          <p class="text-sm text-gray-600">{{ report.selectedCandidate.artist }} · {{ report.selectedCandidate.year || '연도 미상' }}</p>
        </div>
      </section>

      <section v-if="report.recordImageDataUrl" class="rounded-lg overflow-hidden border">
        <div class="relative aspect-square bg-gray-100">
          <img :src="report.recordImageDataUrl" alt="분석한 음반 표면" class="absolute inset-0 w-full h-full object-cover" />
          <svg v-if="scratchRegions.length" viewBox="0 0 100 100" preserveAspectRatio="none" class="absolute inset-0 w-full h-full pointer-events-none">
            <line
              v-for="(region, index) in scratchRegions"
              :key="`${region.x1}-${region.y1}-${index}`"
              :x1="region.x1 * 100"
              :y1="region.y1 * 100"
              :x2="region.x2 * 100"
              :y2="region.y2 * 100"
              :stroke="scratchColor(region.severity)"
              stroke-width="3.5"
              stroke-linecap="round"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <div v-if="scratchRegions.length" class="absolute left-3 bottom-3 rounded bg-black/70 px-3 py-1.5 text-xs text-white">
            스크래치 후보 {{ scratchRegions.length }}곳 표시
          </div>
        </div>
      </section>

      <section v-if="report.recordVideoDataUrl" class="rounded-lg overflow-hidden border">
        <video :src="report.recordVideoDataUrl" controls class="w-full aspect-square object-cover bg-gray-100" />
      </section>

      <section v-if="report.jacket" class="rounded-lg border p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-base">자켓 상태</h2>
          <div class="text-right space-y-1">
            <span class="inline-block px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">{{ report.jacket.jacketGrade }} · {{ report.jacket.jacketScore }}점</span>
            <span :class="['block px-2 py-1 rounded text-xs', jacketNeedsRetake ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700']">{{ jacketResultBadge }}</span>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2 text-xs">
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">테두리</p><p>{{ riskLabel(report.jacket.edgeWearRisk) }}</p></div>
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">모서리</p><p>{{ riskLabel(report.jacket.cornerWearRisk) }}</p></div>
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">색 바램</p><p>{{ riskLabel(report.jacket.colorFadeRisk) }}</p></div>
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">마모 후보</p><p>{{ formatPercent(report.jacket.edgeWearRatio) }}</p></div>
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">반사</p><p>{{ formatPercent(report.jacket.glareRatio) }}</p></div>
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">신뢰도</p><p>{{ report.jacket.confidence }}점</p></div>
        </div>
        <p v-if="jacketNeedsRetake" class="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">반사나 낮은 신뢰도 때문에 재촬영을 권장합니다. 이 결과는 참고용으로 해석해 주세요.</p>
        <p class="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">{{ report.jacket.recommendation }}</p>
      </section>

      <section class="grid grid-cols-3 gap-3">
        <div class="rounded-lg border p-4">
          <p class="text-xs text-gray-500">표면 점수</p>
          <p class="text-2xl mt-1">{{ recognition.surfaceScore || recognition.confidence }}</p>
        </div>
        <div class="rounded-lg border p-4">
          <p class="text-xs text-gray-500">스크래치</p>
          <p class="text-2xl mt-1">{{ recognition.scratchCount }}</p>
        </div>
        <div class="rounded-lg border p-4">
          <p class="text-xs text-gray-500">재생 영향</p>
          <p class="text-2xl mt-1">{{ recognition.playbackImpact }}</p>
        </div>
      </section>

      <section class="rounded-lg border p-4 space-y-3">
        <h2 class="text-base">표면 상태 근거</h2>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-lg bg-gray-50 p-3"><p class="text-xs text-gray-500">스크래치 위험도</p><p class="text-xl mt-1">{{ riskLabel(recognition.scratchRisk) }}</p></div>
          <div class="rounded-lg bg-gray-50 p-3"><p class="text-xs text-gray-500">반사 위험도</p><p class="text-xl mt-1">{{ riskLabel(recognition.reflectionRisk) }}</p></div>
          <div class="rounded-lg bg-gray-50 p-3"><p class="text-xs text-gray-500">표시 후보</p><p class="text-xl mt-1">{{ scratchDetails.displayedRegions ?? scratchRegions.length }}곳</p></div>
          <div class="rounded-lg bg-gray-50 p-3"><p class="text-xs text-gray-500">강한 후보</p><p class="text-xl mt-1">{{ scratchDetails.highSeverity || 0 }}곳</p></div>
        </div>
        <div class="grid grid-cols-3 gap-2 text-xs">
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">초점</p><p>{{ formatNumber(scratchDetails.blurVariance) }}</p></div>
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">노출</p><p>{{ formatNumber(scratchDetails.exposure) }}</p></div>
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">원형</p><p>{{ scratchDetails.detectedDisc ? '감지' : '미확인' }}</p></div>
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">먼지/입자</p><p>{{ formatPercent(scratchDetails.dustRatio) }}</p></div>
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">홈 대비</p><p>{{ formatPercent(scratchDetails.grooveContrast) }}</p></div>
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">밀도</p><p>{{ formatPercent(scratchDetails.scratchDensity) }}</p></div>
        </div>
        <p class="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-900">{{ recognition.dustOrReflectionNote }}</p>
      </section>

      <section class="rounded-lg border p-4 space-y-4">
        <h2 class="text-base">판본 근거</h2>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div><p class="text-gray-500">카탈로그 번호</p><p>{{ report.pressing.catalogNumber }}</p></div>
          <div><p class="text-gray-500">레이블</p><p>{{ report.pressing.label }}</p></div>
          <div><p class="text-gray-500">발매국</p><p>{{ report.pressing.releaseCountry }}</p></div>
          <div><p class="text-gray-500">발매연도</p><p>{{ report.pressing.releaseYear || '미상' }}</p></div>
          <div class="col-span-2"><p class="text-gray-500">매트릭스 번호</p><p>{{ report.pressing.matrixNumber || report.matrixNumber || '미입력' }}</p></div>
          <div class="col-span-2"><p class="text-gray-500">판본 추정</p><p>{{ report.pressing.pressing }}</p></div>
        </div>
      </section>

      <section v-if="report.audio" class="rounded-lg border p-4 space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base">음질 분석</h2>
          <span :class="['px-2 py-1 rounded text-xs', isReferenceAudioAnalysis ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700']">{{ audioResultBadge }}</span>
        </div>
        <p v-if="isReferenceAudioAnalysis" class="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">주변음이 없거나 신뢰도가 낮아 참고용 분석으로 표시합니다.</p>
        <div class="grid grid-cols-3 gap-3 text-sm">
          <div class="rounded-lg bg-gray-50 p-3"><p class="text-xs text-gray-500">등급</p><p class="text-xl mt-1">{{ report.audio.audioGrade }}</p></div>
          <div class="rounded-lg bg-gray-50 p-3"><p class="text-xs text-gray-500">점수</p><p class="text-xl mt-1">{{ report.audio.audioScore }}</p></div>
          <div class="rounded-lg bg-gray-50 p-3"><p class="text-xs text-gray-500">신뢰도</p><p class="text-xl mt-1">{{ report.audio.analysisConfidence ?? '-' }}</p></div>
        </div>
        <div class="grid grid-cols-3 gap-2 text-xs">
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">클릭/팝</p><p>{{ report.audio.clickCount ?? '-' }}개</p></div>
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">주변음</p><p>{{ formatDb(report.audio.ambientNoiseFloorDb) }}</p></div>
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">보정 노이즈</p><p>{{ formatDb(report.audio.adjustedNoiseFloorDb) }}</p></div>
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">다이내믹</p><p>{{ formatDb(report.audio.dynamicRangeDb) }}</p></div>
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">클리핑</p><p>{{ riskLabel(report.audio.clippingRisk || 'low') }}</p></div>
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">좌우 편차</p><p>{{ formatDb(report.audio.channelImbalanceDb) }}</p></div>
        </div>
        <p v-for="warning in report.audio.warnings || []" :key="warning" class="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{{ warning }}</p>
        <p class="text-sm text-gray-700">{{ report.audio.summary }}</p>
      </section>

      <section class="rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-2">
        <h2 class="text-base">가격 영향</h2>
        <p class="text-sm text-gray-700">{{ priceImpact }}</p>
        <p class="text-lg text-blue-700">{{ recommendStarterPrice().toLocaleString() }}원 추천</p>
      </section>
    </main>

    <main v-else class="flex-1 flex items-center justify-center p-6 text-center">
      <div>
        <h2 class="text-xl mb-2">저장된 감정 결과가 없습니다</h2>
        <button class="px-5 py-3 rounded-lg bg-blue-600 text-white" @click="router.push('/sell/analysis')">감정 만들기</button>
      </div>
    </main>

    <footer class="p-4 border-t space-y-2">
      <button v-if="report" class="w-full py-4 bg-blue-600 text-white rounded-lg" @click="applyToSellForm">판매 등록 폼에 적용</button>
      <button class="w-full py-3 border rounded-lg text-gray-700" @click="router.push('/sell')">판매 등록으로 돌아가기</button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, BadgeCheck } from 'lucide-vue-next';
import { readCoverAnalysisReport, recognizeLpImage } from '@/features/seller/services/analysis';
import { useAppStore } from '@/shared/stores/appStore';

const router = useRouter();
const store = useAppStore();
const report = readCoverAnalysisReport();
const recognition = computed(() => report?.recognition || recognizeLpImage(report?.imageDataUrl || ''));
const scratchRegions = computed(() => recognition.value.scratchRegions || []);
const scratchDetails = computed(() => recognition.value.scratchDetails || {});
const riskLabel = (risk?: 'low' | 'medium' | 'high' | string) => risk === 'high' ? '높음' : risk === 'medium' ? '주의' : '낮음';
const scratchColor = (severity?: string) => severity === 'high' ? '#ef4444' : severity === 'medium' ? '#f97316' : '#facc15';
const formatDb = (value?: number | null) => typeof value === 'number' ? `${value.toFixed(1)} dB` : '-';
const formatNumber = (value?: number | null) => typeof value === 'number' ? value.toFixed(1) : '-';
const formatPercent = (value?: number | null) => typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '-';
const isReferenceAudioAnalysis = computed(() => Boolean(report?.audio && (
  report.audio.source === 'fallback'
  || report.audio.source === 'mock'
  || Number(report.audio.analysisConfidence || 0) < 60
)));
const audioResultBadge = computed(() => isReferenceAudioAnalysis.value ? '참고용 분석' : '정밀 분석');
const jacketNeedsRetake = computed(() => Boolean(report?.jacket && (
  report.jacket.glareRisk === 'high'
  || Number(report.jacket.confidence || 0) < 65
)));
const jacketResultBadge = computed(() => jacketNeedsRetake.value ? '재촬영 권장' : report?.jacket?.source === 'server' ? '서버 분석' : '참고용 분석');

const recommendStarterPrice = () => {
  if (!report) return 0;
  const listings = store.listings.filter(album => album.price > 0);
  const matched = listings.find(album =>
    album.catalogNumber.toLowerCase() === report.pressing.catalogNumber.toLowerCase() ||
    album.title.toLowerCase() === report.selectedCandidate.title.toLowerCase()
  );
  const basePrice = matched
    ? (matched.priceRange.min + matched.priceRange.max) / 2
    : listings.length ? listings.reduce((sum, album) => sum + album.price, 0) / listings.length : 0;
  if (!basePrice) return 0;
  const rarityBoost = report.pressing.rarity === '높음' ? 1.12 : report.pressing.rarity === '중간 이상' ? 1.06 : 1;
  const surfaceScore = recognition.value.surfaceScore || recognition.value.confidence;
  const surfaceBoost = surfaceScore >= 88 ? 1.06 : surfaceScore >= 78 ? 1 : 0.92;
  const audioBoost = report.audio?.audioScore ? (report.audio.audioScore >= 88 ? 1.06 : report.audio.audioScore >= 78 ? 1 : 0.92) : 1;
  const jacketBoost = report.jacket?.jacketScore ? (report.jacket.jacketScore >= 88 ? 1.04 : report.jacket.jacketScore >= 76 ? 1 : 0.94) : 1;
  return Math.round((basePrice * rarityBoost * surfaceBoost * audioBoost * jacketBoost) / 1000) * 1000;
};

const priceImpact = computed(() => {
  if (!report) return '';
  const surfaceScore = recognition.value.surfaceScore || recognition.value.confidence;
  const surfaceText = surfaceScore >= 85
    ? '표면 점수와 음질 점수가 좋아 감가를 낮게 잡았습니다.'
    : '표면 또는 음질 지표에 주의 요소가 있어 보수적으로 반영했습니다.';
  const jacketText = report.jacket ? ` 자켓 ${report.jacket.jacketGrade} (${report.jacket.jacketScore}점)도 함께 반영했습니다.` : '';
  return `${report.pressing.rarity} 희소성과 자켓/표면/음질 지표를 기준으로 계산했습니다. ${surfaceText}${jacketText}`;
});

const applyToSellForm = () => {
  if (!report) return;
  const draft = store.readDraft() || {};
  const draftForm = draft.formData && typeof draft.formData === 'object' ? draft.formData as Record<string, unknown> : {};
  const jacketPrefix = jacketNeedsRetake.value ? '자켓 참고용 분석' : '자켓 상태';
  const audioPrefix = isReferenceAudioAnalysis.value ? '음질 참고용 분석' : '음질 분석';
  const nextDescription = [
    String(draftForm.description || '').trim(),
    report.jacket ? `${jacketPrefix}: ${report.jacket.jacketGrade} (${report.jacket.jacketScore}점), 테두리 ${riskLabel(report.jacket.edgeWearRisk)}, 모서리 ${riskLabel(report.jacket.cornerWearRisk)}.` : '',
    report.audio ? `${audioPrefix}: ${report.audio.audioGrade} (${report.audio.audioScore}점), 클릭/팝 후보 ${report.audio.clickCount ?? 0}개.` : '',
    `Vinyl-Check 감정: ${report.pressing.pressing}, ${report.pressing.releaseCountry} ${report.pressing.releaseYear}, 매트릭스 ${report.pressing.matrixNumber || report.matrixNumber || '미입력'}, 표면 ${recognition.value.surfaceScore || recognition.value.confidence}점, 스크래치 후보 ${recognition.value.scratchCount}개, 재생 영향 ${recognition.value.playbackImpact}.`,
  ].filter(Boolean).join('\n\n');

  store.saveDraft({
    ...draft,
    images: [
      report.imageDataUrl,
      report.recordImageDataUrl,
      ...((draft.images as string[] | undefined) || []).slice(2),
    ].filter(Boolean).slice(0, 5),
    recordVideoDataUrl: report.recordVideoDataUrl || draft.recordVideoDataUrl,
    jacketRecognition: report.jacket,
    formData: {
      ...draftForm,
      title: report.selectedCandidate.title,
      artist: report.selectedCandidate.artist,
      catalogNumber: report.pressing.catalogNumber,
      matrixNumber: report.pressing.matrixNumber || report.matrixNumber || '',
      price: String(recommendStarterPrice()),
      description: nextDescription,
      tags: String(draftForm.tags || '#VinylCheck #LP감정'),
      pressing: report.pressing.pressing,
      analysisConfirmed: 'true',
      jacketGrade: report.jacket?.jacketGrade,
      jacketScore: report.jacket?.jacketScore,
      audioGrade: report.audio?.audioGrade,
      audioScore: report.audio?.audioScore,
    },
  });
  router.push('/sell');
};
</script>
