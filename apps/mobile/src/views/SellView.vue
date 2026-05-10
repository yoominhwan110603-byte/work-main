<template>
  <main class="size-full bg-white text-gray-900 flex flex-col">
    <header class="px-4 py-4 flex items-center justify-between border-b">
      <div class="flex items-center gap-2">
        <button class="p-2" @click="router.back()">
          <ArrowLeft :size="24" />
        </button>
        <h1 class="text-lg">판매 등록</h1>
      </div>
      <button
        :disabled="!valid || publishSaving"
        :class="['px-4 py-2 rounded-lg', valid && !publishSaving ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400']"
        @click="publishListingAction"
      >
        {{ publishSaving ? '게시 중' : '게시' }}
      </button>
    </header>

    <section class="flex-1 overflow-y-auto p-4 space-y-6">
      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-base">사진/동영상</h2>
          <span class="text-xs text-gray-500">이미지와 동영상 공존</span>
        </div>

        <PhotoSlot
          title="앨범 자켓 이미지"
          help="자켓 점수 산정"
          :image="jacketImage"
          @picked="file => setImage('jacket', file)"
          @clear="clearImage('jacket')"
        />

        <div v-if="jacketCondition" class="rounded-lg border p-3 text-sm">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="font-medium">자켓 상태 분석</p>
              <p class="text-gray-500 mt-1">{{ jacketCondition.notes[0] }}</p>
            </div>
            <span class="px-2 py-1 rounded text-xs shrink-0 bg-green-100 text-green-700">
              {{ jacketCondition.grade }} · {{ jacketCondition.score }}점
            </span>
          </div>
          <div class="mt-3 grid grid-cols-4 gap-2 text-xs">
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">모서리</p><p>{{ riskLabel(jacketCondition.cornerWear) }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">링웨어</p><p>{{ riskLabel(jacketCondition.ringWear) }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">얼룩</p><p>{{ riskLabel(jacketCondition.stainRisk) }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">접힘</p><p>{{ riskLabel(jacketCondition.tearOrCreaseRisk) }}</p></div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <PhotoSlot
            title="음반 표면 이미지"
            help="스크래치/표면 상태 확인"
            :image="recordImage"
            @picked="file => setImage('record', file)"
            @clear="clearImage('record')"
          />
          <VideoSlot
            title="음반 표면 동영상"
            help="스크래치/반사 확인"
            :video="recordVideo"
            @picked="setRecordVideo"
            @clear="clearRecordVideo"
          />
        </div>

        <section class="rounded-lg border border-blue-100 bg-blue-50 p-3">
          <div class="flex items-start gap-2">
            <Video :size="18" class="text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p class="text-sm font-medium text-blue-950">동영상 촬영 가이드</p>
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
              <p class="font-medium">표면 상태 확인</p>
              <p class="text-gray-500 mt-1">{{ recordRecognition.signals[0] }}</p>
            </div>
            <span class="px-2 py-1 rounded text-xs shrink-0 bg-blue-100 text-blue-700">
              표면 {{ recordRecognition.surfaceScore || recordRecognition.confidence }}점
            </span>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">스크래치</p><p>{{ recordRecognition.scratchCount }}개</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">위험도</p><p>{{ riskLabel(recordRecognition.scratchRisk) }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">재생 영향</p><p>{{ recordRecognition.playbackImpact }}</p></div>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-base">추가 이미지</h2>
          <span class="text-xs text-gray-500">최대 3장</span>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div v-for="(image, index) in extraImages" :key="image + index" class="relative aspect-square">
            <img :src="image" :alt="`추가 이미지 ${index + 1}`" class="w-full h-full object-cover rounded-lg" />
            <button
              class="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-xs"
              @click="removeExtraImage(index)"
            >
              x
            </button>
          </div>
          <label
            v-if="extraImages.length < 3"
            class="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-600"
          >
            <Upload :size="24" class="mb-2 text-gray-400" />
            <span class="text-xs text-gray-500">추가</span>
            <input type="file" accept="image/*" multiple class="hidden" @change="handleExtraImages" />
          </label>
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="text-base">판매 정보</h2>
        <div v-if="false" class="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-medium text-indigo-950">Discogs 트랙 기준 녹음 추천</p>
              <p class="mt-1 text-xs text-gray-600">카탈로그 번호로 트랙리스트를 불러와 좋은 구간 1개와 잡음 확인 구간 1개를 제안합니다.</p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-xs text-white disabled:bg-gray-300"
              :disabled="isTrackRecommendationLoading || form.catalogNumber.trim().length < 3"
              @click="loadTrackRecommendations"
            >
              {{ isTrackRecommendationLoading ? '확인 중' : '추천' }}
            </button>
          </div>
          <p v-if="trackRecommendationMessage" class="mt-2 text-xs text-indigo-700">{{ trackRecommendationMessage }}</p>
          <div v-if="trackRecommendations" class="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div class="rounded-lg bg-white p-3">
              <p class="font-medium text-green-700">좋은 구간</p>
              <p class="mt-1">{{ trackRecommendations.good.position }} · {{ trackRecommendations.good.title }}</p>
              <p class="mt-1 text-gray-500">{{ trackRecommendations.good.suggestedStart }} / {{ trackRecommendations.good.recordSeconds }}초</p>
            </div>
            <div class="rounded-lg bg-white p-3">
              <p class="font-medium text-yellow-800">잡음 확인</p>
              <p class="mt-1">{{ trackRecommendations.noisy.position }} · {{ trackRecommendations.noisy.title }}</p>
              <p class="mt-1 text-gray-500">{{ trackRecommendations.noisy.suggestedStart }} / {{ trackRecommendations.noisy.recordSeconds }}초</p>
            </div>
          </div>
        </div>
        <div>
          <label class="block text-sm mb-2">카탈로그 번호 *</label>
          <div class="flex gap-2">
            <input
              v-model="form.catalogNumber"
              type="text"
              class="flex-1 min-w-0 px-4 py-3 border rounded-lg"
              placeholder="예: CL 1355, PCS 7088, ST-A-691671"
              @keydown.enter.prevent="searchCatalog"
            />
            <button
              type="button"
              class="px-4 py-3 border rounded-lg whitespace-nowrap text-sm text-blue-600 disabled:text-gray-300"
              :disabled="isCatalogSearching || (form.catalogNumber.trim().length < 3 && form.title.trim().length < 2 && form.artist.trim().length < 2)"
              @click="searchCatalog"
            >
              {{ isCatalogSearching ? '검색 중' : 'Discogs 검색' }}
            </button>
          </div>
          <p class="text-xs text-gray-500 mt-1">번호를 모두 입력한 뒤 검색하세요. 후보를 고른 다음 앨범명과 아티스트를 다듬어 적용합니다.</p>
          <p v-if="catalogLookupMessage" class="text-xs text-blue-600 mt-1">{{ catalogLookupMessage }}</p>
          <p v-if="catalogApiStatus" class="text-[11px] text-gray-500 mt-1">{{ catalogApiStatus }}</p>
        </div>
        <section v-if="catalogCandidates.length > 0" class="rounded-lg border p-3 space-y-3">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-medium">Discogs 후보</p>
            <span class="text-xs text-gray-500">{{ candidateSource === 'mock' ? '검색 실패' : 'Discogs API' }}</span>
          </div>
          <div class="space-y-2">
            <button
              v-for="candidate in catalogCandidates"
              :key="candidate.id"
              type="button"
              :class="[
                'w-full text-left rounded-lg border p-3',
                selectedCandidateId === candidate.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'
              ]"
              @click="selectCatalogCandidate(candidate.id)"
            >
              <p class="text-sm font-medium">{{ candidate.title }}</p>
              <p class="text-xs text-gray-500 mt-1">{{ candidate.artist }} · {{ candidate.label }} · {{ candidate.country }} {{ candidate.year || '' }}</p>
            </button>
          </div>
          <div class="grid grid-cols-1 gap-3">
            <div>
              <label class="block text-xs text-gray-500 mb-1">적용할 앨범명</label>
              <input v-model="candidateTitle" type="text" class="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">적용할 아티스트</label>
              <input v-model="candidateArtist" type="text" class="w-full px-3 py-2 border rounded-lg" />
            </div>
            <button
              type="button"
              class="w-full py-3 rounded-lg bg-blue-600 text-white disabled:bg-gray-300"
              :disabled="!candidateTitle.trim()"
              @click="applyCatalogCandidate"
            >
              다듬은 정보 입력
            </button>
          </div>
        </section>
        <div>
          <label class="block text-sm mb-2">앨범명 *</label>
          <input v-model="form.title" type="text" class="w-full px-4 py-3 border rounded-lg" placeholder="Discogs 후보를 적용하거나 직접 입력하세요" />
        </div>
        <div>
          <label class="block text-sm mb-2">아티스트</label>
          <input v-model="form.artist" type="text" class="w-full px-4 py-3 border rounded-lg" placeholder="Discogs 후보를 적용하거나 직접 입력하세요" />
        </div>
        <div>
          <label class="block text-sm mb-2">매트릭스 번호</label>
          <input v-model="form.matrixNumber" type="text" class="w-full px-4 py-3 border rounded-lg" placeholder="예: XLP47324-1A, YEX 749-2" />
          <p class="text-xs text-gray-500 mt-1">런아웃/데드왁스에 새겨진 번호를 적으면 초반 여부 판단에 함께 반영됩니다.</p>
        </div>
        <div>
          <label class="block text-sm mb-2">판매 가격 *</label>
          <div class="flex gap-2">
            <input v-model="form.price" type="number" class="flex-1 min-w-0 px-4 py-3 border rounded-lg" placeholder="가격 입력" />
            <button type="button" class="px-4 py-3 border rounded-lg whitespace-nowrap text-sm text-blue-600" @click="recommendPrice">추천 가격</button>
          </div>
          <p v-if="priceMessage" class="mt-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">{{ priceMessage }}</p>
        </div>
        <div>
          <label class="block text-sm mb-2">상세 설명</label>
          <textarea
            v-model="form.description"
            class="w-full px-4 py-3 border rounded-lg min-h-32"
            placeholder="자켓 상태, 음반 상태, 구매 경로, 보관 상태를 적어주세요"
          />
        </div>
        <div>
          <label class="block text-sm mb-2">태그</label>
          <input v-model="form.tags" type="text" class="w-full px-4 py-3 border rounded-lg" placeholder="#재즈 #희귀반 #초반" />
        </div>
      </section>

      <section class="space-y-3">
        <h2 class="text-base">음질 샘플</h2>
        <div>
          <div class="rounded-xl border border-indigo-100 bg-white p-3 text-sm shadow-sm">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="font-medium text-gray-950">트랙 기준 녹음 추천</p>
                <p class="mt-1 text-xs text-gray-500">Discogs 트랙리스트로 좋은 구간과 잡음 확인 구간을 고릅니다.</p>
              </div>
              <button
                type="button"
                class="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-xs text-white disabled:bg-gray-300"
                :disabled="isTrackRecommendationLoading || form.catalogNumber.trim().length < 3"
                @click="loadTrackRecommendations"
              >
                {{ isTrackRecommendationLoading ? '확인 중' : '추천' }}
              </button>
            </div>
            <p v-if="form.catalogNumber.trim().length < 3" class="mt-2 text-xs text-gray-500">카탈로그 번호를 먼저 입력하면 추천을 받을 수 있습니다.</p>
            <p v-if="trackRecommendationMessage" class="mt-2 text-xs text-indigo-700">{{ trackRecommendationMessage }}</p>
            <div v-if="trackRecommendations" class="mt-3 space-y-2 text-xs">
              <div class="rounded-lg bg-green-50 p-3">
                <div class="flex items-start justify-between gap-2">
                  <p class="font-medium text-green-700">좋은 구간</p>
                  <span class="rounded bg-white px-2 py-0.5 text-green-700">{{ trackRecommendations.good.recordSeconds }}초</span>
                </div>
                <p class="mt-1 truncate text-gray-900">{{ trackRecommendations.good.position }} · {{ shortTrackTitle(trackRecommendations.good.title) }}</p>
                <p class="mt-1 text-gray-500">{{ trackRecommendations.good.suggestedStart }}</p>
              </div>
              <div class="rounded-lg bg-yellow-50 p-3">
                <div class="flex items-start justify-between gap-2">
                  <p class="font-medium text-yellow-800">잡음 확인</p>
                  <span class="rounded bg-white px-2 py-0.5 text-yellow-800">{{ trackRecommendations.noisy.recordSeconds }}초</span>
                </div>
                <p class="mt-1 truncate text-gray-900">{{ trackRecommendations.noisy.position }} · {{ shortTrackTitle(trackRecommendations.noisy.title) }}</p>
                <p class="mt-1 text-gray-500">{{ trackRecommendations.noisy.suggestedStart }}</p>
              </div>
            </div>
          </div>
          <label class="mt-3 block text-sm mb-2">좋은 구간 20초</label>
          <AudioRecorder
            kind="good"
            :name="goodAudioName"
            :url="goodAudioUrl"
            :is-recording="recordingKind === 'good'"
            :seconds="recordingSeconds"
            description="잡음이 적고 재생 상태가 좋은 부분"
            @start="startAudioRecording('good')"
            @stop="stopAudioRecording"
            @clear="clearAudio('good')"
          />
        </div>
        <div>
          <label class="block text-sm mb-2">잡음 확인 구간 15초</label>
          <AudioRecorder
            kind="noisy"
            :name="noisyAudioName"
            :url="noisyAudioUrl"
            :is-recording="recordingKind === 'noisy'"
            :seconds="recordingSeconds"
            description="스크래치나 잡음이 잘 들리는 부분"
            @start="startAudioRecording('noisy')"
            @stop="stopAudioRecording"
            @clear="clearAudio('noisy')"
          />
        </div>
        <p v-if="recordingMessage" class="rounded-lg bg-gray-50 p-3 text-xs text-gray-700">{{ recordingMessage }}</p>
        <button
          class="w-full py-3 rounded-lg border text-sm disabled:text-gray-400"
          :disabled="!goodAudioFile && !noisyAudioFile"
          @click="runAudioAnalysis"
        >
          librosa 음질 분석
        </button>
        <div v-if="audioAnalysisMessage" class="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          {{ audioAnalysisMessage }}
        </div>
        <div v-if="audioAnalysis" class="rounded-lg border p-3 space-y-3 text-sm">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium">음질 분석 결과</p>
              <p class="text-xs text-gray-500 mt-1">클릭/팝, 노이즈, 클리핑, 다이내믹 레인지를 반영합니다.</p>
            </div>
            <span class="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs">
              {{ audioAnalysis.audioGrade }} · {{ audioAnalysis.audioScore }}점
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-xs">
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">클릭/팝</p><p>{{ audioAnalysis.clickCount ?? '-' }}개</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">노이즈</p><p>{{ formatDb(audioAnalysis.noiseFloorDb) }}</p></div>
            <div class="rounded bg-gray-50 p-2"><p class="text-gray-500">재생 위험</p><p>{{ riskLabel(audioAnalysis.playbackRisk) }}</p></div>
          </div>
          <div v-if="audioAnalysis.goodSample || audioAnalysis.noisySample" class="grid grid-cols-2 gap-2 text-xs">
            <div v-if="audioAnalysis.goodSample" class="rounded bg-green-50 p-2">
              <p class="text-green-700">좋은 구간</p>
              <p>{{ audioAnalysis.goodSample.score ?? audioAnalysis.audioScore }}점 · 클릭 {{ audioAnalysis.goodSample.clickCount ?? 0 }}개</p>
            </div>
            <div v-if="audioAnalysis.noisySample" class="rounded bg-yellow-50 p-2">
              <p class="text-yellow-800">안 좋은 구간</p>
              <p>{{ audioAnalysis.noisySample.score ?? '-' }}점 · 클릭 {{ audioAnalysis.noisySample.clickCount ?? 0 }}개</p>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">
        <div class="flex items-start gap-2">
          <BadgeCheck :size="18" class="text-blue-600 mt-0.5 shrink-0" />
          <div class="min-w-0 flex-1">
            <p class="font-medium text-blue-950">마지막 단계: 감정서 확인</p>
            <p class="mt-1 text-gray-600">입력한 이미지, 동영상, 카탈로그 번호, 매트릭스 번호, 음질 샘플을 모아 게시 직전에 감정서를 확인합니다.</p>
          </div>
        </div>

        <div v-if="analysisApplied" class="mt-3 rounded-lg bg-white/80 border border-blue-100 p-3 text-blue-900">
          {{ analysisApplied }}
        </div>
        <div v-if="form.analysisConfirmed === 'true'" class="mt-2 text-xs text-green-700">
          감정서를 확인했습니다. 게시할 수 있습니다.
        </div>

        <div class="mt-3 grid grid-cols-2 gap-2">
          <button
            class="py-3 rounded-lg text-white disabled:bg-gray-300 bg-blue-600"
            :disabled="!canStartAnalysis"
            @click="startAnalysisFromForm"
          >
            감정서 만들기
          </button>
          <button
            class="py-3 rounded-lg border border-blue-600 text-blue-600 disabled:border-gray-200 disabled:text-gray-400"
            :disabled="!form.pressing"
            @click="router.push('/sell/analysis/result')"
          >
            감정서 확인
          </button>
        </div>
        <p v-if="!canStartAnalysis" class="mt-2 text-xs text-gray-500">
          자켓 이미지, 음반 표면 이미지 또는 동영상, 카탈로그 번호가 필요합니다.
        </p>
      </section>

      <div class="pb-4">
        <button
          class="w-full py-2 text-sm text-gray-600 border rounded-lg disabled:text-gray-300"
          :disabled="draftSaving"
          @click="saveDraft"
        >
          {{ draftSaving ? '임시 저장 중...' : '임시 저장' }}
        </button>
        <p v-if="draftMessage" :class="['mt-2 text-xs text-center', draftSavedToDb ? 'text-green-600' : 'text-amber-600']">
          {{ draftMessage }}
        </p>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, BadgeCheck, Mic, Upload, Video } from 'lucide-vue-next';
