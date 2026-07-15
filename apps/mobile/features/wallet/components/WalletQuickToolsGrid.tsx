import { View, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { WalletQuickToolLink } from './WalletQuickToolLink';

type Tool = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  iconBg?: string;
  iconColor?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

type Props = {
  tools: Tool[];
};

export function WalletQuickToolsGrid({ tools }: Props) {
  const { theme } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {tools.map((tool) => (
          <View key={tool.id} style={styles.cell}>
            <WalletQuickToolLink
              title={tool.loading ? `${tool.title}…` : tool.title}
              subtitle={tool.subtitle}
              icon={tool.icon}
              iconBg={tool.iconBg ?? `hsl(${theme.colors.brandPrimary} / 0.1)`}
              iconColor={tool.iconColor ?? `hsl(${theme.colors.brandPrimary})`}
              onPress={tool.onPress}
              disabled={tool.disabled || tool.loading}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexGrow: 1, flexBasis: '47%' },
});
