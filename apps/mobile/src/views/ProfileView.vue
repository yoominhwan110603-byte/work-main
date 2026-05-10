<template>
  <div class="size-full bg-gray-50 dark:bg-neutral-950 overflow-y-auto">
    <header class="bg-white dark:bg-neutral-900 px-4 py-4 border-b dark:border-neutral-800">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl">프로필</h1>
        <button v-if="isOwnProfile" class="p-2" @click="router.push('/app/settings')">
          <Settings :size="24" />
        </button>
      </div>
    </header>

    <section class="bg-white dark:bg-neutral-900 p-6 border-b dark:border-neutral-800">
      <div class="flex items-start gap-4 mb-4">
        <div class="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl">
          {{ profileData.name[0] }}
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-xl mb-2 truncate">{{ profileData.name }}</h2>
          <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
            <div class="flex items-center gap-1">
              <Star :size="16" class="text-yellow-500 fill-yellow-500" />
              <span>{{ profileData.rating.toFixed(1) }}</span>
            </div>
            <span>거래 {{ profileData.transactionCount }}건</span>
          </div>
          <div v-if="isOwnProfile" class="mt-2 flex flex-wrap gap-2 text-xs">
            <span class="px-2 py-1 rounded bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
              이메일 {{ store.user.emailVerified ? '인증 완료' : '미인증' }}
            </span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-2 mb-4">
        <div class="rounded-lg bg-gray-50 dark:bg-neutral-800 p-3 text-center">
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">리뷰 평균</p>
          <p class="text-lg">{{ reviewAverage.toFixed(1) }}</p>
        </div>
        <div class="rounded-lg bg-gray-50 dark:bg-neutral-800 p-3 text-center">
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">리뷰 수</p>
          <p class="text-lg">{{ mockReviews.length }}</p>
        </div>
        <div class="rounded-lg bg-gray-50 dark:bg-neutral-800 p-3 text-center">
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">판매 중</p>
          <p class="text-lg">{{ activeSellingCount }}</p>
        </div>
      </div>

      <div v-if="profileData.genres.length > 0" class="flex flex-wrap gap-2 mb-4">
        <span v-for="genre in profileData.genres" :key="genre" class="px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-full text-sm">
          {{ genre }}
        </span>
      </div>

      <button
        v-if="!isOwnProfile"
        class="w-full py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2"
        @click="router.push(`/transaction/chat/${userId}`)"
      >
        <MessageCircle :size="20" />채팅하기
      </button>
    </section>

    <section class="bg-white dark:bg-neutral-900 border-b dark:border-neutral-800">
      <div class="flex">
        <button
          :class="['flex-1 py-4 flex items-center justify-center gap-2', activeTab === 'selling' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500']"
          @click="activeTab = 'selling'"
        >
          <Package :size="20" /><span>판매 목록</span>
        </button>
        <button
          :class="['flex-1 py-4 flex items-center justify-center gap-2', activeTab === 'reviews' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500']"
          @click="activeTab = 'reviews'"
        >
          <Star :size="20" /><span>리뷰</span>
        </button>
      </div>
    </section>

    <section class="p-4">
      <div v-if="activeTab === 'selling'" class="space-y-3">
        <article v-for="album in userListings" :key="album.id" class="bg-white dark:bg-neutral-900 rounded-lg border dark:border-neutral-800 p-3">
          <div class="flex gap-3 cursor-pointer" @click="router.push(`/app/album/${album.id}${isOwnProfile ? '?mine=true' : ''}`)">
            <VinylCover :src="album.images[0]" :alt="album.title" class="w-20 h-20 object-cover rounded-lg" />
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <h3 class="mb-1 truncate">{{ album.title }}</h3>
                  <p class="text-sm text-gray-600 dark:text-gray-300 mb-2 truncate">{{ album.artist }}</p>
                </div>
                <span v-if="tradeStatus(album.id) === 'selling'" class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs whitespace-nowrap">판매 중</span>
                <span v-if="tradeStatus(album.id) === 'completed'" class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs whitespace-nowrap">거래 완료</span>
              </div>
              <p class="text-lg">{{ album.price.toLocaleString() }}원</p>
              <p v-if="isOwnProfile" class="text-xs text-gray-500 mt-1">
                문의 {{ commentSummary(album.id).total }}개 · 미답변 {{ commentSummary(album.id).unanswered }}개
              </p>
            </div>
          </div>

          <div v-if="isOwnProfile" class="mt-3 grid grid-cols-2 gap-2">
            <button
              class="relative py-2 border border-blue-600 text-blue-600 rounded-lg text-sm flex items-center justify-center gap-1"
              @click="router.push(`/transaction/comments/${album.id}`)"
            >
              <MessageCircle :size="16" />
              문의 확인
              <span
                v-if="commentSummary(album.id).unanswered > 0"
                class="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-xs flex items-center justify-center"
              >
                {{ commentSummary(album.id).unanswered }}
              </span>
            </button>
            <button
              class="py-2 bg-blue-600 text-white rounded-lg text-sm disabled:bg-gray-300"
              :disabled="tradeStatus(album.id) !== 'selling'"
              @click="router.push(`/transaction/chat/${album.id}`)"
            >
              거래 채팅
            </button>
          </div>
        </article>
        <div v-if="userListings.length === 0" class="bg-white dark:bg-neutral-900 rounded-lg border dark:border-neutral-800 p-8 text-center text-gray-500">
          등록한 판매글이 없습니다
        </div>
      </div>

      <div v-else class="space-y-4">
        <article v-for="review in mockReviews" :key="review.id" class="bg-white dark:bg-neutral-900 rounded-lg border dark:border-neutral-800 p-4">
          <div class="flex items-center justify-between mb-2">
            <p>{{ review.userName }}</p>
            <div class="flex items-center gap-1">
              <Star :size="16" class="text-yellow-500 fill-yellow-500" />
              <span class="text-sm">{{ review.rating }}</span>
            </div>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-300 mb-2">{{ review.comment }}</p>
          <p class="text-xs text-gray-400">{{ review.albumTitle }}</p>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MessageCircle, Package, Settings, Star } from 'lucide-vue-next';
