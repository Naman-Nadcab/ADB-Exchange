import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextField, PrimaryButton } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { useWsMetricsStore } from '@core/state/wsMetricsStore';
import type { P2PMessage } from '@exchange/mobile-types';
import {
  buildChatListItems,
  chatConnectionLabel,
  formatChatTime,
  isSystemChatMessage,
  validateChatMessage,
  CHAT_MESSAGE_MAX,
} from '@core/domain/p2p/chat';

type Props = {
  messages: P2PMessage[];
  typingUserId?: string | null;
  currentUserId?: string;
  onSend: (text: string) => void;
  onResend?: (text: string) => void;
  onTyping?: () => void;
  sending?: boolean;
  loading?: boolean;
  enabled?: boolean;
  wsConnected?: boolean;
  sendError?: boolean;
};

export function P2PChatPanel({
  messages,
  typingUserId,
  currentUserId,
  onSend,
  onResend,
  onTyping,
  sending,
  loading,
  enabled = true,
  wsConnected,
  sendError,
}: Props) {
  const { theme } = useTheme();
  const metricsLive = useWsMetricsStore((s) => s.streamPhase === 'live');
  const live = wsConnected ?? metricsLive;
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);
  const listItems = useMemo(() => buildChatListItems(messages), [messages]);
  const invertedData = useMemo(() => [...listItems].reverse(), [listItems]);

  useEffect(() => {
    if (listItems.length) {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [listItems.length, listItems[listItems.length - 1]?.key]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || !enabled || validateChatMessage(trimmed)) return;
    onSend(trimmed);
    setText('');
  };

  if (!enabled) {
    return (
      <View style={[styles.wrap, styles.disabledWrap, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
        <Ionicons name="chatbubble-ellipses-outline" size={18} color={`hsl(${theme.colors.foregroundSecondary})`} />
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13, flex: 1 }}>
          Chat available when the order is open.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={`hsl(${theme.colors.brandPrimary})`} />
          <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>Chat</Text>
        </View>
        <View style={[styles.wsBadge, { backgroundColor: live ? 'rgba(14,203,129,0.12)' : 'rgba(245,158,11,0.12)' }]}>
          <View style={[styles.wsDot, { backgroundColor: live ? '#0ecb81' : '#f59e0b' }]} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: live ? '#0ecb81' : '#f59e0b' }}>
            {chatConnectionLabel(live)}
          </Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        style={styles.list}
        data={invertedData}
        keyExtractor={(item) => item.key}
        inverted
        initialNumToRender={20}
        maxToRenderPerBatch={15}
        windowSize={7}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyBox}>
              <ActivityIndicator color={`hsl(${theme.colors.brandPrimary})`} />
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons name="chatbubble-outline" size={28} color={`hsl(${theme.colors.foregroundSecondary})`} style={{ opacity: 0.35 }} />
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, textAlign: 'center' }}>No messages yet</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          if (item.kind === 'date') {
            return (
              <View style={styles.dateRow}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: `hsl(${theme.colors.foregroundSecondary})` }}>{item.label}</Text>
              </View>
            );
          }

          const message = item.message;
          if (isSystemChatMessage(message)) {
            return (
              <View style={styles.systemRow}>
                <Text style={{ fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})`, textAlign: 'center' }}>{message.message}</Text>
              </View>
            );
          }

          const mine = message.senderId === currentUserId || message.senderId === 'self';
          return (
            <Pressable
              disabled={!message._failed}
              onPress={() => message._failed && onResend?.(message.message)}
              style={[
                styles.bubble,
                mine
                  ? { alignSelf: 'flex-end', backgroundColor: 'rgba(59,130,246,0.15)' }
                  : { alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.06)' },
              ]}
            >
              {!mine && message.senderUsername ? (
                <Text style={{ fontSize: 10, fontWeight: '700', color: `hsl(${theme.colors.brandPrimary})`, marginBottom: 2 }}>
                  {message.senderUsername}
                </Text>
              ) : null}
              <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, lineHeight: 20 }}>{message.message}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>{formatChatTime(message.createdAt)}</Text>
                {message._pending ? <Text style={styles.meta}> · Sending…</Text> : null}
                {message._failed ? (
                  <Text style={[styles.meta, { color: `hsl(${theme.colors.statusError})` }]}> · Tap to retry</Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
        ListHeaderComponent={
          typingUserId && typingUserId !== currentUserId ? (
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, paddingVertical: 4, textAlign: 'center' }}>
              Typing…
            </Text>
          ) : null
        }
      />

      <View style={styles.inputRow}>
        <TextField
          label=""
          value={text}
          onChangeText={(v) => {
            setText(v.slice(0, CHAT_MESSAGE_MAX));
            onTyping?.();
          }}
          placeholder="Type a message…"
          editable={enabled && !sending}
        />
        <PrimaryButton title="Send" loading={sending} disabled={!enabled || !text.trim()} onPress={submit} />
      </View>
      {sendError ? (
        <Text style={{ fontSize: 12, color: `hsl(${theme.colors.statusError})`, marginTop: 6 }}>Failed to send. Try again.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 260 },
  disabledWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 0, paddingVertical: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wsBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  wsDot: { width: 8, height: 8, borderRadius: 4 },
  list: { flexGrow: 0, maxHeight: 320 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  dateRow: { alignItems: 'center', paddingVertical: 8 },
  systemRow: { alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12 },
  bubble: { padding: 10, borderRadius: 8, marginVertical: 4, maxWidth: '85%' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  meta: { fontSize: 10, color: 'rgba(120,120,120,0.9)' },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 8 },
});
