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

    <div v-if="showFilters" class="fixed inset-x-0 bottom-0 z-30 max-h-[84dvh] overflow-y-auto rounded-t-2xl border-t border-[#eadfcd] bg-[#fff8ed] px-4 py-4 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:static sm:z-auto sm:max-h-[62vh] sm:rounded-none sm:border-t-0 sm:border-b sm:shadow-none">
      <MarketplaceFilterPanel
        :filters="draftFilters"
        :genres="genres"
        :default-location="defaultTradeLocation"
        @update:filters="updateDraftFilters"
        @close="showFilters = false"
        @reset="resetAndApplyFilters"
        @apply="applyFilters"
      />
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
          기본 거래 지역이 없어 지역 필터를 비워두었습니다. 필터 지도에서 지역을 선택하면 주변 매물을 모아볼 수 있습니다.
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
                  <h2 class="truncate text-base font-semibold text-gray-950 dark:text-slate-100">{{ group.title }}</h2>
                  <p class="mt-1 truncate text-sm font-medium text-gray-600 dark:text-slate-300">{{ group.artist || '아티스트 미상' }}</p>
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
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-vue-next';
import { useAppStore } from '@/shared/stores/appStore';
import VinylCover from '@/shared/components/VinylCover.vue';
import MarketplaceFilterPanel from '@/shared/components/MarketplaceFilterPanel.vue';
import { groupListingsByAlbum, groupListingsByPressing, matchesAlbumTitle } from '@/features/buyer/services/pressingCatalog';
import type { LocationFilterScope } from '@/shared/services/locationFilter';
import {
  MARKET_FILTER_MAX_PRICE,
  MARKET_GRADE_SCORE,
  cloneMarketplaceFilters,
  countActiveMarketplaceFilters,
  createMarketplaceFilters,
  matchesMarketplaceFilters,
  normalizeMarketFilterYear,
  type MarketplaceFilters,
} from '@/shared/services/marketFilters';

const router = useRouter();
const route = useRoute();
const store = useAppStore();
const query = ref(String(route.query.q || ''));
const showFilters = ref(route.query.filters === '1');
const sortBy = ref(String(route.query.sort || 'recent'));

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

const sortOptions = [
  { value: 'recent', label: '최신순' },
  { value: 'recommended', label: '상태순' },
  { value: 'price-low', label: '낮은 가격순' },
  { value: 'price-high', label: '높은 가격순' },
  { value: 'audio-grade', label: '음질 좋은순' },
  { value: 'popular', label: '인기순' },
];
const defaultGenres = ['재즈', '록', '팝', '힙합', '클래식', 'R&B/소울', '일렉트로닉', '펑크', '블루스', '소울', '컨트리', '포크', '레게', '메탈', '월드뮤직', '가요', '사운드트랙'];

const initialFilters = (): MarketplaceFilters => createMarketplaceFilters({
  genres: queryString(route.query.genre) ? queryString(route.query.genre).split(',').filter(Boolean) : [],
  maxPrice: folderKey.value === 'low-price' ? 50000 : MARKET_FILTER_MAX_PRICE,
  minGradeScore: folderKey.value === 'quality' ? 4 : 0,
  minSellerRating: Number(queryString(route.query.minSellerRating)) || 0,
  minYear: normalizeMarketFilterYear(Number(queryString(route.query.minYear))),
  location: queryString(route.query.location) || (folderKey.value === 'nearby' ? defaultTradeLocation.value : ''),
  locationScope: ['city', 'district', 'neighborhood'].includes(queryString(route.query.locationScope))
    ? queryString(route.query.locationScope) as LocationFilterScope
    : 'district',
});

const draftFilters = reactive<MarketplaceFilters>(initialFilters());
const appliedFilters = ref<MarketplaceFilters>(cloneMarketplaceFilters(draftFilters));

const activeFilterCount = computed(() => countActiveMarketplaceFilters(appliedFilters.value));
const genres = computed(() => {
  const listingGenres = store.listings.map(album => album.genre).filter(Boolean);
  return [...new Set([...defaultGenres, ...listingGenres])];
});
const updateDraftFilters = (filters: MarketplaceFilters) => Object.assign(draftFilters, cloneMarketplaceFilters(filters));

const resetFilters = () => {
  Object.assign(draftFilters, createMarketplaceFilters());
};

const applyFilters = () => {
  appliedFilters.value = cloneMarketplaceFilters(draftFilters);
  showFilters.value = false;
};

const resetAndApplyFilters = () => {
  resetFilters();
  applyFilters();
};

const priceLabel = (price: number) => price > 0 ? `${price.toLocaleString()}원부터` : '가격 확인';
const nearbyNeedsLocation = computed(() => folderKey.value === 'nearby' && !draftFilters.location.trim());
const resultSummary = computed(() => currentFolder.value?.label || (query.value ? `"${query.value}" 검색 결과` : '전체 검색 결과'));
const clearFolderFilter = () => {
  router.replace({ path: '/app/search' });
  query.value = '';
  selectedAlbumKey.value = '';
  sortBy.value = 'recent';
  resetFilters();
  appliedFilters.value = cloneMarketplaceFilters(draftFilters);
};

watch(query, value => {
  selectedAlbumKey.value = '';
  router.replace({ query: { ...route.query, q: value || undefined, albumKey: undefined } });
});
watch(sortBy, value => router.replace({ query: { ...route.query, sort: value === 'recent' ? undefined : value } }));
const filteredAlbums = computed(() => store.listings
  .filter(album => {
    const normalized = query.value.trim().toLowerCase();
    const matchesQuery = matchesAlbumTitle(album, normalized);
    return matchesQuery && matchesMarketplaceFilters(album, appliedFilters.value);
  })
  .sort((a, b) => {
    if (sortBy.value === 'price-low') return a.price - b.price;
    if (sortBy.value === 'price-high') return b.price - a.price;
    if (sortBy.value === 'audio-grade') return (MARKET_GRADE_SCORE[b.audioGrade] ?? 0) - (MARKET_GRADE_SCORE[a.audioGrade] ?? 0) || b.audioScore - a.audioScore;
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
});
</script>

<style scoped>
.search-select {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}

.search-select span {
  color: #4b5563;
  font-size: 0.72rem;
  font-weight: 700;
}

.search-select select {
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

.search-select select:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.14);
}

:global(.dark) .search-select span {
  color: #cbd5e1;
}

:global(.dark) .search-select select {
  border-color: #684831;
  background: #3a271b;
  color: #f8fafc;
}
</style>
