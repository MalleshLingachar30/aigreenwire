# Archive Confirmation Prefetch Race Root Cause

Scope:
- Repo: `aigreenwire/`
- Production alias: `https://aigreenwire.com`
- Live deployment verified on commit `2587d44` on 2026-04-17

## Verdict

The remaining production archive failure is **not best explained by immediate post-confirmation read-after-write lag**.

The immediate failing branch is still the zero-row active-subscriber check in [lib/archive-access.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/archive-access.ts:34), but the zero-row condition is being created by a **competing unsubscribe write triggered by Next.js `Link` prefetch on the confirmation page**, not by the archive read missing the just-confirmed row.

Best classification:
- **Client-side App Router prefetch race**
- Specifically: **a mutating GET unsubscribe route is exposed through `next/link`, and production prefetch executes it before the archive click completes**

It is **not** best explained by:
- read-after-write lag on the confirmation update
- eventual consistency via a read replica
- stale connection behavior
- transaction visibility on a reused session
- application caching

## Exact Code Path

### 1. Confirmation write

The confirmation handler reads by `confirm_token`, then updates the subscriber row:

- [app/api/confirm/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/confirm/route.ts:48) selects the subscriber
- [app/api/confirm/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/confirm/route.ts:73) updates:
  - `confirmed_at = COALESCE(confirmed_at, NOW())`
  - `unsubscribed_at = NULL`
  - `unsubscribe_token = COALESCE(unsubscribe_token, gen_random_uuid())`
- [app/api/confirm/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/confirm/route.ts:104) redirects to `/unsubscribe?status=confirmed&token=<unsubscribe_token>` and sets the archive cookie

### 2. Confirmation page renders two token-bearing links

The unsubscribe page builds both:

- archive CTA: [app/unsubscribe/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/unsubscribe/page.tsx:61)
- unsubscribe CTA: [app/unsubscribe/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/unsubscribe/page.tsx:58)

Both are rendered as `next/link`:

- archive `Link`: [app/unsubscribe/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/unsubscribe/page.tsx:72)
- unsubscribe `Link`: [app/unsubscribe/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/unsubscribe/page.tsx:92)

### 3. Archive gate

Archive entry pages pass the query token straight into the guard:

- index page: [app/issues/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/issues/page.tsx:24)
- issue page: [app/issues/[slug]/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/issues/[slug]/page.tsx:16)

The guard then runs the active-subscriber check:

- token resolution: [lib/archive-access.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/archive-access.ts:17)
- zero-row branch: [lib/archive-access.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/archive-access.ts:34)

That query only authorizes rows where:

- `unsubscribe_token = <token>`
- `confirmed_at IS NOT NULL`
- `unsubscribed_at IS NULL`

## Runtime Evidence

## 1. Direct document request with the same live token succeeded before the browser confirmation flow

Using the same production archive token from the earlier verification artifacts:

- `GET /issues?token=6f085122-a33d-483b-85a6-5e01ce407b2c` returned `200`
- `GET /issues/01-india-launches-10372cr-ai-mission-for-farmers?token=6f085122-a33d-483b-85a6-5e01ce407b2c` returned `200`

This was on the same live `2587d44` deployment.

That alone weakens the read-after-write-lag theory: the tokenized archive path is not fundamentally broken on production.

## 2. The confirmation-page browser flow still failed

In a fresh headed browser session:

1. Opened:
   - `https://aigreenwire.com/api/confirm?token=88c44c25-89f5-4cd6-a12e-647bfa5c0d1c`
2. Landed on:
   - `https://aigreenwire.com/unsubscribe?status=confirmed&token=6f085122-a33d-483b-85a6-5e01ce407b2c`
3. Clicked `Browse subscriber archive`
4. Final URL became:
   - `https://aigreenwire.com/?archive=subscribe`

So the browser-confirmation path still reproduces the reported failure.

## 3. The browser trace shows why it fails

From the live `agent-browser` network trace:

### Healthy archive prefetch happened first

Request `61822.19`:

- URL:
  - `/issues?token=6f085122-a33d-483b-85a6-5e01ce407b2c&_rsc=o8g3y`
- Request headers included:
  - `next-router-prefetch: 1`
  - `next-url: /unsubscribe`
- Response body resolved to the `issues` route tree with the token payload, not to `/?archive=subscribe`

This is the key point: the App Router was able to prefetch the tokenized archive route successfully from the confirmation page. That does **not** match a confirm-write visibility problem.

### Then the unsubscribe link was prefetched

Request `61822.21`:

- URL:
  - `/api/unsubscribe?token=6f085122-a33d-483b-85a6-5e01ce407b2c&_rsc=o8g3y`
- Request headers included:
  - `next-router-prefetch: 1`
  - `next-url: /unsubscribe`
- Response body resolved to:
  - `__PAGE__?{"status":"unsubscribed"}`

That request maps directly to [app/api/unsubscribe/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/unsubscribe/route.ts:26), whose GET handler performs a real write at [app/api/unsubscribe/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/unsubscribe/route.ts:54):

- `UPDATE subscribers`
- `SET unsubscribed_at = NOW()`

So the confirmation page is exposing a mutating GET route via `next/link`, and production prefetch is executing it.

### After that competing write, the archive click fails exactly as the code says it should

After the unsubscribe prefetch fired:

- the archive click issued a new RSC request for `/issues?token=...`
- the next RSC payload resolved to `/?archive=subscribe`

