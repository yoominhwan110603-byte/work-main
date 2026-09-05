<template>
  <main class="size-full bg-white text-gray-900 flex flex-col">
    <header class="shrink-0 px-3 py-3 sm:px-4 sm:py-4 flex items-center justify-between gap-3 border-b">
      <div class="flex min-w-0 items-center gap-2">
        <button class="shrink-0 p-2 rounded-full active:bg-gray-100" @click="goBackOr(router, '/app')">
          <ArrowLeft :size="24" />
        </button>
        <h1 class="truncate text-lg font-semibold">{{ isEditing ? '판매글 수정' : '판매 등록' }}</h1>
      </div>
      <div class="relative flex shrink-0 items-center gap-2">
        <button v-if="showDraftMenu" type="button" class="fixed inset-0 z-30 bg-transparent" aria-label="임시저장 메뉴 닫기" @click="showDraftMenu = false"></button>
        <section v-if="showDraftMenu" class="absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border border-gray-200 bg-white p-3 shadow-xl">
          <p class="px-2 pb-2 text-sm font-medium text-gray-900">저장된 임시글</p>
          <div v-if="draftEntries.length" class="border-t pt-2">
            <div v-for="entry in draftEntries" :key="entry.id" class="flex items-center gap-2 rounded-lg px-2 py-2 active:bg-gray-50">
              <button type="button" class="min-w-0 flex-1 text-left" @click="loadDraftFromMenu(entry)">
                <p class="truncate text-sm font-medium text-gray-900">{{ entry.title }}</p>
                <p class="truncate text-xs text-gray-500">{{ formatDraftUpdated(entry.updatedAt) }}</p>
              </button>
              <button type="button" class="rounded-lg p-2 text-red-600 active:bg-red-50" aria-label="임시글 삭제" @click.stop="removeDraftEntry(entry.id)">
                <Trash2 :size="16" />
              </button>
            </div>
          </div>
          <p v-else class="border-t pt-3 text-center text-xs text-gray-500">저장된 임시글 없음</p>
        </section>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-2.5 py-2 text-xs text-gray-700 disabled:text-gray-400 sm:px-3 sm:text-sm"
          :disabled="draftSaving"
          @click="saveDraft(true)"
        >
          {{ draftSaving ? '저장 중' : '임시저장' }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-gray-300 p-2 text-gray-600"
          aria-label="저장된 임시글 보기"
          @click="showDraftMenu = !showDraftMenu"
        >
          <ChevronDown :size="15" :class="showDraftMenu ? 'rotate-180' : ''" />
        </button>
        <button
          :disabled="currentSellStep === 'publish' && (!valid || publishSaving)"
          :class="[
            'rounded-lg px-3 py-2 text-sm sm:px-4',
            currentSellStep !== 'publish' || (valid && !publishSaving) ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400',
          ]"
          @click="currentSellStep === 'publish' ? publishListingAction() : goNextSellStep()"
        >
          {{ currentSellStep === 'publish' ? (publishSaving ? (isEditing ? '수정 중' : '게시 중') : (isEditing ? '수정' : '게시')) : '다음' }}
        </button>
      </div>
    </header>
    <p v-if="draftMessage" :class="['fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm text-white shadow-lg', draftSavedToDb ? 'bg-green-600' : 'bg-red-600']">
      {{ draftMessage }}
    </p>

    <nav class="shrink-0 border-b bg-white px-3 py-3 sm:px-4" aria-label="판매 등록 단계">
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="(step, index) in sellSteps"
          :key="step.id"
          type="button"
          :class="['min-w-0 rounded-lg border px-2 py-2 text-center text-xs', currentSellStep === step.id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500']"
          @click="goToSellStep(step.id)"
        >
          <span class="block font-semibold">{{ index + 1 }}</span>
          <span class="mt-0.5 block truncate">{{ step.label }}</span>
        </button>
      </div>
    </nav>

    <section class="flex-1 overflow-y-auto px-3 py-4 pb-8 sm:p-4 sm:pb-8 space-y-5 sm:space-y-6">
      <section v-show="currentSellStep === 'media'" class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-medium">사진</h2>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <PhotoSlot title="대표 이미지" help="카메라로 촬영" :image="coverImage" @picked="file => setImage('cover', file)" @clear="clearImage('cover')" @open-camera="openSurfaceCamera('image', 'cover')" />
          <PhotoSlot title="표면 이미지" help="상태 확인용" :image="recordImage" @picked="file => setImage('record', file)" @clear="clearImage('record')" @open-camera="openSurfaceCamera('image', 'record')" />
          <VideoSlot title="표면 동영상" help="선택 사항" :video="recordVideo" @picked="setRecordVideo" @clear="clearRecordVideo" @open-camera="openSurfaceCamera('video')" />
        </div>

        <details class="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <summary class="cursor-pointer text-sm font-medium text-gray-800">촬영 팁</summary>
          <div class="mt-2">
              <ul class="mt-2 space-y-1 text-xs text-gray-700">
                <li v-for="guide in recordVideoGuides" :key="guide" class="flex gap-2">
                  <span class="text-gray-500">•</span>
                  <span>{{ guide }}</span>
                </li>
              </ul>
          </div>
        </details>

        <div v-if="recordMediaPreview" class="rounded-lg border p-3 text-sm">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <p class="font-medium">표면 상태</p>
              <p class="text-gray-500 mt-1">사진 기준 확인 결과입니다.</p>
            </div>
            <span class="px-2 py-1 rounded text-xs shrink-0 bg-blue-100 text-blue-700">
              {{ recordSurfaceScoreText }}
            </span>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">스크래치 등급</p><p>{{ recordScratchGradeText }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">스크래치 점수</p><p>{{ recordSurfaceScoreText }}</p></div>
          </div>
          <p v-if="isSurfaceAnalysisUnavailable" class="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">표면 정밀 분석이 완료되지 않아 점수와 등급을 표시하지 않습니다. 다시 촬영해 주세요.</p>
          <ScratchInspectionPreview
            v-if="recordRecognition.scratchRegions.length"
            class="mt-3"
            :media-url="recordMediaPreview"
            :media-type="recordInspectionMediaType"
            :regions="recordRecognition.scratchRegions"
          />
          <div v-if="recordRecognition.scratchRegions.length" class="mt-3 rounded-lg bg-gray-950 text-white p-2 text-xs">
            스크래치가 보이는 부분이 있습니다. 판매 전에 한 번 더 확인해 주세요.
          </div>
        </div>
      </section>

      <section v-show="currentSellStep === 'details'" class="space-y-4">
        <h2 class="text-base font-medium">판매 정보</h2>
        <div>
          <label class="block text-sm mb-2">카탈로그 번호 *</label>
          <div class="flex flex-col gap-2 sm:flex-row">
            <input v-model="form.catalogNumber" type="text" class="flex-1 min-w-0 px-4 py-3 border rounded-lg" placeholder="예: CL 1355, PCS 7088, ST-A-691671" @keydown.enter.prevent="searchCatalog" />
            <button type="button" class="w-full px-4 py-3 border rounded-lg whitespace-nowrap text-sm text-blue-600 disabled:text-gray-300 sm:w-auto" :disabled="isCatalogSearching || (form.catalogNumber.trim().length < 3 && form.title.trim().length < 2 && form.artist.trim().length < 2)" @click="searchCatalog">
              {{ isCatalogSearching ? '검색 중' : 'Discogs 검색' }}
            </button>
          </div>
          <p v-if="catalogLookupMessage" class="text-xs text-blue-600 mt-1">{{ catalogLookupMessage }}</p>
          <p v-if="catalogApiStatus" class="text-[11px] text-gray-500 mt-1">{{ catalogApiStatus }}</p>
        </div>

        <section v-if="catalogCandidates.length > 0" class="rounded-lg border p-3 space-y-3">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-medium">Discogs 후보</p>
            <span class="text-xs text-gray-500">{{ candidateSource === 'mock' ? '검색 실패' : candidateSource }}</span>
          </div>
          <div class="space-y-2">
            <button v-for="candidate in catalogCandidates" :key="candidate.id" type="button" :class="['w-full text-left rounded-lg border p-3', selectedCandidateId === candidate.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white']" @click="selectCatalogCandidate(candidate.id)">
              <p :class="['text-base font-semibold', selectedCandidateId === candidate.id ? 'text-blue-700' : 'text-gray-900']">{{ candidate.catalogNumber || '카탈로그 번호 미상' }}</p>
              <p class="mt-1 text-sm">{{ candidate.title }}</p>
              <p class="text-xs text-gray-500 mt-1">{{ candidate.artist }} · {{ candidate.label }} · {{ candidate.country }} {{ candidate.year || '' }}</p>
            </button>
          </div>
          <button type="button" class="w-full py-3 rounded-lg bg-blue-600 text-white disabled:bg-gray-300" :disabled="!selectedCandidate" @click="applyCatalogCandidate">
            선택한 정보 적용
          </button>
        </section>

        <div>
          <label class="block text-sm mb-2">앨범명 *</label>
          <input v-model="form.title" type="text" class="w-full px-4 py-3 border rounded-lg" placeholder="Discogs 후보를 적용하거나 직접 입력하세요" />
        </div>
        <div>
          <label class="block text-sm mb-2">아티스트</label>
          <input v-model="form.artist" type="text" class="w-full px-4 py-3 border rounded-lg" placeholder="아티스트명" />
        </div>
      </section>

      <section v-show="currentSellStep === 'audio'" class="space-y-3">
        <h2 class="text-base font-medium">상태 확인</h2>
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
          <div class="min-w-0">
            <p class="font-medium text-gray-950">음질 샘플</p>
            <p class="mt-1 text-xs text-gray-600">1분 이상, 최대 30분까지 녹음하면 뚝소리 횟수와 측정 시간으로 점수를 계산합니다.</p>
          </div>
          <p v-if="recordMediaPreview" class="mt-2 text-xs text-gray-600">{{ audioRecordingGuide }}</p>
        </div>

        <AudioRecorder kind="sample" :name="audioName" :url="audioUrl" :is-recording="recordingKind === 'sample'" :seconds="recordingSeconds" :min-seconds="MIN_AUDIO_RECORDING_SECONDS" :max-seconds="MAX_AUDIO_RECORDING_SECONDS" description="음질 샘플" @start="startAudioRecording" @stop="stopAudioRecording" @clear="clearAudio" />
        <p v-if="audioRecordedAt" class="rounded-lg bg-green-50 p-3 text-xs text-green-800">음질 샘플 저장됨.</p>

        <div v-if="recordingMessage" class="rounded-lg bg-gray-50 p-3 text-xs text-gray-700 space-y-2">
          <p>{{ recordingMessage }}</p>
          <button
            v-if="showMicSettingsButton"
            type="button"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
            @click="openMicrophoneSettings"
          >
            마이크 권한 설정 열기
          </button>
        </div>
        <button type="button" class="w-full py-3 rounded-lg bg-gray-900 text-white disabled:bg-gray-300" :disabled="!audioFile || audioAnalyzing" @click="runAudioAnalysis">
          {{ audioAnalyzing ? '확인 중' : '음질 확인' }}
        </button>

        <div v-if="audioAnalysis" class="rounded-lg border p-3 space-y-3 text-sm">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <p class="font-medium">음질 결과</p>
              <p class="text-gray-500 mt-1">{{ simpleAudioSummary }}</p>
              <p v-if="isAudioAnalysisUnavailable" class="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">정밀 분석이 불가능해 등급과 점수를 표시하지 않습니다. 다시 녹음해 주세요.</p>
              <p v-else-if="isReferenceAudioAnalysis" class="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">신뢰도가 낮아 참고용 분석으로 표시합니다.</p>
            </div>
            <div class="flex shrink-0 flex-wrap gap-1 sm:block sm:space-y-1 sm:text-right">
              <span :class="['inline-block px-2 py-1 rounded text-xs', isAudioAnalysisUnavailable ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-700']">
                {{ audioPrimaryBadge }}
              </span>
              <span :class="['block px-2 py-1 rounded text-xs', isReferenceAudioAnalysis ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700']">{{ audioAnalysisBadge }}</span>
            </div>
          </div>
          <div v-if="!isAudioAnalysisUnavailable" class="grid grid-cols-2 gap-2 text-xs">
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">음질 등급</p><p>{{ audioGradeText }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">음질 점수</p><p>{{ audioScoreText }}</p></div>
          </div>
        </div>
      </section>

      <section v-show="currentSellStep === 'publish'" class="space-y-4">
        <h2 class="text-base font-medium">게시 정보</h2>
        <div>
          <label class="block text-sm mb-2">판매 가격 *</label>
          <div class="flex flex-col gap-2 sm:flex-row">
            <input v-model="form.price" type="number" class="flex-1 min-w-0 px-4 py-3 border rounded-lg" placeholder="가격 입력" />
            <button type="button" class="w-full px-4 py-3 border rounded-lg whitespace-nowrap text-sm text-blue-600 sm:w-auto" @click="recommendPrice">추천 가격</button>
          </div>
          <p v-if="priceMessage" class="mt-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">{{ priceMessage }}</p>
        </div>
        <div>
          <label class="block text-sm mb-2">판매 장소</label>
          <div class="flex flex-col gap-2 sm:flex-row">
            <input v-model="form.location" type="text" required class="flex-1 min-w-0 px-4 py-3 border rounded-lg" placeholder="예: 서울특별시 강남구 강남역" @change="saveDraft(false)" />
            <button
              type="button"
              class="inline-flex w-full items-center justify-center gap-1 rounded-lg border px-4 py-3 text-sm text-blue-600 disabled:text-gray-300 sm:w-auto"
              :disabled="isLocatingCurrentPosition"
              @click="useCurrentLocation"
            >
              <MapPin :size="16" />
              <span>{{ isLocatingCurrentPosition ? '확인 중' : '현재 위치' }}</span>
            </button>
          </div>
          <p class="mt-1 text-xs text-gray-500">판매할 장소를 입력하거나 지도에서 원하는 지점을 눌러 선택하세요. 비워도 게시할 수 있습니다.</p>
          <div
            class="relative mt-3 h-56 touch-none overflow-hidden rounded-lg border bg-gray-100"
            @pointerdown="startFallbackMapDrag"
            @pointermove="moveFallbackMapDrag"
            @pointerup="endFallbackMapDrag"
            @pointercancel="endFallbackMapDrag"
            @pointerleave="endFallbackMapDrag"
          >
            <div ref="locationMapContainer" class="absolute inset-0"></div>
            <div v-if="locationMapFallbackHtml" class="absolute inset-0" v-html="locationMapFallbackHtml"></div>
            <div v-if="locationMapMessage" class="absolute inset-x-2 bottom-2 z-10 flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 text-xs text-gray-600 shadow-sm">
              <MapPin :size="14" class="shrink-0 text-blue-600" />
              <span>{{ locationMapMessage }}</span>
            </div>
            <button
              v-if="locationMapPoint"
              type="button"
              class="absolute right-2 top-2 z-10 rounded-lg bg-blue-600 px-3 py-2 text-xs text-white shadow-sm active:bg-blue-700"
              @click.stop="chooseMapLocation"
            >
              이 위치 선택
            </button>
            <div v-if="locationMapFallbackHtml" class="absolute left-2 top-2 z-10 flex overflow-hidden rounded-lg bg-white shadow-sm">
              <button type="button" class="px-3 py-2 text-base font-semibold active:bg-gray-100" @click.stop="zoomFallbackMap(1)">+</button>
              <button type="button" class="border-l px-3 py-2 text-base font-semibold active:bg-gray-100" @click.stop="zoomFallbackMap(-1)">-</button>
            </div>
          </div>
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="block text-sm">상세 설명</label>
            <button type="button" class="text-xs text-blue-600" @click="fillDescription">내용 채우기</button>
          </div>
          <textarea v-model="form.description" class="w-full px-4 py-3 border rounded-lg min-h-36" placeholder="상태와 음질을 간단히 적어 주세요." />
        </div>
      </section>

      <section v-show="currentSellStep === 'publish'" class="rounded-lg border p-3 space-y-3">
        <h2 class="text-base font-medium">확인 요약</h2>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">표면</p><p>{{ recordSurfaceScoreText }}</p></div>
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">음질</p><p>{{ audioLpConditionText }}</p></div>
        </div>
      </section>
    </section>

  </main>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch, type PropType } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Camera, ChevronDown, MapPin, Mic, Trash2, Upload, Video } from 'lucide-vue-next';
