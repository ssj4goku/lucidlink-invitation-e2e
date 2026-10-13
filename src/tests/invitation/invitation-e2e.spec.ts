import { env } from '../../core/env';
import { test } from '../../fixtures/test.fixture';

test(
  'admin invites a user who then accepts and joins the workspace',
  { tag: ['@regression', '@smoke'] },
  async ({ dashboard, members, acceptInvite, inviteeDashboard, inviteeAccount }) => {
    await test.step('admin generates an invite for the user', async () => {
      await dashboard.goto();
      await dashboard.openInviteDialog();

      const link = await dashboard.inviteMembersDialog.invite(inviteeAccount.email);

      await acceptInvite.open(link);
    });

    await test.step('members table shows the invitation as pending', async () => {
      await members.goto('pending');
      await members.expectPendingRow(inviteeAccount.email);
    });

    await test.step('invited user accepts the invitation', async () => {
      await acceptInvite.expectInviteFor(env.WORKSPACE_NAME);
      await acceptInvite.accept();
    });

    await test.step('app confirms the user has joined', async () => {
      await inviteeDashboard.expectOnboardingComplete();
    });

    await test.step('user has access to the workspace', async () => {
      await inviteeDashboard.goto();
      await inviteeDashboard.expectJoinedAsStandardMember();
    });

    await test.step('admin sees the member as active', async () => {
      await members.expectState(inviteeAccount.email, 'active');
      await members.expectRole(inviteeAccount.email, 'Standard');
    });
  },
);
