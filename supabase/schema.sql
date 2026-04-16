-- The AI Green Wire — Supabase schema
-- Run this in Supabase SQL editor once.

-- Extension for UUID generation (usually enabled by default on new projects)
create extension if not exists "uuid-ossp";

-- =========================================
-- Subscribers
-- =========================================
create table if not exists subscribers (
  id               uuid primary key default uuid_generate_v4(),
  email            text not null unique,
  name             text,
  preferred_language text default 'en' check (preferred_language in ('en', 'kn', 'hi')),
  source           text,
  subscribed_at    timestamptz default now(),
  confirmed_at     timestamptz,
  confirm_token    uuid default uuid_generate_v4(),
  unsubscribed_at  timestamptz,
  unsubscribe_token uuid default uuid_generate_v4(),
  metadata         jsonb default '{}'::jsonb
);

create index if not exists idx_subscribers_confirmed on subscribers(confirmed_at) where confirmed_at is not null and unsubscribed_at is null;
create index if not exists idx_subscribers_email on subscribers(email);

-- =========================================
-- Issues (drafts and sent)
-- =========================================
create table if not exists issues (
  id               uuid primary key default uuid_generate_v4(),
  issue_number     integer not null unique,
  slug             text not null unique,
  title            text not null,
  subject_line     text not null,
  greeting_blurb   text,
  stories_json     jsonb not null,
  html_rendered    text not null,
  status           text not null default 'draft' check (status in ('draft', 'approved', 'sending', 'sent', 'failed')),
  generated_at     timestamptz default now(),
  approved_at      timestamptz,
  sent_at          timestamptz,
  sent_count       integer default 0,
  open_count       integer default 0,
  click_count      integer default 0,
  error_log        text,
  metadata         jsonb default '{}'::jsonb
);

create index if not exists idx_issues_status on issues(status);
create index if not exists idx_issues_sent_at on issues(sent_at desc);

-- =========================================
-- Send log (for deliverability debugging)
-- =========================================
create table if not exists send_log (
  id             uuid primary key default uuid_generate_v4(),
  issue_id       uuid references issues(id) on delete cascade,
  subscriber_id  uuid references subscribers(id) on delete set null,
  email          text not null,
  resend_id      text,
  status         text not null check (status in ('queued', 'sent', 'bounced', 'complained', 'failed')),
  sent_at        timestamptz default now(),
  error          text
);

create index if not exists idx_send_log_issue on send_log(issue_id);
create index if not exists idx_send_log_status on send_log(status);

-- =========================================
-- Helper view: active subscribers
-- =========================================
create or replace view active_subscribers as
select id, email, name, preferred_language, unsubscribe_token
from subscribers
where confirmed_at is not null
  and unsubscribed_at is null;

-- =========================================
-- Row Level Security
-- =========================================
alter table subscribers enable row level security;
alter table issues enable row level security;
alter table send_log enable row level security;

-- Public read for sent issues only
create policy "Public can read sent issues"
  on issues for select
  using (status = 'sent');
