<template>
  <div class="size-full bg-white text-gray-900 flex flex-col">
    <header class="px-4 py-4 flex items-center border-b">
      <button class="p-2" :disabled="isAnalyzing" @click="router.back()">
        <ArrowLeft :size="24" />
      </button>
      <h1 class="ml-3 text-lg">감정서 만들기</h1>
    </header>

    <main class="flex-1 overflow-y-auto p-4 space-y-5">
      <section class="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <div class="flex gap-3">
          <div class="w-11 h-11 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
            <ScanLine :size="22" />
          </div>
          <div>
            <h2 class="text-base">감정 자료를 모아 결과를 만듭니다</h2>
            <p class="text-sm text-gray-600 mt-1">표면 이미지, 동영상, 카탈로그 번호를 바탕으로 판매 설명에 쓸 상태 근거를 만듭니다.</p>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <label class="block text-base" for="matrix-number">매트릭스 번호</label>
        <input id="matrix-number" v-model="matrixNumber" type="text" class="w-full px-4 py-3 border rounded-lg" placeholder="XLP47324-1A, YEX 749-2" />
        <p class="text-xs text-gray-500">런아웃/데드왁스 번호를 입력하면 판본 근거가 더 선명해집니다.</p>
      </section>

      <section class="space-y-3">
        <h2 class="text-base">대표 사진</h2>
        <div v-if="imagePreview" class="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
          <img :src="imagePreview" alt="업로드한 앨범 커버" class="w-full h-full object-cover" />
          <button class="absolute top-2 right-2 px-3 py-1 rounded-lg bg-black/60 text-white text-sm" @click="clearImage">변경</button>
        </div>
        <div v-else class="grid grid-cols-2 gap-3">
          <label class="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-600">
            <ImagePlus :size="28" class="mb-2 text-gray-500" />
            <span class="text-sm text-gray-700">사진 업로드</span>
            <input type="file" accept="image/*" class="hidden" @change="handleImage" />
          </label>
          <button class="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center hover:border-blue-600" @click="router.push('/sell/camera')">
            <Camera :size="28" class="mb-2 text-gray-500" />
            <span class="text-sm text-gray-700">촬영하기</span>
          </button>
        </div>
      </section>

      <section v-if="imagePreview" class="rounded-lg border p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-base">자켓 상태 분석</h2>
          <span class="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">{{ jacketRecognition.jacketGrade }} · {{ jacketRecognition.jacketScore }}점</span>
        </div>
        <div class="grid grid-cols-3 gap-2 text-xs">
          <div class="rounded-lg bg-gray-50 p-2"><p class="text-gray-500">테두리</p><p>{{ riskLabel(jacketRecognition.edgeWearRisk) }}</p></div>
          <div class="rounded-lg bg-gray-50 p-2"><p class="text-gray-500">모서리</p><p>{{ riskLabel(jacketRecognition.cornerWearRisk) }}</p></div>
          <div class="rounded-lg bg-gray-50 p-2"><p class="text-gray-500">반사</p><p>{{ formatPercent(jacketRecognition.glareRatio) }}</p></div>
          <div class="rounded-lg bg-gray-50 p-2"><p class="text-gray-500">색 바램</p><p>{{ riskLabel(jacketRecognition.colorFadeRisk) }}</p></div>
          <div class="rounded-lg bg-gray-50 p-2"><p class="text-gray-500">선명도</p><p>{{ jacketRecognition.blurVariance?.toFixed(1) || '-' }}</p></div>
          <div class="rounded-lg bg-gray-50 p-2"><p class="text-gray-500">신뢰도</p><p>{{ jacketRecognition.confidence }}점</p></div>
        </div>
        <p class="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">{{ jacketRecognition.recommendation }}</p>
      </section>

      <section class="space-y-3">
        <h2 class="text-base">음반 이미지/동영상</h2>
        <div v-if="recordPreview" class="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
          <img :src="recordPreview" alt="업로드한 음반 표면" class="w-full h-full object-cover" />
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
          <span v-if="scratchRegions.length" class="absolute left-2 bottom-2 rounded bg-black/70 px-2 py-1 text-xs text-white">후보 {{ scratchRegions.length }}곳</span>
          <button class="absolute top-2 right-2 px-3 py-1 rounded-lg bg-black/60 text-white text-sm" @click="clearRecordImage">변경</button>
        </div>
        <div v-if="recordVideoPreview" class="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
          <video :src="recordVideoPreview" controls class="w-full h-full object-cover" />
          <button class="absolute top-2 right-2 px-3 py-1 rounded-lg bg-black/60 text-white text-sm" @click="clearRecordVideo">변경</button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <label v-if="!recordPreview" class="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-600">
            <ImagePlus :size="28" class="mb-2 text-gray-500" />
            <span class="text-sm text-gray-700">이미지 업로드</span>
            <input type="file" accept="image/*" class="hidden" @change="handleRecordImage" />
          </label>
          <label v-if="!recordVideoPreview" class="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-600">
            <Video :size="28" class="mb-2 text-gray-500" />
            <span class="text-sm text-gray-700">동영상 업로드</span>
            <input type="file" accept="video/*" class="hidden" @change="handleRecordVideo" />
          </label>
        </div>
      </section>

      <section class="rounded-lg border border-blue-100 bg-blue-50 p-3">
        <div class="flex items-start gap-2">
          <Video :size="18" class="text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p class="text-sm font-medium text-blue-950">촬영 가이드</p>
            <ul class="mt-2 space-y-1 text-xs text-gray-700">
              <li v-for="guide in recordVideoGuides" :key="guide" class="flex gap-2">
                <span class="text-blue-600">•</span>
                <span>{{ guide }}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section v-if="recordMediaPreview" class="rounded-lg border p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-base">표면 상태 확인</h2>
          <span class="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">감정 참고</span>
        </div>
        <div>
          <div class="flex justify-between text-sm mb-2">
            <span>표면 상태 점수</span>
            <span class="text-blue-600">{{ recognition.surfaceScore || recognition.confidence }}점</span>
          </div>
          <div class="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div class="h-full bg-blue-600" :style="{ width: `${recognition.surfaceScore || recognition.confidence}%` }"></div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="rounded-lg bg-gray-50 p-2"><p class="text-gray-500">스크래치 후보</p><p>{{ recognition.scratchCount }}개</p></div>
          <div class="rounded-lg bg-gray-50 p-2"><p class="text-gray-500">표시 위치</p><p>{{ scratchRegions.length }}곳</p></div>
          <div class="rounded-lg bg-gray-50 p-2"><p class="text-gray-500">강한 후보</p><p>{{ scratchDetails.highSeverity || 0 }}곳</p></div>
          <div class="rounded-lg bg-gray-50 p-2"><p class="text-gray-500">반사 위험</p><p>{{ riskLabel(recognition.reflectionRisk) }}</p></div>
          <div class="rounded-lg bg-gray-50 p-2"><p class="text-gray-500">먼지/입자</p><p>{{ formatPercent(scratchDetails.dustRatio) }}</p></div>
          <div class="rounded-lg bg-gray-50 p-2"><p class="text-gray-500">홈 대비</p><p>{{ formatPercent(scratchDetails.grooveContrast) }}</p></div>
        </div>
        <p class="rounded-lg bg-yellow-50 p-3 text-xs text-yellow-900">{{ recognition.dustOrReflectionNote }}</p>
        <ul class="space-y-1 text-sm text-gray-700">
          <li v-for="signal in recognition.signals" :key="signal" class="flex gap-2">
            <Check :size="15" class="text-green-600 mt-0.5 shrink-0" />
            <span>{{ signal }}</span>
          </li>
        </ul>
      </section>

      <section class="space-y-3">
        <label class="block text-base" for="catalog-number">카탈로그 번호</label>
        <div class="flex gap-2">
          <input id="catalog-number" v-model="catalogNumber" type="text" class="flex-1 min-w-0 px-4 py-3 border rounded-lg" placeholder="CL 1355, PCS 7088" />
          <button class="px-4 py-3 border rounded-lg text-sm text-blue-600 whitespace-nowrap disabled:text-gray-400" :disabled="isSearching" @click="refreshCandidates">
            {{ isSearching ? '검색 중' : 'Discogs 검색' }}
          </button>
        </div>
      </section>

      <section v-if="candidates.length > 0" class="space-y-3">
        <h2 class="text-base">앨범 후보</h2>
        <button
          v-for="candidate in candidates"
          :key="candidate.id"
          :class="['w-full text-left rounded-lg border p-4', selectedCandidateId === candidate.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white']"
          @click="selectedCandidateId = candidate.id"
        >
          <p class="font-medium">{{ candidate.title }}</p>
          <p class="text-sm text-gray-600">{{ candidate.artist }} · {{ candidate.year || '연도 미상' }} · {{ candidate.label }}</p>
          <p class="text-xs text-gray-500 mt-1">{{ candidate.country }} / {{ candidate.catalogNumber }}</p>
        </button>
      </section>

    </main>

    <footer class="p-4 border-t">
      <button class="w-full py-4 rounded-lg text-white disabled:bg-gray-300 bg-blue-600" :disabled="!canAnalyze || isAnalyzing" @click="startAnalysis">
        감정 결과 만들기
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, Camera, Check, ImagePlus, ScanLine, Video } from 'lucide-vue-next';
import {
  analyzeJacketImage,
  analyzeLpMedia,
  recognizeJacketImage,
  recognizeLpImage,
  saveCoverAnalysisReport,
  type AudioAnalysisResult,
  type JacketRecognition,
  type LpRecognition,
} from '@/features/seller/services/analysis';
import {
  createPressingInfo,
  fetchDiscogsCandidates,
  findAlbumCandidates,
  type AlbumCandidate,
} from '@/features/seller/services/discogs';
import { useAppStore } from '@/shared/stores/appStore';

