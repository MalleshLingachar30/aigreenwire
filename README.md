# The AI Green Wire

A weekly newsletter on AI in agriculture, agroforestry, forestry and ecology — by Grobet India Agrotech.

**Stack:** Next.js 14 (App Router, TypeScript) · Neon Postgres · Resend · Anthropic Claude API · Vercel

---

## Quick setup

### 1. Neon database (10 min)
1. Create a project at [console.neon.tech](https://console.neon.tech)
2. Go to **SQL Editor** → paste `neon/schema.sql` → Run
3. Go to **Connect** → copy **Pooled connection string** → `DATABASE_URL` in `.env.local`
4. Copy **Direct (unpooled) connection string** → `DATABASE_URL_UNPOOLED` (for future migrations)

> **Vercel integration (optional):** Visit [vercel.com/marketplace/neon](https://vercel.com/marketplace/neon) to auto-inject `DATABASE_URL` into your Vercel environment.

### 2. Resend domain verification (20 min — waits on DNS propagation)
1. [resend.com/domains](https://resend.com/domains) → Add Domain → `aigreenwire.com`
2. Add the SPF, DKIM, DMARC and MX records Resend provides to your DNS
3. Wait 10–30 min → click **Verify** in Resend
4. Copy your **API key** → `RESEND_API_KEY` in `.env.local`

### 3. Anthropic Claude API (5 min)
1. [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key
2. Copy → `ANTHROPIC_API_KEY` in `.env.local`

### 4. Environment variables
Copy `.env.example` to `.env.local` and fill in all values:

```
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://...neon.tech/neondb?sslmode=require&pgbouncer=false
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=The AI Green Wire <editor@aigreenwire.com>
ANTHROPIC_API_KEY=sk-ant-...
CRON_SECRET=<random 32-char string>
ADMIN_SECRET=<random 32-char string>
EDITOR_EMAIL=you@yourdomain.com
NEXT_PUBLIC_APP_URL=https://aigreenwire.com
```

### 5. Deploy
```bash
npm install
npm run dev          # local dev
git push origin main # triggers Vercel deploy
```

---

## File structure

```
aigreenwire/
├── app/
│   ├── page.tsx                      # Landing page
│   ├── layout.tsx                    # Root layout
│   ├── issues/
│   │   ├── page.tsx                  # Archive index
│   │   └── [slug]/page.tsx           # Single issue
│   ├── unsubscribe/page.tsx          # Unsubscribe handler
│   └── api/
│       ├── subscribe/route.ts        # Subscribe handler
│       ├── confirm/route.ts          # Double opt-in confirmation
│       ├── unsubscribe/route.ts      # Unsubscribe handler
│       ├── cron/generate/route.ts    # Monday 6 AM IST cron
│       ├── admin/approve/route.ts    # Approve + send
│       └── admin/issues/route.ts     # List drafts & issues
├── lib/
│   ├── db.ts                         # Neon serverless client (sql tagged template)
│   ├── resend.ts                     # Resend client + sendEmail / batchSendEmails helpers
│   ├── claude.ts                     # Anthropic Claude client
│   └── template.ts                   # Template B HTML email renderer
├── neon/
│   └── schema.sql                    # Database schema (run once in Neon SQL Editor)
├── vercel.json                       # Cron: 00:30 UTC Mon = 06:00 IST
├── .env.example                      # All required env var keys
└── package.json
```

---

## Weekly flow

| Time | What happens |
|---|---|
| Monday 06:00 IST | Vercel cron hits `/api/cron/generate` → Claude researches stories → draft saved to Neon → preview email sent to `EDITOR_EMAIL` |
| 07:00–10:00 IST | Open preview, click **Approve & Send** if good |
| Within 60 s | Resend blasts issue to all confirmed subscribers; issue published at `/issues/[slug]` |
