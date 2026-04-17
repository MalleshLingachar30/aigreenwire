-- The AI Green Wire: database schema
-- Run this entire file in the SQL Editor (console.neon.tech).

-- =========================================
-- Subscribers
-- =========================================
create table if not exists subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique,
  name              text,
  preferred_language text default 'en' check (preferred_language in ('en', 'kn', 'hi')),
  source            text,
  subscribed_at     timestamptz default now(),
  confirmed_at      timestamptz,
  confirm_token     uuid default gen_random_uuid(),
  unsubscribed_at   timestamptz,
  last_resubscribe_reminder_at timestamptz,
  unsubscribe_token uuid default gen_random_uuid(),
  metadata          jsonb default '{}'::jsonb
);

create index if not exists idx_subscribers_confirmed
  on subscribers(confirmed_at)
  where confirmed_at is not null and unsubscribed_at is null;

create index if not exists idx_subscribers_email on subscribers(email);
create index if not exists idx_subscribers_resubscribe_reminder
  on subscribers(last_resubscribe_reminder_at)
  where unsubscribed_at is not null;

-- =========================================
-- Issues (drafts and sent)
-- =========================================
create table if not exists issues (
  id               uuid primary key default gen_random_uuid(),
  issue_number     integer not null unique,
  slug             text not null unique,
  title            text not null,
  subject_line     text not null,
  greeting_blurb   text,
  stories_json     jsonb not null,
  html_rendered    text not null,
  status           text not null default 'draft'
                     check (status in ('draft', 'approved', 'sending', 'sent', 'failed')),
  generated_at     timestamptz default now(),
  approved_at      timestamptz,
  sent_at          timestamptz,
  sent_count       integer default 0,
  open_count       integer default 0,
  click_count      integer default 0,
  error_log        text,
  metadata         jsonb default '{}'::jsonb
);

create index if not exists idx_issues_status  on issues(status);
create index if not exists idx_issues_sent_at on issues(sent_at desc);

-- =========================================
-- Send log (per-recipient delivery record)
-- =========================================
create table if not exists send_log (
  id            uuid primary key default gen_random_uuid(),
  issue_id      uuid references issues(id) on delete cascade,
  subscriber_id uuid references subscribers(id) on delete set null,
  email         text not null,
  resend_id     text,
  status        text not null
                  check (status in ('queued', 'sent', 'bounced', 'complained', 'failed')),
  sent_at       timestamptz default now(),
  error         text
);

create index if not exists idx_send_log_issue  on send_log(issue_id);
create index if not exists idx_send_log_status on send_log(status);

-- =========================================
-- View: active subscribers ready to receive mail
-- =========================================
create or replace view active_subscribers as
select id, email, name, preferred_language, unsubscribe_token
from subscribers
where confirmed_at is not null
  and unsubscribed_at is null;
