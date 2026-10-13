import type { Locator, Page } from '@playwright/test';

export class CookieBanner {
  private readonly page: Page;
  private readonly banner: Locator;
  private readonly rejectAll: Locator;
  private readonly acceptAll: Locator;

  constructor(page: Page) {
    this.page = page;
    this.banner = page.locator('#onetrust-banner-sdk');
    this.rejectAll = page.locator('#onetrust-reject-all-handler');
    this.acceptAll = page.locator('#onetrust-accept-btn-handler');
  }

  async dismissIfPresent(timeout = 5_000): Promise<void> {
    try {
      await this.banner.waitFor({ state: 'visible', timeout });
    } catch {
      return;
    }

    const control = (await this.rejectAll.isVisible()) ? this.rejectAll : this.acceptAll;
    if (await control.isVisible()) {
      await control.click();
      await this.banner.waitFor({ state: 'hidden' });
    }
  }
}
