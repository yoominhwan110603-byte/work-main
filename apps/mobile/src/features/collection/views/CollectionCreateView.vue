<template>
  <main class="flex size-full flex-col bg-gray-50 text-gray-900">
    <header class="shrink-0 border-b bg-white px-3 py-3 sm:px-4">
      <div class="flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2">
          <button type="button" class="shrink-0 rounded-full p-2 active:bg-gray-100" aria-label="뒤로 가기" @click="goBack">
            <ArrowLeft :size="24" />
          </button>
          <h1 class="truncate text-lg font-semibold">{{ editingId ? '컬렉션 수정' : '컬렉션 만들기' }}</h1>
        </div>
        <button
          type="button"
          :disabled="!valid || saving"
          :class="['shrink-0 rounded-lg px-3 py-2 text-sm', valid && !saving ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400']"
          @click="saveCollection"
        >
          {{ saving ? '저장 중' : '저장' }}
        </button>
      </div>
    </header>

    <section class="flex-1 space-y-5 overflow-y-auto px-3 py-4 pb-8 sm:p-4 sm:pb-8">
      <section ref="discogsSection" class="space-y-3 rounded-lg border bg-white p-3">
        <div>
          <h2 class="text-base font-medium">Discogs 앨범 찾기</h2>
          <p class="mt-1 text-xs text-gray-500">앨범명이나 카탈로그 번호를 검색하고 실제 보유한 발매반을 선택하세요.</p>
        </div>
        <div>
          <label class="mb-2 block text-sm">앨범명 *</label>
          <input ref="titleInput" v-model="form.title" class="w-full rounded-lg border px-4 py-3" placeholder="예: Kind of Blue" @input="clearDiscogsSelection" />
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="mb-2 block text-sm">아티스트</label>
            <input v-model="form.artist" class="w-full rounded-lg border px-4 py-3" placeholder="예: Miles Davis" @input="clearDiscogsSelection" />
          </div>
          <div>
            <label class="mb-2 block text-sm">카탈로그 번호</label>
            <input v-model="form.catalogNumber" class="w-full rounded-lg border px-4 py-3" placeholder="예: CS 8163" @input="clearDiscogsSelection" />
          </div>
        </div>
        <button
          type="button"
          class="w-full rounded-lg border border-blue-600 py-3 text-sm text-blue-600 disabled:border-gray-200 disabled:text-gray-400"
          :disabled="discogsSearching || (!form.title.trim() && !form.catalogNumber.trim())"
          @click="searchDiscogs"
        >
          {{ discogsSearching ? 'Discogs 검색 중' : 'Discogs에서 발매반 검색' }}
        </button>
        <p v-if="discogsMessage" class="text-xs text-gray-500">{{ discogsMessage }}</p>
        <div v-if="discogsCandidates.length" class="space-y-2 rounded-lg bg-gray-50 p-2">
          <button
            v-for="candidate in discogsCandidates"
            :key="candidate.id"
            type="button"
            class="flex w-full gap-3 rounded-lg border bg-white p-2 text-left active:bg-blue-50 disabled:opacity-50"
            :disabled="!candidate.coverImageUrl"
            @click="applyDiscogsCandidate(candidate)"
          >
            <VinylCover :src="candidate.coverImageUrl" :alt="candidate.title" class="h-16 w-16 shrink-0 rounded object-cover" />
            <span class="min-w-0 text-sm">
              <strong class="block truncate">{{ candidate.title }}</strong>
              <span class="block truncate text-gray-500">{{ candidate.artist }}</span>
              <span class="block truncate text-xs text-gray-400">{{ candidate.label }} · {{ candidate.country }} · {{ candidate.year || '-' }}</span>
              <span v-if="!candidate.coverImageUrl" class="mt-1 block text-xs text-red-500">커버 이미지가 없는 발매반입니다.</span>
            </span>
          </button>
        </div>

        <div class="rounded-lg border border-orange-100 bg-orange-50/60 p-3">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-medium">컬렉션 앨범 커버</p>
              <p class="mt-1 text-xs text-gray-500">직접 촬영하지 않고 Discogs 이미지만 사용합니다.</p>
            </div>
            <span class="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-orange-700">Discogs</span>
          </div>
          <div v-if="form.discogsCoverImageUrl" class="flex items-center gap-3">
            <VinylCover :src="form.discogsCoverImageUrl" :alt="form.title" class="h-24 w-24 shrink-0 rounded-lg object-cover shadow-sm" />
            <div class="min-w-0">
              <strong class="block truncate text-sm">{{ form.title }}</strong>
              <span class="mt-1 block truncate text-xs text-gray-500">{{ form.artist }}</span>
              <span class="mt-2 block text-xs text-orange-700">Discogs Release #{{ form.discogsReleaseId }}</span>
            </div>
          </div>
          <button v-else type="button" class="w-full rounded-lg border border-dashed border-orange-300 bg-white/60 px-4 py-5 text-sm text-orange-800" @click="focusDiscogsSearch">
            검색 결과에서 정확한 발매반을 선택해 주세요.
          </button>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label class="mb-2 block text-sm">발매 연도</label>
            <input v-model="form.year" type="number" inputmode="numeric" class="w-full rounded-lg border px-4 py-3" placeholder="1959" />
          </div>
          <div>
            <label class="mb-2 block text-sm">장르</label>
            <input v-model="form.genre" class="w-full rounded-lg border px-4 py-3" placeholder="재즈" />
          </div>
          <div>
            <label class="mb-2 block text-sm">공개 여부</label>
            <select v-model="form.visibility" class="w-full rounded-lg border bg-white px-4 py-3">
              <option value="public">공개</option>
              <option value="private">비공개</option>
            </select>
          </div>
        </div>
        <div v-if="form.releaseLabel || form.releaseCountry" class="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          <p>{{ form.releaseLabel || '레이블 미상' }} · {{ form.releaseCountry || '국가 미상' }}</p>
          <p class="mt-1 text-xs text-blue-700">{{ form.pressingInfo || '프레싱 정보 확인 필요' }}</p>
        </div>
      </section>

      <section class="space-y-3 rounded-lg border bg-white p-3">
        <h2 class="text-base font-medium">상태와 메모</h2>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="mb-2 block text-sm">보유 상태</label>
            <select v-model="form.ownershipStatus" class="w-full rounded-lg border bg-white px-4 py-3">
              <option value="owned">보유 중</option>
              <option value="reserved">판매 예약</option>
              <option value="lent">대여 중</option>
              <option value="sold">판매 완료</option>
            </select>
          </div>
          <div>
            <label class="mb-2 block text-sm">구매 가격</label>
            <input v-model="form.purchasePrice" type="number" inputmode="numeric" min="0" class="w-full rounded-lg border px-4 py-3" placeholder="원 단위" />
          </div>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="mb-2 block text-sm">음반 등급</label>
            <select v-model="form.audioGrade" class="w-full rounded-lg border bg-white px-4 py-3">
              <option value="">선택 안 함</option>
              <option v-for="grade in grades" :key="grade" :value="grade">{{ grade }}</option>
            </select>
          </div>
          <div>
            <label class="mb-2 block text-sm">음반 점수</label>
            <input v-model="form.audioScore" type="number" inputmode="numeric" min="0" max="100" class="w-full rounded-lg border px-4 py-3" placeholder="88" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <label class="flex items-center gap-2 rounded-lg border px-3 py-3 text-sm">
            <input v-model="form.isRare" type="checkbox" />
            <span>희귀반</span>
          </label>
          <label class="flex items-center gap-2 rounded-lg border px-3 py-3 text-sm">
            <input v-model="form.isFirstPress" type="checkbox" />
            <span>초반 추정</span>
          </label>
        </div>
        <div>
          <label class="mb-2 block text-sm">메모</label>
          <textarea v-model="form.notes" class="min-h-32 w-full rounded-lg border px-4 py-3" placeholder="보관 상태나 개인 메모를 남겨 주세요." />
        </div>
        <div>
          <label class="mb-2 block text-sm">태그</label>
          <input v-model="form.tags" class="w-full rounded-lg border px-4 py-3" placeholder="#재즈 #초반 #소장반" />
        </div>
      </section>

      <section class="space-y-3 rounded-lg border bg-white p-3">
        <div>
          <h2 class="text-base font-medium">실물 음반 사진</h2>
          <p class="mt-1 text-xs text-gray-500">음반 상태 기록용 선택 항목입니다. 컬렉션 표지에는 노출되지 않습니다.</p>
        </div>
        <RecordImagePicker :preview="recordImage" @picked="setRecordImage" @clear="clearRecordImage" />
      </section>

      <section class="space-y-3 rounded-lg border bg-white p-3">
        <h2 class="text-base font-medium">샘플 녹음</h2>
        <AudioPicker label="좋은 구간" :sample="goodSample" @picked="file => setAudio('good', file)" @clear="clearAudio('good')" />
        <AudioPicker label="확인 구간" :sample="noisySample" @picked="file => setAudio('noisy', file)" @clear="clearAudio('noisy')" />
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, reactive, ref, type PropType } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Disc3, Music, Upload, X } from 'lucide-vue-next';
import { createPressingInfo, fetchDiscogsCandidates, type AlbumCandidate } from '@/features/seller/services/discogs';
import type { CollectionAudioSample, CollectionCreatePayload } from '@/shared/models/collection';
import VinylCover from '@/shared/components/VinylCover.vue';
import { useAppStore } from '@/shared/stores/appStore';