That is exactly what [lib/archive-access.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/archive-access.ts:43) does when the token no longer matches an active subscriber because `unsubscribed_at IS NULL` is false.

## 4. The same token flipped from success to failure after the confirmation-page browser flow

Immediately after the browser reproduction above, the exact same direct document request that had previously returned `200` changed to:

- `GET /issues?token=6f085122-a33d-483b-85a6-5e01ce407b2c` -> `307`
- `Location: /?archive=subscribe`

That behavior is far better explained by a competing unsubscribe mutation than by delayed visibility of the confirmation write.

## Why The Read-Consistency Theory Is The Wrong Primary Explanation

The proposed theory was:

- confirmation writes succeed
- immediate archive read runs too quickly
- archive read sees zero active rows because the confirmed state is not visible yet
- same token succeeds later once confirmation state becomes visible

The live evidence above contradicts that as the primary cause:

1. The archive route itself accepted the token on a prefetched RSC request from the confirmation page before the failure.
2. The failure sequence includes a concrete competing write:
   - `/api/unsubscribe?token=...`
   - with `next-router-prefetch: 1`
   - returning an `unsubscribed` payload
3. The same token changed from direct-request `200` to direct-request `307` after the browser confirmation flow, which is exactly what you would expect if `unsubscribed_at` was written.

So the zero-row branch is real, but it is **not** because the archive read cannot see `confirmed_at` yet.

It is because the subscriber has already been moved out of the active set by the prefetched unsubscribe handler.

## Why Eventual Consistency / Stale Connection / Caching Also Do Not Fit

### Same DB helper for both write and read

Both the confirmation handler and the archive guard use the same shared SQL client:

- [app/api/confirm/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/confirm/route.ts:48)
- [app/api/unsubscribe/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/unsubscribe/route.ts:34)
- [lib/archive-access.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/archive-access.ts:34)
- [lib/db.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/db.ts:7)

`lib/db.ts` explicitly uses Neon's stateless serverless HTTP driver, where each `sql`` call is its own fetch:

- [lib/db.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/db.ts:3)

That makes stale session state / stale persistent connection explanations weak.

### Not a read replica path

The app only uses `process.env.DATABASE_URL` via [lib/db.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/db.ts:7).

Official Neon docs say:

- pooled connections are for concurrency, not a different consistency model:
  - https://neon.tech/docs/get-started-with-neon/connect-neon
- read replicas are separately selected computes, and write operations are not permitted on read-replica connections:
  - https://neon.tech/docs/guides/read-replica-guide

Because the same `sql` helper successfully executes the confirmation `UPDATE`, this path is not using a read-replica-only connection.

### Not application caching

The archive pages are dynamic server-rendered routes:

- [app/issues/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/issues/page.tsx:8)
- [app/issues/[slug]/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/issues/[slug]/page.tsx:8)

I also found no `cache()`, `unstable_cache`, `revalidate`, or `force-static` usage affecting this path in the repo.

### Next `Link` prefetch exactly matches the runtime trace

Official Next docs state:

- `<Link>` provides client-side navigation and prefetching:
  - https://nextjs.org/docs/app/api-reference/components/link
- prefetch runs automatically in production for links in the viewport:
  - https://nextjs.org/docs/app/guides/prefetching

That matches the observed `next-router-prefetch: 1` requests from the confirmation page.

## Exact Failing Path

The most likely exact failing production path is:

1. User opens `/api/confirm?token=<confirm_token>`
2. [app/api/confirm/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/confirm/route.ts:73) confirms the subscriber and redirects to `/unsubscribe?status=confirmed&token=<unsubscribe_token>`
3. The confirmation page renders both:
   - archive `Link` to `/issues?token=<unsubscribe_token>`
   - unsubscribe `Link` to `/api/unsubscribe?token=<unsubscribe_token>`
4. In production, Next automatically prefetched both visible links
5. The unsubscribe prefetch hit [app/api/unsubscribe/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/unsubscribe/route.ts:26) and set `unsubscribed_at = NOW()`
6. The user then clicks archive
7. [app/issues/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/issues/page.tsx:29) calls [lib/archive-access.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/archive-access.ts:25)
8. The guard query returns zero rows because the subscriber is now unsubscribed
9. The guard redirects to `/?archive=subscribe`
10. Middleware still sets the cookie on the failing response because the token is still syntactically valid

## Minimum Clean Remediation Scope

Minimum clean fix:

1. Stop exposing the mutating unsubscribe route through `next/link` on the confirmation/settings page.
   - [app/unsubscribe/page.tsx](/Users/mallesh/code/AIgreenwire/aigreenwire/app/unsubscribe/page.tsx:92)

Cleanest implementation:

- render the unsubscribe control as a plain `<a>` or a form/button flow instead of `Link`
- do not allow App Router prefetch or soft-navigation to a mutating route

I would treat this as the hard cutover:

- **no mutating GET route should be rendered via `next/link`**

Optional belt-and-suspenders follow-up:

- disable prefetch on other token-bearing management links if the team wants to guarantee full-document navigations for those flows

But the **minimum** remediation surface is the unsubscribe control on the confirmation/settings page, because that is the competing write that is invalidating the archive check.

## Bottom Line

The archive guard's zero-row branch is real, but the row is disappearing because the confirmation page is unsubscribing the user via prefetched `GET /api/unsubscribe?token=...`.

So the remaining production bug is best explained by:

- **Next.js `Link` prefetch + mutating GET unsubscribe route**

Not by:

- **post-confirmation read consistency lag**
