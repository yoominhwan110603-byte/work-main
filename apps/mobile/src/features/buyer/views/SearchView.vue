<template>
  <div class="size-full bg-white text-gray-950 flex flex-col dark:bg-slate-950 dark:text-slate-100">
    <header v-if="homeAlbumMode" class="shrink-0 border-b bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
      <div class="flex items-center gap-3">
        <button class="shrink-0 rounded-full p-2 active:bg-gray-100" aria-label="뒤로 가기" @click="router.push('/app')">
          <ArrowLeft :size="24" />
        </button>
        <div class="min-w-0 flex-1">
          <h1 class="truncate text-lg font-semibold">{{ selectedAlbum?.title || '앨범' }}</h1>
          <p class="truncate text-xs text-gray-500">
            {{ selectedAlbum ? `${selectedAlbum.artist} · 판매 옵션 ${selectedPressingGroups.length}개` : '판매 옵션을 불러오는 중입니다' }}
          </p>
        </div>
      </div>
    </header>

    <header v-else class="shrink-0 border-b bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
      <div class="flex items-center gap-2">
        <button class="shrink-0 p-2" @click="router.push('/app')"><ArrowLeft :size="24" /></button>
        <div class="min-w-0 flex-1">
          <div class="flex min-h-11 items-center gap-2 rounded-lg bg-gray-100 px-3 sm:px-4 dark:bg-slate-800">
            <Search :size="18" class="shrink-0 text-gray-400" />
            <input v-model="query" type="text" class="w-full min-w-0 bg-transparent text-sm outline-none dark:text-slate-100 sm:text-base" placeholder="앨범, 아티스트 검색" autofocus />
            <button v-if="query" class="p-1" @click="query = ''"><X :size="18" class="text-gray-400" /></button>
          </div>
        </div>
        <button
          type="button"
          :class="['relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border', showFilters || activeFilterCount > 0 ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-700 dark:border-slate-700 dark:text-slate-200']"
          aria-label="필터"
          @click="showFilters = !showFilters"
        >
          <SlidersHorizontal :size="18" />
          <span v-if="activeFilterCount > 0" class="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] text-white">
            {{ activeFilterCount }}
          </span>
        </button>
      </div>

      <div class="mt-3 flex items-center gap-2">
        <label class="search-select flex-1">
          <span>정렬</span>
          <select v-model="sortBy" aria-label="검색 결과 정렬">
            <option v-for="option in sortOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <button
          type="button"
          class="h-10 shrink-0 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          @click="resetAndApplyFilters"
        >
          초기화
        </button>
      </div>
    </header>

    <button v-if="showFilters" type="button" class="fixed inset-0 z-20 bg-black/20 sm:hidden" aria-label="필터 닫기" @click="showFilters = false"></button>

    <div v-if="showFilters" class="fixed inset-x-0 bottom-0 z-30 max-h-[82dvh] space-y-4 overflow-y-auto rounded-t-2xl border-t border-[#eadfcd] bg-[#fff8ed] px-4 py-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:static sm:z-auto sm:max-h-[58vh] sm:rounded-none sm:border-t-0 sm:border-b sm:shadow-none">
      <div class="flex items-center justify-between sm:hidden">
        <p class="text-sm font-medium">검색 필터</p>
        <button type="button" class="rounded-lg px-3 py-2 text-xs text-gray-500" @click="showFilters = false">닫기</button>
      </div>

      <div class="space-y-4">
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

      <div class="rounded-lg border border-[#eadfcd] bg-[#fffdf7] p-3 dark:border-slate-700 dark:bg-slate-950">
        <label class="text-sm font-medium" for="quick-location">거래 지역</label>
        <select v-model="draftFilters.locationScope" class="mt-2 w-full rounded-lg border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" aria-label="거래 지역 범위">
          <option v-for="option in locationScopeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
        <input id="quick-location" v-model="draftFilters.location" type="text" placeholder="예: 서울, 강남구" class="mt-2 w-full rounded-lg border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
        <p v-if="draftFilters.location" class="mt-2 text-xs text-gray-500 dark:text-slate-400">{{ locationFilterPreview }}</p>
        <div
          class="relative mt-3 h-48 touch-none overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-slate-700 dark:bg-slate-900"
          @pointerdown="startSearchFilterMapDrag"
          @pointermove="moveSearchFilterMapDrag"
          @pointerup="endSearchFilterMapDrag"
          @pointercancel="endSearchFilterMapDrag"
          @pointerleave="endSearchFilterMapDrag"
        >
          <div ref="searchFilterMapContainer" class="absolute inset-0"></div>
          <div v-if="searchFilterMapFallbackHtml" class="absolute inset-0" v-html="searchFilterMapFallbackHtml"></div>
          <button
            v-if="searchFilterMapPoint && searchFilterMapFallbackHtml"
            type="button"
            class="absolute right-2 top-2 z-10 rounded-lg bg-blue-600 px-3 py-2 text-xs text-white shadow-sm active:bg-blue-700"
            @pointerdown.stop
            @click.stop="chooseSearchFilterMapLocation"
          >
            이 위치 선택
          </button>
          <div v-if="searchFilterMapMessage" class="absolute inset-x-2 bottom-2 z-10 flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 text-xs text-gray-600 shadow-sm dark:bg-slate-950/95 dark:text-slate-300">
            <MapPin :size="14" class="shrink-0 text-blue-600" />
            <span>{{ searchFilterMapMessage }}</span>
          </div>
        </div>
      </div>

      <div class="sticky bottom-0 -mx-4 grid grid-cols-2 gap-2 border-t border-[#eadfcd] bg-[#fff8ed] px-4 pb-1 pt-3 dark:border-slate-800 dark:bg-slate-900 sm:static sm:mx-0 sm:border-t-0 sm:p-0">
        <button class="w-full rounded-lg border border-[#eadfcd] bg-[#fffdf7] py-3" @click="resetAndApplyFilters">초기화</button>
        <button class="w-full rounded-lg bg-blue-600 py-3 text-white" @click="applyFilters">적용</button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <section v-if="currentFolder" class="border-b bg-blue-50 px-3 py-3 sm:px-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-blue-950">{{ resultSummary }}</p>
            <p class="mt-1 text-xs text-blue-700">{{ currentFolder.description }}</p>
          </div>
          <button class="shrink-0 rounded-lg bg-white px-3 py-2 text-xs text-blue-600" @click="clearFolderFilter">필터 초기화</button>
        </div>
        <p v-if="nearbyNeedsLocation" class="mt-2 rounded-lg bg-white px-3 py-2 text-xs text-amber-800">
          기본 거래 지역이 없어 지역 필터를 비워두었습니다. 필터에서 지역을 입력하면 주변 매물을 모아볼 수 있습니다.
        </p>
      </section>

      <div v-if="!homeAlbumMode" class="border-b bg-gray-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div class="flex min-h-9 items-center justify-between gap-3">
          <p class="min-w-0 truncate text-xs text-gray-500">
            {{ selectedAlbum ? `판매 옵션 ${selectedPressingGroups.length}개` : `${resultSummary} · 앨범 ${albumGroups.length}개` }}
          </p>
          <button
            v-if="selectedAlbum"
            type="button"
            class="shrink-0 rounded-lg border bg-white px-3 py-2 text-xs text-blue-600 dark:border-slate-700 dark:bg-slate-950"
            @click="clearSelectedAlbum"
          >
            다른 앨범
          </button>
        </div>
      </div>

      <section v-if="!selectedAlbum" class="space-y-3 px-4 pb-6 pt-3">
        <button
          v-for="group in albumGroups"
          :key="group.key"
          type="button"
          class="w-full rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm active:bg-gray-50 dark:border-slate-800 dark:bg-slate-900"
          @click="selectAlbumGroup(group.key)"
        >
          <div class="flex items-center gap-4">
            <VinylCover :src="group.coverImage" :alt="group.title" class="h-24 w-24 shrink-0 rounded-lg bg-gray-100 object-cover" />
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-gray-600 dark:text-slate-300">{{ group.artist || '아티스트 미상' }}</p>
                  <h2 class="mt-1 truncate text-base font-semibold text-gray-950 dark:text-slate-100">{{ group.title }}</h2>
                </div>
                <span class="shrink-0 rounded-md bg-emerald-600 px-2.5 py-1 text-sm font-bold text-white shadow-sm">{{ group.bestQualityLabel || '-' }}</span>
              </div>
              <p class="mt-3 text-lg font-semibold text-gray-950 dark:text-slate-50">{{ priceLabel(group.lowestPrice) }}</p>
            </div>
            <ChevronRight :size="18" class="shrink-0 text-gray-400" />
          </div>
        </button>
      </section>

      <section v-else class="space-y-3 px-4 pb-6 pt-3">
        <button
          v-for="pressing in selectedPressingGroups"
          :key="pressing.key"
          type="button"
          class="w-full rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm active:bg-gray-50"
          @click="openPressing(pressing.key)"
        >
          <div class="flex items-center gap-3">
            <VinylCover :src="pressing.coverImage" :alt="pressing.title" class="h-16 w-16 shrink-0 rounded bg-gray-100 object-cover" />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <h3 class="truncate text-base font-semibold text-gray-950">{{ pressing.displayName }}</h3>
                <span class="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">{{ pressing.listingCount }}개</span>
              </div>
              <p class="mt-1 truncate text-xs text-gray-500">{{ pressing.featureDescription }}</p>
              <div class="mt-2 flex flex-wrap gap-1.5">
                <span
                  v-for="bucket in pressing.qualityBuckets"
                  :key="`${pressing.key}-${bucket.key}`"
                  class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
                >
                  {{ bucket.label }} {{ bucket.listingCount }}
                </span>
              </div>
            </div>
            <ChevronRight :size="18" class="shrink-0 text-gray-400" />
          </div>
        </button>
      </section>

      <div v-if="albumGroups.length === 0" class="px-4 py-12 text-center text-sm text-gray-500">
        조건에 맞는 앨범이 없습니다.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, toRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, ChevronRight, Info, MapPin, Search, SlidersHorizontal, X } from 'lucide-vue-next';
