# AI Greenwire Stages 2-8 Rollout Plan

## State of Current System

- Stage 1 is treated as already completed or out of scope for this continuation, based on the user's request to continue from Stage 2.
- The target app should advance in controlled stages from deployable blank shell, to backend service wrappers, to email rendering, to public landing page, to subscription flow, to weekly generation, and finally to public issue archives.
- Real secret values must never be committed. Any setup that needs secrets must pause for manual secret entry or use secure CLI input from the user.
- Each stage has a concrete acceptance gate. Do not begin the next stage until the previous stage's gate is met or the lead explicitly allows parallel work.

## State of Ideal System

- `aigreenwire.com` deploys from the repo to Vercel.
- Vercel has the required non-secret configuration and secret environment variables for Supabase, Resend, Claude, cron authorization, and app URLs.
- The app has a reviewed landing page, working double opt-in subscription flow, weekly generation and approval endpoints, tested backend wrappers, a verified Template B email renderer, and public archive pages.
- The rollout preserves clean boundaries: config first, utilities second, rendering before live content, landing page before subscription API, subscription before weekly generation, and archive only after approved issues exist.

## Cross-provider requirements

- Vercel:
  - The project must be linked to the correct GitHub repo and production domain.
  - `vercel.json` must configure the cron schedule for the weekly generation endpoint.
  - Environment variables must be present in the right Vercel environments before production deployment.
  - Production deployment must be verified after each user-facing stage.
- Supabase:
  - The Supabase URL and service credentials must be provided securely.
  - Utility tests should verify a real connection without mutating production data unless explicitly designed as a harmless ping.
- Resend:
  - The API key and sender/domain configuration must be present securely.
  - Sandbox or controlled test sends should go only to approved test recipients.
- Claude:
  - The Anthropic API key must be provided securely.
  - Smoke tests should use a minimal hello-world request to control cost and risk.
- Email and unsubscribe compliance:
  - Subscription, confirmation, and unsubscribe flows must use production URLs that match the deployed domain.
  - Test sends must not accidentally go to the full subscriber list before Stage 7 approval.

## Plan Phases

### Stage 2 - Config and Blank Vercel Deploy

#### Files to read before starting

- `.env.example`
- `package.json`
- `vercel.json`
- Any existing Vercel project metadata, if present locally

#### What to do

- Copy or reconcile `.env.example`, `package.json`, and `vercel.json` into the target app.
- Keep a hard cutover: remove obsolete config paths rather than keeping duplicate build or deployment modes.
- Confirm `.env.example` lists every required variable without secret values.
- Configure the Vercel cron schedule in `vercel.json`.
- Set up Vercel project linkage if it is not already linked.
- Prepare Vercel environment variable setup, but never commit or expose real secret values. If real values are required, pause for manual entry from the user.
- Ensure the app builds and deploys to Vercel with a blank landing page.

#### Validation strategy

- Run the project install/build checks that match `package.json`.
- Confirm `vercel.json` is valid.
- Confirm the Vercel production deployment succeeds.
- Visit `aigreenwire.com` and verify it loads a blank landing page without runtime errors.

#### Risks / fallbacks

- If real secrets are needed for build-time validation, pause and request manual secret entry.
- If Vercel CLI auth or project ownership is blocked, report the exact command and blocker to the lead.
- If package versions have shifted, check current package documentation before changing APIs.

### Stage 3 - Backend Service Wrappers

#### Files to read before starting

- `lib/supabase.ts`
- `lib/resend.ts`
- `lib/claude.ts`
- `.env.example`
- `package.json`

#### What to do

- Copy the three backend utility wrappers into `lib/`.
- Verify imports resolve under the app's TypeScript configuration.
- Add small isolated tests or scripts that prove each wrapper can reach its external service:
  - Supabase ping
  - Resend sandbox send or approved test send
  - Claude minimal hello-world request
- Keep test utilities out of user-facing routes unless the lead explicitly approves temporary diagnostic endpoints.

#### Validation strategy

- Run typecheck or build.
- Run the wrapper smoke tests with real environment variables available locally or in a secure environment.
- Confirm no secrets are logged.

#### Risks / fallbacks

- External services may reject requests because domains, sender identities, or API keys are not configured yet.
- If a test cannot safely run against production services, document the exact missing provider setup and stop before making live changes.

### Stage 4 - Template B Renderer

#### Files to read before starting

- `lib/template.ts`
- Existing `lib/` utilities
- App routing structure under `app/`

#### What to do

- Copy the Template B renderer into `lib/template.ts`.
- Add a small test route that renders a hardcoded sample `IssueData` object.
- Use the route path `/test-render`.
- Make the sample look like a finished Issue 01 before any live content flows through.
- Keep this route isolated from production sending logic.