const router = useRouter();
const route = useRoute();
const store = useAppStore();
const editingId = computed(() => String(route.params.id || ''));
const grades = ['NM', 'VG+', 'VG', 'G+', 'G'];
const saving = ref(false);
const discogsSearching = ref(false);
const discogsMessage = ref('');
const discogsCandidates = ref<AlbumCandidate[]>([]);
const discogsSection = ref<HTMLElement | null>(null);
const titleInput = ref<HTMLInputElement | null>(null);
const recordImage = ref('');
const goodSample = ref<CollectionAudioSample | null>(null);
const noisySample = ref<CollectionAudioSample | null>(null);

const form = reactive({
  title: '', artist: '', catalogNumber: '', discogsReleaseId: 0, discogsCoverImageUrl: '',
  releaseLabel: '', releaseCountry: '', pressingInfo: '', year: '', genre: '',
  ownershipStatus: 'owned' as CollectionCreatePayload['ownershipStatus'], purchasePrice: '',
  visibility: 'public' as CollectionCreatePayload['visibility'], audioGrade: '', audioScore: '',
  isRare: false, isFirstPress: false, notes: '', tags: '',
});

const valid = computed(() => form.title.trim().length > 0 && form.discogsReleaseId > 0 && Boolean(form.discogsCoverImageUrl.trim()));

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const readAudioDuration = (file: File) => new Promise<number>((resolve) => {
  const audio = document.createElement('audio');
  const url = URL.createObjectURL(file);
  audio.onloadedmetadata = () => {
    const duration = Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0;
    URL.revokeObjectURL(url);
    resolve(duration);
  };
  audio.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
  audio.src = url;
});

