import { expect, type APIResponse, type Page } from '@playwright/test';
import { env } from '../core/env';
import type { InviteOptions } from '../core/types';
import type { WorkspaceDashboardPage } from '../pages/workspace-dashboard.page';
import { assertSweepBoundary, isSuiteOwned } from './suite-ownership';
import type { UiWorkspaceState } from './ui-workspace.state';
import type { WorkspaceState } from './workspace.state';
import { forgetWorkspaceToken, latestWorkspaceToken } from './workspace-token';

/**
 * The workspace holds at most 10 seats (pending invites included), so a sweep
 * that finds more suite-owned rows than that means the filter is wrong.
 * The UI sweep was slow enough to be self-limiting; this one is not.
 */
const MAX_SWEEP = 10;

interface Member {
  /** Member id — what DELETE takes, not the user id. */
  id: string;
  status: string;
  user: { email: string };
}

/**
 * Cleanup through the same `api/v2` calls the Members page makes, using the
 * admin's own session: log in through the UI, take the bearer token off the
 * workspace requests the app makes (see `workspace-token.ts`), call the API
 * with it.
 *
 * `invite()` stays on the UI — the invite link's secret is generated
 * client-side and only exists in the browser.
 */
export class ApiWorkspaceState implements WorkspaceState {
  constructor(
    private readonly page: Page,
    private readonly dashboard: WorkspaceDashboardPage,
    private readonly ui: UiWorkspaceState,
  ) {}

  invite(email: string, options?: InviteOptions): Promise<string> {
    return this.ui.invite(email, options);
  }

  async ensureNotMember(email: string): Promise<void> {
    const target = email.toLowerCase();
    for (const member of await this.members()) {
      if (member.user.email.toLowerCase() === target) await this.remove(member);
    }
  }

  async cleanup(email: string): Promise<void> {
    await this.ensureNotMember(email);
  }

  async sweep(): Promise<string[]> {
    assertSweepBoundary();
    const owned = (await this.members()).filter((m) => isSuiteOwned(m.user.email));

    if (owned.length > MAX_SWEEP) {
      throw new Error(
        `Sweep matched ${owned.length} rows, more than the workspace can hold (${MAX_SWEEP}). ` +
          `Refusing to delete — check TEST_EMAIL_PREFIX / TEST_EMAIL_DOMAIN.`,
      );
    }

    for (const member of owned) await this.remove(member);
    return owned.map((m) => m.user.email);
  }

  /** Seats still open for invites; members and pending invites both occupy one. */
  async freeSeats(): Promise<number> {
    const res = await this.call('get', '/billing/capabilities?members=true');
    const body = (await res.json()) as {
      capabilities?: { members?: { max?: number; current?: number; pending?: number } };
    };
    // `currentUsedSlots` is not used: it ignored 9 pending invites on a fresh trial
    // workspace, while `current + pending` matched the app's own "limit exceeded".
    const { max, current, pending } = body.capabilities?.members ?? {};
    if (typeof max !== 'number' || typeof current !== 'number' || typeof pending !== 'number') {
      throw new Error(`Unexpected billing/capabilities shape: ${JSON.stringify(body)}`);
    }
    return max - current - pending;
  }

  /** Active members and pending invites — the same rows the UI's two tabs show. */
  private async members(): Promise<Member[]> {
    const res = await this.call('get', '/members?includeGuests=true');
    const all = (await res.json()) as Member[];
    return all.filter((m) => m.status === 'active' || m.status === 'pending');
  }

  /** Revoking an invite and removing a member are the same call. */
  private async remove(member: Member): Promise<void> {
    await this.call('delete', `/members/${member.id}`);
  }

  private async call(method: 'get' | 'delete', path: string): Promise<APIResponse> {
    const url = `${env.API_URL}/workspaces/${this.workspaceId}${path}`;
    let res = await this.page.request[method](url, { headers: await this.auth() });

    // The token was rejected (they live 30 minutes); drop it, take a fresh one once, retry.
    if (res.status() === 401) {
      forgetWorkspaceToken(this.page.context(), this.workspaceId);
      res = await this.page.request[method](url, { headers: await this.auth() });
    }

    // Already gone is the outcome a delete wants.
    if (method === 'delete' && res.status() === 404) return res;
    if (!res.ok()) {
      throw new Error(`${method.toUpperCase()} ${path.split('?')[0]} → ${res.status()}`);
    }
    return res;
  }

  private get workspaceId(): string {
    return this.dashboard.workspace.id;
  }

  /**
   * The admin's workspace token, as last seen on a request the app made. Only
   * when none has been seen (a fresh page, or a token just rejected) does this
   * load the dashboard to provoke one.
   */
  private async auth(): Promise<Record<string, string>> {
    const context = this.page.context();
    let authorization = latestWorkspaceToken(context, this.workspaceId);

    if (!authorization) {
      await this.dashboard.goto();
      // The listener runs async; give it a beat to record the request the load made.
      await expect
        .poll(() => latestWorkspaceToken(context, this.workspaceId), {
          message: 'no workspace token was seen after loading the dashboard',
          timeout: 10_000,
        })
        .toBeTruthy();
      authorization = latestWorkspaceToken(context, this.workspaceId);
    }

    if (!authorization) throw new Error('Workspace requests carried no authorization header');
    return { authorization };
  }
}
