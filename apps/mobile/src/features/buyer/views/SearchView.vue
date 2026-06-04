<template>
  <div class="size-full bg-white flex flex-col">
    <header class="shrink-0 px-3 py-3 sm:px-4 sm:py-4 border-b">
      <div class="flex items-center gap-2 mb-3">
        <button class="shrink-0 p-2" @click="router.push('/app')"><ArrowLeft :size="24" /></button>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg sm:px-4">
            <Search :size="18" class="shrink-0 text-gray-400" />
            <input v-model="query" type="text" class="w-full min-w-0 bg-transparent text-sm outline-none sm:text-base" placeholder="앨범명, 아티스트, 태그" autofocus />
            <button v-if="query" class="p-1" @click="query = ''"><X :size="18" class="text-gray-400" /></button>
          </div>
        </div>
      </div>
      <div class="flex gap-2 overflow-x-auto pb-0.5">
        <button class="flex shrink-0 items-center gap-1.5 px-3 py-2 border rounded-lg" @click="showFilters = !showFilters"><SlidersHorizontal :size="16" /><span class="text-xs">필터</span></button>
        <button class="flex shrink-0 items-center gap-1.5 px-3 py-2 border rounded-lg" @click="showSort = !showSort"><span class="text-xs">{{ sortLabel }}</span><ChevronDown :size="16" /></button>
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
      <div class="px-3 py-3 text-sm text-gray-600 sm:px-4">{{ query ? `"${query}" 검색 결과 ` : '전체 검색 결과 ' }}{{ filteredAlbums.length }}개</div>
      <div class="px-3 pb-4 space-y-3 sm:px-4">
        <AlbumCard v-for="album in filteredAlbums" :key="album.id" :album="album" :favorite="store.favorites.includes(album.id)" @toggle="store.toggleFavorite(album.id)" />
      </div>
      <div v-if="filteredAlbums.length === 0" class="px-4 py-12 text-center text-sm text-gray-500">
        조건에 맞는 판매글이 없습니다.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-vue-next';
import { useAppStore } from '@/shared/stores/appStore';
import AlbumCard from '@/shared/components/AlbumCard.vue';
import type { Album } from '@/shared/models/market';

const router = useRouter();
const route = useRoute();
const store = useAppStore();
const query = ref(String(route.query.q || ''));
const showFilters = ref(false);
const showSort = ref(false);
const sortBy = ref(String(route.query.sort || 'recent'));

type SearchFilters = {
  genres: string[];
  priceRange: string;
  audioGrade: string[];
  rareOnly: boolean;
  firstPressOnly: boolean;
  location: string;
  decade: string;
  minSellerRating: string;
  tags: string[];
};
type RangeOption = { value: string; label: string; min?: number; max?: number };

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
  priceRange: '',
  audioGrade: [],
  rareOnly: route.query.rare === 'true',
  firstPressOnly: false,
  location: '',
  decade: '',
  minSellerRating: '',
  tags: [],
});

const cloneFilters = (value: SearchFilters): SearchFilters => ({
  ...value,
  genres: [...value.genres],
  audioGrade: [...value.audioGrade],
  tags: [...value.tags],
});

const draftFilters = reactive<SearchFilters>(initialFilters());
const appliedFilters = ref<SearchFilters>(cloneFilters(draftFilters));
const grades = ['NM', 'VG+', 'VG', 'G+', 'G'];
const sortOptions = [
  { value: 'recent', label: '최신순' },
  { value: 'recommended', label: '추천순' },
  { value: 'price-low', label: '낮은 가격순' },
  { value: 'price-high', label: '높은 가격순' },
  { value: 'audio-grade', label: '음질 좋은순' },
  { value: 'popular', label: '인기순' },
];
const gradeScore: Record<string, number> = { NM: 5, 'VG+': 4, VG: 3, 'G+': 2, G: 1 };
const rarityKeywords = ['희귀', 'rare', '초반', 'first press', 'firstpress', '오리지널', 'original', '한정', 'limited', '프로모', 'promo', '테스트', 'test pressing', '번호판', 'numbered', 'obi'];

const sortLabel = computed(() => sortOptions.find(option => option.value === sortBy.value)?.label || '최신순');
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

watch(query, value => router.replace({ query: { ...route.query, q: value || undefined } }));
watch(sortBy, value => router.replace({ query: { ...route.query, sort: value === 'recent' ? undefined : value } }));

const filteredAlbums = computed(() => store.listings
  .filter(album => {
    const normalized = query.value.trim().toLowerCase();
    const fields = [album.title, album.artist, album.genre, album.catalogNumber, album.location, ...albumTags(album)]
      .map(value => String(value || '').toLowerCase());
    const matchesQuery = !normalized || fields.some(value => value.includes(normalized));
    const filters = appliedFilters.value;
    const priceRange = priceOptions.find(option => option.value === filters.priceRange);
    const decade = decadeOptions.find(option => option.value === filters.decade);
    const sellerRating = filters.minSellerRating ? Number(filters.minSellerRating) : null;
    return matchesQuery
      && (filters.genres.length === 0 || filters.genres.includes(album.genre))
      && (filters.audioGrade.length === 0 || filters.audioGrade.includes(album.audioGrade))
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

onMounted(() => {
  void store.loadListingsFromServer();
});
</script>
