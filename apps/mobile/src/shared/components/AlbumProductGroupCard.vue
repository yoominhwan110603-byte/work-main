<template>
  <article class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
    <div class="flex gap-3">
      <VinylCover :src="group.coverImage" :alt="group.title" class="h-24 w-24 shrink-0 rounded-lg bg-gray-100 object-cover" />
      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="truncate text-base font-semibold text-gray-950">{{ group.title }}</h3>
            <p class="mt-1 truncate text-sm text-gray-500">{{ group.artist }}</p>
          </div>
          <span class="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">{{ group.listingCount }}개</span>
        </div>
        <div class="mt-2 flex flex-wrap gap-1.5 text-xs">
          <span class="rounded bg-blue-50 px-2 py-1 text-blue-700">LP 판본 {{ group.catalogCount }}개</span>
          <span class="rounded bg-emerald-50 px-2 py-1 text-emerald-700">{{ group.bestQualityLabel }}</span>
          <span class="rounded bg-gray-100 px-2 py-1 text-gray-700">{{ priceLabel(group.lowestPrice) }}</span>
        </div>
      </div>
    </div>

    <div class="mt-3 divide-y rounded-lg border border-gray-100">
      <button
        v-for="pressing in visiblePressings"
        :key="pressing.key"
        type="button"
        class="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-gray-50"
        @click="openPressing(pressing.key)"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="truncate text-sm font-medium text-gray-950">{{ pressing.displayName }}</span>
            <span class="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">{{ pressing.listingCount }}개</span>
          </div>
          <p class="mt-1 truncate text-xs text-gray-500">{{ pressing.featureDescription }}</p>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <span
              v-for="bucket in pressing.qualityBuckets.slice(0, 3)"
              :key="`${pressing.key}-${bucket.key}`"
              class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
            >
              {{ bucket.label }} {{ bucket.listingCount }}
            </span>
          </div>
        </div>
        <ChevronRight :size="18" class="shrink-0 text-gray-400" />
      </button>
      <div v-if="hiddenPressingCount > 0" class="px-3 py-2 text-xs text-gray-400">
        LP 판본 {{ hiddenPressingCount }}개 더 있음
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ChevronRight } from 'lucide-vue-next';
import type { AlbumProductGroup } from '@/features/buyer/services/pressingCatalog';
import VinylCover from './VinylCover.vue';

const props = defineProps<{ group: AlbumProductGroup }>();
const router = useRouter();

const visiblePressings = computed(() => props.group.pressings.slice(0, 4));
const hiddenPressingCount = computed(() => Math.max(0, props.group.pressings.length - visiblePressings.value.length));

const priceLabel = (price: number) => price > 0 ? `${price.toLocaleString()}원부터` : '가격 확인';

const openPressing = (key: string) => router.push({
  path: '/app/pressing',
  query: { key },
});
</script>