import { useAppStore } from '@/shared/stores/appStore';
import VinylCover from '@/shared/components/VinylCover.vue';
import { groupListingsByAlbum, groupListingsByPressing, matchesAlbumTitle } from '@/features/buyer/services/pressingCatalog';
import { locationScopeLabel, matchesLocationScope, type LocationFilterScope } from '@/shared/services/locationFilter';
import { useLocationMapPicker } from '@/shared/services/locationMapPicker';

const router = useRouter();
const route = useRoute();
const store = useAppStore();
const query = ref(String(route.query.q || ''));
const showFilters = ref(route.query.filters === '1');
const sortBy = ref(String(route.query.sort || 'recent'));

type SearchFilters = {
  genres: string[];
  maxPrice: number;
  minGradeScore: number;
  minSellerRating: number;
  minYear: number;
  location: string;
  locationScope: LocationFilterScope;
};

const queryString = (value: unknown) => Array.isArray(value) ? String(value[0] || '') : String(value || '');
const selectedAlbumKey = ref(queryString(route.query.albumKey));
const folderKey = computed(() => queryString(route.query.folder));
const folderMeta: Record<string, { label: string; description: string }> = {
  rare: { label: '특징 폴더', description: '리이슈, OBI, 모노처럼 식별 가능한 LP 특징을 모아봤습니다.' },
  'low-price': { label: '낮은 가격 폴더', description: '5만원 이하 매물을 낮은 가격순으로 보여줍니다.' },
  nearby: { label: '내 주변 폴더', description: '기본 거래 지역과 가까운 매물을 보여줍니다.' },
  quality: { label: '고품질 폴더', description: 'NM, EX, VG+ 또는 음질 점수 80점 이상 매물입니다.' },
  recent: { label: '최근 등록 폴더', description: '새로 올라온 LP를 보여줍니다.' },
};
const currentFolder = computed(() => folderMeta[folderKey.value] || null);
const homeAlbumMode = computed(() => queryString(route.query.source) === 'home' && Boolean(selectedAlbumKey.value));
const defaultTradeLocation = computed(() => store.settings.trade.defaultLocation.trim());
const maxFilterPrice = 500000;
const minFilterYear = 1950;
const maxFilterYear = Math.floor(new Date().getFullYear() / 10) * 10;
const genrePreviewCount = 6;
const normalizeFilterYear = (year: number) => {
  if (!Number.isFinite(year) || year <= minFilterYear) return minFilterYear;
  return Math.min(maxFilterYear, Math.max(minFilterYear, Math.floor(year / 10) * 10));
};

