<template>
  <div class="size-full bg-white flex flex-col">
    <header class="shrink-0 border-b bg-white px-3 py-3 sm:px-4">
      <div class="flex items-center gap-2">
        <button class="shrink-0 rounded-full p-2 active:bg-gray-100" aria-label="뒤로 가기" @click="goBackOr(router, '/app/search')">
          <ArrowLeft :size="24" />
        </button>
        <div class="min-w-0 flex-1">
          <h1 class="truncate text-lg font-semibold">{{ group?.displayName || 'LP 판본 매물' }}</h1>
          <p class="truncate text-xs text-gray-500">해당 LP 특징의 판매 매물</p>
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
              <span class="truncate">{{ group.displayName }}</span>
            </div>
            <p class="mt-1 text-xs text-gray-500">{{ group.featureDescription }}</p>
          </div>
        </div>
      </section>

      <section v-if="group" class="px-3 py-4 sm:px-4">
        <label v-if="qualityBuckets.length" class="mb-4 block rounded-lg border border-[#8b5e3c] bg-[#704326] p-3">
          <span class="mb-2 block text-sm font-medium text-[#fff8e7]">앨범 등급</span>
          <select v-model="activeQuality" class="w-full rounded-lg border border-[#b78357] bg-[#5b351f] px-3 py-3 text-sm text-[#fff8e7] outline-none">
            <option value="">전체 {{ group.listingCount }}개</option>
            <option v-for="bucket in qualityBuckets" :key="bucket.key" :value="bucket.key">
              {{ bucket.label }} · {{ bucket.listingCount }}개
            </option>
          </select>
        </label>

        <div class="mb-3 flex items-center justify-between gap-2">
          <p class="text-sm text-gray-600">판매 중인 매물 {{ sortedListings.length }}개</p>
          <select v-model="sortBy" class="rounded-lg border border-[#8b5e3c] bg-[#704326] px-2 py-1.5 text-xs text-[#fff8e7] outline-none">
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
            :favorite="store.isFavoriteAlbum(album)"
            @toggle="store.toggleFavorite(album)"
          />
        </div>
      </section>

      <div v-else class="px-4 py-16 text-center text-sm text-gray-500">
        해당 LP 판본의 판매 매물을 찾을 수 없습니다.
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
  void store.loadWishlistFavorites();
});

watch(groupKey, () => {
  activeQuality.value = '';
});
</script>