import {
  analyzeLpMedia,
  recognizeLpImage,
  type LpRecognition,
  type ScratchRegion,
} from '@/features/seller/services/analysis';
import { createPressingInfo, fetchDiscogsCandidates, type AlbumCandidate } from '@/features/seller/services/discogs';
import { analyzeAudioSamples, type AudioAnalysisResult } from '@/features/seller/services/audio';
import { fetchPriceRecommendation } from '@/features/seller/services/pricing';
import { useAppStore, type ListingDraftEntry } from '@/shared/stores/appStore';
import { openAppPermissionSettings } from '@/shared/services/appSettings';
import { canUseNativeAudioRecorder, startNativeAudioRecording, stopNativeAudioRecording } from '@/features/seller/services/nativeAudioRecorder';
import { setPendingSellDraft, takePendingCapture, takePendingSellDraft, type CaptureTarget } from '@/features/seller/services/captureTransfer';
import { readListingImageSlots } from '@/features/seller/services/listingImages';
import {
  findKakaoMapPoint,
  getKakaoMapJavaScriptKey,
  loadKakaoMaps,
  type KakaoMapInstance,
  type KakaoMapPoint,
  type KakaoMarkerInstance,
} from '@/shared/services/kakaoMap';
import { findLocationPointByRest, renderStaticMapHtml, reverseLocationPointByRest } from '@/shared/services/staticMap';
import { type LocationFilterScope } from '@/shared/services/locationFilter';
import { goBackOr } from '@/shared/services/navigation';
import { persistListingImage } from '@/shared/services/mediaUpload';

const router = useRouter();
const route = useRoute();
const store = useAppStore();
const editingListingId = computed(() => String(route.params.id || ''));
const isEditing = computed(() => Boolean(editingListingId.value));
const sourceCollectionId = computed(() => String(route.query.collectionId || ''));
type SellStep = 'media' | 'details' | 'audio' | 'publish';
const MIN_AUDIO_RECORDING_SECONDS = 60;
const MAX_AUDIO_RECORDING_SECONDS = 30 * 60;
const sellSteps: Array<{ id: SellStep; label: string }> = [
  { id: 'media', label: '사진' },
  { id: 'details', label: '판본' },
  { id: 'audio', label: '검수' },
  { id: 'publish', label: '가격' },
];
const currentSellStep = ref<SellStep>('media');
const currentSellStepIndex = computed(() => sellSteps.findIndex(step => step.id === currentSellStep.value));
const goToSellStep = (step: SellStep) => { currentSellStep.value = step; };
const goNextSellStep = () => {
  const next = sellSteps[Math.min(sellSteps.length - 1, currentSellStepIndex.value + 1)];
  if (next) currentSellStep.value = next.id;
};
const transferredSellDraft = takePendingSellDraft();
const pendingSellDraft = String(transferredSellDraft?.editingListingId || '') === editingListingId.value ? transferredSellDraft : null;
const restoredPendingSellDraft = Boolean(pendingSellDraft);
const draft = pendingSellDraft || (isEditing.value ? null : store.readDraft());
const draftForm = draft?.formData && typeof draft.formData === 'object' ? draft.formData as Record<string, unknown> : {};
const draftImageSlots = readListingImageSlots(draft);
type TradeLocationScope = Extract<LocationFilterScope, 'city' | 'district' | 'neighborhood'>;
type KakaoMapsRuntime = Awaited<ReturnType<typeof loadKakaoMaps>>;
const normalizeTradeLocationScope = (value: unknown): TradeLocationScope => {
  if (value === 'city' || value === 'district' || value === 'neighborhood') return value;
  return 'district';
};