import { mockAlbums } from '../data/mockData';
import { analyzeAudioSamples, analyzeJacketCondition, analyzeLpMedia, fetchDiscogsCandidates, fetchTrackRecommendations, recognizeLpImage, type AlbumCandidate, type AudioAnalysisResult, type CoverCondition, type LpRecognition, type TrackRecommendations } from '../data/vinylAnalysis';
import { useAppStore } from '../stores/appStore';

const router = useRouter();
const store = useAppStore();
const draft = store.readDraft();
const draftForm = draft?.formData && typeof draft.formData === 'object' ? draft.formData as Record<string, unknown> : {};
const draftImages = Array.isArray(draft?.images) ? draft.images as string[] : [];

const form = reactive({
  title: String(draftForm.title || ''),
  artist: String(draftForm.artist || ''),
  catalogNumber: String(draftForm.catalogNumber || ''),
  matrixNumber: String(draftForm.matrixNumber || ''),
  price: String(draftForm.price || ''),
  description: String(draftForm.description || ''),
  tags: String(draftForm.tags || ''),
  pressing: String(draftForm.pressing || ''),
  jacketGrade: String(draftForm.jacketGrade || ''),
  jacketScore: String(draftForm.jacketScore || ''),
  analysisConfirmed: String(draftForm.analysisConfirmed || ''),
});

