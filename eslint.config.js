import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules', 'test-results', 'reports', 'playwright-report', '.auth'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Fixed waits are the usual cause of a flaky suite; the conventions in
      // the README call for web-first assertions and expect.poll instead.
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='waitForTimeout']",
          message: 'Use a web-first assertion or expect.poll instead of a fixed wait.',
        },
      ],
      // Playwright fixtures that take no dependencies are declared as
      // `async ({}, use, workerInfo) => …`; the empty pattern is required by
      // the fixture signature, not an oversight.
      'no-empty-pattern': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Locators live in the page objects (src/pages, src/components), never in
    // specs. A spec should read as intent; how an element is found is the
    // POM's business, so a markup change is fixed in one place.
    //
    // `no-restricted-syntax` replaces rather than merges, so the fixed-wait
    // rule from above is repeated here.
    files: ['src/tests/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='waitForTimeout']",
          message: 'Use a web-first assertion or expect.poll instead of a fixed wait.',
        },
        {
          selector:
            'CallExpression[callee.property.name=/^(getBy[A-Za-z]+|locator|frameLocator|\\$|\\$\\$)$/]',
          message:
            'Do not create locators in specs. Add a locator or an action to the page object in src/pages or src/components and call that.',
        },
      ],
    },
  },
);
