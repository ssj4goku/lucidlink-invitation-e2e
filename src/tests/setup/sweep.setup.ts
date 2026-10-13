import { test as setup } from '@playwright/test';
import { env } from '../../core/env';
import { loggedInAdminPage } from '../../fixtures/contexts';
import { newWorkspaceState } from '../../fixtures/compose';

/**
 * Clears invites and members left behind by an aborted run.
 *
 * Per-test teardown handles the normal case; this covers the abnormal one. On a
 * workspace capped at 10 seats, orphans accumulate into a failure that looks
 * like a product bug ("invite button disabled") rather than leftover state.
 *
 * It only ever touches addresses carrying TEST_EMAIL_PREFIX. Real members — and
 * the pooled invitee accounts — are never candidates.
 */
setup('sweep orphaned test invitations', async ({ browser }) => {
  const { context, page } = await loggedInAdminPage(browser);

  const removed = await newWorkspaceState(page).sweep();

  if (removed.length > 0) {
    console.log(
      `[sweep] removed ${removed.length} orphaned entr${removed.length === 1 ? 'y' : 'ies'} ` +
        `matching "${env.TEST_EMAIL_PREFIX}": ${removed.join(', ')}`,
    );
  }

  await context.close();
});
