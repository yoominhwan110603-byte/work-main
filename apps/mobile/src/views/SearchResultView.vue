<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 border-b">
      <div class="flex items-center gap-2 mb-3">
        <button class="p-2" @click="router.back()"><ArrowLeft :size="24" /></button>
        <div class="flex-1">
          <div class="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
            <Search :size="18" class="text-gray-400" />
            <input v-model="query" type="text" class="w-full bg-transparent outline-none" placeholder="앨범명, 아티스트, 장르, 원본번호" autofocus />
          </div>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="flex items-center gap-2 px-4 py-2 border rounded-lg" @click="showFilters = !showFilters"><SlidersHorizontal :size="18" /><span class="text-sm">필터</span></button>
        <button class="flex items-center gap-2 px-4 py-2 border rounded-lg" @click="showSort = !showSort"><span class="text-sm">{{ sortOptions.find(o => o.value === sortBy)?.label }}</span><ChevronDown :size="18" /></button>
      </div>
    </header>
    <div v-if="showFilters" class="px-4 py-4 border-b bg-gray-50 space-y-4">
      <div>
        <h3 class="text-sm mb-2">장르</h3>
        <div class="flex flex-wrap gap-2">
          <button v-for="genre in genres" :key="genre" :class="['px-3 py-1.5 rounded-full text-sm', filters.genres.includes(genre) ? 'bg-blue-600 text-white' : 'bg-white border']" @click="toggle(filters.genres, genre)">{{ genre }}</button>
        </div>
      </div>
      <div>
        <h3 class="text-sm mb-2">가격 범위</h3>
        <div class="flex gap-2 items-center">
          <input v-model="filters.priceMin" type="number" placeholder="최소" class="flex-1 px-3 py-2 border rounded-lg" />
          <span>~</span>
          <input v-model="filters.priceMax" type="number" placeholder="최대" class="flex-1 px-3 py-2 border rounded-lg" />
        </div>
      </div>
      <div>
        <h3 class="text-sm mb-2">음질 등급</h3>
        <div class="flex gap-2">
          <button v-for="grade in grades" :key="grade" :class="['px-3 py-1.5 rounded-lg text-sm', filters.audioGrade.includes(grade) ? 'bg-blue-600 text-white' : 'bg-white border']" @click="toggle(filters.audioGrade, grade)">{{ grade }}</button>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <input id="rareOnly" v-model="filters.rareOnly" type="checkbox" />
        <label for="rareOnly" class="text-sm">희귀만 보기</label>
      </div>
      <div>
        <h3 class="text-sm mb-2">지역</h3>
        <input v-model="filters.location" type="text" placeholder="예: 서울, 강남구" class="w-full px-3 py-2 border rounded-lg" />
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
const filters = reactive({ genres: [] as string[], priceMin: '', priceMax: '', audioGrade: [] as string[], rareOnly: route.query.rare === 'true', location: '' });
const genres = ['재즈', '록', '힙합', '클래식', 'R&B/소울'];
const grades = ['NM', 'VG+', 'VG', 'G+'];
const sortOptions = [
  { value: 'recent', label: '최신순' },
  { value: 'price-low', label: '낮은 가격순' },
  { value: 'price-high', label: '높은 가격순' },
  { value: 'audio-grade', label: '음질 등급 높은 순' },
  { value: 'popular', label: '인기순' },
];
const gradeScore: Record<string, number> = { NM: 4, 'VG+': 3, VG: 2, 'G+': 1 };
const toggle = (list: string[], value: string) => {
  const index = list.indexOf(value);
  if (index >= 0) list.splice(index, 1);
  else list.push(value);
};
watch(query, value => router.replace({ query: { ...route.query, q: value || undefined } }));
const filteredAlbums = computed(() => store.listings
  .filter(album => {
    const normalized = query.value.trim().toLowerCase();
    const matchesQuery = !normalized || [album.title, album.artist, album.genre, album.catalogNumber, album.location].some(value => value.toLowerCase().includes(normalized));
    const min = filters.priceMin ? Number(filters.priceMin) : null;
    const max = filters.priceMax ? Number(filters.priceMax) : null;
    return matchesQuery && (filters.genres.length === 0 || filters.genres.includes(album.genre)) && (filters.audioGrade.length === 0 || filters.audioGrade.includes(album.audioGrade)) && (!filters.rareOnly || album.isRare) && (!filters.location.trim() || album.location.includes(filters.location.trim())) && (min === null || album.price >= min) && (max === null || album.price <= max);
  })
  .sort((a, b) => {
    if (sortBy.value === 'price-low') return a.price - b.price;
    if (sortBy.value === 'price-high') return b.price - a.price;
    if (sortBy.value === 'audio-grade') return (gradeScore[b.audioGrade] ?? 0) - (gradeScore[a.audioGrade] ?? 0) || b.audioScore - a.audioScore;
    if (sortBy.value === 'popular') return b.views - a.views;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }));
</script>
