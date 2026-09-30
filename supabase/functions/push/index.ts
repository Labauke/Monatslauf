// @ts-nocheck
/* Monatslauf – Push-Nachrichten als Supabase Edge Function.
   Aufgerufen von der Datenbank (siehe supabase/push.sql):
     {type:'entry', record}  nach jedem neuen Eintrag: „Überholt“ und (wer will) „Neuer Eintrag“
     {type:'daily'}          einmal täglich: Deadline (3 Tage vorher und am letzten Tag) und Erinnerung nach 3 bzw. 7 Tagen Pause
   Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SECRET, optional VAPID_SUBJECT (mailto:…).
   SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY stellt Supabase selbst bereit. */
import webpush from 'npm:web-push@3.6.7';

const BASE = Deno.env.get('SUPABASE_URL');
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SECRET = Deno.env.get('PUSH_SECRET');
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'mailto:monatslauf@example.com', Deno.env.get('VAPID_PUBLIC_KEY'), Deno.env.get('VAPID_PRIVATE_KEY'));

// Muss zu js/config.js und js/app.js passen
const FACTORS = { laufen: 4, bouldern: 1, klettern: 1, home: 2, workout: 2, fahrrad: 0.8, yoga: 1, anderes: 1 };
const LABELS = { laufen: 'Joggen', bouldern: 'Bouldern', klettern: 'Klettern', home: 'Home-Training', workout: 'Home-Training', fahrrad: 'Fahrrad', yoga: 'Yoga', anderes: 'Anderes' };
const DEFAULT_PREFS = { overtake: true, deadline: true, reminder: true, entries: false };

const pointsOf = e => Math.round(e.minutes * (FACTORS[e.sport] ?? 1));
const fmtPts = p => `${p.toLocaleString('de-DE')} ${p === 1 ? 'Punkt' : 'Punkte'}`;
const fmtMin = m => { const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`; };
const berlinDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const dayNum = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;

async function db(path, init = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json', ...(init.headers || {}) };
  if (KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${KEY}`;
  const r = await fetch(`${BASE}/rest/v1/${path}`, { ...init, headers });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

function totals(entries, month) {
  const t = {};
  for (const e of entries) if (e.date.startsWith(month)) t[e.player] = (t[e.player] || 0) + pointsOf(e);
  return t;
}

let sent = 0;
async function notify(subs, player, kind, msg) {
  for (const s of subs) {
    if (s.player !== player || !({ ...DEFAULT_PREFS, ...(s.prefs || {}) })[kind]) continue;
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ tag: kind, url: './', ...msg }), { TTL: 60 * 60 * 24 });
      sent++;
    } catch (e) {
      // Abgemeldete oder abgelaufene Geräte entfernen
      if (e.statusCode === 404 || e.statusCode === 410) await db(`push_subs?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE' }).catch(() => {});
      else console.error('Push fehlgeschlagen', e.statusCode, e.body || e.message);
    }
  }
}

async function onEntry(rec, subs, names) {
  const today = berlinDay(), month = today.slice(0, 7);
  if (!rec?.date?.startsWith(month)) return;
  const entries = await db(`entries?select=player,date,minutes,sport&date=gte.${month}-01`);
  const after = totals(entries, month), me = rec.player, gain = pointsOf(rec);
  const now = after[me] || 0, before = now - gain;
  const name = names[me] || me;
  // Überholt: wer vorher vor mir lag und jetzt hinter mir liegt
  for (const [other, t] of Object.entries(after)) {
    if (other === me || !(t > before && t < now)) continue;
    await notify(subs, other, 'overtake', { title: `${name} hat dich überholt!`, body: `${name} liegt jetzt ${fmtPts(now - t)} vor dir. Zeit fürs nächste Training?` });
  }
  const msg = { title: `${name}: ${fmtMin(rec.minutes)} ${LABELS[rec.sport] || 'Training'}`, body: `+${fmtPts(gain)}, jetzt ${fmtPts(now)} diesen Monat.` };
  for (const other of new Set(subs.map(s => s.player))) if (other !== me) await notify(subs, other, 'entries', msg);
}

async function daily(subs, names) {
  const today = berlinDay(), month = today.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const last = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
  const left = dayNum(last) - dayNum(today);
  const since = new Date(Date.UTC(y, m - 1, 1) - 40 * 864e5).toISOString().slice(0, 10);
  const entries = await db(`entries?select=player,date,minutes,sport&date=gte.${since}`);
  const t = totals(entries, month);
  const ranked = Object.keys(names).map(id => ({ id, total: t[id] || 0 })).sort((a, b) => b.total - a.total);
  const players = new Set(subs.map(s => s.player));

  if (left === 3 || left === 0) {
    for (const id of players) {
      const i = ranked.findIndex(r => r.id === id); if (i < 0) continue;
      const mine = ranked[i].total, top = ranked[0];
      const pos = top.id === id || mine === top.total
        ? (ranked[1] && mine > ranked[1].total ? `Du führst mit ${(mine - ranked[1].total).toLocaleString("de-DE")} ${mine - ranked[1].total === 1 ? "Punkt" : "Punkten"} Vorsprung.` : 'Du liegst gleichauf an der Spitze.')
        : `Du bist auf Platz ${i + 1}, ${fmtPts(top.total - mine)} hinter ${names[top.id] || top.id}.`;
      await notify(subs, id, 'deadline', left === 0
        ? { title: 'Letzter Tag!', body: `Heute um 23:59 steht der Sieg fest. ${pos}` }
        : { title: 'Noch 3 Tage bis zum Monatsende', body: pos });
    }
  }

  const lastDay = {};
  for (const e of entries) if (!lastDay[e.player] || e.date > lastDay[e.player]) lastDay[e.player] = e.date;
  for (const id of players) {
    if (!lastDay[id]) continue; // wer noch nie etwas eingetragen hat, wird nicht erinnert
    const idle = dayNum(today) - dayNum(lastDay[id]);
    if (idle === 3) await notify(subs, id, 'reminder', { title: 'Deine Figur schläft ein 😴', body: 'Seit 3 Tagen kein Training eingetragen. Weck sie auf!' });
    if (idle === 7) await notify(subs, id, 'reminder', { title: 'Spinnweben! 🕸️', body: 'Seit einer Woche kein Training eingetragen. Deine Figur wartet auf dich.' });
  }
}

Deno.serve(async req => {
  if (!SECRET || req.headers.get('x-push-secret') !== SECRET) return new Response('forbidden', { status: 403 });
  const body = await req.json().catch(() => ({}));
  sent = 0;
  try {
    const subs = await db('push_subs?select=endpoint,player,p256dh,auth,prefs');
    if (subs.length) {
      const names = Object.fromEntries((await db('players?select=id,name')).map(p => [p.id, p.name]));
      if (body.type === 'entry') await onEntry(body.record, subs, names);
      else if (body.type === 'daily') await daily(subs, names);
    }
    return Response.json({ ok: true, sent });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});