const jacketImage = ref(draftImages[0] || '');
const recordImage = ref(draftImages[1] || '');
const extraImages = ref<string[]>(draftImages.slice(2, 5));
const recordVideo = ref(String(draft?.recordVideoDataUrl || ''));
const goodAudioFile = ref<File | null>(null);
const noisyAudioFile = ref<File | null>(null);
const goodAudioName = ref(String(draft?.goodAudioFileName || ''));
const noisyAudioName = ref(String(draft?.noisyAudioFileName || ''));
const goodAudioUrl = ref('');
const noisyAudioUrl = ref('');
const recordingKind = ref<'good' | 'noisy' | null>(null);
const recordingSeconds = ref(0);
const recordingMessage = ref('');
let mediaRecorder: MediaRecorder | null = null;
let recordingStream: MediaStream | null = null;
let recordingTimer: number | null = null;
let recordingChunks: BlobPart[] = [];
const audioAnalysis = ref<AudioAnalysisResult | null>((draft?.audioAnalysis as AudioAnalysisResult | null) || null);
const trackRecommendations = ref<TrackRecommendations | null>((draft?.trackRecommendations as TrackRecommendations | null) || null);
const trackRecommendationMessage = ref('');
const isTrackRecommendationLoading = ref(false);
const recordRecognition = ref<LpRecognition>(recognizeLpImage(recordImage.value || recordVideo.value));
const jacketCondition = ref<CoverCondition | null>(
  form.jacketGrade
    ? {
        score: Number(form.jacketScore || 0),
        grade: form.jacketGrade,
        cornerWear: 'low',
        ringWear: 'low',
        stainRisk: 'low',
        tearOrCreaseRisk: 'low',
        notes: ['이전에 적용된 자켓 분석 결과입니다.'],
      }
    : null
);
const priceMessage = ref('');
const catalogLookupMessage = ref('');
const catalogApiStatus = ref('');
const draftMessage = ref('');
const draftSaving = ref(false);
const publishSaving = ref(false);
const draftSavedToDb = ref(false);
const catalogCandidates = ref<AlbumCandidate[]>([]);
const selectedCandidateId = ref('');
const candidateTitle = ref('');
const candidateArtist = ref('');
const candidateSource = ref<'discogs' | 'discogs-direct' | 'mock' | ''>('');
const isCatalogSearching = ref(false);
let catalogLookupRequest = 0;