import { mockAlbums, mockReviews } from '../data/mockData';
import { getActiveTrade, getActiveTrades } from '../data/tradeState';
import { useAppStore } from '../stores/appStore';
import VinylCover from '../components/VinylCover.vue';

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const activeTab = ref<'selling' | 'reviews'>('selling');
const userId = computed(() => String(route.params.userId || ''));
const isOwnProfile = computed(() => !userId.value || userId.value === store.user?.id);
const userListings = computed(() => (
  isOwnProfile.value
    ? mockAlbums.filter(album => album.seller.id === store.user.id)
    : mockAlbums.filter(album => album.seller.id === userId.value)
));
const sellerSource = computed(() => userListings.value[0]?.seller);
const profileData = computed(() => ({
  id: userId.value || store.user?.id || 'seller1',
  name: isOwnProfile.value ? (store.user?.username || '재즈매니아') : (sellerSource.value?.name || '판매자'),
  rating: isOwnProfile.value ? (sellerSource.value?.rating || store.user?.rating || 5.0) : (sellerSource.value?.rating || 0),
  transactionCount: isOwnProfile.value ? (sellerSource.value?.transactionCount || store.user?.transactionCount || 0) : (sellerSource.value?.transactionCount || 0),
  genres: isOwnProfile.value ? (store.user?.genres || ['재즈']) : Array.from(new Set(userListings.value.map(album => album.genre))),
}));
const reviewAverage = computed(() => mockReviews.length ? mockReviews.reduce((sum, review) => sum + review.rating, 0) / mockReviews.length : 0);
const activeSellingCount = computed(() => getActiveTrades().filter(trade => trade.status === 'selling').length);
const tradeStatus = (albumId: string) => getActiveTrade(albumId)?.status;
const commentSummary = (albumId: string) => {
  const seed = albumId.charCodeAt(0);
  const total = (seed % 3) + 1;
  const unanswered = albumId === '1' ? 1 : seed % 2;
  return { total, unanswered };
};
</script>
