import { expect, test } from '../../fixtures/test.fixture';

test.describe('Revoking invitations', () => {
  test(
    'revoking removes the pending member',
    { tag: '@regression' },
    async ({ workspace, members, invitee }) => {
      await workspace.invite(invitee);
      await members.goto('pending');
      await members.expectListed(invitee);

      await members.revokeInvite(invitee);

      await members.expectNotListed(invitee);
      await members.expectState(invitee, 'absent');
    },
  );

  test(
    'the same address can be invited again after revoking',
    { tag: '@regression' },
    async ({ workspace, members, invitee }) => {
      const firstLink = await workspace.invite(invitee);
      await members.revokeInvite(invitee);

      const secondLink = await workspace.invite(invitee);

      await members.goto('pending');
      await members.expectListed(invitee);
      expect(secondLink).not.toBe(firstLink);
    },
  );

  test(
    'cancelling the confirmation leaves the invitation intact',
    { tag: '@regression' },
    async ({ workspace, members, invitee }) => {
      await workspace.invite(invitee);

      await members.cancelRevokeInvite(invitee);

      await members.expectListed(invitee);
    },
  );
});
