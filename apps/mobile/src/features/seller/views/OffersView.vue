<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 flex items-center border-b">
      <button class="p-2" @click="goBack(router)"><ArrowLeft :size="24" /></button>
      <div class="ml-4 min-w-0">
        <h1 class="text-lg">받은 가격 제안</h1>
        <p v-if="listingTitle" class="truncate text-sm text-gray-500">{{ listingTitle }}</p>
      </div>
      <button
        class="ml-auto p-2 text-gray-600 disabled:text-gray-300"
        type="button"
        title="새로고침"
        aria-label="새로고침"
        :disabled="isLoading"
        @click="loadOffers"
      >
        <RefreshCw :size="20" :class="{ 'animate-spin': isLoading }" />
      </button>
    </header>

    <div class="flex-1 overflow-y-auto bg-gray-50">
      <section class="bg-white">
        <div v-if="isLoading" class="p-6 text-center text-sm text-gray-500">가격 제안을 불러오는 중입니다.</div>
        <div v-else-if="offers.length === 0" class="p-6 text-center text-sm text-gray-500">{{ listingId ? '이 상품에 받은 가격 제안이 없습니다.' : '받은 가격 제안이 없습니다.' }}</div>
        <article v-for="offer in offers" :key="offer.id" class="p-4 border-t">
          <div class="flex gap-3 mb-3">
            <VinylCover :src="offer.album.images[0]" :alt="offer.album.title" class="w-16 h-16 object-cover rounded-lg" />
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-600 mb-1">{{ offer.buyerName }}</p>
              <p class="mb-1 truncate">{{ offer.album.title }}</p>
              <p class="text-xs text-gray-500">{{ new Date(offer.timestamp).toLocaleString('ko-KR') }}</p>
            </div>
          </div>
          <div class="bg-gray-50 rounded-lg p-3 mb-3">
            <div class="flex justify-between items-center mb-2"><span class="text-sm text-gray-600">현재 가격</span><span>{{ offer.album.price.toLocaleString() }}원</span></div>
            <div class="flex justify-between items-center"><span class="text-sm text-gray-600">제안 가격</span><span class="text-lg text-blue-600">{{ offer.offerPrice.toLocaleString() }}원</span></div>
          </div>
          <div v-if="offer.status === 'pending'" class="flex gap-2">
            <button class="flex-1 py-3 bg-blue-600 text-white rounded-lg" @click="accept(offer.id)">수락</button>
            <button class="flex-1 py-3 border border-gray-300 rounded-lg" @click="reject(offer.id)">거절</button>
            <button class="px-4 py-3 border border-blue-600 text-blue-600 rounded-lg" @click="openOfferChat(offer)">채팅</button>
          </div>
          <div v-else class="grid grid-cols-[1fr_auto] gap-2 items-center">
            <p class="text-center py-3 text-sm text-gray-500">{{ offer.status === 'accepted' ? '수락됨' : '거절됨' }}</p>
            <button class="px-4 py-3 border border-blue-600 text-blue-600 rounded-lg" @click="openOfferChat(offer)">채팅</button>
          </div>
        </article>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, RefreshCw } from 'lucide-vue-next';
import type { Album } from '@/shared/models/market';
import { goBack } from '@/shared/services/navigation';
import { fetchApi } from '@/shared/services/api';
import { useAppStore } from '@/shared/stores/appStore';
import { saveActiveTrade } from '@/features/transaction/services/tradeState';
import { makeOneToOneChatId } from '@/features/transaction/services/chatClient';
import VinylCover from '@/shared/components/VinylCover.vue';

interface ReceivedOffer {
  id: string;
  chatId?: string;
  listingId: string;
  album: Album;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  offerPrice: number;
  timestamp: string;
  status: 'pending' | 'accepted' | 'rejected';
}

const router = useRouter();
const route = useRoute();
const store = useAppStore();
const offers = ref<ReceivedOffer[]>([]);
const isLoading = ref(false);
const listingId = computed(() => typeof route.query.listingId === 'string' ? route.query.listingId : '');
const listingTitle = computed(() => listingId.value
  ? store.listings.find(item => item.id === listingId.value)?.title || offers.value[0]?.album.title || ''
  : '');
let loadRequest = 0;

const loadOffers = async () => {
  const request = ++loadRequest;
  const requestedListingId = listingId.value;
  isLoading.value = true;
  offers.value = [];
  try {
    const query = requestedListingId ? `?listing_id=${encodeURIComponent(requestedListingId)}` : '';
    const response = await fetchApi(`/users/${encodeURIComponent(store.user.id)}/offers/received${query}`);
    const payload = await response.json().catch(() => ({})) as { offers?: ReceivedOffer[]; detail?: string };
    if (!response.ok) throw new Error(payload.detail || '가격 제안을 불러오지 못했습니다.');
    if (request !== loadRequest) return;
    offers.value = (payload.offers || []).filter(offer => !requestedListingId || offer.listingId === requestedListingId);
  } catch (error) {
    if (request === loadRequest) alert(error instanceof Error ? error.message : '가격 제안을 불러오지 못했습니다.');
  } finally {
    if (request === loadRequest) isLoading.value = false;
  }
};

const openOfferChat = (offer: ReceivedOffer) => {
  const chatId = offer.chatId || makeOneToOneChatId(offer.album.id, offer.buyerId, store.user.id);
  router.push({
    path: `/transaction/chat/${chatId}`,
    query: {
      listingId: offer.album.id,
      recipientId: offer.buyerId,
      recipientName: offer.buyerName,
    },
  });
};

const updateStatus = async (offerId: string, status: 'accepted' | 'rejected') => {
  const offer = offers.value.find(item => item.id === offerId);
  if (!offer) return;
  const previousStatus = offer.status;
  offer.status = status;
  try {
    const response = await fetchApi(`/offers/${encodeURIComponent(offerId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const payload = await response.json().catch(() => ({})) as { detail?: string; offer?: ReceivedOffer };
    if (!response.ok) throw new Error(payload.detail || '가격 제안 상태 변경에 실패했습니다.');
    if (payload.offer) Object.assign(offer, payload.offer);
    if (status === 'accepted') {
      saveActiveTrade({ albumId: offer.album.id, buyerName: offer.buyerName, offerPrice: offer.offerPrice, acceptedAt: new Date().toISOString(), status: 'selling' });
      store.listings = store.listings.filter(album => album.id !== offer.album.id);
      openOfferChat(offer);
    }
  } catch (error) {
    offer.status = previousStatus;
    alert(error instanceof Error ? error.message : '가격 제안 상태 변경에 실패했습니다.');
  }
};

const accept = (offerId: string) => void updateStatus(offerId, 'accepted');
const reject = (offerId: string) => void updateStatus(offerId, 'rejected');

watch(listingId, loadOffers, { immediate: true });
</script>
