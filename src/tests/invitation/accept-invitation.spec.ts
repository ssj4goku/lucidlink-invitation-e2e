import { env } from '../../core/env';
import { test } from '../../fixtures/test.fixture';

test.describe('Accept invitation', () => {
  test(
    'invited user accepts and gains access to the workspace',
    { tag: ['@regression', '@e2e'] },
    async ({ workspace, members, acceptInvite, inviteeDashboard, inviteeAccount }) => {
      const inviteLink = await workspace.invite(inviteeAccount.email);

      await acceptInvite.open(inviteLink);
      await acceptInvite.expectInviteFor(env.WORKSPACE_NAME);
      await acceptInvite.accept();

      await inviteeDashboard.expectOnboardingComplete();
      await inviteeDashboard.goto();
      await inviteeDashboard.expectJoinedAsStandardMember();

      await members.expectState(inviteeAccount.email, 'active');
      await members.expectJoined(inviteeAccount.email);
    },
  );

  test(
    'dismissing an invite leaves it pending and still acceptable',
    { tag: '@regression' },
    async ({ workspace, members, acceptInvite, inviteeDashboard, inviteeAccount }) => {
      const inviteLink = await workspace.invite(inviteeAccount.email);

      await acceptInvite.open(inviteLink);
      await acceptInvite.dismiss();

      await inviteeDashboard.expectAccessPending();

      await members.expectState(inviteeAccount.email, 'pending');

      await acceptInvite.open(inviteLink);
      await acceptInvite.expectAcceptable();
    },
  );

  test(
    'a revoked invite can no longer be accepted',
    { tag: '@regression' },
    async ({ workspace, members, acceptInvite, inviteeAccount }) => {
      const inviteLink = await workspace.invite(inviteeAccount.email);
      await members.revokeInvite(inviteeAccount.email);

      await acceptInvite.open(inviteLink);

      await acceptInvite.expectNotAcceptable();
      await members.expectNotListed(inviteeAccount.email);
    },
  );
});
