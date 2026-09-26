/* Monatslauf – App */
const CFG = window.MONATSLAUF_CONFIG || {};
const FACTORS = { laufen: 4, bouldern: 1, klettern: 1, home: 2, fahrrad: 0.8, yoga: 1, anderes: 1, ...(CFG.factors || {}) };
const SPORTS = [
  { id: 'laufen',   label: 'Laufen',        color: '#F0643A', pose: 'run' },
  { id: 'bouldern', label: 'Bouldern',      color: '#9B5DE5', pose: 'climb' },
  { id: 'klettern', label: 'Klettern',      color: '#1FAE8C', pose: 'climb' },
  { id: 'home',     label: 'Home-Training', color: '#E23E6B', pose: 'workout' },
  { id: 'fahrrad',  label: 'Fahrrad',       color: '#F2C230', pose: 'bike' },
  { id: 'yoga',     label: 'Yoga',          color: '#3FA7D6', pose: 'yoga' },
  { id: 'anderes',  label: 'Anderes',       color: '#8C96A8', pose: 'run' },
].map(s => ({ ...s, factor: FACTORS[s.id] ?? 1 }));
const SPORT = Object.fromEntries(SPORTS.map(s => [s.id, s]));
SPORT.workout = SPORT.home; // ältere Einträge
const DURATIONS = [15, 30, 45, 60, 90, 120];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const LEAD_POS = 0.88;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 760px)');
const { figureSVG, normalize, randomAvatar, BASES, PARTS, SKINS, HAIR_COLORS, JERSEYS } = window.Figure;

