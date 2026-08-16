<template>
  <div class="size-full overflow-y-auto bg-gray-50 dark:bg-[#2a1a12]">
    <header class="sticky top-0 z-10 border-b bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
      <div class="mb-4 flex items-center justify-between">
        <div class="flex items-start gap-2">
          <button type="button" class="p-2" aria-label="주파수 분석" @click="router.push('/frequency')">
            <AudioLines :size="22" />
          </button>
          <div>
            <h1 class="text-2xl font-semibold">Vinyl-Check</h1>
            <p class="text-sm text-gray-500">원하는 판본과 상태를 바로 비교하세요</p>
          </div>
        </div>
        <button class="relative p-2" aria-label="알림" @click="router.push('/app/notifications')">
          <Bell :size="24" />
          <span v-if="store.unreadNotificationCount > 0" class="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-none text-white">
            {{ store.unreadNotificationCount > 99 ? '99+' : store.unreadNotificationCount }}
          </span>
        </button>
      </div>

      <div class="flex w-full items-center gap-3">
        <div class="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Search :size="20" class="shrink-0 text-gray-400" />
          <input
            v-model="query"
            type="text"
            class="min-w-0 flex-1 bg-transparent outline-none"
            placeholder="앨범, 아티스트 검색"
            @keyup.enter="openSearchResults"
          />
          <button v-if="query" class="p-1" aria-label="검색어 지우기" @click="query = ''">
            <X :size="18" class="text-gray-400" />
          </button>
        </div>
        <button
          type="button"
          :class="['relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-white shadow-sm dark:bg-slate-900', showHomeFilters || activeFilterCount > 0 ? 'border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-200' : 'border-gray-200 text-gray-700 dark:border-slate-800 dark:text-slate-200']"
          aria-label="필터"
          @click="toggleFilterPanel"
        >
          <SlidersHorizontal :size="19" />
          <span v-if="activeFilterCount > 0" class="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] text-white">
            {{ activeFilterCount }}
          </span>
        </button>
        <div class="relative shrink-0">
          <button
            type="button"
            class="flex h-12 items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            @click="toggleSortMenu"
          >
            <span>{{ currentSortLabel }}</span>
            <ChevronDown :size="14" :class="showSortMenu ? 'rotate-180' : ''" />
          </button>

          <div
            v-if="showSortMenu"
            class="absolute right-0 top-full z-30 mt-3 w-36 overflow-hidden rounded-lg border border-gray-200 bg-white text-sm shadow-lg dark:border-slate-800 dark:bg-slate-900"
          >
            <button
              v-for="option in sortOptions"
              :key="option.key"
              class="flex w-full items-center justify-between gap-2 border-b border-gray-100 px-3 py-3 text-left last:border-b-0 active:bg-gray-50"
              :class="homeSort === option.key ? 'font-semibold text-gray-950 dark:text-slate-100' : 'text-gray-600 dark:text-slate-300'"
              @click="selectHomeSort(option.key)"
            >
              <span>{{ option.label }}</span>
              <Check v-if="homeSort === option.key" :size="15" />
            </button>
          </div>
        </div>
      </div>
    </header>

    <button v-if="showHomeFilters" type="button" class="fixed inset-0 z-20 bg-black/10 sm:hidden" aria-label="필터 닫기" @click="showHomeFilters = false"></button>

    <div v-if="showHomeFilters" class="fixed inset-x-0 bottom-0 z-30 max-h-[84dvh] space-y-5 overflow-y-auto rounded-t-2xl border-t border-[#eadfcd] bg-[#fff8ed] px-5 py-5 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:static sm:z-auto sm:max-h-[62vh] sm:rounded-none sm:border-t-0 sm:border-b sm:shadow-none">
      <div class="border-b border-gray-200 pb-3 sm:hidden">
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300"></div>
        <div class="flex items-center justify-between">
          <p class="text-base font-semibold dark:text-slate-100">검색 필터</p>
          <button type="button" class="rounded-lg px-3 py-2 text-xs text-gray-500" @click="showHomeFilters = false">닫기</button>
        </div>
      </div>

      <div class="filter-section">
        <p class="filter-section-title">기본 조건</p>
        <div class="mt-4 space-y-4">
          <div class="filter-field">
            <span>장르</span>
            <div class="genre-chip-grid">
              <button
                v-for="genre in visibleGenres"
                :key="genre"
                type="button"
                :class="['genre-chip', draftFilters.genres.includes(genre) ? 'is-active' : '']"
                @click="toggleDraftGenre(genre)"
              >
                {{ genre }}
              </button>
            </div>
            <button
              v-if="genres.length > genrePreviewCount"
              type="button"
              class="genre-expand-button"
              @click="showAllGenres = !showAllGenres"
            >
              {{ showAllGenres ? '장르 접기' : `장르 더보기 ${hiddenGenreCount}개` }}
            </button>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="filter-range">
              <span>가격대</span>
              <strong>{{ priceFilterLabel(draftFilters.maxPrice) }}</strong>
              <input v-model.number="draftFilters.maxPrice" type="range" min="0" :max="maxFilterPrice" step="10000" />
              <div class="range-boundary"><span>0원</span><em>1만원 단위</em><span>{{ maxFilterPrice.toLocaleString() }}원</span></div>
            </label>

            <div class="filter-range">
              <div class="range-title-row">
                <span>음반 등급</span>
                <button type="button" class="grade-help-button" aria-label="등급 도움말" @click="showGradeHelp = !showGradeHelp">
                  <Info :size="14" />
                </button>
              </div>
              <strong>{{ gradeFilterLabel(draftFilters.minGradeScore) }}</strong>
              <div v-if="showGradeHelp" class="grade-help-panel">
                <p v-for="item in gradeHelpItems" :key="item.grade" class="grade-help-row">
                  <b>{{ item.grade }}</b>
                  <span>{{ item.description }}</span>
                </p>
              </div>
              <input v-model.number="draftFilters.minGradeScore" type="range" min="0" max="7" step="1" aria-label="음반 등급" />
              <div class="range-boundary"><span>전체</span><em>등급 1단계</em><span>M</span></div>
            </div>

            <label class="filter-range">
              <span>판매자 평점</span>
              <strong>{{ ratingFilterLabel(draftFilters.minSellerRating) }}</strong>
              <input v-model.number="draftFilters.minSellerRating" type="range" min="0" max="5" step="0.5" />
              <div class="range-boundary"><span>0점</span><em>0.5점 단위</em><span>5점</span></div>
            </label>

            <label class="filter-range">
              <span>발매년도</span>
              <strong>{{ yearFilterLabel(draftFilters.minYear) }}</strong>
              <input v-model.number="draftFilters.minYear" type="range" :min="minFilterYear" :max="maxFilterYear" step="10" />
              <div class="range-boundary"><span>{{ minFilterYear }}년</span><em>10년 단위</em><span>{{ maxFilterYear }}년</span></div>
            </label>
          </div>
        </div>
      </div>

      <div class="filter-section">
        <div class="flex items-center justify-between gap-3">
          <p class="filter-section-title">거래 지역</p>
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 disabled:text-gray-400 dark:border-blue-900 dark:bg-slate-950 dark:text-blue-300"
            :disabled="isLocatingHomeFilter"
            @click="useHomeFilterCurrentLocation"
          >
            <LocateFixed :size="15" />
            {{ isLocatingHomeFilter ? '위치 확인 중' : '현재 위치' }}
          </button>
        </div>
        <div
          class="relative mt-3 h-48 touch-none overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-slate-800 dark:bg-slate-950"
          @pointerdown="startHomeFilterMapDrag"
          @pointermove="moveHomeFilterMapDrag"
          @pointerup="endHomeFilterMapDrag"
          @pointercancel="endHomeFilterMapDrag"
          @pointerleave="endHomeFilterMapDrag"
        >
          <div ref="homeFilterMapContainer" class="absolute inset-0"></div>
          <div v-if="homeFilterMapFallbackHtml" class="absolute inset-0" v-html="homeFilterMapFallbackHtml"></div>
          <button
            v-if="homeFilterMapPoint && homeFilterMapFallbackHtml"
            type="button"
            class="absolute right-2 top-2 z-10 rounded-lg bg-blue-600 px-3 py-2 text-xs text-white shadow-sm active:bg-blue-700"
            @pointerdown.stop
            @click.stop="chooseHomeFilterMapLocation"
          >
            이 위치 선택
          </button>
          <div v-if="homeFilterMapMessage" class="absolute inset-x-2 bottom-2 z-10 flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 text-xs text-gray-600 shadow-sm dark:bg-slate-950/95 dark:text-slate-300">
            <MapPin :size="14" class="shrink-0 text-blue-600" />
            <span>{{ homeFilterMapMessage }}</span>
          </div>
        </div>
        <p class="mt-3 text-xs text-gray-500 dark:text-slate-400">지도에 핀을 찍거나 현재 위치를 누르면 행정구역이 자동으로 채워집니다.</p>
        <div class="mt-3 grid grid-cols-3 gap-2" aria-label="선택한 행정구역">
          <div class="filter-location-part">
            <span>시/도</span>
            <strong>{{ filterRegion.city || '선택 전' }}</strong>
          </div>
          <div class="filter-location-part">
            <span>시/군/구</span>
            <strong>{{ filterRegion.district || '선택 전' }}</strong>
          </div>
          <div class="filter-location-part">
            <span>동/읍/면</span>
            <strong>{{ filterRegion.neighborhood || '선택 전' }}</strong>
          </div>
        </div>
        <p class="mt-4 text-sm font-medium dark:text-slate-100">필터 범위</p>
        <div class="location-scope-grid mt-2" role="radiogroup" aria-label="거래 지역 필터 범위">
          <button
            v-for="option in locationScopeOptions"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="draftFilters.locationScope === option.value"
            :class="['location-scope-button', { 'is-active': draftFilters.locationScope === option.value }]"
            @click="draftFilters.locationScope = option.value"
          >
            {{ option.label }}
          </button>
        </div>
        <p class="mt-2 text-xs text-gray-500 dark:text-slate-400">{{ locationFilterPreview }}</p>
      </div>

      <div class="sticky bottom-0 -mx-5 grid grid-cols-2 gap-3 border-t border-[#eadfcd] bg-[#fff8ed] px-5 pb-1 pt-4 dark:border-slate-800 dark:bg-slate-900 sm:static sm:mx-0 sm:border-t-0 sm:p-0">
        <button type="button" class="w-full rounded-lg border border-[#eadfcd] bg-[#fffdf7] py-3 font-medium text-gray-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200" @click="resetAndApplyFilters">초기화</button>
        <button type="button" class="w-full rounded-lg bg-blue-600 py-3 text-white" @click="applyFilters">적용</button>
      </div>
    </div>

    <main class="pb-6">
      <section v-if="query" class="space-y-4 px-4 py-5">
        <div class="flex items-end justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">"{{ query }}" 검색 결과</h2>
            <p class="mt-1 text-sm text-gray-500">앨범을 고른 뒤 LP 특징별 매물을 확인하세요.</p>
          </div>
          <span class="shrink-0 text-xs text-gray-500">{{ searchedGroups.length }}개</span>
        </div>

        <AlbumGroupButton
          v-for="group in searchedGroups"
          :key="group.key"
          :group="group"
          action-label="LP 특징 선택"
          @open="openAlbumGroup(group)"
        />

        <div v-if="searchedGroups.length === 0" class="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500 dark:border-slate-800 dark:bg-slate-900">
          <p>검색 결과가 없습니다</p>
          <p class="mt-2 text-sm text-gray-400">앨범 이름이나 아티스트명을 바꿔보세요</p>
        </div>
      </section>

      <template v-else>
        <section class="space-y-5 px-4 py-6">
          <div class="flex items-end justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold">최근 올라온 LP</h2>
              <p class="mt-1 text-sm text-gray-500">{{ preferenceSummary }}</p>
            </div>
          </div>

          <AlbumGroupButton
            v-for="group in preferenceGroups"
            :key="group.key"
            :group="group"
            action-label="판본 보기"
            @open="openAlbumGroup(group)"
          />

          <div v-if="preferenceGroups.length === 0" class="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500 dark:border-slate-800 dark:bg-slate-900">
            표시할 판매 상품이 아직 없습니다.
          </div>
        </section>

      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, onMounted, reactive, ref, toRef, watch, type PropType } from 'vue';
