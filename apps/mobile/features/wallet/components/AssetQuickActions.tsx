import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hapticLight } from '@shared/theme';

type Action = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  primary?: boolean;
  onPress: () => void;
};

type Props = {
  actions: Action[];
};

export function AssetQuickActions({ actions }: Props) {
  const { theme } = useTheme();

  return (
    <View style={styles.wrap}>
      {actions.map((action) => (
        <Pressable
          key={action.id}
          onPress={() => {
            void hapticLight();
            action.onPress();
          }}
          style={[
            styles.btn,
            action.primary
              ? { backgroundColor: `hsl(${theme.colors.brandPrimary})` }
              : {
                  backgroundColor: `hsl(${theme.colors.surfaceMuted})`,
                  borderColor: `hsl(${theme.colors.borderDefault})`,
                  borderWidth: 1,
                },
          ]}
        >
          <Ionicons
            name={action.icon}
            size={16}
            color={
              action.primary
                ? `hsl(${theme.colors.brandPrimaryForeground})`
                : `hsl(${theme.colors.foregroundPrimary})`
            }
          />
          <Text
            style={{
              color: action.primary
                ? `hsl(${theme.colors.brandPrimaryForeground})`
                : `hsl(${theme.colors.foregroundPrimary})`,
              fontWeight: '700',
              fontSize: 11,
            }}
          >
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  btn: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
});
