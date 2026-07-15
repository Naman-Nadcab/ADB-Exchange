/** P2P order-room chat — display and merge helpers mirroring website P2PChat. */

import type { P2PMessage } from '@exchange/mobile-types';

export const CHAT_MESSAGE_MIN = 1;
export const CHAT_MESSAGE_MAX = 2000;
export const CHAT_TYPING_THROTTLE_MS = 2800;
export const CHAT_READ_DEBOUNCE_MS = 900;
export const CHAT_POLL_LIVE_MS = 45_000;
export const CHAT_POLL_OFFLINE_MS = 4_000;

export type ChatListItem =
  | { kind: 'date'; key: string; label: string }
  | { kind: 'message'; key: string; message: P2PMessage };

export function validateChatMessage(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length < CHAT_MESSAGE_MIN) return 'Message is required';
  if (trimmed.length > CHAT_MESSAGE_MAX) return `Message must be at most ${CHAT_MESSAGE_MAX} characters`;
  return null;
}

export function isSystemChatMessage(message: P2PMessage): boolean {
  if (!message.senderId || message.senderId === 'system') return true;
  return message.senderUsername?.toLowerCase() === 'system';
}

export function sortMessagesByCreatedAt(messages: P2PMessage[]): P2PMessage[] {
  return [...messages].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export function mergeChatMessages(existing: P2PMessage[], incoming: P2PMessage[]): P2PMessage[] {
  const map = new Map<string, P2PMessage>();
  for (const m of existing) {
    map.set(m.id, m);
    if (m._clientId) map.set(m._clientId, m);
  }
  for (const m of incoming) {
    const prev = map.get(m.id) ?? (m._clientId ? map.get(m._clientId) : undefined);
    map.set(m.id, prev ? { ...prev, ...m, _pending: m._pending ?? prev._pending, _failed: m._failed ?? prev._failed } : m);
    if (m._clientId) map.set(m._clientId, map.get(m.id)!);
  }
  const deduped = new Map<string, P2PMessage>();
  for (const m of map.values()) {
    if (!deduped.has(m.id)) deduped.set(m.id, m);
  }
  return sortMessagesByCreatedAt([...deduped.values()]);
}

export function formatChatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatChatDateSeparator(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function buildChatListItems(messages: P2PMessage[]): ChatListItem[] {
  const sorted = sortMessagesByCreatedAt(messages);
  const items: ChatListItem[] = [];
  let lastDate = '';
  for (const message of sorted) {
    const day = message.createdAt ? new Date(message.createdAt).toDateString() : '';
    if (day && day !== lastDate) {
      lastDate = day;
      items.push({
        kind: 'date',
        key: `date-${day}`,
        label: formatChatDateSeparator(message.createdAt),
      });
    }
    items.push({ kind: 'message', key: message._clientId ?? message.id, message });
  }
  return items;
}

export function chatConnectionLabel(live: boolean): string {
  return live ? 'Live' : 'Reconnecting…';
}

export function shouldMarkMessageRead(message: P2PMessage | undefined, currentUserId?: string | null): boolean {
  if (!message?.id || message._pending || message._failed) return false;
  if (!currentUserId) return true;
  return message.senderId !== currentUserId && message.senderId !== 'self';
}
