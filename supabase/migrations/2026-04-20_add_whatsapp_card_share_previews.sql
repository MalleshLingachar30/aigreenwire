create table if not exists whatsapp_card_share_previews (
  id                 uuid primary key default uuid_generate_v4(),
  issue_id           uuid not null references issues(id) on delete cascade,
  issue_number       integer not null,
  language           text not null check (language in ('kn', 'te', 'ta', 'hi')),
  source_card_number integer not null default 1 check (source_card_number between 1 and 3),
  mime_type          text not null,
  image_width        integer not null,
  image_height       integer not null,
  image_data         bytea not null,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  unique (issue_id, language)
);

create index if not exists idx_whatsapp_card_share_previews_lookup
  on whatsapp_card_share_previews(issue_number, language);
