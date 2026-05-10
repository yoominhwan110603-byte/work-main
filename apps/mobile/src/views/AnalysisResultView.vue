<template>
  <div class="size-full bg-white text-gray-900 flex flex-col">
    <header class="px-4 py-4 flex items-center border-b">
      <button class="p-2" @click="router.back()">
        <ArrowLeft :size="24" />
      </button>
      <h1 class="ml-3 text-lg">LP 감정 결과</h1>
    </header>

    <main v-if="report" class="flex-1 overflow-y-auto p-4 space-y-5">
      <section class="rounded-lg overflow-hidden border">
        <img :src="report.imageDataUrl" alt="분석한 앨범 커버" class="w-full aspect-square object-cover bg-gray-100" />
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
        <div class="p-4">
          <h2 class="text-base">표면 위치 표시</h2>
          <p class="text-sm text-gray-600 mt-1">
            표면 상태 점수 {{ recognition.surfaceScore || recognition.confidence }}점. OpenCV가 찾은 선형 스크래치 후보를 이미지 위에 표시합니다.
          </p>
        </div>
      </section>

      <section v-if="report.recordVideoDataUrl" class="rounded-lg overflow-hidden border">
        <video :src="report.recordVideoDataUrl" controls class="w-full aspect-square object-cover bg-gray-100" />
        <div class="p-4">
          <h2 class="text-base">음반 동영상 확인</h2>
          <p class="text-sm text-gray-600 mt-1">동영상은 프레임별 표면 점수와 스크래치 후보를 집계합니다.</p>
        </div>
      </section>

      <section class="grid grid-cols-3 gap-3">
        <div class="rounded-lg border p-4">
          <p class="text-xs text-gray-500">표면 점수</p>
          <p class="text-2xl mt-1">{{ recognition.surfaceScore || recognition.confidence }}</p>
        </div>
        <div class="rounded-lg border p-4">
          <p class="text-xs text-gray-500">자켓 점수</p>
          <p class="text-2xl mt-1">{{ report.cover.score }}</p>
        </div>
        <div class="rounded-lg border p-4">
          <p class="text-xs text-gray-500">자켓 등급</p>
          <p class="text-2xl mt-1">{{ report.cover.grade }}</p>
        </div>
      </section>

      <section class="rounded-lg border p-4 space-y-3">
        <h2 class="text-base">표면 상태 근거</h2>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-lg bg-gray-50 p-3"><p class="text-xs text-gray-500">스크래치 후보</p><p class="text-xl mt-1">{{ recognition.scratchCount }}개</p></div>
          <div class="rounded-lg bg-gray-50 p-3"><p class="text-xs text-gray-500">스크래치 위험도</p><p class="text-xl mt-1">{{ riskLabel(recognition.scratchRisk) }}</p></div>
          <div class="rounded-lg bg-gray-50 p-3"><p class="text-xs text-gray-500">재생 영향</p><p class="text-xl mt-1">{{ recognition.playbackImpact }}</p></div>
          <div class="rounded-lg bg-gray-50 p-3"><p class="text-xs text-gray-500">반사 위험도</p><p class="text-xl mt-1">{{ riskLabel(recognition.reflectionRisk) }}</p></div>
        </div>
        <p class="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-900">{{ recognition.dustOrReflectionNote }}</p>
        <ul class="space-y-2 text-sm text-gray-700">
          <li v-for="signal in recognition.signals" :key="signal" class="flex gap-2">
            <CheckCircle2 :size="16" class="text-green-600 mt-0.5 shrink-0" />
            <span>{{ signal }}</span>
          </li>
        </ul>
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
          <div class="col-span-2"><p class="text-gray-500">희귀도</p><p>{{ report.pressing.rarity }}</p></div>
        </div>
      </section>

      <section class="rounded-lg border p-4 space-y-3">
        <h2 class="text-base">자켓 감점 사유</h2>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-lg bg-gray-50 p-3"><p class="text-xs text-gray-500">모서리 마모</p><p>{{ riskLabel(report.cover.cornerWear) }}</p></div>
          <div class="rounded-lg bg-gray-50 p-3"><p class="text-xs text-gray-500">링웨어</p><p>{{ riskLabel(report.cover.ringWear) }}</p></div>
          <div class="rounded-lg bg-gray-50 p-3"><p class="text-xs text-gray-500">얼룩/변색</p><p>{{ riskLabel(report.cover.stainRisk) }}</p></div>
          <div class="rounded-lg bg-gray-50 p-3"><p class="text-xs text-gray-500">접힘/찢김</p><p>{{ riskLabel(report.cover.tearOrCreaseRisk) }}</p></div>
        </div>
        <ul class="space-y-2 text-sm text-gray-700">
          <li v-for="note in report.cover.notes" :key="note" class="flex gap-2">
            <CheckCircle2 :size="16" class="text-green-600 mt-0.5 shrink-0" />
            <span>{{ note }}</span>
          </li>
        </ul>
      </section>

      <section v-if="report.audio" class="rounded-lg border p-4 space-y-3">
        <h2 class="text-base">음질 분석</h2>
        <div class="grid grid-cols-3 gap-3 text-sm">
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-500">음질 등급</p>
            <p class="text-xl mt-1">{{ report.audio.audioGrade }}</p>
          </div>
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-500">음질 점수</p>
            <p class="text-xl mt-1">{{ report.audio.audioScore }}</p>
          </div>
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-500">재생 위험</p>
            <p class="text-xl mt-1">{{ riskLabel(report.audio.playbackRisk) }}</p>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2 text-xs">
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">클릭/팝</p><p>{{ report.audio.clickCount ?? '-' }}개</p></div>
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">노이즈</p><p>{{ formatDb(report.audio.noiseFloorDb) }}</p></div>
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">다이내믹</p><p>{{ formatDb(report.audio.dynamicRangeDb) }}</p></div>
        </div>
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
        <p class="text-sm text-gray-600 mb-5">자켓 사진과 표면 이미지로 먼저 감정서를 만들어 주세요.</p>
        <button class="px-5 py-3 rounded-lg bg-blue-600 text-white" @click="router.push('/sell/analysis')">감정서 만들기</button>
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
import { ArrowLeft, BadgeCheck, CheckCircle2 } from 'lucide-vue-next';
import { readCoverAnalysisReport, recognizeLpImage } from '../data/vinylAnalysis';
import { mockAlbums } from '../data/mockData';
import { useAppStore } from '../stores/appStore';

