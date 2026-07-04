<template>
  <article
    class="cursor-pointer rounded-xl border border-gray-200 bg-white p-3 transition-shadow hover:shadow-sm"
    @click="openPressing"
  >
    <div class="flex gap-3">
      <VinylCover :src="group.coverImage" :alt="group.title" class="h-24 w-24 shrink-0 rounded-lg bg-gray-100 object-cover" />
      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="truncate text-sm text-gray-500">{{ group.title }}</p>
            <p class="truncate text-xs text-gray-500">{{ group.artist }}</p>
          </div>
          <ChevronRight :size="20" class="shrink-0 text-gray-400" />
        </div>

        <div class="mt-2 inline-flex max-w-full items-center rounded-md bg-blue-50 px-2.5 py-1 text-sm font-semibold text-blue-700">
          <span class="truncate">{{ group.catalogNumber }}</span>
        </div>
        <p class="mt-1 truncate text-xs text-gray-500">{{ pressingDescription }}</p>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <span
            v-for="bucket in group.qualityBuckets.slice(0, 3)"
            :key="bucket.key"
            class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
          >
            {{ bucket.label }} {{ bucket.listingCount }}
          </span>
        </div>

        <div class="mt-2 flex items-end justify-between gap-2">
          <p class="text-sm font-medium">{{ priceLabel }}</p>
          <span class="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">매물 {{ group.listingCount }}개</span>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ChevronRight } from 'lucide-vue-next';
import type { PressingGroup } from '@/features/buyer/services/pressingCatalog';
import VinylCover from './VinylCover.vue';

const props = defineProps<{ group: PressingGroup }>();
const router = useRouter();

const pressingDescription = computed(() => [
  props.group.releaseLabel,
  props.group.releaseCountry,
  props.group.year ? `${props.group.year}년` : '',
].filter(Boolean).join(' · ') || '판본 상세 정보 확인');

const priceLabel = computed(() => props.group.lowestPrice
  ? `${props.group.lowestPrice.toLocaleString()}원부터`
  : '가격 확인');

const openPressing = () => router.push({
  path: '/app/pressing',
  query: { key: props.group.key },
});
</script>
