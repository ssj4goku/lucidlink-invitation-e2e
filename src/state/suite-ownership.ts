import { env } from '../core/env';

/**
 * Whether a workspace row was created by this suite and may be bulk-removed.
 *
 * This is the safety boundary for `sweep()`, which runs unscoped against a
 * workspace that can hold real people. Shared by every `WorkspaceState`
 * implementation so a UI and an API sweep can never disagree on it.
 *
 * Deliberately stricter than "starts with the prefix":
 *  - the address must also be on the configured test domain, as every
 *    `generatedEmail()` is;
 *  - the admins and the pooled invitee accounts are never candidates, even if
 *    their addresses happen to match — per-test fixtures manage those.
 *
 * Scoped cleanup (`cleanup(email)` / `ensureNotMember(email)`) does not use
 * this: it acts on an address the caller already owns.
 */
export function isSuiteOwned(email: string): boolean {
  const address = email.trim().toLowerCase();
  const prefix = suitePrefix();
  const domain = `@${env.TEST_EMAIL_DOMAIN.toLowerCase()}`;

  if (!address.startsWith(prefix) || !address.endsWith(domain)) return false;

  const protectedAddresses = env.PROTECTED_EMAILS.map((e) => e.toLowerCase());
  return !protectedAddresses.includes(address);
}

/**
 * Call at the start of a sweep so a misconfigured prefix fails even when there
 * is nothing to match — `isSuiteOwned` alone would only throw once a row exists.
 */
export function assertSweepBoundary(): void {
  suitePrefix();
}

/** Below this, a prefix is too generic to be a boundary (e.g. "s" or "test"). */
const MIN_PREFIX_LENGTH = 5;

function suitePrefix(): string {
  const prefix = env.TEST_EMAIL_PREFIX.toLowerCase();
  if (prefix.length < MIN_PREFIX_LENGTH) {
    throw new Error(
      `TEST_EMAIL_PREFIX "${prefix}" is too short to safely identify suite-owned rows ` +
        `(minimum ${MIN_PREFIX_LENGTH} characters). Refusing to sweep.`,
    );
  }
  return prefix;
}
