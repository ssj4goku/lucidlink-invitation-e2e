import { randomUUID } from 'node:crypto';
import { env } from '../core/env';
import type { Identity } from '../core/types';

/**
 * Test identities.
 *
 * Two kinds, because they cost different things:
 *
 *  - **Generated addresses** for invite-only tests. These are never logged into,
 *    so they need no account at all — any syntactically valid address can be
 *    invited and revoked. Unique per test, so nothing is shared between workers.
 *
 *  - **Pool accounts** for accept tests, which require a real, email-verified
 *    login. These are provisioned by hand, one per parallel worker; the pool
 *    size is the practical ceiling on worker count.
 *
 * Every generated address carries TEST_EMAIL_PREFIX, which is the boundary the
 * cleanup sweep respects — it never touches a row that does not match.
 */

/** Stable per process, so one run's addresses are recognisably one run's. */
const RUN_ID = randomUUID().slice(0, 8);

let counter = 0;

export function generatedEmail(label = 'invite'): string {
  counter += 1;
  return `${env.TEST_EMAIL_PREFIX}${RUN_ID}_${label}${counter}@${env.TEST_EMAIL_DOMAIN}`;
}

export function invalidEmail(): string {
  return `${env.TEST_EMAIL_PREFIX}${RUN_ID}-not-an-address`;
}

/**
 * The registered invitee for a given worker. Throws rather than silently
 * reusing one account across workers, which would produce cross-talk that
 * looks like flake.
 */
export function pooledIdentity(workerIndex: number): Identity {
  const pool = env.INVITEE_EMAILS;
  const email = pool[workerIndex];

  if (!email) {
    throw new Error(
      `No invitee account for worker ${workerIndex}: INVITEE_EMAILS holds ${pool.length} ` +
        `address(es). Add another registered account, or lower \`workers\` in playwright.config.ts.`,
    );
  }

  return { email, password: env.INVITEE_PASSWORD };
}

export const runId = RUN_ID;
