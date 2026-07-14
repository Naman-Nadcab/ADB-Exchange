import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import {
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import { View, ActivityIndicator } from 'react-native';
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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: `hsl(${theme.colors.backgroundPrimary})` }}>
        <ActivityIndicator color={`hsl(${theme.colors.brandPrimary})`} />
      </View>
    );
  }

  return children;
}
