<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 border-b flex items-center gap-3 shrink-0">
      <button class="p-2 -ml-2 rounded-full active:bg-gray-100" @click="router.back()">
        <ArrowLeft :size="24" />
      </button>
      <div class="flex-1 min-w-0">
        <h2 class="font-semibold truncate">{{ album.seller.name }}</h2>
        <p class="text-xs" :class="connectionClass">{{ connectionLabel }}</p>
      </div>
    </header>

    <div class="bg-gray-50 p-3 border-b shrink-0">
      <div class="bg-white rounded-lg p-3 flex gap-3 active:bg-gray-50" @click="router.push(`/app/album/${album.id}`)">
        <VinylCover :src="album.images[0]" :alt="album.title" class="w-16 h-16 object-cover rounded-lg" />
        <div class="flex-1 min-w-0">
          <p class="text-sm mb-1 truncate">{{ album.title }}</p>
          <p class="text-sm text-gray-600 truncate">{{ album.artist }}</p>
          <p class="text-sm mt-1">{{ album.price.toLocaleString() }}원</p>
        </div>
      </div>
    </div>

    <div class="border-b bg-white p-3 shrink-0">
      <div class="rounded-lg border p-3">
        <div class="flex items-center justify-between mb-3 gap-3">
          <div>
            <p class="text-sm font-medium">거래 완료 확인</p>
            <p class="text-xs text-gray-500">구매자와 판매자가 모두 확인하면 거래가 완료됩니다.</p>
          </div>
          <span v-if="isTradeCompleted" class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs flex items-center gap-1">
            <CheckCircle2 :size="14" />완료
          </span>
          <span v-else-if="activeTrade" class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">거래 중</span>
          <span v-else class="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">대기</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button :class="completionButtonClass(completion.buyerChecked)" @click="completion.buyerChecked = !completion.buyerChecked">구매자 확인</button>
          <button :class="completionButtonClass(completion.sellerChecked)" @click="completion.sellerChecked = !completion.sellerChecked">판매자 확인</button>
        </div>
      </div>
    </div>

    <div ref="messageList" class="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
      <div v-if="isLoading" class="text-center text-sm text-gray-500 py-6">메시지를 불러오는 중입니다.</div>
      <div v-else-if="messages.length === 0" class="text-center text-sm text-gray-500 py-6">
        아직 메시지가 없습니다. 첫 메시지를 보내보세요.
      </div>

      <div v-for="msg in messages" :key="msg.id" :class="['flex', msg.senderId === currentUserId ? 'justify-end' : 'justify-start']">
        <div :class="['max-w-[76%] px-4 py-2 rounded-lg', msg.senderId === currentUserId ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900']">
          <p v-if="msg.senderId !== currentUserId" class="text-[11px] mb-1 text-gray-500">{{ msg.senderName }}</p>
          <p class="text-sm whitespace-pre-wrap break-words">{{ msg.message }}</p>
          <p :class="['text-xs mt-1', msg.senderId === currentUserId ? 'text-blue-100' : 'text-gray-500']">
            {{ formatTime(msg.timestamp) }}
          </p>
        </div>
      </div>
    </div>

    <div class="border-t p-3 shrink-0 bg-white">
      <div class="flex gap-2 mb-3 overflow-x-auto">
        <button class="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-lg text-sm whitespace-nowrap">
          <ImageIcon :size="16" />이미지
        </button>
        <button class="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-lg text-sm whitespace-nowrap" @click="router.push(`/transaction/offer/${album.id}`)">
          <DollarSign :size="16" />가격 제안
        </button>
      </div>
      <div class="flex gap-2">
        <input
          v-model="inputMessage"
          type="text"
          placeholder="메시지를 입력하세요"
          class="flex-1 min-w-0 px-4 py-3 border rounded-lg"
          @keydown.enter="send"
        />
        <button class="px-4 py-3 bg-blue-600 text-white rounded-lg disabled:bg-gray-300" :disabled="!canSend" @click="send">
          <Send :size="20" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, CheckCircle2, DollarSign, Image as ImageIcon, Send } from 'lucide-vue-next';
