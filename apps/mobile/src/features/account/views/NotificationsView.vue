<template>
  <div class="size-full bg-white overflow-y-auto">
    <header class="sticky top-0 flex items-center justify-between border-b bg-white px-4 py-4">
      <h1 class="text-2xl">알림</h1>
      <button v-if="unreadCount > 0" class="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-blue-600" @click="readAll">
        <CheckCheck :size="17" />전체 읽음
      </button>
    </header>
    <div v-if="isLoading" class="p-8 text-center text-sm text-gray-500">알림을 불러오는 중입니다.</div>
    <p v-else-if="errorMessage" class="m-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{{ errorMessage }}</p>
    <div v-else-if="notifications.length > 0">
      <article v-for="notification in notifications" :key="notification.id" :class="['flex items-stretch border-b', !notification.isRead ? 'bg-blue-50' : '']">
        <button class="flex min-w-0 flex-1 gap-3 px-4 py-4 text-left hover:bg-gray-50" :disabled="removingId === notification.id" @click="open(notification)">
          <div class="mt-1 flex-shrink-0"><component :is="iconFor(notification.type)" :size="20" :class="colorFor(notification.type)" /></div>
          <div class="min-w-0 flex-1"><p :class="['mb-1 text-sm', notification.isRead ? 'text-gray-700' : '']">{{ notification.title }}</p><p class="mb-2 text-sm text-gray-600">{{ notification.message }}</p><p class="text-xs text-gray-400">{{ formatTime(notification.timestamp) }}</p></div>
          <div v-if="!notification.isRead" class="mt-1 flex-shrink-0"><div class="h-2 w-2 rounded-full bg-blue-600"></div></div>
        </button>
        <button
          type="button"
          class="flex w-12 shrink-0 items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
          :disabled="removingId === notification.id"
          :aria-label="`${notification.title} 알림 삭제`"
          @click="remove(notification)"
        >
          <LoaderCircle v-if="removingId === notification.id" :size="18" class="animate-spin" />
          <Trash2 v-else :size="18" />
        </button>
      </article>
    </div>
    <div v-else class="flex-1 flex flex-col items-center justify-center p-8 text-center"><Bell :size="64" class="text-gray-300 mb-4" /><h2 class="text-lg text-gray-600 mb-2">알림이 없습니다</h2><p class="text-sm text-gray-500">새로운 소식이 있으면 알려드릴게요</p></div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { AlertCircle, Bell, CheckCheck, Heart, LoaderCircle, MessageCircle, Package, Trash2 } from 'lucide-vue-next';
import type { Notification } from '@/shared/models/market';
import { deleteNotification, fetchNotifications, markAllNotificationsRead, markNotificationRead } from '@/shared/services/notifications';
import { useAppStore } from '@/shared/stores/appStore';
import { useForegroundRefresh } from '@/shared/composables/useForegroundRefresh';

const router = useRouter();
const store = useAppStore();
const notifications = ref<Notification[]>([]);
const isLoading = ref(false);
const errorMessage = ref('');
const unreadCount = ref(0);
const removingId = ref('');
const updating = ref(false);
const loaded = ref(false);
let mutationVersion = 0;

const loadNotifications = async () => {
  if (isLoading.value || updating.value || removingId.value) return;
  const version = mutationVersion;
  const requestedToken = store.token;
  isLoading.value = !loaded.value;
  try {
    const result = await fetchNotifications();
    if (version !== mutationVersion || requestedToken !== store.token) return;
    notifications.value = result.notifications;
    unreadCount.value = notifications.value.filter(item => !item.isRead).length;
    store.unreadNotificationCount = unreadCount.value;
    errorMessage.value = '';
    loaded.value = true;
  } catch (error) {
    if (!loaded.value) errorMessage.value = error instanceof Error ? error.message : '알림을 불러오지 못했습니다.';
  } finally {
    isLoading.value = false;
  }
};

const iconFor = (type: string) => type === 'offer' || type === 'buy_order' ? Package : type === 'chat' ? MessageCircle : type === 'favorite' ? Heart : type === 'listing' ? Bell : AlertCircle;
const colorFor = (type: string) => type === 'offer' || type === 'buy_order' ? 'text-blue-600' : type === 'chat' ? 'text-green-600' : type === 'favorite' ? 'text-red-600' : type === 'listing' ? 'text-purple-600' : 'text-gray-600';
const syncUnreadCount = () => {
  unreadCount.value = notifications.value.filter(item => !item.isRead).length;
  store.unreadNotificationCount = unreadCount.value;
};
const remove = async (notification: Notification, navigate = false) => {
  if (removingId.value || updating.value) return;
  const index = notifications.value.findIndex(item => item.id === notification.id);
  if (index < 0) return;
  removingId.value = notification.id;
  mutationVersion += 1;
  errorMessage.value = '';
  notifications.value.splice(index, 1);
  syncUnreadCount();
  try {
    const result = await deleteNotification(notification.id);
    unreadCount.value = result.unreadCount;
    store.unreadNotificationCount = result.unreadCount;
    if (navigate && notification.link) await router.push(notification.link);
  } catch (error) {
    notifications.value.splice(index, 0, notification);
    syncUnreadCount();
    errorMessage.value = error instanceof Error ? error.message : '알림을 삭제하지 못했습니다.';
  } finally {
    removingId.value = '';
  }
};
const open = async (notification: Notification) => {
  if (removingId.value || updating.value) return;
  updating.value = true;
  mutationVersion += 1;
  const wasUnread = !notification.isRead;
  errorMessage.value = '';
  if (wasUnread) {
    notification.isRead = true;
    syncUnreadCount();
  }
  try {
    if (wasUnread) await markNotificationRead(notification.id);
    if (notification.link) await router.push(notification.link);
  } catch (error) {
    if (wasUnread) {
      notification.isRead = false;
      syncUnreadCount();
    }
    errorMessage.value = error instanceof Error ? error.message : '알림 읽음 처리에 실패했습니다.';
  } finally {
    updating.value = false;
  }
};
const readAll = async () => {
  if (removingId.value || updating.value) return;
  updating.value = true;
  mutationVersion += 1;
  const previous = unreadCount.value;
  notifications.value.forEach(notification => { notification.isRead = true; });
  unreadCount.value = 0;
  store.unreadNotificationCount = 0;
  try {
    await markAllNotificationsRead();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '알림 읽음 처리에 실패했습니다.';
    updating.value = false;
    if (previous > 0) await loadNotifications();
  } finally {
    updating.value = false;
  }
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

useForegroundRefresh(loadNotifications, () => store.isLoggedIn);
</script>