const recordMediaPreview = computed(() => recordImage.value || recordVideo.value);
const riskLabel = (risk?: 'low' | 'medium' | 'high') => risk === 'high' ? '높음' : risk === 'medium' ? '주의' : '낮음';
const formatDb = (value?: number | null) => typeof value === 'number' ? `${value.toFixed(1)} dB` : '-';
const shortTrackTitle = (title?: string) => {
  const normalized = String(title || '').trim();
  return normalized.length > 28 ? `${normalized.slice(0, 28)}...` : normalized;
};
const recordVideoGuides = [
  '밝은 곳에서 LP 표면 전체가 보이도록 8~12초 정도 천천히 촬영하세요.',
  '휴대폰을 비스듬히 살짝 움직여 반사 위치가 이동하게 찍으면 스크래치와 먼지 구분이 쉬워집니다.',
  '중앙 라벨보다 홈이 있는 검은 표면을 크게 담고, 손 그림자와 강한 플래시는 피해주세요.',
  '자켓 상태는 별도 사진으로 정면, 모서리, 링웨어가 보이게 추가하면 감정서 신뢰도가 올라갑니다.',
];
const canStartAnalysis = computed(() => Boolean(
  jacketImage.value &&
  recordMediaPreview.value &&
  form.catalogNumber.trim()
));
const analysisApplied = computed(() => {
  if (!form.pressing && !form.jacketGrade) return '';
  return `적용됨: ${form.pressing || '판본 확인'} · 자켓 ${form.jacketGrade || '등급 확인'}${form.jacketScore ? ` ${form.jacketScore}점` : ''}`;
});
const audioAnalysisMessage = computed(() => {
  if (!audioAnalysis.value) return '';
  return `${audioAnalysis.value.source === 'librosa' ? 'librosa' : '목업'} 분석: ${audioAnalysis.value.audioGrade} ${audioAnalysis.value.audioScore}점 · ${audioAnalysis.value.summary}`;
});
const valid = computed(() => Boolean(
  form.title &&
  form.price &&
  canStartAnalysis.value &&
  form.pressing &&
  form.jacketGrade &&
  form.analysisConfirmed === 'true',
));

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const resetAnalysis = () => {
  form.analysisConfirmed = '';
  form.pressing = '';
  form.jacketGrade = '';
  form.jacketScore = '';
};

