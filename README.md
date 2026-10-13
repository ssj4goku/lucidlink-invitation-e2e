# LucidLink Invitation E2E

Playwright + TypeScript UI automation for the LucidLink **Individual Invitation** and **Accept Invitation** flows: an
admin invites a person into a workspace, and that person accepts.

- 24 tests plus one setup step, Chromium only
- Page Object Model with constructor injection, wired through Playwright fixtures
- Tests run against a **live shared workspace**, so arranging and cleaning up its state is a first-class part of the design

## Contents

- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Running tests](#running-tests)
- [What is covered](#what-is-covered)
- [Architecture](#architecture)
- [Design decisions you should know about](#design-decisions-you-should-know-about)
- [Conventions](#conventions)
- [CI](#ci)
- [Debugging a failure](#debugging-a-failure)
- [Known limitations](#known-limitations)

## Quick start

Requirements: Node.js 22+ and a LucidLink workspace you are allowed to mutate (see [Prerequisites](#prerequisites-one-time-manual-setup)).

```bash
npm ci
npx playwright install chromium
cp .env.example .env     # then fill it in
npm run typecheck
npm run test:smoke
```

`npx playwright test --list` and `npm run typecheck` work without a populated `.env`. Config is read lazily, so a
missing variable fails only when a test needs it, and the error names the variable.

### Prerequisites (one-time, manual)

The suite cannot create these itself, so they must exist before the first run:

| What                                                                                | Why                                                                 |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| An Owner/Admin account on the workspace under test                                  | Only admins can invite.                                             |
| A pool of **registered, email-verified** invitee accounts, one per parallel worker  | Accepting needs a real login. An unverified account cannot sign in. |
| A second admin with their own, otherwise unused workspace                           | The seat-limit tests fill it to capacity. Nothing else may use it.  |
| An existing group in the workspace besides _Everyone_ (default name `2nd division`) | The group-assignment test invites into it.                          |

## Configuration

All settings come from `.env` (git-ignored) or the process environment. CI reads the same names from secrets and variables.
`.env.example` is the reference; the table is a summary.

| Variable                                                                              | Required                     | Purpose                                                                                                                                                                      |
| ------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BASE_URL`                                                                            | no                           | App URL. Default `https://app.lucidlink.com`.                                                                                                                                |
| `API_URL`                                                                             | no                           | The app's own `api/v2`, used by API-backed cleanup.                                                                                                                          |
| `WORKSPACE_ID`, `WORKSPACE_NAME`                                                      | yes                          | Workspace under test. The id is the UUID in `/workspaces/<id>`.                                                                                                              |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`                                                       | yes                          | Owner/Admin of that workspace.                                                                                                                                               |
| `INVITEE_EMAILS`, `INVITEE_PASSWORD`                                                  | yes                          | Comma-separated verified accounts; the pool size caps useful parallelism.                                                                                                    |
| `SEAT_ADMIN_EMAIL`, `SEAT_ADMIN_PASSWORD`, `SEAT_WORKSPACE_ID`, `SEAT_WORKSPACE_NAME` | only for `@seat-limit` tests | The isolated seat-limit workspace.                                                                                                                                           |
| `TEST_EMAIL_PREFIX`, `TEST_EMAIL_DOMAIN`                                              | no                           | Prefix/domain of generated invite addresses. **The cleanup sweep only touches rows matching these**, so keep the prefix distinctive. Defaults `svet_ll_` / `mailinator.com`. |
| `INVITE_GROUP_NAME`                                                                   | no                           | Existing group for the group-assignment test. Default `2nd division`.                                                                                                        |
| `WORKSPACE_STATE`                                                                     | no                           | `api` (default) or `ui`. How cleanup and the sweep reach the workspace. Inviting is always UI.                                                                               |
| `PW_WORKERS`                                                                          | no                           | Parallel workers, default `2`. Raise it only together with `INVITEE_EMAILS`.                                                                                                 |

## Running tests

| Command                                       | What it does                                                    |
| --------------------------------------------- | --------------------------------------------------------------- |
| `npm test`                                    | Full suite on Chromium (runs the `sweep` setup first).          |
| `npm run test:smoke`                          | Only `@smoke`: the full admin-invites-user-who-accepts journey. |
| `npm run test:flows`                          | `src/tests/invitation` only.                                    |
| `npm run test:negative`                       | `src/tests/negative` only.                                      |
| `npm run test:headed`                         | Visible browser.                                                |
| `npm run test:ui`                             | Playwright UI mode.                                             |
| `npm run report`                              | Open the last HTML report (`reports/html`).                     |
| `npm run typecheck` / `lint` / `format:check` | Static checks. CI runs all three before the suite.              |

Useful variants:

```bash
npx playwright test --project=chromium --grep @e2e                       # by tag
npx playwright test --project=chromium src/tests/negative/revoke-invite.spec.ts
npx playwright test --project=chromium --debug -g "revoking removes"     # step through one test
```

```powershell
$env:WORKSPACE_STATE='ui'; npm test    # PowerShell: use the UI cleanup driver for one run
```

### Tags

| Tag           | Meaning                                                        |
| ------------- | -------------------------------------------------------------- |
| `@smoke`      | Fastest meaningful end-to-end signal. One test.                |
| `@regression` | Every test in the suite.                                       |
| `@e2e`        | Cross-actor journeys (admin and invitee in separate browsers). |
| `@seat-limit` | Needs the isolated seat workspace; runs serially.              |

## What is covered

| Area          | File                                       | Checks                                                                                                                                           |
| ------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Login         | `auth/login.spec.ts`                       | Admin login through the real UI; the login form is email-first and validates the address.                                                        |
| Create invite | `invitation/individual-invitation.spec.ts` | Invite yields a usable link; invitee shows as pending; link can be re-copied from the row; invite with a group; several addresses in one submit. |
| Accept invite | `invitation/accept-invitation.spec.ts`     | Invitee accepts and gains access; dismissing leaves the invite pending and still acceptable; a revoked invite cannot be accepted.                |
| Full journey  | `invitation/invitation-e2e.spec.ts`        | Admin invites, a second browser accepts, the member is active. `@smoke`.                                                                         |
| Validation    | `negative/invitation-validation.spec.ts`   | Empty, malformed and uncommitted addresses; removing a chip; duplicate pending invite; seat-limit blocking; org-wide invites gated by plan.      |
| Revoke        | `negative/revoke-invite.spec.ts`           | Revoke removes the pending member; re-invite after revoke; cancelling the confirmation.                                                          |
| Wrong account | `negative/invite-wrong-account.spec.ts`    | A signed-in account that was not invited is told the link is invalid.                                                                            |

## Architecture

```
src/
├── tests/        intent and assertions; no locators (lint-enforced)
├── fixtures/     test.fixture.ts (the extended `test`), contexts.ts (logged-in contexts), compose.ts (wiring)
├── pages/        page objects: locators + actions + expect* helpers
├── components/   reusable UI pieces held by pages (data table, dialogs, cookie banner)
├── state/        arrange/cleanup of workspace membership (API or UI driver) and the sweep's safety boundary
├── data/         generated and pooled test identities
└── core/         env, routes, shared types, clipboard capture
```

Dependencies point downward only; `core/` imports nothing from the project.

**Run order** (`playwright.config.ts`):

1. `sweep` project removes invites and members orphaned by an aborted run, so the 10-seat cap does not surface as a phantom product bug.
2. `chromium` project runs the tests, which depend on `sweep`.

**Fixtures are the dependency injection.** A spec asks for what it needs (`adminPage`, `inviteePage`, `dashboard`,
`members`, `acceptInvite`, `workspace`, `invitee`, `inviteeAccount`, `seatWorkspace`) and pays for nothing else.
Teardown lives in the fixtures, not in `afterEach`, so it runs when a test fails mid-flow.

## Design decisions you should know about

**The invite link can only be taken from the clipboard.** LucidLink never emails it. The link is
`/i?invitationId=<uuid>#<secret>`: the secret is in the URL fragment, so the server never sees it, and the app never
renders it in the DOM. `src/core/clipboard.ts` wraps `navigator.clipboard.writeText` before page scripts run and keeps
what the app copies in page memory. It is per-page, needs no permission and does not serialise parallel workers.

**Live login, not saved `storageState`.** A restored session reaches the dashboard, but the Members page cannot render
member data and an invitee's Accept click fails silently, because the web client needs crypto state initialised during a
live login. Each test logs the admin in inside its own context; each worker logs its pooled invitee in once and shares
that context. The login UI itself is covered by `login.spec.ts`.

**One shared workspace with a 10-seat trial cap.** This drives most of the structure:

- Parallelism is bounded by **seats and invitee accounts, not CPU** (`PW_WORKERS`, default 2).
- Each worker owns one pooled invitee, so workers never collide.
- Every test cleans up after itself through a fixture; the `sweep` project catches what an aborted run left behind.
- The sweep only deletes addresses matching `TEST_EMAIL_PREFIX` + `TEST_EMAIL_DOMAIN` and never touches the admins or
  pooled invitees (`src/state/suite-ownership.ts`). That boundary is what protects real members.
- Seat-limit tests fill a **separate** workspace, so they cannot starve parallel tests.

**Two cleanup drivers.** `WORKSPACE_STATE=api` (default) calls the app's own `api/v2` with the admin page's bearer
token: fast, about 150 ms per call, but the endpoints are undocumented. `ui` drives the Members page: slower, but visible
in traces and independent of the API. Flip it with one variable (a repo variable in CI) if a LucidLink release breaks the
API.

## Conventions

Enforced by ESLint where possible, otherwise by review.

- **No locators in specs.** `getBy*`, `locator`, `frameLocator` and `$`/`$$` are banned in `src/tests` by lint rule.
  Add or extend a page object instead.
- **Locators are private** to their page object. Specs act through action methods and assert through `expect*` methods.
- **Actions contain no `expect`.** They wait with `locator.waitFor()`; assertions belong to specs or `expect*` helpers.
- **Name by intent, not element.** `expectInviteCreated()`, not `expectSuccessImageVisible()`.
- **No fixed waits.** `waitForTimeout` is a lint error; use web-first assertions or `expect.poll`.
- **Composition over inheritance.** Pages hold components; there is no `BasePage`.
- **Explicit paths at call sites.** `dashboard.inviteMembersDialog.addEmail(x)` rather than aliasing or flattening onto the parent.
- **Tests are independent.** Each arranges its own state and leaves nothing behind.
- Locator strategy: `data-testid` first (`testIdAttribute` is set), then role. Strict TypeScript, Prettier at 100 columns.

### Adding a test

1. Put the spec under the matching `src/tests/` folder and import `test`/`expect` from `fixtures/test.fixture`.
2. Request fixtures for what you need; use `invitee` / `newInvitee` for throwaway addresses and `inviteeAccount` when the invitee must log in.
3. If you need a new element or action, add it to a page object (private locator, intent-named method).
4. Tag it (`@regression`, plus `@smoke` / `@e2e` where it earns it).
5. Run `npm run typecheck && npm run lint && npm run format:check`.

## CI

`.github/workflows/e2e.yml` runs nightly at 02:00 UTC and on manual dispatch (optional `tag` and `file` inputs). It
installs Chromium, runs typecheck, lint and format check, then the suite with `CI=true` (2 retries, `forbidOnly`).

- Runs are serialised (`concurrency: e2e`), because every run mutates the same workspace.
- Credentials come from repository **secrets**; non-sensitive ids and names from repository **variables**.
- Only `reports/junit.xml` is uploaded as an artifact. The repository is public, and traces, videos and the HTML report
  contain session tokens and invite links, which are bearer credentials. Reproduce failures locally.

## Debugging a failure

Traces, screenshots and videos are kept on failure under `test-results/`.

```bash
npx playwright show-trace test-results/<test-folder>/trace.zip
npm run report
```

Treat `test-results/` and `reports/` as sensitive; both are git-ignored.

| Symptom                                   | Likely cause                                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `Missing required environment variable X` | `.env` incomplete. The message names the variable.                                                       |
| Invite button disabled / seat errors      | Orphans from an aborted run filled the 10 seats. The next `sweep` clears them; check the prefix matches. |
| Cleanup calls fail with 4xx/5xx           | `api/v2` changed. Run with `WORKSPACE_STATE=ui`.                                                         |
| Login fails for an invitee                | The pooled account is not email-verified, or `INVITEE_PASSWORD` is wrong.                                |
| Members table empty / Accept does nothing | The page was reached with restored session state instead of a live login.                                |
| Failures only with higher `PW_WORKERS`    | More workers than invitee accounts or free seats. Keep them in step.                                     |

## Known limitations

- **Chromium only.** Other browsers are not configured.
- **Shared live environment.** Tests are not hermetic. Two concurrent runs against the same workspace can delete each
  other's in-flight invites, since the sweep identifies orphans by prefix alone. CI serialises its own runs, but a local
  run during a CI run can interfere.
- **Undocumented API.** API cleanup relies on `api/v2` endpoints that LucidLink may change; the UI driver is the fallback,
  and it is only exercised when selected.
- **Manual account provisioning** for the admin, invitee pool and seat workspace.
- Invite emails are never delivered by the product, so email delivery is out of scope.