#### Validation strategy

- Run typecheck or build.
- Visit `https://aigreenwire.com/test-render` after deployment.
- Confirm the browser shows a finished-looking Issue 01 rendered from Template B.
- Check the rendered HTML for broken images, missing fields, and obvious layout regressions.

#### Risks / fallbacks

- Email HTML may render differently in browsers than inboxes. Browser validation is only the first gate.
- If the renderer depends on data fields not yet modeled, define the sample object explicitly rather than loosening types.

### Stage 5 - Landing Page

#### Files to read before starting

- `app/page.tsx`
- `app/layout.tsx`
- Existing route and styling setup
- `.env.example`

#### What to do

- Copy the landing page and layout into the target app.
- Review user-facing copy for tone before deploying.
- Wire the subscription form to POST to `/api/subscribe`.
- Because `/api/subscribe` does not exist yet, make the failed POST degrade gracefully without exposing debug details to users.
- Deploy the real landing page to `aigreenwire.com`.

#### Validation strategy

- Run typecheck or build.
- Test the landing page on desktop and mobile widths.
- Submit the subscription form and confirm the missing API fails gracefully.
- Visit `aigreenwire.com` in production and verify it shows the real landing page.

#### Risks / fallbacks

- The page may depend on components or styles that were not copied yet. Bring only the required dependencies, avoiding broad unrelated UI migrations.
- The form must not claim the user is subscribed before Stage 6 exists.

### Stage 6 - Subscription API

#### Files to read before starting

- `app/api/subscribe`
- `app/api/confirm`
- `app/api/unsubscribe`
- `lib/supabase.ts`
- `lib/resend.ts`
- `.env.example`

#### What to do

- Copy the subscribe, confirm, and unsubscribe API flows into the app.
- Wire them to the landing page form and provider utilities.
- Ensure the flow implements double opt-in:
  - user submits email
  - confirmation email is sent
  - user confirms
  - user can unsubscribe
- Use production URLs that match `aigreenwire.com`.
- Keep all tokens and secrets out of logs.

#### Validation strategy

- Run typecheck or build.
- Subscribe with the user's own test email.
- Confirm via the delivered email.
- Unsubscribe via the delivered or generated unsubscribe link.
- Verify the Supabase subscriber state after each step.

#### Risks / fallbacks

- Email deliverability depends on Resend domain/sender setup.
- Confirmation URLs must use the deployed domain, not localhost, for production testing.
- Avoid sending test messages to any imported or future real audience list.

### Stage 7 - Weekly Generation and Approval Pipeline

#### Files to read before starting

- `app/api/cron/generate`
- `app/api/admin/approve`
- `lib/supabase.ts`
- `lib/resend.ts`
- `lib/claude.ts`
- `lib/template.ts`
- `vercel.json`
- `.env.example`

#### What to do

- Copy the weekly generation endpoint and admin approval endpoint into the app.
- Protect manual cron triggering with `CRON_SECRET`.
- Confirm Vercel cron points at the generation route.
- Trigger one generation manually using the cron secret.
- Confirm the Monday preview email lands in the user's inbox.
- Approve the generated issue to send only to the user's test address.
- Do not enable or test broad subscriber sends yet.

#### Validation strategy

- Run typecheck or build.
- Trigger the generation endpoint manually with `CRON_SECRET`.
- Verify one generated issue record exists.
- Verify preview email delivery.
- Approve the issue and confirm the approved send reaches only the test recipient.

#### Risks / fallbacks

- Claude output can vary. Keep approval human-gated.
- Cron security must fail closed when the secret is missing or wrong.
- Resend audience targeting must be checked before any real subscriber sends.

### Stage 8 - Public Issue Archive

#### Files to read before starting

- `app/issues`
- `lib/supabase.ts`
- Existing issue data schema or records produced by Stage 7
- `app/layout.tsx`

#### What to do

- Copy the archive pages into the app.
- Ensure approved issues are publicly visible at `/issues/[slug]`.
- Link archive pages to the issue records generated and approved in Stage 7.
- Keep unpublished or draft issues inaccessible.

#### Validation strategy

- Run typecheck or build.
- After Stage 7 approval, visit `https://aigreenwire.com/issues/[slug]` for Issue 01.
- Confirm the public archive matches the approved issue content and does not expose preview-only data.

#### Risks / fallbacks

- Archive pages depend on Stage 7 data existing. Do not validate with fake production data unless clearly marked and later removed.
- Slug generation must be stable so approved email links and public archive URLs stay aligned.
