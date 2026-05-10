<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 flex items-center border-b bg-white z-10"><button class="p-2" @click="router.back()"><ArrowLeft :size="24" /></button><h1 class="ml-4 text-lg">거래 장소</h1></header>
    <div class="flex-1 relative bg-gray-200"><div class="absolute inset-0 flex items-center justify-center"><p class="text-gray-500">지도 표시 영역</p></div><div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full"><div class="w-8 h-8 bg-red-500 rounded-full border-4 border-white shadow-lg"></div></div></div>
    <div class="bg-white p-4 border-t"><div class="mb-4"><h2 class="mb-2">강남역 2번 출구</h2><p class="text-sm text-gray-600">서울특별시 강남구 강남대로 396</p></div><div class="flex gap-2"><button class="flex-1 py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2"><Navigation :size="20" />길찾기</button><button class="flex-1 py-3 border border-gray-300 rounded-lg" @click="router.back()">확인</button></div></div>
  </div>
</template>
<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ArrowLeft, Navigation } from 'lucide-vue-next';
const router = useRouter();
</script>
