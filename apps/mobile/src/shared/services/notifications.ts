import type { Notification } from '@/shared/models/market';
import { fetchApi } from '@/shared/services/api';

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as T & { detail?: string };
  if (!response.ok) throw new Error(payload.detail || '알림 요청을 처리하지 못했습니다.');
  return payload;
}

export async function fetchNotifications() {
  const response = await fetchApi('/users/me/notifications');
  return readJson<{ notifications: Notification[] }>(response);
}

export async function markNotificationRead(notificationId: string) {
  const response = await fetchApi(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'PATCH' });
  return readJson<{ ok: boolean; notificationId: string }>(response);
}

export async function deleteNotification(notificationId: string) {
  const response = await fetchApi(`/notifications/${encodeURIComponent(notificationId)}`, { method: 'DELETE' });
  return readJson<{ ok: boolean; notificationId: string; unreadCount: number }>(response);
}

export async function markAllNotificationsRead() {
  const response = await fetchApi('/notifications/read-all', { method: 'POST' });
  return readJson<{ ok: boolean; unreadCount: number }>(response);
}

export async function fetchUnreadNotificationCount() {
  const response = await fetchApi('/notifications/unread-count');
  return readJson<{ unreadCount: number }>(response);
}
