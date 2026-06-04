export interface RealtimeChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  recipientId?: string;
  recipientName?: string;
  listingId?: string;
  message: string;
  timestamp: string;
  type: 'text' | 'offer' | 'image' | string;
}

import { fetchApi, getApiBaseUrl } from '@/shared/services/api';

const CHAT_SEPARATOR = '__dm__';

function normalizeChatPart(value: string) {
  return encodeURIComponent(String(value || 'unknown').trim() || 'unknown');
}

export function makeOneToOneChatId(listingId: string, userA: string, userB: string) {
  const listing = normalizeChatPart(listingId);
  const users = [normalizeChatPart(userA), normalizeChatPart(userB)].sort();
  return `${listing}${CHAT_SEPARATOR}${users[0]}__${users[1]}`;
}

export function listingIdFromChatId(chatId: string) {
  const [listingId] = String(chatId || '').split(CHAT_SEPARATOR);
  return decodeURIComponent(listingId || chatId);
}

export type ChatSocketEvent =
  | { type: 'history'; chatId: string; messages: RealtimeChatMessage[] }
  | { type: 'message'; chatId: string; message: RealtimeChatMessage }
  | { type: 'error'; message: string }
  | { type: 'pong'; chatId: string };

export function getWsBaseUrl() {
  return getApiBaseUrl().replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
}

export async function fetchChatMessages(chatId: string): Promise<RealtimeChatMessage[]> {
  const response = await fetchApi(`/chats/${encodeURIComponent(chatId)}/messages`, {}, 8000);
  if (!response.ok) throw new Error('Failed to load chat messages');
  const payload = await response.json() as { messages?: RealtimeChatMessage[] };
  return payload.messages || [];
}

export async function postChatMessage(
  chatId: string,
  message: Pick<RealtimeChatMessage, 'senderId' | 'senderName' | 'message'> & {
    messageType?: string;
    recipientId?: string;
    recipientName?: string;
    listingId?: string;
  },
): Promise<RealtimeChatMessage> {
  const response = await fetchApi(`/chats/${encodeURIComponent(chatId)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender_id: message.senderId,
      sender_name: message.senderName,
      recipient_id: message.recipientId,
      recipient_name: message.recipientName,
      listing_id: message.listingId || chatId,
      content: message.message,
      message_type: message.messageType || 'text',
    }),
  }, 8000);
  const payload = await response.json().catch(() => ({})) as { message?: RealtimeChatMessage; detail?: string };
  if (!response.ok || !payload.message) throw new Error(payload.detail || 'Failed to send chat message');
  return payload.message;
}

export function openChatSocket(chatId: string, userId: string, options: { listingId?: string; recipientId?: string } = {}) {
  const params = new URLSearchParams({ user_id: userId });
  if (options.listingId) params.set('listing_id', options.listingId);
  if (options.recipientId) params.set('recipient_id', options.recipientId);
  const url = `${getWsBaseUrl()}/ws/chats/${encodeURIComponent(chatId)}?${params.toString()}`;
  return new WebSocket(url);
}

export function sendChatSocketMessage(
  socket: WebSocket,
  message: Pick<RealtimeChatMessage, 'senderId' | 'senderName' | 'message'> & {
    messageType?: string;
    recipientId?: string;
    recipientName?: string;
    listingId?: string;
  },
) {
  socket.send(JSON.stringify({
    type: 'message',
    senderId: message.senderId,
    senderName: message.senderName,
    recipientId: message.recipientId,
    recipientName: message.recipientName,
    listingId: message.listingId,
    content: message.message,
    messageType: message.messageType || 'text',
  }));
}
