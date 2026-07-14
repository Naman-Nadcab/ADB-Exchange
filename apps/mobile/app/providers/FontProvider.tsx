import { View, StyleSheet } from 'react-native';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import {
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import { ActivityIndicator } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = { children: React.ReactNode };

export function FontProvider({ children }: Props) {
  const { theme } = useTheme();
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  if (!loaded) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: `hsl(${theme.colors.backgroundPrimary})` }]}>
        <ActivityIndicator color={`hsl(${theme.colors.brandPrimary})`} size="large" />
      </View>
    );
  }

  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
});
