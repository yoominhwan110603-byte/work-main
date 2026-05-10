<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 flex items-center border-b"><button class="p-2" @click="router.back()"><ArrowLeft :size="24" /></button><h1 class="ml-4 text-lg">거래 후기 작성</h1></header>
    <div class="flex-1 overflow-y-auto p-4">
      <div class="bg-gray-50 rounded-lg p-4 mb-6"><div class="flex gap-3"><VinylCover :src="album.images[0]" :alt="album.title" class="w-16 h-16 object-cover rounded-lg" /><div><p class="mb-1">{{ album.title }}</p><p class="text-sm text-gray-600">{{ album.artist }}</p></div></div></div>
      <form class="space-y-6" @submit.prevent="submit">
        <div class="text-center">
          <h3 class="mb-4">거래가 어떠셨나요?</h3>
          <div class="flex justify-center gap-2 mb-2"><button v-for="star in [1,2,3,4,5]" :key="star" type="button" class="p-1" @click="rating = star" @mouseenter="hoverRating = star" @mouseleave="hoverRating = 0"><Star :size="40" :class="star <= (hoverRating || rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'" /></button></div>
          <p v-if="rating > 0" class="text-sm text-gray-600">{{ rating === 5 ? '최고예요!' : rating === 4 ? '좋아요' : rating === 3 ? '보통이에요' : rating === 2 ? '별로예요' : '아쉬워요' }}</p>
        </div>
        <div><h3 class="mb-3">거래 경험을 선택해주세요 (선택)</h3><div class="flex flex-wrap gap-2"><button v-for="tag in tags" :key="tag" type="button" :class="['px-4 py-2 rounded-full text-sm', selectedTags.includes(tag) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700']" @click="toggleTag(tag)">{{ tag }}</button></div></div>
        <div><h3 class="mb-3">상세 후기 (선택)</h3><textarea v-model="comment" class="w-full px-4 py-3 border rounded-lg min-h-32" placeholder="거래 경험을 자유롭게 작성해주세요" /></div>
      </form>
    </div>
    <div class="p-4 border-t"><button class="w-full py-4 bg-blue-600 text-white rounded-xl disabled:bg-gray-300" :disabled="rating === 0" @click="submit">후기 등록</button></div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, Star } from 'lucide-vue-next';
import { mockAlbums } from '../data/mockData';
import VinylCover from '../components/VinylCover.vue';

const router = useRouter();
const album = mockAlbums[0];
const rating = ref(0);
const hoverRating = ref(0);
const selectedTags = ref<string[]>([]);
const comment = ref('');
const tags = ['친절해요', '시간 약속을 잘 지켜요', '응답이 빨라요', '상품 상태가 좋아요', '설명이 정확해요', '좋은 거래였어요'];
const toggleTag = (tag: string) => { selectedTags.value = selectedTags.value.includes(tag) ? selectedTags.value.filter(item => item !== tag) : [...selectedTags.value, tag]; };
const submit = () => { if (rating.value > 0) { alert('리뷰가 등록되었습니다'); router.push('/app'); } };
</script>
