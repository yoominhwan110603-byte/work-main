<template>
  <div class="space-y-4">
    <section v-if="own" class="space-y-4 rounded-lg border bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-medium">위시리스트 알림</h2>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">앨범명/아티스트로 상위 10개 앨범을 보고, LP 특징을 골라 등록합니다.</p>
        </div>
        <span class="shrink-0 text-2xl leading-none" aria-hidden="true">🙏</span>
      </div>

      <div v-if="!store.isLoggedIn" class="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
        로그인 후 위시리스트 알림을 등록할 수 있습니다.
      </div>

      <form v-else class="space-y-3" @submit.prevent="saveWishlist">
        <div>
          <label class="mb-2 block text-sm">앨범명</label>
          <input v-model="form.title" type="text" class="w-full rounded-lg border bg-white px-4 py-3 dark:border-neutral-700 dark:bg-neutral-950" placeholder="예: Kind of Blue" />
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="mb-2 block text-sm">아티스트</label>
            <input v-model="form.artist" type="text" class="w-full rounded-lg border bg-white px-4 py-3 dark:border-neutral-700 dark:bg-neutral-950" placeholder="예: Miles Davis" />
          </div>
          <div>
            <label class="mb-2 block text-sm">카탈로그 번호</label>
            <input v-model="form.catalogNumber" type="text" class="w-full rounded-lg border bg-white px-4 py-3 dark:border-neutral-700 dark:bg-neutral-950" placeholder="예: CS 8163" />
          </div>
        </div>
        <button
          type="button"
          :disabled="!lookupReady() || loadingVersions"
          class="w-full rounded-lg border border-blue-600 py-2.5 text-sm text-blue-600 disabled:border-gray-200 disabled:text-gray-400 dark:disabled:border-neutral-800"
          @click="lookupDiscogs"
        >
          {{ loadingVersions ? 'LP 판본을 불러오는 중' : 'LP 판본 검색' }}
        </button>

        <p v-if="lookupMessage" :class="['rounded-lg p-3 text-xs', lookupError ? 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200' : 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200']">
          {{ lookupMessage }}
        </p>

        <div v-if="candidates.length > 1" class="divide-y rounded-lg border dark:divide-neutral-800 dark:border-neutral-700">
          <button v-for="candidate in candidates" :key="candidate.id" type="button" class="flex w-full gap-3 p-3 text-left active:bg-gray-50 dark:active:bg-neutral-800" @click="applyCandidate(candidate)">
            <VinylCover :src="candidate.coverImageUrl" :alt="candidate.title" class="h-16 w-16 shrink-0 rounded object-cover" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium">{{ candidate.title }}</span>
              <span class="mt-1 block truncate text-xs text-gray-500">{{ candidate.artist }} · {{ candidate.year || '연도 미상' }}</span>
              <span class="mt-1 block truncate text-xs text-gray-500">{{ candidateFeatureSummary(candidate) }}</span>
            </span>
          </button>
        </div>

        <section v-if="albumMatches.length && !selectedAlbum" class="space-y-2 rounded-lg border p-3 dark:border-neutral-700">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-sm font-medium">상위 10개 앨범 중 선택해 주세요</h3>
            <span class="text-xs text-gray-500">{{ albumMatches.length }}개 표시 / 전체 {{ albumTotal.toLocaleString() }}개</span>
          </div>
          <div class="divide-y dark:divide-neutral-800">
            <button v-for="(album, index) in albumMatches" :key="album.masterId" type="button" class="flex w-full gap-3 py-3 text-left active:bg-gray-50 dark:active:bg-neutral-800" @click="selectAlbum(album)">
              <VinylCover :src="album.coverImageUrl" :alt="album.title" class="h-16 w-16 shrink-0 rounded object-cover" />
              <span class="min-w-0 flex-1">
                <span class="flex min-w-0 items-center gap-2">
                  <span class="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600 dark:bg-neutral-800 dark:text-neutral-300">#{{ index + 1 }}</span>
                  <span class="truncate text-sm font-medium">{{ album.title }}</span>
                </span>
                <span class="mt-1 block truncate text-xs text-gray-500">{{ album.artist }} · {{ album.year || '연도 미상' }}</span>
                <span class="mt-1 block truncate text-xs text-gray-500">{{ albumSearchFeatureSummary(album) }}</span>
                <span class="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                  <span v-for="feature in albumSearchFeatures(album)" :key="`${album.masterId}-${feature}`" class="rounded bg-gray-100 px-2 py-1 text-gray-700 dark:bg-neutral-800 dark:text-gray-200">{{ feature }}</span>
                </span>
              </span>
            </button>
          </div>
        </section>

        <section v-if="selectedAlbum" class="space-y-3 rounded-lg border p-3 dark:border-neutral-700">
          <div class="flex items-center gap-3">
            <VinylCover :src="selectedAlbum.coverImageUrl" :alt="selectedAlbum.title" class="h-14 w-14 shrink-0 rounded object-cover" />
            <div class="min-w-0 flex-1">
              <h3 class="truncate text-sm font-medium">{{ selectedAlbum.title }}</h3>
              <p class="mt-1 truncate text-xs text-gray-500">{{ selectedAlbum.artist }}</p>
            </div>
            <button type="button" class="shrink-0 text-xs text-blue-600" @click="clearAlbumSelection">앨범 변경</button>
          </div>

          <p v-if="loadingVersions" class="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500 dark:bg-neutral-800">LP 판본을 정리하는 중입니다.</p>

          <div v-if="representativeVersions.length" class="space-y-2">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium">대표 판본 5</h3>
              <span class="text-xs text-gray-500">전체 {{ versionTotal.toLocaleString() }}개</span>
            </div>
            <div class="divide-y rounded-lg border dark:divide-neutral-800 dark:border-neutral-700">
              <button v-for="candidate in representativeVersions" :key="candidate.id" type="button" class="flex w-full gap-3 p-3 text-left active:bg-gray-50 dark:active:bg-neutral-800" @click="applyCandidate(candidate)">
                <VinylCover :src="candidate.coverImageUrl" :alt="candidate.title" class="h-16 w-16 shrink-0 rounded object-cover" />
                <span class="min-w-0 flex-1">
                  <span class="flex min-w-0 items-center gap-2">
                    <span class="truncate text-sm font-medium">{{ candidate.year || '연도 미상' }} · {{ candidate.country }}</span>
                    <span class="shrink-0 rounded bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700 dark:bg-blue-950 dark:text-blue-200">{{ candidate.representativeReason }}</span>
                  </span>
                  <span class="mt-1 block truncate text-xs text-gray-500">{{ candidateFeatureSummary(candidate) }}</span>
                  <span class="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                    <span>소장 {{ (candidate.communityHave || 0).toLocaleString() }}</span>
                    <span>위시 {{ (candidate.communityWant || 0).toLocaleString() }}</span>
                  </span>
                </span>
              </button>
            </div>
          </div>

          <div v-if="additionalVersions.length" class="space-y-2">
            <h3 class="text-sm font-medium">다른 판본</h3>
            <div class="divide-y rounded-lg border dark:divide-neutral-800 dark:border-neutral-700">
              <button v-for="candidate in additionalVersions" :key="candidate.id" type="button" class="flex w-full gap-3 p-3 text-left active:bg-gray-50 dark:active:bg-neutral-800" @click="applyCandidate(candidate)">
                <VinylCover :src="candidate.coverImageUrl" :alt="candidate.title" class="h-16 w-16 shrink-0 rounded object-cover" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">{{ candidate.year || '연도 미상' }} · {{ candidate.country }}</span>
                  <span class="mt-1 block truncate text-xs text-gray-500">{{ candidateFeatureSummary(candidate) }}</span>
                  <span class="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                    <span>소장 {{ (candidate.communityHave || 0).toLocaleString() }}</span>
                    <span>위시 {{ (candidate.communityWant || 0).toLocaleString() }}</span>
                  </span>
                </span>
              </button>
            </div>
          </div>

          <p v-if="versionPartial" class="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">Discogs 응답이 중단되어 일부 판본만 표시했습니다.</p>
          <button v-if="versionPartial" type="button" :disabled="loadingVersions" class="rounded-lg border px-4 py-2.5 text-sm dark:border-neutral-700" @click="retryVersions">재시도</button>
        </section>

        <div v-if="selectedRelease" class="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950">
          <VinylCover :src="selectedRelease.coverImageUrl" :alt="selectedRelease.title" class="h-20 w-20 shrink-0 rounded object-cover" />
          <div class="min-w-0 flex-1 text-sm">
            <p class="truncate font-medium text-blue-950 dark:text-blue-100">{{ selectedRelease.title }}</p>
            <p class="mt-1 truncate text-xs text-blue-800 dark:text-blue-200">{{ selectedRelease.artist }}</p>
            <p class="mt-2 text-xs text-blue-700 dark:text-blue-300">{{ selectedRelease.year || '연도 미상' }} · {{ selectedRelease.country }} · {{ selectedRelease.label }}</p>
            <p class="mt-1 text-xs text-blue-700 dark:text-blue-300">특징 {{ candidateFeatureSummary(selectedRelease) }}</p>
          </div>
        </div>

        <label class="flex items-center justify-between gap-3 rounded-lg border p-3 dark:border-neutral-700">
          <span>
            <span class="block text-sm">프로필에 공개</span>
            <span class="mt-1 block text-xs text-gray-500">공개한 항목만 다른 사용자가 볼 수 있습니다.</span>
          </span>
          <input v-model="form.isPublic" type="checkbox" class="h-5 w-5 accent-blue-600" />
        </label>

        <div class="flex gap-2">
          <button v-if="editingId" type="button" class="flex-1 rounded-lg border py-3 text-sm dark:border-neutral-700" @click="resetForm">취소</button>
          <button type="submit" :disabled="!formValid || saving" :class="['flex flex-1 items-center justify-center gap-2 rounded-lg py-3', formValid && !saving ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400 dark:bg-neutral-800']">
            <span aria-hidden="true">🙏</span>{{ saving ? '저장 중' : editingId ? '수정 저장' : '알림 등록' }}
          </button>
        </div>
      </form>

      <p class="text-[11px] text-gray-400">Data provided by Discogs</p>
      <p v-if="actionMessage" :class="['text-sm', actionError ? 'text-amber-600' : 'text-blue-600']">{{ actionMessage }}</p>
    </section>

    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-medium">{{ own ? '등록한 위시리스트' : '공개 위시리스트' }}</h2>
        <span class="text-xs text-gray-500">{{ items.length }}개</span>
      </div>
      <div v-if="loading" class="rounded-lg border bg-white p-6 text-center text-sm text-gray-500 dark:border-neutral-800 dark:bg-neutral-900">위시리스트를 불러오는 중입니다.</div>
      <template v-else>
      <article v-for="item in items" :key="item.id" class="rounded-lg border bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div class="flex items-start gap-3">
          <VinylCover :src="item.coverImageUrl" :alt="item.title" class="h-20 w-20 shrink-0 rounded object-cover" />
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <h3 class="truncate font-medium">{{ item.title || '앨범 조건' }}</h3>
                <p v-if="item.artist" class="mt-1 truncate text-sm text-gray-600 dark:text-gray-300">{{ item.artist }}</p>
              </div>
              <div v-if="own" class="flex shrink-0">
                <button class="p-2 text-gray-500" aria-label="위시리스트 수정" @click="editWishlist(item)"><Pencil :size="17" /></button>
                <button class="p-2 text-gray-500" aria-label="위시리스트 삭제" @click="deleteWishlist(item)"><Trash2 :size="17" /></button>
              </div>
            </div>
            <div class="mt-2 flex flex-wrap gap-2 text-xs">
              <span v-for="feature in wishlistItemFeatures(item)" :key="`${item.id}-${feature}`" class="rounded bg-gray-100 px-2 py-1 text-gray-700 dark:bg-neutral-800 dark:text-gray-200">{{ feature }}</span>
              <span v-if="own" :class="['rounded px-2 py-1', item.visibility === 'public' ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200' : 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-300']">{{ item.visibility === 'public' ? '공개' : '비공개' }}</span>
              <span v-if="own" class="rounded bg-blue-50 px-2 py-1 text-blue-700 dark:bg-blue-950 dark:text-blue-200">현재 판매 {{ (matches[item.id] || []).length }}건</span>
            </div>
          </div>
        </div>

        <div v-if="own && (matches[item.id] || []).length" class="mt-3 divide-y border-t dark:divide-neutral-800 dark:border-neutral-800">
          <button v-for="album in (matches[item.id] || []).slice(0, 3)" :key="album.id" class="flex w-full items-center gap-3 py-3 text-left" @click="router.push(`/app/album/${album.id}`)">
            <VinylCover :src="album.images[0] || album.discogsCoverImageUrl" :alt="album.title" class="h-12 w-12 shrink-0 rounded object-cover" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm">{{ album.title }}</span>
              <span class="mt-1 block text-xs text-gray-500">{{ album.price.toLocaleString() }}원 · {{ album.audioGrade }}</span>
            </span>
          </button>
          <button v-if="(matches[item.id] || []).length > 3" class="w-full py-3 text-sm text-blue-600" @click="openAllMatches(item)">전체 판매 상품 보기</button>
        </div>
        <p class="mt-3 text-xs text-gray-400">{{ formatDate(item.createdAt) }} 등록</p>
      </article>
      </template>
      <div v-if="!loading && items.length === 0" class="rounded-lg border bg-white p-8 text-center text-gray-500 dark:border-neutral-800 dark:bg-neutral-900">
        {{ own ? '등록한 위시리스트 알림이 없습니다' : '공개한 위시리스트가 없습니다' }}
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Pencil, Trash2 } from 'lucide-vue-next';
import {
  createPressingInfo,
  fetchDiscogsCandidates,
  fetchRepresentativeVersions,
  searchDiscogsAlbums,
  type AlbumCandidate,
  type DiscogsAlbumSummary,
} from '@/features/seller/services/discogs';
import type { Album, WishlistItem } from '@/shared/models/market';
import { addWishlistItem, fetchPublicWishlist, fetchWishlistMatches, removeWishlistItem, updateWishlistItem } from '@/shared/services/market';
import { useAppStore } from '@/shared/stores/appStore';
import VinylCover from '@/shared/components/VinylCover.vue';

