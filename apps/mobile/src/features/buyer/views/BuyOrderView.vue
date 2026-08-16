<template>
  <div class="min-h-screen bg-white">
    <header class="sticky top-0 z-10 flex items-center gap-3 border-b bg-white p-4">
      <button class="p-2" aria-label="뒤로" @click="goBackOr(router, `/app/album/${listingId}`)">
        <ArrowLeft :size="22" />
      </button>
      <div class="min-w-0">
        <h1 class="text-lg font-semibold">구매대기 등록</h1>
        <p class="truncate text-xs text-gray-500">{{ album?.title || 'LP' }}</p>
      </div>
    </header>

    <main class="space-y-5 p-4">
      <section v-if="album" class="space-y-2 rounded-lg border p-4">
        <div class="flex justify-between gap-4 text-sm">
          <span class="text-gray-500">현재 판매가</span>
          <span class="font-semibold">{{ album.price.toLocaleString() }}원</span>
        </div>
        <div class="flex justify-between gap-4 text-sm">
          <span class="text-gray-500">추천 판매가</span>
          <span>{{ formatWon(marketEstimate?.recommendedPrice || album.recommendedPrice) }}</span>
        </div>
        <div class="flex justify-between gap-4 text-sm">
          <span class="text-gray-500">내 구매 희망가</span>
          <span class="text-blue-600">{{ formatWon(form.max_price) }}</span>
        </div>
      </section>

      <section class="space-y-4">
        <label class="block">
          <span class="mb-1 block text-sm text-gray-600">구매 희망가</span>
          <input v-model.number="form.max_price" type="number" min="1000" step="1000" class="w-full rounded-lg border px-4 py-3" placeholder="예: 45000" />
        </label>
      </section>

      <p v-if="message" class="rounded-lg p-3 text-sm" :class="messageTone === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'">
        {{ message }}
      </p>

      <button class="w-full rounded-lg bg-blue-600 py-3 text-white disabled:bg-gray-300" :disabled="submitting || !form.max_price" @click="submitBuyOrder">
        {{ submitting ? '등록 중' : '구매대기 등록' }}
      </button>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
import { findAlbumById } from '@/features/buyer/services/albumLookup';
import { createBuyOrder, fetchMarketPriceEstimate } from '@/shared/services/market';
import type { MarketPriceEstimate } from '@/shared/models/market';
import { goBackOr } from '@/shared/services/navigation';
import { useAppStore } from '@/shared/stores/appStore';

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const listingId = String(route.params.listingId || '');
const album = computed(() => findAlbumById(store, listingId));
const submitting = ref(false);
const message = ref('');
const messageTone = ref<'ok' | 'error'>('ok');
const marketEstimate = ref<MarketPriceEstimate | null>(null);
const form = reactive({
  max_price: 0,
});

const formatWon = (value?: number | null) => typeof value === 'number' && value > 0 ? `${value.toLocaleString()}원` : '-';

onMounted(async () => {
  if (!album.value) await store.loadListingsFromServer();
  if (!album.value) return;
  marketEstimate.value = album.value.market || null;
  form.max_price = album.value.recommendedPrice || album.value.price;
  try {
    marketEstimate.value = await fetchMarketPriceEstimate({ listing_id: album.value.id, price: form.max_price });
  } catch {
    // 구매대기는 listing_id만으로도 등록할 수 있으므로 시세 조회 실패는 막지 않습니다.
  }
});

const submitBuyOrder = async () => {
  if (!listingId || submitting.value) return;
  if (!store.isLoggedIn) {
    messageTone.value = 'error';
    message.value = '로그인 후 구매대기를 등록할 수 있습니다.';
    return;
  }
  submitting.value = true;
  message.value = '';
  try {
    const result = await createBuyOrder({
      buyer_id: store.user.id,
      listing_id: listingId,
      max_price: Number(form.max_price),
    });
    if (result.listing) store.listings = [result.listing, ...store.listings.filter(item => item.id !== result.listing!.id)];
    messageTone.value = 'ok';
    message.value = '구매대기를 등록했습니다. 판매자가 승인하면 채팅에서 거래를 이어갈 수 있습니다.';
    window.setTimeout(() => router.push(`/app/album/${listingId}`), 900);
  } catch (error) {
    messageTone.value = 'error';
    message.value = error instanceof Error ? error.message : '구매대기 등록에 실패했습니다.';
  } finally {
    submitting.value = false;
  }
};
</script>