const setImage = async (slot: 'jacket' | 'record', file: File) => {
  const dataUrl = await readFileAsDataUrl(file);
  if (slot === 'jacket') {
    jacketImage.value = dataUrl;
    resetAnalysis();
    jacketCondition.value = await analyzeJacketCondition(dataUrl, form.catalogNumber || 'CL 1355');
    form.jacketGrade = jacketCondition.value.grade;
    form.jacketScore = String(jacketCondition.value.score);
    return;
  }
  if (slot === 'record') {
    recordImage.value = dataUrl;
    recordRecognition.value = await analyzeLpMedia(dataUrl, 'image');
  }
  resetAnalysis();
};

const setRecordVideo = async (file: File) => {
  recordVideo.value = await readFileAsDataUrl(file);
  recordRecognition.value = await analyzeLpMedia(recordVideo.value, 'video');
  resetAnalysis();
};

const clearImage = (slot: 'jacket' | 'record') => {
  if (slot === 'jacket') {
    jacketImage.value = '';
    jacketCondition.value = null;
  }
  if (slot === 'record') {
    recordImage.value = '';
    recordRecognition.value = recognizeLpImage(recordMediaPreview.value);
  }
  resetAnalysis();
};

const clearRecordVideo = () => {
  recordVideo.value = '';
  recordRecognition.value = recognizeLpImage(recordMediaPreview.value);
  resetAnalysis();
};

const handleExtraImages = async (event: Event) => {
  const files = Array.from((event.target as HTMLInputElement).files || []);
  const nextImages = await Promise.all(files.map(readFileAsDataUrl));
  extraImages.value = [...extraImages.value, ...nextImages].slice(0, 3);
};

const removeExtraImage = (index: number) => {
  extraImages.value.splice(index, 1);
};

