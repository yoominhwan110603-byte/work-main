<template>
  <div v-if="album" class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 flex items-center justify-between border-b sticky top-0 bg-white z-10">
      <button class="p-2" @click="router.back()"><ArrowLeft :size="24" /></button>
      <div class="flex gap-2">
        <button class="p-2" aria-label="공유"><Share2 :size="22" /></button>
        <button class="p-2" aria-label="신고" @click="router.push(`/report/album/${album.id}`)"><Flag :size="22" /></button>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto">
      <div class="relative">
        <VinylCover :src="album.images[currentImageIndex]" :alt="album.title" class="w-full aspect-square object-cover" />
        <div v-if="album.images.length > 1" class="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
          <button
            v-for="(_, index) in album.images"
            :key="index"
            :class="['w-2 h-2 rounded-full', index === currentImageIndex ? 'bg-white' : 'bg-white/50']"
            @click="currentImageIndex = index"
          />
        </div>
      </div>

      <div class="p-4 space-y-4">
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <h1 class="text-2xl mb-1">{{ album.title }}</h1>
            <p class="text-lg text-gray-600">{{ album.artist }}</p>
          </div>
          <button v-if="showMarketplaceMetrics" class="p-2" aria-label="찜하기" @click="store.toggleFavorite(album.id)">
            <Heart :size="28" :class="store.favorites.includes(album.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'" />
          </button>
        </div>

        <div class="flex items-center gap-2 text-sm text-gray-600">
          <span>{{ album.year }}년</span>
          <span>·</span>
          <span>{{ album.genre }}</span>
          <template v-if="showMarketplaceMetrics">
            <span>·</span>
            <Eye :size="14" />
            <span>{{ album.views }}</span>
          </template>
          <template v-if="isOwnListing && !isCompletedTrade">
            <span>·</span>
            <span class="text-blue-600">판매 중</span>
          </template>
          <template v-if="isCompletedTrade">
            <span>·</span>
            <span class="text-green-600">거래 완료</span>
          </template>
        </div>

        <div v-if="album.isRare" class="flex gap-2">
          <span v-if="album.isFirstPress" class="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">초반 추정</span>
          <span class="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">희귀반</span>
        </div>

        <section class="bg-blue-50 p-4 rounded-lg">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg">Vinyl-Check 감정</h2>
            <div class="flex items-center gap-1 text-blue-600"><BadgeCheck :size="18" /><span class="text-sm">인증됨</span></div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div><p class="text-sm text-gray-600 mb-1">음질 등급</p><p class="text-2xl">{{ album.audioGrade }}</p></div>
            <div><p class="text-sm text-gray-600 mb-1">음질 점수</p><p class="text-2xl text-blue-600">{{ album.audioScore }}점</p></div>
            <div><p class="text-sm text-gray-600 mb-1">자켓 상태</p><p class="text-lg">{{ album.jacketGrade }}</p></div>
            <div><p class="text-sm text-gray-600 mb-1">판본</p><p class="text-lg">{{ album.isFirstPress ? '초반 추정' : '확인 필요' }}</p></div>
          </div>
        </section>

        <section class="bg-neutral-900 text-white p-4 rounded-lg">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"><Volume2 :size="20" /></div>
              <div class="min-w-0">
                <h2 class="text-lg">LP 샘플</h2>
                <p class="text-sm text-white/70 truncate">{{ album.title }} 음질 확인용 3초 샘플</p>
              </div>
            </div>
            <button class="px-4 py-2 bg-white text-neutral-900 rounded-lg flex items-center gap-2 disabled:bg-white/60" :disabled="samplePlaying" @click="playSample">
              <Play :size="16" />{{ samplePlaying ? '재생 중' : '듣기' }}
            </button>
          </div>
        </section>

        <section>
          <h2 class="text-lg mb-2">판본 정보</h2>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between"><span class="text-gray-600">카탈로그 번호</span><span>{{ album.catalogNumber }}</span></div>
            <div class="flex justify-between"><span class="text-gray-600">발매 연도</span><span>{{ album.year }}년</span></div>
          </div>
        </section>

        <section class="bg-gray-50 p-4 rounded-lg">
          <p class="text-3xl mb-2">{{ album.price.toLocaleString() }}원</p>
          <p class="text-sm text-gray-600">시세: {{ album.priceRange.min.toLocaleString() }}원 ~ {{ album.priceRange.max.toLocaleString() }}원</p>
          <p v-if="album.price < album.priceRange.min" class="text-sm text-green-600 mt-1">시세보다 낮습니다</p>
          <p v-if="album.price > album.priceRange.max" class="text-sm text-orange-600 mt-1">시세보다 높습니다</p>
        </section>

        <section>
          <h2 class="text-lg mb-2">상세 설명</h2>
          <p class="text-gray-700 whitespace-pre-line">{{ album.description }}</p>
        </section>

        <section class="border-t pt-4">
          <h2 class="text-lg mb-3">판매자 정보</h2>
          <div class="flex items-center gap-3 cursor-pointer" @click="router.push(`/app/profile/${album.seller.id}`)">
            <div class="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center"><span class="text-lg">{{ album.seller.name[0] }}</span></div>
            <div class="flex-1">
              <p>{{ album.seller.name }}</p>
              <div class="flex items-center gap-2 text-sm text-gray-600"><span>평점 {{ album.seller.rating }}</span><span>·</span><span>거래 {{ album.seller.transactionCount }}회</span></div>
            </div>
          </div>
        </section>

        <div class="flex items-center gap-2 text-gray-600"><MapPin :size="18" /><span>{{ album.location }}</span></div>
      </div>
    </div>

    <div v-if="isOwnListing" class="border-t p-4 grid grid-cols-3 gap-2">
      <button class="py-3 border border-blue-600 text-blue-600 rounded-lg flex items-center justify-center gap-1 text-sm" @click="router.push('/transaction/offers/received')">
        <ClipboardList :size="18" />제안
      </button>
      <button class="py-3 border border-blue-600 text-blue-600 rounded-lg flex items-center justify-center gap-1 text-sm" @click="router.push(`/transaction/comments/${album.id}`)">
        <MessageCircle :size="18" />답변
      </button>
      <button class="py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-1 text-sm disabled:bg-gray-300" :disabled="!activeTrade" @click="router.push(`/transaction/chat/${album.id}`)">
        <MessageCircle :size="18" />채팅
      </button>
    </div>
    <div v-else class="border-t p-4 flex gap-3">
      <button class="flex-1 py-3 border border-blue-600 text-blue-600 rounded-lg" @click="router.push(`/transaction/comments/${album.id}`)">문의하기</button>
      <button class="flex-1 py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2" @click="router.push(`/transaction/chat/${album.id}`)">
        <MessageCircle :size="20" />채팅하기
      </button>
    </div>
  </div>
  <div v-else>앨범을 찾을 수 없습니다</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, BadgeCheck, ClipboardList, Eye, Flag, Heart, MapPin, MessageCircle, Play, Share2, Volume2 } from 'lucide-vue-next';
import { mockAlbums } from '../data/mockData';
import { getActiveTrade } from '../data/tradeState';
import { useAppStore } from '../stores/appStore';
import VinylCover from '../components/VinylCover.vue';

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const album = computed(() => mockAlbums.find(item => item.id === route.params.id));
const currentImageIndex = ref(0);
const samplePlaying = ref(false);
const isOwnListing = computed(() => Boolean(album.value && (route.query.mine === 'true' || album.value.seller.id === store.user.id)));
const activeTrade = computed(() => album.value ? getActiveTrade(album.value.id) : undefined);
const isCompletedTrade = computed(() => activeTrade.value?.status === 'completed');
const showMarketplaceMetrics = computed(() => !isOwnListing.value && !isCompletedTrade.value);

const playSample = () => {
  if (samplePlaying.value || !album.value) return;
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;
  const context = new AudioContextCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(album.value.genre === '재즈' ? 392 : 330, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(album.value.genre === '재즈' ? 523 : 440, context.currentTime + 2.8);
  gain.gain.setValueAtTime(0.001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 3);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 3);
  samplePlaying.value = true;
  oscillator.onended = () => {
    samplePlaying.value = false;
    context.close();
  };
};
</script>
