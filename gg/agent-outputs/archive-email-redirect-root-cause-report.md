# Archive Redirect Root Cause Report

Scope:
- Repo: `aigreenwire/`
- Branch: `main`
- Production commit under investigation: `2587d44`
- Date: `2026-04-17`

Question:
- Confirm or reject the stronger hypothesis that the confirmation page is rendering a mutating `/api/unsubscribe?token=...` route via `next/link`, production prefetch executes it, `unsubscribed_at` flips, and the later archive request fails through the zero-row branch in `lib/archive-access.ts`.

## Verdict

Confirmed.

The exact failing production source path is:
1. `/api/confirm?token=<confirm_token>` redirects to `/unsubscribe?status=confirmed|already-confirmed&token=<unsubscribe_token>` and sets the archive cookie.
2. That `/unsubscribe` page renders a visible `next/link` to the mutating route `/api/unsubscribe?token=<unsubscribe_token>`.
3. In production, App Router prefetch can execute that GET route.
4. `app/api/unsubscribe/route.ts` mutates the subscriber row by setting `unsubscribed_at = NOW()`.
5. The later archive request to `/issues?token=<unsubscribe_token>` reaches `requireArchiveAccess(queryToken)` with a valid token, but the database check returns zero rows because `unsubscribed_at` is no longer null.
6. The redirect that actually explains the observed production behavior is therefore the **zero-row branch** in `lib/archive-access.ts`, not the missing-token branch.

## Exact Call Chain In Source

### 1. Confirmation route produces the archive token and lands on the confirmed page

Entry:
- `/api/confirm?token=<confirm_token>`

Execution order:
1. [app/api/confirm/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/confirm/route.ts:40) reads `request.nextUrl.searchParams.get("token")`.
2. It looks up the subscriber by `confirm_token`:
   - [app/api/confirm/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/confirm/route.ts:48)
3. It builds a redirect to `/unsubscribe?status=...&token=<unsubscribe_token>`:
   - [app/api/confirm/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/confirm/route.ts:20)
   - [app/api/confirm/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/confirm/route.ts:24)
   - [app/api/confirm/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/confirm/route.ts:27)
4. It sets the archive cookie on that redirect response:
   - [app/api/confirm/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/confirm/route.ts:31)
   - [app/api/confirm/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/confirm/route.ts:33)
5. It returns either the `already-confirmed` redirect or the `confirmed` redirect:
   - [app/api/confirm/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/confirm/route.ts:66)
   - [app/api/confirm/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/confirm/route.ts:104)

### 2. The confirmed page renders a mutating unsubscribe route via `next/link`

Entry:
- `/unsubscribe?status=confirmed|already-confirmed&token=<unsubscribe_token>`

Execution order:
1. [app/unsubscribe/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/unsubscribe/page.tsx:54) resolves `searchParams`.
2. It computes `unsubscribeHref` as `/api/unsubscribe?token=<unsubscribe_token>`:
   - [app/unsubscribe/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/unsubscribe/page.tsx:58)
3. For `confirmed` and `already-confirmed` status, it renders the footer link with `next/link`:
   - [app/unsubscribe/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/unsubscribe/page.tsx:90)
   - [app/unsubscribe/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/unsubscribe/page.tsx:92)

Important:
- This is not a harmless read-only URL.
- It is a mutating GET route handler.

### 3. The prefetched GET route mutates the subscriber row

Entry:
- `/api/unsubscribe?token=<unsubscribe_token>`

Execution order:
1. [app/api/unsubscribe/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/unsubscribe/route.ts:26) runs on GET.
2. It reads `request.nextUrl.searchParams.get("token")`:
   - [app/api/unsubscribe/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/unsubscribe/route.ts:27)
3. It validates the UUID token:
   - [app/api/unsubscribe/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/unsubscribe/route.ts:29)
4. It looks up the subscriber by `unsubscribe_token`:
   - [app/api/unsubscribe/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/unsubscribe/route.ts:34)
5. If the row exists and is not yet unsubscribed, it mutates production state:
   - `UPDATE subscribers SET unsubscribed_at = NOW() WHERE id = ${subscriber.id}`
   - [app/api/unsubscribe/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/unsubscribe/route.ts:54)
6. It redirects back to `/unsubscribe?status=unsubscribed` and clears the archive cookie:
   - [app/api/unsubscribe/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/unsubscribe/route.ts:60)
   - [app/api/unsubscribe/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/unsubscribe/route.ts:19)

