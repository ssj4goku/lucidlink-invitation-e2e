import type { Page } from '@playwright/test';
import { env } from '../core/env';
import type { InviteOptions } from '../core/types';
import { MembersPage } from '../pages/members.page';
import { WorkspaceDashboardPage } from '../pages/workspace-dashboard.page';
import { ApiWorkspaceState } from './api-workspace.state';
import { assertSweepBoundary, isSuiteOwned } from './suite-ownership';
import type { WorkspaceState } from './workspace.state';

/**
 * UI implementation of workspace state, driven by the admin's page.
 *
 * Everything it does is visible to a reviewer watching a trace — nothing is
 * arranged behind the app's back.
 */
export class UiWorkspaceState implements WorkspaceState {
  constructor(
    private readonly page: Page,
    private readonly dashboard: WorkspaceDashboardPage,
    private readonly members: MembersPage,
  ) {}

  async invite(email: string, options: InviteOptions = {}): Promise<string> {
    await this.dashboard.goto();
    await this.dashboard.openInviteDialog();
    return this.dashboard.inviteMembersDialog.invite(email, options);
  }

  async ensureNotMember(email: string): Promise<void> {
    const state = await this.members.stateOf(email);

    if (state === 'pending') {
      await this.members.revokeInvite(email);
    } else if (state === 'active') {
      await this.members.removeMember(email);
    }
  }

  freeSeats(): Promise<number> {
    throw new Error('freeSeats() needs the billing API — set WORKSPACE_STATE=api.');
  }

  async cleanup(email: string): Promise<void> {
    await this.ensureNotMember(email);
  }

  async sweep(): Promise<string[]> {
    assertSweepBoundary();
    const pending = (await this.members.emailsOn('pending')).filter(isSuiteOwned);
    for (const email of pending) {
      await this.members.revokeInvite(email);
    }

    const active = (await this.members.emailsOn('active')).filter(isSuiteOwned);
    for (const email of active) {
      await this.members.removeMember(email);
    }

    return [...pending, ...active];
  }
}

/**
 * Factory, so the implementation is chosen here rather than in every fixture.
 * `WORKSPACE_STATE` picks how cleanup runs; inviting stays on the UI either way.
 */
export function makeWorkspaceState(
  page: Page,
  dashboard: WorkspaceDashboardPage,
  members: MembersPage,
): WorkspaceState {
  const ui = new UiWorkspaceState(page, dashboard, members);
  return env.WORKSPACE_STATE === 'ui' ? ui : new ApiWorkspaceState(page, dashboard, ui);
}
