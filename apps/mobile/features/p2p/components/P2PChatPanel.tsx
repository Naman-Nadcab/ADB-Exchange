import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextField, PrimaryButton, ExchangeCard, StatusChip } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
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
  const info = semanticStatusPalette(theme.colors, 'info');
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
      <ExchangeCard
        style={[
          styles.disabledWrap,
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing[2.5],
            minHeight: 0,
            paddingVertical: theme.spacing[4],
          },
        ]}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={theme.sizes.iconMd} color={`hsl(${theme.colors.foregroundSecondary})`} />
        <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})`, flex: 1 }]}>
          Chat available when the order is open.
        </Text>
      </ExchangeCard>
    );
  }

  return (
    <ExchangeCard style={{ minHeight: 260, gap: theme.spacing[2] }}>
      <View style={styles.header}>
        <View style={[styles.titleRow, { gap: theme.spacing[2] }]}>
          <Ionicons name="chatbubble-ellipses-outline" size={theme.sizes.iconSm} color={`hsl(${theme.colors.brandPrimary})`} />
          <Text
            style={[
              theme.typography.bodyMd,
              { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
            ]}
          >
            Chat
          </Text>
        </View>
        <StatusChip label={chatConnectionLabel(live)} tone={live ? 'live' : 'warn'} />
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
            <View style={[styles.emptyBox, { paddingVertical: theme.spacing[6] }]}>
              <ActivityIndicator color={`hsl(${theme.colors.brandPrimary})`} />
            </View>
          ) : (
            <View style={[styles.emptyBox, { paddingVertical: theme.spacing[6], gap: theme.spacing[2] }]}>
              <Ionicons
                name="chatbubble-outline"
                size={28}
                color={`hsl(${theme.colors.foregroundSecondary})`}
                style={{ opacity: theme.opacity.muted }}
              />
              <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})`, textAlign: 'center' }]}>
                No messages yet
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          if (item.kind === 'date') {
            return (
              <View style={[styles.dateRow, { paddingVertical: theme.spacing[2] }]}>
                <Text
                  style={[
                    theme.typography.labelSm,
                    { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.sansSemiBold },
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            );
          }

          const message = item.message;
          if (isSystemChatMessage(message)) {
            return (
              <View style={[styles.systemRow, { paddingVertical: theme.spacing[1.5], paddingHorizontal: theme.spacing[3] }]}>
                <Text
                  style={[
                    theme.typography.bodySm,
                    { color: `hsl(${theme.colors.foregroundSecondary})`, textAlign: 'center' },
                  ]}
                >
                  {message.message}
                </Text>
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
                {
                  padding: theme.spacing[2.5],
                  borderRadius: theme.radius.md,
                  marginVertical: theme.spacing[1],
                  maxWidth: '85%',
                },
                mine
                  ? { alignSelf: 'flex-end', backgroundColor: info.bg, borderColor: info.border, borderWidth: 1 }
                  : {
                      alignSelf: 'flex-start',
                      backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.5)`,
                    },
              ]}
            >
              {!mine && message.senderUsername ? (
                <Text
                  style={[
                    theme.typography.labelSm,
                    {
                      color: `hsl(${theme.colors.brandPrimary})`,
                      fontFamily: theme.fonts.sansBold,
                      marginBottom: theme.spacing[0.5],
                    },
                  ]}
                >
                  {message.senderUsername}
                </Text>
              ) : null}
              <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
                {message.message}
              </Text>
              <View style={[styles.metaRow, { marginTop: theme.spacing[1] }]}>
                <Text style={[theme.typography.labelSm, styles.meta, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
                  {formatChatTime(message.createdAt)}
                </Text>
                {message._pending ? (
                  <Text style={[theme.typography.labelSm, styles.meta, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
                    {' '}
                    · Sending…
                  </Text>
                ) : null}
                {message._failed ? (
                  <Text style={[theme.typography.labelSm, styles.meta, { color: `hsl(${theme.colors.statusError})` }]}>
                    {' '}
                    · Tap to retry
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
        ListHeaderComponent={
          typingUserId && typingUserId !== currentUserId ? (
            <Text
              style={[
                theme.typography.bodySm,
                {
                  color: `hsl(${theme.colors.foregroundSecondary})`,
                  paddingVertical: theme.spacing[1],
                  textAlign: 'center',
                },
              ]}
            >
              Typing…
            </Text>
          ) : null
        }
      />

      <View style={[styles.inputRow, { gap: theme.spacing[2], marginTop: theme.spacing[2] }]}>
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
        <Text
          style={[
            theme.typography.bodySm,
            { color: `hsl(${theme.colors.statusError})`, marginTop: theme.spacing[1.5] },
          ]}
        >
          Failed to send. Try again.
        </Text>
      ) : null}
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  disabledWrap: {},
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  list: { flexGrow: 0, maxHeight: 320 },
  emptyBox: { alignItems: 'center', justifyContent: 'center' },
  dateRow: { alignItems: 'center' },
  systemRow: { alignItems: 'center' },
  bubble: {},
  metaRow: { flexDirection: 'row', flexWrap: 'wrap' },
  meta: {},
  inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
});
