# Cron/Admin Standard Contract Research

Investigated the live app in `/Users/mallesh/code/AIgreenwire/aigreenwire` on branch `main`.

## Current live flow

1. Vercel schedules `GET /api/cron/generate` from [vercel.json](/Users/mallesh/code/AIgreenwire/aigreenwire/vercel.json:6).
2. `/api/cron/generate` authorizes with `CRON_SECRET` via bearer auth, `x-cron-secret`, or `?secret=` in [lib/api-auth.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/api-auth.ts:22).
3. The cron route generates an issue, inserts a `draft` row into `issues`, stores `stories_json`, stores `html_rendered`, and tags metadata with the generation model in [app/api/cron/generate/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/cron/generate/route.ts:97).
4. The stored preview HTML is rendered with a fake preview unsubscribe URL (`/unsubscribe?token=preview-only&status=preview`) instead of a real subscriber token in [app/api/cron/generate/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/cron/generate/route.ts:98).
5. The preview email goes to `EDITOR_EMAIL` and contains:
   - no `/api/admin/preview` link
   - a `curl -X POST` example for `/api/admin/approve`
   - `Authorization: Bearer <ADMIN_SECRET>`
   - a JSON body with `{"issueId":"..."}`  
   See [app/api/cron/generate/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/cron/generate/route.ts:184).
6. The preview email also embeds the full draft HTML inline and stores `preview_email_id` into `issues.metadata` in [app/api/cron/generate/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/cron/generate/route.ts:214).
7. `/api/admin/approve` is `POST`-only today in [app/api/admin/approve/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/approve/route.ts:136).
8. `/api/admin/approve` authorizes with `ADMIN_SECRET` via bearer auth, `x-admin-secret`, or `?secret=` in [lib/api-auth.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/api-auth.ts:35).
9. The approve route accepts a JSON payload with `issueId`, `slug`, and optional `sendTo` in [app/api/admin/approve/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/approve/route.ts:10).
10. The approve route defaults `sendTo` to `EDITOR_EMAIL`, rejects any other recipient, and explicitly labels the flow as `send-to-self only` in [app/api/admin/approve/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/approve/route.ts:195).
11. Approval also requires `EDITOR_EMAIL` to exist as an active confirmed subscriber so the code can fetch that subscriber's `unsubscribe_token` in [app/api/admin/approve/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/approve/route.ts:119).
12. The sent email is not built from `issues.html_rendered`. Approval reparses `stories_json` and renders a subscriber-specific email with tokenized archive/unsubscribe links using [lib/issue-email.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/issue-email.ts:10) and [app/api/admin/approve/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/approve/route.ts:256).
13. Approval sends exactly one email, updates the issue to `sent`, inserts one `send_log` row without `subscriber_id`, and then best-effort generates WhatsApp cards in [app/api/admin/approve/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/approve/route.ts:264).
14. There is no `/api/admin/preview` route at all. The only files under `app/api/admin` are [app/api/admin/approve/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/approve/route.ts:1) and [app/api/admin/issues/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/issues/route.ts:1).

## Contract mismatches vs requested standard

### Auth/env contract

- Current admin auth env is `ADMIN_SECRET`, not `ADMIN_PASSWORD`, in [lib/api-auth.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/api-auth.ts:17).
- `EDITOR_EMAIL` already matches the requested standard in [app/api/cron/generate/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/cron/generate/route.ts:36) and [app/api/admin/approve/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/approve/route.ts:55).
- URL building currently uses `NEXT_PUBLIC_APP_URL`, not `NEXT_PUBLIC_SITE_URL`, in [lib/subscription.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/subscription.ts:32).
- The email template footer separately reads `NEXT_PUBLIC_SITE_URL`, so the app already has a split site-url contract in [lib/template.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/template.ts:6).

### Route contract

- Current preview contract: none. There is no `/api/admin/preview`.
- Requested preview contract: `GET /api/admin/preview?id=...&password=...`
- Current approve contract: `POST /api/admin/approve` with auth in header or `?secret=`, and JSON body `{ issueId }` or `{ slug, sendTo }`
- Requested approve contract: `GET /api/admin/approve?id=...&password=...`

### Data-selection contract

- Current approve route accepts `issueId`, `slug`, or no selector at all, in which case it grabs the latest `draft` in [app/api/admin/approve/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/approve/route.ts:63).
- Requested standard contract only names `id`, not `slug`, `sendTo`, or "latest draft" fallback.

## Minimum exact file list the implementation branch must touch

1. [app/api/cron/generate/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/cron/generate/route.ts:1)
   Reason: this is where the preview email contract is emitted today; it must stop emitting the `curl` + `ADMIN_SECRET` + JSON `POST` instructions and instead emit the standard preview/approve URLs.
2. [app/api/admin/approve/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/approve/route.ts:1)
   Reason: method, input shape, auth shape, and likely approval semantics all change here.
3. [app/api/admin/preview/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/preview/route.ts:1)
   Reason: this route does not exist and must be added for the standard contract.
4. [lib/api-auth.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/api-auth.ts:1)
   Reason: admin auth is currently keyed off `ADMIN_SECRET` and `secret`/header/bearer conventions; the standard contract is `ADMIN_PASSWORD` via `password`.
