<template>
  <div class="size-full bg-white text-gray-900 flex flex-col">
    <header class="px-4 py-4 flex items-center border-b"><button class="p-2" @click="router.back()"><ArrowLeft :size="24" /></button><h1 class="ml-4 text-lg">판매 리포트</h1></header>
    <div class="flex-1 overflow-y-auto p-4 space-y-6">
      <div class="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
        <p class="text-sm opacity-90 mb-2">현재 판매 가격</p><p class="text-4xl mb-6">{{ report.currentPrice.toLocaleString() }}원</p>
        <div class="grid grid-cols-2 gap-4 text-sm"><div><p class="opacity-75 mb-1">평균 시세</p><p class="text-xl">{{ report.avgPrice.toLocaleString() }}원</p></div><div><p class="opacity-75 mb-1">가격 범위</p><p class="text-xl">{{ report.minPrice.toLocaleString() }}-{{ (report.maxPrice / 10000).toFixed(0) }}만</p></div></div>
      </div>
      <div><div class="flex items-center gap-2 mb-4"><TrendingUp :size="20" /><h2 class="text-lg">가격 추이</h2></div><div class="bg-gray-50 rounded-lg p-4 h-[200px] flex items-end gap-3"><div v-for="item in priceData" :key="item.date" class="flex-1 flex flex-col items-center gap-2"><div class="w-full rounded-t bg-blue-500" :style="{ height: `${item.price / 3}px` }"></div><span class="text-xs text-gray-500">{{ item.date }}</span></div></div></div>
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-green-50 rounded-lg p-4"><div class="flex items-center gap-2 mb-2 text-green-600"><CheckCircle2 :size="20" /><span class="text-sm">게시 상태</span></div><p class="text-2xl">게시 완료</p><p class="text-xs text-green-700 mt-1">판매 검색 결과에 노출됩니다</p></div>
        <div class="bg-blue-50 rounded-lg p-4"><div class="flex items-center gap-2 mb-2 text-blue-600"><BadgeCheck :size="20" /><span class="text-sm">분석 인증</span></div><p class="text-2xl">{{ report.audioGrade }}</p><p class="text-xs text-blue-700 mt-1">음질 점수 {{ report.audioScore }}점</p></div>
      </div>
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4"><p class="text-sm text-yellow-900"><strong>가격 제안</strong><br />현재 가격은 평균 시세보다 약간 높습니다. 빠른 거래를 원한다면 27만원으로 조정하는 것을 추천합니다.</p></div>
    </div>
    <div class="p-4 border-t"><button class="w-full py-4 bg-blue-600 text-white rounded-xl" @click="router.push('/app')">확인</button></div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ArrowLeft, BadgeCheck, CheckCircle2, TrendingUp } from 'lucide-vue-next';
const router = useRouter();
const priceData = [{ date: '3월', price: 250 }, { date: '4월', price: 270 }, { date: '5월', price: 280 }, { date: '6월', price: 265 }, { date: '7월', price: 280 }, { date: '8월', price: 290 }];
const report = { currentPrice: 280000, avgPrice: 275000, minPrice: 250000, maxPrice: 320000, audioGrade: 'VG+', audioScore: 86 };
</script>
