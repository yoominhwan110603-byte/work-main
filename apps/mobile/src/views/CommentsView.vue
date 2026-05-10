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
          <p class="text-sm text-gray-500 mt-1">내가 판매 중인 상품에 달린 구매자 문의에만 답변할 수 있습니다.</p>
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
              <span v-if="comment.sellerReply" class="text-xs text-green-600">답변 완료</span>
            </div>
            <p class="text-sm mt-1 line-clamp-2">{{ comment.content }}</p>
          </button>
        </div>
        <div v-else class="rounded-lg border border-dashed p-4 text-sm text-gray-500 text-center">
          아직 답변할 구매자 문의가 없습니다.
        </div>

        <template v-if="buyerQuestions.length > 0">
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="template in replyTemplates"
              :key="template.id"
              :class="[
                'py-2 px-2 rounded-lg border text-sm',
                selectedTemplateId === template.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'
              ]"
              @click="chooseTemplate(template.id)"
            >
              {{ template.label }}
            </button>
          </div>

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
        <article v-for="comment in comments" :key="comment.id" class="px-4 py-4">
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

          <div v-if="comment.sellerReply" class="mt-3 ml-10 rounded-lg bg-blue-50 border border-blue-100 p-3">
            <p class="text-xs text-blue-600 mb-1">판매자 답변 · {{ comment.replyType }}</p>
            <p class="text-sm text-gray-800">{{ comment.sellerReply }}</p>
          </div>
        </article>
      </section>
    </main>

    <form v-if="!isSeller || canSellerReply" class="p-4 border-t bg-white" @submit.prevent="submit">
      <div class="flex gap-2">
        <input
          v-model="newComment"
          type="text"
          :placeholder="isSeller ? '판매자로 추가 답변을 남기세요' : '판매자에게 문의를 남겨보세요'"
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
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Send } from 'lucide-vue-next';
import { mockAlbums } from '../data/mockData';
import { getActiveTrade } from '../data/tradeState';
import { useAppStore } from '../stores/appStore';

interface ProductComment {
  id: string;
  userName: string;
  role: 'seller' | 'buyer';
  content: string;
  timestamp: string;
  replyToId?: string;
  sellerReply?: string;
  replyType?: string;
}

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const album = computed(() => mockAlbums.find(item => item.id === route.params.albumId) || mockAlbums[0]);
const activeTrade = computed(() => getActiveTrade(album.value.id));
const isSeller = computed(() => store.user.id === album.value.seller.id);
const canSellerReply = computed(() => isSeller.value && activeTrade.value?.status !== 'completed');
const currentRole = computed<'seller' | 'buyer'>(() => isSeller.value ? 'seller' : 'buyer');
const currentName = computed(() => isSeller.value ? album.value.seller.name : store.user.username);

const comments = ref<ProductComment[]>([
  {
    id: '1',
    userName: 'LP애호가',
    role: 'buyer',
    content: '자켓 모서리 눌림이나 갈라짐이 있나요?',
    timestamp: '2026-04-19T10:30:00',
    sellerReply: '상단 모서리에 아주 약한 눌림이 있고 갈라짐은 없습니다. 필요하면 채팅으로 추가 사진을 보내드릴게요.',
    replyType: '상태 설명',
  },
  {
    id: '2',
    userName: '재즈러버',
    role: 'buyer',
    content: '초반 여부를 확인할 수 있을까요?',
    timestamp: '2026-04-18T15:20:00',
  },
]);

const replyTemplates = computed(() => [
  {
    id: 'condition',
    label: '상태 설명',
    text: '자켓과 음반 상태 기준으로 설명드리면, 사진과 같은 등급이며 큰 터짐이나 찢김은 없습니다.',
  },
  {
    id: 'pressing',
    label: '판본 확인',
    text: `카탈로그 번호 ${album.value.catalogNumber} 기준으로 확인한 판본입니다. 라벨/런아웃 사진이 필요하면 채팅으로 추가 확인해드릴 수 있습니다.`,
  },
  {
    id: 'deal',
    label: '거래 안내',
    text: '직거래와 택배 모두 가능합니다. 거래 장소와 시간은 채팅에서 조율하겠습니다.',
  },
]);

const buyerQuestions = computed(() => comments.value.filter(comment => comment.role === 'buyer'));
const selectedQuestionId = ref(buyerQuestions.value.find(comment => !comment.sellerReply)?.id || buyerQuestions.value[0]?.id || '');
const selectedTemplateId = ref(replyTemplates.value[0].id);
const sellerReply = ref(replyTemplates.value[0].text);
const newComment = ref('');

const selectQuestion = (id: string) => {
  selectedQuestionId.value = id;
};

const chooseTemplate = (id: string) => {
  const template = replyTemplates.value.find(item => item.id === id);
  if (!template) return;
  selectedTemplateId.value = id;
  sellerReply.value = template.text;
};

const postSellerReply = () => {
  if (!canSellerReply.value) return;
  const target = comments.value.find(comment => comment.id === selectedQuestionId.value);
  const template = replyTemplates.value.find(item => item.id === selectedTemplateId.value);
  if (!target || !sellerReply.value.trim()) return;
  target.sellerReply = sellerReply.value.trim();
  target.replyType = template?.label || '직접 답변';
  sellerReply.value = '';
};

const submit = () => {
  if (!newComment.value.trim()) return;
  if (isSeller.value && !canSellerReply.value) return;
  comments.value = [
    {
      id: String(Date.now()),
      userName: currentName.value,
      role: currentRole.value,
      content: newComment.value.trim(),
      timestamp: new Date().toISOString(),
      replyToId: currentRole.value === 'seller' ? selectedQuestionId.value : undefined,
    },
    ...comments.value,
  ];
  newComment.value = '';
};
</script>
