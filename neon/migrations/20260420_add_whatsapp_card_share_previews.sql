create table if not exists whatsapp_card_share_previews (
  id             uuid primary key default gen_random_uuid(),
  issue_id       uuid not null references issues(id) on delete cascade,
  issue_number   integer not null,
  language       text not null check (language in ('kn', 'te', 'ta', 'hi')),
  content_type   text not null default 'image/png',
  image_png      bytea not null,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique (issue_id, language)
);

create index if not exists idx_card_share_previews_issue on whatsapp_card_share_previews(issue_number);
create index if not exists idx_card_share_previews_lang on whatsapp_card_share_previews(language);