const handleAudio = (kind: 'good' | 'noisy', file: File) => {
  if (kind === 'good') {
    goodAudioFile.value = file;
    goodAudioName.value = file.name;
    if (goodAudioUrl.value) URL.revokeObjectURL(goodAudioUrl.value);
    goodAudioUrl.value = URL.createObjectURL(file);
  } else {
    noisyAudioFile.value = file;
    noisyAudioName.value = file.name;
    if (noisyAudioUrl.value) URL.revokeObjectURL(noisyAudioUrl.value);
    noisyAudioUrl.value = URL.createObjectURL(file);
  }
  audioAnalysis.value = null;
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

const mimeTypeForRecording = () => {
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  return '';
};

const startAudioRecording = async (kind: 'good' | 'noisy') => {
  if (recordingKind.value) return;
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    recordingMessage.value = '이 기기에서는 실시간 녹음을 사용할 수 없습니다.';
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      } as MediaTrackConstraints,
    });
    recordingStream = stream;
    recordingChunks = [];
    const mimeType = mimeTypeForRecording();
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recordingKind.value = kind;
    recordingSeconds.value = 0;
    recordingMessage.value = kind === 'good'
      ? '좋은 구간을 녹음 중입니다. 20초 정도가 적당합니다.'
      : '잡음 확인 구간을 녹음 중입니다. 15초 정도가 적당합니다.';

    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) recordingChunks.push(event.data);
    };
    mediaRecorder.onstop = () => {
      const activeKind = recordingKind.value || kind;
      const blobType = mediaRecorder?.mimeType || 'audio/webm';
      const blob = new Blob(recordingChunks, { type: blobType });
      const extension = blobType.includes('webm') ? 'webm' : 'm4a';
      const file = new File([blob], `${activeKind}-sample-${Date.now()}.${extension}`, { type: blobType });
      handleAudio(activeKind, file);
      recordingKind.value = null;
      recordingChunks = [];
      clearRecordingTimer();
      cleanupRecordingStream();
      mediaRecorder = null;
      recordingMessage.value = '녹음이 저장되었습니다. 바로 음질 분석을 실행할 수 있습니다.';
    };
    mediaRecorder.start();
    recordingTimer = window.setInterval(() => {
      recordingSeconds.value += 1;
    }, 1000);
  } catch {
    recordingKind.value = null;
    clearRecordingTimer();
    cleanupRecordingStream();
    mediaRecorder = null;
    recordingMessage.value = '마이크 권한이 필요합니다. 권한을 허용한 뒤 다시 시도해 주세요.';
  }
};

const stopAudioRecording = () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
};

const clearAudio = (kind: 'good' | 'noisy') => {
  if (kind === 'good') {
    goodAudioFile.value = null;
    goodAudioName.value = '';
    if (goodAudioUrl.value) URL.revokeObjectURL(goodAudioUrl.value);
    goodAudioUrl.value = '';
  } else {
    noisyAudioFile.value = null;
    noisyAudioName.value = '';
    if (noisyAudioUrl.value) URL.revokeObjectURL(noisyAudioUrl.value);
    noisyAudioUrl.value = '';
  }
  audioAnalysis.value = null;
};

const runAudioAnalysis = async () => {
  audioAnalysis.value = await analyzeAudioSamples({
    good: goodAudioFile.value || undefined,
    noisy: noisyAudioFile.value || undefined,
  });
  saveDraft(false);
};

const loadTrackRecommendations = async () => {
  const catalog = form.catalogNumber.trim();
  if (catalog.length < 3 || isTrackRecommendationLoading.value) return;
  isTrackRecommendationLoading.value = true;
  trackRecommendationMessage.value = 'Discogs 트랙리스트를 확인하는 중입니다.';
  trackRecommendations.value = await fetchTrackRecommendations(catalog);
  trackRecommendationMessage.value = trackRecommendations.value.source === 'discogs'
    ? 'Discogs 트랙리스트 기준으로 추천했습니다.'
    : 'Discogs 연결이 없어서 기본 추천을 표시합니다.';
  isTrackRecommendationLoading.value = false;
  saveDraft(false);
};

const selectedCandidate = computed(() => catalogCandidates.value.find(candidate => candidate.id === selectedCandidateId.value));

const selectCatalogCandidate = (candidateId: string) => {
  const candidate = catalogCandidates.value.find(item => item.id === candidateId);
  if (!candidate) return;
  selectedCandidateId.value = candidate.id;
  candidateTitle.value = candidate.title;
  candidateArtist.value = candidate.artist;
};

const searchCatalog = async () => {
  const catalog = form.catalogNumber.trim();
  const title = form.title.trim();
  const artist = form.artist.trim();
  if ((catalog.length < 3 && title.length < 2 && artist.length < 2) || isCatalogSearching.value) return;

  resetAnalysis();
  const requestId = ++catalogLookupRequest;
  isCatalogSearching.value = true;
  catalogLookupMessage.value = 'Discogs에서 후보를 찾는 중입니다.';
  catalogApiStatus.value = '';

  try {
    const result = await fetchDiscogsCandidates(catalog, title, artist);
    if (requestId !== catalogLookupRequest) return;

    catalogCandidates.value = result.candidates;
    candidateSource.value = result.source;
    catalogApiStatus.value = `Discogs 요청: ${result.apiBaseUrl} / ${result.source} / 후보 ${result.candidates.length}개${result.error ? ` / 오류: ${result.error}` : ''}`;
    if (result.candidates.length === 0) {
      selectedCandidateId.value = '';
      candidateTitle.value = '';
      candidateArtist.value = '';
      catalogLookupMessage.value = '일치하는 후보가 없습니다. 앨범명과 아티스트를 직접 입력해 주세요.';
      return;
    }

    selectCatalogCandidate(result.candidates[0].id);
    catalogLookupMessage.value = `${result.candidates.length}개 후보를 찾았습니다. 맞는 후보를 고르고 정보가 어색하면 다듬어 입력하세요.`;
  } finally {
    if (requestId === catalogLookupRequest) isCatalogSearching.value = false;
  }
};

const applyCatalogCandidate = () => {
  if (!candidateTitle.value.trim()) return;
  form.title = candidateTitle.value.trim();
  form.artist = candidateArtist.value.trim();
  resetAnalysis();
  const sourceText = selectedCandidate.value ? `${selectedCandidate.value.title} - ${selectedCandidate.value.artist}` : '수정한 후보';
  catalogLookupMessage.value = `${sourceText} 정보를 입력했습니다. 앨범명과 아티스트는 계속 수정할 수 있습니다.`;
};