const form = reactive({
  title: String(draftForm.title || ''),
  artist: String(draftForm.artist || ''),
  catalogNumber: String(draftForm.catalogNumber || ''),
  price: String(draftForm.price || ''),
  location: String(draftForm.location || ''),
  locationScope: normalizeTradeLocationScope(draftForm.locationScope),
  description: String(draftForm.description || ''),
  pressing: String(draftForm.pressing || ''),
  analysisConfirmed: String(draftForm.analysisConfirmed || ''),
});

const coverImage = ref(draftImageSlots.cover);
const recordImage = ref(draftImageSlots.record);
const extraImages = ref<string[]>(draftImageSlots.extras);
const recordVideo = ref(String(draft?.recordVideoDataUrl || ''));
const draftAudioName = String(draft?.audioFileName || draft?.goodAudioFileName || draft?.noisyAudioFileName || '');
const draftAudioDataUrl = String(draft?.audioDataUrl || draft?.goodAudioDataUrl || draft?.noisyAudioDataUrl || '');
const draftAudioRecordedAt = String(draft?.audioRecordedAt || draft?.goodAudioRecordedAt || draft?.noisyAudioRecordedAt || '');
const draftAudioDuration = Number(draft?.audioDurationSeconds || draft?.goodSampleEnd || draft?.noisySampleEnd || MIN_AUDIO_RECORDING_SECONDS);
const audioFile = ref<File | null>(null);
const audioName = ref(draftAudioName);
const audioDataUrl = ref(draftAudioDataUrl);
const audioRecordedAt = ref(draftAudioRecordedAt);
const audioDurationSeconds = ref(Math.max(0, Math.floor(draftAudioDuration || MIN_AUDIO_RECORDING_SECONDS)));
const audioUrl = ref(audioDataUrl.value);
const recordingKind = ref<'sample' | null>(null);
const recordingSeconds = ref(0);
const recordingMessage = ref('');
const showMicSettingsButton = ref(false);
const audioAnalyzing = ref(false);
let mediaRecorder: MediaRecorder | null = null;
let recordingStream: MediaStream | null = null;
let recordingTimer: number | null = null;
let recordingChunks: BlobPart[] = [];
let recordingUsesNative = false;

const audioAnalysis = ref<AudioAnalysisResult | null>((draft?.audioAnalysis as AudioAnalysisResult | null) || null);
const recordRecognition = ref<LpRecognition>(
  (draft?.recordRecognition as LpRecognition | undefined)
  || recognizeLpImage(recordImage.value || recordVideo.value),
);
const priceMessage = ref('');
const catalogLookupMessage = ref('');
const catalogApiStatus = ref('');
const draftMessage = ref('');
const draftSaving = ref(false);
const publishSaving = ref(false);
const draftSavedToDb = ref(false);
const draftEntries = ref<ListingDraftEntry[]>(store.readDrafts());
const showDraftMenu = ref(false);
let draftAutoSaveTimer: number | undefined;
const catalogCandidates = ref<AlbumCandidate[]>([]);
const selectedCandidateId = ref('');
const candidateSource = ref<'discogs' | 'discogs-direct' | 'mock' | ''>('');
const isCatalogSearching = ref(false);
let catalogLookupRequest = 0;
const locationMapContainer = ref<HTMLElement | null>(null);
const locationMapMessage = ref('');
const locationMapPoint = ref<KakaoMapPoint | null>(null);
const locationMapFallbackHtml = ref('');
const locationMapZoom = ref(15);
const isLocatingCurrentPosition = ref(false);
let locationMap: KakaoMapInstance | null = null;
let locationMarker: KakaoMarkerInstance | null = null;
let locationMapClickBound = false;
let locationMapRequest = 0;
let locationMapTimer: number | undefined;
let fallbackDrag:
  | { pointerId: number; startX: number; startY: number; startLat: number; startLng: number; moved: boolean }
  | null = null;
const fallbackPointers = new Map<number, { x: number; y: number }>();
let fallbackPinch:
  | { startDistance: number; startZoom: number; lastZoom: number }
  | null = null;

const recordMediaPreview = computed(() => recordImage.value || recordVideo.value);
const recordInspectionMediaType = computed<'image' | 'video'>(() => recordImage.value ? 'image' : 'video');
const selectedCandidate = computed(() => catalogCandidates.value.find(candidate => candidate.id === selectedCandidateId.value));
const riskLabel = (risk?: 'low' | 'medium' | 'high' | string) => risk === 'high' ? '높음' : risk === 'medium' ? '주의' : risk === 'low' ? '낮음' : '확인 불가';
const formatRecordedDate = (timestamp: string) => new Date(timestamp).toLocaleDateString('ko-KR');
function gradeFromScore(score: number) {
  if (score >= 96) return 'M';
  if (score >= 88) return 'NM';
  if (score >= 80) return 'EX';
  if (score >= 70) return 'VG+';
  if (score >= 58) return 'VG';
  if (score >= 45) return 'G';
  return 'P';
}
const isSurfaceAnalysisUnavailable = computed(() => Boolean(recordMediaPreview.value && (
  recordRecognition.value.analysisAvailable === false
  || recordRecognition.value.source === 'fallback'
)));
const recordSurfaceScoreText = computed(() => {
  if (!recordMediaPreview.value) return '-';
  if (isSurfaceAnalysisUnavailable.value) return '분석 불가';
  return `${recordRecognition.value.surfaceScore || recordRecognition.value.confidence || 0}점`;
});
const recordScratchGradeText = computed(() => {
  if (!recordMediaPreview.value) return '-';
  if (isSurfaceAnalysisUnavailable.value) return '분석 불가';
  return recordRecognition.value.surfaceGrade || gradeFromScore(recordRecognition.value.surfaceScore || recordRecognition.value.confidence || 0);
});
const isAudioAnalysisUnavailable = computed(() => Boolean(audioAnalysis.value && (
  audioAnalysis.value.analysisAvailable === false
  || audioAnalysis.value.source === 'fallback'
  || audioAnalysis.value.source === 'mock'
  || audioAnalysis.value.audioScore == null
  || audioAnalysis.value.audioGrade == null
)));
const isReferenceAudioAnalysis = computed(() => Boolean(audioAnalysis.value && (
  isAudioAnalysisUnavailable.value
  || Number(audioAnalysis.value.analysisConfidence || 0) < 60
)));
const audioLpConditionScore = computed(() => audioAnalysis.value?.lpConditionScore ?? audioAnalysis.value?.audioScore ?? null);
const audioLpConditionText = computed(() => {
  if (!audioAnalysis.value) return '-';
  if (isAudioAnalysisUnavailable.value || typeof audioLpConditionScore.value !== 'number') return '분석 불가';
  const grade = audioAnalysis.value.lpConditionGrade || audioAnalysis.value.audioGrade || '';
  return `${grade ? `${grade} · ` : ''}${audioLpConditionScore.value}점`;
});
const audioGradeText = computed(() => {
  if (!audioAnalysis.value) return '-';
  if (isAudioAnalysisUnavailable.value) return '분석 불가';
  return audioAnalysis.value.lpConditionGrade || audioAnalysis.value.audioGrade || '-';
});
const audioScoreText = computed(() => {
  if (!audioAnalysis.value) return '-';
  if (isAudioAnalysisUnavailable.value || typeof audioLpConditionScore.value !== 'number') return '분석 불가';
  return `${audioLpConditionScore.value}점`;
});
const audioPrimaryBadge = computed(() => {
  if (!audioAnalysis.value) return '미분석';
  if (isAudioAnalysisUnavailable.value) return '분석 불가';
  return `LP ${audioLpConditionText.value}`;
});
const audioAnalysisBadge = computed(() => isAudioAnalysisUnavailable.value ? '분석 불가' : isReferenceAudioAnalysis.value ? '참고 분석' : '확인 완료');
const simpleAudioSummary = computed(() => {
  if (!audioAnalysis.value) return '';
  if (isAudioAnalysisUnavailable.value) return audioAnalysis.value.summary || '음질 분석 불가입니다. 다시 녹음해 주세요.';
  return `음질 ${audioGradeText.value}, ${audioScoreText.value}입니다.`;
});
const usableSurfaceScore = computed(() => isSurfaceAnalysisUnavailable.value ? undefined : recordRecognition.value.surfaceScore || undefined);
const usableAudioScore = computed(() => isAudioAnalysisUnavailable.value || typeof audioLpConditionScore.value !== 'number' ? undefined : audioLpConditionScore.value);
const usableAudioGrade = computed(() => isAudioAnalysisUnavailable.value ? undefined : audioAnalysis.value?.lpConditionGrade || audioAnalysis.value?.audioGrade || undefined);
const recordVideoGuides = [
  '밝은 곳에서 LP 표면 전체가 보이도록 8~12초 정도 천천히 촬영하세요.',
  '카메라를 살짝 움직여 반사 위치가 이동하게 찍으면 스크래치와 먼지 구분이 쉬워집니다.',
  '중앙 라벨보다 홈이 있는 표면을 넓게 담고, 강한 플래시는 피해주세요.',
];
const clockLabelForScratch = (region: ScratchRegion) => {
  const centerX = (region.x1 + region.x2) / 2 - 0.5;
  const centerY = (region.y1 + region.y2) / 2 - 0.5;
  const angle = Math.atan2(centerY, centerX);
  const hour = Math.round(((angle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 12) || 12;
  return `${hour}시 방향`;
};
const grooveLabelForScratch = (region: ScratchRegion) => {
  const centerX = (region.x1 + region.x2) / 2 - 0.5;
  const centerY = (region.y1 + region.y2) / 2 - 0.5;
  const radius = Math.sqrt(centerX * centerX + centerY * centerY);
  if (radius < 0.18) return '안쪽 홈';
  if (radius < 0.34) return '중간 홈';
  return '바깥쪽 홈';
};
const audioRecordingGuide = computed(() => {
  const severeRegions = [...recordRecognition.value.scratchRegions]
    .filter(region => region.severity !== 'low')
    .sort((left, right) => {
      const severityScore = { high: 3, medium: 2, low: 1 };
      return severityScore[right.severity || 'low'] - severityScore[left.severity || 'low'];
    });
  const targetRegion = severeRegions[0] || recordRecognition.value.scratchRegions[0];
  if (!recordMediaPreview.value) return '표면 사진을 먼저 올리면 더 정확합니다.';
  if (targetRegion) {
    return `${clockLabelForScratch(targetRegion)} ${grooveLabelForScratch(targetRegion)}에 보이는 스크래치까지 포함해 한 번에 녹음하세요.`;
  }
  return `스크래치 분석은 ${recordScratchGradeText.value}, ${recordSurfaceScoreText.value}입니다. 한 구간으로 전체 재생 상태를 확인합니다.`;
});
const hasRequiredListingFields = computed(() => Boolean(form.title.trim() && Number(form.price) > 0));
const valid = computed(() => hasRequiredListingFields.value);

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const dataUrlToFile = (dataUrl: string, filename: string) => {
  const [header, base64Data = ''] = dataUrl.split(',');
  const mimeMatch = header.match(/data:([^;]+);base64/);
  const mimeType = mimeMatch?.[1] || 'application/octet-stream';
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], filename, { type: mimeType });
};
const audioFileFromDataUrl = (dataUrl: string, filename: string) => dataUrl.startsWith('data:')
  ? dataUrlToFile(dataUrl, filename)
  : null;

