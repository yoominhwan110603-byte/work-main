<template>
  <div class="app-shell safe-area-top">
    <RouterView v-slot="{ Component, route }">
      <Transition name="page-fade" mode="out-in">
        <component :is="Component" :key="route.fullPath" />
      </Transition>
    </RouterView>

    <div v-if="showAddressKeyDialog" class="fixed inset-0 z-50 flex items-end bg-black/40 p-4 sm:items-center sm:justify-center">
      <section class="w-full rounded-xl bg-white p-4 shadow-xl sm:max-w-md">
        <div class="space-y-1">
          <p class="text-xs font-medium text-blue-600">카카오 지도 API</p>
          <h2 class="text-lg font-semibold text-gray-900">카카오 REST API 키 입력</h2>
          <p class="text-sm text-gray-500">거래 장소 검색에 사용할 카카오 REST API 키를 backend/.env에 저장합니다.</p>
        </div>
        <form class="mt-4 space-y-3" @submit.prevent="submitAddressApiKey">
          <input
            v-model="addressApiKey"
            type="password"
            autocomplete="off"
            class="w-full rounded-lg border px-4 py-3 text-sm outline-none focus:border-blue-600"
            placeholder="KAKAO_REST_API_KEY"
          />
          <p v-if="addressApiKeyMessage" :class="['text-xs', addressApiKeyError ? 'text-red-600' : 'text-green-600']">{{ addressApiKeyMessage }}</p>
          <div class="flex gap-2">
            <button type="button" class="flex-1 rounded-lg border px-4 py-3 text-sm text-gray-700" @click="dismissAddressKeyDialog">나중에</button>
            <button type="submit" class="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-sm text-white disabled:bg-gray-300" :disabled="isSavingAddressApiKey || addressApiKey.trim().length < 8">
              {{ isSavingAddressApiKey ? '저장 중' : '저장' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { RouterView, useRouter } from 'vue-router';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { fetchAddressApiKeyStatus, saveAddressApiKey } from '@/features/seller/services/addressLookup';

const router = useRouter();
let backButtonHandle: PluginListenerHandle | undefined;
const ADDRESS_KEY_DISMISSED = 'vinyl-check-kakao-api-key-dismissed';
const showAddressKeyDialog = ref(false);
const addressApiKey = ref('');
const addressApiKeyMessage = ref('');
const addressApiKeyError = ref(false);
const isSavingAddressApiKey = ref(false);

onMounted(async () => {
  checkAddressApiKey();
  if (Capacitor.isNativePlatform()) {
    backButtonHandle = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (showAddressKeyDialog.value) {
        dismissAddressKeyDialog();
        return;
      }
      if (canGoBack && router.currentRoute.value.path !== '/') {
        router.back();
        return;
      }
      void CapacitorApp.exitApp();
    });
  }
});

onUnmounted(() => {
  void backButtonHandle?.remove();
});

const checkAddressApiKey = async () => {
  if (localStorage.getItem(ADDRESS_KEY_DISMISSED) === 'true') return;
  try {
    const status = await fetchAddressApiKeyStatus();
    showAddressKeyDialog.value = !status.hasKey;
  } catch {
    showAddressKeyDialog.value = false;
  }
};

const dismissAddressKeyDialog = () => {
  localStorage.setItem(ADDRESS_KEY_DISMISSED, 'true');
  showAddressKeyDialog.value = false;
};

const submitAddressApiKey = async () => {
  if (isSavingAddressApiKey.value) return;
  isSavingAddressApiKey.value = true;
  addressApiKeyMessage.value = '';
  addressApiKeyError.value = false;
  try {
    const result = await saveAddressApiKey(addressApiKey.value);
    addressApiKeyMessage.value = result.message || '카카오 API 키가 저장되었습니다.';
    localStorage.removeItem(ADDRESS_KEY_DISMISSED);
    window.setTimeout(() => {
      showAddressKeyDialog.value = false;
      addressApiKey.value = '';
    }, 700);
  } catch (error) {
    addressApiKeyError.value = true;
    addressApiKeyMessage.value = error instanceof Error ? error.message : '카카오 API 키를 저장하지 못했습니다.';
  } finally {
    isSavingAddressApiKey.value = false;
  }
};
</script>
