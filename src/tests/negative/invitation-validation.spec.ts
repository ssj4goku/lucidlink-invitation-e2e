import { expect, test } from '../../fixtures/test.fixture';
import { generatedEmail, invalidEmail } from '../../data/identities';

test.describe('Invite dialog validation', () => {
  test('cannot submit without an address', { tag: '@regression' }, async ({ dashboard }) => {
    await dashboard.goto();
    await dashboard.openInviteDialog();
    const dialog = dashboard.inviteMembersDialog;

    await dialog.expectGenerateDisabled();
    await dialog.expectValidEmailRuleUnsatisfied();
    await dialog.expectSeatLimitRuleSatisfied();
  });

  test(
    'leaving the field empty after focusing it shows the required error',
    { tag: '@regression' },
    async ({ dashboard }) => {
      await dashboard.goto();
      await dashboard.openInviteDialog();
      const dialog = dashboard.inviteMembersDialog;

      await dialog.expectRequiredErrorHidden();

      await dialog.touchAndLeaveEmailEmpty();

      await dialog.expectRequiredErrorShown();
      await dialog.expectGenerateDisabled();
    },
  );

  test('rejects a malformed address', { tag: '@regression' }, async ({ dashboard }) => {
    await dashboard.goto();
    await dashboard.openInviteDialog();
    const dialog = dashboard.inviteMembersDialog;

    const malformed = invalidEmail();
    await dialog.addEmail(malformed);

    await dialog.expectTagInvalid(malformed);
    await dialog.expectGenerateDisabled();
    await dialog.expectValidEmailRuleUnsatisfied();
  });

  test(
    'typing an address without committing it leaves submission disabled',
    { tag: '@regression' },
    async ({ dashboard, invitee }) => {
      await dashboard.goto();
      await dashboard.openInviteDialog();
      const dialog = dashboard.inviteMembersDialog;

      await dialog.typeEmail(invitee);
      await dialog.expectTagHidden(invitee);
      await dialog.expectGenerateDisabled();

      await dialog.commitTypedEmail(invitee);
      await dialog.expectTagShown(invitee);
      await dialog.expectGenerateEnabled();
    },
  );

  test(
    'a committed address can be removed again',
    { tag: '@regression' },
    async ({ dashboard, invitee }) => {
      await dashboard.goto();
      await dashboard.openInviteDialog();
      const dialog = dashboard.inviteMembersDialog;

      await dialog.addEmail(invitee);
      await dialog.removeEmail(invitee);

      await dialog.expectTagHidden(invitee);
      await dialog.expectGenerateDisabled();
    },
  );

  test(
    'inviting an address that is already pending is rejected',
    { tag: '@regression' },
    async ({ dashboard, members, invitee }) => {
      await dashboard.goto();
      await dashboard.openInviteDialog();
      await dashboard.inviteMembersDialog.invite(invitee);
      await dashboard.inviteMembersDialog.close();

      await dashboard.openInviteDialog();
      const dialog = dashboard.inviteMembersDialog;
      await dialog.addEmail(invitee);
      await dialog.expectGenerateEnabled();
      await dialog.submit();

      await dialog.expectNoInviteCreated();
      await dialog.expectGenerateDisabled();
      await dialog.expectTagRejected(
        invitee,
        'There is an existing member with this email address in your workspace.',
      );

      const pending = await members.emailsOn('pending');
      expect(pending.filter((email) => email === invitee)).toHaveLength(1);
    },
  );

  test.describe('seat limit', () => {
    test.describe.configure({ mode: 'serial' });

    test(
      'inviting is blocked outright once every seat is taken @seat-limit',
      { tag: '@regression' },
      async ({ seatWorkspace: { dashboard, fillLeaving } }) => {
        await fillLeaving(0);
        await dashboard.goto();
        await dashboard.clickInviteMembers();

        await dashboard.planLimitDialog.expectShown();
        await dashboard.inviteMembersDialog.expectClosed();
      },
    );

    test(
      'Generate is disabled once the addresses exceed the free seats @seat-limit',
      { tag: '@regression' },
      async ({ seatWorkspace: { dashboard, fillLeaving } }) => {
        await fillLeaving(2);
        await dashboard.goto();
        await dashboard.openInviteDialog();

        const dialog = dashboard.inviteMembersDialog;
        const [first, second] = [generatedEmail('fits'), generatedEmail('fits')];
        const overflow = generatedEmail('overflow');

        await dialog.addEmails([first, second]);
        await dialog.expectGenerateEnabled();

        await dialog.addEmail(overflow);
        await dialog.expectGenerateDisabled();
        await dialog.hoverEmail(overflow);
        await dialog.expectSeatLimitTooltip(overflow);

        await dialog.removeEmail(overflow);
        await dialog.expectTagHidden(overflow);
        await dialog.expectGenerateEnabled();
      },
    );
  });

  test(
    'organization-wide invites are gated behind a paid plan',
    { tag: '@regression' },
    async ({ dashboard }) => {
      await dashboard.goto();
      await dashboard.openInviteDialog();

      await dashboard.inviteMembersDialog.expectOrganizationInviteGatedByPlan();
    },
  );
});
