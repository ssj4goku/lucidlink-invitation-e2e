import type { Locator, Page } from '@playwright/test';

export class ConfirmDialog {
  private readonly root: Locator;
  private readonly title: Locator;
  private readonly accept: Locator;
  private readonly dismiss: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByRole('dialog');
    this.title = this.root.getByTestId('modal-title');
    this.accept = this.root.getByRole('button', { name: /^yes/i });
    this.dismiss = this.root.getByRole('button', { name: /^cancel$/i });
  }

  async waitForConfirmation(title: string, subject?: string): Promise<void> {
    await this.titleContaining(title).waitFor();
    if (subject) {
      await this.bodyNaming(subject).waitFor();
    }
  }

  private titleContaining(text: string): Locator {
    return this.title.filter({ hasText: text });
  }

  private bodyNaming(text: string): Locator {
    return this.root.getByText(text).first();
  }

  async confirm(): Promise<void> {
    await this.accept.click();
    await this.accept.waitFor({ state: 'hidden' });
  }

  async cancel(): Promise<void> {
    await this.dismiss.click();
    await this.dismiss.waitFor({ state: 'hidden' });
  }
}
