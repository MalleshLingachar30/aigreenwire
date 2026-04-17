# Production Flow Verification - 2026-04-17

Environment:
- Target: `https://aigreenwire.com`
- Method: `agent-browser` automation in headed mode (final verification reruns were in a clean headed daemon)
- Required preread used: `gg/agent-outputs/archive-email-redirect-root-cause-report.md`

## Entry Point 1: Post-confirmation `Browse subscriber archive`

Verification setup:
- Created a live production subscription with disposable inbox.
- Production subscribe request observed: `POST https://aigreenwire.com/api/subscribe` -> `200`.
- Used live confirmation URL from received production email:
  - `https://aigreenwire.com/api/confirm?token=88c44c25-89f5-4cd6-a12e-647bfa5c0d1c`

URLs tested and observed behavior:
1. `https://aigreenwire.com/api/confirm?token=88c44c25-89f5-4cd6-a12e-647bfa5c0d1c`
- Observed redirect target: `https://aigreenwire.com/unsubscribe?status=confirmed&token=6f085122-a33d-483b-85a6-5e01ce407b2c`
- Page rendered with `Subscription confirmed` and `Browse subscriber archive` CTA.

2. Clicked `Browse subscriber archive` from the confirmed page above.
- Observed final URL: `https://aigreenwire.com/?archive=subscribe`
- Expected behavior for fixed flow: land on archive/issues route, not subscribe prompt.

3. Direct tokenized archive check:
- Tested `https://aigreenwire.com/issues?token=6f085122-a33d-483b-85a6-5e01ce407b2c`
- Observed final URL: `https://aigreenwire.com/?archive=subscribe`

Result for Entry Point 1: **Still broken on production**.

## Entry Point 2: Issue email / browser-view path

What could be directly validated live:
- I did not have a live weekly issue email message in this session, so I validated the public issue browser-view routes currently exposed on production (same route family used by issue browser-view paths).

URLs tested and observed behavior (fresh sessions):
1. `https://aigreenwire.com/issues/01-india-launches-10372cr-ai-mission-for-farmers`
- Observed final URL: `https://aigreenwire.com/?archive=subscribe`

2. `https://aigreenwire.com/issues/issue-01-the-ai-green-wire-issue-18`
- Observed final URL: `https://aigreenwire.com/?archive=subscribe`

3. `https://aigreenwire.com/issues`
- Observed final URL: `https://aigreenwire.com/?archive=subscribe`

Result for Entry Point 2: **Still broken for fresh browser-view issue routes tested** (redirects to subscribe prompt).

## Evidence

Screenshots:
- `gg/agent-outputs/evidence/prod-confirm-landing-headed.png`
- `gg/agent-outputs/evidence/prod-confirm-archive-result-headed.png`
- `gg/agent-outputs/evidence/prod-issues-token-headed.png`
- `gg/agent-outputs/evidence/prod-issue-email-path-headed.png`
- `gg/agent-outputs/evidence/prod-issue-email-path-headed-2.png`
- `gg/agent-outputs/evidence/prod-issues-index-fresh.png`

Supplementary evidence from earlier runs (same outcomes):
- `gg/agent-outputs/evidence/prod-confirm-landing.png`
- `gg/agent-outputs/evidence/prod-confirm-browse-archive-result.png`
- `gg/agent-outputs/evidence/prod-confirm-direct-issues-token-result.png`
- `gg/agent-outputs/evidence/prod-issue-fresh-mobile.png`
- `gg/agent-outputs/evidence/prod-issue-fresh-2.png`

## Conclusion

Direct production verification outcome: **Still broken on production**.
- Entry path 1 (`Browse subscriber archive` from confirmed flow) redirects back to `/?archive=subscribe`.
- Entry path 2 (fresh issue/browser-view routes tested) also redirects to `/?archive=subscribe`.
