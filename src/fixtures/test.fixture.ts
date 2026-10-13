import { test as base, type BrowserContext, type Page } from '@playwright/test';
import type { Identity } from '../core/types';
import { env } from '../core/env';
import { generatedEmail, pooledIdentity } from '../data/identities';
import { AcceptInvitePage } from '../pages/accept-invite.page';
import type { MembersPage } from '../pages/members.page';
import type { WorkspaceDashboardPage } from '../pages/workspace-dashboard.page';
import { makeWorkspaceState } from '../state/ui-workspace.state';
import type { WorkspaceState } from '../state/workspace.state';
import { newDashboard, newMembers, newWorkspaceState } from './compose';
import { loggedInAdminPage, loggedInContext, loggedInSeatAdminPage } from './contexts';
import { CookieBanner } from '../components/cookie-banner.component';

/**
 * Playwright's fixture system is this suite's dependency injection: lazy
 * construction, teardown ordering and worker scoping are already solved, so no
 * container and no inherited base class is needed.
 *
 * A spec asks for what it needs and pays for nothing else — requesting
 * `inviteePage` starts a second context; requesting only `adminPage` does not.
 */

interface WorkerFixtures {
  /** One registered invitee account per worker, so workers never collide. */
  inviteeIdentity: Identity;
  /**
   * That invitee, logged in once per worker. Restored storage state cannot
   * accept an invite, so a live login is needed; sharing it across the
   * worker's tests keeps that to one login. The admin resets membership
   * between tests, so nothing the invitee holds carries over.
   */
  inviteeContext: BrowserContext;
}

interface TestFixtures {
  adminPage: Page;
  inviteePage: Page;

  dashboard: WorkspaceDashboardPage;
  inviteeDashboard: WorkspaceDashboardPage;
  members: MembersPage;
  acceptInvite: AcceptInvitePage;

  /** Arrange/cleanup for membership, driven as the admin. */
  workspace: WorkspaceState;

  /**
   * A unique address for invite-only tests, cleaned up afterwards whether the
   * test passed or failed. Never logged into, so it needs no account.
   */
  invitee: string;

  /**
   * For tests that need several generated addresses: each call returns a new
   * one, and all of them are cleaned up afterwards, pass or fail.
   */
  newInvitee: () => string;

  /**
   * This worker's registered invitee, guaranteed not to be a member yet and
   * removed again afterwards — the identity accept tests need.
   */
  inviteeAccount: Identity;

  /**
   * The isolated seat-limit workspace, which no other test uses, so filling it
   * starves nobody. Starts empty of suite invites; call `fillLeaving(n)` to
   * leave exactly n seats free.
   */
  seatWorkspace: SeatWorkspace;
}

interface SeatWorkspace {
  dashboard: WorkspaceDashboardPage;
  fillLeaving(freeSeats: number): Promise<void>;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  inviteeIdentity: [
    async ({}, use, workerInfo) => {
      await use(pooledIdentity(workerInfo.parallelIndex));
    },
    { scope: 'worker' },
  ],

  inviteeContext: [
    async ({ browser, inviteeIdentity }, use) => {
      const context = await loggedInContext(browser, inviteeIdentity);
      await use(context);
      await context.close();
    },
    { scope: 'worker' },
  ],

  adminPage: async ({ browser }, use) => {
    const { context, page } = await loggedInAdminPage(browser);
    await use(page);
    await context.close();
  },

  inviteePage: async ({ inviteeContext }, use) => {
    const page = await inviteeContext.newPage();
    await use(page);
    await page.close();
  },

  dashboard: async ({ adminPage }, use) => {
    await use(newDashboard(adminPage));
  },

  inviteeDashboard: async ({ inviteePage }, use) => {
    await use(newDashboard(inviteePage));
  },

  members: async ({ adminPage, dashboard }, use) => {
    await use(newMembers(adminPage, dashboard));
  },

  acceptInvite: async ({ inviteePage, inviteeDashboard }, use) => {
    await use(new AcceptInvitePage(inviteePage, new CookieBanner(inviteePage), inviteeDashboard));
  },

  workspace: async ({ adminPage, dashboard, members }, use) => {
    await use(makeWorkspaceState(adminPage, dashboard, members));
  },

  /**
   * Teardown lives here rather than in an `afterEach` inside a spec, so it also
   * runs when the test fails mid-flow. That is what keeps the workspace usable
   * for the next run — and the 10-seat trial cap makes it mandatory, not tidy.
   */
  invitee: async ({ workspace }, use) => {
    const email = generatedEmail();
    await use(email);
    await workspace.cleanup(email);
  },

  newInvitee: async ({ workspace }, use) => {
    const created: string[] = [];
    await use(() => {
      const email = generatedEmail();
      created.push(email);
      return email;
    });
    for (const email of created) {
      await workspace.cleanup(email);
    }
  },

  /**
   * Arranged before and cleaned after: a pooled account may still be a member
   * from an earlier run, and accepting twice is not a thing you can do.
   */
  inviteeAccount: async ({ workspace, inviteeIdentity }, use) => {
    await workspace.ensureNotMember(inviteeIdentity.email);
    await use(inviteeIdentity);
    await workspace.cleanup(inviteeIdentity.email);
  },

  /**
   * Arranged from whatever state an aborted run left: swept first, and swept
   * again afterwards, pass or fail. The test chooses how full it should be.
   */
  seatWorkspace: async ({ browser }, use) => {
    const { context, page } = await loggedInSeatAdminPage(browser);
    const dashboard = newDashboard(page, env.SEAT_WORKSPACE);
    const state = newWorkspaceState(page, env.SEAT_WORKSPACE);

    try {
      await state.sweep();

      await use({
        dashboard,
        async fillLeaving(freeSeats) {
          const toInvite = (await state.freeSeats()) - freeSeats;
          if (toInvite < 0) {
            throw new Error(`The seat workspace already has fewer than ${freeSeats} free seats.`);
          }
          if (toInvite > 0) {
            await dashboard.goto();
            await dashboard.openInviteDialog();
            const emails = Array.from({ length: toInvite }, () => generatedEmail('fill'));
            await dashboard.inviteMembersDialog.addEmails(emails);
            await dashboard.inviteMembersDialog.generate();
          }
          const free = await state.freeSeats();
          if (free !== freeSeats) {
            throw new Error(`Expected ${freeSeats} free seats after filling, found ${free}.`);
          }
        },
      });
    } finally {
      await state.sweep();
      await context.close();
    }
  },
});

export { expect } from '@playwright/test';
