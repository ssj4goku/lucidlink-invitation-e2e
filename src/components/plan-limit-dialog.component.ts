import { expect, type Locator, type Page } from '@playwright/test';

export class PlanLimitDialog {
  private readonly heading: Locator;
  private readonly root: Locator;
  private readonly cancelButton: Locator;
  private readonly upgradeLink: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: 'Plan limit reached' });
    this.root = page.getByRole('dialog').filter({ has: this.heading });
    this.cancelButton = this.root.getByRole('button', { name: 'Cancel' });
    this.upgradeLink = this.root.getByRole('link', { name: 'Upgrade plan' });
  }

  async expectShown(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.cancelButton).toBeVisible();
    await expect(this.upgradeLink).toBeVisible();
  }
}