watch(() => form.catalogNumber, (nextCatalog, previousCatalog) => {
  resetAnalysis();
  if (nextCatalog === previousCatalog) return;
  catalogLookupMessage.value = '';
  catalogApiStatus.value = '';
  catalogCandidates.value = [];
  selectedCandidateId.value = '';
  candidateTitle.value = '';
  candidateArtist.value = '';
  candidateSource.value = '';
  trackRecommendations.value = null;
  trackRecommendationMessage.value = '';
});

const currentImages = () => [jacketImage.value, recordImage.value, ...extraImages.value].filter(Boolean);

const currentDraft = () => ({
  images: currentImages(),
  recordVideoDataUrl: recordVideo.value,
  goodAudioFileName: goodAudioName.value,
  noisyAudioFileName: noisyAudioName.value,
  goodAudioRecorded: Boolean(goodAudioFile.value),
  noisyAudioRecorded: Boolean(noisyAudioFile.value),
  audioAnalysis: audioAnalysis.value,
  trackRecommendations: trackRecommendations.value,
  formData: { ...form },
});

const applyDraft = async (nextDraft: Record<string, unknown>) => {
  const nextForm = nextDraft.formData && typeof nextDraft.formData === 'object' ? nextDraft.formData as Record<string, unknown> : {};
  form.title = String(nextForm.title || '');
  form.artist = String(nextForm.artist || '');
  form.catalogNumber = String(nextForm.catalogNumber || '');
  form.matrixNumber = String(nextForm.matrixNumber || '');
  form.price = String(nextForm.price || '');
  form.description = String(nextForm.description || '');
  form.tags = String(nextForm.tags || '');
  form.pressing = String(nextForm.pressing || '');
  form.jacketGrade = String(nextForm.jacketGrade || '');
  form.jacketScore = String(nextForm.jacketScore || '');
  form.analysisConfirmed = String(nextForm.analysisConfirmed || '');

  const nextImages = Array.isArray(nextDraft.images) ? nextDraft.images as string[] : [];
  jacketImage.value = nextImages[0] || '';
  recordImage.value = nextImages[1] || '';
  extraImages.value = nextImages.slice(2, 5);
  recordVideo.value = String(nextDraft.recordVideoDataUrl || '');
  goodAudioName.value = String(nextDraft.goodAudioFileName || '');
  noisyAudioName.value = String(nextDraft.noisyAudioFileName || '');
  audioAnalysis.value = (nextDraft.audioAnalysis as AudioAnalysisResult | null) || null;
  trackRecommendations.value = (nextDraft.trackRecommendations as TrackRecommendations | null) || null;
  jacketCondition.value = form.jacketGrade
    ? {
        score: Number(form.jacketScore || 0),
        grade: form.jacketGrade,
        cornerWear: 'low',
        ringWear: 'low',
        stainRisk: 'low',
        tearOrCreaseRisk: 'low',
        notes: ['이전에 적용된 자켓 분석 결과입니다.'],
      }
    : null;
  recordRecognition.value = recordMediaPreview.value
    ? await analyzeLpMedia(recordMediaPreview.value, recordImage.value ? 'image' : 'video')
    : recognizeLpImage('');
};

onMounted(async () => {
  const result = await store.loadDraftFromServer();
  if (result.persisted && result.draft) {
    await applyDraft(result.draft);
    draftSavedToDb.value = true;
    draftMessage.value = 'DB에 저장된 판매글 임시저장을 불러왔습니다.';
    setTimeout(() => { draftMessage.value = ''; }, 2200);
  }
});

onBeforeUnmount(() => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  clearRecordingTimer();
  cleanupRecordingStream();
  if (goodAudioUrl.value) URL.revokeObjectURL(goodAudioUrl.value);
  if (noisyAudioUrl.value) URL.revokeObjectURL(noisyAudioUrl.value);
});

const recommendPrice = () => {
  const catalog = form.catalogNumber.toLowerCase().trim();
  const title = form.title.toLowerCase().trim();
  const artist = form.artist.toLowerCase().trim();
  const matched = mockAlbums.find(album =>
    (catalog && album.catalogNumber.toLowerCase() === catalog) ||
    (title && album.title.toLowerCase().includes(title)) ||
    (artist && album.artist.toLowerCase().includes(artist))
  );
  const price = matched
    ? Math.round(((matched.priceRange.min + matched.priceRange.max) / 2) / 1000) * 1000
    : Math.round(mockAlbums.reduce((sum, album) => sum + album.price, 0) / mockAlbums.length / 1000) * 1000;

  form.price = String(price);
  priceMessage.value = matched
    ? `${matched.title} 시세 범위를 기준으로 ${price.toLocaleString()}원을 추천합니다.`
    : `일치하는 판본 데이터가 없어 전체 LP 평균가 기준 ${price.toLocaleString()}원을 임시 추천합니다.`;
};

const saveDraft = async (showAlert = true) => {
  if (draftSaving.value) return;
  draftSaving.value = true;
  const result = await store.saveDraftToServer(currentDraft());
  draftSavedToDb.value = result.persisted;
  draftMessage.value = result.message;
  draftSaving.value = false;
  if (showAlert) setTimeout(() => { draftMessage.value = ''; }, 2400);
};

const startAnalysisFromForm = async () => {
  if (!canStartAnalysis.value) return;
  await store.saveDraftToServer(currentDraft());
  router.push('/sell/analysis');
};

