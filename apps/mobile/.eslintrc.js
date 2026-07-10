module.exports = {
  root: true,
  extends: ['expo', 'prettier'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import'],
  rules: {
    'import/no-cycle': 'error',
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@features/*/*'],
            message: 'Import from feature index or use navigation/events for cross-feature access.',
          },
        ],
      },
    ],
  },
  ignorePatterns: ['node_modules/', 'dist/'],
};
