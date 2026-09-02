import './setupIntlPolyfills';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: { app_name: 'FDM' } } },
});

export { i18n };
