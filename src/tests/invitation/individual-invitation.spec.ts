import { env } from '../../core/env';
import { INVITE_LINK_PATTERN } from '../../core/routes';
import { expect, test } from '../../fixtures/test.fixture';

test.describe('Individual invitation', () => {
  test(
    'admin invites a specific person and gets a usable invite link',
    { tag: '@regression' },
    async ({ dashboard, invitee }) => {
      await dashboard.goto();
      await dashboard.openInviteDialog();
      await dashboard.inviteMembersDialog.expectOpen();
      await dashboard.inviteMembersDialog.expectOrganizationInviteDisabled();

      await dashboard.inviteMembersDialog.expectGenerateDisabled();
      await dashboard.inviteMembersDialog.addEmail(invitee);
      await dashboard.inviteMembersDialog.expectTagShown(invitee);
      await dashboard.inviteMembersDialog.expectGenerateEnabled();

      await dashboard.inviteMembersDialog.generate();
      await dashboard.inviteMembersDialog.expectInviteCreated();

      const link = await dashboard.inviteMembersDialog.copyInviteLink();
      expect(link).toMatch(INVITE_LINK_PATTERN);
      expect(link).toContain('#');
    },
  );

  test(
    'invited person appears as pending in the members table',
    { tag: '@regression' },
    async ({ dashboard, members, invitee }) => {
      await dashboard.goto();
      await dashboard.openInviteDialog();
      await dashboard.inviteMembersDialog.invite(invitee);

      await members.goto('pending');

      await members.expectPendingRow(invitee);
      await members.expectRole(invitee, 'Standard');
      await members.expectGroups(invitee, ['Everyone']);
    },
  );

  test(
    'a pending invite link can be copied again from the members row',
    { tag: '@regression' },
    async ({ dashboard, members, invitee }) => {
      await dashboard.goto();
      await dashboard.openInviteDialog();
      const generatedLink = await dashboard.inviteMembersDialog.invite(invitee);

      const copiedLink = await members.copyInviteLink(invitee);

      expect(copiedLink).toMatch(INVITE_LINK_PATTERN);
      expect(copiedLink).toBe(generatedLink);
    },
  );

  test(
    'an invite sent with a group puts the invitee in that group',
    { tag: '@regression' },
    async ({ dashboard, members, invitee }) => {
      await dashboard.goto();
      await dashboard.openInviteDialog();
      await dashboard.inviteMembersDialog.invite(invitee, { groups: [env.INVITE_GROUP_NAME] });

      await members.goto('pending');

      await members.expectGroups(invitee, [env.INVITE_GROUP_NAME, 'Everyone']);
    },
  );

  test(
    'several addresses can be invited in one submit',
    { tag: '@regression' },
    async ({ dashboard, members, newInvitee }) => {
      const emails = [newInvitee(), newInvitee()];

      await dashboard.goto();
      await dashboard.openInviteDialog();
      await dashboard.inviteMembersDialog.addEmails(emails);
      await dashboard.inviteMembersDialog.generate();
      await dashboard.inviteMembersDialog.close();

      await members.goto('pending');

      for (const email of emails) {
        await members.expectPendingRow(email);
        await members.expectRole(email, 'Standard');
      }
    },
  );
});
