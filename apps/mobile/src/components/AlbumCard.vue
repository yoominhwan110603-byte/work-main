<template>
  <article
    class="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-sm transition-shadow"
    @click="router.push(`/app/album/${album.id}`)"
  >
    <div class="flex gap-3">
      <div class="relative flex-shrink-0">
        <VinylCover :src="album.images[0]" :alt="album.title" class="w-24 h-24 object-cover rounded-lg bg-gray-100" />
        <span v-if="album.isRare" class="absolute top-1 left-1 px-1.5 py-0.5 bg-amber-500 text-white text-xs rounded">
          희귀
        </span>
        <span
          v-if="isOwnListing"
          class="absolute bottom-1 left-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded"
        >
          <UserRoundCheck :size="12" />
          내 상품
        </span>
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2 mb-1">
          <div class="flex-1 min-w-0">
            <h3 class="truncate">{{ album.title }}</h3>
            <p class="text-sm text-gray-600 truncate">{{ album.artist }}</p>
          </div>
          <button class="p-1 flex-shrink-0" aria-label="찜하기" @click.stop="$emit('toggle')">
            <Heart :size="20" :class="favorite ? 'fill-red-500 text-red-500' : 'text-gray-400'" />
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-1.5 mb-2">
          <span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">음질 {{ album.audioGrade }}</span>
          <span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">자켓 {{ album.jacketGrade }}</span>
          <span v-if="album.isFirstPress" class="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
            초반
          </span>
        </div>

        <div class="flex items-end justify-between gap-2">
          <div class="min-w-0">
            <p class="text-lg">{{ album.price.toLocaleString() }}원</p>
            <p class="text-xs text-gray-500 truncate">
              시세 {{ album.priceRange.min.toLocaleString() }}-{{ album.priceRange.max.toLocaleString() }}원
            </p>
          </div>
          <div class="flex items-center gap-1 text-xs text-gray-500 max-w-24">
            <MapPin :size="12" class="shrink-0" />
            <span class="truncate">{{ album.location }}</span>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { computed } from 'vue';
import { Heart, MapPin, UserRoundCheck } from 'lucide-vue-next';
import type { Album } from '../data/mockData';
import VinylCover from './VinylCover.vue';
import { useAppStore } from '../stores/appStore';

defineEmits<{ toggle: [] }>();
const props = defineProps<{ album: Album; favorite: boolean }>();

const router = useRouter();
const store = useAppStore();
const isOwnListing = computed(() => props.album.ownedByMe || props.album.seller.id === store.user.id);
</script>