5. [lib/subscription.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/subscription.ts:1)
   Reason: all generated absolute URLs currently come from `NEXT_PUBLIC_APP_URL`; the standard contract wants `NEXT_PUBLIC_SITE_URL`.

## Routes indirectly affected by the auth cutover

These routes already rely on `isAdminRequestAuthorized`, so their runtime contract changes if `lib/api-auth.ts` is cut over, even if the implementation does not edit these files:

- [app/api/admin/issues/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/issues/route.ts:31)
- [app/api/cards/generate/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/cards/generate/route.ts:67)
- [app/api/cards/gallery/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/cards/gallery/route.ts:34)

If the cutover removes `ADMIN_SECRET`/header auth entirely, any manual caller for those routes must move to the new `?password=` convention or they will start returning `401`.

## Hidden behavior changes to call out

### 1. GET approve is not just a method rename

- Today approval is `POST` with a JSON body in [app/api/admin/approve/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/approve/route.ts:144).
- The standard contract turns approval into a clickable `GET` URL.
- That changes operator ergonomics, cache/log exposure, and replay risk because the admin credential moves into the query string instead of a header.

### 2. Current approval is explicitly send-to-self only

- The route rejects any `sendTo` that does not equal `EDITOR_EMAIL` in [app/api/admin/approve/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/approve/route.ts:206).
- Resend tags label the action as `approved-send-self` in [app/api/admin/approve/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/approve/route.ts:264).
- The JSON response reports `mode: "send-to-self"` in [app/api/admin/approve/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/approve/route.ts:319).
- A standard `approve?id=...&password=...` link removes the current public contract for `sendTo`. If the intended standard behavior is "go live to subscribers", this is a larger behavior change than the current route shape suggests.

### 3. Current approval depends on the editor being a confirmed subscriber

- Approval fails unless `EDITOR_EMAIL` has a live subscriber row with `confirmed_at IS NOT NULL` and `unsubscribed_at IS NULL` in [app/api/admin/approve/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/approve/route.ts:119).
- That dependency exists only because the current approve flow sends a subscriber-tokenized email to the editor.
- A pure preview route does not need that lookup.
- A real production send would need to fan out over `active_subscribers`, which already exists in [neon/schema.sql](/Users/mallesh/code/AIgreenwire/aigreenwire/neon/schema.sql:101).

### 4. Current DB/email plumbing is single-recipient, not blast-oriented

- `send_log` already has `subscriber_id`, but the current approve route does not populate it; it inserts only `issue_id`, `email`, `resend_id`, and `status` in [app/api/admin/approve/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/approve/route.ts:286).
- `sent_count` is forced to at least `1`, not set to actual recipient count, in [app/api/admin/approve/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/approve/route.ts:275).
- The codebase already has a `batchSendEmails` helper available in [lib/resend.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/resend.ts:39), but the live approve route does not use it.

### 5. Preview and sent HTML are generated differently

- The draft preview stored in `issues.html_rendered` uses the fake preview unsubscribe URL in [app/api/cron/generate/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/cron/generate/route.ts:98).
- The sent email is rebuilt from `stories_json` using tokenized subscriber links in [lib/issue-email.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/lib/issue-email.ts:24).
- That means a new `/api/admin/preview` route can probably reuse `issues.html_rendered` directly without any schema change, but approval still needs the subscriber-aware rendering path if it continues sending real issue emails.

### 6. WhatsApp card generation is currently an approval side effect

- Approval triggers `generateTranslatedCards` and `upsertWhatsAppCards` after the email send in [app/api/admin/approve/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/approve/route.ts:291).
- Card failures are swallowed into the response payload and do not fail approval in [app/api/admin/approve/route.ts](/Users/mallesh/code/AIgreenwire/aigreenwire/app/api/admin/approve/route.ts:298).
- If the standard contract moves approval into a browser GET flow, this side effect still happens unless it is intentionally moved elsewhere.

### 7. The schema already supports the migration; no schema change appears required

- `issues.html_rendered` already stores preview HTML in [neon/schema.sql](/Users/mallesh/code/AIgreenwire/aigreenwire/neon/schema.sql:34).
- `send_log.subscriber_id` already exists in [neon/schema.sql](/Users/mallesh/code/AIgreenwire/aigreenwire/neon/schema.sql:61).
- `active_subscribers` already exists in [neon/schema.sql](/Users/mallesh/code/AIgreenwire/aigreenwire/neon/schema.sql:101).
- The schema even includes `approved` as a valid issue status in [neon/schema.sql](/Users/mallesh/code/AIgreenwire/aigreenwire/neon/schema.sql:43), but the live approve route never uses that status.

## Bottom line

The hard contract mismatches are concentrated in the cron email builder, admin approve handler, shared admin auth helper, and shared absolute-url helper, plus the missing admin preview route.

The important non-obvious part is that the live approval flow is not a generic "publish issue" action today. It is a single-recipient, tokenized, send-to-self delivery path that depends on `EDITOR_EMAIL` being a confirmed subscriber and rebuilds the final HTML from `stories_json`. Any standard-contract migration that turns approval into a one-click `GET` URL should treat that behavior change explicitly instead of assuming it is only an auth/method refactor.
