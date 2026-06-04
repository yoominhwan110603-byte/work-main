<template>
  <div class="size-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700 text-white px-8">
    <div class="flex-1 flex flex-col items-center justify-center">
      <Disc3 :size="120" class="mb-8 animate-spin" style="animation-duration: 3s" />
      <h1 class="text-4xl mb-2">Vinyl-Check</h1>
      <p class="text-lg opacity-90">1:1 중고 LP 거래 플랫폼</p>
      <p class="text-sm mt-4 opacity-75 text-center">
        음질 분석 기반의 신뢰할 수 있는<br />LP 거래 경험을 시작하세요
      </p>
    </div>
    <div class="w-full max-w-sm mb-12 space-y-3">
      <button class="w-full bg-white text-blue-600 py-4 rounded-xl" @click="router.push('/auth/login')">로그인</button>
      <button class="w-full text-white py-2" @click="router.push('/auth/signup')">계정이 없나요? 회원가입</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Disc3 } from 'lucide-vue-next';

const router = useRouter();
</script>
