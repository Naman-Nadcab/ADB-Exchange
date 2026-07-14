import { View } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = {
  steps: number;
  currentIndex: number;
};

export function AuthProgressBar({ steps, currentIndex }: Props) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing[2], marginBottom: theme.spacing[6] }}>
      {Array.from({ length: steps }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: theme.radius.full,
            backgroundColor:
              i <= currentIndex
                ? `hsl(${theme.colors.brandPrimary})`
                : `hsl(${theme.colors.surfaceAccent})`,
          }}
        />
      ))}
    </View>
  );
}
