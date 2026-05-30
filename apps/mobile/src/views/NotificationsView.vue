<template>
  <div class="size-full bg-white overflow-y-auto">
    <header class="px-4 py-4 border-b sticky top-0 bg-white"><h1 class="text-2xl">알림</h1></header>
    <div v-if="isLoading" class="p-8 text-center text-sm text-gray-500">알림을 불러오는 중입니다.</div>
    <div v-else-if="notifications.length > 0">
      <button v-for="notification in notifications" :key="notification.id" :class="['w-full px-4 py-4 flex gap-3 border-b hover:bg-gray-50 text-left', !notification.isRead ? 'bg-blue-50' : '']" @click="open(notification)">
        <div class="flex-shrink-0 mt-1"><component :is="iconFor(notification.type)" :size="20" :class="colorFor(notification.type)" /></div>
        <div class="flex-1 min-w-0"><p :class="['text-sm mb-1', notification.isRead ? 'text-gray-700' : '']">{{ notification.title }}</p><p class="text-sm text-gray-600 mb-2">{{ notification.message }}</p><p class="text-xs text-gray-400">{{ formatTime(notification.timestamp) }}</p></div>
        <div v-if="!notification.isRead" class="flex-shrink-0"><div class="w-2 h-2 bg-blue-600 rounded-full"></div></div>
      </button>
    </div>
    <div v-else class="flex-1 flex flex-col items-center justify-center p-8 text-center"><Bell :size="64" class="text-gray-300 mb-4" /><h2 class="text-lg text-gray-600 mb-2">알림이 없습니다</h2><p class="text-sm text-gray-500">새로운 소식이 있으면 알려드릴게요</p></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { AlertCircle, Bell, Heart, MessageCircle, Package } from 'lucide-vue-next';
import type { Notification } from '../data/mockData';
import { fetchApi } from '../data/api';
import { useAppStore } from '../stores/appStore';

const router = useRouter();
const store = useAppStore();
const notifications = ref<Notification[]>([]);
const isLoading = ref(false);

const loadNotifications = async () => {
  isLoading.value = true;
  try {
    const response = await fetchApi(`/users/${encodeURIComponent(store.user.id)}/notifications`);
    const payload = await response.json().catch(() => ({})) as { notifications?: Notification[] };
    notifications.value = response.ok ? (payload.notifications || []) : [];
  } catch {
    notifications.value = [];
  } finally {
    isLoading.value = false;
  }
};

const iconFor = (type: string) => type === 'offer' ? Package : type === 'chat' ? MessageCircle : type === 'favorite' ? Heart : type === 'listing' ? Bell : AlertCircle;
const colorFor = (type: string) => type === 'offer' ? 'text-blue-600' : type === 'chat' ? 'text-green-600' : type === 'favorite' ? 'text-red-600' : type === 'listing' ? 'text-purple-600' : 'text-gray-600';
const open = (notification: Notification) => {
  notification.isRead = true;
  if (notification.link) router.push(notification.link);
};
const formatTime = (timestamp: string) => {
  const diffMins = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return new Date(timestamp).toLocaleDateString('ko-KR');
};

onMounted(loadNotifications);
</script>
