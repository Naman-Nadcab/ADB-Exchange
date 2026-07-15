import { useMemo, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { sanitizeAnnouncementHtml } from '@core/domain/announcements/announcements';

type Props = {
  html: string;
};

export function AnnouncementHtmlBody({ html }: Props) {
  const { width } = useWindowDimensions();
  const [height, setHeight] = useState(120);

  const source = useMemo(() => {
    const body = sanitizeAnnouncementHtml(html);
    return {
      html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 15px; line-height: 1.55; color: rgba(255,255,255,0.82); margin: 0; padding: 0; background: transparent; }
        p { margin: 0 0 12px; }
        a { color: #60a5fa; }
        ul, ol { padding-left: 20px; margin: 0 0 12px; }
      </style></head><body>${body}</body></html>`,
    };
  }, [html]);

  return (
    <View style={[styles.wrap, { width: width - 48, minHeight: height }]}>
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
