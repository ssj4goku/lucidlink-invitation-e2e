import { test } from '../../fixtures/test.fixture';

test.describe('Invite link opened by the wrong account', () => {
  test(
    'a signed-in account that was not invited is told the link is invalid',
    { tag: '@regression' },
    async ({ workspace, members, acceptInvite, inviteeIdentity, invitee }) => {
      const inviteLink = await workspace.invite(invitee);

      await acceptInvite.open(inviteLink);

      await acceptInvite.expectInvalidForCurrentAccount(inviteeIdentity.email);

      await members.expectState(invitee, 'pending');
      await members.expectListed(invitee);
    },
  );
});
