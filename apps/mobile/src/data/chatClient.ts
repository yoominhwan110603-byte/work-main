export interface RealtimeChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: string;
  type: 'text' | 'offer' | 'image' | string;
}

export type ChatSocketEvent =
  | { type: 'history'; chatId: string; messages: RealtimeChatMessage[] }
  | { type: 'message'; chatId: string; message: RealtimeChatMessage }
  | { type: 'error'; message: string }
  | { type: 'pong'; chatId: string };

const DEV_LAN_API_BASE_URL = 'http://172.30.14.95:8000';

export function getApiBaseUrl() {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL;
  if (typeof window === 'undefined') return 'http://localhost:8000';

  const { protocol, hostname } = window.location;
  const localHostnames = new Set(['localhost', '127.0.0.1', '::1']);
  if (localHostnames.has(hostname)) return DEV_LAN_API_BASE_URL;

  return `${protocol.startsWith('http') ? protocol : 'http:'}//${hostname}:8000`;
}

export function getWsBaseUrl() {
  return getApiBaseUrl().replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
}

export async function fetchChatMessages(chatId: string): Promise<RealtimeChatMessage[]> {
  const response = await fetch(`${getApiBaseUrl()}/chats/${encodeURIComponent(chatId)}/messages`);
  if (!response.ok) throw new Error('Failed to load chat messages');
  const payload = await response.json() as { messages?: RealtimeChatMessage[] };
  return payload.messages || [];
}

export function openChatSocket(chatId: string, userId: string) {
  const url = `${getWsBaseUrl()}/ws/chats/${encodeURIComponent(chatId)}?user_id=${encodeURIComponent(userId)}`;
  return new WebSocket(url);
}

export function sendChatSocketMessage(
  socket: WebSocket,
  message: Pick<RealtimeChatMessage, 'senderId' | 'senderName' | 'message'> & { messageType?: string },
) {
  socket.send(JSON.stringify({
    type: 'message',
    senderId: message.senderId,
    senderName: message.senderName,
    content: message.message,
    messageType: message.messageType || 'text',
  }));
}
