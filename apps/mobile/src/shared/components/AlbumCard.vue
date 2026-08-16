<template>
  <article
    class="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm"
    @click="router.push(`/app/album/${album.id}`)"
  >
    <div class="flex items-center gap-4">
      <div class="relative flex-shrink-0">
        <VinylCover :src="album.images[0]" :alt="album.title" class="h-24 w-24 rounded-lg bg-gray-100 object-cover" />
      </div>

      <div class="min-w-0 flex-1">
        <div class="mb-3 flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-gray-600">{{ album.artist || '아티스트 미상' }}</p>
            <h3 class="mt-1 truncate font-semibold text-gray-950">{{ album.title }}</h3>
          </div>
          <span class="shrink-0 rounded-md bg-emerald-600 px-2.5 py-1 text-sm font-bold text-white shadow-sm">
            {{ album.audioGrade || '-' }}
          </span>
        </div>

        <div class="flex items-center justify-between gap-3">
          <p class="truncate text-lg font-semibold text-gray-950">{{ album.price.toLocaleString() }}원</p>
          <button class="shrink-0 p-1" aria-label="찜하기" @click.stop="$emit('toggle')">
            <Heart :size="20" :class="favorite ? 'fill-red-500 text-red-500' : 'text-gray-400'" />
          </button>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Heart } from 'lucide-vue-next';
import type { Album } from '@/shared/models/market';
import VinylCover from './VinylCover.vue';

defineEmits<{ toggle: [] }>();
defineProps<{ album: Album; favorite: boolean }>();

const router = useRouter();
</script>
