<template>
  <main v-if="collection" class="size-full bg-white text-gray-900 flex flex-col">
    <header class="sticky top-0 z-10 shrink-0 border-b bg-white px-4 py-4 flex items-center justify-between">
      <button class="rounded-full p-2 active:bg-gray-100" @click="goBackOr(router, '/app/collection')">
        <ArrowLeft :size="24" />
      </button>
      <span class="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">{{ collection.visibility === 'public' ? '공개 컬렉션' : '비공개' }}</span>
    </header>

    <section class="flex-1 overflow-y-auto">
      <div class="relative">
        <VinylCover :src="displayImages[currentImageIndex]" :alt="collection.title" class="aspect-square w-full bg-gray-100 object-cover" />
        <div v-if="displayImages.length > 1" class="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
          <button
            v-for="(_, index) in displayImages"
            :key="index"
            :class="['h-2 w-2 rounded-full', index === currentImageIndex ? 'bg-white' : 'bg-white/50']"
            @click="currentImageIndex = index"
          />
        </div>
      </div>

      <div class="space-y-5 p-4">
        <section class="space-y-2">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h1 class="text-2xl font-semibold">{{ collection.title }}</h1>
              <p class="mt-1 text-lg text-gray-600">{{ collection.artist || '아티스트 미상' }}</p>
            </div>
            <span v-if="isMine" class="shrink-0 rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">내 컬렉션</span>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span>{{ collection.year || '-' }}년</span>
            <span>·</span>
            <span>{{ collection.genre }}</span>
            <span v-if="collection.catalogNumber">· Cat. {{ collection.catalogNumber }}</span>
          </div>
          <div class="flex flex-wrap gap-2 text-sm">
            <span class="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{{ ownershipLabel }}</span>
            <span v-if="collection.releaseLabel" class="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{{ collection.releaseLabel }}</span>
            <span v-if="collection.releaseCountry" class="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{{ collection.releaseCountry }} 프레싱</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <span v-for="tag in visibleTags" :key="tag" class="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">{{ displayTag(tag) }}</span>
          </div>
        </section>

        <section class="border-t pt-4">
          <h2 class="mb-2 text-lg font-medium">컬렉션 메모</h2>
          <p class="whitespace-pre-line text-gray-700">{{ collection.notes }}</p>
        </section>

        <section v-if="collection.pressingInfo || (isMine && collection.purchasePrice)" class="border-t pt-4">
          <h2 class="mb-2 text-lg font-medium">소장 정보</h2>
          <p v-if="collection.pressingInfo" class="text-sm text-gray-700">{{ collection.pressingInfo }}</p>
          <p v-if="isMine && collection.purchasePrice" class="mt-2 text-sm text-gray-600">구매 가격 {{ collection.purchasePrice.toLocaleString() }}원</p>
        </section>

        <section class="border-t pt-4">
          <div class="rounded-lg bg-slate-50 p-4">
            <div class="mb-3 flex items-center justify-between gap-3">
              <h2 class="text-lg font-medium">상태 요약</h2>
              <BadgeCheck :size="20" class="text-blue-600" />
            </div>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div class="rounded bg-white p-3">
                <p class="text-xs text-gray-500">음질 등급</p>
                <p class="mt-1 text-xl">{{ collection.audioGrade || '-' }}</p>
              </div>
              <div class="rounded bg-white p-3">
                <p class="text-xs text-gray-500">음질 점수</p>
                <p class="mt-1 text-xl text-blue-600">{{ collection.audioScore || '-' }}점</p>
              </div>
              <div class="rounded bg-white p-3">
                <p class="text-xs text-gray-500">자켓 상태</p>
                <p class="mt-1 text-base">{{ collection.jacketGrade || '-' }}</p>
              </div>
              <div class="rounded bg-white p-3">
                <p class="text-xs text-gray-500">문의 수</p>
                <p class="mt-1 text-base">{{ collection.contactCount }}건</p>
              </div>
            </div>
          </div>
        </section>

        <section class="border-t pt-4">
          <div class="rounded-lg bg-neutral-950 p-4 text-white">
            <div class="mb-3 flex items-center gap-3">
              <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Volume2 :size="20" />
              </div>
              <div class="min-w-0">
                <h2 class="text-lg font-medium">LP 샘플</h2>
                <p class="truncate text-sm text-white/60">{{ sampleSummary }}</p>
              </div>
            </div>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div v-for="sample in sampleItems" :key="sample.kind" class="rounded-lg bg-white/10 p-3">
                <div class="mb-2 flex items-center justify-between gap-2">
                  <p class="text-sm font-medium">{{ sample.label }}</p>
                  <span class="text-xs text-white/60">{{ sample.durationSeconds }}초</span>
                </div>
                <p class="truncate text-xs text-white/60">{{ sample.name }}</p>
                <p class="mt-1 text-xs text-white/60">녹음일 {{ formatDate(sample.recordedAt) }}</p>
                <audio v-if="sample.dataUrl" :src="sample.dataUrl" class="mt-3 h-8 w-full" controls preload="metadata" />
              </div>
            </div>
            <p v-if="sampleItems.length === 0" class="rounded-lg bg-white/10 p-3 text-sm text-white/70">저장된 샘플이 없습니다.</p>
          </div>
        </section>

        <section class="border-t pt-4">
          <h2 class="mb-3 text-lg font-medium">소유자</h2>
          <button class="flex w-full items-center gap-3 text-left" @click="router.push(`/app/profile/${collection.owner.id}`)">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-200 text-lg">
              {{ collection.owner.name[0] || 'V' }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate">{{ collection.owner.name }}</p>
              <p class="text-sm text-gray-600">평점 {{ collection.owner.rating }} · 거래 {{ collection.owner.transactionCount }}회</p>
            </div>
          </button>
        </section>
      </div>
    </section>

    <footer class="shrink-0 border-t bg-white p-4">
      <div v-if="isMine" class="grid grid-cols-2 gap-2">
        <button class="rounded-lg border border-gray-300 py-3 text-gray-800" @click="router.push(`/app/collection/${collection.id}/edit`)">정보 수정</button>
        <button class="rounded-lg bg-blue-600 py-3 text-white" @click="convertToListing">판매글로 전환</button>
      </div>
      <div v-else class="flex gap-3">
        <button class="flex-1 rounded-lg border border-blue-600 py-3 text-blue-600" @click="openCollectionChat">
          <MessageCircle :size="19" class="inline" /> 문의
        </button>
        <button class="flex-1 rounded-lg bg-blue-600 py-3 text-white" @click="router.push(`/app/collection/${collection.id}/offer`)">
          구매 제안
        </button>
      </div>
    </footer>
  </main>

  <main v-else class="size-full bg-white p-6 text-center">
    <p class="text-gray-600">컬렉션을 찾을 수 없습니다.</p>
    <button class="mt-4 rounded-lg bg-blue-600 px-4 py-3 text-white" @click="router.push('/app/collection')">컬렉션으로</button>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, BadgeCheck, MessageCircle, Volume2 } from 'lucide-vue-next';