const tagList = () => form.tags.replace(/,/g, ' ').split(/\s+/).map(tag => tag.trim()).filter(Boolean);

const goBack = () => {
  if (window.history.length > 1) router.back();
  else router.push('/app');
};

const clearDiscogsSelection = () => {
  if (!form.discogsReleaseId && !form.discogsCoverImageUrl) return;
  form.discogsReleaseId = 0;
  form.discogsCoverImageUrl = '';
  form.releaseLabel = '';
  form.releaseCountry = '';
  form.pressingInfo = '';
  discogsMessage.value = '앨범 정보가 바뀌었습니다. Discogs 발매반을 다시 선택해 주세요.';
};

const focusDiscogsSearch = () => {
  discogsSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.setTimeout(() => titleInput.value?.focus(), 250);
};

const searchDiscogs = async () => {
  if (discogsSearching.value) return;
  discogsSearching.value = true;
  discogsMessage.value = '';
  try {
    const result = await fetchDiscogsCandidates(form.catalogNumber, form.title, form.artist);
    discogsCandidates.value = result.candidates;
    discogsMessage.value = result.candidates.length
      ? `${result.candidates.length}개의 발매반을 찾았습니다. 실제 보유한 버전을 선택해 주세요.`
      : '일치하는 발매반을 찾지 못했습니다. 검색어를 바꿔 다시 시도해 주세요.';
  } catch (error) {
    discogsMessage.value = error instanceof Error ? error.message : 'Discogs 검색에 실패했습니다.';
  } finally {
    discogsSearching.value = false;
  }
};