const sortOptions = [
  { value: 'recent', label: '최신순' },
  { value: 'recommended', label: '상태순' },
  { value: 'price-low', label: '낮은 가격순' },
  { value: 'price-high', label: '높은 가격순' },
  { value: 'audio-grade', label: '음질 좋은순' },
  { value: 'popular', label: '인기순' },
];
const defaultGenres = ['재즈', '록', '팝', '힙합', '클래식', 'R&B/소울', '일렉트로닉', '펑크', '블루스', '소울', '컨트리', '포크', '레게', '메탈', '월드뮤직', '가요', '사운드트랙'];

const initialFilters = (): SearchFilters => ({
  genres: queryString(route.query.genre) ? queryString(route.query.genre).split(',').filter(Boolean) : [],
  maxPrice: folderKey.value === 'low-price' ? 50000 : maxFilterPrice,
  minGradeScore: folderKey.value === 'quality' ? 4 : 0,
  minSellerRating: Number(queryString(route.query.minSellerRating)) || 0,
  minYear: normalizeFilterYear(Number(queryString(route.query.minYear)) || minFilterYear),
  location: queryString(route.query.location) || (folderKey.value === 'nearby' ? defaultTradeLocation.value : ''),
  locationScope: (queryString(route.query.locationScope) as LocationFilterScope) || (folderKey.value === 'nearby' ? 'district' : 'contains'),
});

