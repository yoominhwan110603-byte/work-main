<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 border-b">
      <div class="flex items-center gap-2 mb-3">
        <button class="p-2" @click="goBack"><ArrowLeft :size="24" /></button>
        <div class="flex-1">
          <div class="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
            <Search :size="18" class="text-gray-400" />
            <input v-model="query" type="text" class="w-full bg-transparent outline-none" placeholder="앨범명, 아티스트, 장르, 카탈로그 번호" autofocus />
          </div>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg" @click="showFilters = !showFilters"><SlidersHorizontal :size="16" /><span class="text-xs">필터</span></button>
        <button class="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg" @click="showSort = !showSort"><span class="text-xs">{{ sortOptions.find(o => o.value === sortBy)?.label }}</span><ChevronDown :size="16" /></button>
      </div>
    </header>

    <div v-if="showFilters" class="px-4 py-3 border-b bg-gray-50 space-y-3 overflow-y-auto max-h-[46vh]">
      <div class="border-b border-gray-200 pb-3">
        <h3 class="text-sm mb-2">장르</h3>
        <div class="flex flex-wrap gap-2">
          <button v-for="genre in genres" :key="genre" :class="chipClass(draftFilters.genres.includes(genre))" @click="toggle(draftFilters.genres, genre)">{{ genre }}</button>
        </div>
      </div>

      <div class="border-b border-gray-200 pb-3">
        <h3 class="text-sm mb-2">가격 범위</h3>
        <div class="flex gap-2 items-center">
          <input v-model="draftFilters.priceMin" type="number" placeholder="최소" class="flex-1 px-3 py-2 border rounded-lg" />
          <span>~</span>
          <input v-model="draftFilters.priceMax" type="number" placeholder="최대" class="flex-1 px-3 py-2 border rounded-lg" />
        </div>
      </div>

      <div class="border-b border-gray-200 pb-3">
        <h3 class="text-sm mb-2">음질 등급</h3>
        <div class="flex flex-wrap gap-2">
          <button v-for="grade in grades" :key="grade" :class="chipClass(draftFilters.audioGrade.includes(grade))" @click="toggle(draftFilters.audioGrade, grade)">{{ grade }}</button>
        </div>
      </div>

      <div class="border-b border-gray-200 pb-3">
        <h3 class="text-sm mb-2">발매 연도</h3>
        <div class="flex gap-2 items-center">
          <input v-model="draftFilters.yearMin" type="number" placeholder="예: 1950" class="flex-1 px-3 py-2 border rounded-lg" />
          <span>~</span>
          <input v-model="draftFilters.yearMax" type="number" placeholder="예: 1980" class="flex-1 px-3 py-2 border rounded-lg" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <label class="flex items-center gap-2 rounded-lg bg-white border px-3 py-2">
          <input v-model="draftFilters.rareOnly" type="checkbox" />
          <span class="text-sm">희귀반만</span>
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
          <option value="">전체</option>
          <option value="4.5">4.5 이상</option>
          <option value="4.8">4.8 이상</option>
          <option value="5">5.0</option>
        </select>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <button class="w-full py-3 rounded-lg border bg-white" @click="resetFilters">필터 초기화</button>
        <button class="w-full py-3 rounded-lg bg-blue-600 text-white" @click="applyFilters">필터 저장</button>
      </div>
    </div>

    <div v-if="showSort" class="border-b bg-white">
      <button v-for="option in sortOptions" :key="option.value" :class="['w-full px-4 py-3 text-left border-b last:border-b-0', sortBy === option.value ? 'bg-blue-50 text-blue-600' : '']" @click="sortBy = option.value; showSort = false">{{ option.label }}</button>
    </div>
    <div class="flex-1 overflow-y-auto">
      <div class="px-4 py-3 text-sm text-gray-600">{{ query ? `"${query}" 검색 결과 ` : '전체 검색 결과 ' }}{{ filteredAlbums.length }}개</div>
      <div class="px-4 pb-4 space-y-3">
        <AlbumCard v-for="album in filteredAlbums" :key="album.id" :album="album" :favorite="store.favorites.includes(album.id)" @toggle="store.toggleFavorite(album.id)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, ChevronDown, Search, SlidersHorizontal } from 'lucide-vue-next';
import { useAppStore } from '../stores/appStore';
import AlbumCard from '../components/AlbumCard.vue';

