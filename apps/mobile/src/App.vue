<template>
  <div class="app-shell safe-area-top">
    <RouterView v-slot="{ Component, route }">
      <Transition name="page-fade" mode="out-in">
        <component :is="Component" :key="route.fullPath" />
      </Transition>
    </RouterView>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { RouterView } from 'vue-router';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { useRouter } from 'vue-router';

const router = useRouter();
let backButtonHandle: PluginListenerHandle | undefined;

onMounted(async () => {
  if (!Capacitor.isNativePlatform()) return;
  backButtonHandle = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack && router.currentRoute.value.path !== '/') {
      router.back();
      return;
    }
    void CapacitorApp.exitApp();
  });
});

onUnmounted(() => {
  void backButtonHandle?.remove();
});
</script>