This is the mutating step that poisons the later archive attempt.

## Exact Archive Failure Path After The Mutation

Entry:
- `/issues?token=<same unsubscribe_token>`
- This same failure also explains the confirmation CTA path, because that CTA targets `/issues?token=<unsubscribe_token>`:
  - [app/unsubscribe/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/unsubscribe/page.tsx:61)
  - [app/unsubscribe/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/unsubscribe/page.tsx:72)

Execution order:
1. [middleware.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/middleware.ts:15) matches `/issues`.
2. It sees the valid `?token=` and sets the `aigw_archive_access` cookie on the response:
   - [middleware.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/middleware.ts:21)
3. App Router continues through:
   - [app/layout.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/layout.tsx:10)
   - [app/issues/layout.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/issues/layout.tsx:3)
   - [app/issues/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/issues/page.tsx:24)
4. `IssuesPage()` reads `searchParams.token` and calls:
   - `requireArchiveAccess(queryToken ?? null)`
   - [app/issues/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/issues/page.tsx:29)
5. `requireArchiveAccess()` resolves the token:
   - [lib/archive-access.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/archive-access.ts:25)
   - [lib/archive-access.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/archive-access.ts:17)
   - [lib/archive-token.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/archive-token.ts:3)
6. The token is valid, so this is **not** the missing-token redirect path.
7. `requireArchiveAccess()` then checks the subscriber row with:
   - `WHERE unsubscribe_token = ${archiveAccessToken}`
   - `AND confirmed_at IS NOT NULL`
   - `AND unsubscribed_at IS NULL`
   - [lib/archive-access.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/archive-access.ts:34)
8. Because step 3 already set `unsubscribed_at = NOW()`, this query returns zero rows.
9. The actual redirect that explains production behavior is:
   - `redirect("/?archive=subscribe")`
   - [lib/archive-access.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/archive-access.ts:43)

That is the exact failing branch.

## Evidence That The Mutation Really Happened

Read-only checks performed during this investigation:

1. The confirmed-page footer does render the mutating route as `next/link`.
- Source confirmed at:
  - [app/unsubscribe/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/unsubscribe/page.tsx:90)

2. The GET unsubscribe route really does mutate on first hit.
- Source confirmed at:
  - [app/api/unsubscribe/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/unsubscribe/route.ts:54)

3. The live production token from the earlier verification artifact now has `unsubscribed_at` set in the database.
- I re-queried the row read-only using the archive token from `gg/agent-outputs/production-archive-postship-verification-2587d44-2026-04-17.md`.
- Result:
  - `confirmed_at` is non-null
  - `unsubscribed_at` is now non-null

4. Production now returns the archive redirect for that same token.
- `curl` to `https://aigreenwire.com/issues?token=<same live token>` now returns:
  - HTTP `307`
  - `location: /?archive=subscribe`

Those facts line up exactly with the zero-row branch in `lib/archive-access.ts`.

## Why This Is Stronger Than The Earlier Route-Cache Theory

The earlier theory required a framework-level cache inference.

This path does not.

It is fully explained by current source:
- a visible `next/link`
- pointing at a mutating GET route
- whose handler updates `unsubscribed_at`
- followed by archive authorization code that explicitly rejects unsubscribed rows

That is a much tighter and more direct explanation of the observed production behavior.

## Minimum Clean Remediation Scope

Minimum clean remediation:

1. Stop rendering `/api/unsubscribe?token=...` with `next/link` on the confirmed page.
- Use a plain `<a>` only if you truly want browser-default navigation semantics and no prefetch.
- Better: make unsubscribe a POST-backed action instead of a mutating GET route.

2. Do not expose mutating routes behind prefetched App Router links.
- The current confirmed-page footer violates that rule directly.

3. Keep the archive guard unchanged for this specific bug.
- `lib/archive-access.ts` is behaving correctly once `unsubscribed_at` has been flipped.
- The bug is upstream: the subscriber is being unsubscribed before the archive click.

## Exact Discrepancy From The Earlier Model

The earlier model assumed the archive redirect was being reused from a cached tokenless `/issues` result.

The stronger, source-proven discrepancy is:
- the subscriber is already unsubscribed by the time `/issues?token=...` is requested,
- so the redirect is produced by the **row-exists-but-is-now-unsubscribed** path,
- not by any missing-token or prefetch-cache mismatch.