import { useRouter } from 'vue-router';
import { AudioLines, Bell, Check, ChevronDown, ChevronRight, Info, LocateFixed, MapPin, Search, SlidersHorizontal, X } from 'lucide-vue-next';
import { groupListingsByAlbum, matchesAlbumTitle, type AlbumProductGroup } from '@/features/buyer/services/pressingCatalog';
import { useAppStore } from '@/shared/stores/appStore';
import VinylCover from '@/shared/components/VinylCover.vue';
import type { Album } from '@/shared/models/market';
import { locationScopeLabel, matchesLocationScope, parseLocationParts, type LocationFilterScope } from '@/shared/services/locationFilter';
import { useLocationMapPicker } from '@/shared/services/locationMapPicker';

const store = useAppStore();
const router = useRouter();
const query = ref('');
type HomeSortKey = 'recent' | 'recommended' | 'price-low' | 'quality';
type SearchFilters = {
  genres: string[];
  maxPrice: number;
  minGradeScore: number;
  minSellerRating: number;
  minYear: number;
  location: string;
  locationScope: LocationFilterScope;
};

const showHomeFilters = ref(false);
const showSortMenu = ref(false);
const homeSort = ref<HomeSortKey>('recent');

const sortOptions: { key: HomeSortKey; label: string }[] = [
  { key: 'recent', label: '최신순' },
  { key: 'recommended', label: '추천순' },
  { key: 'price-low', label: '낮은 가격순' },
  { key: 'quality', label: '상태 좋은순' },
];
const defaultGenres = ['재즈', '록', '팝', '힙합', '클래식', 'R&B/소울', '일렉트로닉', '펑크', '블루스', '소울', '컨트리', '포크', '레게', '메탈', '월드뮤직', '가요', '사운드트랙'];
const maxFilterPrice = 500000;
const minFilterYear = 1950;
const maxFilterYear = Math.floor(new Date().getFullYear() / 10) * 10;
const genrePreviewCount = 6;

