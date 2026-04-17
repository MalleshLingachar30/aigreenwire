# Archive And Email Redirect Investigation

Scope: `aigreenwire/` on `main` at `121c931` (`fix: use request header instead of redirect for archive token passthrough`).

## Summary

There are two different redirect problems in play:

1. The reported mobile "tap archive, bounce back to landing page" loop is exactly explained by the pre-`121c931` archive middleware behavior. Older code redirected `/issues?token=...` to clean `/issues` after setting a cookie, and that fails in in-app/email browsers that drop cookies on redirect responses.
2. On current `main`, that confirmation-path bug is already addressed, but the issue-email "view in browser" path is still broken by design because it links to `/issues/[slug]` with no token. A fresh mobile/email browser with no archive cookie hits the archive guard and is redirected to `/?archive=subscribe`.

The screenshot context points at the post-confirmation subscription screen, but the exact UI in the screenshot does not fully match current `main`, so production may be behind `main` or the screenshot may be from an older build.

## Screenshot Context

The attached screenshot is clearly the post-confirmation subscription-management screen:

- Current `main` renders that screen from `app/unsubscribe/page.tsx` when `status` is `confirmed` or `already-confirmed`.
- The screen title `Subscription confirmed` matches [app/unsubscribe/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/unsubscribe/page.tsx:12).
- The archive CTA on current `main` is `Browse subscriber archive`, generated at [app/unsubscribe/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/unsubscribe/page.tsx:61) and [app/unsubscribe/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/unsubscribe/page.tsx:72).

Important mismatch:

- The screenshot shows an `Unsubscribe now` button.
- Current `main` does not render that button; it renders a footer text link instead at [app/unsubscribe/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/unsubscribe/page.tsx:90).

That mismatch matters because it strongly suggests the reported production behavior may have been captured on code older than current `main`.

## Exact Route And Guard Chain

### 1. Confirmation flow route chain

1. User clicks email confirmation link: `/api/confirm?token=<confirm_token>`.
2. [app/api/confirm/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/confirm/route.ts:20) redirects to `/unsubscribe?status=confirmed&token=<unsubscribe_token>`.
3. That same handler also sets the archive cookie with the subscriber's `unsubscribe_token` at [app/api/confirm/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/confirm/route.ts:33) and [app/api/confirm/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/confirm/route.ts:104).
4. The confirmation page builds the archive CTA as `/issues?token=<unsubscribe_token>` at [app/unsubscribe/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/unsubscribe/page.tsx:61).
5. `/issues` and `/issues/[slug]` are protected by [app/issues/layout.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/issues/layout.tsx:9), which calls `requireArchiveAccess()`.
6. `requireArchiveAccess()` redirects to `/?archive=subscribe` if no valid token is available or if the token is not an active confirmed subscriber, at [lib/archive-access.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/archive-access.ts:43) through [lib/archive-access.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/archive-access.ts:60).

### 2. Current archive authorization behavior

On current `main`, the middleware no longer depends on a redirect to strip `?token=`:

- [middleware.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/middleware.ts:21) reads `token` from the query string.
- If valid, it forwards the token as `x-archive-token` and also sets the cookie on the same response at [middleware.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/middleware.ts:26) through [middleware.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/middleware.ts:44).
- `requireArchiveAccess()` first reads `x-archive-token`, then falls back to the cookie at [lib/archive-access.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/archive-access.ts:24) through [lib/archive-access.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/archive-access.ts:38).

This means the confirmation-page CTA should work on current `main` even if redirect-set cookies are dropped by an in-app browser, because the first archive request can now authorize from the request header alone.

## Root Cause 1: Old Confirmation-CTA Loop On Mobile/In-App Browsers

This is the exact historical bug that explains the reported loop:

- Before `121c931`, `middleware.ts` redirected `/issues?token=<uuid>` to `/issues` after setting the cookie.
- The previous code path was:
  - middleware saw `?token=...`
  - middleware set `aigw_archive_access`
  - middleware returned `NextResponse.redirect(cleanUrl)`
  - browser followed to `/issues`
  - `requireArchiveAccess()` only checked cookies
  - if the browser discarded cookies from redirect responses, `requireArchiveAccess()` redirected to `/?archive=subscribe`

That is exactly the "tap archive and land back on homepage/landing" loop.