const router = useRouter();
const route = useRoute();
const store = useAppStore();
const query = ref(String(route.query.q || ''));
const showFilters = ref(false);
const showSort = ref(false);
const sortBy = ref(String(route.query.sort || 'recent'));
type SearchFilters = {
  genres: string[];
  priceMin: string;
  priceMax: string;
  audioGrade: string[];
  rareOnly: boolean;
  firstPressOnly: boolean;
  location: string;
  yearMin: string;
  yearMax: string;
  minSellerRating: string;
};
const initialFilters = (): SearchFilters => ({
  genres: [] as string[],
  priceMin: '',
  priceMax: '',
  audioGrade: [] as string[],
  rareOnly: route.query.rare === 'true',
  firstPressOnly: false,
  location: '',
  yearMin: '',
  yearMax: '',
  minSellerRating: '',
});
const cloneFilters = (value: SearchFilters): SearchFilters => ({
  ...value,
  genres: [...value.genres],
  audioGrade: [...value.audioGrade],
});
const draftFilters = reactive<SearchFilters>(initialFilters());
const appliedFilters = ref<SearchFilters>(cloneFilters(draftFilters));
const genres = ['재즈', '록', '힙합', '클래식', 'R&B/소울', '일렉트로닉', '팝', '펑크/컨트리', '레게', '메탈', '블루스'];
const grades = ['NM', 'VG+', 'VG', 'G+', 'G'];
const sortOptions = [
  { value: 'recent', label: '최신순' },
  { value: 'price-low', label: '낮은 가격순' },
  { value: 'price-high', label: '높은 가격순' },
  { value: 'audio-grade', label: '음질 좋은순' },
  { value: 'popular', label: '인기순' },
];
const gradeScore: Record<string, number> = { NM: 5, 'VG+': 4, VG: 3, 'G+': 2, G: 1 };
const chipClass = (active: boolean) => ['px-3 py-1.5 rounded-full text-sm', active ? 'bg-blue-600 text-white' : 'bg-white border'];
const toggle = (list: string[], value: string) => {
  const index = list.indexOf(value);
  if (index >= 0) list.splice(index, 1);
  else list.push(value);
};
const goBack = () => router.push('/app/search');
const resetFilters = () => {
  draftFilters.genres = [];
  draftFilters.priceMin = '';
  draftFilters.priceMax = '';
  draftFilters.audioGrade = [];
  draftFilters.rareOnly = false;
  draftFilters.firstPressOnly = false;
  draftFilters.location = '';
  draftFilters.yearMin = '';
  draftFilters.yearMax = '';
  draftFilters.minSellerRating = '';
};
const applyFilters = () => {
  appliedFilters.value = cloneFilters(draftFilters);
  showFilters.value = false;
};
watch(query, value => router.replace({ query: { ...route.query, q: value || undefined } }));
const filteredAlbums = computed(() => store.listings
  .filter(album => {
    const normalized = query.value.trim().toLowerCase();
    const fields = [album.title, album.artist, album.genre, album.catalogNumber, album.location].map(value => String(value || '').toLowerCase());
    const matchesQuery = !normalized || fields.some(value => value.includes(normalized));
    const filters = appliedFilters.value;
    const min = filters.priceMin ? Number(filters.priceMin) : null;
    const max = filters.priceMax ? Number(filters.priceMax) : null;
    const yearMin = filters.yearMin ? Number(filters.yearMin) : null;
    const yearMax = filters.yearMax ? Number(filters.yearMax) : null;
    const sellerRating = filters.minSellerRating ? Number(filters.minSellerRating) : null;
    return matchesQuery
      && (filters.genres.length === 0 || filters.genres.includes(album.genre))
      && (filters.audioGrade.length === 0 || filters.audioGrade.includes(album.audioGrade))
      && (!filters.rareOnly || album.isRare)
      && (!filters.firstPressOnly || album.isFirstPress)
      && (!filters.location.trim() || album.location.includes(filters.location.trim()))
      && (sellerRating === null || album.seller.rating >= sellerRating)
      && (min === null || album.price >= min)
      && (max === null || album.price <= max)
      && (yearMin === null || album.year >= yearMin)
      && (yearMax === null || album.year <= yearMax);
  })
  .sort((a, b) => {
    if (sortBy.value === 'price-low') return a.price - b.price;
    if (sortBy.value === 'price-high') return b.price - a.price;
    if (sortBy.value === 'audio-grade') return (gradeScore[b.audioGrade] ?? 0) - (gradeScore[a.audioGrade] ?? 0) || b.audioScore - a.audioScore;
    if (sortBy.value === 'popular') return b.views - a.views;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }));
</script>
