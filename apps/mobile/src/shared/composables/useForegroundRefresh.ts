import { onMounted, onUnmounted, watch } from 'vue';
import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';

export function useForegroundRefresh(
  task: () => Promise<unknown>,
  enabled: () => boolean = () => true,
  intervalMs = 15_000,
) {
  let mounted = false;
  let running = false;
  let nativeActive = true;
  let timer: number | undefined;
  let appStateHandle: PluginListenerHandle | undefined;

  const canRefresh = () => mounted && enabled() && nativeActive && document.visibilityState !== 'hidden';
  const clearTimer = () => {
    window.clearTimeout(timer);
    timer = undefined;
  };
  const refresh = async () => {
    clearTimer();
    if (!canRefresh() || running) return;
    running = true;
    try {
      await task();
    } finally {
      running = false;
      if (canRefresh()) timer = window.setTimeout(requestRefresh, intervalMs);
    }
  };
  const requestRefresh = () => { void refresh().catch(() => undefined); };

  watch(enabled, requestRefresh);
  onMounted(async () => {
    mounted = true;
    document.addEventListener('visibilitychange', requestRefresh);
    window.addEventListener('online', requestRefresh);
    requestRefresh();
    if (Capacitor.isNativePlatform()) {
      const handle = await App.addListener('appStateChange', ({ isActive }) => {
        nativeActive = isActive;
        requestRefresh();
      });
      if (mounted) appStateHandle = handle;
      else void handle.remove();
    }
  });
  onUnmounted(() => {
    mounted = false;
    clearTimer();
    document.removeEventListener('visibilitychange', requestRefresh);
    window.removeEventListener('online', requestRefresh);
    void appStateHandle?.remove();
  });
}