const initialFilters = (): SearchFilters => ({
  genres: [],
  maxPrice: maxFilterPrice,
  minGradeScore: 0,
  minSellerRating: 0,
  minYear: minFilterYear,
  location: '',
  locationScope: 'district',
});

const cloneFilters = (value: SearchFilters): SearchFilters => ({
  ...value,
  genres: [...value.genres],
});

const draftFilters = reactive<SearchFilters>(initialFilters());
const appliedFilters = ref<SearchFilters>(cloneFilters(draftFilters));
const filterRegion = reactive({ city: '', district: '', neighborhood: '' });
const showAllGenres = ref(false);
const showGradeHelp = ref(false);
const grades = ['M', 'NM', 'EX', 'VG+', 'VG', 'G', 'P'];
const gradeScore: Record<string, number> = { M: 7, NM: 6, EX: 5, 'VG+': 4, VG: 3, G: 2, P: 1 };
const gradeHelpItems = [
  { grade: 'M', description: '미개봉에 가깝고 사용 흔적이 거의 없음' },
  { grade: 'NM', description: '새것에 가까운 최상급 상태' },
  { grade: 'EX', description: '가벼운 사용감만 있는 상급 상태' },
  { grade: 'VG+', description: '잔기스는 있지만 감상에 무리 적음' },
  { grade: 'VG', description: '사용감과 잡음이 어느 정도 있음' },
  { grade: 'G', description: '잡음과 흠집이 많아 상태 확인 필요' },
  { grade: 'P', description: '손상이 커서 재생 전 확인이 필요함' },
];
const locationScopeOptions: Array<{ value: LocationFilterScope; label: string }> = [
  { value: 'city', label: '시/도' },
  { value: 'district', label: '시/군/구' },
  { value: 'neighborhood', label: '동/읍/면' },
];
const {
  mapContainer: homeFilterMapContainer,
  mapMessage: homeFilterMapMessage,
  mapPoint: homeFilterMapPoint,
  mapFallbackHtml: homeFilterMapFallbackHtml,
  isLocatingCurrentPosition: isLocatingHomeFilter,
  useCurrentLocation: useHomeFilterCurrentLocation,
  chooseFallbackLocation: chooseHomeFilterMapLocation,
  scheduleMap: scheduleHomeFilterMap,
  startFallbackMapDrag: startHomeFilterMapDrag,
  moveFallbackMapDrag: moveHomeFilterMapDrag,
  endFallbackMapDrag: endHomeFilterMapDrag,
  cleanupMap: cleanupHomeFilterMap,
} = useLocationMapPicker(toRef(draftFilters, 'location'), {
  fallbackQuery: store.settings.trade.defaultLocation || '서울 시청',
});

