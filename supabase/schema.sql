-- Monatslauf – Datenbank für Supabase
-- Einmal komplett im Supabase-Dashboard unter "SQL Editor" ausführen.

create extension if not exists pgcrypto;

-- Mitspielende: id ist der kleingeschriebene Benutzername (z. B. "hauke")
create table if not exists public.players (
  id      text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  name    text not null check (char_length(name) between 1 and 24),
  color   text not null default '#FF7A45' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  avatar  jsonb not null default '{}'::jsonb check (pg_column_size(avatar) < 2000),
  created bigint not null default (extract(epoch from now()) * 1000)::bigint
);

-- Trainings: Punkte werden in der App aus Minuten × Faktor der Sportart berechnet
create table if not exists public.entries (
  id      uuid primary key default gen_random_uuid(),
  player  text not null references public.players(id) on delete cascade,
  date    date not null,
  minutes int  not null check (minutes between 1 and 600),
  sport   text not null check (sport ~ '^[a-z]{1,20}$'),
  created bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists entries_date_idx on public.entries (date);
create index if not exists entries_player_idx on public.entries (player);

-- Zugriff ohne Login über den öffentlichen Key.
-- Deadline serverseitig: Einträge nur für den laufenden Monat (deutsche Zeit) anlegen und löschen.
alter table public.players enable row level security;
alter table public.entries enable row level security;

drop policy if exists "players lesen" on public.players;
drop policy if exists "players anlegen" on public.players;
drop policy if exists "players aendern" on public.players;
drop policy if exists "entries lesen" on public.entries;
drop policy if exists "entries anlegen" on public.entries;
drop policy if exists "entries loeschen" on public.entries;

create policy "players lesen"    on public.players for select to anon using (true);
create policy "players anlegen"  on public.players for insert to anon with check (true);
create policy "players aendern"  on public.players for update to anon using (true) with check (true);

create policy "entries lesen"    on public.entries for select to anon using (true);
create policy "entries anlegen"  on public.entries for insert to anon with check (
  date >= date_trunc('month', now() at time zone 'Europe/Berlin')::date
  and date <= (now() at time zone 'Europe/Berlin')::date
);
create policy "entries loeschen" on public.entries for delete to anon using (
  date >= date_trunc('month', now() at time zone 'Europe/Berlin')::date
);

grant usage on schema public to anon;
grant select, insert, update on public.players to anon;
grant select, insert, delete on public.entries to anon;
