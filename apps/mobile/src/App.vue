<template>
  <div :class="['app-shell safe-area-top', !isCollectionRoute && 'vinyl-brown-theme']">
    <RouterView v-slot="{ Component, route }">
      <Transition name="page-fade">
        <component :is="Component" :key="route.fullPath" />
      </Transition>
    </RouterView>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { useAppStore } from '@/shared/stores/appStore';
import { useForegroundRefresh } from '@/shared/composables/useForegroundRefresh';
import { fallbackPathForRoute, goBackOr, isPrimaryAppPath } from '@/shared/services/navigation';

const router = useRouter();
const route = useRoute();
const store = useAppStore();
let backButtonHandle: PluginListenerHandle | undefined;
const isCollectionRoute = computed(() => route.path.startsWith('/collection') || route.path.startsWith('/app/collection'));
useForegroundRefresh(
  () => store.loadUnreadNotificationCount(),
  () => store.isLoggedIn && route.path !== '/app/notifications',
);
watch(() => store.user.id, () => {
  store.unreadNotificationCount = 0;
  if (store.isLoggedIn) void store.loadUnreadNotificationCount();
});

const handleExpiredSession = () => {
  store.logout();
  void router.replace('/auth/login');
};

onMounted(async () => {
  window.addEventListener('vinyl-check-auth-expired', handleExpiredSession);
  if (Capacitor.isNativePlatform()) {
    backButtonHandle = await CapacitorApp.addListener('backButton', () => {
      const currentRoute = router.currentRoute.value;
      if (currentRoute.path === '/') {
        void CapacitorApp.exitApp();
        return;
      }
      if (currentRoute.path === '/auth/login') {
        void router.replace('/');
        return;
      }
      if (isPrimaryAppPath(currentRoute.path)) {
        if (currentRoute.path === '/app') {
          void CapacitorApp.exitApp();
        } else {
          void router.replace('/app');
        }
        return;
      }
      goBackOr(router, fallbackPathForRoute(currentRoute));
    });
  }
});

onUnmounted(() => {
  window.removeEventListener('vinyl-check-auth-expired', handleExpiredSession);
  void backButtonHandle?.remove();
});
</script>