const resetConfirmation = () => {
  form.analysisConfirmed = '';
};

const setImage = async (slot: 'cover' | 'record', file: File) => {
  const dataUrl = await readFileAsDataUrl(file);
  if (slot === 'cover') {
    coverImage.value = dataUrl;
  } else {
    recordImage.value = dataUrl;
    recordRecognition.value = await analyzeLpMedia(dataUrl, 'image');
    resetConfirmation();
  }
  saveDraft(false);
};

const setRecordVideo = async (file: File) => {
  recordVideo.value = await readFileAsDataUrl(file);
  recordRecognition.value = await analyzeLpMedia(recordVideo.value, 'video');
  resetConfirmation();
  saveDraft(false);
};

const clearImage = (slot: 'cover' | 'record') => {
  if (slot === 'cover') {
    coverImage.value = '';
  } else {
    recordImage.value = '';
    recordRecognition.value = recognizeLpImage(recordMediaPreview.value);
    resetConfirmation();
  }
  saveDraft(false);
};

const clearRecordVideo = () => {
  recordVideo.value = '';
  recordRecognition.value = recognizeLpImage(recordMediaPreview.value);
  resetConfirmation();
  saveDraft(false);
};

const loadListingForEdit = () => {
  const listing = store.listings.find(album => album.id === editingListingId.value);
  if (!listing) return false;
  form.title = listing.title;
  form.artist = listing.artist;
  form.catalogNumber = listing.catalogNumber;
  form.price = String(listing.price || '');
  form.location = listing.location || '';
  form.locationScope = normalizeTradeLocationScope(listing.analysisReport?.locationScope);
  form.description = listing.description;
  form.pressing = listing.pressingCondition || '';
  form.analysisConfirmed = 'true';
  const imageSlots = readListingImageSlots(listing);
  coverImage.value = imageSlots.cover;
  recordImage.value = imageSlots.record;
  recordVideo.value = listing.recordVideoDataUrl || '';
  extraImages.value = imageSlots.extras;
  recordRecognition.value = (listing.analysisReport?.recordSurface as LpRecognition | undefined)
    || recognizeLpImage(recordImage.value || recordVideo.value, recordVideo.value && !recordImage.value ? 'video' : 'image');
  const savedAudioSample = listing.audioSamples?.sample || listing.audioSamples?.good || listing.audioSamples?.noisy;
  if (savedAudioSample) {
    audioName.value = savedAudioSample.name;
    audioDataUrl.value = savedAudioSample.dataUrl || '';
    audioRecordedAt.value = savedAudioSample.recordedAt || '';
    audioDurationSeconds.value = Number(savedAudioSample.durationSeconds || savedAudioSample.endSeconds || MIN_AUDIO_RECORDING_SECONDS);
    audioUrl.value = audioDataUrl.value;
  }
  audioAnalysis.value = (listing.analysisReport?.audio as AudioAnalysisResult | undefined) || {
    source: 'librosa',
    analysisAvailable: true,
    audioScore: listing.audioScore,
    audioGrade: listing.audioGrade,
    lpConditionScore: listing.audioScore,
    lpConditionGrade: listing.audioGrade,
    environmentScore: null,
    environmentGrade: null,
    playbackRisk: null,
    clickCount: 0,
    noiseFloorDb: null,
    ambientNoiseFloorDb: null,
    adjustedNoiseFloorDb: null,
    dynamicRangeDb: null,
    analysisConfidence: 70,
    warnings: [],
    summary: '기존 판매글의 음질 정보를 불러왔습니다.',
  };
  return true;
};

const handleAudio = async (file: File, durationSeconds = recordingSeconds.value) => {
  const dataUrl = await readFileAsDataUrl(file);
  audioFile.value = file;
  audioName.value = file.name;
  audioDataUrl.value = dataUrl;
  audioRecordedAt.value = new Date().toISOString();
  audioDurationSeconds.value = Math.max(0, Math.floor(Number(durationSeconds) || 0));
  audioUrl.value = dataUrl;
  audioAnalysis.value = null;
  resetConfirmation();
  saveDraft(false);
};

const clearRecordingTimer = () => {
  if (recordingTimer !== null) {
    window.clearInterval(recordingTimer);
    recordingTimer = null;
  }
};

const advanceRecordingTimer = () => {
  recordingSeconds.value += 1;
  if (recordingSeconds.value >= MAX_AUDIO_RECORDING_SECONDS) stopAudioRecording();
};

const cleanupRecordingStream = () => {
  recordingStream?.getTracks().forEach(track => track.stop());
  recordingStream = null;
};

const audioRecordingMessage = () => '음질 샘플을 녹음 중입니다.';

const audioSampleFilePrefix = () => 'audio-sample';

const mimeTypeForRecording = () => {
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  return '';
};

const startAudioRecording = async () => {
  if (recordingKind.value) return;
  showMicSettingsButton.value = false;
  if (canUseNativeAudioRecorder()) {
    try {
      await startNativeAudioRecording();
      recordingUsesNative = true;
      recordingKind.value = 'sample';
      recordingSeconds.value = 0;
      recordingMessage.value = audioRecordingMessage();
      recordingTimer = window.setInterval(advanceRecordingTimer, 1000);
      return;
    } catch (error) {
      recordingUsesNative = false;
      recordingMessage.value = error instanceof Error ? error.message : '마이크 권한이 필요합니다. 권한을 허용한 뒤 다시 시도해 주세요.';
      showMicSettingsButton.value = true;
      return;
    }
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    recordingMessage.value = '이 기기에서는 실시간 녹음을 사용할 수 없습니다.';
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } as MediaTrackConstraints });
    recordingStream = stream;
    recordingChunks = [];
    const mimeType = mimeTypeForRecording();
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recordingKind.value = 'sample';
    recordingSeconds.value = 0;
    recordingMessage.value = audioRecordingMessage();
    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) recordingChunks.push(event.data);
    };
    mediaRecorder.onstop = () => {
      const durationSeconds = recordingSeconds.value;
      const blobType = mediaRecorder?.mimeType || 'audio/webm';
      const blob = new Blob(recordingChunks, { type: blobType });
      const extension = blobType.includes('mp4') ? 'm4a' : 'webm';
      const file = new File([blob], `${audioSampleFilePrefix()}-${Date.now()}.${extension}`, { type: blobType });
      void handleAudio(file, durationSeconds);
      recordingKind.value = null;
      recordingChunks = [];
      clearRecordingTimer();
      cleanupRecordingStream();
      mediaRecorder = null;
      recordingMessage.value = durationSeconds >= MAX_AUDIO_RECORDING_SECONDS ? '최대 30분 녹음이 저장되었습니다.' : '녹음이 저장되었습니다.';
    };
    mediaRecorder.start();
    recordingTimer = window.setInterval(advanceRecordingTimer, 1000);
  } catch {
    recordingKind.value = null;
    clearRecordingTimer();
    cleanupRecordingStream();
    mediaRecorder = null;
    recordingMessage.value = '마이크 권한이 필요합니다. 권한을 허용한 뒤 다시 시도해 주세요.';
    showMicSettingsButton.value = true;
  }
};

const openMicrophoneSettings = async () => {
  try {
    await openAppPermissionSettings();
  } catch (error) {
    recordingMessage.value = error instanceof Error ? error.message : 'Android 앱 설정을 열 수 없습니다.';
  }
};

