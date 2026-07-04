<template>
  <div class="min-h-screen bg-white">
    <header class="sticky top-0 z-10 bg-white border-b p-4 flex items-center gap-3">
      <button class="p-2" aria-label="뒤로" @click="goBackOr(router, `/app/album/${listingId}`)">
        <ArrowLeft :size="22" />
      </button>
      <div>
        <h1 class="text-lg font-semibold">구매 대기 등록</h1>
        <p class="text-xs text-gray-500">{{ album?.title || 'LP' }}</p>
      </div>
    </header>

    <main class="p-4 space-y-5">
      <section v-if="album" class="border rounded-lg p-4 space-y-2">
        <div class="flex justify-between gap-4 text-sm">
          <span class="text-gray-500">기준가</span>
          <span>{{ marketEstimate?.basePrice.toLocaleString() || album.basePrice?.toLocaleString() || '-' }}원</span>
        </div>
        <div class="flex justify-between gap-4 text-sm">
          <span class="text-gray-500">추천 판매가</span>
          <span>{{ marketEstimate?.recommendedPrice.toLocaleString() || album.recommendedPrice?.toLocaleString() || '-' }}원</span>
        </div>
        <div class="flex justify-between gap-4 text-sm">
          <span class="text-gray-500">현재 판매가</span>
          <span class="font-semibold">{{ album.price.toLocaleString() }}원</span>
        </div>
      </section>

      <section class="space-y-4">
        <label class="block">
          <span class="block text-sm text-gray-600 mb-1">희망 최대 가격</span>
          <input v-model.number="form.max_price" type="number" class="w-full px-4 py-3 border rounded-lg" placeholder="예: 45000" />
        </label>

        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="block text-sm text-gray-600 mb-1">최소 음반 등급</span>
            <select v-model="form.min_media_grade" class="w-full px-3 py-3 border rounded-lg bg-white">
              <option v-for="grade in grades" :key="grade" :value="grade">{{ grade }}</option>
            </select>
          </label>
          <label class="block">
            <span class="block text-sm text-gray-600 mb-1">최소 자켓 등급</span>
            <select v-model="form.min_sleeve_grade" class="w-full px-3 py-3 border rounded-lg bg-white">
              <option v-for="grade in grades" :key="grade" :value="grade">{{ grade }}</option>
            </select>
          </label>
        </div>

        <label class="block">
          <span class="block text-sm text-gray-600 mb-1">판본 조건</span>
          <input v-model="form.pressing_condition" class="w-full px-4 py-3 border rounded-lg" placeholder="예: 일본반, 초판, 리이슈" />
        </label>

        <label class="flex items-center gap-2 text-sm">
          <input v-model="form.is_first_press_only" type="checkbox" class="w-4 h-4" />
          초판만 구매 대기
        </label>

        <label class="block">
          <span class="block text-sm text-gray-600 mb-1">지역 조건</span>
          <input v-model="form.region_preference" class="w-full px-4 py-3 border rounded-lg" placeholder="예: 서울, 강남" />
        </label>
      </section>

      <p v-if="message" class="p-3 rounded-lg text-sm" :class="messageTone === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'">
        {{ message }}
      </p>

      <button class="w-full py-3 rounded-lg bg-blue-600 text-white disabled:bg-gray-300" :disabled="submitting || !form.max_price" @click="submitBuyOrder">
        {{ submitting ? '등록 중' : '구매 대기 등록' }}
      </button>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
import { findAlbumById } from '@/features/buyer/services/albumLookup';
import { fetchMarketPriceEstimate, createBuyOrder } from '@/shared/services/market';
import type { MarketPriceEstimate } from '@/shared/models/market';
import { goBackOr } from '@/shared/services/navigation';
import { useAppStore } from '@/shared/stores/appStore';

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const listingId = String(route.params.listingId || '');
const album = computed(() => findAlbumById(store, listingId));
const grades = ['NM', 'VG+', 'VG', 'G+', 'G'];
const submitting = ref(false);
const message = ref('');
const messageTone = ref<'ok' | 'error'>('ok');
const marketEstimate = ref<MarketPriceEstimate | null>(null);
const form = reactive({
  max_price: 0,
  min_media_grade: 'VG',
  min_sleeve_grade: 'VG',
  pressing_condition: '',
  is_first_press_only: false,
  region_preference: '',
});

onMounted(async () => {
  if (!album.value) await store.loadListingsFromServer();
  if (album.value) {
    marketEstimate.value = album.value.market || null;
    form.max_price = album.value.recommendedPrice || album.value.price;
    form.min_media_grade = album.value.audioGrade || 'VG';
    form.min_sleeve_grade = album.value.jacketGrade || 'VG';
    try {
      marketEstimate.value = await fetchMarketPriceEstimate({ listing_id: album.value.id, price: form.max_price });
    } catch {
      // The buy order can still be registered against the listing id.
    }
  }
});

const submitBuyOrder = async () => {
  if (!listingId || submitting.value) return;
  submitting.value = true;
  message.value = '';
  try {
    const result = await createBuyOrder({
      buyer_id: store.user.id,
      listing_id: listingId,
      max_price: Number(form.max_price),
      min_media_grade: form.min_media_grade,
      min_sleeve_grade: form.min_sleeve_grade,
      pressing_condition: form.pressing_condition || undefined,
      is_first_press_only: form.is_first_press_only,
      region_preference: form.region_preference || undefined,
    });
    if (result.listing) store.listings = [result.listing, ...store.listings.filter(item => item.id !== result.listing!.id)];
    messageTone.value = 'ok';
    message.value = '구매 대기를 등록했습니다. 판매자가 즉시 판매를 누르면 이 가격으로 거래가 매칭됩니다.';
  } catch (error) {
    messageTone.value = 'error';
    message.value = error instanceof Error ? error.message : '구매 대기 등록에 실패했습니다.';
  } finally {
    submitting.value = false;
  }
};
</script>
