<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 flex items-center border-b">
      <button class="p-2" @click="router.back()">
        <ArrowLeft :size="24" />
      </button>
      <h1 class="ml-4 text-lg">진행 중인 거래</h1>
    </header>

    <main class="flex-1 overflow-y-auto p-4 space-y-6">
      <section class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div class="flex items-center gap-2 mb-2">
          <CheckCircle2 :size="20" class="text-blue-600" />
          <span class="text-sm">거래 진행 중</span>
        </div>
        <p class="text-xs text-gray-600">채팅에서 약속 장소와 시간을 확인하고 안전하게 거래하세요.</p>
      </section>

      <section class="bg-gray-50 rounded-lg p-4">
        <div class="flex gap-3">
          <VinylCover :src="album.images[0]" :alt="album.title" class="w-20 h-20 object-cover rounded-lg" />
          <div>
            <h2 class="mb-1">{{ album.title }}</h2>
            <p class="text-sm text-gray-600 mb-2">{{ album.artist }}</p>
            <p class="text-xl text-blue-600">{{ transaction.price.toLocaleString() }}원</p>
          </div>
        </div>
      </section>

      <section>
        <h2 class="text-sm text-gray-600 mb-3">거래 상대</h2>
        <div class="bg-white border rounded-lg p-4 flex items-center justify-between">
          <div>
            <p>{{ transaction.buyer.name }}</p>
            <p class="text-sm text-gray-600">연락은 앱 채팅으로만 진행합니다.</p>
          </div>
          <button class="px-3 py-2 border border-blue-600 text-blue-600 rounded-lg text-sm" @click="router.push(`/transaction/chat/${transactionId}`)">
            채팅
          </button>
        </div>
      </section>

      <section>
        <h2 class="text-sm text-gray-600 mb-3">약속 정보</h2>
        <div class="bg-white border rounded-lg p-4 space-y-3">
          <div>
            <p class="text-sm text-gray-600 mb-1">일시</p>
            <p>{{ new Date(transaction.meetingTime).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-600 mb-1">장소</p>
            <div class="flex items-center justify-between gap-3">
              <p>{{ transaction.meetingLocation }}</p>
              <button class="text-blue-600 text-sm flex items-center gap-1" @click="router.push(`/transaction/location/${transactionId}`)">
                <MapPin :size="16" />지도
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p class="text-sm text-yellow-900">
          <strong>안전 거래 안내</strong><br />
          공공장소에서 만나고, LP 상태를 직접 확인한 뒤 거래를 완료하세요.
        </p>
      </section>
    </main>

    <footer class="p-4 border-t space-y-2">
      <button class="w-full py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2" @click="router.push(`/transaction/chat/${transactionId}`)">
        <MessageCircle :size="20" />채팅하기
      </button>
      <div class="flex gap-2">
        <button class="flex-1 py-3 border border-blue-600 text-blue-600 rounded-lg" @click="router.push(`/transaction/review/${transactionId}`)">거래 완료</button>
        <button class="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg" @click="router.push(`/transaction/cancel/${transactionId}`)">거래 취소</button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, CheckCircle2, MapPin, MessageCircle } from 'lucide-vue-next';
import { mockAlbums } from '../data/mockData';
import VinylCover from '../components/VinylCover.vue';

const route = useRoute();
const router = useRouter();
const transactionId = computed(() => String(route.params.transactionId || '1'));
const album = mockAlbums[0];
const transaction = { buyer: { name: 'LP애호가' }, price: 250000, meetingLocation: '강남역 2번 출구', meetingTime: '2026-04-20T14:00:00' };
</script>
