<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 flex items-center border-b">
      <button class="p-2" @click="router.back()">
        <ArrowLeft :size="24" />
      </button>
      <div class="ml-3 min-w-0">
        <h1 class="text-lg">상품 문의</h1>
        <p class="text-xs text-gray-500 truncate">{{ album.title }} · 문의 {{ buyerQuestions.length }}개</p>
      </div>
    </header>

    <main class="flex-1 overflow-y-auto bg-gray-50">
      <section v-if="canSellerReply" class="p-4 bg-white border-b space-y-3">
        <div>
          <h2 class="text-base">판매자 답변</h2>
          <p class="text-sm text-gray-500 mt-1">구매자가 남긴 문의를 선택해 직접 답변하세요.</p>
        </div>

        <div v-if="buyerQuestions.length > 0" class="space-y-2">
          <button
            v-for="comment in buyerQuestions"
            :key="comment.id"
            :class="[
              'w-full text-left rounded-lg border p-3',
              selectedQuestionId === comment.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'
            ]"
            @click="selectQuestion(comment.id)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm text-gray-700">{{ comment.userName }}</span>
              <span v-if="repliesByParent[comment.id]?.length" class="text-xs text-green-600">답변 완료</span>
            </div>
            <p class="text-sm mt-1 line-clamp-2">{{ comment.content }}</p>
          </button>
        </div>
        <div v-else class="rounded-lg border border-dashed p-4 text-sm text-gray-500 text-center">
          아직 답변할 구매자 문의가 없습니다.
        </div>

        <template v-if="buyerQuestions.length > 0">
          <textarea
            v-model="sellerReply"
            class="w-full px-4 py-3 border rounded-lg min-h-24 bg-white"
            placeholder="판매자 답변을 입력하세요"
          />
          <button
            class="w-full py-3 bg-blue-600 text-white rounded-lg disabled:bg-gray-300"
            :disabled="!selectedQuestionId || !sellerReply.trim()"
            @click="postSellerReply"
          >
            선택한 문의에 답변 등록
          </button>
        </template>
      </section>

      <section v-else-if="isSeller && !canSellerReply" class="p-4 bg-white border-b">
        <div class="rounded-lg bg-gray-50 border p-4 text-sm text-gray-600">
          거래가 완료된 상품에는 새 판매자 답변을 남길 수 없습니다.
        </div>
      </section>

      <section class="divide-y bg-white">
        <div v-if="buyerQuestions.length === 0" class="px-4 py-12 text-center text-sm text-gray-500">
          아직 문의가 없습니다.
        </div>
        <article v-for="comment in buyerQuestions" :key="comment.id" class="px-4 py-4">
          <div class="flex items-center gap-2 mb-2">
            <div
              :class="[
                'w-8 h-8 rounded-full flex items-center justify-center text-sm',
                comment.role === 'seller' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'
              ]"
            >
              {{ comment.userName[0] }}
            </div>
            <span>{{ comment.userName }}</span>
            <span
              :class="[
                'px-2 py-0.5 rounded text-xs',
                comment.role === 'seller' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              ]"
            >
              {{ comment.role === 'seller' ? '판매자 답변' : '구매자 문의' }}
            </span>
            <span class="text-xs text-gray-400">{{ new Date(comment.timestamp).toLocaleDateString('ko-KR') }}</span>
          </div>
          <p class="text-sm pl-10">{{ comment.content }}</p>

          <div v-if="repliesByParent[comment.id]?.length" class="mt-3 ml-10 space-y-2">
            <div v-for="reply in repliesByParent[comment.id]" :key="reply.id" class="rounded-lg bg-blue-50 border border-blue-100 p-3">
              <p class="text-xs text-blue-600 mb-1">판매자 답변 · {{ new Date(reply.timestamp).toLocaleDateString('ko-KR') }}</p>
              <p class="text-sm text-gray-800">{{ reply.content }}</p>
            </div>
          </div>
        </article>
      </section>
    </main>

    <form v-if="!isSeller" class="p-4 border-t bg-white" @submit.prevent="submit">
      <div class="flex gap-2">
        <input
          v-model="newComment"
          type="text"
          placeholder="판매자에게 문의를 남겨보세요"
          class="flex-1 min-w-0 px-4 py-3 border rounded-lg"
        />
        <button type="submit" class="px-4 py-3 bg-blue-600 text-white rounded-lg disabled:bg-gray-300" :disabled="!newComment.trim()">
          <Send :size="20" />
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Send } from 'lucide-vue-next';
import { getActiveTrade } from '@/features/transaction/services/tradeState';
import { useAppStore } from '@/shared/stores/appStore';
import { fallbackAlbum } from '@/features/buyer/services/albumLookup';
import { fetchApi } from '@/shared/services/api';