const stopAudioRecording = () => {
  clearRecordingTimer();
  if (recordingUsesNative) {
    const durationSeconds = recordingSeconds.value;
    void stopNativeAudioRecording()
      .then(result => {
        if (!recordingKind.value) return;
        const file = dataUrlToFile(result.dataUrl, `${audioSampleFilePrefix()}-${Date.now()}.${result.extension || 'm4a'}`);
        void handleAudio(file, durationSeconds);
        recordingMessage.value = durationSeconds >= MAX_AUDIO_RECORDING_SECONDS ? '최대 30분 녹음이 저장되었습니다.' : '녹음이 저장되었습니다.';
      })
      .catch(error => {
        recordingMessage.value = error instanceof Error ? error.message : '녹음을 저장하지 못했습니다.';
        showMicSettingsButton.value = true;
      })
      .finally(() => {
        recordingKind.value = null;
        recordingUsesNative = false;
        clearRecordingTimer();
      });
    return;
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
};

const clearAudio = () => {
  audioFile.value = null;
  audioName.value = '';
  audioDataUrl.value = '';
  audioRecordedAt.value = '';
  audioDurationSeconds.value = 0;
  audioUrl.value = '';
  audioAnalysis.value = null;
  resetConfirmation();
  saveDraft(false);
};

const runAudioAnalysis = async () => {
  audioAnalyzing.value = true;
  recordingMessage.value = '음질을 확인하는 중입니다.';
  try {
    audioAnalysis.value = await analyzeAudioSamples({ sample: audioFile.value || undefined });
    const analyzedDuration = audioAnalysis.value.audioSample?.durationSeconds;
    if (typeof analyzedDuration === 'number') audioDurationSeconds.value = Math.max(0, Math.floor(analyzedDuration));
    recordingMessage.value = audioAnalysis.value.source === 'browser'
      ? '음질 확인이 끝났습니다.'
      : audioAnalysis.value.analysisAvailable === false || audioAnalysis.value.source === 'fallback' || audioAnalysis.value.source === 'mock'
        ? '음질 분석이 불가능해 점수와 등급을 표시하지 않습니다. 다시 녹음해 주세요.'
        : '음질 확인이 끝났습니다.';
    fillDescription();
    saveDraft(false);
  } catch (error) {
    recordingMessage.value = error instanceof Error ? error.message : '음질 확인에 실패했습니다. 다시 시도해 주세요.';
  } finally {
    audioAnalyzing.value = false;
  }
};

const selectCatalogCandidate = (candidateId: string) => {
  selectedCandidateId.value = candidateId;
};

const searchCatalog = async () => {
  const catalog = form.catalogNumber.trim();
  const title = form.title.trim();
  const artist = form.artist.trim();
  if ((catalog.length < 3 && title.length < 2 && artist.length < 2) || isCatalogSearching.value) return;
  const requestId = ++catalogLookupRequest;
  isCatalogSearching.value = true;
  catalogLookupMessage.value = 'Discogs에서 후보를 찾는 중입니다.';
  catalogApiStatus.value = '';
  try {
    const result = await fetchDiscogsCandidates(catalog, title, artist);
    if (requestId !== catalogLookupRequest) return;
    catalogCandidates.value = result.candidates;
    candidateSource.value = result.source;
    const lookupError = 'error' in result && result.error ? result.error : '';
    catalogApiStatus.value = `요청: ${result.apiBaseUrl} / ${result.source} / 후보 ${result.candidates.length}개${lookupError ? ` / ${lookupError}` : ''}`;
    if (result.candidates.length) {
      selectedCandidateId.value = result.candidates[0].id;
      catalogLookupMessage.value = `${result.candidates.length}개 후보를 찾았습니다. 맞는 후보를 선택해 주세요.`;
    } else {
      selectedCandidateId.value = '';
      catalogLookupMessage.value = '일치하는 후보가 없습니다. 앨범명과 아티스트를 직접 입력해 주세요.';
    }
  } finally {
    if (requestId === catalogLookupRequest) isCatalogSearching.value = false;
  }
};

const applyCatalogCandidate = () => {
  if (!selectedCandidate.value) return;
  form.title = selectedCandidate.value.title;
  form.artist = selectedCandidate.value.artist;
  form.catalogNumber = selectedCandidate.value.catalogNumber;
  const pressing = createPressingInfo(selectedCandidate.value);
  form.pressing = pressing.pressing;
  catalogLookupMessage.value = `${selectedCandidate.value.title} 정보를 적용했습니다.`;
  resetConfirmation();
};

watch(() => form.catalogNumber, () => {
  catalogLookupMessage.value = '';
  catalogApiStatus.value = '';
  catalogCandidates.value = [];
  selectedCandidateId.value = '';
});

const lonLatToTile = (lat: number, lng: number, zoom: number) => {
  const scale = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * scale);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * scale);
  return { x, y };
};

const latLngToWorldPixel = (lat: number, lng: number, zoom: number) => {
  const scale = 256 * 2 ** zoom;
  const sinLat = Math.sin(lat * Math.PI / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
};

const worldPixelToLatLng = (x: number, y: number, zoom: number) => {
  const scale = 256 * 2 ** zoom;
  const lng = x / scale * 360 - 180;
  const n = Math.PI - 2 * Math.PI * y / scale;
  const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
};

const clampMapZoom = (zoom: number) => Math.max(12, Math.min(18, zoom));

const getPointerDistance = () => {
  const points = Array.from(fallbackPointers.values());
  if (points.length < 2) return 0;
  const [first, second] = points;
  return Math.hypot(second.x - first.x, second.y - first.y);
};

const clampLatLng = (lat: number, lng: number) => ({
  lat: Math.max(-85, Math.min(85, lat)),
  lng: ((lng + 540) % 360) - 180,
});

const parsePickedLocation = (value: string): KakaoMapPoint | null => {
  const match = value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    title: '선택한 거래 위치',
    addressName: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
  };
};

const escapeMapText = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const renderFallbackMap = (point: KakaoMapPoint) => {
  locationMapFallbackHtml.value = renderStaticMapHtml(point, {
    zoom: locationMapZoom.value,
    tileRadius: 2,
    markerSize: 24,
    showInfo: false,
    touchAction: 'none',
  });
};

const getCurrentPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error('이 기기에서 현재 위치를 사용할 수 없습니다.'));
    return;
  }
  navigator.geolocation.getCurrentPosition(resolve, reject, {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 30000,
  });
});

const pointFromCoordinates = async (lat: number, lng: number, fallbackTitle: string): Promise<KakaoMapPoint> => {
  const reversed = await reverseLocationPointByRest(lat, lng).catch(() => null);
  return reversed || {
    lat,
    lng,
    title: fallbackTitle,
    addressName: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
  };
};

const pointFromCurrentPosition = async (lat: number, lng: number): Promise<KakaoMapPoint> => pointFromCoordinates(lat, lng, '현재 위치');

const applyLocationPoint = async (point: KakaoMapPoint, message: string) => {
  locationMapRequest += 1;
  locationMarker?.setMap(null);
  locationMapPoint.value = point;
  locationMapZoom.value = 16;
  renderFallbackMap(point);
  form.location = point.addressName || `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
  applyPickedLocationToDescription(point);
  locationMapMessage.value = message;
  await saveDraft(false);
};

const setKakaoLocationMarker = (kakao: KakaoMapsRuntime, point: KakaoMapPoint, recenter = true) => {
  if (!locationMap) return;
  const position = new kakao.maps.LatLng(point.lat, point.lng);
  if (recenter) {
    locationMap.setCenter(position);
    locationMap.relayout();
  }
  if (locationMarker) {
    locationMarker.setPosition(position);
  } else {
    locationMarker = new kakao.maps.Marker({ position, map: locationMap });
  }
};

const pickKakaoMapPoint = async (kakao: KakaoMapsRuntime, lat: number, lng: number) => {
  const point = await pointFromCoordinates(lat, lng, '선택한 거래 위치');
  locationMapPoint.value = point;
  setKakaoLocationMarker(kakao, point, false);
  form.location = point.addressName || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  applyPickedLocationToDescription(point);
  locationMapMessage.value = '선택한 핀 위치가 거래 주소로 입력되었습니다.';
  await saveDraft(false);
};

const bindKakaoLocationPicker = (kakao: KakaoMapsRuntime) => {
  if (!locationMap || locationMapClickBound) return;
  kakao.maps.event.addListener(locationMap, 'click', event => {
    void pickKakaoMapPoint(kakao, event.latLng.getLat(), event.latLng.getLng());
  });
  locationMapClickBound = true;
};

const useCurrentLocation = async () => {
  if (isLocatingCurrentPosition.value) return;
  isLocatingCurrentPosition.value = true;
  locationMapMessage.value = '현재 위치를 확인하는 중입니다.';
  try {
    const position = await getCurrentPosition();
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const point = await pointFromCurrentPosition(lat, lng);
    await applyLocationPoint(point, '현재 위치가 거래 주소로 입력되었습니다.');
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? Number((error as GeolocationPositionError).code) : 0;
    locationMapMessage.value = code === 1
      ? '위치 권한이 거부되었습니다. 앱 설정에서 위치 권한을 허용해 주세요.'
      : error instanceof Error
        ? error.message
        : '현재 위치를 가져오지 못했습니다.';
  } finally {
    isLocatingCurrentPosition.value = false;
  }
};

const updateFallbackMapCenter = (lat: number, lng: number) => {
  const next = clampLatLng(lat, lng);
  const point = {
    lat: next.lat,
    lng: next.lng,
    title: '선택한 거래 위치',
    addressName: `${next.lat.toFixed(6)}, ${next.lng.toFixed(6)}`,
  };
  locationMapPoint.value = point;
  renderFallbackMap(point);
  locationMapMessage.value = '지도를 움직인 뒤 이 위치 선택을 누르세요.';
};

const startFallbackMapDrag = (event: PointerEvent) => {
  if (!locationMapFallbackHtml.value || !locationMapPoint.value) return;
  const target = event.currentTarget as HTMLElement;
  target.setPointerCapture?.(event.pointerId);
  fallbackPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (fallbackPointers.size >= 2) {
    const distance = getPointerDistance();
    fallbackDrag = null;
    fallbackPinch = {
      startDistance: distance,
      startZoom: locationMapZoom.value,
      lastZoom: locationMapZoom.value,
    };
    return;
  }
  fallbackDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startLat: locationMapPoint.value.lat,
    startLng: locationMapPoint.value.lng,
    moved: false,
  };
};

const moveFallbackMapDrag = (event: PointerEvent) => {
  if (fallbackPointers.has(event.pointerId)) {
    fallbackPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }
  if (fallbackPinch && fallbackPointers.size >= 2 && locationMapPoint.value) {
    const distance = getPointerDistance();
    if (fallbackPinch.startDistance > 0 && distance > 0) {
      const zoomDelta = Math.log2(distance / fallbackPinch.startDistance) * 2;
      const nextZoom = clampMapZoom(Math.round(fallbackPinch.startZoom + zoomDelta));
      if (nextZoom !== fallbackPinch.lastZoom) {
        locationMapZoom.value = nextZoom;
        fallbackPinch.lastZoom = nextZoom;
        renderFallbackMap(locationMapPoint.value);
        locationMapMessage.value = `확대 ${locationMapZoom.value}단계 · 지도를 움직인 뒤 이 위치 선택을 누르세요.`;
      }
    }
    return;
  }
  if (!fallbackDrag || fallbackDrag.pointerId !== event.pointerId) return;
  const dx = event.clientX - fallbackDrag.startX;
  const dy = event.clientY - fallbackDrag.startY;
  if (Math.abs(dx) + Math.abs(dy) < 2) return;
  fallbackDrag.moved = true;
  const zoom = locationMapZoom.value;
  const startPixel = latLngToWorldPixel(fallbackDrag.startLat, fallbackDrag.startLng, zoom);
  const next = worldPixelToLatLng(startPixel.x - dx, startPixel.y - dy, zoom);
  updateFallbackMapCenter(next.lat, next.lng);
};

const endFallbackMapDrag = (event: PointerEvent) => {
  const target = event.currentTarget as HTMLElement;
  target.releasePointerCapture?.(event.pointerId);
  fallbackPointers.delete(event.pointerId);
  if (fallbackPointers.size < 2) fallbackPinch = null;
  if (fallbackDrag?.pointerId === event.pointerId) fallbackDrag = null;
};

const pickedLocationDescriptionLine = (point: KakaoMapPoint) => {
  const coords = `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
  const place = point.addressName && point.addressName !== coords ? point.addressName : point.title || coords;
  return `거래 주소: ${place}`;
};

