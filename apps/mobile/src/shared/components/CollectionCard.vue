<template>
  <button
    type="button"
    class="group w-full overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-sm transition active:bg-gray-50 dark:border-neutral-800 dark:bg-neutral-900 dark:active:bg-neutral-800"
    :aria-label="`${collection.title}, ${collection.artist || '아티스트 미상'} 컬렉션 상세 보기`"
    @click="router.push(`/app/collection/${collection.id}`)"
  >
    <span class="relative block aspect-square bg-gray-100 dark:bg-neutral-800">
      <VinylCover :src="coverImage" :alt="collection.title" class="h-full w-full object-cover" />
      <span v-if="badges.length" class="absolute left-2 top-2 flex flex-wrap gap-1">
        <span
          v-for="badge in badges"
          :key="badge.label"
          :class="['rounded-full px-2 py-1 text-[11px] font-medium text-white shadow-sm', badge.className]"
        >
          {{ badge.label }}
        </span>
      </span>
    </span>

    <span class="block space-y-2 p-3">
      <span class="block min-w-0">
        <strong class="block truncate text-sm font-semibold text-gray-950 dark:text-neutral-50">{{ collection.title }}</strong>
        <span class="mt-0.5 block truncate text-xs text-gray-500 dark:text-neutral-400">{{ collection.artist || '아티스트 미상' }}</span>
      </span>
      <span class="flex min-w-0 items-center justify-between gap-2 text-xs text-gray-500 dark:text-neutral-400">
        <span class="truncate">{{ collection.year || '연도 미상' }}</span>
        <span v-if="collection.catalogNumber" class="truncate">Cat. {{ collection.catalogNumber }}</span>
      </span>
      <span class="flex min-w-0 items-center justify-between gap-2">
        <span class="truncate text-xs text-gray-500 dark:text-neutral-400">{{ collection.owner.name }}</span>
        <span class="shrink-0 rounded bg-gray-100 px-2 py-1 text-[11px] text-gray-700 dark:bg-neutral-800 dark:text-neutral-200">
          {{ ownershipLabel }}
        </span>
      </span>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { VinylCollection } from '@/shared/models/collection';
import VinylCover from '@/shared/components/VinylCover.vue';

const props = defineProps<{ collection: VinylCollection }>();
const router = useRouter();

const coverImage = computed(() => props.collection.discogsCoverImageUrl || props.collection.images[0] || '');
const ownershipLabel = computed(() => ({
  owned: '보유',
  reserved: '예약',
  lent: '대여',
  sold: '판매됨',
}[props.collection.ownershipStatus || 'owned']));
const badges = computed(() => [
  props.collection.visibility === 'private' ? { label: '비공개', className: 'bg-gray-700' } : null,
].filter(Boolean) as Array<{ label: string; className: string }>);
</script>
