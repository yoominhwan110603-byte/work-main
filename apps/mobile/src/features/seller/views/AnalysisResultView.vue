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

      <section class="grid grid-cols-2 gap-3">
        <div class="rounded-lg border p-4">
          <p class="text-xs text-gray-500">스크래치 등급</p>
          <p class="text-2xl mt-1">{{ surfaceGradeText }}</p>
        </div>
        <div class="rounded-lg border p-4">
          <p class="text-xs text-gray-500">스크래치 점수</p>
          <p class="text-2xl mt-1">{{ surfaceScoreText }}</p>
        </div>
      </section>
      <p v-if="isSurfaceAnalysisUnavailable" class="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">표면 정밀 분석이 완료되지 않아 점수와 등급은 표시하지 않습니다.</p>

      <section v-if="report.audio" class="rounded-lg border p-4 space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base">음질 분석</h2>
          <span :class="['px-2 py-1 rounded text-xs', isReferenceAudioAnalysis ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700']">{{ audioResultBadge }}</span>
        </div>
        <p v-if="isAudioAnalysisUnavailable" class="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">정밀 분석이 불가능해 음질 등급과 점수를 표시하지 않습니다.</p>
        <p v-else-if="isReferenceAudioAnalysis" class="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">주변음이 없거나 신뢰도가 낮아 참고용 분석으로 표시합니다.</p>
        <div v-if="!isAudioAnalysisUnavailable" class="grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-lg bg-gray-50 p-3"><p class="text-xs text-gray-500">음질 등급</p><p class="text-xl mt-1">{{ audioGradeText }}</p></div>
          <div class="rounded-lg bg-gray-50 p-3"><p class="text-xs text-gray-500">음질 점수</p><p class="text-xl mt-1">{{ audioScoreText }}</p></div>
        </div>
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
      <button class="w-full py-3 border rounded-lg text-gray-700" @click="router.push('/app/sell')">판매 등록으로 돌아가기</button>
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
const scratchColor = (severity?: string) => severity === 'high' ? '#ef4444' : severity === 'medium' ? '#f97316' : '#facc15';
function gradeFromScore(score: number) {
  if (score >= 96) return 'M';
  if (score >= 88) return 'NM';
  if (score >= 80) return 'EX';
  if (score >= 70) return 'VG+';
  if (score >= 58) return 'VG';
  if (score >= 45) return 'G';
  return 'P';
}
const isSurfaceAnalysisUnavailable = computed(() => recognition.value.analysisAvailable === false || recognition.value.source === 'fallback');
const surfaceScoreText = computed(() => isSurfaceAnalysisUnavailable.value ? '분석 불가' : `${recognition.value.surfaceScore || recognition.value.confidence || 0}점`);
const surfaceGradeText = computed(() => {
  if (isSurfaceAnalysisUnavailable.value) return '분석 불가';
  return recognition.value.surfaceGrade || gradeFromScore(recognition.value.surfaceScore || recognition.value.confidence || 0);
});
const isAudioAnalysisUnavailable = computed(() => Boolean(report?.audio && (
  report.audio.analysisAvailable === false
  || report.audio.source === 'fallback'
  || report.audio.source === 'mock'
  || report.audio.audioScore == null
  || report.audio.audioGrade == null
)));
const isReferenceAudioAnalysis = computed(() => Boolean(report?.audio && (
  isAudioAnalysisUnavailable.value
  || Number(report.audio.analysisConfidence || 0) < 60
)));
const audioResultBadge = computed(() => isAudioAnalysisUnavailable.value ? '분석 불가' : isReferenceAudioAnalysis.value ? '참고용 분석' : '정밀 분석');
const audioLpConditionScore = computed(() => report?.audio?.lpConditionScore ?? report?.audio?.audioScore ?? null);
const audioGradeText = computed(() => {
  if (!report?.audio || isAudioAnalysisUnavailable.value) return '분석 불가';
  return report.audio.lpConditionGrade || report.audio.audioGrade || '-';
});
const audioScoreText = computed(() => {
  if (!report?.audio || isAudioAnalysisUnavailable.value || typeof audioLpConditionScore.value !== 'number') return '분석 불가';
  return `${audioLpConditionScore.value}점`;
});

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
  const surfaceScore = isSurfaceAnalysisUnavailable.value ? 0 : recognition.value.surfaceScore || recognition.value.confidence;
  const surfaceBoost = surfaceScore ? (surfaceScore >= 88 ? 1.06 : surfaceScore >= 78 ? 1 : 0.92) : 1;
  const audioScore = isAudioAnalysisUnavailable.value ? 0 : Number(audioLpConditionScore.value || 0);
  const audioBoost = audioScore ? (audioScore >= 88 ? 1.06 : audioScore >= 78 ? 1 : 0.92) : 1;
  return Math.round((basePrice * surfaceBoost * audioBoost) / 1000) * 1000;
};

const priceImpact = computed(() => {
  if (!report) return '';
  const surfaceScore = isSurfaceAnalysisUnavailable.value ? 0 : recognition.value.surfaceScore || recognition.value.confidence;
  const surfaceText = !surfaceScore
    ? '표면 또는 음질 분석 불가 항목은 가격 보정에서 제외했습니다.'
    : surfaceScore >= 85
    ? '표면 점수와 음질 점수가 좋아 감가를 낮게 잡았습니다.'
    : '표면 또는 음질 점수가 낮아 보수적으로 반영했습니다.';
  return `표면/음질 지표를 기준으로 계산했습니다. ${surfaceText}`;
});

const applyToSellForm = () => {
  if (!report) return;
  const draft = store.readDraft() || {};
  const draftForm = draft.formData && typeof draft.formData === 'object' ? draft.formData as Record<string, unknown> : {};
  const audioPrefix = isAudioAnalysisUnavailable.value ? '음질 분석 불가' : isReferenceAudioAnalysis.value ? '음질 참고용 분석' : '음질 분석';
  const nextDescription = [
    String(draftForm.description || '').trim(),
    report.audio ? `${audioPrefix}: ${isAudioAnalysisUnavailable.value ? '점수 없음' : `${audioGradeText.value}, ${audioScoreText.value}`}.` : '',
    `Vinyl-Check 감정: ${report.pressing.releaseCountry} ${report.pressing.releaseYear}, 스크래치 분석 ${surfaceGradeText.value}, ${surfaceScoreText.value}.`,
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
      price: String(recommendStarterPrice()),
      description: nextDescription,
      tags: String(draftForm.tags || '#VinylCheck #LP감정'),
      pressing: '',
      analysisConfirmed: 'true',
      audioGrade: isAudioAnalysisUnavailable.value ? undefined : report.audio?.lpConditionGrade || report.audio?.audioGrade,
      audioScore: isAudioAnalysisUnavailable.value ? undefined : audioLpConditionScore.value,
    },
  });
  router.push('/app/sell');
};
</script>
