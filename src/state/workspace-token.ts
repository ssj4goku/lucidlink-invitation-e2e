import type { BrowserContext } from '@playwright/test';
import { env } from '../core/env';

/**
 * The workspace bearer token, read off requests the app makes anyway.
 *
 * Listening on the context means the API driver never has to navigate to get a
 * token, and always sees the latest one — the app refreshes it itself, so the
 * 30-minute expiry needs no handling here. The user-level token the login
 * returns is rejected by workspace endpoints, hence the `/workspaces/{id}/` filter.
 */
const tokens = new WeakMap<BrowserContext, Map<string, string>>();

/** Start recording tokens. Call before login so nothing is missed. */
export function trackWorkspaceTokens(context: BrowserContext): void {
  const byWorkspace = new Map<string, string>();
  tokens.set(context, byWorkspace);

  context.on('request', async (request) => {
    const workspaceId = request.url().match(/\/workspaces\/([^/?#]+)\//)?.[1];
    if (!workspaceId || !request.url().startsWith(env.API_URL)) return;

    const authorization = await request.headerValue('authorization').catch(() => null);
    if (authorization) byWorkspace.set(workspaceId, authorization);
  });
}

export function latestWorkspaceToken(
  context: BrowserContext,
  workspaceId: string,
): string | undefined {
  return tokens.get(context)?.get(workspaceId);
}

/** Drop a token the server rejected, so the next caller re-acquires one. */
export function forgetWorkspaceToken(context: BrowserContext, workspaceId: string): void {
  tokens.get(context)?.delete(workspaceId);
}