const applyDiscogsCandidate = (candidate: AlbumCandidate) => {
  if (!candidate.coverImageUrl || !candidate.releaseId) return;
  const pressing = createPressingInfo(candidate);
  form.title = candidate.title;
  form.artist = candidate.artist;
  form.year = candidate.year ? String(candidate.year) : '';
  form.catalogNumber = candidate.catalogNumber;
  form.discogsReleaseId = candidate.releaseId;
  form.discogsCoverImageUrl = candidate.coverImageUrl;
  form.releaseLabel = candidate.label;
  form.releaseCountry = candidate.country;
  form.pressingInfo = pressing.pressing;
  discogsCandidates.value = [];
  discogsMessage.value = '선택한 Discogs 발매반과 커버를 적용했습니다.';
};

const setRecordImage = async (file: File) => { recordImage.value = await readFileAsDataUrl(file); };
const clearRecordImage = () => { recordImage.value = ''; };

const setAudio = async (kind: 'good' | 'noisy', file: File) => {
  const dataUrl = await readFileAsDataUrl(file);
  const fallbackDuration = kind === 'good' ? 20 : 15;
  const durationSeconds = await readAudioDuration(file) || fallbackDuration;
  const sample: CollectionAudioSample = {
    name: file.name, dataUrl, durationSeconds, startSeconds: 0, endSeconds: durationSeconds, recordedAt: new Date().toISOString(),
  };
  if (kind === 'good') goodSample.value = sample;
  else noisySample.value = sample;
};

const clearAudio = (kind: 'good' | 'noisy') => {
  if (kind === 'good') goodSample.value = null;
  else noisySample.value = null;
};

const saveCollection = async () => {
  if (!valid.value || saving.value) return;
  saving.value = true;
  const payload: CollectionCreatePayload = {
    title: form.title.trim(), artist: form.artist.trim(), year: Number(form.year) || 0,
    genre: form.genre.trim() || '기타', catalogNumber: form.catalogNumber.trim(),
    discogsReleaseId: form.discogsReleaseId, discogsCoverImageUrl: form.discogsCoverImageUrl,
    releaseLabel: form.releaseLabel || undefined, releaseCountry: form.releaseCountry || undefined,
    pressingInfo: form.pressingInfo || undefined, ownershipStatus: form.ownershipStatus,
    purchasePrice: Number(form.purchasePrice) || undefined, notes: form.notes.trim() || '개인 컬렉션 메모입니다.',
    tags: tagList(), images: [form.discogsCoverImageUrl, recordImage.value].filter(Boolean),
    coverImageDataUrl: undefined, recordImageDataUrl: recordImage.value || undefined,
    audioGrade: form.audioGrade || undefined, audioScore: Number(form.audioScore) || undefined,
    isRare: form.isRare, isFirstPress: form.isFirstPress,
    audioSamples: {
      ...(goodSample.value ? { good: goodSample.value } : {}),
      ...(noisySample.value ? { noisy: noisySample.value } : {}),
    },
    visibility: form.visibility,
  };
  const result = await store.saveCollection(payload, editingId.value);
  saving.value = false;
  if (!result.ok || !result.collection) {
    alert(result.message || '컬렉션 저장에 실패했습니다.');
    return;
  }
  router.push(`/collection/${result.collection.id}`);
};