import type { CollectionAudioSample } from '@/shared/models/collection';
import { makeOneToOneChatId } from '@/features/transaction/services/chatClient';
import { goBackOr } from '@/shared/services/navigation';
import { useAppStore } from '@/shared/stores/appStore';
import VinylCover from '@/shared/components/VinylCover.vue';

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const currentImageIndex = ref(0);

const collection = computed(() => store.collections.find(item => item.id === String(route.params.id || '')));
const displayImages = computed(() => {
  if (!collection.value) return [];
  const cover = collection.value.discogsCoverImageUrl || collection.value.images[0] || '';
  return Array.from(new Set([cover, collection.value.recordImageDataUrl || ''].filter(Boolean)));
});
const isMine = computed(() => Boolean(collection.value && collection.value.owner.id === store.user.id));
const ownershipLabel = computed(() => ({
  owned: '보유 중', reserved: '판매 예약', lent: '대여 중', sold: '판매 완료',
}[collection.value?.ownershipStatus || 'owned']));
const sampleItems = computed(() => {
  const samples = collection.value?.audioSamples || {};
  return [
    samples.good ? { kind: 'good', label: '좋은 구간', ...samples.good } : null,
    samples.noisy ? { kind: 'noisy', label: '확인 구간', ...samples.noisy } : null,
  ].filter(Boolean) as Array<CollectionAudioSample & { kind: string; label: string }>;
});
const sampleSummary = computed(() => sampleItems.value.length ? `${sampleItems.value.length}개 샘플 저장됨` : '샘플 없음');
const visibleTags = computed(() => (collection.value?.tags || [])
  .filter(tag => !['희귀', 'rare', '초반', '초판', 'first press', 'firstpress', 'original', 'lp', 'vinyl', 'album'].some(keyword => tag.toLowerCase().includes(keyword))));

const displayTag = (tag: string) => tag.startsWith('#') ? tag : `#${tag}`;
const formatDate = (timestamp: string) => new Date(timestamp).toLocaleDateString('ko-KR');

const openCollectionChat = () => {
  if (!collection.value) return;
  const chatId = makeOneToOneChatId(collection.value.id, store.user.id, collection.value.owner.id);
  router.push({
    path: `/transaction/chat/${chatId}`,
    query: {
      collectionId: collection.value.id,
      listingId: collection.value.id,
      recipientId: collection.value.owner.id,
      recipientName: collection.value.owner.name,
    },
  });
};

const convertToListing = () => {
  if (!collection.value) return;
  const result = store.prepareListingDraftFromCollection(collection.value.id);
  if (!result.ok) {
    alert(result.message);
    return;
  }
  router.push({ path: '/app/sell', query: { collectionId: collection.value.id } });
};
</script>
