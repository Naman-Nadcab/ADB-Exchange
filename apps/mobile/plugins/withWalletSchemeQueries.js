const { withAndroidManifest } = require('@expo/config-plugins');

/** Public wallet URL schemes used only so Android can answer canOpenURL. */
const WALLET_QUERY_SCHEMES = ['metamask', 'trust', 'cbwallet', 'phantom'];

const withWalletSchemeQueries = (config) =>
  withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const existing = manifest.queries ?? [];
    const additions = WALLET_QUERY_SCHEMES.filter(
      (scheme) =>
        !existing.some((query) =>
          query.intent?.some((intent) => intent.data?.some((data) => data.$['android:scheme'] === scheme)),
        ),
    ).map((scheme) => ({
      intent: [
        {
          action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
          data: [{ $: { 'android:scheme': scheme } }],
        },
      ],
    }));
    manifest.queries = [...existing, ...additions];
    return mod;
  });

module.exports = withWalletSchemeQueries;