onMounted(() => {
  if (!editingId.value) return;
  const collection = store.collections.find(item => item.id === editingId.value);
  if (!collection || collection.owner.id !== store.user.id) {
    router.replace('/app/profile');
    return;
  }
  Object.assign(form, {
    title: collection.title, artist: collection.artist, catalogNumber: collection.catalogNumber,
    discogsReleaseId: collection.discogsReleaseId || 0, discogsCoverImageUrl: collection.discogsCoverImageUrl || '',
    releaseLabel: collection.releaseLabel || '', releaseCountry: collection.releaseCountry || '',
    pressingInfo: collection.pressingInfo || '', year: collection.year ? String(collection.year) : '',
    genre: collection.genre, ownershipStatus: collection.ownershipStatus || 'owned',
    purchasePrice: collection.purchasePrice ? String(collection.purchasePrice) : '', visibility: collection.visibility,
    audioGrade: collection.audioGrade || '', audioScore: collection.audioScore ? String(collection.audioScore) : '',
    isRare: collection.isRare, isFirstPress: collection.isFirstPress, notes: collection.notes, tags: collection.tags.join(' '),
  });
  recordImage.value = collection.recordImageDataUrl || '';
  goodSample.value = collection.audioSamples?.good || null;
  noisySample.value = collection.audioSamples?.noisy || null;
});

const RecordImagePicker = defineComponent({
  props: { preview: { type: String, default: '' } },
  emits: ['picked', 'clear'],
  setup(props, { emit }) {
    const onChange = (event: Event) => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      if (file) emit('picked', file);
      input.value = '';
    };
    return () => h('div', { class: 'relative aspect-square max-w-sm overflow-hidden rounded-lg border-2 border-dashed bg-gray-50' }, [
      props.preview
        ? h('img', { src: props.preview, alt: '실물 음반 상태', class: 'h-full w-full object-cover' })
        : h('label', { class: 'flex h-full w-full cursor-pointer flex-col items-center justify-center px-3 text-center' }, [
            h(Disc3, { size: 28, class: 'mb-2 text-gray-400' }),
            h('span', { class: 'text-sm text-gray-700' }, '실물 음반 상태 사진 추가'),
            h('span', { class: 'mt-1 text-xs text-gray-400' }, '앨범 커버로는 사용되지 않습니다.'),
            h(Upload, { size: 18, class: 'mt-3 text-blue-500' }),
            h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden', onChange }),
          ]),
      props.preview
        ? h('button', { type: 'button', 'aria-label': '음반 사진 삭제', class: 'absolute right-2 top-2 rounded bg-black/60 p-1.5 text-white', onClick: () => emit('clear') }, [h(X, { size: 16 })])
        : null,
    ]);
  },
});

const AudioPicker = defineComponent({
  props: {
    label: { type: String, required: true },
    sample: { type: Object as PropType<CollectionAudioSample | null>, default: null },
  },
  emits: ['picked', 'clear'],
  setup(props, { emit }) {
    const onChange = (event: Event) => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      if (file) emit('picked', file);
      input.value = '';
    };
    const recordedDate = () => props.sample?.recordedAt ? new Date(props.sample.recordedAt).toLocaleDateString('ko-KR') : '';
    return () => h('div', { class: 'rounded-lg border p-3' }, [
      h('div', { class: 'flex items-center gap-3' }, [
        h('div', { class: 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600' }, [h(Music, { size: 19 })]),
        h('div', { class: 'min-w-0 flex-1' }, [
          h('p', { class: 'truncate text-sm font-medium' }, props.label),
          h('p', { class: 'truncate text-xs text-gray-500' }, props.sample ? `${props.sample.name} · ${recordedDate()} 녹음` : '오디오 파일 선택'),
        ]),
        props.sample
          ? h('button', { type: 'button', class: 'rounded-lg px-3 py-2 text-xs text-red-600', onClick: () => emit('clear') }, '삭제')
          : h('label', { class: 'rounded-lg bg-blue-600 px-3 py-2 text-xs text-white' }, [
              '선택', h('input', { type: 'file', accept: 'audio/*', class: 'hidden', onChange }),
            ]),
      ]),
      props.sample?.dataUrl ? h('audio', { src: props.sample.dataUrl, controls: true, class: 'mt-3 w-full' }) : null,
    ]);
  },
});
</script>
