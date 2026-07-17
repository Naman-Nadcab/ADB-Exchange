import { useMemo, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '@shared/theme';
import { sanitizeAnnouncementHtml } from '@core/domain/announcements/announcements';

type Props = {
  html: string;
};

export function AnnouncementHtmlBody({ html }: Props) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const [height, setHeight] = useState(120);
  const { marketing: m } = theme;

  const source = useMemo(() => {
    const body = sanitizeAnnouncementHtml(html);
    return {
      html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: ${theme.typography.bodyLg.fontSize}px; line-height: 1.55; color: ${m.mutedText}; margin: 0; padding: 0; background: transparent; }
        p { margin: 0 0 ${theme.spacing[3]}px; }
        a { color: ${m.goldLight}; }
        ul, ol { padding-left: ${theme.spacing[5]}px; margin: 0 0 ${theme.spacing[3]}px; }
        strong { color: ${m.subtleText}; }
      </style></head><body>${body}</body></html>`,
    };
  }, [html, theme, m.goldLight, m.mutedText, m.subtleText]);

  return (
    <View
      style={[
        styles.wrap,
        { width: width - theme.spacing.pageX * 2, minHeight: theme.spacing[12] + theme.spacing[12] + theme.spacing[6] },
      ]}
    >
      <WebView
        originWhitelist={['*']}
        source={source}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: 'transparent', height }}
        onMessage={(event) => {
          const next = Number(event.nativeEvent.data);
          if (Number.isFinite(next) && next > 0) setHeight(next);
        }}
        injectedJavaScript={`
          (function () {
            function postHeight() {
              var height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
              window.ReactNativeWebView.postMessage(String(height));
            }
            postHeight();
            window.addEventListener('load', postHeight);
          })();
          true;
        `}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
});
