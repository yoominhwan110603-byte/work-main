<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 border-b flex items-center gap-3 shrink-0">
      <button class="p-2 -ml-2 rounded-full active:bg-gray-100" @click="goBack(router)">
        <ArrowLeft :size="24" />
      </button>
      <div class="flex-1 min-w-0">
        <h2 class="font-semibold truncate">{{ chatTitle }}</h2>
        <p class="text-xs" :class="connectionClass">{{ connectionLabel }}</p>
      </div>
    </header>

    <section class="bg-gray-50 p-3 border-b shrink-0">
      <button class="w-full bg-white rounded-lg p-3 flex gap-3 text-left active:bg-gray-50" @click="openContext">
        <VinylCover :src="contextImage" :alt="contextTitle" class="w-16 h-16 object-cover rounded-lg" />
        <div class="flex-1 min-w-0">
          <p class="text-sm mb-1 truncate">{{ contextTitle }}</p>
          <p class="text-sm text-gray-600 truncate">{{ contextSubtitle }}</p>
          <p class="text-sm mt-1">{{ isCollectionContext ? '컬렉션 문의' : `${album.price.toLocaleString()}원` }}</p>
        </div>
      </button>
    </section>

    <section v-if="!isCollectionContext" class="border-b bg-white p-3 shrink-0">
      <div class="rounded-lg border p-3">
        <div class="flex items-center justify-between mb-3 gap-3">
          <div>
            <p class="text-sm font-medium">거래 완료 확인</p>
            <p class="text-xs text-gray-500">구매자와 판매자가 모두 확인하면 리뷰 화면으로 이동합니다.</p>
          </div>
          <span v-if="isTradeCompleted" class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs flex items-center gap-1">
            <CheckCircle2 :size="14" /> 완료
          </span>
          <span v-else-if="activeTrade" class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">거래 중</span>
          <span v-else class="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">대기</span>
        </div>
        <div v-if="false" class="grid grid-cols-2 gap-2">
          <button :class="completionButtonClass(completion.buyerChecked)" @click="completion.buyerChecked = !completion.buyerChecked">구매자 확인</button>
          <button :class="completionButtonClass(completion.sellerChecked)" @click="completion.sellerChecked = !completion.sellerChecked">판매자 확인</button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{{ otherCompletionLabel }}</div>
          <button :class="completionButtonClass(myCompletionChecked)" @click="confirmMySide">{{ myCompletionLabel }}</button>
        </div>
      </div>
    </section>

    <section v-if="!isCollectionContext && otherCompletionChecked && !isTradeCompleted" class="border-b bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {{ recipient.name || '상대방' }}님이 거래 완료를 확인했습니다. 내 확인까지 완료되면 리뷰로 이동합니다.
    </section>

    <main ref="messageList" class="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
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
    </main>

    <footer class="border-t p-3 shrink-0 bg-white">
      <div class="flex gap-2 mb-3 overflow-x-auto">
        <button class="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-lg text-sm whitespace-nowrap" type="button">
          <ImageIcon :size="16" /> 이미지
        </button>
        <button v-if="!isCollectionContext && !isSeller" class="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-lg text-sm whitespace-nowrap" type="button" @click="router.push(`/transaction/offer/${album.id}`)">
          <DollarSign :size="16" /> 가격 제안
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
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, CheckCircle2, DollarSign, Image as ImageIcon, Send } from 'lucide-vue-next';
import { completeActiveTrade, getActiveTrade, getTradeCompletion, saveTradeCompletion } from '@/features/transaction/services/tradeState';
import {
  fetchChatMessages,
  listingIdFromChatId,
  makeOneToOneChatId,
  openChatSocket,
  postChatMessage,
  sendChatSocketMessage,
  type ChatSocketEvent,
  type RealtimeChatMessage,
} from '@/features/transaction/services/chatClient';
import { useAppStore } from '@/shared/stores/appStore';
import { fallbackAlbum } from '@/features/buyer/services/albumLookup';
import { goBack } from '@/shared/services/navigation';
import VinylCover from '@/shared/components/VinylCover.vue';

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();

