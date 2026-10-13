import { expect, type Locator, type Page } from '@playwright/test';
import { CookieBanner } from '../components/cookie-banner.component';
import { env } from '../core/env';
import { WorkspaceDashboardPage } from './workspace-dashboard.page';

export class AcceptInvitePage {
  private readonly acceptButton: Locator;
  private readonly dismissButton: Locator;
  private readonly invalidLinkTitle: Locator;
  private readonly notValidForAccountMessage: Locator;
  private readonly logInWithAnotherAccount: Locator;
  private readonly dismissAndContinue: Locator;

  constructor(
    private readonly page: Page,
    private readonly cookieBanner: CookieBanner,
    private readonly dashboard: WorkspaceDashboardPage,
  ) {
    this.acceptButton = page.getByRole('button', { name: /accept invite/i });
    this.dismissButton = page.getByRole('button', { name: /dismiss/i });
    this.invalidLinkTitle = page.getByText(/invalid invitation link/i);
    this.notValidForAccountMessage = page.getByText(/not valid for your account/i);
    this.logInWithAnotherAccount = page.getByRole('button', {
      name: /log in with another account/i,
    });
    this.dismissAndContinue = page.getByRole('button', {
      name: /dismiss and continue with current account/i,
    });
  }

  private workspaceNameText(workspaceName: string): Locator {
    return this.page.getByText(workspaceName).first();
  }

  private signedInEmailText(signedInEmail: string): Locator {
    return this.page.getByText(signedInEmail);
  }

  async open(inviteLink: string): Promise<void> {
    await this.page.goto(inviteLink);
    await this.cookieBanner.dismissIfPresent(2_000);
  }

  async expectInviteFor(workspaceName = env.WORKSPACE_NAME): Promise<void> {
    await expect(this.workspaceNameText(workspaceName)).toBeVisible();
    await expect(this.acceptButton).toBeVisible();
  }

  async accept(): Promise<WorkspaceDashboardPage> {
    await this.acceptButton.click();
    await this.page.waitForURL(/\/workspaces\//);
    return this.dashboard;
  }

  async dismiss(): Promise<void> {
    await this.dismissButton.click();
    await this.dismissButton.waitFor({ state: 'hidden' });
  }

  async expectInvalidForCurrentAccount(signedInEmail: string): Promise<void> {
    await expect(this.invalidLinkTitle).toBeVisible();
    await expect(this.notValidForAccountMessage).toBeVisible();
    await expect(this.signedInEmailText(signedInEmail)).toBeVisible();
    await expect(this.logInWithAnotherAccount).toBeVisible();
    await expect(this.dismissAndContinue).toBeVisible();
    await expect(this.acceptButton).toBeHidden();
  }

  async expectAcceptable(): Promise<void> {
    await expect(this.acceptButton).toBeVisible();
  }

  async expectNotAcceptable(): Promise<void> {
    await expect(this.acceptButton).toBeHidden();
  }
}
