# Production Post-Ship Verification - Archive First-Hit Auth

Date:
- 2026-04-17

Target:
- `https://aigreenwire.com`

Verifier mode:
- `agent-browser` in headed mode (fresh isolated sessions per flow)

## Deployment Provenance Check (Required Before Behavior Testing)

Status: **Confirmed live deployment includes commit `2587d44`**.

Evidence:
1. `vercel inspect https://aigreenwire.com` resolved alias to deployment:
- `dpl_3ktrpGig3Ba1X5Vx6yDscdeb3gJq`
- created `2026-04-17 17:19:58 IST`

2. `vercel inspect dpl_3ktrpGig3Ba1X5Vx6yDscdeb3gJq --logs` contains:
- `Cloning github.com/MalleshLingachar30/aigreenwire (Branch: main, Commit: 2587d44)`

Conclusion:
- Production alias is not stale; it is serving the deployment built from commit `2587d44`.

## Flow Re-Tests On Production

Live tokens used (from real production confirmation flow artifacts):
- Confirmation token: `88c44c25-89f5-4cd6-a12e-647bfa5c0d1c`
- Archive token: `6f085122-a33d-483b-85a6-5e01ce407b2c`

### 1. Real confirmation flow -> confirmed page -> `Browse subscriber archive`

Tested URL:
- `https://aigreenwire.com/api/confirm?token=88c44c25-89f5-4cd6-a12e-647bfa5c0d1c`

Observed final URL after confirm open:
- `https://aigreenwire.com/unsubscribe?status=already-confirmed&token=6f085122-a33d-483b-85a6-5e01ce407b2c`

Action:
- Clicked `Browse subscriber archive` CTA on that page.

Observed final URL after click:
- `https://aigreenwire.com/?archive=subscribe`

Result:
- **Fail** (expected archive route, but redirected to subscribe prompt).

### 2. Direct first-hit tokenized archive URL `/issues?token=<live token>`

Tested URL:
- `https://aigreenwire.com/issues?token=6f085122-a33d-483b-85a6-5e01ce407b2c`

Observed final URL:
- `https://aigreenwire.com/?archive=subscribe`

Result:
- **Fail**.

### 3. Fresh issue/browser-view routes

Fresh session tested URLs:
1. `https://aigreenwire.com/issues/01-india-launches-10372cr-ai-mission-for-farmers`
- final URL: `https://aigreenwire.com/?archive=subscribe`

2. `https://aigreenwire.com/issues/issue-01-the-ai-green-wire-issue-18`
- final URL: `https://aigreenwire.com/?archive=subscribe`

3. `https://aigreenwire.com/issues`
- final URL: `https://aigreenwire.com/?archive=subscribe`

Result:
- **Fail** for all tested fresh browser-view/archive routes.

## Verdict

**Still broken on production.**

The production alias is confirmed on commit `2587d44`, but first-hit archive access behavior remains failing:
- Confirm-page CTA route still ends at subscribe prompt.
- Direct tokenized first-hit archive URL still ends at subscribe prompt.
- Fresh issue/browser-view routes still end at subscribe prompt.

## Evidence Paths

Screenshots captured:
- `gg/agent-outputs/evidence/postship-confirm-landing-2026-04-17.png`
- `gg/agent-outputs/evidence/postship-confirm-browse-result-2026-04-17.png`
- `gg/agent-outputs/evidence/postship-issues-token-firsthit-2026-04-17.png`
- `gg/agent-outputs/evidence/postship-issue-slug1-fresh-2026-04-17.png`
- `gg/agent-outputs/evidence/postship-issue-slug2-fresh-2026-04-17.png`
- `gg/agent-outputs/evidence/postship-issues-index-fresh-2026-04-17.png`
