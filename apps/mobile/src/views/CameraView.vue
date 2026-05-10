<template>
  <div class="size-full bg-black flex flex-col">
    <header class="px-4 py-4 flex items-center justify-between text-white z-10"><button class="p-2" @click="router.back()"><ArrowLeft :size="24" /></button></header>
    <div class="flex-1 flex items-center justify-center relative"><div class="w-full max-w-md aspect-square border-2 border-white/50 rounded-lg"><p class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-center">앨범 자켓을<br />프레임 안에 맞춰주세요</p></div></div>
    <div class="p-8 flex items-center justify-center gap-8"><button class="p-4 bg-white/20 rounded-full"><Image :size="24" class="text-white" /></button><button class="w-20 h-20 bg-white rounded-full flex items-center justify-center" @click="router.push('/sell')"><Camera :size="32" class="text-black" /></button><div class="w-12 h-12"></div></div>
  </div>
</template>
<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ArrowLeft, Camera, Image } from 'lucide-vue-next';
const router = useRouter();
</script>
