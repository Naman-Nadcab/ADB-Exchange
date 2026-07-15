import { useEffect, useRef, useState } from 'react';
import { FlatList, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextField, PrimaryButton } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { useWsMetricsStore } from '@core/state/wsMetricsStore';
import type { P2PMessage } from '@exchange/mobile-types';

type Props = {
  messages: P2PMessage[];
  typingUserId?: string | null;
  currentUserId?: string;
  onSend: (text: string) => void;
  onResend?: (text: string) => void;
  onTyping?: () => void;
  sending?: boolean;
  enabled?: boolean;
};

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function P2PChatPanel({
  messages,
  typingUserId,
  currentUserId,
  onSend,
  onResend,
  onTyping,
  sending,
  enabled = true,
}: Props) {
  const { theme } = useTheme();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);
  const wsLive = useWsMetricsStore((s) => s.streamPhase === 'live');

  useEffect(() => {
    if (messages.length) {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [messages.length, messages[messages.length - 1]?.id]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || !enabled) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <View style={[styles.wrap, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
      <View style={styles.header}>
        <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>Chat</Text>
        <View style={styles.wsBadge}>
          <View style={[styles.wsDot, { backgroundColor: wsLive ? `hsl(${theme.colors.tradeBuy})` : '#f59e0b' }]} />
          <Text style={{ fontSize: 11, color: `hsl(${theme.colors.foregroundSecondary})` }}>
            {wsLive ? 'Live' : 'Polling'}
          </Text>
        </View>
      </View>

      {!enabled ? (
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13, padding: 12 }}>
          Chat is closed for this order.
        </Text>
      ) : (
        <>
          <FlatList
            ref={listRef}
            style={styles.list}
            data={messages}
            keyExtractor={(m) => m._clientId ?? m.id}
            inverted
            initialNumToRender={20}
            maxToRenderPerBatch={15}
            windowSize={7}
            ListEmptyComponent={
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, textAlign: 'center', padding: 16 }}>
                No messages yet. Say hello to your counterparty.
              </Text>
            }
            renderItem={({ item }) => {
              const mine = item.senderId === currentUserId || item.senderId === 'self';
              return (
                <Pressable
                  disabled={!item._failed}
                  onPress={() => item._failed && onResend?.(item.message)}
                  style={[styles.bubble, mine ? styles.mine : styles.theirs]}
                >
                  {!mine && item.senderUsername ? (
                    <Text style={{ fontSize: 10, color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 2 }}>
                      {item.senderUsername}
                    </Text>
                  ) : null}
                  <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})` }}>{item.message}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}>{formatMessageTime(item.createdAt)}</Text>
                    {item._pending ? <Text style={styles.meta}> · Sending…</Text> : null}
                    {item._failed ? (
                      <Text style={[styles.meta, { color: `hsl(${theme.colors.statusError})` }]}> · Tap to retry</Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
            ListHeaderComponent={
              typingUserId && typingUserId !== currentUserId ? (
                <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, paddingVertical: 4 }}>
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
                setText(v);
                onTyping?.();
              }}
              placeholder="Message"
              editable={enabled && !sending}
            />
            <PrimaryButton title="Send" loading={sending} disabled={!enabled} onPress={submit} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 260 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  wsBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wsDot: { width: 8, height: 8, borderRadius: 4 },
  list: { flexGrow: 0, maxHeight: 320 },
  bubble: { padding: 10, borderRadius: 8, marginVertical: 4, maxWidth: '85%' },
  mine: { alignSelf: 'flex-end', backgroundColor: 'rgba(59,130,246,0.15)' },
  theirs: { alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.06)' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  meta: { fontSize: 10, color: 'rgba(120,120,120,0.9)' },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 8 },
});
