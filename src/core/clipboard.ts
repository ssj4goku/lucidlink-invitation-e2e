import type { BrowserContext, Page } from '@playwright/test';

/**
 * Clipboard capture.
 *
 * LucidLink never renders the invite link in the DOM — the success modal only
 * offers a "Copy invite link" button — and the link's secret lives in the URL
 * fragment (`#...`), which never reaches the server. So the link cannot be read
 * from the page, intercepted from a response, or rebuilt from the API: it has
 * to be taken at the moment the app copies it.
 *
 * Reading the real clipboard would work only in a focused Chromium page
 * (`navigator.clipboard.readText()` throws "Document is not focused" otherwise)
 * and would serialise parallel workers behind `bringToFront()`. Instead we wrap
 * `navigator.clipboard.writeText` before any page script runs and keep what the
 * app copies in page memory, which is per-page, permission-free, works in every
 * browser, and is unaffected by how many workers run at once.
 */
const CAPTURE_KEY = '__copiedToClipboard';

function installClipboardCapture(key: string): void {
  const store: string[] = [];
  Object.defineProperty(window, key, { value: store, writable: false });

  const clipboard = navigator.clipboard as Clipboard | undefined;
  if (clipboard?.writeText) {
    const original = clipboard.writeText.bind(clipboard);
    clipboard.writeText = (text: string): Promise<void> => {
      store.push(text);
      // Keep the real call so the app's own success handling still runs, but
      // never let a missing permission fail the click under test.
      return original(text).catch(() => undefined);
    };
  }

  // Safety net for the legacy path, in case the app ever switches to it.
  document.addEventListener(
    'copy',
    (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text');
      if (text) store.push(text);
    },
    true,
  );
}

/** Must be called on the context before any navigation. */
export async function captureClipboardWrites(context: BrowserContext): Promise<void> {
  await context.addInitScript(installClipboardCapture, CAPTURE_KEY);
}

/**
 * Waits until the most recent value the page copied matches `pattern`, and
 * returns it. This is the single place that reads the capture, so callers never
 * touch the page-memory store directly.
 *
 * `description` names what was expected, so a miss reads as "the app did not
 * copy a usable invite link" rather than a bare function timeout.
 */
export async function waitForCopiedValue(
  page: Page,
  pattern: RegExp,
  description: string,
): Promise<string> {
  try {
    const copied = await page.waitForFunction(
      ({ key, source, flags }) => {
        const values = (window as unknown as Record<string, string[]>)[key] ?? [];
        const latest = values.at(-1);
        return latest !== undefined && new RegExp(source, flags).test(latest) ? latest : false;
      },
      { key: CAPTURE_KEY, source: pattern.source, flags: pattern.flags },
    );
    return (await copied.jsonValue()) as string;
  } catch (error) {
    throw new Error(description, { cause: error });
  }
}
