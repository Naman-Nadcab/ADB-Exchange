/**
 * Hermes / React Native may expose partial Intl APIs without full PluralRules support.
 * Must run before i18next initializes (see initI18n.ts and index.ts).
 */
import 'intl-pluralrules';
