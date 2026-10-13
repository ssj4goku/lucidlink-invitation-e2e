import { expect, type Locator, type Page } from '@playwright/test';
import { CookieBanner } from '../components/cookie-banner.component';
import type { PlanLimitDialog } from '../components/plan-limit-dialog.component';
import { env } from '../core/env';
import { routes } from '../core/routes';
import type { WorkspaceTarget } from '../core/types';
import { InviteMembersDialog } from './invite-members.dialog';

export class WorkspaceDashboardPage {
  private readonly inviteMembersButton: Locator;
  private readonly workspaceMenuTrigger: Locator;
  private readonly membersMenuItem: Locator;
  private readonly noFilespacesNotice: Locator;
  private readonly accessPendingNotice: Locator;
  private readonly pendingMemberBadge: Locator;
  private readonly welcomeToast: Locator;
  private readonly workspaceName: Locator;
  private readonly heading: Locator;

  constructor(
    private readonly page: Page,
    private readonly cookieBanner: CookieBanner,
    readonly inviteMembersDialog: InviteMembersDialog,
    readonly planLimitDialog: PlanLimitDialog,
    readonly workspace: WorkspaceTarget = env.PRIMARY_WORKSPACE,
  ) {
    this.inviteMembersButton = page.getByTestId('button-invite-members-header');
    this.workspaceMenuTrigger = page
      .getByTestId(`icon-button-workspace-menu-trigger-${workspace.name}-sidebar`)
      .or(page.getByRole('button', { name: /workspace menu toggle/i }))
      .first();
    this.membersMenuItem = page.getByRole('menuitem', { name: /members/i });
    this.noFilespacesNotice = page.getByTestId('text-no-filespaces');
    this.accessPendingNotice = page.getByText('Access pending');
    this.pendingMemberBadge = page.getByTestId('label-pending-member');
    this.welcomeToast = page
      .getByRole('status')
      .filter({ hasText: /welcome to .* workspace/i })
      .first();
    this.workspaceName = page.getByTestId('sidebar-workspace-name');
    this.heading = page.getByTestId('page-heading');
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.workspaceDashboard(this.workspace.id));
    await this.cookieBanner.dismissIfPresent(2_000);
    await this.heading.waitFor();
  }

  async expectOnboardingComplete(): Promise<void> {
    await expect(this.welcomeToast).toBeVisible();
    await expect(this.pendingMemberBadge).toBeHidden();
  }

  async expectAdminDashboard(): Promise<void> {
    await expect(this.inviteMembersButton).toBeVisible();
    await expect(this.workspaceName).toContainText(this.workspace.name);
  }

  async expectAccessPending(): Promise<void> {
    await expect(this.accessPendingNotice).toBeVisible();
    await expect(this.pendingMemberBadge).toBeVisible();
    await expect(this.inviteMembersButton).toBeHidden();
  }

  async expectJoinedAsStandardMember(): Promise<void> {
    await expect(this.page).toHaveURL(routes.workspaceDashboard(this.workspace.id));
    await expect(this.workspaceName).toContainText(this.workspace.name);
    await expect(this.noFilespacesNotice).toBeVisible();
    await expect(this.inviteMembersButton).toBeHidden();
  }

  async clickInviteMembers(): Promise<void> {
    await this.inviteMembersButton.click();
  }

  async openInviteDialog(): Promise<void> {
    await this.clickInviteMembers();
    await this.inviteMembersDialog.waitUntilOpen();
  }

  async openMembers(): Promise<void> {
    await this.workspaceMenuTrigger.waitFor();
    await this.workspaceMenuTrigger.click();

    await this.membersMenuItem.waitFor();
    await this.membersMenuItem.click();
    await this.page.waitForURL(/\/settings\/members/);
  }

  async invite(email: string): Promise<void> {
    await this.goto();
    await this.openInviteDialog();
    await this.inviteMembersDialog.invite(email);
  }
}
