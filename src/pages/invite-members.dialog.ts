import { expect, type Locator, type Page } from '@playwright/test';
import { waitForCopiedValue } from '../core/clipboard';
import { INVITE_LINK_PATTERN } from '../core/routes';
import type { InviteOptions } from '../core/types';

export class InviteMembersDialog {
  private readonly page: Page;

  private readonly form: Locator;
  private readonly individualRadio: Locator;
  private readonly individualOption: Locator;
  private readonly organizationRadio: Locator;
  private readonly emailInput: Locator;
  private readonly groupsInput: Locator;
  private readonly generateButton: Locator;
  private readonly closeButton: Locator;

  private readonly seatLimitRule: Locator;
  private readonly validEmailRule: Locator;

  private readonly requiredError: Locator;

  private readonly successImage: Locator;
  private readonly copyLinkButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.form = page.getByTestId('form-invite-members');
    this.individualRadio = page.getByTestId('radio-input-input-type-individual');
    this.individualOption = this.form.getByText('Specific people');
    this.organizationRadio = page.getByTestId('radio-input-input-type-organization');
    this.emailInput = page.getByTestId('tag-input-input-emailFilters');
    this.groupsInput = page.getByTestId('combobox-input-groups');
    this.generateButton = page.getByTestId('button-create-invite');
    this.closeButton = page.getByTestId('icon-button-modal-close');

    this.seatLimitRule = page.getByTestId('validation-rule-emailFilters-0');
    this.validEmailRule = page.getByTestId('validation-rule-emailFilters-1');

    this.requiredError = this.form.getByTestId('field-error-client-error');

    this.successImage = page.getByTestId('image-invite-success');
    this.copyLinkButton = page.getByTestId('button-success');
  }

  private tag(email: string): Locator {
    return this.page.getByTestId(`tag-${email}`);
  }

  private removeTagButton(email: string): Locator {
    return this.page.getByTestId(`tag-button-${email}`);
  }

  private tagTooltip(email: string, text: string): Locator {
    return this.tag(email).getByText(text);
  }

  private seatLimitTooltip(email: string): Locator {
    return this.tagTooltip(email, 'Your current plan includes up to 10 members');
  }

  private groupOption(group: string): Locator {
    return this.page.getByRole('option', { name: group });
  }

  async waitUntilOpen(): Promise<void> {
    await this.form.waitFor();
  }

  async touchAndLeaveEmailEmpty(): Promise<void> {
    await this.emailInput.click();
    await this.individualOption.click();
  }

  async typeEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  async commitTypedEmail(email: string): Promise<void> {
    await this.emailInput.press('Enter');
    await this.tag(email).waitFor();
  }

  async addEmail(email: string): Promise<void> {
    await this.typeEmail(email);
    await this.commitTypedEmail(email);
  }

  async addEmails(emails: string[]): Promise<void> {
    for (const email of emails) {
      await this.addEmail(email);
    }
  }

  async removeEmail(email: string): Promise<void> {
    await this.removeTagButton(email).click();
  }

  async hoverEmail(email: string): Promise<void> {
    await this.tag(email).hover();
  }

  async selectGroup(group: string): Promise<void> {
    await this.groupsInput.click();
    await this.groupOption(group).click();
    await this.groupsInput.press('Escape');
  }

  async submit(): Promise<void> {
    await this.generateButton.click();
  }

  async generate(): Promise<void> {
    await this.submit();
    await this.copyLinkButton.waitFor();
  }

  async copyInviteLink(): Promise<string> {
    await this.copyLinkButton.click();

    return waitForCopiedValue(
      this.page,
      INVITE_LINK_PATTERN,
      'the app did not copy a usable invite link (expected /i?invitationId=…#secret)',
    );
  }

  async invite(email: string, options: InviteOptions = {}): Promise<string> {
    await this.waitUntilOpen();
    await this.addEmail(email);
    for (const group of options.groups ?? []) {
      await this.selectGroup(group);
    }
    await this.generate();
    return this.copyInviteLink();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
    await this.form.waitFor({ state: 'hidden' });
  }

  async expectOpen(): Promise<void> {
    await expect(this.form).toBeVisible();
    await expect(this.individualRadio).toBeChecked();
  }

  async expectClosed(): Promise<void> {
    await expect(this.form).toBeHidden();
  }

  async expectOrganizationInviteDisabled(): Promise<void> {
    await expect(this.organizationRadio).toBeDisabled();
  }

  async expectOrganizationInviteGatedByPlan(): Promise<void> {
    await this.expectOrganizationInviteDisabled();
    await expect(this.form).toContainText('Business and Enterprise plans');
  }

  async expectGenerateEnabled(): Promise<void> {
    await expect(this.generateButton).toBeEnabled();
  }

  async expectGenerateDisabled(): Promise<void> {
    await expect(this.generateButton).toBeDisabled();
  }

  async expectTagShown(email: string): Promise<void> {
    await expect(this.tag(email)).toBeVisible();
  }

  async expectTagHidden(email: string): Promise<void> {
    await expect(this.tag(email)).toBeHidden();
  }

  async expectTagInvalid(email: string): Promise<void> {
    await expect(this.tag(email)).toHaveAttribute('data-error', 'true');
  }

  async expectTagRejected(email: string, reason: string): Promise<void> {
    await this.expectTagInvalid(email);
    await this.hoverEmail(email);
    await expect(this.tagTooltip(email, reason)).toBeVisible();
  }

  async expectSeatLimitTooltip(email: string): Promise<void> {
    await expect(this.seatLimitTooltip(email)).toBeVisible();
  }

  async expectInviteCreated(): Promise<void> {
    await expect(this.successImage).toBeVisible();
    await expect(this.copyLinkButton).toBeVisible();
  }

  async expectNoInviteCreated(): Promise<void> {
    await expect(this.copyLinkButton).toBeHidden();
  }

  async expectRequiredErrorHidden(): Promise<void> {
    await expect(this.requiredError).toHaveAttribute('aria-hidden', 'true');
  }

  async expectRequiredErrorShown(): Promise<void> {
    await expect(this.requiredError).not.toHaveAttribute('aria-hidden', 'true');
    await expect(this.requiredError).toContainText('Provide at least one email address');
  }

  async expectValidEmailRuleUnsatisfied(): Promise<void> {
    await expect(this.validEmailRule).toContainText('Provide valid email addresses');
    await this.expectRuleUnsatisfied(this.validEmailRule);
  }

  async expectSeatLimitRuleSatisfied(): Promise<void> {
    await this.expectRuleSatisfied(this.seatLimitRule);
  }

  private async expectRuleSatisfied(rule: Locator): Promise<void> {
    await expect(rule).toHaveAttribute('data-test-state', 'correct');
  }

  private async expectRuleUnsatisfied(rule: Locator): Promise<void> {
    await expect(rule).toHaveAttribute('data-test-state', 'incorrect');
  }
}
