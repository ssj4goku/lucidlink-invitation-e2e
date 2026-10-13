import type { Browser, BrowserContext, Page } from '@playwright/test';
import { captureClipboardWrites } from '../core/clipboard';
import { env } from '../core/env';
import type { Identity } from '../core/types';
import { trackWorkspaceTokens } from '../state/workspace-token';
import { newLogin } from './compose';

export interface LoggedInPageSession {
  context: BrowserContext;
  page: Page;
}

async function contextWithClipboard(
  browser: Browser,
  options?: Parameters<Browser['newContext']>[0],
): Promise<BrowserContext> {
  const context = await browser.newContext(options);
  await captureClipboardWrites(context);
  trackWorkspaceTokens(context);
  return context;
}

/**
 * Logs an identity in inside the same page the tests will later drive.
 *
 * Restored storage state reaches the dashboard, but the web client also needs
 * crypto initialised during a live login: the Members UI cannot render member
 * data without it, and an invitee cannot accept an invite (the Accept click
 * fails silently on the client, with no request sent).
 */
export async function loggedInPage(
  browser: Browser,
  identity: Identity,
): Promise<LoggedInPageSession> {
  const context = await contextWithClipboard(browser);
  const page = await context.newPage();

  await newLogin(page).login(identity);

  return { context, page };
}

export async function loggedInAdminPage(browser: Browser): Promise<LoggedInPageSession> {
  return loggedInPage(browser, { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD });
}

/** The admin of the isolated seat-limit workspace, not of the primary one. */
export async function loggedInSeatAdminPage(browser: Browser): Promise<LoggedInPageSession> {
  return loggedInPage(browser, {
    email: env.SEAT_ADMIN_EMAIL,
    password: env.SEAT_ADMIN_PASSWORD,
  });
}

/**
 * Logs an identity in once and hands back the live context, so later tests can
 * open pages in it without paying for another login.
 */
export async function loggedInContext(
  browser: Browser,
  identity: Identity,
): Promise<BrowserContext> {
  const { context, page } = await loggedInPage(browser, identity);
  await page.close();
  return context;
}
