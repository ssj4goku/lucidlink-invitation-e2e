import dotenv from 'dotenv';
import type { WorkspaceTarget } from './types';

dotenv.config();

/**
 * Typed configuration.
 *
 * Values are resolved lazily through getters so that `playwright test --list`,
 * `tsc --noEmit` and the HTML reporter all work without a populated `.env`.
 * The failure surfaces at the moment a test actually needs the value, and it
 * names the missing variable instead of producing an `undefined` deep in a POM.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function list(name: string): string[] {
  return required(name)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const env = {
  get BASE_URL(): string {
    return optional('BASE_URL', 'https://app.lucidlink.com');
  },

  /** The app's own `api/v2`, which cleanup and the sweep call (see ApiWorkspaceState). */
  get API_URL(): string {
    return optional('API_URL', 'https://api.lucidlink.com/api/v2').replace(/\/+$/, '');
  },

  /** Workspace under test. The id is in the dashboard URL: /workspaces/<id>. */
  get WORKSPACE_ID(): string {
    return required('WORKSPACE_ID');
  },
  get WORKSPACE_NAME(): string {
    return required('WORKSPACE_NAME');
  },

  /** Must hold Owner or Admin — inviting is admin-only. */
  get ADMIN_EMAIL(): string {
    return required('ADMIN_EMAIL');
  },
  get ADMIN_PASSWORD(): string {
    return required('ADMIN_PASSWORD');
  },

  get PRIMARY_WORKSPACE(): WorkspaceTarget {
    return { id: this.WORKSPACE_ID, name: this.WORKSPACE_NAME };
  },

  /**
   * A second admin who owns a workspace nothing else touches. Seat-limit tests
   * fill it to capacity, which would starve every parallel test if they did it
   * in the primary workspace. Provisioned by hand, like the invitee pool.
   */
  get SEAT_ADMIN_EMAIL(): string {
    return required('SEAT_ADMIN_EMAIL');
  },
  get SEAT_ADMIN_PASSWORD(): string {
    return required('SEAT_ADMIN_PASSWORD');
  },
  get SEAT_WORKSPACE(): WorkspaceTarget {
    return { id: required('SEAT_WORKSPACE_ID'), name: required('SEAT_WORKSPACE_NAME') };
  },

  /**
   * Registered, email-verified accounts used by the accept flows — one per
   * parallel worker. Comma separated; the pool size caps useful worker count.
   */
  get INVITEE_EMAILS(): string[] {
    return list('INVITEE_EMAILS');
  },
  get INVITEE_PASSWORD(): string {
    return required('INVITEE_PASSWORD');
  },

  /**
   * Addresses generated for invite-only tests (never logged into, so they need
   * no account). The prefix is the safety boundary: cleanup only ever touches
   * rows that match it or that are in INVITEE_EMAILS.
   */
  get TEST_EMAIL_PREFIX(): string {
    return optional('TEST_EMAIL_PREFIX', 'svet_ll_');
  },
  get TEST_EMAIL_DOMAIN(): string {
    return optional('TEST_EMAIL_DOMAIN', 'mailinator.com');
  },

  /**
   * Accounts a bulk sweep must never remove, whatever their address looks like:
   * both admins and the pooled invitees. The seat admin is read leniently so a
   * run that never touches the seat workspace needs no SEAT_* variables.
   */
  get PROTECTED_EMAILS(): string[] {
    const seatAdmin = process.env.SEAT_ADMIN_EMAIL?.trim();
    return [this.ADMIN_EMAIL, ...(seatAdmin ? [seatAdmin] : []), ...this.INVITEE_EMAILS];
  },

  /**
   * A group that already exists in the workspace under test, besides the
   * implicit Everyone. The group-assignment test invites into it.
   */
  get INVITE_GROUP_NAME(): string {
    return optional('INVITE_GROUP_NAME', '2nd division');
  },

  /**
   * How cleanup and the sweep reach the workspace. `api` (default) calls the
   * app's own api/v2 with the admin's bearer token; `ui` drives the Members
   * page. Inviting is UI either way. Switch to `ui` if the undocumented API
   * changes — see docs/guides/WORKSPACE-STATE-DRIVER.md.
   */
  get WORKSPACE_STATE(): 'api' | 'ui' {
    const value = optional('WORKSPACE_STATE', 'api').toLowerCase();
    if (value !== 'api' && value !== 'ui') {
      throw new Error(`WORKSPACE_STATE must be "api" or "ui", got "${value}".`);
    }
    return value;
  },

  get CI(): boolean {
    return !!process.env.CI;
  },
} as const;