const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
const mkey = s => s.slice(0, 7);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const monthName = k => { const [y, m] = k.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
const shiftMonth = (k, n) => { const [y, m] = k.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const lastDayOf = k => { const [y, m] = k.split('-').map(Number); return new Date(y, m, 0); };
const fmtMin = m => { const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`; };
const fmtPts = p => `${Math.round(p).toLocaleString('de-DE')} Pkt`;
const fmtFactor = f => '×' + String(f).replace('.', ',');
const fmtDate = s => { const [y, m, d] = s.split('-').map(Number); const dt = new Date(y, m - 1, d); return `${WD[dt.getDay()]}, ${d}.${m}.`; };
const dayDiff = (a, b) => { const p = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }; return Math.round((p(b) - p(a)) / 864e5); };
const slug = s => s.trim().toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const pointsOf = (minutes, sport) => Math.round(minutes * (SPORT[sport]?.factor ?? 1));

/* ---------- Zustand ---------- */
const S = {
  store: null, loaded: { players: false, entries: false },
  players: {}, entries: [],
  me: lsGet('monatslauf.me'),
  view: mkey(today()),
  form: { date: today(), minutes: 60, sport: null, custom: false },
  login: { name: '', color: JERSEYS[0], av: normalize(randomAvatar(0)), tab: 'base', pose: 'cheer' },
  edit: null,
  busy: false, readOnly: false, rankSnapshot: null, cheered: new Set(),
};
const current = () => mkey(today());

/* ---------- Auswertung ---------- */
function totals(month) {
  const t = {};
  for (const e of S.entries) {
    if (mkey(e.date) !== month) continue;
    const r = t[e.player] ||= { total: 0, minutes: 0, count: 0 };
    r.total += pointsOf(e.minutes, e.sport); r.minutes += e.minutes; r.count++;
  }
  return t;
}
function winners() {
  const months = [...new Set(S.entries.map(e => mkey(e.date)))].filter(m => m < current()).sort().reverse();
  return months.map(m => {
    const t = totals(m); const max = Math.max(0, ...Object.values(t).map(r => r.total));
    return { month: m, max, ids: Object.keys(t).filter(id => t[id].total === max && max > 0) };
  }).filter(w => w.ids.length);
}
function winCounts() { const c = {}; for (const w of winners()) for (const id of w.ids) c[id] = (c[id] || 0) + 1; return c; }
const pname = id => S.players[id]?.name || id;
const byTime = (a, b) => a.date.localeCompare(b.date) || (a.created || 0) - (b.created || 0);
function playerStats(id, p, month) {
  const mine = S.entries.filter(e => e.player === id).sort(byTime);
  const inMonth = mine.filter(e => mkey(e.date) === month);
  const segs = [];
  for (const e of inMonth) {
    const sp = SPORT[e.sport] ? SPORT[e.sport].id : 'anderes', l = segs[segs.length - 1], pts = pointsOf(e.minutes, e.sport);
    l && l.sport === sp ? l.pts += pts : segs.push({ sport: sp, pts });
  }
  const last = mine[mine.length - 1];
  const idle = last ? dayDiff(last.date, today()) : (p.created ? Math.floor((Date.now() - p.created) / 864e5) : 0);
  const days = new Set(mine.map(e => e.date));
  const d = new Date(); if (!days.has(ymd(d))) d.setDate(d.getDate() - 1);
  let streak = 0; while (days.has(ymd(d))) { streak++; d.setDate(d.getDate() - 1); }
  return { segs, lastSport: inMonth.length ? inMonth[inMonth.length - 1].sport : null, idle, streak };
}
function rankedRows(month) {
  const t = totals(month); const wc = winCounts();
  return Object.entries(S.players).map(([id, p]) => ({
    id, name: p.name, color: p.color, avatar: p.avatar, total: t[id]?.total || 0, minutes: t[id]?.minutes || 0, count: t[id]?.count || 0, wins: wc[id] || 0, ...playerStats(id, p, month),
  })).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}
const EXAMPLES = [
  { id: 'x1', name: 'Anna', color: '#FFFFFF', avatar: { base: 'mensch', skin: SKINS[0], hair: 'zopf', hairColor: '#C8552D', glasses: 'sport' }, total: 1840, minutes: 460, count: 9, wins: 0, segs: [{ sport: 'laufen', pts: 800 }, { sport: 'yoga', pts: 180 }, { sport: 'laufen', pts: 860 }], lastSport: 'laufen', idle: 0, streak: 4 },
  { id: 'x2', name: 'Ben', color: '#FF7A45', avatar: { base: 'panda', hat: 'helm' }, total: 1180, minutes: 700, count: 6, wins: 0, segs: [{ sport: 'klettern', pts: 240 }, { sport: 'fahrrad', pts: 480 }, { sport: 'home', pts: 460 }], lastSport: 'fahrrad', idle: 1, streak: 0 },
  { id: 'x3', name: 'Cem', color: '#FFD23F', avatar: { base: 'mensch', skin: SKINS[3], hair: 'locken', hairColor: '#2A2238', beard: 'vollbart', extra: 'kopfhoerer' }, total: 390, minutes: 240, count: 3, wins: 0, segs: [{ sport: 'bouldern', pts: 150 }, { sport: 'home', pts: 240 }], lastSport: 'home', idle: 4, streak: 0 },
];
const flameIcon = `<svg viewBox="0 0 11 14" aria-hidden="true"><path d="M5.5 0 C6.5 3 10.5 5 10.5 9 A5 5 0 0 1 0.5 9 C0.5 6.5 2 5.5 3 4 C3.2 5.5 4 6 4.5 6 C4 4 4.5 2 5.5 0Z" fill="#FFB02E"/><path d="M5.5 7 C6 8.5 7.8 9.3 7.8 11 A2.3 2.3 0 0 1 3.2 11 C3.2 9.6 4.6 9 5.5 7Z" fill="#FFF2B0"/></svg>`;

/* ---------- Effekte ---------- */
function confetti(n = 150) {
  if (REDUCED) return;
  const c = document.createElement('canvas'); c.className = 'confetti'; document.body.appendChild(c);
  const dpr = devicePixelRatio || 1; c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  const cols = [...SPORTS.map(s => s.color), '#F5B82E', '#FFFFFF'];
  const ps = Array.from({ length: n }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * innerWidth * .4, y: innerHeight * .35, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, r: Math.random() * 6, vr: (Math.random() - .5) * .4, w: 6 + Math.random() * 6, h: 4 + Math.random() * 4, c: cols[Math.floor(Math.random() * cols.length)] }));
  const t0 = performance.now();
  (function frame(t) {
    const k = (t - t0) / 2600; x.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of ps) {
      p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      x.save(); x.globalAlpha = Math.max(0, 1 - k); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore();
    }
    k < 1 ? requestAnimationFrame(frame) : c.remove();
  })(t0);
}
function flash(text) {
  const f = document.createElement('div'); f.className = 'flash'; f.textContent = text;
  $('#stadium').appendChild(f); setTimeout(() => f.remove(), 3300);
}
function checkOvertake() {
  const rows = rankedRows(current()); const now = rows.map(r => r.id);
  const prev = S.rankSnapshot; S.rankSnapshot = { order: now, tot: Object.fromEntries(rows.map(r => [r.id, r.total])) };
  if (!prev) return;
  for (let i = 0; i < now.length; i++) {
    const a = now[i], old = prev.order.indexOf(a);
    if (old <= i) continue;
    const passed = prev.order.slice(0, old).find(b => now.indexOf(b) > i && (prev.tot[b] || 0) > (prev.tot[a] || 0) && S.players[b]);
    if (passed && S.view === current()) { flash(`${pname(a)} überholt ${pname(passed)}!`); confetti(90); return; }
  }
}

/* ---------- Rendern ---------- */
let entryInView = true;
function render() { renderWho(); renderMonth(); renderCeremony(); renderTrack(); renderEntry(); renderFeed(); renderHall(); updateFab(); }
function updateFab() {
  const fab = $('#fab');
  fab.textContent = S.players[S.me] ? (S.edit ? 'Zur Figur' : '+ Training eintragen') : 'Mitmachen';
  fab.hidden = entryInView || S.readOnly || !S.loaded.players;
}
function renderWho() {
  const p = S.players[S.me];
  $('#who').innerHTML = p ? `<span class="whofig">${figureSVG({ id: S.me, uid: 'w', avatar: p.avatar, color: p.color, wins: winCounts()[S.me] || 0, pose: 'cheer', idle: true })}</span><span>${esc(p.name)}</span><button class="linkbtn" id="editAv">Figur bauen</button><button class="linkbtn" id="logout">Abmelden</button>` : '';
  const lo = $('#logout'); if (lo) lo.onclick = () => { S.me = null; S.edit = null; lsSet('monatslauf.me', null); render(); };
  const ea = $('#editAv'); if (ea) ea.onclick = () => {
    S.edit = { av: normalize(p.avatar, S.me), color: p.color, tab: 'base', pose: 'cheer' };
    renderEntry(); updateFab();
    $('#entryCard').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  };
}
function renderMonth() {
  $('#monthTitle').textContent = monthName(S.view);
  const earliest = S.entries.reduce((a, e) => mkey(e.date) < a ? mkey(e.date) : a, current());
  $('#prevM').disabled = S.view <= earliest;
  $('#nextM').disabled = S.view >= current();
  if (S.view === current()) {
    const last = lastDayOf(S.view); const now = new Date(); now.setHours(0, 0, 0, 0);
    const left = Math.round((last - now) / 864e5);
    const txt = left === 0 ? 'Letzter Tag! Heute um 23:59 steht der Sieg fest' : `Noch ${left} ${left === 1 ? 'Tag' : 'Tage'} · Deadline ${last.getDate()}. ${MONTHS[last.getMonth()]}, 23:59`;
    $('#deadline').innerHTML = `<span class="pill${left <= 3 ? ' hot' : ''}">${txt}</span>`;
  } else {
    const w = winners().find(x => x.month === S.view);
    $('#deadline').innerHTML = `<span class="pill done">Beendet${w ? ' · Sieg: ' + w.ids.map(id => esc(pname(id))).join(' & ') : ''}</span>`;
  }
}
function podiumHTML(month) {
  const t = totals(month); const wc = winCounts();
  const ranked = Object.entries(t).filter(([, r]) => r.total > 0).sort((a, b) => b[1].total - a[1].total).map(([id, r], i) => ({ id, place: i + 1, ...r }));
  if (!ranked.length) return '';
  const col = r => r ? `<div class="pcol pl${r.place}">
      <div class="pfig">${figureSVG({ id: r.id, uid: `p${month}${r.id}`, avatar: S.players[r.id]?.avatar, color: S.players[r.id]?.color || '#fff', wins: wc[r.id] || 0, pose: r.place === 1 ? 'cheer' : 'run', idle: r.place !== 1 })}</div>
      <div class="pname">${esc(pname(r.id))}</div>
      <div class="pblock"><b>${r.place}</b><span>${fmtPts(r.total)}</span></div></div>` : '';
  const rest = ranked.slice(3);
  return `<div class="podium">${col(ranked[1])}${col(ranked[0])}${col(ranked[2])}</div>
    ${rest.length ? `<ul class="prest">${rest.map(r => `<li>${r.place}. ${esc(pname(r.id))} · ${fmtPts(r.total)}</li>`).join('')}</ul>` : ''}`;
}
function cheerOnce(key) { if (!S.cheered.has(key)) { S.cheered.add(key); setTimeout(() => confetti(120), 1600); } }
function renderCeremony() {
  const el = $('#ceremony'); const prev = shiftMonth(current(), -1);
  const show = S.loaded.entries && S.view === current() && new Date().getDate() <= 3 && Object.keys(totals(prev)).length;
  el.hidden = !show;
  if (!show) { el.innerHTML = ''; el.dataset.month = ''; return; }
  if (el.dataset.month !== prev) { el.dataset.month = prev; el.innerHTML = `<h3>Siegerehrung ${monthName(prev)}</h3>${podiumHTML(prev)}`; cheerOnce(prev); }
}

const laneEls = new Map();
function renderTrack() {
  const past = S.view !== current();
  $('#lanes').hidden = past; $('#scale').hidden = past; $('#podium').hidden = !past; $('#legendRow').hidden = past;
  if (past) {
    const pod = $('#podium');
    if (pod.dataset.month !== S.view) { pod.dataset.month = S.view; pod.innerHTML = podiumHTML(S.view) || '<p class="stadium-note">In diesem Monat wurde nichts eingetragen.</p>'; if (pod.innerHTML.includes('podium')) cheerOnce(S.view); }
    $('#stadiumNote').textContent = '';
    return;
  }
  $('#podium').dataset.month = '';
  let rows = rankedRows(current()); let example = false;
  if (!rows.length && S.loaded.players) { rows = EXAMPLES; example = true; }
  const max = rows[0]?.total || 0;
  const box = $('#lanes');
  const before = new Map([...laneEls].map(([id, el]) => [id, el.isConnected ? el.getBoundingClientRect().top : null]));
  const keep = new Set(rows.map(r => r.id));
  for (const [id, el] of laneEls) if (!keep.has(id)) { el.remove(); laneEls.delete(id); }
  rows.forEach((r, i) => {
    let el = laneEls.get(r.id), fresh = false;
    if (!el) {
      fresh = true; el = document.createElement('div'); el.className = 'lane';
      el.innerHTML = `<div class="label"></div><div class="run" style="--p:0"><div class="trail"></div><div class="runner-wrap"><div class="fig"></div><span class="bubble"></span></div></div>`;
      laneEls.set(r.id, el);
    }
    const lead = i === 0 && r.total > 0 && (rows.length === 1 || r.total > rows[1].total);
    const lastPlace = rows.length >= 2 && i === rows.length - 1 && r.total < max;
    const pose = lastPlace ? 'sofa' : (SPORT[r.lastSport]?.pose || 'run');
    const sleep = r.idle >= 3, web = r.idle >= 7;
    const p = max ? (r.total / max) * LEAD_POS : 0;
    el.className = `lane${r.id === S.me ? ' me-lane' : ''}${example ? ' example' : ''}`;
    const label = `<div class="nm"><b>${i + 1}</b><span>${esc(r.name)}</span>${lead ? '<em class="leadtag">führt</em>' : ''}</div>
      <div class="meta"><span>${fmtPts(r.total)} · ${fmtMin(r.minutes)}</span>${r.streak >= 2 ? `<span class="streak" title="${r.streak} Tage in Folge">${flameIcon}${r.streak}</span>` : ''}${r.wins ? `<span>${r.wins}× Monatssieg</span>` : ''}</div>`;
    const lbl = el.querySelector('.label'); if (lbl._h !== label) { lbl.innerHTML = label; lbl._h = label; }
    const fig = figureSVG({ id: r.id, uid: 'l' + r.id, avatar: r.avatar, color: r.color || '#fff', wins: r.wins, pose, idle: r.total === 0 || sleep, lead, sleep, web });
    const fe = el.querySelector('.fig'); if (fe._h !== fig) { fe.innerHTML = fig; fe._h = fig; }
    const bub = r.total === 0 ? 'noch am Start' : i === 0 || r.total === max ? fmtPts(r.total) : `–${fmtPts(max - r.total)}`;
    const be = el.querySelector('.bubble'); be.textContent = bub; be.title = `Gesamt: ${fmtPts(r.total)}`;
    el.querySelector('.runner-wrap').classList.toggle('far', p > .55);
    let acc = 0; const stops = r.segs.map(s => { const a = acc / (r.total || 1) * 100; acc += s.pts; return `${SPORT[s.sport]?.color || '#fff'} ${a}% ${acc / (r.total || 1) * 100}%`; });
    el.querySelector('.trail').style.background = stops.length ? `linear-gradient(90deg,${stops.join(',')})` : 'transparent';
    const run = el.querySelector('.run');
    box.appendChild(el);
    if (fresh) void run.offsetWidth; // Startposition festhalten, damit die Figur vom Start losläuft
    run.style.setProperty('--p', p);
  });
  if (!REDUCED && box.animate) for (const [id, el] of laneEls) {
    const old = before.get(id); if (old == null) continue;
    const d = Math.round(old - el.getBoundingClientRect().top); if (!d) continue;
    el.getAnimations().forEach(a => a.cancel());
    el.style.zIndex = d > 0 ? 2 : 1;
    el.animate([{ transform: `translateY(${d}px)` }, { transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)' })
      .finished.catch(() => {}).then(() => { el.style.zIndex = ''; });
  }
  const used = SPORTS.filter(s => rows.some(r => r.segs.some(g => g.sport === s.id)));
  $('#legendRow').innerHTML = rows.length ? `<span>Spuren:</span>${used.map(s => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join('')}` : '';
  $('#stadiumNote').textContent = !S.loaded.players ? 'Lade Rennbahn …'
    : example ? 'So sieht es aus, sobald ihr loslegt. Meldet euch an, baut eure Figur und tragt euer erstes Training ein.'
    : 'Wer die meisten Punkte hat, läuft vorne mit Flammen an den Schuhen, alle anderen im Verhältnis dazu. Das Schlusslicht sitzt auf dem Sofa. Nach 3 Tagen Pause schläft die Figur ein, nach einer Woche setzt sie Spinnweben an.';
}

/* ---------- Training eintragen ---------- */
function renderEntry() {
  const card = $('#entryCard');
  if (!S.players[S.me]) return renderLogin(card);
  if (S.edit) return renderEditor(card);
  if (S.readOnly) { card.innerHTML = `<h3>Training eintragen</h3><p class="summary">Einträge können gerade nicht gespeichert werden. Prüfe die Supabase-Einstellungen in der README.</p>`; return; }
  const f = S.form;
  const minDate = `${current()}-01`;
  const dateChips = [['Heute', today()], ['Gestern', daysAgo(1)], ['Vorgestern', daysAgo(2)]].filter(([, d]) => d >= minDate);
  if (f.date < minDate) f.date = today();
  const quickDate = dateChips.some(([, d]) => d === f.date);
  const summary = () => f.sport
    ? `<span>${fmtDate(f.date)} · ${fmtMin(f.minutes)} ${SPORT[f.sport].label} =</span><b>${pointsOf(f.minutes, f.sport).toLocaleString('de-DE')}</b><span>Punkte</span>`
    : '<span>Wähle noch eine Sportart.</span>';
  card.innerHTML = `
    <h3>Training eintragen</h3>
    <div class="field"><span class="lbl">Tag</span>
      <div class="chips">
        ${dateChips.map(([l, d]) => `<button class="chip" data-date="${d}" aria-pressed="${f.date === d}">${l}</button>`).join('')}
        <input type="date" id="dateIn" aria-label="Anderes Datum" min="${minDate}" max="${today()}" value="${f.date}" ${quickDate ? '' : 'style="border-color:var(--ink)"'}>
      </div>
    </div>
    <div class="field"><span class="lbl">Dauer</span>
      <div class="chips">
        ${DURATIONS.map(m => `<button class="chip big" data-min="${m}" aria-pressed="${!f.custom && f.minutes === m}">${m}<small>min</small></button>`).join('')}
        <input type="number" id="minIn" min="1" max="600" inputmode="numeric" placeholder="andere Minuten" aria-label="Andere Dauer in Minuten" value="${f.custom ? f.minutes : ''}">
      </div>
    </div>
    <div class="field"><span class="lbl">Sportart</span>
      <div class="chips">
        ${SPORTS.map(s => `<button class="chip" data-sport="${s.id}" aria-pressed="${f.sport === s.id}"><span class="sw" style="background:${s.color}"></span>${s.label}<span class="fac">${fmtFactor(s.factor)}</span></button>`).join('')}
      </div>
    </div>
    <p class="points-preview" id="sum">${summary()}</p>
    <button class="primary" id="saveEntry" ${f.sport && f.minutes > 0 && !S.busy ? '' : 'disabled'}>Eintragen</button>
    <p class="factors">Punkte pro Minute: ${SPORTS.map(s => `<span><i style="background:${s.color}"></i>${s.label} ${fmtFactor(s.factor)}</span>`).join('')}</p>`;
  card.querySelectorAll('[data-date]').forEach(b => b.onclick = () => { f.date = b.dataset.date; renderEntry(); });
  card.querySelectorAll('[data-min]').forEach(b => b.onclick = () => { f.minutes = +b.dataset.min; f.custom = false; renderEntry(); });
  card.querySelectorAll('[data-sport]').forEach(b => b.onclick = () => { f.sport = b.dataset.sport; renderEntry(); });
  $('#dateIn').onchange = e => { if (e.target.value && e.target.value >= minDate && e.target.value <= today()) f.date = e.target.value; renderEntry(); };
  $('#minIn').oninput = e => {
    const v = parseInt(e.target.value, 10);
    if (v > 0 && v <= 600) { f.minutes = v; f.custom = true; }
    card.querySelectorAll('[data-min]').forEach(b => b.setAttribute('aria-pressed', String(!f.custom && f.minutes === +b.dataset.min)));
    $('#sum').innerHTML = summary();
    $('#saveEntry').disabled = !(f.sport && f.minutes > 0);
  };
  $('#saveEntry').onclick = saveEntry;
}
async function saveEntry() {
  const f = S.form; if (!f.sport || S.busy) return;
  S.busy = true; renderEntry();
  try {
    S.view = current();
    await S.store.add('entries', { player: S.me, date: f.date, minutes: f.minutes, sport: f.sport, created: Date.now() });
    toast(`${fmtMin(f.minutes)} ${SPORT[f.sport].label} eingetragen: +${pointsOf(f.minutes, f.sport)} Punkte`);
    if (MOBILE.matches) $('#stadium').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
    confetti();
  } catch (e) { handleWriteError(e); }
  S.busy = false; render();
}
function handleWriteError(e) {
  if (e?.code === 'offline') toast('Keine Internetverbindung. Versuch es gleich noch mal.');
  else if (e?.code === 'forbidden') toast('Supabase lehnt den Zugriff ab. Prüfe Key und Tabellenrechte (README).');
  else if (e?.code === 'invalid') toast('Der Eintrag wurde abgelehnt. Eingetragen werden kann nur für den laufenden Monat.');
  else toast('Speichern hat nicht geklappt. Versuch es gleich noch mal.');
}

/* ---------- Figuren-Baukasten ---------- */
const TABS = [['base', 'Figur'], ['skin', 'Haut'], ['hair', 'Frisur'], ['hairColor', 'Haarfarbe'], ['beard', 'Bart'], ['hat', 'Kopf'], ['glasses', 'Brille'], ['extra', 'Extra'], ['shoes', 'Schuhe'], ['jersey', 'Trikot']];
const HUMAN_ONLY = ['skin', 'hair', 'hairColor', 'beard'];
const HEAD_TABS = ['hair', 'beard', 'hat', 'glasses'];
const PREVIEW_POSES = [['cheer', 'Jubeln'], ['run', 'Laufen'], ['climb', 'Klettern'], ['workout', 'Training'], ['bike', 'Fahrrad'], ['yoga', 'Yoga']];
function thumb(av, color, uid, crop) {
  const svg = figureSVG({ uid, avatar: av, color, wins: 99, pose: 'cheer', idle: true });
  return crop ? svg.replace('viewBox="-12 -18 64 70"', 'viewBox="8 -14 32 35" style="overflow:hidden"') : svg;
}
function builderHTML(B, wins, prefix) {
  const human = B.av.base === 'mensch';
  const tabs = TABS.filter(([k]) => human || !HUMAN_ONLY.includes(k));
  if (!tabs.some(t => t[0] === B.tab)) B.tab = 'base';
  const swatch = (key, list, cur) => `<div class="swatches">${list.map(c => `<button data-set="${key}:${c}" style="background:${c}" aria-label="Farbe ${c}" aria-pressed="${cur === c}"></button>`).join('')}</div>`;
  let opts;
  if (B.tab === 'base') opts = `<div class="b-opts">${BASES.map(b => `<button data-set="base:${b.id}" aria-pressed="${B.av.base === b.id}">${thumb({ ...B.av, base: b.id }, B.color, `${prefix}b${b.id}`)}<span>${b.label}</span></button>`).join('')}</div>`;
  else if (B.tab === 'skin') opts = swatch('skin', SKINS, B.av.skin);
  else if (B.tab === 'hairColor') opts = swatch('hairColor', HAIR_COLORS, B.av.hairColor);
  else if (B.tab === 'jersey') opts = swatch('jersey', JERSEYS, B.color);
  else opts = `<div class="b-opts">${PARTS[B.tab].map(([id, label, need]) => {
    const locked = (need || 0) > wins;
    return `<button data-set="${B.tab}:${id}" aria-pressed="${B.av[B.tab] === id}" ${locked ? 'disabled' : ''}>${locked ? `<span class="lock">${need} ${need === 1 ? 'Sieg' : 'Siege'}</span>` : ''}${thumb({ ...B.av, [B.tab]: id }, B.color, `${prefix}${B.tab}${id}`, HEAD_TABS.includes(B.tab))}<span>${label}</span></button>`;
  }).join('')}</div>`;
  return `<div class="builder">
    <div class="b-stage">
      <div class="b-big">${figureSVG({ uid: prefix + 'big', avatar: B.av, color: B.color, wins, pose: B.pose })}</div>
      <div class="b-side">
        <span class="lbl">Vorschau</span>
        <div class="b-poses">${PREVIEW_POSES.map(([p, l]) => `<button data-pose="${p}" aria-pressed="${B.pose === p}">${l}</button>`).join('')}</div>
        <button class="b-random" data-random="1">Zufällige Figur</button>
      </div>
    </div>
    <div class="b-tabs" role="tablist">${tabs.map(([k, l]) => `<button data-tab="${k}" role="tab" aria-pressed="${B.tab === k}" aria-selected="${B.tab === k}">${l}</button>`).join('')}</div>
    ${opts}
    <p class="b-note">${wins ? `Du hast ${wins} ${wins === 1 ? 'Monatssieg' : 'Monatssiege'}.` : 'Noch kein Monatssieg.'} Mit Siegen schaltest du Pilotenbrille, goldene Schuhe, Umhang, Medaille und Krone frei.</p>
  </div>`;
}
function bindBuilder(card, B, wins, rerender) {
  card.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { B.tab = b.dataset.tab; rerender(); card.querySelector(`[data-tab="${B.tab}"]`)?.focus(); });
  card.querySelectorAll('[data-pose]').forEach(b => b.onclick = () => { B.pose = b.dataset.pose; rerender(); });
  card.querySelectorAll('[data-random]').forEach(b => b.onclick = () => { B.av = normalize(randomAvatar(wins)); B.color = JERSEYS[Math.floor(Math.random() * JERSEYS.length)]; rerender(); });
  card.querySelectorAll('[data-set]').forEach(b => b.onclick = () => {
    const [k, v] = b.dataset.set.split(':');
    if (k === 'jersey') B.color = v; else B.av = { ...B.av, [k]: v };
    const tabsScroll = card.querySelector('.b-tabs')?.scrollLeft || 0;
    rerender();
    const t = card.querySelector('.b-tabs'); if (t) t.scrollLeft = tabsScroll;
    card.querySelector(`[data-set="${b.dataset.set}"]`)?.focus({ preventScroll: true });
  });
}
function renderEditor(card) {
  const B = S.edit, wins = winCounts()[S.me] || 0;
  card.innerHTML = `<h3>Deine Figur</h3>${builderHTML(B, wins, 'e')}
    <div class="row-btns"><button class="primary" id="saveAv">Speichern</button><button class="secondary" id="cancelAv">Abbrechen</button></div>`;
  bindBuilder(card, B, wins, () => renderEditor(card));
  $('#saveAv').onclick = saveFigure;
  $('#cancelAv').onclick = () => { S.edit = null; renderEntry(); updateFab(); };
}
async function saveFigure() {
  const B = S.edit; const { id, ...p } = S.players[S.me];
  try {
    await S.store.set('players', S.me, { name: p.name, created: p.created || Date.now(), avatar: B.av, color: B.color });
    S.edit = null; toast('Deine Figur ist gespeichert');
  } catch (e) { handleWriteError(e); }
  render();
}

/* ---------- Anmeldung ---------- */
function renderLogin(card) {
  const L = S.login; const existing = Object.entries(S.players).sort((a, b) => a[1].name.localeCompare(b[1].name));
  const key = slug(L.name); const taken = key && S.players[key];
  card.innerHTML = `
    <h3>Mitmachen</h3>
    ${existing.length ? `<div class="field"><span class="lbl">Schon dabei? Tippe auf deinen Namen</span>
      <div class="players-quick">${existing.map(([id, p]) => `<button class="chip" data-login="${esc(id)}"><span class="sw" style="background:${esc(p.color)};box-shadow:0 0 0 1px var(--line)"></span>${esc(p.name)}</button>`).join('')}</div></div>` : ''}
    <div class="field"><label for="nameIn">${existing.length ? 'Oder neu anmelden' : 'Dein Benutzername'}</label>
      <input type="text" id="nameIn" maxlength="24" autocomplete="nickname" placeholder="z. B. Hauke" value="${esc(L.name)}">
    </div>
    ${taken ? `<p class="summary">„${esc(S.players[key].name)}“ gibt es schon. Mit „Los geht’s“ meldest du dich als diese Person an.</p>` : `<div class="field"><span class="lbl">Bau deine Figur</span>${builderHTML(L, 0, 'n')}</div>`}
    <button class="primary" id="loginBtn" ${key ? '' : 'disabled'}>Los geht’s</button>
    <p class="summary">Kein Passwort nötig. Dein Name wird auf diesem Gerät gemerkt. Die Figur kannst du später jederzeit umbauen.</p>`;
  card.querySelectorAll('[data-login]').forEach(b => b.onclick = () => loginAs(b.dataset.login));
  bindBuilder(card, L, 0, () => renderLogin(card));
  const ni = $('#nameIn');
  ni.oninput = e => {
    const was = !!(slug(L.name) && S.players[slug(L.name)]), hadKey = !!slug(L.name);
    L.name = e.target.value;
    const is = !!(slug(L.name) && S.players[slug(L.name)]);
    if (was !== is || hadKey !== !!slug(L.name)) { const pos = e.target.selectionStart; renderLogin(card); const n = $('#nameIn'); n.focus(); n.setSelectionRange(pos, pos); }
  };
  ni.onkeydown = e => { if (e.key === 'Enter') register(); };
  $('#loginBtn').onclick = register;
}
function loginAs(id) { S.me = id; lsSet('monatslauf.me', id); S.login.name = ''; render(); toast(`Hallo ${pname(id)}!`); }
async function register() {
  const name = S.login.name.trim().slice(0, 24); const key = slug(name);
  if (!key) return;
  if (S.players[key]) return loginAs(key);
  const doc = { name, color: S.login.color, avatar: S.login.av, created: Date.now() };
  try { await S.store.set('players', key, doc); S.players[key] ||= { id: key, ...doc }; loginAs(key); }
  catch (e) { handleWriteError(e); }
}

/* ---------- Liste und Siege ---------- */
function renderFeed() {
  const list = S.entries.filter(e => mkey(e.date) === S.view)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0)).slice(0, 12);
  $('#feed').innerHTML = list.length ? list.map(e => {
    const s = SPORT[e.sport] || SPORT.anderes;
    return `<li><span class="sw" style="background:${s.color}"></span>
      <span><b>${esc(pname(e.player))}</b> · ${s.label} <span class="muted">· ${fmtDate(e.date)}</span></span>
      <span class="min">${e.minutes}′ <span class="pts">${fmtPts(pointsOf(e.minutes, e.sport))}</span></span>
      ${e.player === S.me && S.view === current() ? `<button class="del" data-del="${esc(e.id)}" aria-label="Eintrag löschen" title="Löschen">×</button>` : '<span></span>'}</li>`;
  }).join('') : `<li style="grid-template-columns:1fr"><span class="muted">${S.loaded.entries ? 'Noch keine Einträge in diesem Monat.' : 'Lade …'}</span></li>`;
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (b.dataset.armed) { try { await S.store.del('entries', b.dataset.del); toast('Eintrag gelöscht'); } catch (e) { handleWriteError(e); } }
    else { b.dataset.armed = '1'; b.textContent = 'Löschen?'; b.style.fontSize = '13px'; b.style.color = 'var(--danger)'; }
  });
}
function renderHall() {
  const w = winners(); const last = lastDayOf(current());
  $('#hall').innerHTML = w.length ? w.map(x => `<li><span class="m">${monthName(x.month)}</span><span><b>${x.ids.map(id => esc(pname(id))).join(' & ')}</b> <span class="muted">${fmtPts(x.max)}</span></span></li>`).join('')
    : `<li><span class="muted">Der erste Monatssieg wird am ${last.getDate()}. ${MONTHS[last.getMonth()]} um 23:59 vergeben.</span></li>`;
}

let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2800); }

$('#prevM').onclick = () => { S.view = shiftMonth(S.view, -1); render(); };
$('#nextM').onclick = () => { if (S.view < current()) { S.view = shiftMonth(S.view, 1); render(); } };
$('#fab').onclick = () => $('#entryCard').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { entryInView = e.isIntersecting; updateFab(); }, { threshold: .15 }).observe($('#entryCard'));
else entryInView = false;

/* ---------- Aufs Handy holen / installieren ---------- */
(function setupInvite() {
  const url = location.protocol.startsWith('http') ? location.origin + location.pathname.replace(/index\.html$/, '') : '';
  const qr = $('#qr');
  if (url && window.QRCode) new QRCode(qr, { text: url, width: 118, height: 118, colorDark: '#10182A', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
  else qr.hidden = true;
  $('#shareBtn').onclick = async () => {
    if (!url) return toast('Der Link funktioniert erst, wenn die Seite online ist.');
    if (navigator.share) { try { await navigator.share({ title: 'Monatslauf', text: 'Mach mit beim Monatslauf!', url }); } catch {} }
    else if (navigator.clipboard) { await navigator.clipboard.writeText(url); toast('Link kopiert'); }
    else toast(url);
  };
  let deferred = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('#installBtn').hidden = false; });
  addEventListener('appinstalled', () => { $('#installBtn').hidden = true; toast('Monatslauf ist installiert'); });
  $('#installBtn').onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; $('#installBtn').hidden = true; };
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  $('#iosHint').hidden = !(ios && !standalone);
  if (standalone) $('#inviteCard h3').textContent = 'Leute einladen';
})();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

/* ---------- Start ---------- */
function start(store) {
  S.store = store;
  const banner = $('#banner');
  if (!store.shared) { banner.hidden = false; banner.textContent = 'Demo-Modus: Supabase ist noch nicht eingerichtet. Einträge bleiben nur auf diesem Gerät. Die Anleitung steht in der README.'; }
  store.onStatus(online => { banner.hidden = online; banner.textContent = online ? '' : 'Offline: Du siehst den letzten gespeicherten Stand. Neue Einträge gehen erst wieder mit Internet.'; });
  const onErr = () => { S.readOnly = true; render(); };
  store.subscribe('players', docs => { S.players = Object.fromEntries(docs.map(d => [d.id, d])); S.loaded.players = true; render(); }, onErr);
  store.subscribe('entries', docs => {
    S.entries = docs.filter(d => d.date && d.minutes > 0 && d.player);
    const first = !S.loaded.entries; S.loaded.entries = true;
    render();
    if (first) S.rankSnapshot = null;
    checkOvertake();
  }, onErr);
}
render();
start(createStore(CFG));
