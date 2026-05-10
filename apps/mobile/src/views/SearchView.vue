<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 border-b">
      <div class="flex items-center gap-2">
        <button class="p-2" @click="router.back()"><ArrowLeft :size="24" /></button>
        <div class="flex-1 flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
          <Search :size="20" class="text-gray-400" />
          <input v-model="query" type="text" placeholder="앨범명, 아티스트, 장르, 원본번호" class="flex-1 bg-transparent outline-none" autofocus @input="goIfTyped" @keydown.enter="go" />
          <button v-if="query" class="p-1" @click="query = ''"><X :size="18" class="text-gray-400" /></button>
        </div>
        <button class="px-4 py-2 text-blue-600 disabled:text-gray-300" :disabled="!query.trim()" @click="go">검색</button>
      </div>
    </header>
    <div class="flex-1 overflow-y-auto">
      <section v-if="recentSearches.length > 0" class="py-4 border-b">
        <div class="px-4 flex items-center justify-between mb-3">
          <h2 class="text-sm text-gray-600">최근 검색어</h2>
          <button class="text-sm text-gray-500" @click="recentSearches = []">전체 삭제</button>
        </div>
        <div class="px-4 space-y-2">
          <div v-for="search in recentSearches" :key="search" class="flex items-center justify-between py-2">
            <button class="flex-1 text-left" @click="searchNow(search)">{{ search }}</button>
            <button class="p-2" @click="recentSearches = recentSearches.filter(item => item !== search)"><X :size="16" class="text-gray-400" /></button>
          </div>
        </div>
      </section>
      <section class="py-4">
        <div class="px-4 mb-3"><h2 class="text-sm text-gray-600">추천 검색어</h2></div>
        <div class="px-4 flex flex-wrap gap-2">
          <button v-for="search in recommendedSearches" :key="search" class="px-4 py-2 bg-gray-100 rounded-full text-sm" @click="searchNow(search)">{{ search }}</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, Search, X } from 'lucide-vue-next';

const router = useRouter();
const query = ref('');
const recentSearches = ref(['Miles Davis', 'Kind of Blue', '재즈', 'Pink Floyd']);
const recommendedSearches = ['The Beatles', 'John Coltrane', '희귀 재즈', 'Blue Note', '오리지널 프레스'];
const go = () => { if (query.value.trim()) router.push(`/app/search/results?q=${encodeURIComponent(query.value.trim())}`); };
const goIfTyped = () => { if (query.value.trim()) go(); };
const searchNow = (value: string) => { query.value = value; go(); };
</script>
