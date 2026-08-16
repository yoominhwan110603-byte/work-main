<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 flex items-center border-b">
      <button class="p-2" @click="router.back()"><ArrowLeft :size="24" /></button>
      <h1 class="ml-4 text-lg">채팅 요청</h1>
    </header>

    <div class="flex-1 overflow-y-auto bg-gray-50">
      <section class="bg-white border-b">
        <div class="px-4 pt-4 pb-2 flex items-center justify-between">
          <h2 class="font-medium">사용자별 채팅 요청</h2>
          <button class="text-sm text-blue-600" @click="loadAll">새로고침</button>
        </div>
        <div v-if="isLoading" class="p-6 text-center text-sm text-gray-500">채팅 요청을 불러오는 중입니다.</div>
        <div v-else-if="chatRequests.length === 0" class="p-6 text-center text-sm text-gray-500">받은 채팅 요청이 없습니다.</div>
        <button
          v-for="request in chatRequests"
          :key="request.chatId"
          class="w-full p-4 border-t flex gap-3 text-left active:bg-gray-50"
          @click="openChat(request)"
        >
          <VinylCover :src="request.album?.images?.[0]" :alt="request.album?.title || 'LP'" class="w-14 h-14 object-cover rounded-lg bg-gray-100" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="text-sm font-medium truncate">{{ request.participantName }}</p>
              <span v-if="request.isUnread" class="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
            </div>
            <p class="text-sm text-gray-600 truncate">{{ request.album?.title || request.listingId }}</p>
            <p class="text-sm text-gray-500 truncate mt-1">{{ request.lastMessage }}</p>
          </div>
          <span class="text-xs text-gray-400 whitespace-nowrap">{{ formatTime(request.timestamp) }}</span>
        </button>
      </section>

      <section class="mt-3 bg-white">
        <div class="px-4 pt-4 pb-2">
          <h2 class="font-medium">받은 가격 제안</h2>
        </div>
        <div v-if="isLoading" class="p-6 text-center text-sm text-gray-500">가격 제안을 불러오는 중입니다.</div>
        <div v-else-if="offers.length === 0" class="p-6 text-center text-sm text-gray-500">받은 가격 제안이 없습니다.</div>
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
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
import type { Album } from '@/shared/models/market';
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

interface ChatRequest {
  id: string;
  chatId: string;
  listingId: string;
  album?: Album;
  participantId: string;
  participantName: string;
  lastMessage: string;
  timestamp: string;
  isUnread: boolean;
}

const router = useRouter();
const store = useAppStore();
const offers = ref<ReceivedOffer[]>([]);
const chatRequests = ref<ChatRequest[]>([]);
const isLoading = ref(false);

const loadOffers = async () => {
  const response = await fetchApi(`/users/${encodeURIComponent(store.user.id)}/offers/received`);
  const payload = await response.json().catch(() => ({})) as { offers?: ReceivedOffer[]; detail?: string };
  if (!response.ok) throw new Error(payload.detail || '가격 제안을 불러오지 못했습니다.');
  offers.value = payload.offers || [];
};

const loadChatRequests = async () => {
  const response = await fetchApi(`/users/${encodeURIComponent(store.user.id)}/chat-requests`);
  const payload = await response.json().catch(() => ({})) as { requests?: ChatRequest[]; detail?: string };
  if (!response.ok) throw new Error(payload.detail || '채팅 요청을 불러오지 못했습니다.');
  chatRequests.value = payload.requests || [];
};

const loadAll = async () => {
  isLoading.value = true;
  try {
    await Promise.all([loadOffers(), loadChatRequests()]);
  } catch (error) {
    alert(error instanceof Error ? error.message : '요청 목록을 불러오지 못했습니다.');
  } finally {
    isLoading.value = false;
  }
};

const openChat = (request: ChatRequest) => {
  router.push({
    path: `/transaction/chat/${request.chatId}`,
    query: {
      listingId: request.listingId,
      recipientId: request.participantId,
      recipientName: request.participantName,
    },
  });
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

const formatTime = (timestamp: string) => new Date(timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });

onMounted(loadAll);
</script>
