<template>
  <div class="size-full bg-gray-50 overflow-y-auto">
    <header class="bg-white px-4 py-4 border-b sticky top-0"><h1 class="text-2xl">찜한 상품</h1><p class="text-sm text-gray-600 mt-1">{{ favoriteAlbums.length }}개</p></header>
    <div v-if="favoriteAlbums.length > 0" class="p-4 space-y-3">
      <AlbumCard v-for="album in favoriteAlbums" :key="album.id" :album="album" :favorite="true" @toggle="store.toggleFavorite(album.id)" />
    </div>
    <div v-else class="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <Heart :size="80" class="text-gray-300 mb-4" />
      <h2 class="text-lg text-gray-600 mb-2">찜한 상품이 없습니다</h2>
      <p class="text-sm text-gray-500">마음에 드는 LP를 찜해보세요</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { Heart } from 'lucide-vue-next';
import { mockAlbums } from '../data/mockData';
import { useAppStore } from '../stores/appStore';
import AlbumCard from '../components/AlbumCard.vue';

const store = useAppStore();
onMounted(() => { if (store.favorites.length === 0) store.favorites = mockAlbums.slice(0, 3).map(album => album.id); });
const favoriteAlbums = computed(() => mockAlbums.filter(album => store.favorites.includes(album.id)));
</script>
