<template>
  <main class="size-full bg-white text-gray-900 flex flex-col">
    <header class="px-4 py-4 flex items-center justify-between border-b">
      <div class="flex items-center gap-2">
        <button class="p-2 rounded-full active:bg-gray-100" @click="router.back()">
          <ArrowLeft :size="24" />
        </button>
        <h1 class="text-lg font-semibold">{{ isEditing ? '판매글 수정' : '판매 등록' }}</h1>
      </div>
      <button
        :disabled="!valid || publishSaving"
        :class="['px-4 py-2 rounded-lg', valid && !publishSaving ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400']"
        @click="publishListingAction"
      >
        {{ publishSaving ? (isEditing ? '수정 중' : '게시 중') : (isEditing ? '수정' : '게시') }}
      </button>
    </header>

    <section class="flex-1 overflow-y-auto p-4 space-y-6">
      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-medium">사진과 표면 분석</h2>
          <span class="text-xs text-gray-500">LP 여부가 아니라 판매 신뢰용 감정</span>
        </div>

        <PhotoSlot title="대표 이미지" help="판매글 목록에 보일 앨범 커버" :image="coverImage" @picked="file => setImage('cover', file)" @clear="clearImage('cover')" />

        <div class="grid grid-cols-2 gap-3">
          <PhotoSlot title="표면 이미지" help="원형 가이드에 맞춰 촬영" :image="recordImage" @picked="file => setImage('record', file)" @clear="clearImage('record')" @open-camera="openSurfaceCamera('image')" />
          <VideoSlot title="표면 동영상" help="비스듬한 반사 가이드 촬영" :video="recordVideo" @picked="setRecordVideo" @clear="clearRecordVideo" @open-camera="openSurfaceCamera('video')" />
        </div>

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

        <div v-if="recordMediaPreview" class="rounded-lg border p-3 text-sm">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="font-medium">표면 상태 점수</p>
              <p class="text-gray-500 mt-1">{{ recordRecognition.signals[0] }}</p>
            </div>
            <span class="px-2 py-1 rounded text-xs shrink-0 bg-blue-100 text-blue-700">
              {{ recordRecognition.surfaceScore }}점
            </span>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">스크래치</p><p>{{ recordRecognition.scratchCount }}개</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">위험도</p><p>{{ riskLabel(recordRecognition.scratchRisk) }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">재생 영향</p><p>{{ recordRecognition.playbackImpact }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">반사</p><p>{{ riskLabel(recordRecognition.reflectionRisk) }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">강한 후보</p><p>{{ recordRecognition.scratchDetails?.highSeverity || 0 }}곳</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">표시 후보</p><p>{{ recordRecognition.scratchDetails?.displayedRegions ?? recordRecognition.scratchRegions.length }}곳</p></div>
          </div>
          <div v-if="recordRecognition.scratchRegions.length" class="mt-3 rounded-lg bg-gray-950 text-white p-2 text-xs">
            스크래치 위치 후보 {{ recordRecognition.scratchRegions.length }}개가 감지되었습니다. 조명 반사와 먼지 가능성이 있어 판매 전 육안 확인을 함께 권장합니다.
          </div>
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="text-base font-medium">판매 정보</h2>
        <div>
          <label class="block text-sm mb-2">카탈로그 번호 *</label>
          <div class="flex gap-2">
            <input v-model="form.catalogNumber" type="text" class="flex-1 min-w-0 px-4 py-3 border rounded-lg" placeholder="예: CL 1355, PCS 7088, ST-A-691671" @keydown.enter.prevent="searchCatalog" />
            <button type="button" class="px-4 py-3 border rounded-lg whitespace-nowrap text-sm text-blue-600 disabled:text-gray-300" :disabled="isCatalogSearching || (form.catalogNumber.trim().length < 3 && form.title.trim().length < 2 && form.artist.trim().length < 2)" @click="searchCatalog">
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
              <p class="text-sm font-medium">{{ candidate.title }}</p>
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
        <div>
          <label class="block text-sm mb-2">매트릭스 번호</label>
          <input v-model="form.matrixNumber" type="text" class="w-full px-4 py-3 border rounded-lg" placeholder="예: XLP47324-1A, YEX 749-2" />
        </div>
      </section>

      <section class="space-y-3">
        <h2 class="text-base font-medium">음질 녹음 분석</h2>
        <div class="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-medium text-indigo-950">스크래치 기준 녹음 추천</p>
              <p class="mt-1 text-xs text-gray-600">표면 이미지/동영상에서 감지한 스크래치 위치를 기준으로 녹음할 구간을 추천합니다.</p>
            </div>
            <button type="button" class="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-xs text-white disabled:bg-gray-300" :disabled="!recordMediaPreview" @click="applyScratchAudioRecommendation">
              추천 적용
            </button>
          </div>
          <p class="mt-2 text-xs text-indigo-700">{{ scratchAudioRecommendation.summary }}</p>
          <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div class="rounded-lg bg-white p-3">
              <p class="font-medium text-green-700">좋은 구간</p>
              <p class="mt-1">{{ scratchAudioRecommendation.good.title }}</p>
              <p class="mt-1 text-gray-500">{{ scratchAudioRecommendation.good.suggestedStart }} / {{ scratchAudioRecommendation.good.recordSeconds }}초</p>
              <p class="mt-2 text-gray-600">{{ scratchAudioRecommendation.good.guide }}</p>
            </div>
            <div class="rounded-lg bg-white p-3">
              <p class="font-medium text-yellow-800">안 좋은 구간</p>
              <p class="mt-1">{{ scratchAudioRecommendation.noisy.title }}</p>
              <p class="mt-1 text-gray-500">{{ scratchAudioRecommendation.noisy.suggestedStart }} / {{ scratchAudioRecommendation.noisy.recordSeconds }}초</p>
              <p class="mt-2 text-gray-600">{{ scratchAudioRecommendation.noisy.guide }}</p>
            </div>
          </div>
          <div v-if="scratchAudioRecommendation.scratchNotes.length" class="mt-3 rounded-lg bg-white p-3 text-xs text-gray-700">
            <p class="font-medium text-gray-900">감지 근거</p>
            <ul class="mt-2 space-y-1">
              <li v-for="note in scratchAudioRecommendation.scratchNotes" :key="note" class="flex gap-2">
                <span class="text-indigo-600">•</span>
                <span>{{ note }}</span>
              </li>
            </ul>
          </div>
        </div>

        <AudioRecorder kind="ambient" :name="ambientAudioName" :url="ambientAudioUrl" :is-recording="recordingKind === 'ambient'" :seconds="recordingSeconds" description="주변음 5초 측정" @start="startAudioRecording('ambient')" @stop="stopAudioRecording" @clear="clearAudio('ambient')" />
        <div v-if="ambientAudioName" class="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
          주변음 기준 샘플이 저장되었습니다. 이 값으로 마이크/방 소음을 빼고 LP 자체 잡음을 더 보수적으로 계산합니다.
        </div>
        <AudioRecorder kind="good" :name="goodAudioName" :url="goodAudioUrl" :is-recording="recordingKind === 'good'" :seconds="recordingSeconds" description="좋은 구간 녹음" @start="startAudioRecording('good')" @stop="stopAudioRecording" @clear="clearAudio('good')" />
        <AudioRecorder kind="noisy" :name="noisyAudioName" :url="noisyAudioUrl" :is-recording="recordingKind === 'noisy'" :seconds="recordingSeconds" description="안 좋은 구간 녹음" @start="startAudioRecording('noisy')" @stop="stopAudioRecording" @clear="clearAudio('noisy')" />

        <div v-if="goodAudioName" class="grid grid-cols-2 gap-2 rounded-lg bg-green-50 p-3 text-sm">
          <label class="space-y-1">
            <span class="text-xs font-medium text-green-800">좋은 구간 시작(초)</span>
            <input v-model.number="goodSampleStart" type="number" min="0" step="1" class="w-full rounded-lg border px-3 py-2" @change="saveDraft(false)" />
          </label>
          <label class="space-y-1">
            <span class="text-xs font-medium text-green-800">좋은 구간 끝(초)</span>
            <input v-model.number="goodSampleEnd" type="number" min="1" step="1" class="w-full rounded-lg border px-3 py-2" @change="saveDraft(false)" />
          </label>
        </div>
        <div v-if="noisyAudioName" class="grid grid-cols-2 gap-2 rounded-lg bg-yellow-50 p-3 text-sm">
          <label class="space-y-1">
            <span class="text-xs font-medium text-yellow-900">안 좋은 구간 시작(초)</span>
            <input v-model.number="noisySampleStart" type="number" min="0" step="1" class="w-full rounded-lg border px-3 py-2" @change="saveDraft(false)" />
          </label>
          <label class="space-y-1">
            <span class="text-xs font-medium text-yellow-900">안 좋은 구간 끝(초)</span>
            <input v-model.number="noisySampleEnd" type="number" min="1" step="1" class="w-full rounded-lg border px-3 py-2" @change="saveDraft(false)" />
          </label>
        </div>

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
        <button type="button" class="w-full py-3 rounded-lg bg-gray-900 text-white disabled:bg-gray-300" :disabled="(!goodAudioFile && !noisyAudioFile) || audioAnalyzing" @click="runAudioAnalysis">
          {{ audioAnalyzing ? '음질 분석 중' : '녹음 파일로 음질 분석' }}
        </button>

        <div v-if="audioAnalysis" class="rounded-lg border p-3 space-y-3 text-sm">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium">음질 분석 결과</p>
              <p class="text-gray-500 mt-1">{{ audioAnalysis.summary }}</p>
            </div>
            <span class="px-2 py-1 rounded text-xs shrink-0 bg-purple-100 text-purple-700">
              {{ audioAnalysis.audioGrade }} · {{ audioAnalysis.audioScore }}점
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-xs">
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">클릭/팝</p><p>{{ audioAnalysis.clickCount ?? '-' }}개</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">노이즈</p><p>{{ formatDb(audioAnalysis.noiseFloorDb) }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">재생 위험</p><p>{{ riskLabel(audioAnalysis.playbackRisk) }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">주변음</p><p>{{ formatDb(audioAnalysis.ambientNoiseFloorDb) }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">보정 노이즈</p><p>{{ formatDb(audioAnalysis.adjustedNoiseFloorDb) }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">신뢰도</p><p>{{ audioAnalysis.analysisConfidence ?? '-' }}점</p></div>
          </div>
          <p v-for="warning in audioAnalysis.warnings || []" :key="warning" class="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{{ warning }}</p>
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="text-base font-medium">게시 정보</h2>
        <div>
          <label class="block text-sm mb-2">판매 가격 *</label>
          <div class="flex gap-2">
            <input v-model="form.price" type="number" class="flex-1 min-w-0 px-4 py-3 border rounded-lg" placeholder="가격 입력" />
            <button type="button" class="px-4 py-3 border rounded-lg whitespace-nowrap text-sm text-blue-600" @click="recommendPrice">추천 가격</button>
          </div>
          <p v-if="priceMessage" class="mt-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">{{ priceMessage }}</p>
        </div>
        <div>
          <label class="block text-sm mb-2">거래 주소</label>
          <div class="flex gap-2">
            <input v-model="form.location" type="text" class="flex-1 min-w-0 px-4 py-3 border rounded-lg" placeholder="예: 강남역, 서울 강남구 테헤란로" @keydown.enter.prevent="searchAddress" @change="saveDraft(false)" />
            <button type="button" class="inline-flex items-center justify-center gap-1 px-4 py-3 border rounded-lg whitespace-nowrap text-sm text-blue-600 disabled:text-gray-300" :disabled="isAddressSearching || form.location.trim().length < 2" @click="searchAddress">
              <Search :size="16" />
              <span>{{ isAddressSearching ? '검색 중' : '주소 검색' }}</span>
            </button>
          </div>
          <p v-if="addressLookupMessage" class="mt-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">{{ addressLookupMessage }}</p>
          <div v-if="addressCandidates.length" class="mt-2 space-y-2">
            <button v-for="candidate in addressCandidates" :key="candidate.id" type="button" class="w-full rounded-lg border border-gray-200 bg-white p-3 text-left active:bg-gray-50" @click="selectAddressCandidate(candidate)">
              <span class="flex items-start gap-2">
                <MapPin :size="16" class="mt-0.5 shrink-0 text-blue-600" />
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-gray-900">{{ candidate.roadAddress || candidate.jibunAddress }}</span>
                  <span class="mt-1 block text-xs text-gray-500">{{ candidate.zipCode ? `[${candidate.zipCode}] ` : '' }}{{ candidate.jibunAddress }}</span>
                </span>
              </span>
            </button>
          </div>
          <p class="mt-1 text-xs text-gray-500">도로명주소 API 결과를 선택하면 거래 지도와 검색 필터에 표시됩니다.</p>
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="block text-sm">상세 설명</label>
            <button type="button" class="text-xs text-blue-600" @click="fillDescription">감정 결과 반영</button>
          </div>
          <textarea v-model="form.description" class="w-full px-4 py-3 border rounded-lg min-h-36" placeholder="표면 상태와 음질 분석 결과를 적어 주세요." />
        </div>
        <div>
          <label class="block text-sm mb-2">태그</label>
          <input v-model="form.tags" type="text" class="w-full px-4 py-3 border rounded-lg" placeholder="#재즈 #초반 #감정서참고" />
        </div>
      </section>

      <section class="rounded-lg border p-3 space-y-3">
        <h2 class="text-base font-medium">감정 요약</h2>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">표면</p><p>{{ recordRecognition.surfaceScore || '-' }}점</p></div>
          <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">음질</p><p>{{ audioAnalysis?.audioScore || '-' }}점</p></div>
        </div>
        <label class="flex items-start gap-2 text-sm">
          <input v-model="form.analysisConfirmed" type="checkbox" true-value="true" false-value="" class="mt-1" />
          <span>감정 결과는 판매 신뢰를 높이기 위한 참고 자료이며, 실제 재생과 육안 확인을 함께 안내하겠습니다.</span>
        </label>
        <button type="button" class="w-full py-3 rounded-lg border" :disabled="draftSaving" @click="saveDraft(true)">
          {{ draftSaving ? '저장 중' : '임시 저장' }}
        </button>
        <button type="button" class="w-full py-3 rounded-lg border border-blue-200 text-blue-600" @click="startNewDraft">
          새 임시저장으로 작성
        </button>
        <div v-if="draftEntries.length" class="space-y-2">
          <p class="text-xs text-gray-500">저장된 임시글 {{ draftEntries.length }}개</p>
          <div v-for="entry in draftEntries" :key="entry.id" class="flex items-center gap-2 rounded-lg bg-gray-50 p-2">
            <button type="button" class="min-w-0 flex-1 text-left" @click="loadDraftEntry(entry)">
              <p class="truncate text-sm">{{ entry.title }}</p>
              <p class="text-xs text-gray-500">{{ new Date(entry.updatedAt).toLocaleString('ko-KR') }}</p>
            </button>
            <button type="button" class="px-3 py-2 text-xs text-red-600" @click="removeDraftEntry(entry.id)">삭제</button>
          </div>
        </div>
        <p v-if="draftMessage" :class="['text-xs text-center', draftSavedToDb ? 'text-green-600' : 'text-amber-600']">{{ draftMessage }}</p>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, MapPin, Mic, Search, Upload, Video } from 'lucide-vue-next';
import {
  analyzeAudioSamples,
  analyzeLpMedia,
  createPressingInfo,
  fetchDiscogsCandidates,
  fetchPriceRecommendation,
  recognizeLpImage,
  type AlbumCandidate,
  type AudioAnalysisResult,
  type LpRecognition,
  type ScratchRegion,
} from '../data/vinylAnalysis';
import { fetchAddressCandidates, type AddressCandidate } from '../data/addressLookup';
import { useAppStore, type ListingDraftEntry } from '../stores/appStore';
import { openAppPermissionSettings } from '../data/appSettings';
import { canUseNativeAudioRecorder, startNativeAudioRecording, stopNativeAudioRecording } from '../data/nativeAudioRecorder';
import { setPendingSellDraft, takePendingCapture, takePendingSellDraft } from '../data/captureTransfer';

const router = useRouter();
const route = useRoute();
const store = useAppStore();
const editingListingId = computed(() => String(route.params.id || ''));
const isEditing = computed(() => Boolean(editingListingId.value));
const pendingSellDraft = isEditing.value ? null : takePendingSellDraft();
const restoredPendingSellDraft = Boolean(pendingSellDraft);
const draft = isEditing.value ? null : (pendingSellDraft || store.readDraft());
const draftForm = draft?.formData && typeof draft.formData === 'object' ? draft.formData as Record<string, unknown> : {};
const draftImages = Array.isArray(draft?.images) ? draft.images as string[] : [];
const draftCoverImage = String(draft?.coverImageDataUrl || draftImages[0] || '');
const draftRecordImage = String(draft?.recordImageDataUrl || draftImages[1] || '');

const form = reactive({
  title: String(draftForm.title || ''),
  artist: String(draftForm.artist || ''),
  catalogNumber: String(draftForm.catalogNumber || ''),
  matrixNumber: String(draftForm.matrixNumber || ''),
  price: String(draftForm.price || ''),
  location: String(draftForm.location || store.settings.trade.defaultLocation || ''),
  description: String(draftForm.description || ''),
  tags: String(draftForm.tags || ''),
  pressing: String(draftForm.pressing || ''),
  analysisConfirmed: String(draftForm.analysisConfirmed || ''),
});

const coverImage = ref(draftCoverImage);
const recordImage = ref(draftRecordImage);
const extraImages = ref<string[]>(draftImages.slice(2, 5));
const recordVideo = ref(String(draft?.recordVideoDataUrl || ''));
const ambientAudioFile = ref<File | null>(null);
const goodAudioFile = ref<File | null>(null);
const noisyAudioFile = ref<File | null>(null);
const ambientAudioName = ref(String(draft?.ambientAudioFileName || ''));
const goodAudioName = ref(String(draft?.goodAudioFileName || ''));
const noisyAudioName = ref(String(draft?.noisyAudioFileName || ''));
const ambientAudioDataUrl = ref(String(draft?.ambientAudioDataUrl || ''));
const goodAudioDataUrl = ref(String(draft?.goodAudioDataUrl || ''));
const noisyAudioDataUrl = ref(String(draft?.noisyAudioDataUrl || ''));
const ambientAudioUrl = ref(ambientAudioDataUrl.value);
const goodAudioUrl = ref(goodAudioDataUrl.value);
const noisyAudioUrl = ref(noisyAudioDataUrl.value);
const goodSampleStart = ref(Number(draft?.goodSampleStart ?? 0));
const goodSampleEnd = ref(Number(draft?.goodSampleEnd ?? 20));
const noisySampleStart = ref(Number(draft?.noisySampleStart ?? 0));
const noisySampleEnd = ref(Number(draft?.noisySampleEnd ?? 15));
const recordingKind = ref<'ambient' | 'good' | 'noisy' | null>(null);
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
const recordRecognition = ref<LpRecognition>(recognizeLpImage(recordImage.value || recordVideo.value));
const priceMessage = ref('');
const addressCandidates = ref<AddressCandidate[]>([]);
const addressLookupMessage = ref('');
const addressLookupSource = ref<'juso' | 'local' | ''>('');
const catalogLookupMessage = ref('');
const catalogApiStatus = ref('');
const draftMessage = ref('');
const draftSaving = ref(false);
const publishSaving = ref(false);
const draftSavedToDb = ref(false);
const draftEntries = ref<ListingDraftEntry[]>(store.readDrafts());
const catalogCandidates = ref<AlbumCandidate[]>([]);
const selectedCandidateId = ref('');
const candidateSource = ref<'discogs' | 'discogs-direct' | 'mock' | ''>('');
const isCatalogSearching = ref(false);
const isAddressSearching = ref(false);
let catalogLookupRequest = 0;
let addressLookupRequest = 0;

const recordMediaPreview = computed(() => recordImage.value || recordVideo.value);
const selectedCandidate = computed(() => catalogCandidates.value.find(candidate => candidate.id === selectedCandidateId.value));
const riskLabel = (risk?: 'low' | 'medium' | 'high' | string) => risk === 'high' ? '높음' : risk === 'medium' ? '주의' : '낮음';
const formatDb = (value?: number | null) => typeof value === 'number' ? `${value.toFixed(1)} dB` : '-';
const recordVideoGuides = [
  '밝은 곳에서 LP 표면 전체가 보이도록 8~12초 정도 천천히 촬영하세요.',
  '카메라를 살짝 움직여 반사 위치가 이동하게 찍으면 스크래치와 먼지 구분이 쉬워집니다.',
  '중앙 라벨보다 홈이 있는 표면을 넓게 담고, 강한 플래시는 피해주세요.',
];
const clockLabelForScratch = (region: ScratchRegion) => {
  const centerX = (region.x1 + region.x2) / 2 - 50;
  const centerY = (region.y1 + region.y2) / 2 - 50;
  const angle = Math.atan2(centerY, centerX);
  const hour = Math.round(((angle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 12) || 12;
  return `${hour}시 방향`;
};
const grooveLabelForScratch = (region: ScratchRegion) => {
  const centerX = (region.x1 + region.x2) / 2 - 50;
  const centerY = (region.y1 + region.y2) / 2 - 50;
  const radius = Math.sqrt(centerX * centerX + centerY * centerY);
  if (radius < 18) return '안쪽 홈';
  if (radius < 34) return '중간 홈';
  return '바깥쪽 홈';
};
const scratchAudioRecommendation = computed(() => {
  const severeRegions = [...recordRecognition.value.scratchRegions]
    .filter(region => region.severity !== 'low')
    .sort((left, right) => {
      const severityScore = { high: 3, medium: 2, low: 1 };
      return severityScore[right.severity || 'low'] - severityScore[left.severity || 'low'];
    });
  const targetRegion = severeRegions[0] || recordRecognition.value.scratchRegions[0];
  const hasScratch = Boolean(targetRegion);
  const badLocation = targetRegion ? `${clockLabelForScratch(targetRegion)} ${grooveLabelForScratch(targetRegion)}` : '도입부 또는 조용한 홈';
  const goodTitle = recordRecognition.value.scratchRisk === 'high'
    ? '스크래치 후보와 떨어진 안정 구간'
    : '표면 점수가 안정적인 중간 구간';
  const noisyTitle = hasScratch ? `스크래치 후보 주변: ${badLocation}` : '표면 확인용 조용한 구간';
  const scratchNotes = [
    recordMediaPreview.value
      ? `표면 점수 ${recordRecognition.value.surfaceScore || 0}점, 스크래치 후보 ${recordRecognition.value.scratchCount || 0}개입니다.`
      : '표면 이미지나 동영상을 먼저 올리면 스크래치 기준 추천이 더 정확해집니다.',
    hasScratch
      ? `${badLocation}에서 ${targetRegion?.severity === 'high' ? '강한' : targetRegion?.severity === 'medium' ? '중간' : '약한'} 스크래치 후보가 보입니다.`
      : '뚜렷한 스크래치 후보가 적어 일반 검수용으로 조용한 구간 녹음을 권장합니다.',
    `재생 영향 평가는 ${recordRecognition.value.playbackImpact || '낮음'}입니다.`,
  ];
  return {
    summary: hasScratch
      ? '안 좋은 구간은 스크래치 후보가 보이는 홈 주변을, 좋은 구간은 그 반대쪽의 안정적인 홈을 녹음해 비교하세요.'
      : '스크래치 후보가 적으므로 좋은 구간 위주로 녹음하고, 조용한 도입부를 짧게 추가 확인하세요.',
    scratchNotes,
    good: {
      title: goodTitle,
      suggestedStart: hasScratch ? '스크래치 반대쪽 홈에서 시작' : '중간 트랙 20초',
      recordSeconds: 20,
      guide: '클릭/팝이 적게 들리는 구간을 골라 기준 음질 샘플로 사용합니다.',
    },
    noisy: {
      title: noisyTitle,
      suggestedStart: hasScratch ? `${badLocation} 재생 구간` : '도입부 0~15초',
      recordSeconds: recordRecognition.value.scratchRisk === 'high' ? 20 : 15,
      guide: hasScratch
        ? '바늘이 해당 위치를 지나는 부분을 녹음해 스크래치가 실제 재생에 영향을 주는지 확인합니다.'
        : '조용한 구간에서 바닥 잡음과 미세 클릭을 확인합니다.',
    },
  };
});
const canStartAnalysis = computed(() => Boolean(recordMediaPreview.value && form.catalogNumber.trim()));
const valid = computed(() => Boolean(form.title && form.price && (isEditing.value || (canStartAnalysis.value && form.analysisConfirmed === 'true'))));

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
  }
  resetConfirmation();
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
  }
  resetConfirmation();
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
  form.location = listing.location || store.settings.trade.defaultLocation || '';
  form.description = listing.description;
  form.tags = [listing.genre, ...(listing.isRare ? ['희귀반'] : []), ...(listing.isFirstPress ? ['초반'] : [])].filter(Boolean).join(' ');
  form.pressing = listing.isFirstPress ? '초반 추정' : '';
  form.analysisConfirmed = 'true';
  coverImage.value = listing.coverImageDataUrl || listing.images[0] || '';
  recordImage.value = listing.recordImageDataUrl || listing.images[1] || '';
  recordVideo.value = listing.recordVideoDataUrl || '';
  extraImages.value = listing.images.slice(2, 5);
  recordRecognition.value = recognizeLpImage(recordImage.value || recordVideo.value, recordVideo.value && !recordImage.value ? 'video' : 'image');
  if (listing.audioSamples?.good) {
    goodAudioName.value = listing.audioSamples.good.name;
    goodAudioDataUrl.value = listing.audioSamples.good.dataUrl || '';
    goodAudioUrl.value = goodAudioDataUrl.value;
    goodSampleStart.value = Number(listing.audioSamples.good.startSeconds || 0);
    goodSampleEnd.value = Number(listing.audioSamples.good.endSeconds || listing.audioSamples.good.durationSeconds || 20);
  }
  if (listing.audioSamples?.noisy) {
    noisyAudioName.value = listing.audioSamples.noisy.name;
    noisyAudioDataUrl.value = listing.audioSamples.noisy.dataUrl || '';
    noisyAudioUrl.value = noisyAudioDataUrl.value;
    noisySampleStart.value = Number(listing.audioSamples.noisy.startSeconds || 0);
    noisySampleEnd.value = Number(listing.audioSamples.noisy.endSeconds || listing.audioSamples.noisy.durationSeconds || 15);
  }
  audioAnalysis.value = {
    source: 'librosa',
    audioScore: listing.audioScore,
    audioGrade: listing.audioGrade,
    playbackRisk: listing.audioScore >= 82 ? 'low' : listing.audioScore >= 70 ? 'medium' : 'high',
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

const handleAudio = async (kind: 'ambient' | 'good' | 'noisy', file: File) => {
  const dataUrl = await readFileAsDataUrl(file);
  if (kind === 'ambient') {
    ambientAudioFile.value = file;
    ambientAudioName.value = file.name;
    ambientAudioDataUrl.value = dataUrl;
    ambientAudioUrl.value = dataUrl;
  } else if (kind === 'good') {
    goodAudioFile.value = file;
    goodAudioName.value = file.name;
    goodAudioDataUrl.value = dataUrl;
    goodAudioUrl.value = dataUrl;
    goodSampleStart.value = 0;
    goodSampleEnd.value = scratchAudioRecommendation.value.good.recordSeconds || 20;
  } else {
    noisyAudioFile.value = file;
    noisyAudioName.value = file.name;
    noisyAudioDataUrl.value = dataUrl;
    noisyAudioUrl.value = dataUrl;
    noisySampleStart.value = 0;
    noisySampleEnd.value = scratchAudioRecommendation.value.noisy.recordSeconds || 15;
  }
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

const cleanupRecordingStream = () => {
  recordingStream?.getTracks().forEach(track => track.stop());
  recordingStream = null;
};

const audioRecordingMessage = (kind: 'ambient' | 'good' | 'noisy') => {
  if (kind === 'ambient') return '주변음을 5초 정도 측정 중입니다. LP를 재생하지 말고 방 소리만 들려주세요.';
  if (kind === 'good') return '좋은 구간을 녹음 중입니다. 20초 정도가 적당합니다.';
  return '안 좋은 구간을 녹음 중입니다. 15초 정도가 적당합니다.';
};

const audioSampleFilePrefix = (kind: 'ambient' | 'good' | 'noisy') => {
  if (kind === 'ambient') return 'ambient-sample';
  if (kind === 'good') return 'good-section-sample';
  return 'bad-section-sample';
};

const mimeTypeForRecording = () => {
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  return '';
};

const startAudioRecording = async (kind: 'ambient' | 'good' | 'noisy') => {
  if (recordingKind.value) return;
  showMicSettingsButton.value = false;
  if (canUseNativeAudioRecorder()) {
    try {
      await startNativeAudioRecording();
      recordingUsesNative = true;
      recordingKind.value = kind;
      recordingSeconds.value = 0;
      recordingMessage.value = audioRecordingMessage(kind);
      recordingTimer = window.setInterval(() => { recordingSeconds.value += 1; }, 1000);
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
    recordingKind.value = kind;
    recordingSeconds.value = 0;
    recordingMessage.value = audioRecordingMessage(kind);
    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) recordingChunks.push(event.data);
    };
    mediaRecorder.onstop = () => {
      const activeKind = recordingKind.value || kind;
      const blobType = mediaRecorder?.mimeType || 'audio/webm';
      const blob = new Blob(recordingChunks, { type: blobType });
      const extension = blobType.includes('mp4') ? 'm4a' : 'webm';
      const file = new File([blob], `${audioSampleFilePrefix(activeKind)}-${Date.now()}.${extension}`, { type: blobType });
      void handleAudio(activeKind, file);
      recordingKind.value = null;
      recordingChunks = [];
      clearRecordingTimer();
      cleanupRecordingStream();
      mediaRecorder = null;
      recordingMessage.value = '녹음이 저장되었습니다. 바로 음질 분석을 실행할 수 있습니다.';
    };
    mediaRecorder.start();
    recordingTimer = window.setInterval(() => { recordingSeconds.value += 1; }, 1000);
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
  if (recordingUsesNative) {
    const activeKind = recordingKind.value;
    void stopNativeAudioRecording()
      .then(result => {
        if (!activeKind) return;
        const file = dataUrlToFile(result.dataUrl, `${audioSampleFilePrefix(activeKind)}-${Date.now()}.${result.extension || 'm4a'}`);
        void handleAudio(activeKind, file);
        recordingMessage.value = '녹음이 저장되었습니다. 바로 음질 분석을 실행할 수 있습니다.';
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

const clearAudio = (kind: 'ambient' | 'good' | 'noisy') => {
  if (kind === 'ambient') {
    ambientAudioFile.value = null;
    ambientAudioName.value = '';
    ambientAudioDataUrl.value = '';
    ambientAudioUrl.value = '';
  } else if (kind === 'good') {
    goodAudioFile.value = null;
    goodAudioName.value = '';
    goodAudioDataUrl.value = '';
    goodAudioUrl.value = '';
    goodSampleStart.value = 0;
    goodSampleEnd.value = scratchAudioRecommendation.value.good.recordSeconds || 20;
  } else {
    noisyAudioFile.value = null;
    noisyAudioName.value = '';
    noisyAudioDataUrl.value = '';
    noisyAudioUrl.value = '';
    noisySampleStart.value = 0;
    noisySampleEnd.value = scratchAudioRecommendation.value.noisy.recordSeconds || 15;
  }
  audioAnalysis.value = null;
  resetConfirmation();
  saveDraft(false);
};

const runAudioAnalysis = async () => {
  audioAnalyzing.value = true;
  recordingMessage.value = '녹음 파일을 분석용 WAV로 변환한 뒤 음질을 확인하는 중입니다.';
  try {
    audioAnalysis.value = await analyzeAudioSamples({ ambient: ambientAudioFile.value || undefined, good: goodAudioFile.value || undefined, noisy: noisyAudioFile.value || undefined });
    recordingMessage.value = audioAnalysis.value.source === 'fallback' || audioAnalysis.value.source === 'mock'
      ? '녹음 포맷을 완전히 해석하지 못해 임시 점수를 표시했습니다. 다시 녹음하거나 파일 선택으로 WAV/M4A를 올려보세요.'
      : '음질 분석이 완료되었습니다.';
    fillDescription();
    saveDraft(false);
  } catch (error) {
    recordingMessage.value = error instanceof Error ? error.message : '음질 분석에 실패했습니다. 다시 시도해 주세요.';
  } finally {
    audioAnalyzing.value = false;
  }
};

const applyScratchAudioRecommendation = () => {
  goodSampleStart.value = 0;
  goodSampleEnd.value = scratchAudioRecommendation.value.good.recordSeconds;
  noisySampleStart.value = 0;
  noisySampleEnd.value = scratchAudioRecommendation.value.noisy.recordSeconds;
  saveDraft(false);
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
  if (!form.catalogNumber) form.catalogNumber = selectedCandidate.value.catalogNumber;
  const pressing = createPressingInfo(selectedCandidate.value, form.matrixNumber);
  form.pressing = pressing.pressing;
  catalogLookupMessage.value = `${selectedCandidate.value.title} 정보를 적용했습니다.`;
  resetConfirmation();
};

const searchAddress = async () => {
  const keyword = form.location.trim();
  if (keyword.length < 2 || isAddressSearching.value) return;
  const requestId = ++addressLookupRequest;
  isAddressSearching.value = true;
  addressLookupMessage.value = '주소를 검색하는 중입니다.';
  addressCandidates.value = [];
  try {
    const result = await fetchAddressCandidates(keyword);
    if (requestId !== addressLookupRequest) return;
    addressLookupSource.value = result.source;
    addressCandidates.value = result.candidates;
    if (result.candidates.length) {
      const sourceLabel = result.source === 'juso' ? '도로명주소 API' : '기본 후보';
      addressLookupMessage.value = `${sourceLabel}에서 ${result.candidates.length}개 주소를 찾았습니다. 맞는 주소를 선택해 주세요.`;
    } else {
      addressLookupMessage.value = result.message || '일치하는 주소가 없습니다. 도로명이나 지하철역 이름을 조금 더 구체적으로 입력해 주세요.';
    }
  } catch (error) {
    addressLookupSource.value = '';
    addressLookupMessage.value = error instanceof Error ? error.message : '주소 검색에 실패했습니다.';
  } finally {
    if (requestId === addressLookupRequest) isAddressSearching.value = false;
  }
};

const selectAddressCandidate = (candidate: AddressCandidate) => {
  form.location = candidate.roadAddress || candidate.jibunAddress;
  addressCandidates.value = [];
  addressLookupMessage.value = `${addressLookupSource.value === 'juso' ? '도로명주소 API' : '기본 후보'} 주소를 적용했습니다.`;
  saveDraft(false);
};

watch(() => form.catalogNumber, () => {
  catalogLookupMessage.value = '';
  catalogApiStatus.value = '';
  catalogCandidates.value = [];
  selectedCandidateId.value = '';
});

const currentImages = () => [coverImage.value, recordImage.value, ...extraImages.value].filter(Boolean);

const currentDraft = () => ({
  images: currentImages(),
  coverImageDataUrl: coverImage.value,
  recordImageDataUrl: recordImage.value,
  recordVideoDataUrl: recordVideo.value,
  ambientAudioFileName: ambientAudioName.value,
  goodAudioFileName: goodAudioName.value,
  noisyAudioFileName: noisyAudioName.value,
  ambientAudioDataUrl: ambientAudioDataUrl.value,
  goodAudioDataUrl: goodAudioDataUrl.value,
  noisyAudioDataUrl: noisyAudioDataUrl.value,
  goodSampleStart: goodSampleStart.value,
  goodSampleEnd: goodSampleEnd.value,
  noisySampleStart: noisySampleStart.value,
  noisySampleEnd: noisySampleEnd.value,
  audioAnalysis: audioAnalysis.value,
  audioRecommendations: scratchAudioRecommendation.value,
  formData: { ...form },
});

const openSurfaceCamera = (mode: 'image' | 'video') => {
  setPendingSellDraft(currentDraft());
  router.push(mode === 'video' ? '/sell/camera?mode=video' : '/sell/camera');
};

const saveDraft = async (showAlert = true) => {
  if (draftSaving.value) return;
  draftSaving.value = true;
  const result = await store.saveDraftToServer(currentDraft());
  draftEntries.value = store.readDrafts();
  draftSavedToDb.value = result.persisted;
  draftMessage.value = result.message;
  draftSaving.value = false;
  if (showAlert) setTimeout(() => { draftMessage.value = ''; }, 2400);
};

const loadDraftEntry = (entry: ListingDraftEntry) => {
  store.activateDraft(entry);
  window.location.reload();
};

const removeDraftEntry = async (draftId: string) => {
  await store.deleteDraft(draftId);
  draftEntries.value = store.readDrafts();
};

const startNewDraft = () => {
  store.setActiveDraftId(`local-${Date.now()}`);
  localStorage.removeItem('vinyl-check-listing-draft');
  window.location.reload();
};

const recommendPrice = async () => {
  priceMessage.value = 'Discogs 거래 기록과 상품 품질 점수를 확인하는 중입니다.';
  try {
    const result = await fetchPriceRecommendation({
      catalogNumber: form.catalogNumber.trim(),
      title: form.title.trim(),
      artist: form.artist.trim(),
      releaseId: selectedCandidate.value?.releaseId,
      surfaceScore: recordRecognition.value.surfaceScore,
      audioScore: audioAnalysis.value?.audioScore,
      scratchRisk: recordRecognition.value.scratchRisk,
      playbackRisk: audioAnalysis.value?.playbackRisk,
    });
    form.price = String(result.recommended_price);
    const range = result.price_range ? `추천 범위 ${result.price_range.min.toLocaleString()}~${result.price_range.max.toLocaleString()}원. ` : '';
    const discogs = result.discogs?.suggestedPrice || result.discogs?.marketplaceLow
      ? `Discogs 기준 ${result.discogs.suggestedPrice ? `거래/추천 ${result.discogs.suggestedPrice.toLocaleString()}원` : ''}${result.discogs.marketplaceLow ? `, 현재 최저 ${result.discogs.marketplaceLow.toLocaleString()}원` : ''}. `
      : '';
    priceMessage.value = `${result.recommended_price.toLocaleString()}원 추천. ${range}${discogs}${result.reason}`;
  } catch {
    const catalog = form.catalogNumber.toLowerCase().trim();
    const title = form.title.toLowerCase().trim();
    const matched = store.listings.find(album => album.id !== editingListingId.value && ((catalog && album.catalogNumber.toLowerCase() === catalog) || (title && album.title.toLowerCase().includes(title))));
    const baseAlbums = store.listings.filter(album => album.id !== editingListingId.value && album.price > 0);
    const averagePrice = baseAlbums.length ? baseAlbums.reduce((sum, album) => sum + album.price, 0) / baseAlbums.length : 100000;
    const quality = audioAnalysis.value?.audioScore ? Math.max(0.7, Math.min(1.08, audioAnalysis.value.audioScore / 82)) : 1;
    const price = Math.round((matched ? ((matched.priceRange.min + matched.priceRange.max) / 2) : averagePrice) * quality / 1000) * 1000;
    form.price = String(price);
    priceMessage.value = `Discogs 가격 추천 연결 실패로 앱 내 시세와 품질 점수 기준 ${price.toLocaleString()}원을 임시 추천합니다.`;
  }
};

const fillDescription = () => {
  const parts = [
    form.title ? `${form.title}${form.artist ? ` - ${form.artist}` : ''}` : '',
    form.catalogNumber ? `카탈로그 번호: ${form.catalogNumber}` : '',
    form.location ? `거래 주소: ${form.location}` : '',
    recordMediaPreview.value ? `표면 상태 점수 ${recordRecognition.value.surfaceScore}점, 스크래치 후보 ${recordRecognition.value.scratchCount}개, 재생 영향 ${recordRecognition.value.playbackImpact}` : '',
    recordMediaPreview.value ? `음질 녹음 추천: 좋은 구간은 ${scratchAudioRecommendation.value.good.title}, 안 좋은 구간은 ${scratchAudioRecommendation.value.noisy.title}` : '',
    audioAnalysis.value ? `음질 ${audioAnalysis.value.audioGrade} (${audioAnalysis.value.audioScore}점), 클릭/팝 후보 ${audioAnalysis.value.clickCount ?? 0}개, 재생 위험 ${riskLabel(audioAnalysis.value.playbackRisk)}` : '',
    '감정 결과는 판매 설명 참고용이며 실제 재생과 육안 확인을 함께 권장합니다.',
  ].filter(Boolean);
  form.description = parts.join('\n');
};

const normalizeSegment = (start: number, end: number, fallbackEnd: number) => {
  const safeStart = Math.max(0, Number.isFinite(start) ? start : 0);
  const safeEnd = Math.max(safeStart + 1, Number.isFinite(end) ? end : fallbackEnd);
  return { startSeconds: safeStart, endSeconds: safeEnd, durationSeconds: safeEnd - safeStart };
};

const audioSamplePayload = () => {
  const goodSegment = normalizeSegment(goodSampleStart.value, goodSampleEnd.value, scratchAudioRecommendation.value.good.recordSeconds || 20);
  const noisySegment = normalizeSegment(noisySampleStart.value, noisySampleEnd.value, scratchAudioRecommendation.value.noisy.recordSeconds || 15);
  return {
    ...(goodAudioName.value ? { good: { name: goodAudioName.value, dataUrl: goodAudioDataUrl.value, ...goodSegment } } : {}),
    ...(noisyAudioName.value ? { noisy: { name: noisyAudioName.value, dataUrl: noisyAudioDataUrl.value, ...noisySegment } } : {}),
  };
};

const publishListingAction = async () => {
  if (!valid.value || publishSaving.value) return;
  publishSaving.value = true;
  if (!form.description.trim()) fillDescription();
  const tags = form.tags.replace(/,/g, ' ').split(/\s+/).map(tag => tag.trim()).filter(Boolean);
  const payload = {
    title: form.title.trim(),
    artist: form.artist.trim(),
    catalog_number: form.catalogNumber.trim(),
    price: Number(form.price),
    description: form.description.trim(),
    tags,
    location: form.location.trim(),
    images: currentImages(),
    cover_image_data_url: coverImage.value,
    record_image_data_url: recordImage.value,
    record_video_data_url: recordVideo.value,
    audio_grade: audioAnalysis.value?.audioGrade,
    audio_score: audioAnalysis.value?.audioScore,
    audio_samples: audioSamplePayload(),
    is_rare: tags.some(tag => tag.includes('희귀') || tag.toLowerCase().includes('rare')),
    is_first_press: form.pressing.includes('초반') || form.pressing.toLowerCase().includes('first'),
    analysis_report: {
      pressing: form.pressing,
      coverImageDataUrl: coverImage.value,
      recordImageDataUrl: recordImage.value,
      recordVideoDataUrl: recordVideo.value,
      recordSurface: recordRecognition.value,
      audio: audioAnalysis.value,
      audioRecommendations: scratchAudioRecommendation.value,
      audioSamples: audioSamplePayload(),
    },
  };
  const result = isEditing.value
    ? await store.updateListing(editingListingId.value, payload)
    : await store.publishListing(payload);
  publishSaving.value = false;
  if (!result.ok) {
    alert(result.message);
    return;
  }
  if (!isEditing.value) store.clearDraft();
  router.push(isEditing.value && result.listing ? `/app/album/${result.listing.id}?mine=true` : '/sell/report');
};

onMounted(async () => {
  if (isEditing.value) {
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
  const scannedRecordImage = takePendingCapture('image') || localStorage.getItem('vinyl-check-scanned-record-image');
  if (scannedRecordImage) {
    localStorage.removeItem('vinyl-check-scanned-record-image');
    recordImage.value = scannedRecordImage;
    recordRecognition.value = await analyzeLpMedia(scannedRecordImage, 'image');
    appliedScannedMedia = true;
  }
  const scannedRecordVideo = takePendingCapture('video') || localStorage.getItem('vinyl-check-scanned-record-video');
  if (scannedRecordVideo) {
    localStorage.removeItem('vinyl-check-scanned-record-video');
    recordVideo.value = scannedRecordVideo;
    recordRecognition.value = await analyzeLpMedia(scannedRecordVideo, 'video');
    appliedScannedMedia = true;
  }
  if (appliedScannedMedia) await saveDraft(false);
  if (ambientAudioDataUrl.value && !ambientAudioFile.value) {
    ambientAudioFile.value = dataUrlToFile(ambientAudioDataUrl.value, ambientAudioName.value || 'ambient-sample.webm');
  }
  if (goodAudioDataUrl.value && !goodAudioFile.value) {
    goodAudioFile.value = dataUrlToFile(goodAudioDataUrl.value, goodAudioName.value || 'good-sample.webm');
  }
  if (noisyAudioDataUrl.value && !noisyAudioFile.value) {
    noisyAudioFile.value = dataUrlToFile(noisyAudioDataUrl.value, noisyAudioName.value || 'bad-section-sample.webm');
  }
  const draftsResult = await store.loadDraftsFromServer();
  draftEntries.value = draftsResult.drafts;
  if (!appliedScannedMedia && !restoredPendingSellDraft) {
    const result = await store.loadDraftFromServer();
    if (result.persisted) {
      draftSavedToDb.value = true;
      draftMessage.value = '저장된 판매글 초안을 불러왔습니다.';
      setTimeout(() => { draftMessage.value = ''; }, 2200);
    }
  }
});

onBeforeUnmount(() => {
  if (recordingUsesNative) void stopNativeAudioRecording().catch(() => undefined);
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  clearRecordingTimer();
  cleanupRecordingStream();
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
    const emptyContent = () => [
      h(Upload, { size: 24, class: 'mb-2 text-gray-400' }),
      h('span', { class: 'text-sm text-gray-700 text-center' }, props.title),
      h('span', { class: 'text-xs text-gray-500 mt-1 text-center' }, props.help),
    ];
    const isSurfaceSlot = () => props.title.includes('표면');
    return () => h('div', { class: 'relative aspect-square rounded-lg border-2 border-dashed overflow-hidden bg-gray-50' }, [
      props.image
        ? h('img', { src: props.image, alt: props.title, class: 'w-full h-full object-cover' })
        : isSurfaceSlot()
          ? h('button', { type: 'button', class: 'w-full h-full flex flex-col items-center justify-center cursor-pointer', onClick: () => emit('open-camera') }, emptyContent())
          : h('label', { class: 'w-full h-full flex flex-col items-center justify-center cursor-pointer' }, [
          ...emptyContent(),
          h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden', onChange }),
        ]),
      isSurfaceSlot() ? h('button', { type: 'button', class: 'absolute bottom-2 left-2 px-2 py-1 rounded bg-blue-600 text-white text-xs', onClick: () => emit('open-camera') }, props.image ? '다시 촬영' : '촬영') : null,
      isSurfaceSlot() ? h('label', { class: 'absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-xs' }, [
        '파일 선택',
        h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden', onChange }),
      ]) : null,
      props.image ? h('button', { type: 'button', class: 'absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-xs', onClick: () => emit('clear') }, '변경') : null,
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
    return () => h('div', { class: 'relative aspect-square rounded-lg border-2 border-dashed overflow-hidden bg-gray-50' }, [
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
      props.video ? h('button', { type: 'button', class: 'absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-xs', onClick: () => emit('clear') }, '변경') : null,
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
    description: { type: String, required: true },
  },
  emits: ['start', 'stop', 'clear'],
  setup(props, { emit }) {
    const formatSeconds = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    const savedLabel = () => {
      if (props.kind === 'ambient') return '주변음 측정 완료';
      if (props.kind === 'good') return '좋은 구간 녹음 완료';
      return '안 좋은 구간 녹음 완료';
    };
    return () => h('div', { class: 'rounded-lg border p-3 space-y-3 bg-white' }, [
      h('div', { class: 'flex items-center gap-3' }, [
        h('div', { class: ['w-10 h-10 rounded-full flex items-center justify-center shrink-0', props.isRecording ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'] }, [h(Mic, { size: 20 })]),
        h('div', { class: 'flex-1 min-w-0' }, [
          h('p', { class: 'text-sm truncate' }, props.name ? savedLabel() : props.description),
          h('p', { class: 'text-xs text-gray-500' }, props.isRecording ? `녹음 중 ${formatSeconds(props.seconds)}` : '기기 마이크로 바로 녹음합니다.'),
        ]),
        props.isRecording
          ? h('button', { type: 'button', class: 'px-3 py-2 rounded-lg bg-red-600 text-white text-xs', onClick: () => emit('stop') }, '정지')
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
