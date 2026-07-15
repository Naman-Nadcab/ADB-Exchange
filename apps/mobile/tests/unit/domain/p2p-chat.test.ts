import type { P2PMessage } from '@exchange/mobile-types';
import {
  buildChatListItems,
  chatConnectionLabel,
  mergeChatMessages,
  sortMessagesByCreatedAt,
  validateChatMessage,
  isSystemChatMessage,
} from '@core/domain/p2p/chat';

const msg = (over: Partial<P2PMessage> = {}): P2PMessage => ({
  id: over.id ?? 'm-1',
  orderId: 'ord-1',
  senderId: over.senderId ?? 'user-a',
  message: over.message ?? 'Hello',
  createdAt: over.createdAt ?? '2026-07-15T10:00:00Z',
  ...over,
});

describe('p2p chat domain', () => {
  it('validates message length', () => {
    expect(validateChatMessage('')).toMatch(/required/);
    expect(validateChatMessage('hi')).toBeNull();
  });

  it('sorts messages by createdAt', () => {
    const sorted = sortMessagesByCreatedAt([
      msg({ id: 'b', createdAt: '2026-07-15T11:00:00Z' }),
      msg({ id: 'a', createdAt: '2026-07-15T10:00:00Z' }),
    ]);
    expect(sorted.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('merges without duplicate ids', () => {
    const merged = mergeChatMessages([msg({ id: 'a' })], [msg({ id: 'a', message: 'Updated' }), msg({ id: 'b' })]);
    expect(merged).toHaveLength(2);
    expect(merged.find((m) => m.id === 'a')?.message).toBe('Updated');
  });

  it('builds date separators', () => {
    const items = buildChatListItems([
      msg({ id: 'a', createdAt: '2026-07-15T10:00:00Z' }),
      msg({ id: 'b', createdAt: '2026-07-16T10:00:00Z' }),
    ]);
    expect(items.some((i) => i.kind === 'date')).toBe(true);
    expect(items.filter((i) => i.kind === 'message')).toHaveLength(2);
  });

  it('detects system messages', () => {
    expect(isSystemChatMessage(msg({ senderId: 'system' }))).toBe(true);
    expect(isSystemChatMessage(msg({ senderUsername: 'system' }))).toBe(true);
  });

  it('labels connection state like website', () => {
    expect(chatConnectionLabel(true)).toBe('Live');
    expect(chatConnectionLabel(false)).toBe('Reconnecting…');
  });
});
