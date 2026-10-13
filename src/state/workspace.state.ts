import type { InviteOptions } from '../core/types';

/**
 * Arrange/cleanup for workspace membership — the piece that makes the suite
 * re-runnable against one live workspace.
 *
 * Kept behind an interface for one concrete reason: cleanup is much faster
 * through `api/v2` (`ApiWorkspaceState`) than through the UI. It cannot replace `invite()` though —
 * the invite link's secret lives in the URL fragment and never reaches the
 * server, so a usable link can only be captured from the UI at generation time.
 * That asymmetry is why this is an interface and not a swappable pair.
 */
export interface WorkspaceState {
  /** Invite an address and return a usable invite link. */
  invite(email: string, options?: InviteOptions): Promise<string>;

  /**
   * Leave the workspace with `email` not a member and not pending.
   * Idempotent: safe when the address was never invited.
   */
  ensureNotMember(email: string): Promise<void>;

  /** Seats still open for invites (members and pending invites both occupy one). */
  freeSeats(): Promise<number>;

  /** Alias used in teardown, so test code reads as intent rather than mechanism. */
  cleanup(email: string): Promise<void>;

  /**
   * Remove every pending invite and member created by this suite, identified by
   * the configured test-address prefix. Never touches anything else — this is
   * the guard that lets cleanup run against a workspace holding real people.
   */
  sweep(): Promise<string[]>;
}
