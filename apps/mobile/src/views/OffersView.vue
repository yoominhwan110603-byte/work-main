<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 flex items-center border-b">
      <button class="p-2" @click="router.back()"><ArrowLeft :size="24" /></button>
      <h1 class="ml-4 text-lg">받은 가격 제안</h1>
    </header>
    <div class="flex-1 overflow-y-auto">
      <div v-for="offer in offers" :key="offer.id" class="p-4 border-b">
        <div class="flex gap-3 mb-3">
          <VinylCover :src="offer.album.images[0]" :alt="offer.album.title" class="w-16 h-16 object-cover rounded-lg" />
          <div class="flex-1">
            <p class="text-sm text-gray-600 mb-1">{{ offer.buyerName }}</p>
            <p class="mb-1">{{ offer.album.title }}</p>
            <p class="text-xs text-gray-500">{{ new Date(offer.timestamp).toLocaleString('ko-KR') }}</p>
          </div>
        </div>
        <div class="bg-gray-50 rounded-lg p-3 mb-3">
          <div class="flex justify-between items-center mb-2"><span class="text-sm text-gray-600">현재 가격</span><span>{{ offer.album.price.toLocaleString() }}원</span></div>
          <div class="flex justify-between items-center"><span class="text-sm text-gray-600">제안 가격</span><span class="text-lg text-blue-600">{{ offer.offerPrice.toLocaleString() }}원</span></div>
        </div>
        <div v-if="offer.status === 'pending'" class="flex gap-2">
          <button class="flex-1 py-3 bg-blue-600 text-white rounded-lg" @click="accept(offer.id)">수락</button>
          <button class="flex-1 py-3 border border-gray-300 rounded-lg" @click="offer.status = 'rejected'">거절</button>
        </div>
        <div v-else class="text-center py-3 text-sm text-gray-500">{{ offer.status === 'accepted' ? '수락됨' : '거절됨' }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
import { mockAlbums } from '../data/mockData';
import { saveActiveTrade } from '../data/tradeState';
import VinylCover from '../components/VinylCover.vue';

const router = useRouter();
const offers = reactive([
  { id: '1', album: mockAlbums[0], buyerName: 'LP애호가', offerPrice: 250000, timestamp: '2026-04-19T10:30:00', status: 'pending' as 'pending' | 'accepted' | 'rejected' },
  { id: '2', album: mockAlbums[1], buyerName: '음악덕후', offerPrice: 400000, timestamp: '2026-04-18T15:20:00', status: 'pending' as 'pending' | 'accepted' | 'rejected' },
]);
const accept = (offerId: string) => {
  const offer = offers.find(item => item.id === offerId);
  if (!offer) return;
  saveActiveTrade({ albumId: offer.album.id, buyerName: offer.buyerName, offerPrice: offer.offerPrice, acceptedAt: new Date().toISOString(), status: 'selling' });
  offer.status = 'accepted';
  alert('가격 제안이 수락되었습니다');
};
</script>
