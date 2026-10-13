import { expect, type Locator, type Page } from '@playwright/test';
import { CookieBanner } from '../components/cookie-banner.component';
import { env } from '../core/env';
import { routes } from '../core/routes';
import type { Identity } from '../core/types';

export class LoginPage {
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly continueButton: Locator;
  private readonly submitButton: Locator;
  private readonly emailError: Locator;

  constructor(
    private readonly page: Page,
    private readonly cookieBanner: CookieBanner,
  ) {
    this.emailInput = page.getByTestId('text-input-input-email');
    this.continueButton = page.getByTestId('button-continue');
    this.emailError = page.getByTestId('field-validation-email');
    this.passwordInput = page.getByTestId('password-input-input-password');
    this.submitButton = page.getByTestId('button-login');
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.login);
    await this.cookieBanner.dismissIfPresent();
  }

  async typeEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  async submitEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.continueButton.click();
  }

  async submitPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async login({ email, password }: Identity): Promise<void> {
    await this.goto();
    await this.submitEmail(email);
    await this.submitPassword(password);
    await this.page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
    await this.cookieBanner.dismissIfPresent(2_000);
  }

  async loginAsAdmin(): Promise<void> {
    await this.login({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD });
  }

  async expectInvalidEmailBlocksProgress(): Promise<void> {
    await expect(this.emailError).toContainText(/valid email/i);
    await expect(this.continueButton).toBeDisabled();
    await expect(this.passwordInput).toBeHidden();
  }
}
