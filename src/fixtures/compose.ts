import type { Page } from '@playwright/test';
import { ConfirmDialog } from '../components/confirm-dialog.component';
import { CookieBanner } from '../components/cookie-banner.component';
import { DataTable } from '../components/data-table.component';
import { PlanLimitDialog } from '../components/plan-limit-dialog.component';
import type { WorkspaceTarget } from '../core/types';
import { InviteMembersDialog } from '../pages/invite-members.dialog';
import { LoginPage } from '../pages/login.page';
import { MembersPage } from '../pages/members.page';
import { WorkspaceDashboardPage } from '../pages/workspace-dashboard.page';
import { makeWorkspaceState } from '../state/ui-workspace.state';
import type { WorkspaceState } from '../state/workspace.state';

/**
 * The composition root: the only place that wires page objects to their
 * collaborators. Everything else receives them through its constructor, so
 * fixtures and setup projects share one assembly instead of repeating it.
 */

export function newLogin(page: Page): LoginPage {
  return new LoginPage(page, new CookieBanner(page));
}

export function newDashboard(page: Page, workspace?: WorkspaceTarget): WorkspaceDashboardPage {
  return new WorkspaceDashboardPage(
    page,
    new CookieBanner(page),
    new InviteMembersDialog(page),
    new PlanLimitDialog(page),
    workspace,
  );
}

export function newMembers(page: Page, dashboard: WorkspaceDashboardPage): MembersPage {
  return new MembersPage(
    page,
    dashboard,
    new DataTable(page, MembersPage.TABLE_NAME),
    new ConfirmDialog(page),
  );
}

/** For callers outside the fixture system, e.g. setup projects. */
export function newWorkspaceState(page: Page, workspace?: WorkspaceTarget): WorkspaceState {
  const dashboard = newDashboard(page, workspace);
  return makeWorkspaceState(page, dashboard, newMembers(page, dashboard));
}