onMounted(() => {
  void store.loadListingsFromServer();
  void store.loadUnreadNotificationCount();
  if (showHomeFilters.value) scheduleHomeFilterMap(0);
});

const normalize = (value: string) => value.trim().toLocaleLowerCase('ko-KR');
const normalizeTag = (tag: string | null | undefined) => (tag || '').trim().replace(/^#/, '').toLocaleLowerCase('ko-KR');
const hiddenFeatureKeywords = ['희귀', 'rare', '초반', '초판', 'first press', 'firstpress', 'original', 'lp', 'vinyl', 'album'];
const isHiddenFeatureTag = (tag: string) => {
  const normalized = normalizeTag(tag);
  return hiddenFeatureKeywords.some(keyword => normalized.includes(keyword));
};
const albumTags = (album: Album) => Array.isArray(album.tags) ? album.tags.filter(tag => tag && !isHiddenFeatureTag(tag)) : [];
const activeFilterCount = computed(() => {
  const filters = appliedFilters.value;
  return Number(filters.genres.length > 0)
    + Number(filters.maxPrice < maxFilterPrice)
    + Number(filters.minGradeScore > 0)
    + Number(filters.minSellerRating > 0)
    + Number(filters.minYear > minFilterYear)
    + Number(Boolean(filters.location.trim()));
});
const genres = computed(() => {
  const listingGenres = store.listings.map(album => album.genre).filter(Boolean);
  return [...new Set([...defaultGenres, ...listingGenres])];
});
const visibleGenres = computed(() => {
  if (showAllGenres.value) return genres.value;
  const previewGenres = genres.value.slice(0, genrePreviewCount);
  const selectedHiddenGenres = draftFilters.genres.filter(genre => !previewGenres.includes(genre));
  return [...new Set([...previewGenres, ...selectedHiddenGenres])];
});
const hiddenGenreCount = computed(() => Math.max(0, genres.value.length - visibleGenres.value.length));
const locationFilterPreview = computed(() => {
  const parts = parseLocationParts(draftFilters.location);
  const label = locationScopeLabel(draftFilters.locationScope);
  const region = draftFilters.locationScope === 'city'
    ? parts.city
    : draftFilters.locationScope === 'district'
      ? [parts.city, parts.district].filter(Boolean).join(' ')
      : [parts.city, parts.district, parts.neighborhood].filter(Boolean).join(' ');
  return region ? `${label} 기준: ${region}` : '시/도, 시/군/구, 동/읍/면을 입력해 필터링하세요.';
});
const syncFilterRegion = () => {
  const parts = parseLocationParts(draftFilters.location);
  filterRegion.city = parts.city;
  filterRegion.district = parts.district;
  filterRegion.neighborhood = parts.neighborhood;
};
const preferenceGenres = computed(() => (store.user.genres || []).map(normalize).filter(Boolean));
const currentSortLabel = computed(() => sortOptions.find(option => option.key === homeSort.value)?.label || '최신순');
const preferenceSummary = computed(() => preferenceGenres.value.length
  ? `선호 장르: ${store.user.genres.join(', ')}`
  : activeFilterCount.value
    ? `${activeFilterCount.value}개 필터 적용 중`
    : currentSortLabel.value);

const scoreAlbum = (album: Album) => {
  const genres = preferenceGenres.value;
  const tagText = albumTags(album).join(' ').toLocaleLowerCase('ko-KR');
  const genre = normalize(album.genre || '');
  const preferenceScore = genres.reduce((score, item) => {
    if (genre.includes(item)) return score + 45;
    if (tagText.includes(item)) return score + 28;
    return score;
  }, 0);
  return preferenceScore
    + Number(album.audioScore || 0) * 0.5
    + Math.min(12, Number(album.views || 0) / 8);
};

const groupScore = (group: AlbumProductGroup) => Math.max(...group.pressings.flatMap(pressing => pressing.listings).map(scoreAlbum), 0);
const groupLatestTime = (group: AlbumProductGroup) => Math.max(...group.pressings.flatMap(pressing => pressing.listings)
  .map(album => new Date(album.createdAt).getTime())
  .filter(Number.isFinite), 0);
const groupQualityScore = (group: AlbumProductGroup) => Math.max(...group.pressings.flatMap(pressing => pressing.listings)
  .map(album => (gradeScore[album.audioGrade] ?? 0) * 20 + Number(album.audioScore || 0)), 0);
const groupLowestPrice = (group: AlbumProductGroup) => group.lowestPrice > 0 ? group.lowestPrice : Number.MAX_SAFE_INTEGER;

const compareHomeGroups = (left: AlbumProductGroup, right: AlbumProductGroup) => {
  if (homeSort.value === 'recent') {
    return groupLatestTime(right) - groupLatestTime(left)
      || groupScore(right) - groupScore(left)
      || right.listingCount - left.listingCount;
  }
  if (homeSort.value === 'price-low') {
    return groupLowestPrice(left) - groupLowestPrice(right)
      || groupScore(right) - groupScore(left)
      || right.listingCount - left.listingCount;
  }
  if (homeSort.value === 'quality') {
    return groupQualityScore(right) - groupQualityScore(left)
      || groupScore(right) - groupScore(left)
      || right.listingCount - left.listingCount;
  }
  return groupScore(right) - groupScore(left)
    || right.listingCount - left.listingCount
    || groupLatestTime(right) - groupLatestTime(left);
};

const resetFilters = () => {
  draftFilters.genres = [];
  draftFilters.maxPrice = maxFilterPrice;
  draftFilters.minGradeScore = 0;
  draftFilters.minSellerRating = 0;
  draftFilters.minYear = minFilterYear;
  draftFilters.location = '';
  draftFilters.locationScope = 'district';
  filterRegion.city = '';
  filterRegion.district = '';
  filterRegion.neighborhood = '';
};

const applyFilters = () => {
  appliedFilters.value = cloneFilters(draftFilters);
  showHomeFilters.value = false;
};

const resetAndApplyFilters = () => {
  resetFilters();
  applyFilters();
};

const toggleDraftGenre = (genre: string) => {
  draftFilters.genres = draftFilters.genres.includes(genre)
    ? draftFilters.genres.filter(item => item !== genre)
    : [...draftFilters.genres, genre];
};
const priceFilterLabel = (price: number) => price >= maxFilterPrice ? '전체' : `${price.toLocaleString()}원 이하`;
const gradeFilterLabel = (score: number) => score <= 0 ? '전체' : `${grades[Math.max(0, grades.length - score)] || 'P'} 이상`;
const ratingFilterLabel = (rating: number) => rating <= 0 ? '전체' : `${rating.toFixed(1)} 이상`;
const yearFilterLabel = (year: number) => year <= minFilterYear ? '전체' : `${year}년 이후`;

const passesHomeFilters = (album: Album) => {
  const filters = appliedFilters.value;
  return (!filters.genres.length || filters.genres.includes(album.genre))
    && matchesLocationScope(album.location, filters.location, filters.locationScope)
    && (filters.maxPrice >= maxFilterPrice || album.price <= filters.maxPrice)
    && (!filters.minGradeScore || (gradeScore[album.audioGrade] ?? 0) >= filters.minGradeScore)
    && (!filters.minSellerRating || album.seller.rating >= filters.minSellerRating)
    && (!filters.minYear || album.year >= filters.minYear);
};

const filteredListings = computed(() => store.listings.filter(passesHomeFilters));
const groupedHomeListings = (listings: Album[], limit: number) => groupListingsByAlbum(listings)
  .sort(compareHomeGroups)
  .slice(0, limit);

const searchedGroups = computed(() => {
  const normalized = normalize(query.value);
  if (!normalized) return [];
  return groupedHomeListings(filteredListings.value.filter(album => matchesAlbumTitle(album, normalized)), 12);
});

const preferenceGroups = computed(() => groupedHomeListings(filteredListings.value, 8));

const openAlbumGroup = (group: AlbumProductGroup) => {
  router.push({
    path: '/app/search',
    query: { albumKey: group.key, source: 'home' },
  });
};

const openSearchResults = () => {
  router.push({ path: '/app/search', query: { q: query.value.trim() || undefined } });
};

const toggleFilterPanel = () => {
  showHomeFilters.value = !showHomeFilters.value;
  showSortMenu.value = false;
};

const toggleSortMenu = () => {
  showSortMenu.value = !showSortMenu.value;
  showHomeFilters.value = false;
};

const selectHomeSort = (sort: HomeSortKey) => {
  homeSort.value = sort;
  showSortMenu.value = false;
};

watch(showHomeFilters, visible => {
  if (visible) scheduleHomeFilterMap(0);
});

watch(() => draftFilters.location, () => {
  syncFilterRegion();
  if (showHomeFilters.value) scheduleHomeFilterMap();
});

onBeforeUnmount(() => {
  cleanupHomeFilterMap();
});

const priceLabel = (price: number) => price > 0 ? `${price.toLocaleString()}원부터` : '가격 확인';

const AlbumGroupButton = defineComponent({
  props: {
    group: { type: Object as PropType<AlbumProductGroup>, required: true },
    actionLabel: { type: String, default: '보기' },
  },
  emits: ['open'],
  setup(props, { emit }) {
    return () => h('button', {
      type: 'button',
      class: 'w-full rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm active:bg-gray-50 dark:border-slate-800 dark:bg-slate-900',
      onClick: () => emit('open'),
    }, [
      h('div', { class: 'flex items-center gap-4' }, [
        h(VinylCover, {
          src: props.group.coverImage,
          alt: props.group.title,
          class: 'h-24 w-24 shrink-0 rounded-lg bg-gray-100 object-cover',
        }),
        h('div', { class: 'min-w-0 flex-1' }, [
          h('div', { class: 'flex items-start justify-between gap-3' }, [
            h('div', { class: 'min-w-0 flex-1' }, [
              h('p', { class: 'truncate text-sm font-medium text-gray-600 dark:text-slate-300' }, props.group.artist || '아티스트 미상'),
              h('h3', { class: 'mt-1 truncate text-base font-semibold text-gray-950 dark:text-slate-100' }, props.group.title),
            ]),
            h('span', { class: 'shrink-0 rounded-md bg-emerald-600 px-2.5 py-1 text-sm font-bold text-white shadow-sm' }, props.group.bestQualityLabel || '-'),
          ]),
          h('p', { class: 'mt-3 text-lg font-semibold text-gray-950 dark:text-slate-50' }, priceLabel(props.group.lowestPrice)),
        ]),
        h(ChevronRight, { size: 18, class: 'shrink-0 text-gray-400' }),
      ]),
    ]);
  },
});
</script>

<style scoped>
.filter-section {
  border: 1px solid #eadfcd;
  border-radius: 0.75rem;
  background: #fffdf7;
  padding: 1rem;
}

.filter-section-title {
  color: #111827;
  font-size: 0.9rem;
  font-weight: 750;
}

.filter-field {
  display: grid;
  gap: 0.45rem;
  min-width: 0;
}

.filter-field span {
  color: #6b7280;
  font-size: 0.72rem;
  font-weight: 650;
}

.filter-field select,
.filter-field input {
  min-width: 0;
  width: 100%;
  height: 2.75rem;
  border: 1px solid #e2d4bf;
  border-radius: 0.5rem;
  background: #fffaf0;
  padding: 0 0.7rem;
  color: #111827;
  font-size: 0.86rem;
  outline: none;
}

.filter-field select:focus,
.filter-field input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.14);
}

