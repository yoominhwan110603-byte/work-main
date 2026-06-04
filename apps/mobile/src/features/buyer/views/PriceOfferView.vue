<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 flex items-center border-b">
      <button class="p-2" @click="router.push(`/app/album/${album.id}`)">
        <ArrowLeft :size="24" />
      </button>
      <h1 class="ml-3 text-lg">가격 제안</h1>
    </header>

    <main class="flex-1 overflow-y-auto p-4 space-y-5 bg-gray-50">
      <section class="bg-white rounded-lg border p-4">
        <div class="flex gap-3">
          <VinylCover :src="album.images[0]" :alt="album.title" class="w-20 h-20 object-cover rounded-lg bg-gray-100" />
          <div class="min-w-0">
            <h2 class="text-lg truncate">{{ album.title }}</h2>
            <p class="text-sm text-gray-600">{{ album.artist }}</p>
            <p class="text-xl mt-2">{{ album.price.toLocaleString() }}원</p>
          </div>
        </div>
      </section>

      <section class="grid grid-cols-2 gap-2">
        <div class="bg-white rounded-lg border p-3">
          <p class="text-xs text-gray-500">시세</p>
          <p class="text-sm mt-1">{{ album.priceRange.min.toLocaleString() }}원 ~ {{ album.priceRange.max.toLocaleString() }}원</p>
        </div>
        <div class="bg-white rounded-lg border p-3">
          <p class="text-xs text-gray-500">판매가</p>
          <p class="text-sm mt-1">{{ album.price.toLocaleString() }}원</p>
        </div>
      </section>

      <form class="bg-white rounded-lg border p-4 space-y-4" @submit.prevent="submit">
        <div>
          <label class="block text-sm mb-2">제안 가격</label>
          <input v-model="offerPrice" type="number" class="w-full px-4 py-3 border rounded-lg text-xl" placeholder="제안 금액 입력" required />
          <p v-if="offerPrice" class="text-sm text-gray-500 mt-2">{{ Number(offerPrice).toLocaleString() }}원</p>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="preset in presets"
            :key="preset.label"
            type="button"
            class="py-2 border rounded-lg text-sm"
            @click="offerPrice = String(preset.value)"
          >
            {{ preset.label }}
          </button>
        </div>

        <div :class="['rounded-lg border p-4', offerState.className]">
          <p class="text-sm font-medium">{{ offerState.title }}</p>
          <p class="text-sm mt-1">{{ offerState.description }}</p>
        </div>
      </form>
    </main>

    <footer class="p-4 border-t bg-white">
      <button class="w-full py-4 bg-blue-600 text-white rounded-lg disabled:bg-gray-300" :disabled="!canSubmit" @click="submit">
        {{ isSubmitting ? '보내는 중' : '가격 제안 보내기' }}
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
import { fallbackAlbum } from '@/features/buyer/services/albumLookup';
import { fetchApi } from '@/shared/services/api';
import { makeOneToOneChatId } from '@/features/transaction/services/chatClient';
import { useAppStore } from '@/shared/stores/appStore';
import VinylCover from '@/shared/components/VinylCover.vue';

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const album = computed(() => fallbackAlbum(store, route.params.albumId));
const offerPrice = ref('');
const isSubmitting = ref(false);

onMounted(() => {
  void store.loadListingsFromServer();
});

const presets = computed(() => [
  { label: '판매가', value: album.value.price },
  { label: '5% 낮게', value: Math.round(album.value.price * 0.95 / 1000) * 1000 },
  { label: '10% 낮게', value: Math.round(album.value.price * 0.9 / 1000) * 1000 },
]);

const offerNumber = computed(() => Number(offerPrice.value || 0));
const offerState = computed(() => {
  if (!offerPrice.value) {
    return { title: '제안가를 입력하세요', description: '판매가와 시세를 참고해 제안 금액을 정하세요.', className: 'bg-gray-50 border-gray-200 text-gray-700' };
  }
  if (offerNumber.value <= 0) {
    return { title: '금액을 확인해주세요', description: '0원보다 큰 금액을 입력해야 합니다.', className: 'bg-red-50 border-red-200 text-red-900' };
  }
  if (offerNumber.value <= album.value.priceRange.min) {
    return { title: '낮은 제안입니다', description: '시세 하한에 가까워 판매자가 거절할 수 있습니다.', className: 'bg-amber-50 border-amber-200 text-amber-900' };
  }
  if (offerNumber.value < album.value.price) {
    return { title: '합리적인 제안입니다', description: `${(album.value.price - offerNumber.value).toLocaleString()}원 낮은 가격으로 제안합니다.`, className: 'bg-blue-50 border-blue-200 text-blue-900' };
  }
  return { title: '수락 가능성이 높습니다', description: '판매가 이상으로 제안합니다.', className: 'bg-green-50 border-green-200 text-green-900' };
});

const canSubmit = computed(() => offerNumber.value > 0 && !isSubmitting.value);

const submit = async () => {
  if (!canSubmit.value) return;
  isSubmitting.value = true;
  try {
    const response = await fetchApi('/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listingId: album.value.id,
        buyerId: store.user.id,
        buyerName: store.user.username,
        sellerId: album.value.seller.id,
        sellerName: album.value.seller.name,
        offerPrice: offerNumber.value,
      }),
    });
    const payload = await response.json().catch(() => ({})) as { detail?: string; offer?: { chatId?: string } };
    if (!response.ok) throw new Error(payload.detail || '가격 제안 전송에 실패했습니다.');
    alert(`가격 제안 ${offerNumber.value.toLocaleString()}원을 보냈습니다.`);
    const chatId = payload.offer?.chatId || makeOneToOneChatId(album.value.id, store.user.id, album.value.seller.id);
    router.push({
      path: `/transaction/chat/${chatId}`,
      query: {
        listingId: album.value.id,
        recipientId: album.value.seller.id,
        recipientName: album.value.seller.name,
      },
    });
  } catch (error) {
    alert(error instanceof Error ? error.message : '가격 제안 전송에 실패했습니다.');
  } finally {
    isSubmitting.value = false;
  }
};
</script>
