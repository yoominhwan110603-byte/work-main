<template>
  <div class="size-full bg-white flex flex-col">
    <header class="shrink-0 border-b bg-white px-3 py-3 sm:px-4">
      <div class="flex items-center gap-2">
        <button class="shrink-0 rounded-full p-2 active:bg-gray-100" aria-label="뒤로 가기" @click="goBackOr(router, '/app/search')">
          <ArrowLeft :size="24" />
        </button>
        <div class="min-w-0 flex-1">
          <h1 class="truncate text-lg font-semibold">{{ group?.catalogNumber || '카탈로그 매물' }}</h1>
          <p class="truncate text-xs text-gray-500">해당 카탈로그 번호의 판매 매물</p>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto">
      <section v-if="group" class="border-b bg-gray-50 px-4 py-4">
        <div class="flex gap-3">
          <VinylCover :src="group.coverImage" :alt="group.title" class="h-24 w-24 shrink-0 rounded-lg bg-gray-100 object-cover" />
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-lg font-medium">{{ group.title }}</h2>
            <p class="truncate text-sm text-gray-600">{{ group.artist }}</p>
            <div class="mt-2 inline-flex max-w-full rounded-md bg-blue-100 px-2.5 py-1 text-sm font-semibold text-blue-700">
              <span class="truncate">{{ group.catalogNumber }}</span>
            </div>
            <p class="mt-1 text-xs text-gray-500">{{ releaseDescription }}</p>
          </div>
        </div>
      </section>

      <section v-if="group" class="px-3 py-4 sm:px-4">
        <div v-if="qualityBuckets.length" class="mb-4 space-y-2">
          <p class="text-sm font-medium text-gray-800">품질별 상품구분</p>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              :class="['rounded-lg border px-3 py-2 text-left', activeQuality === '' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'bg-white text-gray-700']"
              @click="activeQuality = ''"
            >
              <span class="block text-sm font-medium">전체</span>
              <span class="mt-0.5 block text-xs text-gray-500">{{ group.listingCount }}개 매물</span>
            </button>
            <button
              v-for="bucket in qualityBuckets"
              :key="bucket.key"
              type="button"
              :class="['rounded-lg border px-3 py-2 text-left', activeQuality === bucket.key ? 'border-blue-600 bg-blue-50 text-blue-700' : 'bg-white text-gray-700']"
              @click="activeQuality = activeQuality === bucket.key ? '' : bucket.key"
            >
              <span class="block text-sm font-medium">{{ bucket.label }}</span>
              <span class="mt-0.5 block text-xs text-gray-500">{{ bucket.listingCount }}개 · {{ bucket.description }}</span>
            </button>
          </div>
        </div>

        <div class="mb-3 flex items-center justify-between gap-2">
          <p class="text-sm text-gray-600">판매 중인 매물 {{ sortedListings.length }}개</p>
          <select v-model="sortBy" class="rounded-lg border bg-white px-2 py-1.5 text-xs">
            <option value="price">낮은 가격순</option>
            <option value="quality">음질 좋은순</option>
            <option value="recent">최신순</option>
          </select>
        </div>
        <div class="space-y-3">
          <AlbumCard
            v-for="album in sortedListings"
            :key="album.id"
            :album="album"
            :favorite="store.favorites.includes(album.id)"
            @toggle="store.toggleFavorite(album.id)"
          />
        </div>
      </section>

      <div v-else class="px-4 py-16 text-center text-sm text-gray-500">
        해당 카탈로그 번호의 판매 매물을 찾을 수 없습니다.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
import { groupListingsByPressing } from '@/features/buyer/services/pressingCatalog';
import { goBackOr } from '@/shared/services/navigation';
import { useAppStore } from '@/shared/stores/appStore';
import AlbumCard from '@/shared/components/AlbumCard.vue';
import VinylCover from '@/shared/components/VinylCover.vue';

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const sortBy = ref<'price' | 'quality' | 'recent'>('price');
const activeQuality = ref('');
const groupKey = computed(() => String(route.query.key || ''));
const group = computed(() => groupListingsByPressing(store.listings).find(item => item.key === groupKey.value));
const qualityBuckets = computed(() => group.value?.qualityBuckets || []);
const releaseDescription = computed(() => group.value
  ? [group.value.releaseLabel, group.value.releaseCountry, group.value.year ? `${group.value.year}년` : ''].filter(Boolean).join(' · ') || '판본 상세 정보 확인'
  : '');
const qualityFilteredListings = computed(() => {
  const listings = group.value?.listings || [];
  if (!activeQuality.value) return listings;
  return qualityBuckets.value.find(bucket => bucket.key === activeQuality.value)?.listings || [];
});
const sortedListings = computed(() => [...qualityFilteredListings.value].sort((left, right) => {
  if (sortBy.value === 'quality') return right.audioScore - left.audioScore || left.price - right.price;
  if (sortBy.value === 'recent') return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  return left.price - right.price;
}));

onMounted(async () => {
  if (!group.value) await store.loadListingsFromServer();
});

watch(groupKey, () => {
  activeQuality.value = '';
});
</script>
