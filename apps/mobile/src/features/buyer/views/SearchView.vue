<template>
  <div class="size-full bg-white flex flex-col">
    <header class="shrink-0 px-3 py-3 sm:px-4 sm:py-4 border-b">
      <div class="flex items-center gap-2">
        <button class="shrink-0 p-2" @click="router.push('/app')"><ArrowLeft :size="24" /></button>
        <div class="min-w-0 flex-1">
          <div class="flex min-h-11 items-center gap-2 rounded-lg bg-gray-100 px-3 sm:px-4">
            <Search :size="18" class="shrink-0 text-gray-400" />
            <input v-model="query" type="text" class="w-full min-w-0 bg-transparent text-sm outline-none sm:text-base" placeholder="앨범, 아티스트, 카탈로그 번호 검색" autofocus />
            <button v-if="query" class="p-1" @click="query = ''"><X :size="18" class="text-gray-400" /></button>
          </div>
        </div>
        <button
          type="button"
          :class="['relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border', showFilters || activeFilterCount > 0 ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-700']"
          aria-label="필터"
          @click="showFilters = !showFilters; showSort = false"
        >
          <SlidersHorizontal :size="18" />
          <span v-if="activeFilterCount > 0" class="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] text-white">
            {{ activeFilterCount }}
          </span>
        </button>
        <button
          type="button"
          :class="['flex h-11 max-w-[6.3rem] shrink-0 items-center justify-center gap-1 rounded-lg border px-2', showSort ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-700']"
          aria-label="정렬"
          @click="showSort = !showSort; showFilters = false"
        >
          <span class="truncate text-xs font-medium">{{ sortLabel }}</span>
          <ChevronDown :size="15" class="shrink-0" />
        </button>
      </div>
    </header>

    <button v-if="showFilters" type="button" class="fixed inset-0 z-20 bg-black/20 sm:hidden" aria-label="필터 닫기" @click="showFilters = false"></button>

    <div v-if="showFilters" class="fixed inset-x-0 bottom-0 z-30 max-h-[82dvh] overflow-y-auto rounded-t-2xl border-t bg-gray-50 px-3 py-4 shadow-2xl space-y-4 sm:static sm:z-auto sm:max-h-[56vh] sm:rounded-none sm:border-t-0 sm:border-b sm:px-4 sm:py-3 sm:shadow-none">
      <div class="flex items-center justify-between sm:hidden">
        <p class="text-sm font-medium">검색 필터</p>
        <button type="button" class="rounded-lg px-3 py-2 text-xs text-gray-500" @click="showFilters = false">닫기</button>
      </div>

      <div v-if="genres.length" class="border-b border-gray-200 pb-3">
        <h3 class="text-sm mb-2">장르</h3>
        <div class="flex flex-wrap gap-2">
          <button v-for="genre in genres" :key="genre" :class="chipClass(draftFilters.genres.includes(genre))" @click="toggle(draftFilters.genres, genre)">{{ genre }}</button>
        </div>
      </div>

      <div class="border-b border-gray-200 pb-3">
        <h3 class="text-sm mb-2">가격대</h3>
        <div class="flex flex-wrap gap-2">
          <button v-for="option in priceOptions" :key="option.value" :class="chipClass(draftFilters.priceRange === option.value)" @click="draftFilters.priceRange = option.value">{{ option.label }}</button>
        </div>
      </div>

      <div class="border-b border-gray-200 pb-3">
        <h3 class="text-sm mb-2">음질 등급</h3>
        <div class="flex flex-wrap gap-2">
          <button v-for="grade in grades" :key="grade" :class="chipClass(draftFilters.audioGrade.includes(grade))" @click="toggle(draftFilters.audioGrade, grade)">{{ grade }}</button>
        </div>
      </div>

      <div class="border-b border-gray-200 pb-3">
        <h3 class="text-sm mb-2">발매년도</h3>
        <div class="flex flex-wrap gap-2">
          <button v-for="option in decadeOptions" :key="option.value" :class="chipClass(draftFilters.decade === option.value)" @click="draftFilters.decade = option.value">{{ option.label }}</button>
        </div>
      </div>

      <div v-if="popularTags.length" class="border-b border-gray-200 pb-3">
        <h3 class="text-sm mb-2">태그</h3>
        <div class="flex flex-wrap gap-2">
          <button v-for="tag in popularTags" :key="tag" :class="chipClass(draftFilters.tags.includes(tag))" @click="toggle(draftFilters.tags, tag)">{{ displayTag(tag) }}</button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label class="flex items-center gap-2 rounded-lg bg-white border px-3 py-2">
          <input v-model="draftFilters.rareOnly" type="checkbox" />
          <span class="text-sm">희귀판만</span>
        </label>
        <label class="flex items-center gap-2 rounded-lg bg-white border px-3 py-2">
          <input v-model="draftFilters.firstPressOnly" type="checkbox" />
          <span class="text-sm">초반 추정</span>
        </label>
      </div>

      <div class="border-b border-gray-200 pb-3">
        <h3 class="text-sm mb-2">지역</h3>
        <input v-model="draftFilters.location" type="text" placeholder="예: 서울, 강남구" class="w-full px-3 py-2 border rounded-lg" />
      </div>

      <div class="border-b border-gray-200 pb-3">
        <h3 class="text-sm mb-2">판매자 평점</h3>
        <select v-model="draftFilters.minSellerRating" class="w-full px-3 py-2 border rounded-lg bg-white">
          <option v-for="option in ratingOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </div>

      <div class="sticky bottom-0 -mx-3 grid grid-cols-2 gap-2 border-t bg-gray-50 px-3 pb-1 pt-3 sm:static sm:mx-0 sm:border-t-0 sm:p-0">
        <button class="w-full py-3 rounded-lg border bg-white" @click="resetFilters">필터 초기화</button>
        <button class="w-full py-3 rounded-lg bg-blue-600 text-white" @click="applyFilters">필터 적용</button>
      </div>
    </div>

    <div v-if="showSort" class="border-b bg-white">
      <button v-for="option in sortOptions" :key="option.value" :class="['w-full px-4 py-3 text-left border-b last:border-b-0', sortBy === option.value ? 'bg-blue-50 text-blue-600' : '']" @click="sortBy = option.value; showSort = false">{{ option.label }}</button>
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

      <div class="border-b bg-gray-50 px-3 py-2 sm:px-4">
        <div class="flex min-h-9 items-center justify-between gap-3">
          <p class="min-w-0 truncate text-xs text-gray-500">
            {{ selectedAlbum ? `카탈로그 ${selectedPressingGroups.length}개` : `${resultSummary} · 앨범 ${albumGroups.length}개` }}
          </p>
          <button
            v-if="selectedAlbum"
            type="button"
            class="shrink-0 rounded-lg border bg-white px-3 py-2 text-xs text-blue-600"
            @click="clearSelectedAlbum"
          >
            다른 앨범
          </button>
        </div>
      </div>

      <section v-if="!selectedAlbum" class="px-3 pb-4 space-y-3 sm:px-4">
        <button
          v-for="group in albumGroups"
          :key="group.key"
          type="button"
          class="w-full rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm active:bg-gray-50"
          @click="selectAlbumGroup(group.key)"
        >
          <div class="flex gap-3">
            <VinylCover :src="group.coverImage" :alt="group.title" class="h-24 w-24 shrink-0 rounded-lg bg-gray-100 object-cover" />
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <h2 class="truncate text-base font-semibold text-gray-950">{{ group.title }}</h2>
                  <p class="mt-1 truncate text-sm text-gray-500">{{ group.artist }}</p>
                </div>
                <ChevronRight :size="18" class="shrink-0 text-gray-400" />
              </div>
              <div class="mt-2 flex flex-wrap gap-1.5 text-xs">
                <span class="rounded bg-blue-50 px-2 py-1 text-blue-700">카탈로그 {{ group.catalogCount }}개</span>
                <span class="rounded bg-emerald-50 px-2 py-1 text-emerald-700">{{ group.bestQualityLabel }}</span>
                <span class="rounded bg-gray-100 px-2 py-1 text-gray-700">매물 {{ group.listingCount }}개</span>
              </div>
              <p class="mt-2 truncate text-xs text-gray-500">
                {{ group.pressings.slice(0, 3).map(pressing => pressing.catalogNumber).join(' · ') || '카탈로그 번호 미상' }}
              </p>
            </div>
          </div>
        </button>
      </section>

      <section v-else class="px-3 pb-4 space-y-3 sm:px-4">
        <div class="rounded-lg border bg-white p-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-medium text-gray-950">2. 카탈로그 번호 선택</p>
              <p class="mt-1 text-xs text-gray-500">카탈로그 번호를 누르면 같은 판본의 상품만 품질별로 확인합니다.</p>
            </div>
            <span class="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">{{ selectedPressingGroups.length }}개</span>
          </div>
        </div>

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
                <h3 class="truncate text-base font-semibold text-gray-950">{{ pressing.catalogNumber }}</h3>
                <span class="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">{{ pressing.listingCount }}개</span>
              </div>
              <p class="mt-1 truncate text-xs text-gray-500">{{ pressingDescription(pressing) }}</p>
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
import { ArrowLeft, ChevronDown, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-vue-next';
import { useAppStore } from '@/shared/stores/appStore';
import VinylCover from '@/shared/components/VinylCover.vue';
import { groupListingsByAlbum, groupListingsByPressing, matchesAlbumTitle, type AlbumProductGroup, type PressingGroup } from '@/features/buyer/services/pressingCatalog';
import type { Album } from '@/shared/models/market';

const router = useRouter();
const route = useRoute();
const store = useAppStore();
const query = ref(String(route.query.q || ''));
const showFilters = ref(route.query.filters === '1');
const showSort = ref(false);
const sortBy = ref(String(route.query.sort || 'recent'));

type SearchFilters = {
  genres: string[];
  priceRange: string;
  audioGrade: string[];
  quality: string;
  instantOnly: boolean;
  rareOnly: boolean;
  firstPressOnly: boolean;
  location: string;
  decade: string;
  minSellerRating: string;
  tags: string[];
};
type RangeOption = { value: string; label: string; min?: number; max?: number };

const queryString = (value: unknown) => Array.isArray(value) ? String(value[0] || '') : String(value || '');
const selectedAlbumKey = ref(queryString(route.query.albumKey));
const folderKey = computed(() => queryString(route.query.folder));
const folderMeta: Record<string, { label: string; description: string }> = {
  rare: { label: '희귀/초판 폴더', description: '초판, 희귀반, 한정반을 모아봤습니다.' },
  'low-price': { label: '낮은 가격 폴더', description: '5만원 이하 매물을 낮은 가격순으로 보여줍니다.' },
  nearby: { label: '내 주변 폴더', description: '기본 거래 지역과 가까운 매물을 보여줍니다.' },
  quality: { label: '고품질 폴더', description: 'NM, VG+ 또는 음질 점수 85점 이상 매물입니다.' },
  instant: { label: '즉시 판매 가능 폴더', description: '구매 대기와 매칭되어 바로 거래 가능한 매물입니다.' },
  recent: { label: '최근 등록 폴더', description: '새로 올라온 LP를 최신순으로 보여줍니다.' },
};
const currentFolder = computed(() => folderMeta[folderKey.value] || null);

const priceOptions: RangeOption[] = [
  { value: '', label: '전체' },
  { value: 'under-50000', label: '5만원 이하', max: 50000 },
  { value: '50000-100000', label: '5~10만원', min: 50000, max: 100000 },
  { value: '100000-200000', label: '10~20만원', min: 100000, max: 200000 },
  { value: '200000-500000', label: '20~50만원', min: 200000, max: 500000 },
  { value: 'over-500000', label: '50만원 이상', min: 500000 },
];

const decadeOptions: RangeOption[] = [
  { value: '', label: '전체' },
  ...[1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020].map(year => ({
    value: String(year),
    label: `${year}년대`,
    min: year,
    max: year + 9,
  })),
];

const ratingOptions = [
  { value: '', label: '전체' },
  { value: '2.5', label: '2.5 이상' },
  { value: '3', label: '3.0 이상' },
  { value: '3.5', label: '3.5 이상' },
  { value: '4', label: '4.0 이상' },
  { value: '4.5', label: '4.5 이상' },
  { value: '5', label: '5.0' },
];

const initialFilters = (): SearchFilters => ({
  genres: [],
  priceRange: queryString(route.query.priceRange),
  audioGrade: [],
  quality: queryString(route.query.quality),
  instantOnly: queryString(route.query.instant) === 'true',
  rareOnly: route.query.rare === 'true' || folderKey.value === 'rare',
  firstPressOnly: false,
  location: queryString(route.query.location),
  decade: '',
  minSellerRating: '',
  tags: [],
});

const cloneFilters = (value: SearchFilters): SearchFilters => ({
  ...value,
  genres: [...value.genres],
  audioGrade: [...value.audioGrade],
  quality: value.quality,
  instantOnly: value.instantOnly,
  tags: [...value.tags],
});

const draftFilters = reactive<SearchFilters>(initialFilters());
const appliedFilters = ref<SearchFilters>(cloneFilters(draftFilters));
const grades = ['NM', 'VG+', 'VG', 'G+', 'G'];
const sortOptions = [
  { value: 'recent', label: '최신순' },
  { value: 'recommended', label: '상태순' },
  { value: 'price-low', label: '낮은 가격순' },
  { value: 'price-high', label: '높은 가격순' },
  { value: 'audio-grade', label: '음질 좋은순' },
  { value: 'popular', label: '인기순' },
];
const gradeScore: Record<string, number> = { NM: 5, 'VG+': 4, VG: 3, 'G+': 2, G: 1 };
const rarityKeywords = ['희귀', 'rare', '초반', 'first press', 'firstpress', '오리지널', 'original', '한정', 'limited', '프로모', 'promo', '테스트', 'test pressing', '번호판', 'numbered', 'obi'];

const sortLabel = computed(() => sortOptions.find(option => option.value === sortBy.value)?.label || '최신순');
const activeFilterCount = computed(() => {
  const filters = appliedFilters.value;
  return filters.genres.length
    + filters.audioGrade.length
    + filters.tags.length
    + Number(Boolean(filters.priceRange))
    + Number(Boolean(filters.quality))
    + Number(filters.instantOnly)
    + Number(filters.rareOnly)
    + Number(filters.firstPressOnly)
    + Number(Boolean(filters.location.trim()))
    + Number(Boolean(filters.decade))
    + Number(Boolean(filters.minSellerRating));
});
const chipClass = (active: boolean) => ['px-2.5 py-1.5 rounded-full text-xs sm:px-3 sm:text-sm', active ? 'bg-blue-600 text-white' : 'bg-white border'];
const normalizeTag = (tag: string) => tag.trim().replace(/^#/, '').toLowerCase();
const displayTag = (tag: string) => tag.startsWith('#') ? tag : `#${tag}`;
const albumTags = (album: Album) => Array.isArray(album.tags) ? album.tags.filter(Boolean) : [];
const genres = computed(() => [...new Set(store.listings.map(album => album.genre).filter(Boolean))]);
const popularTags = computed(() => {
  const counts = new Map<string, number>();
  store.listings.forEach(album => {
    albumTags(album).forEach(tag => {
      const normalized = normalizeTag(tag);
      if (normalized) counts.set(normalized, (counts.get(normalized) || 0) + 1);
    });
  });
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 10)
    .map(([tag]) => tag);
});

const toggle = (list: string[], value: string) => {
  const index = list.indexOf(value);
  if (index >= 0) list.splice(index, 1);
  else list.push(value);
};

const resetFilters = () => {
  draftFilters.genres = [];
  draftFilters.priceRange = '';
  draftFilters.audioGrade = [];
  draftFilters.quality = '';
  draftFilters.instantOnly = false;
  draftFilters.rareOnly = false;
  draftFilters.firstPressOnly = false;
  draftFilters.location = '';
  draftFilters.decade = '';
  draftFilters.minSellerRating = '';
  draftFilters.tags = [];
};

const applyFilters = () => {
  appliedFilters.value = cloneFilters(draftFilters);
  showFilters.value = false;
};

const matchesRareCriteria = (album: Album) => {
  const analysis = album.analysisReport || {};
  const pressing = String((analysis as Record<string, unknown>).pressing || '');
  const haystack = [...albumTags(album), album.genre, pressing].join(' ').toLowerCase();
  return Boolean(album.isRare || album.isFirstPress || rarityKeywords.some(keyword => haystack.includes(keyword)));
};

const matchesSelectedTags = (album: Album, selectedTags: string[]) => {
  if (!selectedTags.length) return true;
  const tags = albumTags(album).map(normalizeTag);
  return selectedTags.every(tag => tags.includes(normalizeTag(tag)));
};

const matchesHighQuality = (album: Album) => ['NM', 'VG+'].includes(album.audioGrade) || album.audioScore >= 85;
const matchesInstantSale = (album: Album) => Boolean(album.market?.instantSaleAvailable || Number(album.instantSalePrice || 0) > 0);
const nearbyNeedsLocation = computed(() => folderKey.value === 'nearby' && !draftFilters.location.trim());
const resultSummary = computed(() => currentFolder.value?.label || (query.value ? `"${query.value}" 검색 결과` : '전체 검색 결과'));
const clearFolderFilter = () => {
  router.replace({ path: '/app/search/results' });
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

const filteredAlbums = computed(() => store.listings
  .filter(album => {
    const normalized = query.value.trim().toLowerCase();
    const matchesQuery = matchesAlbumTitle(album, normalized);
    const filters = appliedFilters.value;
    const priceRange = priceOptions.find(option => option.value === filters.priceRange);
    const decade = decadeOptions.find(option => option.value === filters.decade);
    const sellerRating = filters.minSellerRating ? Number(filters.minSellerRating) : null;
    return matchesQuery
      && (filters.genres.length === 0 || filters.genres.includes(album.genre))
      && (filters.audioGrade.length === 0 || filters.audioGrade.includes(album.audioGrade))
      && (!filters.quality || (filters.quality === 'high' && matchesHighQuality(album)))
      && (!filters.instantOnly || matchesInstantSale(album))
      && (!filters.rareOnly || matchesRareCriteria(album))
      && (!filters.firstPressOnly || album.isFirstPress)
      && (!filters.location.trim() || album.location.includes(filters.location.trim()))
      && matchesSelectedTags(album, filters.tags)
      && (sellerRating === null || album.seller.rating >= sellerRating)
      && (!priceRange?.min || album.price >= priceRange.min)
      && (!priceRange?.max || album.price <= priceRange.max)
      && (!decade?.min || album.year >= decade.min)
      && (!decade?.max || album.year <= decade.max);
  })
  .sort((a, b) => {
    if (sortBy.value === 'price-low') return a.price - b.price;
    if (sortBy.value === 'price-high') return b.price - a.price;
    if (sortBy.value === 'audio-grade') return (gradeScore[b.audioGrade] ?? 0) - (gradeScore[a.audioGrade] ?? 0) || b.audioScore - a.audioScore;
    if (sortBy.value === 'popular') return b.views - a.views;
    if (sortBy.value === 'recommended') return Number(matchesRareCriteria(b)) - Number(matchesRareCriteria(a)) || b.audioScore - a.audioScore || b.views - a.views;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }));

const pressingGroups = computed(() => groupListingsByPressing(filteredAlbums.value));
const albumGroups = computed(() => groupListingsByAlbum(filteredAlbums.value));
const selectedAlbum = computed(() => albumGroups.value.find(group => group.key === selectedAlbumKey.value) || null);
const selectedPressingGroups = computed(() => selectedAlbum.value ? groupListingsByPressing(selectedAlbum.value.pressings.flatMap(pressing => pressing.listings)) : []);

const selectAlbumGroup = (key: string) => {
  selectedAlbumKey.value = key;
  router.replace({ query: { ...route.query, q: query.value || undefined, albumKey: key } });
};

const clearSelectedAlbum = () => {
  selectedAlbumKey.value = '';
  router.replace({ query: { ...route.query, albumKey: undefined } });
};

const pressingDescription = (pressing: PressingGroup) => [
  pressing.releaseLabel,
  pressing.releaseCountry,
  pressing.year ? `${pressing.year}년` : '',
  pressing.bestQualityLabel,
].filter(Boolean).join(' · ') || '판본 상세 정보 확인';

const openPressing = (key: string) => {
  router.push({ path: '/app/pressing', query: { key } });
};

onMounted(() => {
  void store.loadListingsFromServer();
  if (nearbyNeedsLocation.value) showFilters.value = true;
});
</script>