const cloneFilters = (value: SearchFilters): SearchFilters => ({
  ...value,
  genres: [...value.genres],
});

const draftFilters = reactive<SearchFilters>(initialFilters());
const appliedFilters = ref<SearchFilters>(cloneFilters(draftFilters));
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
  { value: 'contains', label: '입력 지역 포함' },
  { value: 'city', label: '같은 시/도' },
  { value: 'district', label: '같은 구/시/군' },
  { value: 'neighborhood', label: '같은 동/읍/면' },
];
const {
  mapContainer: searchFilterMapContainer,
  mapMessage: searchFilterMapMessage,
  mapPoint: searchFilterMapPoint,
  mapFallbackHtml: searchFilterMapFallbackHtml,
  chooseFallbackLocation: chooseSearchFilterMapLocation,
  scheduleMap: scheduleSearchFilterMap,
  startFallbackMapDrag: startSearchFilterMapDrag,
  moveFallbackMapDrag: moveSearchFilterMapDrag,
  endFallbackMapDrag: endSearchFilterMapDrag,
  cleanupMap: cleanupSearchFilterMap,
} = useLocationMapPicker(toRef(draftFilters, 'location'), {
  fallbackQuery: defaultTradeLocation.value || '서울 시청',
});

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
const locationFilterPreview = computed(() => `${locationScopeLabel(draftFilters.locationScope)} 기준: ${draftFilters.location}`);
const toggleDraftGenre = (genre: string) => {
  draftFilters.genres = draftFilters.genres.includes(genre)
    ? draftFilters.genres.filter(item => item !== genre)
    : [...draftFilters.genres, genre];
};

const resetFilters = () => {
  draftFilters.genres = [];
  draftFilters.maxPrice = maxFilterPrice;
  draftFilters.minGradeScore = 0;
  draftFilters.minSellerRating = 0;
  draftFilters.minYear = minFilterYear;
  draftFilters.location = '';
  draftFilters.locationScope = 'contains';
};

const applyFilters = () => {
  appliedFilters.value = cloneFilters(draftFilters);
  showFilters.value = false;
};

const resetAndApplyFilters = () => {
  resetFilters();
  applyFilters();
};

const priceFilterLabel = (price: number) => price >= maxFilterPrice ? '전체' : `${price.toLocaleString()}원 이하`;
const gradeFilterLabel = (score: number) => score <= 0 ? '전체' : `${grades[Math.max(0, grades.length - score)] || 'P'} 이상`;
const ratingFilterLabel = (rating: number) => rating <= 0 ? '전체' : `${rating.toFixed(1)} 이상`;
const yearFilterLabel = (year: number) => year <= minFilterYear ? '전체' : `${year}년 이후`;
const priceLabel = (price: number) => price > 0 ? `${price.toLocaleString()}원부터` : '가격 확인';
const nearbyNeedsLocation = computed(() => folderKey.value === 'nearby' && !draftFilters.location.trim());
const resultSummary = computed(() => currentFolder.value?.label || (query.value ? `"${query.value}" 검색 결과` : '전체 검색 결과'));
const clearFolderFilter = () => {
  router.replace({ path: '/app/search' });
  query.value = '';
  selectedAlbumKey.value = '';
  sortBy.value = 'recent';
  resetFilters();
  appliedFilters.value = cloneFilters(draftFilters);
};