interface ProductComment {
  id: string;
  listingId: string;
  userId: string;
  userName: string;
  role: 'seller' | 'buyer';
  content: string;
  timestamp: string;
  parentId?: string;
}

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const album = computed(() => fallbackAlbum(store, route.params.albumId));
const activeTrade = computed(() => getActiveTrade(album.value.id));
const isSeller = computed(() => store.user.id === album.value.seller.id);
const canSellerReply = computed(() => isSeller.value && activeTrade.value?.status !== 'completed');
const currentRole = computed<'seller' | 'buyer'>(() => isSeller.value ? 'seller' : 'buyer');
const currentName = computed(() => isSeller.value ? album.value.seller.name : store.user.username);
const commentsKey = computed(() => `vinyl-check-comments:${album.value.id}`);

onMounted(() => {
  void store.loadListingsFromServer();
  void loadComments();
});

const comments = ref<ProductComment[]>([]);
const buyerQuestions = computed(() => comments.value.filter(comment => comment.role === 'buyer' && !comment.parentId));
const repliesByParent = computed(() => comments.value.reduce<Record<string, ProductComment[]>>((groups, comment) => {
  if (!comment.parentId) return groups;
  groups[comment.parentId] = [...(groups[comment.parentId] || []), comment];
  return groups;
}, {}));
const selectedQuestionId = ref('');
const sellerReply = ref('');
const newComment = ref('');

watch(buyerQuestions, questions => {
  if (!questions.length) {
    selectedQuestionId.value = '';
    return;
  }
  if (!questions.some(comment => comment.id === selectedQuestionId.value)) {
    selectedQuestionId.value = questions[0].id;
  }
}, { immediate: true });

const selectQuestion = (id: string) => {
  selectedQuestionId.value = id;
};

const readLocalComments = () => {
  try {
    return JSON.parse(localStorage.getItem(commentsKey.value) || '[]') as ProductComment[];
  } catch {
    localStorage.removeItem(commentsKey.value);
    return [];
  }
};

const saveLocalComments = () => {
  localStorage.setItem(commentsKey.value, JSON.stringify(comments.value));
};

const loadComments = async () => {
  comments.value = readLocalComments();
  try {
    const response = await fetchApi(`/listings/${encodeURIComponent(album.value.id)}/comments`);
    if (!response.ok) return;
    const payload = await response.json() as ProductComment[];
    comments.value = payload;
    saveLocalComments();
  } catch {
    // Local comments keep the screen usable when the phone cannot reach the API.
  }
};

const addComment = async (comment: ProductComment) => {
  comments.value = [comment, ...comments.value];
  saveLocalComments();
  try {
    const response = await fetchApi(`/listings/${encodeURIComponent(album.value.id)}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: comment.userId,
        userName: comment.userName,
        role: comment.role,
        content: comment.content,
        parentId: comment.parentId,
      }),
    });
    if (!response.ok) return;
    const payload = await response.json() as { comment?: ProductComment };
    if (!payload.comment) return;
    comments.value = [payload.comment, ...comments.value.filter(item => item.id !== comment.id)];
    saveLocalComments();
  } catch {
    // The optimistic local comment remains visible and will not block the user.
  }
};

const postSellerReply = () => {
  if (!canSellerReply.value) return;
  if (!selectedQuestionId.value || !sellerReply.value.trim()) return;
  void addComment({
    id: `local-${Date.now()}`,
    listingId: album.value.id,
    userId: store.user.id,
    userName: currentName.value,
    role: 'seller',
    content: sellerReply.value.trim(),
    timestamp: new Date().toISOString(),
    parentId: selectedQuestionId.value,
  });
  sellerReply.value = '';
};

const submit = () => {
  if (!newComment.value.trim()) return;
  void addComment({
    id: `local-${Date.now()}`,
    listingId: album.value.id,
    userId: store.user.id,
    userName: currentName.value,
    role: currentRole.value,
    content: newComment.value.trim(),
    timestamp: new Date().toISOString(),
  });
  newComment.value = '';
};
</script>
