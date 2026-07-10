import { useEffect } from 'react';
import { ScrollView, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import type { AccountStackParamList } from '../navigation/types';

const DOCS: Record<string, string> = {
  terms: 'Terms of Service — see https://metheorium.com/terms',
  privacy: 'Privacy Policy — see https://metheorium.com/privacy',
  licenses: 'Open source licenses bundled with the app.',
};

type Props = NativeStackScreenProps<AccountStackParamList, 'LegalViewer'>;

export function LegalViewerScreen({ route }: Props) {
  useEffect(() => {
    analytics.screen('S-124');
  }, []);

  return (
    <ScreenLayout testID="S-124">
      <ScrollView>
        <Text>{DOCS[route.params.doc] ?? 'Document not found'}</Text>
      </ScrollView>
    </ScreenLayout>
  );
}