.filter-location-part {
  display: grid;
  min-width: 0;
  gap: 0.35rem;
  min-height: 4.15rem;
  align-content: center;
  border: 1px solid #e2d4bf;
  border-radius: 0.5rem;
  background: #fffaf0;
  padding: 0.6rem;
}

.filter-location-part span {
  color: #6b7280;
  font-size: 0.68rem;
  font-weight: 650;
}

.filter-location-part strong {
  min-width: 0;
  color: #111827;
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.location-scope-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.location-scope-button {
  min-width: 0;
  min-height: 2.75rem;
  border: 1px solid #e2d4bf;
  border-radius: 0.5rem;
  background: #fffaf0;
  padding: 0.55rem 0.35rem;
  color: #4b5563;
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1.2;
}

.location-scope-button.is-active {
  border-color: #2563eb;
  background: #dbeafe;
  color: #1d4ed8;
}

.genre-chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.genre-chip {
  border: 1px solid #e2d4bf;
  border-radius: 999px;
  background: #fffaf0;
  padding: 0.45rem 0.75rem;
  color: #374151;
  font-size: 0.8rem;
  font-weight: 650;
}

.genre-chip.is-active {
  border-color: #2563eb;
  background: #dbeafe;
  color: #1d4ed8;
}

.genre-expand-button {
  width: 100%;
  border: 1px dashed #bfdbfe;
  border-radius: 0.5rem;
  background: #eff6ff;
  padding: 0.55rem 0.75rem;
  color: #2563eb;
  font-size: 0.78rem;
  font-weight: 700;
}

.filter-range {
  display: grid;
  gap: 0.45rem;
  border: 1px solid #eadfcd;
  border-radius: 0.65rem;
  background: #fffaf0;
  padding: 0.75rem;
}

.range-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.grade-help-button {
  display: inline-flex;
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  background: #eff6ff;
  color: #2563eb;
}

.grade-help-panel {
  display: grid;
  gap: 0.35rem;
  border: 1px solid #e2d4bf;
  border-radius: 0.5rem;
  background: #fff8ed;
  padding: 0.55rem;
}

.grade-help-row {
  display: grid;
  grid-template-columns: 2.25rem minmax(0, 1fr);
  gap: 0.45rem;
  align-items: start;
  margin: 0;
}

.grade-help-row b {
  color: #111827;
  font-size: 0.72rem;
  line-height: 1.35;
}

.filter-range span {
  color: #6b7280;
  font-size: 0.72rem;
  font-weight: 650;
}

.filter-range strong {
  color: #111827;
  font-size: 0.92rem;
}

.filter-range em {
  color: #6b7280;
  font-size: 0.7rem;
  font-style: normal;
  font-weight: 600;
}

.range-boundary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 0.5rem;
}

