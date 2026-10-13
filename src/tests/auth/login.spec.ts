import { test } from '@playwright/test';
import { newDashboard, newLogin } from '../../fixtures/compose';

test.describe('Login', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('admin can log in through the UI', { tag: '@regression' }, async ({ page }) => {
    const login = newLogin(page);
    await login.loginAsAdmin();

    const dashboard = newDashboard(page);
    await dashboard.goto();
    await dashboard.expectAdminDashboard();
  });

  test(
    'login is email-first and validates the address',
    { tag: '@regression' },
    async ({ page }) => {
      const login = newLogin(page);
      await login.goto();

      await login.typeEmail('not-an-email');

      await login.expectInvalidEmailBlocksProgress();
    },
  );
});
