import { env } from './env';

/**
 * Every route the suite navigates to, in one place.
 */
export const routes = {
  login: '/login',
  workspaceDashboard: (workspaceId = env.WORKSPACE_ID): string => `/workspaces/${workspaceId}`,
} as const;

/** `https://app.lucidlink.com/i?invitationId=<uuid>#<secret>` */
export const INVITE_LINK_PATTERN = /\/i\?invitationId=[0-9a-f-]{36}#.+/;
