-- Monatslauf – Push-Nachrichten (einmal im SQL Editor ausführen, nach schema.sql).
-- Vorher den Platzhalter PUSH-SECRET unten ersetzen (siehe README, Abschnitt Push-Nachrichten).

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Geräte, die Nachrichten bekommen. Kein direkter Zugriff über den öffentlichen Key,
-- nur über die zwei Funktionen push_subscribe / push_unsubscribe.
create table if not exists public.push_subs (
  endpoint text primary key check (endpoint ~ '^https://' and char_length(endpoint) < 1000),
  player   text not null references public.players(id) on delete cascade,
  p256dh   text not null check (char_length(p256dh) < 200),
  auth     text not null check (char_length(auth) < 100),
  prefs    jsonb not null default '{}'::jsonb check (pg_column_size(prefs) < 500),
  created  bigint not null default (extract(epoch from now()) * 1000)::bigint
);
alter table public.push_subs enable row level security;
revoke all on public.push_subs from anon, authenticated;

create or replace function public.push_subscribe(p_endpoint text, p_player text, p_p256dh text, p_auth text, p_prefs jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.push_subs (endpoint, player, p256dh, auth, prefs)
  values (p_endpoint, p_player, p_p256dh, p_auth, coalesce(p_prefs, '{}'::jsonb))
  on conflict (endpoint) do update set player = excluded.player, p256dh = excluded.p256dh, auth = excluded.auth, prefs = excluded.prefs;
$$;
create or replace function public.push_unsubscribe(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subs where endpoint = p_endpoint;
$$;
revoke all on function public.push_subscribe(text, text, text, text, jsonb) from public;
revoke all on function public.push_unsubscribe(text) from public;
grant execute on function public.push_subscribe(text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.push_unsubscribe(text) to anon, authenticated;

-- Adresse der Edge Function und gemeinsames Geheimnis. Nur für die Datenbank selbst lesbar.
create table if not exists public.push_config (key text primary key, value text not null);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;
insert into public.push_config (key, value) values
  ('url', 'https://mpmbzbbqrslniszxjrih.supabase.co/functions/v1/push'),
  ('secret', 'PUSH-SECRET')
on conflict (key) do update set value = excluded.value;

-- Neuer Eintrag: Edge Function benachrichtigen (Überholt, neue Einträge)
create or replace function public.push_on_entry()
returns trigger language plpgsql security definer set search_path = public as $$
declare u text; s text;
begin
  select value into u from public.push_config where key = 'url';
  select value into s from public.push_config where key = 'secret';
  if u is not null and s is not null then
    perform net.http_post(
      url := u,
      body := jsonb_build_object('type', 'entry', 'record', to_jsonb(new)),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', s));
  end if;
  return new;
end $$;
drop trigger if exists push_on_entry on public.entries;
create trigger push_on_entry after insert on public.entries for each row execute function public.push_on_entry();

-- Einmal täglich um 18 Uhr (Sommerzeit) bzw. 17 Uhr (Winterzeit): Deadline und Erinnerungen
select cron.unschedule('monatslauf-taeglich') where exists (select 1 from cron.job where jobname = 'monatslauf-taeglich');
select cron.schedule('monatslauf-taeglich', '0 16 * * *', $cron$
  select net.http_post(
    url := (select value from public.push_config where key = 'url'),
    body := '{"type":"daily"}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', (select value from public.push_config where key = 'secret')))
$cron$);
