import { useState, useRef } from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { TextField, PrimaryButton } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { P2PMessage } from '@exchange/mobile-types';

type Props = {
  messages: P2PMessage[];
  typingUserId?: string | null;
  currentUserId?: string;
  onSend: (text: string) => void;
  onTyping?: () => void;
  sending?: boolean;
};

export function P2PChatPanel({ messages, typingUserId, currentUserId, onSend, onTyping, sending }: Props) {
  const { theme } = useTheme();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <View style={styles.wrap}>
      <FlatList<P2PMessage>
        ref={listRef}
        data={messages}
        keyExtractor={(m: P2PMessage) => m.id}
        inverted
        initialNumToRender={20}
        maxToRenderPerBatch={15}
        windowSize={7}
        onContentSizeChange={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
        renderItem={({ item }) => {
          const mine = item.senderId === currentUserId || item.senderId === 'self';
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})` }}>{item.message}</Text>
              {item._pending ? <Text style={styles.meta}>Sending…</Text> : null}
              {item._failed ? <Text style={[styles.meta, { color: `hsl(${theme.colors.statusError})` }]}>Failed — tap resend</Text> : null}
            </View>
          );
        }}
        ListHeaderComponent={
          typingUserId && typingUserId !== currentUserId ? (
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>Typing…</Text>
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
        />
        <PrimaryButton title="Send" loading={sending} onPress={submit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 200 },
  bubble: { padding: 10, borderRadius: 8, marginVertical: 4, maxWidth: '85%' },
  mine: { alignSelf: 'flex-end', backgroundColor: 'rgba(59,130,246,0.15)' },
  theirs: { alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.06)' },
  meta: { fontSize: 10, marginTop: 2 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 8 },
});