import { mockAlbums } from '../data/mockData';
import { completeActiveTrade, getActiveTrade, getTradeCompletion, saveTradeCompletion } from '../data/tradeState';
import { fetchChatMessages, openChatSocket, sendChatSocketMessage, type ChatSocketEvent, type RealtimeChatMessage } from '../data/chatClient';
import { useAppStore } from '../stores/appStore';
import VinylCover from '../components/VinylCover.vue';

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const album = computed(() => mockAlbums.find(item => item.id === route.params.chatId) || mockAlbums[0]);
const chatId = computed(() => String(route.params.chatId || album.value.id));
const activeTrade = computed(() => getActiveTrade(album.value.id));
const savedCompletion = getTradeCompletion(album.value.id);
const completion = reactive({
  buyerChecked: savedCompletion.buyerChecked || false,
  sellerChecked: savedCompletion.sellerChecked || false,
  completedAt: savedCompletion.completedAt,
});

const currentUserId = computed(() => appStore.user.id || 'buyer1');
const currentUserName = computed(() => appStore.user.username || '사용자');
const messages = ref<RealtimeChatMessage[]>([]);
const inputMessage = ref('');
const isLoading = ref(false);
const socketStatus = ref<'connecting' | 'open' | 'closed' | 'error'>('connecting');
const messageList = ref<HTMLElement | null>(null);
const reviewOpened = ref(false);
const isTradeCompleted = computed(() => completion.buyerChecked && completion.sellerChecked);
let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;

const canSend = computed(() => inputMessage.value.trim().length > 0 && socketStatus.value === 'open');
const connectionLabel = computed(() => {
  if (socketStatus.value === 'open') return '실시간 채팅 연결됨';
  if (socketStatus.value === 'connecting') return '실시간 채팅 연결 중';
  if (socketStatus.value === 'error') return '연결 오류, 재시도 중';
  return '연결 끊김, 재시도 중';
});
const connectionClass = computed(() => socketStatus.value === 'open' ? 'text-green-600' : 'text-gray-500');

const completionButtonClass = (checked: boolean) => [
  'py-2 rounded-lg border text-sm',
  checked ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-200 text-gray-700',
];

const formatTime = (timestamp: string) => new Date(timestamp).toLocaleTimeString('ko-KR', {
  hour: '2-digit',
  minute: '2-digit',
});

const scrollToBottom = async () => {
  await nextTick();
  if (messageList.value) {
    messageList.value.scrollTop = messageList.value.scrollHeight;
  }
};

const upsertMessage = (message: RealtimeChatMessage) => {
  const index = messages.value.findIndex(item => item.id === message.id);
  if (index >= 0) {
    messages.value[index] = message;
  } else {
    messages.value.push(message);
  }
  void scrollToBottom();
};

const connectSocket = () => {
  if (socket) socket.close();
  socketStatus.value = 'connecting';
  socket = openChatSocket(chatId.value, currentUserId.value);

  socket.onopen = () => {
    socketStatus.value = 'open';
  };
  socket.onmessage = (event) => {
    const payload = JSON.parse(event.data) as ChatSocketEvent;
    if (payload.type === 'history') {
      messages.value = payload.messages;
      void scrollToBottom();
    }
    if (payload.type === 'message') {
      upsertMessage(payload.message);
    }
    if (payload.type === 'error') {
      socketStatus.value = 'error';
    }
  };
  socket.onerror = () => {
    socketStatus.value = 'error';
  };
  socket.onclose = () => {
    socketStatus.value = 'closed';
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(connectSocket, 1500);
  };
};

const loadHistory = async () => {
  isLoading.value = true;
  try {
    messages.value = await fetchChatMessages(chatId.value);
    await scrollToBottom();
  } catch {
    messages.value = [];
  } finally {
    isLoading.value = false;
  }
};

const send = () => {
  const content = inputMessage.value.trim();
  if (!content || !socket || socket.readyState !== WebSocket.OPEN) return;
  sendChatSocketMessage(socket, {
    senderId: currentUserId.value,
    senderName: currentUserName.value,
    message: content,
  });
  inputMessage.value = '';
};

watch(completion, () => {
  saveTradeCompletion(album.value.id, { ...completion, completedAt: isTradeCompleted.value ? (completion.completedAt || new Date().toISOString()) : completion.completedAt });
  if (isTradeCompleted.value) {
    completeActiveTrade(album.value.id);
    if (!reviewOpened.value) {
      reviewOpened.value = true;
      setTimeout(() => router.push(`/transaction/review/${album.value.id}`), 500);
    }
  }
}, { deep: true });

onMounted(async () => {
  await loadHistory();
  connectSocket();
});

onBeforeUnmount(() => {
  if (reconnectTimer) window.clearTimeout(reconnectTimer);
  socket?.close();
});
</script>