.range-boundary span {
  min-width: 0;
  font-size: 0.68rem;
}

.range-boundary span:last-child {
  text-align: right;
}

.filter-range input {
  width: 100%;
  accent-color: #2563eb;
}

:global(.dark) .filter-section {
  border-color: #684831;
  background: #342217;
}

:global(.dark) .filter-section-title {
  color: #f8fafc;
}

:global(.dark) .filter-field span {
  color: #cbd5e1;
}

:global(.dark) .filter-field select,
:global(.dark) .filter-field input {
  border-color: #684831;
  background: #3a271b;
  color: #f8fafc;
}

:global(.dark) .filter-location-part span {
  color: #cbd5e1;
}

:global(.dark) .filter-location-part {
  border-color: #684831;
  background: #3a271b;
}

:global(.dark) .filter-location-part strong {
  color: #f8fafc;
}

:global(.dark) .location-scope-button {
  border-color: #684831;
  background: #3a271b;
  color: #e2e8f0;
}

:global(.dark) .location-scope-button.is-active {
  border-color: #93c5fd;
  background: #1e3a5f;
  color: #eff6ff;
}

:global(.dark) .genre-chip {
  border-color: #684831;
  background: #3a271b;
  color: #f8fafc;
}

:global(.dark) .grade-help-button {
  border-color: #2563eb;
  background: #172554;
  color: #bfdbfe;
}

:global(.dark) .grade-help-panel {
  border-color: #684831;
  background: #342217;
}

:global(.dark) .grade-help-row b {
  color: #f8fafc;
}

:global(.dark) .genre-chip.is-active {
  border-color: #60a5fa;
  background: #1e3a5f;
  color: #bfdbfe;
}

:global(.dark) .genre-expand-button {
  border-color: #2563eb;
  background: #172554;
  color: #bfdbfe;
}

:global(.dark) .filter-range {
  border-color: #684831;
  background: #3a271b;
}

:global(.dark) .filter-range span {
  color: #cbd5e1;
}

:global(.dark) .filter-range strong {
  color: #f8fafc;
}

:global(.dark) .filter-range em {
  color: #cbd5e1;
}
</style>