const publish = () => {
  if (!valid.value) {
    alert('마지막 단계에서 감정서를 확인한 뒤 게시할 수 있습니다.');
    return;
  }
  store.clearDraft();
  router.push('/sell/report');
};

const publishListingAction = async () => {
  if (!valid.value) {
    alert('감정서를 확인해야 게시할 수 있습니다.');
    return;
  }
  if (publishSaving.value) return;

  publishSaving.value = true;
  const tags = form.tags
    .replace(/,/g, ' ')
    .split(/\s+/)
    .map(tag => tag.trim())
    .filter(Boolean);
  const result = await store.publishListing({
    title: form.title.trim(),
    artist: form.artist.trim(),
    catalog_number: form.catalogNumber.trim(),
    price: Number(form.price),
    description: form.description.trim(),
    tags,
    images: currentImages(),
    audio_grade: audioAnalysis.value?.audioGrade,
    audio_score: audioAnalysis.value?.audioScore,
    jacket_grade: form.jacketGrade || undefined,
    jacket_score: form.jacketScore ? Number(form.jacketScore) : undefined,
    is_rare: tags.some(tag => tag.includes('희귀') || tag.toLowerCase().includes('rare')),
    is_first_press: form.pressing.includes('초반') || form.pressing.toLowerCase().includes('first'),
    analysis_report: {
      pressing: form.pressing,
      recordSurface: recordRecognition.value,
      audio: audioAnalysis.value,
      trackRecommendations: trackRecommendations.value,
    },
  });
  publishSaving.value = false;

  if (!result.ok) {
    alert(result.message);
    return;
  }
  store.clearDraft();
  router.push('/sell/report');
};

const PhotoSlot = defineComponent({
  props: {
    title: { type: String, required: true },
    help: { type: String, required: true },
    image: { type: String, default: '' },
  },
  emits: ['picked', 'clear'],
  setup(props, { emit }) {
    const onChange = (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) emit('picked', file);
    };
    return () => h('div', { class: 'relative aspect-square rounded-lg border-2 border-dashed overflow-hidden bg-gray-50' }, [
      props.image
        ? h('img', { src: props.image, alt: props.title, class: 'w-full h-full object-cover' })
        : h('label', { class: 'w-full h-full flex flex-col items-center justify-center cursor-pointer hover:border-blue-600' }, [
          h(Upload, { size: 24, class: 'mb-2 text-gray-400' }),
          h('span', { class: 'text-sm text-gray-700 text-center' }, props.title),
          h('span', { class: 'text-xs text-gray-500 mt-1 text-center' }, props.help),
          h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden', onChange }),
        ]),
      props.image
        ? h('button', {
          class: 'absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-xs',
          onClick: () => emit('clear'),
        }, '변경')
        : null,
    ]);
  },
});

const VideoSlot = defineComponent({
  props: {
    title: { type: String, required: true },
    help: { type: String, required: true },
    video: { type: String, default: '' },
  },
  emits: ['picked', 'clear'],
  setup(props, { emit }) {
    const onChange = (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) emit('picked', file);
    };
    return () => h('div', { class: 'relative aspect-square rounded-lg border-2 border-dashed overflow-hidden bg-gray-50' }, [
      props.video
        ? h('video', { src: props.video, controls: true, class: 'w-full h-full object-cover' })
        : h('label', { class: 'w-full h-full flex flex-col items-center justify-center cursor-pointer hover:border-blue-600' }, [
          h(Video, { size: 24, class: 'mb-2 text-gray-400' }),
          h('span', { class: 'text-sm text-gray-700 text-center' }, props.title),
          h('span', { class: 'text-xs text-gray-500 mt-1 text-center' }, props.help),
          h('input', { type: 'file', accept: 'video/*', capture: 'environment', class: 'hidden', onChange }),
        ]),
      props.video
        ? h('button', {
          class: 'absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-xs',
          onClick: () => emit('clear'),
        }, '변경')
        : null,
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
    return () => h('div', { class: 'rounded-lg border p-3 space-y-3 bg-white' }, [
      h('div', { class: 'flex items-center gap-3' }, [
        h('div', { class: ['w-10 h-10 rounded-full flex items-center justify-center shrink-0', props.isRecording ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'] }, [
          h(Mic, { size: 20 }),
        ]),
        h('div', { class: 'flex-1 min-w-0' }, [
          h('p', { class: 'text-sm truncate' }, props.name || props.description),
          h('p', { class: 'text-xs text-gray-500' }, props.isRecording ? `녹음 중 ${formatSeconds(props.seconds)}` : '앱에서 바로 녹음합니다.'),
        ]),
        props.isRecording
          ? h('button', {
            type: 'button',
            class: 'px-3 py-2 rounded-lg bg-red-600 text-white text-xs',
            onClick: () => emit('stop'),
          }, '정지')
          : h('button', {
            type: 'button',
            class: 'px-3 py-2 rounded-lg bg-blue-600 text-white text-xs',
            onClick: () => emit('start'),
          }, props.name ? '다시 녹음' : '녹음'),
      ]),
      props.url
        ? h('div', { class: 'space-y-2' }, [
          h('audio', { src: props.url, controls: true, class: 'w-full' }),
          h('button', {
            type: 'button',
            class: 'text-xs text-gray-500 underline',
            onClick: () => emit('clear'),
          }, '녹음 삭제'),
        ])
        : null,
    ]);
  },
});
</script>