watch(query, value => {
  selectedAlbumKey.value = '';
  router.replace({ query: { ...route.query, q: value || undefined, albumKey: undefined } });
});
watch(sortBy, value => router.replace({ query: { ...route.query, sort: value === 'recent' ? undefined : value } }));
watch(showFilters, visible => {
  if (visible) scheduleSearchFilterMap(0);
});
watch(() => draftFilters.location, () => {
  if (showFilters.value) scheduleSearchFilterMap();
});

const filteredAlbums = computed(() => store.listings
  .filter(album => {
    const normalized = query.value.trim().toLowerCase();
    const matchesQuery = matchesAlbumTitle(album, normalized);
    const filters = appliedFilters.value;
    return matchesQuery
      && (!filters.genres.length || filters.genres.includes(album.genre))
      && matchesLocationScope(album.location, filters.location, filters.locationScope)
      && (filters.maxPrice >= maxFilterPrice || album.price <= filters.maxPrice)
      && (!filters.minGradeScore || (gradeScore[album.audioGrade] ?? 0) >= filters.minGradeScore)
      && (!filters.minSellerRating || album.seller.rating >= filters.minSellerRating)
      && (!filters.minYear || album.year >= filters.minYear);
  })
  .sort((a, b) => {
    if (sortBy.value === 'price-low') return a.price - b.price;
    if (sortBy.value === 'price-high') return b.price - a.price;
    if (sortBy.value === 'audio-grade') return (gradeScore[b.audioGrade] ?? 0) - (gradeScore[a.audioGrade] ?? 0) || b.audioScore - a.audioScore;
    if (sortBy.value === 'popular') return b.views - a.views;
    if (sortBy.value === 'recommended') return b.audioScore - a.audioScore || b.views - a.views;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }));

const albumGroups = computed(() => groupListingsByAlbum(filteredAlbums.value));
const selectedAlbum = computed(() => albumGroups.value.find(group => group.key === selectedAlbumKey.value) || null);
const selectedPressingGroups = computed(() => selectedAlbum.value ? groupListingsByPressing(selectedAlbum.value.pressings.flatMap(pressing => pressing.listings)) : []);

const selectAlbumGroup = (key: string) => {
  selectedAlbumKey.value = key;
  router.replace({ query: { ...route.query, q: query.value || undefined, albumKey: key } });
};

const clearSelectedAlbum = () => {
  selectedAlbumKey.value = '';
  router.replace({ query: { ...route.query, albumKey: undefined, source: undefined } });
};

const openPressing = (key: string) => {
  router.push({ path: '/app/pressing', query: { key } });
};

onMounted(() => {
  void store.loadListingsFromServer();
  if (nearbyNeedsLocation.value) showFilters.value = true;
  if (showFilters.value) scheduleSearchFilterMap(0);
});

onBeforeUnmount(() => {
  cleanupSearchFilterMap();
});
</script>

<style scoped>
.search-select,
.filter-field {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}

.search-select span,
.filter-field span {
  color: #6b7280;
  font-size: 0.72rem;
  font-weight: 650;
}

.search-select select,
.filter-field select,
.filter-field input {
  min-width: 0;
  width: 100%;
  height: 2.5rem;
  border: 1px solid #e2d4bf;
  border-radius: 0.5rem;
  background: #fffdf7;
  padding: 0 0.7rem;
  color: #111827;
  font-size: 0.86rem;
  outline: none;
}

.search-select select:focus,
.filter-field select:focus,
.filter-field input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.14);
}

.genre-chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.genre-chip {
  border: 1px solid #e2d4bf;
  border-radius: 999px;
  background: #fffdf7;
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
  background: #fffdf7;
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

:global(.dark) .search-select span,
:global(.dark) .filter-field span {
  color: #cbd5e1;
}

:global(.dark) .search-select select,
:global(.dark) .filter-field select,
:global(.dark) .filter-field input {
  border-color: #684831;
  background: #3a271b;
  color: #f8fafc;
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