const routeChatId = computed(() => String(route.params.chatId || ''));
const listingId = computed(() => String(route.query.listingId || listingIdFromChatId(routeChatId.value)));
const album = computed(() => fallbackAlbum(appStore, listingId.value));
const collectionId = computed(() => String(route.query.collectionId || ''));
const collection = computed(() => appStore.collections.find(item => item.id === collectionId.value));
const isCollectionContext = computed(() => Boolean(collection.value));
const contextId = computed(() => collection.value?.id || album.value.id);
const contextOwner = computed(() => collection.value?.owner || album.value.seller);
const contextTitle = computed(() => collection.value?.title || album.value.title);
const contextSubtitle = computed(() => collection.value ? `${collection.value.artist || '아티스트 미상'} · ${collection.value.owner.name}` : album.value.artist);
const contextImage = computed(() => collection.value?.images[0] || album.value.images[0] || '');
const activeTrade = computed(() => isCollectionContext.value ? undefined : getActiveTrade(album.value.id));
const savedCompletion = getTradeCompletion(contextId.value);
const completion = reactive({
  buyerChecked: savedCompletion.buyerChecked || false,
  sellerChecked: savedCompletion.sellerChecked || false,
  completedAt: savedCompletion.completedAt,
});

const currentUserId = computed(() => appStore.user.id || 'guest');
const currentUserName = computed(() => appStore.user.username || '사용자');
const messages = ref<RealtimeChatMessage[]>([]);
const routeRecipient = computed(() => ({
  id: String(route.query.recipientId || ''),
  name: String(route.query.recipientName || ''),
}));
const recipient = computed(() => {
  if (routeRecipient.value.id) return routeRecipient.value;
  const otherMessage = [...messages.value].reverse().find(message => message.senderId !== currentUserId.value);
  if (otherMessage) return { id: otherMessage.senderId, name: otherMessage.senderName };
  if (contextOwner.value.id !== currentUserId.value) return { id: contextOwner.value.id, name: contextOwner.value.name };
  return { id: '', name: '' };
});
const chatId = computed(() => {
  if (routeChatId.value.includes('__dm__')) return routeChatId.value;
  if (recipient.value.id) return makeOneToOneChatId(contextId.value, currentUserId.value, recipient.value.id);
  return routeChatId.value || contextId.value;
});
const chatTitle = computed(() => recipient.value.name || contextOwner.value.name || '채팅');
const inputMessage = ref('');
const isLoading = ref(false);
const socketStatus = ref<'connecting' | 'open' | 'closed' | 'error'>('connecting');
const messageList = ref<HTMLElement | null>(null);
const reviewOpened = ref(false);
const isTradeCompleted = computed(() => completion.buyerChecked && completion.sellerChecked);
const isSeller = computed(() => contextOwner.value.id === currentUserId.value);
const myCompletionChecked = computed(() => isSeller.value ? completion.sellerChecked : completion.buyerChecked);
const otherCompletionChecked = computed(() => isSeller.value ? completion.buyerChecked : completion.sellerChecked);
const myCompletionLabel = computed(() => myCompletionChecked.value ? '내 확인 완료' : (isSeller.value ? '판매자 확인' : '구매자 확인'));
const otherCompletionLabel = computed(() => otherCompletionChecked.value ? '상대 확인 완료' : '상대 확인 대기');
let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let manuallyClosed = false;

const canSend = computed(() => inputMessage.value.trim().length > 0 && Boolean(recipient.value.id));
const connectionLabel = computed(() => {
  if (socketStatus.value === 'open') return '실시간 채팅 연결됨';
  if (socketStatus.value === 'connecting') return '실시간 채팅 연결 중';
  if (socketStatus.value === 'error') return '연결 오류, 다시 시도 중';
  return '연결 끊김, 다시 시도 중';
});
const connectionClass = computed(() => socketStatus.value === 'open' ? 'text-green-600' : 'text-gray-500');

const completionButtonClass = (checked: boolean) => [
  'py-2 rounded-lg border text-sm',
  checked ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-200 text-gray-700',
];

