import { expect, type Locator, type Page } from '@playwright/test';
import type { ConfirmDialog } from '../components/confirm-dialog.component';
import { DataTable } from '../components/data-table.component';
import { waitForCopiedValue } from '../core/clipboard';
import { INVITE_LINK_PATTERN } from '../core/routes';
import type { MemberState, MembersTab } from '../core/types';
import { WorkspaceDashboardPage } from './workspace-dashboard.page';

const REVOKE_TITLE = 'revoke this invite';
const REMOVE_TITLE = 'remove this member';

export class MembersPage {
  static readonly TABLE_NAME = 'members';

  private readonly activeTab: Locator;
  private readonly pendingTab: Locator;
  private readonly deactivatedTab: Locator;
  private readonly emptyState: Locator;
  private readonly revokeMenuItem: Locator;
  private readonly copyLinkMenuItem: Locator;
  private readonly removeMenuItem: Locator;
  private readonly tabContent: Locator;

  constructor(
    private readonly page: Page,
    private readonly dashboard: WorkspaceDashboardPage,
    private readonly table: DataTable,
    private readonly confirmDialog: ConfirmDialog,
  ) {
    this.activeTab = page.getByTestId('tab-active');
    this.pendingTab = page.getByTestId('tab-pending');
    this.deactivatedTab = page.getByTestId('tab-deactivated');
    this.emptyState = page.locator('[data-testid^="image-empty-"]');
    this.revokeMenuItem = page.getByTestId('menu-item-revoke-invitation');
    this.copyLinkMenuItem = page.getByTestId('menu-item-copy-invitation-link');
    this.removeMenuItem = page
      .getByTestId('menu-item-remove-member')
      .or(page.getByRole('menuitem', { name: /remove/i }))
      .first();
    this.tabContent = this.table.root.or(this.emptyState).first();
  }

  async goto(tab: MembersTab = 'active'): Promise<void> {
    await this.dashboard.goto();
    await this.dashboard.openMembers();

    if (tab !== 'active') {
      await this.tab(tab).click();
    }

    await this.selectedTab(tab).waitFor();
    await this.tabContent.waitFor();
  }

  private selectedTab(tab: MembersTab): Locator {
    return this.tab(tab).and(this.page.locator('[aria-selected="true"]'));
  }

  private tab(tab: MembersTab): Locator {
    if (tab === 'pending') return this.pendingTab;
    if (tab === 'deactivated') return this.deactivatedTab;
    return this.activeTab;
  }

  private row(email: string): Locator {
    return this.table.row(email);
  }

  private roleCell(email: string): Locator {
    return this.table.cell(email, 'role');
  }

  private groupsCell(email: string): Locator {
    return this.table.cell(email, 'groups');
  }

  private joinedOnCell(email: string): Locator {
    return this.table.cell(email, 'joinedOn');
  }

  private rowMenuTrigger(email: string): Locator {
    return this.page.getByTestId(`icon-button-member-menu-trigger-${email}`);
  }

  async stateOf(email: string): Promise<MemberState> {
    await this.goto('pending');
    if (await this.row(email).isVisible()) return 'pending';

    await this.goto('active');
    if (await this.row(email).isVisible()) return 'active';

    return 'absent';
  }

  async expectState(email: string, state: MemberState, timeout = 30_000): Promise<void> {
    await this.page.reload();
    await expect
      .poll(() => this.stateOf(email), {
        timeout,
        message: `${email} never reached state "${state}"`,
      })
      .toBe(state);
  }

  async expectListed(email: string): Promise<void> {
    await expect(this.row(email)).toBeVisible();
  }

  async expectNotListed(email: string): Promise<void> {
    await expect(this.row(email)).toBeHidden();
  }

  async expectPendingRow(email: string): Promise<void> {
    await this.expectListed(email);
    await expect(this.joinedOnCell(email)).toContainText('Pending');
  }

  async expectJoined(email: string): Promise<void> {
    await expect(this.joinedOnCell(email)).not.toContainText('Pending');
  }

  async expectRole(email: string, role: string): Promise<void> {
    await expect(this.roleCell(email)).toContainText(role);
  }

  async expectGroups(email: string, groups: string[]): Promise<void> {
    for (const group of groups) {
      await expect(this.groupsCell(email)).toContainText(group);
    }
  }

  async openRowMenu(email: string): Promise<void> {
    await this.rowMenuTrigger(email).click();
  }

  async copyInviteLink(email: string): Promise<string> {
    await this.goto('pending');
    await this.openRowMenu(email);
    await this.copyLinkMenuItem.click();

    return waitForCopiedValue(
      this.page,
      INVITE_LINK_PATTERN,
      `no usable invite link was copied for ${email}`,
    );
  }

  async revokeInvite(email: string): Promise<void> {
    await this.goto('pending');
    await this.openRowMenu(email);
    await this.revokeMenuItem.click();

    await this.confirmDialog.waitForConfirmation(REVOKE_TITLE, email);
    await this.confirmDialog.confirm();

    await this.row(email).waitFor({ state: 'hidden' });
  }

  async cancelRevokeInvite(email: string): Promise<void> {
    await this.goto('pending');
    await this.openRowMenu(email);
    await this.revokeMenuItem.click();

    await this.confirmDialog.waitForConfirmation(REVOKE_TITLE);
    await this.confirmDialog.cancel();
  }

  async removeMember(email: string): Promise<void> {
    await this.goto('active');
    await this.openRowMenu(email);
    await this.removeMenuItem.click();

    await this.confirmDialog.waitForConfirmation(REMOVE_TITLE);
    await this.confirmDialog.confirm();

    await this.row(email).waitFor({ state: 'hidden' });
  }

  async emailsOn(tab: MembersTab): Promise<string[]> {
    await this.goto(tab);
    return this.table.keys();
  }
}