const router = useRouter();
const store = useAppStore();
const draft = store.readDraft();
const draftForm = draft?.formData && typeof draft.formData === 'object' ? draft.formData as Record<string, unknown> : {};
const draftImages = Array.isArray(draft?.images) ? draft.images as string[] : [];
const catalogNumber = ref(String(draftForm.catalogNumber || ''));
const matrixNumber = ref(String(draftForm.matrixNumber || ''));
const imagePreview = ref(draftImages[0] || '');
const recordPreview = ref(draftImages[1] || '');
const recordVideoPreview = ref(String(draft?.recordVideoDataUrl || ''));
const jacketRecognition = ref<JacketRecognition>(recognizeJacketImage(imagePreview.value));
const recognition = ref<LpRecognition>(recognizeLpImage(recordPreview.value || recordVideoPreview.value));
const candidates = ref<AlbumCandidate[]>([]);
const selectedCandidateId = ref('');
const isAnalyzing = ref(false);
const isSearching = ref(false);

const selectedCandidate = computed(() => candidates.value.find(candidate => candidate.id === selectedCandidateId.value) || null);
const fallbackCandidate = computed(() => selectedCandidate.value || findAlbumCandidates('')[0]);
const pressing = computed(() => createPressingInfo(fallbackCandidate.value, matrixNumber.value));
const recordMediaPreview = computed(() => recordPreview.value || recordVideoPreview.value);
const scratchRegions = computed(() => recognition.value.scratchRegions || []);
const scratchDetails = computed(() => recognition.value.scratchDetails || {});
const canAnalyze = computed(() => Boolean(recordMediaPreview.value && catalogNumber.value.trim() && selectedCandidate.value));
const scratchColor = (severity?: string) => severity === 'high' ? '#ef4444' : severity === 'medium' ? '#f97316' : '#facc15';
const riskLabel = (risk?: 'low' | 'medium' | 'high' | string) => risk === 'high' ? '높음' : risk === 'medium' ? '주의' : '낮음';
const formatPercent = (value?: number | null) => typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '-';
const recordVideoGuides = [
  '밝은 곳에서 LP 표면 전체가 보이도록 8~12초 정도 천천히 촬영하세요.',
  '휴대폰을 비스듬히 살짝 움직여 반사 위치가 이동하게 찍으면 스크래치와 먼지 구분이 쉬워집니다.',
  '중앙 라벨보다 홈이 있는 검은 표면을 크게 담고, 손 그림자와 강한 플래시는 피해주세요.',
];

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const applyCandidates = (nextCandidates: AlbumCandidate[]) => {
  candidates.value = nextCandidates;
  selectedCandidateId.value = nextCandidates[0]?.id || '';
};