const props = defineProps<{ ownerId: string; own: boolean }>();
const router = useRouter();
const store = useAppStore();
const items = ref<WishlistItem[]>([]);
const matches = ref<Record<string, Album[]>>({});
const candidates = ref<AlbumCandidate[]>([]);
const albumMatches = ref<DiscogsAlbumSummary[]>([]);
const selectedAlbum = ref<DiscogsAlbumSummary | null>(null);
const representativeVersions = ref<AlbumCandidate[]>([]);
const additionalVersions = ref<AlbumCandidate[]>([]);
const selectedRelease = ref<AlbumCandidate | null>(null);
const loading = ref(false);
const saving = ref(false);
const loadingVersions = ref(false);
const lookupMessage = ref('');
const lookupError = ref(false);
const actionMessage = ref('');
const actionError = ref(false);
const editingId = ref('');
const form = reactive({ title: '', artist: '', catalogNumber: '', isPublic: false });
const albumTotal = ref(0);
const albumQueryTitle = ref('');
const albumQueryArtist = ref('');
const versionTotal = ref(0);
const versionPartial = ref(false);
let lookupTimer: number | null = null;
let lookupRequest = 0;
let versionRequest = 0;
let applyingCandidate = false;

const compactFeatureText = (value: unknown) => String(value || '').trim().replace(/\s+/g, ' ');
const countryFeature = (value: unknown) => {
  const text = compactFeatureText(value);
  const normalized = text.toUpperCase();
  const map: Record<string, string> = {
    US: '미국반',
    USA: '미국반',
    UK: '영국반',
    GB: '영국반',
    JP: '일본반',
    JAPAN: '일본반',
    KR: '국내반',
    KOREA: '국내반',
    'SOUTH KOREA': '국내반',
    DE: '독일반',
    GERMANY: '독일반',
    FR: '프랑스반',
    FRANCE: '프랑스반',
    EU: 'EU반',
  };
  return map[normalized] || (text ? `${text}반` : '');
};
const uniqueFeatureParts = (parts: Array<string | undefined | null>) => {
  const seen = new Set<string>();
  return parts
    .map(compactFeatureText)
    .filter(part => {
      const normalized = part.toLocaleLowerCase('ko-KR');
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
};
const communityFeature = (have = 0, want = 0) => {
  if (want >= 1000) return '위시 많은 LP';
  if (have >= 1000) return '소장 인기 LP';
  if (want > have && want > 0) return '수요 우세';
  if (have > 0 || want > 0) return 'Discogs 기록 있음';
  return '정보 확인 필요';
};
const albumSearchFeatures = (album: DiscogsAlbumSummary) => uniqueFeatureParts([
  album.exactMatch ? '정확도 높음' : '연관 앨범',
  album.year ? `${album.year}년 발매` : '연도 미상',
  communityFeature(album.communityHave, album.communityWant),
  album.communityHave ? `소장 ${album.communityHave.toLocaleString()}` : '',
  album.communityWant ? `위시 ${album.communityWant.toLocaleString()}` : '',
]).slice(0, 4);
const albumSearchFeatureSummary = (album: DiscogsAlbumSummary) => albumSearchFeatures(album).join(' · ') || '앨범 특징 확인';
const candidateFeatureSummary = (candidate: AlbumCandidate | null | undefined) => {
  if (!candidate) return 'LP 특징 확인';
  return uniqueFeatureParts([
    countryFeature(candidate.country),
    candidate.year ? `${candidate.year}년반` : '',
    candidate.label,
    candidate.pressing,
    candidate.representativeReason,
    communityFeature(candidate.communityHave || 0, candidate.communityWant || 0),
  ]).slice(0, 5).join(' · ') || 'LP 특징 확인';
};
const wishlistItemFeatures = (item: WishlistItem) => uniqueFeatureParts([
  countryFeature(item.releaseCountry),
  item.year ? `${item.year}년반` : '',
  item.releaseLabel,
  item.pressingCondition,
]).slice(0, 4);

const formValid = computed(() => {
  const hasIdentity = Boolean(selectedRelease.value || form.catalogNumber.trim() || (form.title.trim() && form.artist.trim()));
  const hasDiscogsChoices = candidates.value.length > 1
    || albumMatches.value.length > 0
    || Boolean(selectedAlbum.value)
    || representativeVersions.value.length > 0
    || additionalVersions.value.length > 0;
  return hasIdentity && (!hasDiscogsChoices || Boolean(selectedRelease.value));
});
const lookupReady = () => form.catalogNumber.trim().length >= 3
  || form.title.trim().length >= 2
  || form.artist.trim().length >= 2;
const albumLookupReady = () => form.title.trim().length >= 2 || form.artist.trim().length >= 2;
const clearLookupTimer = () => {
  if (lookupTimer) window.clearTimeout(lookupTimer);
  lookupTimer = null;
};

const clearVersionResults = () => {
  selectedAlbum.value = null;
  representativeVersions.value = [];
  additionalVersions.value = [];
  versionTotal.value = 0;
  versionPartial.value = false;
  versionRequest += 1;
};

const clearSearchResults = () => {
  candidates.value = [];
  albumMatches.value = [];
  albumTotal.value = 0;
  albumQueryTitle.value = '';
  albumQueryArtist.value = '';
  clearVersionResults();
};

const resetForm = () => {
  clearLookupTimer();
  editingId.value = '';
  form.title = '';
  form.artist = '';
  form.catalogNumber = '';
  form.isPublic = false;
  clearSearchResults();
  selectedRelease.value = null;
  lookupMessage.value = '';
  lookupError.value = false;
};

const applyCandidate = (candidate: AlbumCandidate) => {
  applyingCandidate = true;
  selectedRelease.value = candidate;
  form.title = candidate.title;
  form.artist = candidate.artist;
  form.catalogNumber = candidate.catalogNumber;
  clearSearchResults();
  lookupMessage.value = `${candidate.title} 발매본을 선택했습니다.`;
  window.setTimeout(() => { applyingCandidate = false; }, 0);
};

const loadVersionsForAlbum = async (album: DiscogsAlbumSummary, refresh = false) => {
  const requestId = ++versionRequest;
  loadingVersions.value = true;
  lookupError.value = false;
  representativeVersions.value = [];
  additionalVersions.value = [];
  try {
    const result = await fetchRepresentativeVersions(album.masterId, refresh);
    if (requestId !== versionRequest || selectedAlbum.value?.masterId !== album.masterId) return;
    representativeVersions.value = result.representative;
    versionTotal.value = result.total;
    versionPartial.value = result.partial;
    if (result.representative.length) {
      lookupMessage.value = `대표 LP 판본 ${result.representative.length}개가 있습니다.`;
      lookupError.value = false;
    } else {
      await loadReleaseFallbackForAlbum(album, requestId, '대표 판본이 없어 앨범명/아티스트로 발매본을 다시 찾았습니다.');
    }
  } catch (error) {
    if (requestId !== versionRequest) return;
    const fallbackLoaded = await loadReleaseFallbackForAlbum(album, requestId, error instanceof Error ? error.message : 'Discogs LP 판본을 불러오지 못했습니다.');
    if (!fallbackLoaded) {
      lookupError.value = true;
      lookupMessage.value = error instanceof Error ? error.message : 'Discogs LP 판본을 불러오지 못했습니다.';
    }
  } finally {
    if (requestId === versionRequest) loadingVersions.value = false;
  }
};

const loadReleaseFallbackForAlbum = async (album: DiscogsAlbumSummary, requestId: number, reason: string) => {
  try {
    const result = await fetchDiscogsCandidates('', album.title, album.artist);
    if (requestId !== versionRequest || selectedAlbum.value?.masterId !== album.masterId) return false;
    const releases = (result.candidates || [])
      .filter(candidate => candidate.releaseId)
      .map(candidate => ({
        ...candidate,
        masterId: album.masterId,
        representativeReason: candidate.representativeReason || '앨범명 검색',
      }));
    representativeVersions.value = releases.slice(0, 5);
    additionalVersions.value = releases.slice(5);
    versionTotal.value = releases.length;
    versionPartial.value = false;
    lookupError.value = releases.length === 0;
    lookupMessage.value = releases.length
      ? `${reason} LP 판본 후보 ${releases.length}개를 찾았습니다.`
      : '이 앨범에서 선택 가능한 LP 판본을 찾지 못했습니다.';
    return releases.length > 0;
  } catch {
    return false;
  }
};

const selectAlbum = async (album: DiscogsAlbumSummary) => {
  applyingCandidate = true;
  selectedRelease.value = null;
  selectedAlbum.value = album;
  candidates.value = [];
  form.title = album.title;
  form.artist = album.artist;
  form.catalogNumber = '';
  lookupMessage.value = `${album.title}의 LP 판본을 불러오는 중입니다.`;
  window.setTimeout(() => { applyingCandidate = false; }, 0);
  await loadVersionsForAlbum(album);
};

const clearAlbumSelection = () => {
  const album = selectedAlbum.value;
  clearVersionResults();
  selectedRelease.value = null;
  lookupMessage.value = album ? `${album.artist}의 다른 앨범을 선택해 주세요.` : '';
};

const retryVersions = async () => {
  if (selectedAlbum.value) await loadVersionsForAlbum(selectedAlbum.value, true);
};

const lookupAlbumVersions = async (requestId: number) => {
  albumQueryTitle.value = form.title.trim();
  albumQueryArtist.value = form.artist.trim();
  const result = await searchDiscogsAlbums(albumQueryTitle.value, albumQueryArtist.value, 1, 10);
  if (requestId !== lookupRequest) return false;
  albumMatches.value = result.albums.slice(0, 10);
  albumTotal.value = result.pagination.total;
  if (albumMatches.value.length > 0) {
    lookupMessage.value = `상위 ${albumMatches.value.length}개 앨범을 찾았습니다. 특징을 보고 앨범을 선택해 주세요.`;
  } else {
    lookupError.value = true;
    lookupMessage.value = 'Discogs 앨범 결과가 없습니다. 제목과 아티스트를 확인해 주세요.';
  }
  return albumMatches.value.length > 0;
};

const lookupDiscogs = async () => {
  if (!lookupReady()) return;
  const requestId = ++lookupRequest;
  lookupError.value = false;
  selectedRelease.value = null;
  clearSearchResults();
  lookupMessage.value = 'Discogs에서 앨범과 LP 판본을 확인하는 중입니다.';
  try {
    if (form.catalogNumber.trim()) {
      const result = await fetchDiscogsCandidates(form.catalogNumber, form.title, form.artist);
      if (requestId !== lookupRequest) return;
      candidates.value = result.candidates;
      if (result.candidates.length === 1) {
        applyCandidate(result.candidates[0]);
      } else if (result.candidates.length > 1) {
        lookupMessage.value = `${result.candidates.length}개 발매본을 찾았습니다. 정확한 항목을 선택해 주세요.`;
      } else if (albumLookupReady()) {
        lookupMessage.value = '카탈로그 번호로 찾지 못해 앨범명/아티스트로 LP 판본을 다시 확인합니다.';
        await lookupAlbumVersions(requestId);
      } else {
        lookupError.value = true;
        lookupMessage.value = '일치하는 카탈로그 번호가 없습니다. 직접 입력해 등록할 수 있습니다.';
      }
      return;
    }

    await lookupAlbumVersions(requestId);
  } catch (error) {
    if (requestId !== lookupRequest) return;
    lookupError.value = true;
    lookupMessage.value = error instanceof Error ? error.message : 'Discogs 정보를 불러오지 못했습니다.';
  }
};

const scheduleLookup = () => {
  clearLookupTimer();
  if (!lookupReady()) {
    clearSearchResults();
    selectedRelease.value = null;
    lookupMessage.value = '';
    return;
  }
  selectedRelease.value = null;
  clearSearchResults();
  lookupMessage.value = '입력이 멈추면 Discogs에서 확인합니다.';
  lookupTimer = window.setTimeout(() => { void lookupDiscogs(); }, 650);
};

const loadMatches = async () => {
  if (!props.own || !store.isLoggedIn) return;
  const results = await Promise.all(items.value.map(async item => {
    try {
      return [item.id, (await fetchWishlistMatches(item.id)).matches] as const;
    } catch {
      return [item.id, []] as const;
    }
  }));
  matches.value = Object.fromEntries(results);
};

const loadItems = async () => {
  loading.value = true;
  try {
    items.value = props.own
      ? (store.isLoggedIn ? await store.loadWishlistFavorites(true) : [])
      : (await fetchPublicWishlist(props.ownerId)).wishlist;
    await loadMatches();
  } catch (error) {
    items.value = [];
    actionError.value = true;
    actionMessage.value = error instanceof Error ? error.message : '위시리스트를 불러오지 못했습니다.';
  } finally {
    loading.value = false;
  }
};

const payloadFromForm = () => {
  const candidate = selectedRelease.value;
  const pressing = candidate ? createPressingInfo(candidate) : null;
  return {
    title: form.title.trim(),
    artist: form.artist.trim(),
    catalog_number: form.catalogNumber.trim(),
    discogs_release_id: candidate?.releaseId,
    cover_image_url: candidate?.coverImageUrl,
    release_label: candidate?.label,
    release_country: candidate?.country,
    year: candidate?.year || undefined,
    pressing_condition: pressing?.pressing,
    visibility: form.isPublic ? 'public' as const : 'private' as const,
  };
};

const saveWishlist = async () => {
  if (!formValid.value || saving.value) return;
  saving.value = true;
  actionError.value = false;
  actionMessage.value = '';
  try {
    if (editingId.value) {
      await updateWishlistItem(editingId.value, payloadFromForm());
      actionMessage.value = '위시리스트를 수정했습니다.';
    } else {
      await addWishlistItem(payloadFromForm());
      actionMessage.value = '위시리스트 알림을 등록했습니다.';
    }
    resetForm();
    await loadItems();
  } catch (error) {
    actionError.value = true;
    actionMessage.value = error instanceof Error ? error.message : '위시리스트를 저장하지 못했습니다.';
  } finally {
    saving.value = false;
  }
};

const editWishlist = (item: WishlistItem) => {
  editingId.value = item.id;
  applyingCandidate = true;
  clearSearchResults();
  form.title = item.title;
  form.artist = item.artist;
  form.catalogNumber = item.catalogNumber;
  form.isPublic = item.visibility === 'public';
  selectedRelease.value = item.discogsReleaseId ? {
    id: `discogs-${item.discogsReleaseId}`,
    releaseId: item.discogsReleaseId,
    title: item.title,
    artist: item.artist,
    year: Number(item.year || 0),
    label: item.releaseLabel || 'Unknown label',
    catalogNumber: item.catalogNumber,
    country: item.releaseCountry || 'Unknown',
    coverImageUrl: item.coverImageUrl,
    confidence: 100,
  } : null;
  lookupMessage.value = '등록 정보를 수정하고 저장해 주세요.';
  window.setTimeout(() => { applyingCandidate = false; }, 0);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const deleteWishlist = async (item: WishlistItem) => {
  if (!confirm(`${item.title || '이 항목'}을 위시리스트에서 삭제할까요?`)) return;
  actionError.value = false;
  try {
    await removeWishlistItem(item.id);
    if (editingId.value === item.id) resetForm();
    await loadItems();
    actionMessage.value = '위시리스트를 삭제했습니다.';
  } catch (error) {
    actionError.value = true;
    actionMessage.value = error instanceof Error ? error.message : '위시리스트를 삭제하지 못했습니다.';
  }
};

const openAllMatches = (item: WishlistItem) => {
  router.push({ path: '/app/search', query: { q: item.catalogNumber || item.title } });
};

const formatDate = (timestamp: string) => new Date(timestamp).toLocaleDateString('ko-KR');

watch(() => [form.catalogNumber, form.title, form.artist], () => {
  if (!applyingCandidate) scheduleLookup();
});
watch(() => [props.ownerId, props.own], () => { void loadItems(); });
onMounted(() => { void loadItems(); });
onBeforeUnmount(clearLookupTimer);
</script>