const router = useRouter();
const store = useAppStore();
const report = readCoverAnalysisReport();
const recognition = computed(() => report?.recognition || recognizeLpImage(report?.imageDataUrl || ''));
const scratchRegions = computed(() => recognition.value.scratchRegions || []);
const riskLabel = (risk?: 'low' | 'medium' | 'high') => risk === 'high' ? '높음' : risk === 'medium' ? '주의' : '낮음';
const scratchColor = (severity?: string) => severity === 'high' ? '#ef4444' : severity === 'medium' ? '#f97316' : '#facc15';
const formatDb = (value?: number | null) => typeof value === 'number' ? `${value.toFixed(1)} dB` : '-';

const recommendStarterPrice = () => {
  if (!report) return 0;
  const matched = mockAlbums.find(album =>
    album.catalogNumber.toLowerCase() === report.pressing.catalogNumber.toLowerCase() ||
    album.title.toLowerCase() === report.selectedCandidate.title.toLowerCase()
  );
  const basePrice = matched
    ? (matched.priceRange.min + matched.priceRange.max) / 2
    : mockAlbums.reduce((sum, album) => sum + album.price, 0) / mockAlbums.length;
  const rarityBoost = report.pressing.rarity === '높음' ? 1.12 : report.pressing.rarity === '중간 이상' ? 1.06 : 1;
  const conditionBoost = report.cover.grade === 'NM' ? 1.08 : report.cover.grade === 'VG+' ? 1 : 0.9;
  return Math.round((basePrice * rarityBoost * conditionBoost) / 1000) * 1000;
};

const priceImpact = computed(() => {
  if (!report) return '';
  const rarityText = report.pressing.rarity === '높음' ? '희귀도가 높아 가격 상향 요인이 있습니다.' : '희귀도는 보통 수준으로 반영했습니다.';
  const conditionText = report.cover.grade === 'NM'
    ? '자켓 상태가 우수해 감점이 거의 없습니다.'
    : report.cover.grade === 'VG+'
      ? '가벼운 마모가 있어 시세 중간값에 가깝게 반영했습니다.'
      : '눈에 띄는 마모가 있어 보수적으로 감가했습니다.';
  return `${rarityText} ${conditionText}`;
});

const applyToSellForm = () => {
  if (!report) return;
  const draft = store.readDraft() || {};
  const draftForm = draft.formData && typeof draft.formData === 'object' ? draft.formData as Record<string, unknown> : {};
  const nextDescription = [
    String(draftForm.description || '').trim(),
    `Vinyl-Check 감정: ${report.pressing.pressing}, ${report.pressing.releaseCountry} ${report.pressing.releaseYear}, 매트릭스 ${report.pressing.matrixNumber || report.matrixNumber || '미입력'}, 자켓 ${report.cover.grade} (${report.cover.score}점), 표면 ${recognition.value.surfaceScore || recognition.value.confidence}점, 스크래치 후보 ${recognition.value.scratchCount}개, 재생 영향 ${recognition.value.playbackImpact}.`,
  ].filter(Boolean).join('\n\n');

  store.saveDraft({
    ...draft,
    images: [
      report.imageDataUrl,
      report.recordImageDataUrl,
      ...((draft.images as string[] | undefined) || []).slice(2),
    ].filter(Boolean).slice(0, 5),
    recordVideoDataUrl: report.recordVideoDataUrl || draft.recordVideoDataUrl,
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
      jacketGrade: report.cover.grade,
      jacketScore: String(report.cover.score),
      analysisConfirmed: 'true',
      audioGrade: report.audio?.audioGrade,
      audioScore: report.audio?.audioScore,
    },
  });
  router.push('/sell');
};
</script>