const refreshCandidates = async () => {
  const catalog = catalogNumber.value.trim();
  isSearching.value = true;
  const result = catalog
    ? await fetchDiscogsCandidates(catalog, '', '')
    : { candidates: findAlbumCandidates(''), source: 'mock' as const };
  applyCandidates(result.candidates);
  isSearching.value = false;
};

const handleImage = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  imagePreview.value = await readFileAsDataUrl(file);
  jacketRecognition.value = await analyzeJacketImage(imagePreview.value);
  if (!catalogNumber.value.trim()) catalogNumber.value = 'CL 1355';
  await refreshCandidates();
};

const handleRecordImage = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  recordPreview.value = await readFileAsDataUrl(file);
  recognition.value = await analyzeLpMedia(recordPreview.value, 'image');
};

const handleRecordVideo = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  recordVideoPreview.value = await readFileAsDataUrl(file);
  recognition.value = await analyzeLpMedia(recordVideoPreview.value, 'video');
};

const clearImage = () => {
  imagePreview.value = '';
  jacketRecognition.value = recognizeJacketImage('');
};

const clearRecordImage = () => {
  recordPreview.value = '';
  recognition.value = recognizeLpImage(recordVideoPreview.value, 'video');
};

const clearRecordVideo = () => {
  recordVideoPreview.value = '';
  recognition.value = recognizeLpImage(recordPreview.value, 'image');
};

