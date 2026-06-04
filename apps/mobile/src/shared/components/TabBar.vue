<template>
  <nav class="shrink-0 border-t bg-white px-4 pt-2 safe-area-bottom">
    <div class="flex justify-around items-center">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.path"
        :to="tab.path"
        class="flex flex-col items-center gap-1 py-2 min-w-12"
      >
        <component :is="tab.icon" :size="24" :class="isActive(tab.path) ? 'text-blue-600' : 'text-gray-400'" />
        <span :class="`text-xs ${isActive(tab.path) ? 'text-blue-600' : 'text-gray-400'}`">{{ tab.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';
import { Heart, Home, PlusCircle, Search, User } from 'lucide-vue-next';

const route = useRoute();
const tabs = [
  { icon: Home, label: '홈', path: '/app' },
  { icon: Search, label: '검색', path: '/app/search' },
  { icon: PlusCircle, label: '판매', path: '/sell' },
  { icon: Heart, label: '찜', path: '/app/favorites' },
  { icon: User, label: '프로필', path: '/app/profile' },
];

const isActive = (path: string) => route.path === path || (path === '/app' && route.path === '/app');
</script>