Evidence from the immediate parent of `121c931`:

- old `middleware.ts` redirected to a clean URL after setting the cookie
- old `lib/archive-access.ts` only read cookies, not headers

So if production is still showing the screenshoted confirmation-page behavior, the first thing to verify is whether the deployed site actually includes `121c931` or newer.

## Root Cause 2: Current-Main Issue Email / Browser-View Path Still Breaks

This is the bug I can prove still exists on current `main`.

### Broken route chain

1. Weekly issue HTML includes a `View this issue in your browser` link from [lib/template.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/template.ts:97).
2. That URL is injected during issue generation as a bare issue path, with no subscriber token, at [app/api/cron/generate/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/cron/generate/route.ts:110) through [app/api/cron/generate/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/cron/generate/route.ts:113).
3. The resulting link is `/issues/<slug>`.
4. `/issues/<slug>` goes through [app/issues/layout.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/issues/layout.tsx:9), which requires archive access.
5. The middleware only helps when `?token=` is present, per [middleware.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/middleware.ts:22) through [middleware.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/middleware.ts:45).
6. A fresh mobile/email browser or attachment-preview context that has no existing `aigw_archive_access` cookie therefore reaches `requireArchiveAccess()` with neither header nor cookie, and is redirected to `/?archive=subscribe`.

### Why this matches the reported "welcome email / attachment-related" symptom

- I found no dedicated attachment route in current `main`.
- The only browser-view affordance embedded in outbound issue HTML is the tokenless `View this issue in your browser` link.
- In practice, a user opening an issue from an email client, saved message, or attachment-like preview without a preexisting archive cookie would see exactly the same "back to landing page" result.

## Confidence / Limits

What I can prove from current `main`:

- The issue-email/browser-view path is broken now.
- Current `main` contains a fix specifically intended to solve the confirmation-page mobile/in-app redirect loop.

What I cannot prove from code alone:

- That production is currently running `121c931` or newer.
- That the exact screenshot was taken on the same build as current `main`.

Because the screenshot UI does not exactly match current `main`, there is a real possibility that production is behind the current branch and the reporter is seeing the pre-`121c931` confirmation-flow bug.

## Minimum Clean Fix Scope

### Required

1. Ensure production is deployed on `121c931` or newer.

Reason:

- Without that deploy, the confirmation CTA can still loop on mobile/in-app browsers because the old redirect-based token stripping is fundamentally unreliable there.

2. Stop emitting tokenless browser-view issue links.

Reason:

- `/issues/[slug]` is guarded.
- The current newsletter/browser-view URL is generated without any token.
- That path will keep redirecting fresh browsers to `/?archive=subscribe`.

### Recommended implementation approach

The cleanest fix is to make issue-email/browser-view URLs subscriber-aware and tokenized:

- render issue email HTML per recipient at send time
- generate `viewInBrowserUrl` as `/issues/<slug>?token=<subscriber.unsubscribe_token>`

Why this is the minimum clean fix:

- it reuses the existing archive-access model already used by the welcome email and confirmation flow
- it works with the existing middleware/header guard
- it avoids adding another redirect shim or another special-case access mechanism

## Risks And Follow-Up Checks

1. Current archive access uses `unsubscribe_token` as both unsubscribe credential and archive credential.

Implication:

- Forwarding a tokenized archive URL also forwards unsubscribe capability.
- This is already true in the existing design, but the team should be aware of it before expanding tokenized links further.

2. Internal archive links rely on the cookie after the first tokenized hit.

Example:

- [app/issues/[slug]/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/issues/[slug]/page.tsx:30) links back to bare `/issues`.

Implication:

- Once a tokenized issue URL is opened, the middleware must successfully set the cookie for later in-app navigation.
- Current `main` should be much better here because it authorizes the first request from the header, but this is still worth testing on real mobile email clients.

3. Production verification checklist after the fix

- Confirm deployed production includes `121c931` or newer.
- From a fresh iPhone/Android in-app browser, open a confirmation email and tap `Browse subscriber archive`.
- From a fresh mobile email client, open the weekly issue email and tap `View this issue in your browser`.
- Verify the resulting page is the archive or issue page, not `/?archive=subscribe`.
- Inspect the rendered email HTML to ensure no bare `/issues` or `/issues/<slug>` links are still being emitted where first-touch access is expected.