const formatTime = (timestamp: string) => new Date(timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
const openContext = () => {
  if (collection.value) router.push(`/app/collection/${collection.value.id}`);
  else router.push(`/app/album/${album.value.id}`);
};

const scrollToBottom = async () => {
  await nextTick();
  if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight;
};

const applyTradeConfirmation = (message: RealtimeChatMessage) => {
  if (message.type === 'trade-confirmation') {
    if (message.senderId === contextOwner.value.id) completion.sellerChecked = true;
    else completion.buyerChecked = true;
  }
};

const syncTradeConfirmations = (chatMessages: RealtimeChatMessage[]) => {
  chatMessages.forEach(applyTradeConfirmation);
};

const upsertMessage = (message: RealtimeChatMessage) => {
  applyTradeConfirmation(message);
  const index = messages.value.findIndex(item => item.id === message.id);
  if (index >= 0) messages.value[index] = message;
  else messages.value.push(message);
  void scrollToBottom();
};

const connectSocket = () => {
  manuallyClosed = false;
  if (socket) socket.close();
  socketStatus.value = 'connecting';
  socket = openChatSocket(chatId.value, currentUserId.value, { listingId: contextId.value, recipientId: recipient.value.id });

  socket.onopen = () => { socketStatus.value = 'open'; };
  socket.onmessage = (event) => {
    const payload = JSON.parse(event.data) as ChatSocketEvent;
    if (payload.type === 'history') {
      messages.value = payload.messages;
      syncTradeConfirmations(messages.value);
      void scrollToBottom();
    }
    if (payload.type === 'message') upsertMessage(payload.message);
    if (payload.type === 'error') socketStatus.value = 'error';
  };
  socket.onerror = () => { socketStatus.value = 'error'; };
  socket.onclose = () => {
    socketStatus.value = 'closed';
    if (manuallyClosed) return;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(connectSocket, 1500);
  };
};

const loadHistory = async () => {
  isLoading.value = true;
  try {
    messages.value = await fetchChatMessages(chatId.value);
    syncTradeConfirmations(messages.value);
    await scrollToBottom();
  } catch {
    messages.value = [];
  } finally {
    isLoading.value = false;
  }
};

const send = async () => {
  const content = inputMessage.value.trim();
  if (!content || !recipient.value.id) return;
  inputMessage.value = '';
  const payload = {
    senderId: currentUserId.value,
    senderName: currentUserName.value,
    recipientId: recipient.value.id,
    recipientName: recipient.value.name,
    listingId: contextId.value,
    message: content,
  };
  if (socket && socket.readyState === WebSocket.OPEN) {
    sendChatSocketMessage(socket, payload);
    return;
  }
  try {
    upsertMessage(await postChatMessage(chatId.value, payload));
  } catch {
    socketStatus.value = 'error';
    inputMessage.value = content;
  }
};

const sendTradeConfirmationMessage = async () => {
  const payload = {
    senderId: currentUserId.value,
    senderName: currentUserName.value,
    recipientId: recipient.value.id,
    recipientName: recipient.value.name,
    listingId: contextId.value,
    message: `${currentUserName.value}님이 거래 완료를 확인했습니다.`,
    messageType: 'trade-confirmation',
  };
  if (socket && socket.readyState === WebSocket.OPEN) {
    sendChatSocketMessage(socket, payload);
    return;
  }
  try {
    upsertMessage(await postChatMessage(chatId.value, payload));
  } catch {
    socketStatus.value = 'error';
  }
};

const confirmMySide = () => {
  if (myCompletionChecked.value) return;
  if (isSeller.value) completion.sellerChecked = true;
  else completion.buyerChecked = true;
  void sendTradeConfirmationMessage();
};

watch(completion, () => {
  saveTradeCompletion(contextId.value, { ...completion, completedAt: isTradeCompleted.value ? (completion.completedAt || new Date().toISOString()) : completion.completedAt });
  if (isTradeCompleted.value) {
    completeActiveTrade(contextId.value);
    if (!reviewOpened.value) {
      reviewOpened.value = true;
      setTimeout(() => router.push(`/transaction/review/${contextId.value}`), 500);
    }
  }
}, { deep: true });

onMounted(async () => {
  await appStore.loadListingsFromServer();
  await loadHistory();
  connectSocket();
});

onBeforeUnmount(() => {
  manuallyClosed = true;
  if (reconnectTimer) window.clearTimeout(reconnectTimer);
  socket?.close();
});
</script>
