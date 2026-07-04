<template>
  <main v-if="collection" class="size-full bg-gray-50 text-gray-900 flex flex-col">
    <header class="flex items-center border-b bg-white px-4 py-4">
      <button class="rounded-full p-2 active:bg-gray-100" @click="router.back()"><ArrowLeft :size="24" /></button>
      <h1 class="ml-3 text-lg font-semibold">컬렉션 구매 제안</h1>
    </header>

    <section class="flex-1 space-y-4 overflow-y-auto p-4">
      <article class="flex gap-3 rounded-lg border bg-white p-4">
        <VinylCover :src="coverImage" :alt="collection.title" class="h-20 w-20 shrink-0 rounded-lg object-cover" />
        <div class="min-w-0">
          <h2 class="truncate text-lg font-medium">{{ collection.title }}</h2>
          <p class="truncate text-sm text-gray-600">{{ collection.artist }}</p>
          <p class="mt-2 text-xs text-gray-500">{{ collection.owner.name }}님의 컬렉션 · {{ collection.audioGrade || '등급 미입력' }}</p>
        </div>
      </article>

      <form class="space-y-4 rounded-lg border bg-white p-4" @submit.prevent="submitOffer">
        <div>
          <label class="mb-2 block text-sm font-medium">제안 금액</label>
          <input v-model="offerPrice" type="number" inputmode="numeric" min="1000" step="1000" class="w-full rounded-lg border px-4 py-3 text-xl" placeholder="원 단위로 입력" />
          <p v-if="offerNumber" class="mt-2 text-sm text-blue-600">{{ offerNumber.toLocaleString() }}원</p>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <button v-for="amount in presets" :key="amount" type="button" class="rounded-lg border py-2 text-sm" @click="offerPrice = String(amount)">
            {{ (amount / 10000).toLocaleString() }}만원
          </button>
        </div>
        <div class="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          컬렉션 LP는 판매글이 아닙니다. 제안을 보내면 소유자가 채팅에서 판매 의사를 결정합니다.
        </div>
      </form>
    </section>

    <footer class="border-t bg-white p-4">
      <button class="w-full rounded-lg bg-blue-600 py-4 text-white disabled:bg-gray-300" :disabled="!canSubmit" @click="submitOffer">
        {{ submitting ? '제안 보내는 중' : '구매 제안 보내기' }}
      </button>
    </footer>
  </main>

  <main v-else class="size-full bg-white p-6 text-center">
    <p class="text-gray-600">컬렉션을 찾을 수 없습니다.</p>
    <button class="mt-4 rounded-lg bg-blue-600 px-4 py-3 text-white" @click="router.push('/app/profile')">프로필로</button>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
import { makeOneToOneChatId } from '@/features/transaction/services/chatClient';
import { fetchApi } from '@/shared/services/api';
import { useAppStore } from '@/shared/stores/appStore';
import VinylCover from '@/shared/components/VinylCover.vue';

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const offerPrice = ref('');
const submitting = ref(false);
const presets = [50000, 100000, 200000];
const collection = computed(() => store.collections.find(item => item.id === String(route.params.id || '')));
const coverImage = computed(() => collection.value?.discogsCoverImageUrl || collection.value?.images[0] || '');
const offerNumber = computed(() => Number(offerPrice.value || 0));
const canSubmit = computed(() => offerNumber.value >= 1000 && !submitting.value && collection.value?.owner.id !== store.user.id);

const submitOffer = async () => {
  if (!canSubmit.value || !collection.value) return;
  submitting.value = true;
  try {
    const response = await fetchApi('/collection-offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collectionId: collection.value.id,
        buyerId: store.user.id,
        buyerName: store.user.username,
        offerPrice: offerNumber.value,
      }),
    });
    const data = await response.json().catch(() => ({})) as { detail?: string; offer?: { chatId?: string } };
    if (!response.ok) throw new Error(data.detail || '구매 제안 전송에 실패했습니다.');
    const chatId = data.offer?.chatId || makeOneToOneChatId(collection.value.id, store.user.id, collection.value.owner.id);
    alert(`${offerNumber.value.toLocaleString()}원의 구매 제안을 보냈습니다.`);
    router.replace({
      path: `/transaction/chat/${chatId}`,
      query: {
        collectionId: collection.value.id,
        listingId: collection.value.id,
        recipientId: collection.value.owner.id,
        recipientName: collection.value.owner.name,
      },
    });
  } catch (error) {
    alert(error instanceof Error ? error.message : '구매 제안 전송에 실패했습니다.');
  } finally {
    submitting.value = false;
  }
};
</script>
