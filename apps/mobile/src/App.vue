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
import { computed, onMounted, onUnmounted } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { useAppStore } from '@/shared/stores/appStore';

const router = useRouter();
const route = useRoute();
const store = useAppStore();
let backButtonHandle: PluginListenerHandle | undefined;
const isCollectionRoute = computed(() => route.path.startsWith('/collection') || route.path.startsWith('/app/collection'));

const handleExpiredSession = () => {
  store.logout();
  void router.replace('/auth/login');
};

onMounted(async () => {
  window.addEventListener('vinyl-check-auth-expired', handleExpiredSession);
  if (Capacitor.isNativePlatform()) {
    backButtonHandle = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack && router.currentRoute.value.path !== '/') {
        router.back();
        return;
      }
      void CapacitorApp.exitApp();
    });
  }
});

onUnmounted(() => {
  window.removeEventListener('vinyl-check-auth-expired', handleExpiredSession);
  void backButtonHandle?.remove();
});
</script>