watch(catalogNumber, () => {
  const catalog = catalogNumber.value.trim();
  if (catalog.length >= 3) applyCandidates(findAlbumCandidates(catalog));
});

const startAnalysis = () => {
  if (!canAnalyze.value || !selectedCandidate.value) return;
  isAnalyzing.value = true;
  saveCoverAnalysisReport({
    imageDataUrl: imagePreview.value || recordPreview.value,
    recordImageDataUrl: recordPreview.value,
    recordVideoDataUrl: recordVideoPreview.value,
    catalogNumber: catalogNumber.value,
    matrixNumber: matrixNumber.value,
    recognition: recognition.value,
    selectedCandidate: selectedCandidate.value,
    pressing: pressing.value,
    audio: draft?.audioAnalysis as AudioAnalysisResult | undefined,
    jacket: jacketRecognition.value,
  });
  router.push('/sell/analysis/result');
};

onMounted(async () => {
  if (imagePreview.value && !catalogNumber.value.trim()) catalogNumber.value = 'CL 1355';
  if (imagePreview.value) jacketRecognition.value = await analyzeJacketImage(imagePreview.value);
  if (recordPreview.value) {
    recognition.value = await analyzeLpMedia(recordPreview.value, 'image');
  } else if (recordVideoPreview.value) {
    recognition.value = await analyzeLpMedia(recordVideoPreview.value, 'video');
  }
  if (catalogNumber.value.trim().length >= 3) {
    await refreshCandidates();
  }
});
</script>
