<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 flex items-center border-b">
      <button class="p-2" @click="router.back()"><ArrowLeft :size="24" /></button>
      <h1 class="ml-4 text-lg">거래 후기 작성</h1>
    </header>

    <div class="flex-1 overflow-y-auto p-4">
      <div class="bg-gray-50 rounded-lg p-4 mb-6">
        <div class="flex gap-3">
          <VinylCover :src="album.images[0]" :alt="album.title" class="w-16 h-16 object-cover rounded-lg" />
          <div>
            <p class="mb-1">{{ album.title }}</p>
            <p class="text-sm text-gray-600">{{ album.artist }}</p>
            <p class="text-xs text-gray-500 mt-1">판매자 {{ album.seller.name }}</p>
          </div>
        </div>
      </div>

      <form class="space-y-6" @submit.prevent="submit">
        <div class="text-center">
          <h3 class="mb-4">거래가 어땠나요?</h3>
          <div class="flex justify-center gap-2 mb-2">
            <button v-for="star in [1,2,3,4,5]" :key="star" type="button" class="p-1" @click="rating = star" @mouseenter="hoverRating = star" @mouseleave="hoverRating = 0">
              <Star :size="40" :class="star <= (hoverRating || rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'" />
            </button>
          </div>
          <p v-if="rating > 0" class="text-sm text-gray-600">{{ ratingText }}</p>
        </div>

        <div>
          <h3 class="mb-3">거래 경험을 선택해 주세요</h3>
          <div class="flex flex-wrap gap-2">
            <button v-for="tag in tags" :key="tag" type="button" :class="['px-4 py-2 rounded-full text-sm', selectedTags.includes(tag) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700']" @click="toggleTag(tag)">{{ tag }}</button>
          </div>
        </div>

        <div>
          <h3 class="mb-3">상세 후기</h3>
          <textarea v-model="comment" class="w-full px-4 py-3 border rounded-lg min-h-32" placeholder="포장, 설명 정확도, 응답 속도 등을 적어 주세요." />
        </div>
        <p v-if="message" :class="['text-sm', messageType === 'error' ? 'text-red-600' : 'text-blue-600']">{{ message }}</p>
      </form>
    </div>

    <div class="p-4 border-t">
      <button class="w-full py-4 bg-blue-600 text-white rounded-xl disabled:bg-gray-300" :disabled="rating === 0 || isSubmitting" @click="submit">
        {{ isSubmitting ? '등록 중...' : '후기 등록' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Star } from 'lucide-vue-next';
import { useAppStore } from '@/shared/stores/appStore';
import { fallbackAlbum } from '@/features/buyer/services/albumLookup';
import VinylCover from '@/shared/components/VinylCover.vue';

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const transactionId = computed(() => String(route.params.transactionId || ''));
const album = computed(() => fallbackAlbum(store, transactionId.value));
const rating = ref(0);
const hoverRating = ref(0);
const selectedTags = ref<string[]>([]);
const comment = ref('');
const isSubmitting = ref(false);
const message = ref('');
const messageType = ref<'info' | 'error'>('info');
const tags = ['친절해요', '시간 약속을 지켜요', '응답이 빨라요', '상품 상태가 좋아요', '설명이 정확해요', '다시 거래하고 싶어요'];
const ratingText = computed(() => rating.value === 5 ? '최고예요!' : rating.value === 4 ? '좋아요' : rating.value === 3 ? '보통이에요' : rating.value === 2 ? '별로예요' : '아쉬워요');

const toggleTag = (tag: string) => {
  selectedTags.value = selectedTags.value.includes(tag)
    ? selectedTags.value.filter(item => item !== tag)
    : [...selectedTags.value, tag];
};

const submit = async () => {
  if (rating.value === 0 || isSubmitting.value) return;
  isSubmitting.value = true;
  message.value = '';
  try {
    await store.submitReview({
      revieweeId: album.value.seller.id,
      rating: rating.value,
      comment: comment.value,
      tags: selectedTags.value,
      albumId: album.value.id,
      albumTitle: album.value.title,
      transactionId: transactionId.value,
    });
    message.value = '리뷰가 등록되었습니다.';
    messageType.value = 'info';
    router.push(`/app/profile/${album.value.seller.id}`);
  } catch (error) {
    message.value = error instanceof Error ? error.message : '리뷰 등록에 실패했습니다.';
    messageType.value = 'error';
  } finally {
    isSubmitting.value = false;
  }
};
</script>