const applyPickedLocationToDescription = (point: KakaoMapPoint) => {
  const nextLine = pickedLocationDescriptionLine(point);
  const lines = form.description.split('\n');
  const index = lines.findIndex(line => line.trim().startsWith('거래 위치:') || line.trim().startsWith('거래 주소:'));
  if (index >= 0) {
    lines[index] = nextLine;
    form.description = lines.join('\n').trim();
    return;
  }
  form.description = [form.description.trim(), nextLine].filter(Boolean).join('\n');
};

const chooseMapLocation = async () => {
  const point = locationMapPoint.value;
  if (!point) return;
  const coords = `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
  const reversed = point.addressName && point.addressName !== coords
    ? point
    : await reverseLocationPointByRest(point.lat, point.lng).catch(() => null);
  const selectedPoint = reversed || point;
  form.location = selectedPoint.addressName && selectedPoint.addressName !== coords
    ? selectedPoint.addressName
    : selectedPoint.title || coords;
  applyPickedLocationToDescription(selectedPoint);
  locationMapMessage.value = '선택한 핀 위치가 거래 장소로 저장되었습니다.';
  await saveDraft(false);
};

const zoomFallbackMap = (delta: number) => {
  const point = locationMapPoint.value;
  if (!point) return;
  locationMapZoom.value = clampMapZoom(locationMapZoom.value + delta);
  renderFallbackMap(point);
  locationMapMessage.value = `확대 ${locationMapZoom.value}단계 · 지도를 움직인 뒤 이 위치 선택을 누르세요.`;
};

const renderLocationMap = async () => {
  await nextTick();
  const container = locationMapContainer.value;
  const query = form.location.trim();
  const requestId = ++locationMapRequest;

  if (!container) return;
  if (!query) {
    locationMarker?.setMap(null);
    locationMapPoint.value = null;
    locationMapFallbackHtml.value = '';
    locationMapMessage.value = '거래 장소를 입력하면 지도가 표시됩니다.';
    return;
  }

  const pickedPoint = parsePickedLocation(query);
  const fallbackPointPromise = pickedPoint
    ? Promise.resolve(pickedPoint)
    : findLocationPointByRest(query).catch(() => null);
  let kakaoMapRendered = false;

  if (pickedPoint) {
    locationMarker?.setMap(null);
    locationMapPoint.value = pickedPoint;
    renderFallbackMap(pickedPoint);
    locationMapMessage.value = '기본 지도 표시 중 · 카카오 지도에 연결하고 있습니다.';
  } else {
    void fallbackPointPromise.then(point => {
      if (requestId !== locationMapRequest || kakaoMapRendered || !point || !locationMapContainer.value) return;
      locationMarker?.setMap(null);
      locationMapPoint.value = point;
      renderFallbackMap(point);
      locationMapMessage.value = `${point.title} 표시 중 · 카카오 지도에 연결하고 있습니다.`;
    });
  }

  if (!getKakaoMapJavaScriptKey()) {
    const fallbackPoint = await fallbackPointPromise;
    if (requestId !== locationMapRequest) return;
    if (fallbackPoint) {
      locationMarker?.setMap(null);
      locationMapPoint.value = fallbackPoint;
      renderFallbackMap(fallbackPoint);
      locationMapMessage.value = '지도를 움직인 뒤 이 위치 선택을 누르세요.';
      return;
    }
    locationMapMessage.value = `"${query}" 위치를 찾지 못했습니다. 주소를 더 구체적으로 입력해 주세요.`;
    return;
  }

  if (!locationMapFallbackHtml.value) {
    locationMapMessage.value = '카카오 지도를 불러오는 중입니다.';
  }
  try {
    const kakao = await loadKakaoMaps();
    const point = pickedPoint || await findKakaoMapPoint(query, kakao);
    if (requestId !== locationMapRequest) return;

    if (!point) {
      locationMarker?.setMap(null);
      locationMapPoint.value = null;
      locationMapMessage.value = `"${query}" 위치를 찾지 못했습니다.`;
      return;
    }

    const center = new kakao.maps.LatLng(point.lat, point.lng);
    if (!locationMap) {
      locationMap = new kakao.maps.Map(container, { center, level: 3 });
    } else {
      locationMap.setCenter(center);
      locationMap.relayout();
    }
    bindKakaoLocationPicker(kakao);

    locationMapPoint.value = point;
    kakaoMapRendered = true;
    locationMapFallbackHtml.value = '';
    setKakaoLocationMarker(kakao, point, false);
    locationMapMessage.value = `${point.title} 표시 중 · 지도에서 원하는 위치를 누르세요.`;
    window.setTimeout(() => locationMap?.relayout(), 0);
  } catch (error) {
    if (requestId !== locationMapRequest) return;
    const point = await fallbackPointPromise;
    if (requestId !== locationMapRequest) return;
    if (point) {
      locationMarker?.setMap(null);
      locationMapPoint.value = point;
      renderFallbackMap(point);
      locationMapMessage.value = `${point.title} 지도 표시 중`;
      return;
    }
    locationMapPoint.value = null;
    locationMapFallbackHtml.value = '';
    locationMapMessage.value = error instanceof Error ? error.message : '카카오맵을 표시하지 못했습니다.';
  }
};

const scheduleLocationMap = () => {
  if (locationMapTimer) window.clearTimeout(locationMapTimer);
  locationMapTimer = window.setTimeout(() => {
    void renderLocationMap();
  }, 450);
};

watch(() => form.location, () => {
  scheduleLocationMap();
});

const currentImages = () => [coverImage.value, recordImage.value, ...extraImages.value].filter(Boolean);

const currentDraft = () => ({
  images: currentImages(),
  extraImages: [...extraImages.value],
  coverImageDataUrl: coverImage.value,
  recordImageDataUrl: recordImage.value,
  recordVideoDataUrl: recordVideo.value,
  audioFileName: audioName.value,
  audioDataUrl: audioDataUrl.value,
  audioRecordedAt: audioRecordedAt.value,
  audioDurationSeconds: audioDurationSeconds.value,
  audioAnalysis: audioAnalysis.value,
  recordRecognition: recordRecognition.value,
  audioRecommendations: {
    summary: audioRecordingGuide.value,
    recordSeconds: MIN_AUDIO_RECORDING_SECONDS,
  },
  formData: { ...form },
});

const applyDraftPayload = (nextDraft: Record<string, unknown> | null | undefined) => {
  const nextForm = nextDraft?.formData && typeof nextDraft.formData === 'object'
    ? nextDraft.formData as Record<string, unknown>
    : {};
  const imageSlots = readListingImageSlots(nextDraft);

  Object.assign(form, {
    title: String(nextForm.title || ''),
    artist: String(nextForm.artist || ''),
    catalogNumber: String(nextForm.catalogNumber || ''),
    price: String(nextForm.price || ''),
    location: String(nextForm.location || ''),
    locationScope: normalizeTradeLocationScope(nextForm.locationScope),
    description: String(nextForm.description || ''),
    pressing: String(nextForm.pressing || ''),
    analysisConfirmed: String(nextForm.analysisConfirmed || ''),
  });
  coverImage.value = imageSlots.cover;
  recordImage.value = imageSlots.record;
  extraImages.value = imageSlots.extras;
  recordVideo.value = String(nextDraft?.recordVideoDataUrl || '');
  audioName.value = String(nextDraft?.audioFileName || nextDraft?.goodAudioFileName || nextDraft?.noisyAudioFileName || '');
  audioDataUrl.value = String(nextDraft?.audioDataUrl || nextDraft?.goodAudioDataUrl || nextDraft?.noisyAudioDataUrl || '');
  audioRecordedAt.value = String(nextDraft?.audioRecordedAt || nextDraft?.goodAudioRecordedAt || nextDraft?.noisyAudioRecordedAt || '');
  audioDurationSeconds.value = Number(nextDraft?.audioDurationSeconds || nextDraft?.goodSampleEnd || nextDraft?.noisySampleEnd || MIN_AUDIO_RECORDING_SECONDS);
  audioUrl.value = audioDataUrl.value;
  audioFile.value = audioDataUrl.value ? audioFileFromDataUrl(audioDataUrl.value, audioName.value || 'audio-sample.webm') : null;
  audioAnalysis.value = (nextDraft?.audioAnalysis as AudioAnalysisResult | null) || null;
  recordRecognition.value = (nextDraft?.recordRecognition as LpRecognition | undefined)
    || recognizeLpImage(recordImage.value || recordVideo.value, recordVideo.value && !recordImage.value ? 'video' : 'image');
  priceMessage.value = '';
  catalogCandidates.value = [];
  selectedCandidateId.value = '';
  candidateSource.value = '';
  catalogLookupMessage.value = '';
  catalogApiStatus.value = '';
  currentSellStep.value = 'media';
  void renderLocationMap();
};

const openSurfaceCamera = (mode: 'image' | 'video', target: CaptureTarget = 'record') => {
  setPendingSellDraft({ ...currentDraft(), editingListingId: editingListingId.value });
  router.push({ path: '/sell/camera', query: { mode, target, returnTo: route.path } });
};

const saveDraft = async (showAlert = true) => {
  if (draftSaving.value) return;
  draftSaving.value = true;
  try {
    const result = await store.saveDraftToServer(currentDraft());
    draftEntries.value = store.readDrafts();
    draftSavedToDb.value = result.ok;
    if (showAlert) {
      draftMessage.value = result.message;
      setTimeout(() => { draftMessage.value = ''; }, 2400);
    }
  } catch (error) {
    draftSavedToDb.value = false;
    draftMessage.value = error instanceof Error ? error.message : '임시 저장에 실패했습니다.';
    if (showAlert) setTimeout(() => { draftMessage.value = ''; }, 2400);
  } finally {
    draftSaving.value = false;
  }
};

watch(form, () => {
  if (isEditing.value) return;
  if (draftAutoSaveTimer) window.clearTimeout(draftAutoSaveTimer);
  draftAutoSaveTimer = window.setTimeout(() => {
    void saveDraft(false);
  }, 1000);
}, { deep: true });

const loadDraftEntry = (entry: ListingDraftEntry) => {
  store.activateDraft(entry);
  applyDraftPayload(entry.draft);
};

const loadDraftFromMenu = (entry: ListingDraftEntry) => {
  loadDraftEntry(entry);
  showDraftMenu.value = false;
};

const removeDraftEntry = async (draftId: string) => {
  const result = await store.deleteDraft(draftId);
  draftEntries.value = store.readDrafts();
  draftSavedToDb.value = result.persisted;
  draftMessage.value = result.message;
  setTimeout(() => { draftMessage.value = ''; }, 2200);
};

const formatDraftUpdated = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '저장 시간 확인 불가';
  return date.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const recommendPrice = async () => {
  priceMessage.value = 'Discogs 거래 기록과 상품 품질 점수를 확인하는 중입니다.';
  try {
    const result = await fetchPriceRecommendation({
      catalogNumber: form.catalogNumber.trim(),
      title: form.title.trim(),
      artist: form.artist.trim(),
      releaseId: selectedCandidate.value?.releaseId,
      surfaceScore: usableSurfaceScore.value,
      audioScore: usableAudioScore.value,
    });
    form.price = String(result.recommended_price);
    const range = result.price_range ? `추천 범위 ${result.price_range.min.toLocaleString()}~${result.price_range.max.toLocaleString()}원. ` : '';
    const discogs = result.discogs?.suggestedPrice || result.discogs?.marketplaceLow
      ? `Discogs 기준 ${result.discogs.suggestedPrice ? `판매 이력 ${result.discogs.suggestedPrice.toLocaleString()}원` : '판매 이력 확인 불가'}${result.discogs.marketplaceLow ? `, 현재 최저 ${result.discogs.marketplaceLow.toLocaleString()}원` : ''}. `
      : '';
    const confidence = result.confidence ? `신뢰도 ${result.confidence}점. ` : '';
    priceMessage.value = `${result.recommended_price.toLocaleString()}원 추천. ${range}${discogs}${confidence}${result.reason}`;
  } catch {
    const catalog = form.catalogNumber.toLowerCase().trim();
    const title = form.title.toLowerCase().trim();
    const matched = store.listings.find(album => album.id !== editingListingId.value && ((catalog && album.catalogNumber.toLowerCase() === catalog) || (title && album.title.toLowerCase().includes(title))));
    const baseAlbums = store.listings.filter(album => album.id !== editingListingId.value && album.price > 0);
    const averagePrice = baseAlbums.length ? baseAlbums.reduce((sum, album) => sum + album.price, 0) / baseAlbums.length : 100000;
    const quality = usableAudioScore.value ? Math.max(0.7, Math.min(1.08, usableAudioScore.value / 82)) : 1;
    const price = Math.round((matched ? ((matched.priceRange.min + matched.priceRange.max) / 2) : averagePrice) * quality / 1000) * 1000;
    form.price = String(price);
    priceMessage.value = `Discogs 가격 추천 연결 실패로 앱 내 시세와 품질 점수 기준 ${price.toLocaleString()}원을 임시 추천합니다.`;
  }
};

const fillDescription = () => {
  const title = form.title.trim() || '제목 미입력';
  const artist = form.artist.trim() || '아티스트 미입력';
  const catalogNumber = form.catalogNumber.trim() || '-';
  const audioResult = isAudioAnalysisUnavailable.value
    ? '분석 불가'
    : `${audioGradeText.value}${audioScoreText.value !== '-' ? `, ${audioScoreText.value}` : ''}`;
  const scratchResult = recordMediaPreview.value
    ? `${recordScratchGradeText.value}, ${recordSurfaceScoreText.value}`
    : '분석 전';
  const mapPoint = locationMapPoint.value;
  const mapAddress = mapPoint
    ? pickedLocationDescriptionLine(mapPoint).replace(/^거래 주소:\s*/, '')
    : form.location.trim() || '미지정';
  const parts = [
    `${title} - ${artist}`,
    `카탈로그 번호: ${catalogNumber}`,
    `등급: 음질 ${audioResult}, 스크래치 ${scratchResult}`,
    `거래 주소: ${mapAddress}`,
  ];
  form.description = parts.join('\n');
};

const normalizeSegment = (start: number, end: number, fallbackEnd: number) => {
  const safeStart = Math.max(0, Number.isFinite(start) ? start : 0);
  const safeEnd = Math.max(safeStart + 1, Number.isFinite(end) ? end : fallbackEnd);
  return { startSeconds: safeStart, endSeconds: safeEnd, durationSeconds: safeEnd - safeStart };
};

const audioSamplePayload = () => {
  const sampleDuration = Math.max(1, Math.floor(Number(audioDurationSeconds.value) || MIN_AUDIO_RECORDING_SECONDS));
  const sampleSegment = normalizeSegment(0, sampleDuration, MIN_AUDIO_RECORDING_SECONDS);
  return {
    ...(audioName.value ? { sample: { name: audioName.value, dataUrl: audioDataUrl.value, recordedAt: audioRecordedAt.value || new Date().toISOString(), ...sampleSegment } } : {}),
  };
};

const cancelPublishMessage = (reason: string) => `게시가 취소되었습니다. ${reason}`;

const publishListingAction = async () => {
  if (!valid.value || publishSaving.value) return;
  publishSaving.value = true;
  try {
    if (!form.description.trim()) fillDescription();
    saveDraft(false);
    const health = await store.checkServerHealth();
    if (!health.ok) {
      alert(cancelPublishMessage(health.message || '서버 연결을 확인한 뒤 다시 시도해 주세요.'));
      return;
    }
    const [persistedCoverImage, persistedRecordImage, ...persistedExtraImages] = await Promise.all([
      persistListingImage(coverImage.value, 'listing-cover.jpg'),
      persistListingImage(recordImage.value, 'listing-record-surface.jpg'),
      ...extraImages.value.map((image, index) => persistListingImage(image, `listing-extra-${index + 1}.jpg`)),
    ]);
    const persistedImages = [persistedCoverImage, persistedRecordImage, ...persistedExtraImages].filter(Boolean);
    const payload = {
      title: form.title.trim(),
      artist: form.artist.trim(),
      catalog_number: form.catalogNumber.trim(),
      discogs_release_id: selectedCandidate.value?.releaseId,
      discogs_cover_image_url: selectedCandidate.value?.coverImageUrl,
      release_label: selectedCandidate.value?.label,
      release_country: selectedCandidate.value?.country,
      pressing_condition: form.pressing.trim(),
      year: selectedCandidate.value?.year,
      price: Number(form.price),
      description: form.description.trim(),
      tags: [],
      location: form.location.trim(),
      images: persistedImages,
      cover_image_data_url: persistedCoverImage,
      record_image_data_url: persistedRecordImage,
      record_video_data_url: recordVideo.value,
      audio_grade: usableAudioGrade.value,
      audio_score: usableAudioScore.value,
      audio_samples: audioSamplePayload(),
      is_rare: false,
      is_first_press: false,
      analysis_report: {
        pressing: form.pressing,
        coverImageDataUrl: persistedCoverImage,
        recordImageDataUrl: persistedRecordImage,
        recordVideoDataUrl: recordVideo.value,
        recordSurface: recordRecognition.value,
        audio: audioAnalysis.value,
        audioRecommendations: {
          summary: audioRecordingGuide.value,
          recordSeconds: MIN_AUDIO_RECORDING_SECONDS,
        },
        audioSamples: audioSamplePayload(),
        locationScope: form.locationScope,
      },
    };
    const result = isEditing.value
      ? await store.updateListing(editingListingId.value, payload)
      : await store.publishListing(payload);
    if (!result.ok) {
      alert(result.message.startsWith('게시가 취소되었습니다.') ? result.message : cancelPublishMessage(result.message));
      return;
    }
    if (!isEditing.value && result.listing?.id && sourceCollectionId.value) {
      store.markCollectionConverted(sourceCollectionId.value, result.listing.id);
    }
    if (!isEditing.value) store.clearDraft();
    if (result.listing?.id) {
      router.push(`/app/album/${result.listing.id}?mine=true`);
    } else {
      router.push('/app/profile');
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : '판매글 게시 중 오류가 발생했습니다.';
    alert(reason.startsWith('게시가 취소되었습니다.') ? reason : cancelPublishMessage(reason));
  } finally {
    publishSaving.value = false;
  }
};

onMounted(async () => {
  void renderLocationMap();
  if (isEditing.value && !restoredPendingSellDraft) {
    const loaded = loadListingForEdit();
    if (!loaded) {
      await store.loadListingsFromServer();
      if (!loadListingForEdit()) {
        alert('수정할 판매글을 찾을 수 없습니다.');
        router.push('/app/profile');
        return;
      }
    }
  }
  let appliedScannedMedia = false;
  const scannedCoverImage = await takePendingCapture('image', 'cover');
  if (scannedCoverImage) {
    coverImage.value = scannedCoverImage;
    appliedScannedMedia = true;
  }
  const scannedRecordImage = await takePendingCapture('image', 'record');
  if (scannedRecordImage) {
    recordImage.value = scannedRecordImage;
    recordRecognition.value = await analyzeLpMedia(scannedRecordImage, 'image');
    resetConfirmation();
    appliedScannedMedia = true;
  }
  const scannedRecordVideo = await takePendingCapture('video', 'record');
  if (scannedRecordVideo) {
    recordVideo.value = scannedRecordVideo;
    recordRecognition.value = await analyzeLpMedia(scannedRecordVideo, 'video');
    resetConfirmation();
    appliedScannedMedia = true;
  }
  if (appliedScannedMedia) await saveDraft(false);
  if (audioDataUrl.value && !audioFile.value) {
    audioFile.value = audioFileFromDataUrl(audioDataUrl.value, audioName.value || 'audio-sample.webm');
  }
  const draftsResult = await store.loadDraftsFromServer();
  draftEntries.value = draftsResult.drafts;
  if (!isEditing.value && !appliedScannedMedia && !restoredPendingSellDraft && !draft && !draftEntries.value.length) {
    const result = await store.loadDraftFromServer();
    if (result.persisted && result.draft) {
      draftEntries.value = store.readDrafts();
      draftSavedToDb.value = true;
      draftMessage.value = '저장된 판매글 초안을 불러왔습니다.';
      setTimeout(() => { draftMessage.value = ''; }, 2200);
    }
  }
});

onBeforeUnmount(() => {
  if (draftAutoSaveTimer) window.clearTimeout(draftAutoSaveTimer);
  if (locationMapTimer) window.clearTimeout(locationMapTimer);
  locationMarker?.setMap(null);
  if (recordingUsesNative) void stopNativeAudioRecording().catch(() => undefined);
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  clearRecordingTimer();
  cleanupRecordingStream();
});

const ScratchInspectionPreview = defineComponent({
  props: {
    mediaUrl: { type: String, required: true },
    mediaType: { type: String as PropType<'image' | 'video'>, required: true },
    regions: { type: Array as PropType<ScratchRegion[]>, default: () => [] },
  },
  setup(props) {
    const strokeForSeverity = (severity?: ScratchRegion['severity']) => {
      if (severity === 'high') return '#ef4444';
      if (severity === 'medium') return '#f97316';
      return '#eab308';
    };
    const lineNodes = () => props.regions.flatMap((region, index) => {
      const color = strokeForSeverity(region.severity);
      const keyBase = `${region.x1}-${region.y1}-${region.x2}-${region.y2}-${index}`;
      return [
        h('line', {
          key: `${keyBase}-halo`,
          x1: region.x1,
          y1: region.y1,
          x2: region.x2,
          y2: region.y2,
          stroke: 'rgba(255,255,255,0.72)',
          'stroke-width': 10,
          'stroke-linecap': 'round',
          'vector-effect': 'non-scaling-stroke',
        }),
        h('line', {
          key: `${keyBase}-line`,
          x1: region.x1,
          y1: region.y1,
          x2: region.x2,
          y2: region.y2,
          stroke: color,
          'stroke-width': 4,
          'stroke-linecap': 'round',
          'vector-effect': 'non-scaling-stroke',
        }),
      ];
    });

    return () => h('div', { class: 'rounded-lg border bg-gray-950 p-2 text-white' }, [
      h('div', { class: 'mb-2 flex items-center justify-between gap-2 text-xs' }, [
        h('span', { class: 'font-medium' }, '스크래치 표시'),
        props.mediaType === 'video'
          ? h('span', { class: 'rounded bg-white/10 px-2 py-1 text-[11px] text-white/75' }, '대표 프레임 기준')
          : null,
      ]),
      h('div', { class: 'relative aspect-square overflow-hidden rounded bg-black' }, [
        props.mediaType === 'video'
          ? h('video', { src: props.mediaUrl, controls: true, class: 'h-full w-full object-contain' })
          : h('img', { src: props.mediaUrl, alt: '스크래치 표시 표면 이미지', class: 'h-full w-full object-contain' }),
        h('svg', {
          class: 'pointer-events-none absolute inset-0 h-full w-full',
          viewBox: '0 0 1 1',
          preserveAspectRatio: 'none',
          'aria-hidden': 'true',
        }, lineNodes()),
      ]),
      h('div', { class: 'mt-2 flex flex-wrap gap-2 text-[11px] text-white/80' }, [
        h('span', { class: 'inline-flex items-center gap-1' }, [
          h('span', { class: 'h-2 w-4 rounded-full bg-red-500' }),
          '강함',
        ]),
        h('span', { class: 'inline-flex items-center gap-1' }, [
          h('span', { class: 'h-2 w-4 rounded-full bg-orange-500' }),
          '중간',
        ]),
        h('span', { class: 'inline-flex items-center gap-1' }, [
          h('span', { class: 'h-2 w-4 rounded-full bg-yellow-500' }),
          '약함',
        ]),
      ]),
    ]);
  },
});

const PhotoSlot = defineComponent({
  props: { title: { type: String, required: true }, help: { type: String, required: true }, image: { type: String, default: '' } },
  emits: ['picked', 'clear', 'open-camera'],
  setup(props, { emit }) {
    const onChange = (event: Event) => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      if (file) emit('picked', file);
      input.value = '';
    };
    const isCameraOnlySlot = () => isSurfaceSlot() || props.title.includes('대표');
    const emptyContent = () => [
      h(isCameraOnlySlot() ? Camera : Upload, { size: 24, class: 'mb-2 text-gray-400' }),
      h('span', { class: 'text-sm text-gray-700 text-center' }, props.title),
      h('span', { class: 'text-xs text-gray-500 mt-1 text-center' }, props.help),
    ];
    const isSurfaceSlot = () => props.title.includes('표면');
    return () => h('div', { class: 'relative h-24 rounded-lg border-2 border-dashed overflow-hidden bg-gray-50 sm:h-32' }, [
      props.image
        ? h('img', { src: props.image, alt: props.title, class: 'w-full h-full object-cover' })
        : isCameraOnlySlot()
          ? h('button', { type: 'button', class: 'w-full h-full flex flex-col items-center justify-center cursor-pointer', onClick: () => emit('open-camera') }, emptyContent())
          : h('label', { class: 'w-full h-full flex flex-col items-center justify-center cursor-pointer' }, [
          ...emptyContent(),
          h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden', onChange }),
        ]),
      isCameraOnlySlot() ? h('button', { type: 'button', class: 'absolute bottom-2 left-2 px-2 py-1 rounded bg-blue-600 text-white text-xs', onClick: () => emit('open-camera') }, props.image ? '다시 촬영' : '촬영') : null,
      isSurfaceSlot() ? h('label', { class: 'absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-xs' }, [
        '파일 선택',
        h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden', onChange }),
      ]) : null,
      props.image ? h('button', { type: 'button', class: 'absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-xs', onClick: () => emit('clear') }, '삭제') : null,
    ]);
  },
});

const VideoSlot = defineComponent({
  props: { title: { type: String, required: true }, help: { type: String, required: true }, video: { type: String, default: '' } },
  emits: ['picked', 'clear', 'open-camera'],
  setup(props, { emit }) {
    const onChange = (event: Event) => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      if (file) emit('picked', file);
      input.value = '';
    };
    return () => h('div', { class: 'relative h-24 rounded-lg border-2 border-dashed overflow-hidden bg-gray-50 sm:h-32' }, [
      props.video
        ? h('video', { src: props.video, controls: true, class: 'w-full h-full object-cover' })
        : h('button', { type: 'button', class: 'w-full h-full flex flex-col items-center justify-center cursor-pointer', onClick: () => emit('open-camera') }, [
          h(Video, { size: 24, class: 'mb-2 text-gray-400' }),
          h('span', { class: 'text-sm text-gray-700 text-center' }, props.title),
          h('span', { class: 'text-xs text-gray-500 mt-1 text-center' }, props.help),
        ]),
      h('label', { class: 'absolute right-2 bottom-2 rounded bg-black/60 px-2 py-1 text-[11px] text-white' }, [
        '파일 선택',
        h('input', { type: 'file', accept: 'video/*', capture: 'environment', class: 'hidden', onChange }),
      ]),
      h('button', { type: 'button', class: 'absolute bottom-2 left-2 px-2 py-1 rounded bg-blue-600 text-white text-xs', onClick: () => emit('open-camera') }, props.video ? '다시 촬영' : '촬영'),
      props.video ? h('button', { type: 'button', class: 'absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-xs', onClick: () => emit('clear') }, '삭제') : null,
    ]);
  },
});

const AudioRecorder = defineComponent({
  props: {
    kind: { type: String, required: true },
    name: { type: String, default: '' },
    url: { type: String, default: '' },
    isRecording: { type: Boolean, default: false },
    seconds: { type: Number, default: 0 },
    minSeconds: { type: Number, default: 0 },
    maxSeconds: { type: Number, default: 0 },
    description: { type: String, required: true },
  },
  emits: ['start', 'stop', 'clear'],
  setup(props, { emit }) {
    const formatSeconds = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    const savedLabel = () => {
      return '음질 샘플 저장됨';
    };
    const remainingSeconds = () => Math.max(0, props.minSeconds - props.seconds);
    return () => h('div', { class: 'rounded-lg border p-3 space-y-3 bg-white' }, [
      h('div', { class: 'flex items-center gap-3' }, [
        h('div', { class: ['w-10 h-10 rounded-full flex items-center justify-center shrink-0', props.isRecording ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'] }, [h(Mic, { size: 20 })]),
        h('div', { class: 'flex-1 min-w-0' }, [
          h('p', { class: 'text-sm truncate' }, props.name ? savedLabel() : props.description),
          h('p', { class: 'text-xs text-gray-500' }, props.isRecording
            ? `녹음 중 ${formatSeconds(props.seconds)}${remainingSeconds() ? ` · ${remainingSeconds()}초 남음` : ''}`
            : `기기 마이크로 ${formatSeconds(props.minSeconds)}~${formatSeconds(props.maxSeconds)} 녹음합니다.`),
        ]),
        props.isRecording
          ? h('button', { type: 'button', class: 'px-3 py-2 rounded-lg bg-red-600 text-white text-xs disabled:bg-gray-300', disabled: props.seconds < props.minSeconds, onClick: () => emit('stop') }, '정지')
          : h('button', { type: 'button', class: 'px-3 py-2 rounded-lg bg-blue-600 text-white text-xs', onClick: () => emit('start') }, props.name ? '다시 녹음' : '녹음'),
      ]),
      props.url ? h('div', { class: 'space-y-2' }, [
        h('audio', { src: props.url, controls: true, class: 'w-full' }),
        h('button', { type: 'button', class: 'text-xs text-gray-500 underline', onClick: () => emit('clear') }, '녹음 삭제'),
      ]) : null,
    ]);
  },
});
</script>
