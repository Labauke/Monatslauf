/* Monatslauf – Figuren „Knuddel“ (Chibi) und Baukasten.
   Läuft im Browser (window.Figure) und in Node (module.exports, für tools/make-icons.js).
     figureSVG({ id, uid, avatar, color, wins, pose, idle, lead, sleep, web, portrait }) -> SVG-String
   pose: run | cheer | climb | workout | yoga | bike | sofa (sleep:true zeigt immer die Schlafpose).
   portrait:true liefert ein Kopf-und-Schulter-Bild (Kopfzeile, Baukasten-Kacheln).
   Koordinaten: Figur im Raster 0..64 x 0..70, Boden bei y = 66. Ausgeliefert wird der Ausschnitt
   VIEWBOX (Seitenverhältnis 64:70), Porträts PORTRAIT_VIEWBOX (ebenfalls 64:70).
   Animationen: css/app.css, Abschnitt „Figuren-Animationen“ (Wurzelklasse .kn am <svg>).
   Datenmodell (gemeinsame Datenbank, unverändert): { base, skin, hair, hairColor, hat, glasses, beard, extra, shoes },
   ältere Einträge dürfen ein String ('panda') oder {} sein – normalize() macht daraus einen vollständigen Avatar. */
(function (global) {
  'use strict';
  const OUT = '#262A44';      // weiche, dunkle Kontur (kein reines Schwarz)
  const EYE = '#262A44';
  const OW = 1.5;             // Konturstärke aller Silhouetten
  const BLUSH = '#FF6F91';
  const CAPE = '#C2344D';
  // Ausschnitt der ganzen Figur bzw. des Porträts (jeweils Seitenverhältnis 64:70), Boden bei y = GROUND
  const VIEWBOX = '5 8 54 59.06', PORTRAIT_VIEWBOX = '10.5 3.5 43 47.03', GROUND = 66;

  const f = n => Math.round(n * 100) / 100;
  const rgb = h => { let s = String(h || '').replace('#', ''); if (s.length === 3) s = s.replace(/./g, c => c + c); const n = parseInt(s, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const shade = (h, k) => { const [r, g, b] = rgb(h); return hex(r * (1 - k), g * (1 - k), b * (1 - k)); };
  const tint = (h, k) => { const [r, g, b] = rgb(h); return hex(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k); };
  const scale = (h, k) => { const [r, g, b] = rgb(h); return hex(r * k, g * k, b * k); };
  const lum = h => { const [r, g, b] = rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  const dist = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  // Farben kommen aus der gemeinsamen Datenbank und landen roh im SVG (innerHTML): nur #RRGGBB zulassen
  const hexOr = (c, d) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : d;
  function hash(s) { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

  /* ---------- Datenmodell (liegt in der gemeinsamen Datenbank, nur erweitern, nie umbenennen) ---------- */
  const BASES = [
    { id: 'mensch', label: 'Mensch' }, { id: 'fuchs', label: 'Fuchs' }, { id: 'baer', label: 'Bär' }, { id: 'panda', label: 'Panda' },
    { id: 'katze', label: 'Katze' }, { id: 'hase', label: 'Hase' }, { id: 'frosch', label: 'Frosch' }, { id: 'einhorn', label: 'Einhorn' },
    { id: 'tiger', label: 'Tiger' }, { id: 'pinguin', label: 'Pinguin' }, { id: 'roboter', label: 'Roboter' },
  ];
  const BASE = Object.fromEntries(BASES.map(b => [b.id, b]));
  const SKINS = ['#F7D7BD', '#EAB88E', '#C98E62', '#8F5B3A', '#5E3B25'];
  const HAIR_COLORS = ['#2A2238', '#6B4226', '#E7C16B', '#C8552D', '#D7DCE5', '#FF5DA2', '#4FA3FF'];
  const JERSEYS = ['#FF7A45', '#FFD23F', '#FFFFFF', '#6EEBB0', '#FF8FB8', '#C9F26B', '#FFB4F0', '#9EE7FF', '#E23E3E', '#23283A'];
  const PARTS = {
    hair:    [['kurz', 'Kurz'], ['stachel', 'Stacheln'], ['lang', 'Lang'], ['zopf', 'Zopf'], ['dutt', 'Dutt'], ['locken', 'Locken'], ['irokese', 'Irokese'], ['glatze', 'Glatze']],
    hat:     [['keine', 'Keine'], ['cap', 'Cap'], ['muetze', 'Mütze'], ['stirnband', 'Stirnband'], ['helm', 'Helm'], ['cowboy', 'Cowboyhut'], ['party', 'Partyhut'], ['krone', 'Krone', 3]],
    glasses: [['keine', 'Keine'], ['rund', 'Rund'], ['nerd', 'Nerd'], ['sport', 'Sportbrille'], ['pilot', 'Pilotenbrille', 1]],
    beard:   [['keiner', 'Keiner'], ['schnurrbart', 'Schnurrbart'], ['kinnbart', 'Kinnbart'], ['vollbart', 'Vollbart']],
    extra:   [['nichts', 'Nichts'], ['schal', 'Schal'], ['kopfhoerer', 'Kopfhörer'], ['medaille', 'Medaille', 2], ['umhang', 'Umhang', 2]],
    shoes:   [['weiss', 'Weiß'], ['rot', 'Rot'], ['schwarz', 'Schwarz'], ['gold', 'Gold', 1]],
  };
  const DEFAULT = { base: 'mensch', skin: SKINS[1], hair: 'kurz', hairColor: HAIR_COLORS[1], hat: 'keine', glasses: 'keine', beard: 'keiner', extra: 'nichts', shoes: 'weiss' };
  function normalize(av, id) {
    if (typeof av === 'string') av = { base: av };
    if (!av || typeof av !== 'object') av = {};
    const out = { ...DEFAULT, ...av };
    if (!av.base && id) out.base = BASES[hash(id) % BASES.length].id;
    if (!BASE[out.base]) out.base = DEFAULT.base;
    // nur bekannte Teile und Hex-Farben übernehmen (fremde Werte aus der Datenbank nie ins SVG/HTML), gesperrte Teile filtert allowed()
    for (const [k, opts] of Object.entries(PARTS)) if (!opts.some(o => o[0] === out[k])) out[k] = DEFAULT[k];
    out.skin = hexOr(out.skin, DEFAULT.skin); out.hairColor = hexOr(out.hairColor, DEFAULT.hairColor);
    return out;
  }
  function allowed(av, wins = 0) {
    const out = { ...av };
    for (const [k, opts] of Object.entries(PARTS)) {
      const o = opts.find(x => x[0] === out[k]);
      if (!o || (o[2] || 0) > wins) out[k] = DEFAULT[k];
    }
    return out;
  }
  function randomAvatar(wins = 0) {
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const part = k => pick(PARTS[k].filter(o => (o[2] || 0) <= wins))[0];
    const human = Math.random() < .6;
    return {
      base: human ? 'mensch' : pick(BASES.slice(1)).id, skin: pick(SKINS), hair: part('hair'), hairColor: pick(HAIR_COLORS),
      hat: Math.random() < .5 ? 'keine' : part('hat'), glasses: Math.random() < .6 ? 'keine' : part('glasses'),
      beard: Math.random() < .7 ? 'keiner' : part('beard'), extra: Math.random() < .5 ? 'nichts' : part('extra'), shoes: part('shoes'),
    };
  }

  /* ---------- Aussehen der Grundfiguren (nur Darstellung) ---------- */
  const KIND = {
    fuchs:   { fur: '#F07A2E', chest: '#FFF4E8', hand: '#4B2E2B', tail: 'fox', ears: 'fox', face: 'fox' },
    baer:    { fur: '#9A6440', chest: '#E8C29A', tail: 'round', ears: 'round', inner: '#E8C29A', face: 'bear' },
    panda:   { fur: '#FFFFFF', limb: '#30354D', chest: '#FFFFFF', tail: 'round', ears: 'round', earC: '#30354D', inner: '#30354D', face: 'panda' },
    katze:   { fur: '#A3ACBE', chest: '#FFFFFF', hand: '#FFFFFF', tail: 'cat', ears: 'cat', face: 'cat' },
    hase:    { fur: '#F4EEF5', chest: '#FFFFFF', tail: 'fluff', ears: 'bunny', face: 'bunny' },
    frosch:  { fur: '#6CCB5F', chest: '#D6F3A6', face: 'frog', eyeY: -8.4, eyeX: 6.3 },
    einhorn: { fur: '#FFFFFF', chest: '#FFFFFF', hand: '#EFE4FF', tail: 'rainbow', ears: 'uni', face: 'uni' },
    tiger:   { fur: '#F59A23', chest: '#FFFFFF', tail: 'tiger', ears: 'round', inner: '#FFFFFF', face: 'tiger', rings: '#3A2A2A' },
    pinguin: { fur: '#30354D', limb: '#30354D', chest: '#FFFFFF', shin: '#FFA42E', tail: 'peng', face: 'peng', deepV: true },
    roboter: { fur: '#C7CFDC', limb: '#9AA4B8', chest: '#8C96A8', face: 'robot', robot: true },
  };

  /* ---------- Posen ----------
     head/body: [x, y, Neigung°]; Arme {s Schulter, e Ellbogen, h Hand}, Beine {s Hüfte, e Knie, h Fuß}.
     z: 'under' (Standard) vor dem Körper gezeichnet, Gelenk versteckt; 'over' nach dem Körper; 'top' nach dem Kopf.
     far: hinteres Glied (leicht abgedunkelt). foot: 'front' | 'side' | 'sole'. toe: Schuhdrehung.
     fl: Ankerpunkt der Führungs-Flammen (Ferse bzw. Hinterrad). */
  const POSES = {
    stand: { view: 'front', head: [32, 31, 0], body: [32, 49, 0], expr: 'smile', foot: 'front',
      arms: [{ s: [25.4, 45], e: [22.8, 49], h: [21.9, 53.2], cls: 'aL' }, { s: [38.6, 45], e: [41.2, 49], h: [42.1, 53.2], cls: 'aR' }],
      legs: [{ s: [28.8, 54.5], e: [28, 59], h: [27.2, 63], toe: -6, cls: 'lL' }, { s: [35.2, 54.5], e: [36, 59], h: [36.8, 63], toe: 6, cls: 'lR' }] },
    // Jubeln: Arme als weites V, Hände neben den Ohren. Gestreckt nur wenig länger als die angewinkelten Arme der anderen Posen
    // (Podest: Sieger jubelt direkt neben laufenden Figuren)
    cheer: { view: 'front', head: [32, 30.4, 0], body: [32, 48.4, 0], expr: 'cheer', foot: 'front', shadow: [32, 11], fl: [23.2, 63.4],
      arms: [{ s: [25.6, 43.4], e: [20, 40.4], h: [15.2, 35.4], cls: 'aL' }, { s: [38.4, 43.4], e: [44, 40.4], h: [48.8, 35.4], cls: 'aR' }],
      legs: [{ s: [28.8, 54], e: [27.8, 58.6], h: [26.8, 62.8], toe: -10, cls: 'lL' }, { s: [35.2, 54], e: [36.2, 58.6], h: [37.2, 62.8], toe: 10, cls: 'lR' }] },
    // Laufen: beide Beine aus einem Hüftpunkt (Seitenansicht), vorne Knie hoch, hinten Ferse hoch; vorderer Arm an der Körperkante
    run: { view: 'side', look: 3.2, head: [34.6, 30.2, 6], body: [31, 47.6, 12], expr: 'run', foot: 'side', shadow: [30, 12], fl: [19.4, 58.6],
      arms: [{ s: [29.2, 41.8], e: [24.2, 44.2], h: [21.6, 39.9], far: true, cls: 'ab' }, { s: [37.2, 44.2], e: [40, 49.1], h: [43.6, 45.5], z: 'over', cls: 'af' }],
      legs: [{ s: [30.2, 53.8], e: [35.5, 56.6], h: [35.1, 62], toe: 8, far: true, cls: 'lA' }, { s: [30.2, 53.8], e: [26.2, 58.3], h: [20.8, 57.7], toe: 100, cls: 'lC' }] },
    bike: { view: 'side', look: 3.4, head: [38, 28.4, 8], body: [30.6, 44.4, 22], expr: 'run', foot: 'side', shadow: [32, 22], fl: [12.6, 62.4], flS: .78,
      arms: [{ s: [33.6, 41.6], e: [38.2, 45.8], h: [42.6, 44], far: true, cls: 'ab' }, { s: [35.6, 42.6], e: [40.2, 46.8], h: [44.6, 44.8], z: 'top', cls: 'af' }],
      legs: [{ s: [27.6, 50.6], e: [32.2, 51.8], h: [28.6, 55.6], toe: 12, far: true, cls: 'kb' }, { s: [29.2, 51.2], e: [34.2, 53.8], h: [32.8, 59.2], toe: 14, cls: 'kf' }] },
    // Klettern: Profil an einer Wandkante rechts, oberer Arm gestreckt auf einem Griff, Knie hoch, Fuß auf einem Tritt
    // Hängebein angewinkelt: der Fuß bleibt auch beim Pendeln über der Bodenlinie
    climb: { view: 'side', look: 3.6, head: [29.6, 30.6, -8], body: [31, 47.8, 8], expr: 'smile', foot: 'side', fl: [28.6, 62.2],
      arms: [{ s: [33.8, 43.2], e: [39.2, 46.4], h: [44.6, 48.2], far: true, cls: 'cF' }, { s: [36.4, 43.2], e: [42, 40.4], h: [45.4, 33.6], z: 'over', cls: 'cN' }],
      legs: [{ s: [29.6, 54.2], e: [27.8, 58.8], h: [31.4, 60.6], toe: 34, far: true, cls: 'cD' }, { s: [32.4, 53.8], e: [39.4, 51.6], h: [41.4, 57.6], toe: 2, z: 'over', cls: 'cK' }] },
    // Hantel: Kreuzheben – Stange auf Hüfthöhe vor den Oberschenkeln, große Scheiben neben den Beinen, nichts kollidiert mit dem Kopf
    workout: { view: 'front', head: [32, 32.4, 0], body: [32, 50.2, 0], expr: 'effort', foot: 'front', shadow: [32, 13], fl: [22.8, 64.4], flS: .8, flFront: true, cape: [17, 11.8],
      arms: [{ s: [25.6, 45.6], e: [22.6, 50.6], h: [21.8, 56], z: 'over', cls: 'wL' }, { s: [38.4, 45.6], e: [41.4, 50.6], h: [42.2, 56], z: 'over', cls: 'wR' }],
      legs: [{ s: [28.4, 55.6], e: [24.6, 59.2], h: [24.4, 63.4], toe: -14, cls: 'lL' }, { s: [35.6, 55.6], e: [39.4, 59.2], h: [39.6, 63.4], toe: 14, cls: 'lR' }] },
    yoga: { view: 'front', head: [32, 32.6, 0], body: [32, 50.6, 0], expr: 'calm', foot: 'front', fl: [22, 62.6], cape: [19.4, 11.6],
      arms: [{ s: [25.4, 46], e: [20.4, 49.8], h: [20.8, 55], cls: 'aL' }, { s: [38.6, 46], e: [43.6, 49.8], h: [43.2, 55], cls: 'aR' }],
      legs: [{ s: [28.2, 55.6], e: [21.8, 58.8], h: [29.8, 61.6], toe: 70, cls: 'lL' }, { s: [35.8, 55.6], e: [42.2, 58.8], h: [34.2, 61.6], toe: -70, cls: 'lR' }] },
    sofa: { view: 'front', head: [32, 32.8, -6], body: [32, 50.6, 0], expr: 'munch', foot: 'front', fl: [24, 63.6], cape: [16, 6],
      arms: [{ s: [25.6, 45.6], e: [20.8, 49], h: [17.8, 47.2], cls: 'sL' }, { s: [38.4, 45.8], e: [43.2, 47.8], h: [38.6, 42.6], z: 'top', cls: 'munch' }],
      legs: [{ s: [28.8, 57.6], e: [28.4, 60.6], h: [28, 63.2], z: 'over', toe: -4, cls: 'lL' }, { s: [35.2, 57.6], e: [35.6, 60.6], h: [36, 63.2], z: 'over', toe: 4, cls: 'lR' }] },
    sleep: { view: 'front', head: [30.4, 40, -16], body: [32, 56.2, -4], expr: 'sleep', foot: 'sole', shadow: [32, 15], cape: [18.4, 9.4],
      arms: [{ s: [25.4, 52.2], e: [22.8, 56.6], h: [22, 61], cls: 'aL' }, { s: [38.6, 51.6], e: [41.6, 56], h: [42.8, 60.4], cls: 'aR' }],
      legs: [{ s: [28.4, 61.6], e: [25.6, 63], h: [23, 63.4], toe: -14, cls: 'lL' }, { s: [35.8, 61.4], e: [38.6, 62.8], h: [41.2, 63.2], toe: 14, cls: 'lR' }] },
  };

  /* ---------- Hilfen ---------- */
  // runde Linienenden und -ecken stehen einmal am <svg> (spart gut 15 % Text), hier nur Abweichungen
  const ln = (d, w, c, cap = 'round', extra = '') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${f(w)}"${cap === 'round' ? '' : ` stroke-linecap="${cap}"`}${extra}/>`;
  const G = (cls, x, y, inner) => `<g class="j ${cls}" style="transform-origin:${f(x)}px ${f(y)}px">${inner}</g>`;
  const S = `stroke="${OUT}" stroke-width="${OW}"`;
  const s1 = w => `stroke="${OUT}" stroke-width="${w}"`;
  // "Wolke": mehrere Kreise mit gemeinsamer Außenkontur (erst Kontur, dann Füllung)
  const cloud = (cs, fill) => cs.map(([x, y, r]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r + OW)}" fill="${OUT}"/>`).join('') + cs.map(([x, y, r]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}"/>`).join('');
  const mir = inner => inner + `<g transform="scale(-1 1)">${inner}</g>`;

  /* Glied aus Ober- und Unterteil mit eigenem Gelenk: erst beide Konturen, dann beide Füllungen.
     Der Unterteil steckt doppelt (Kontur/Füllung) in Gruppen mit gleicher Klasse -> gleiche Animation. */
  function limbSVG(L, o) {
    const [sx, sy] = L.s, [ex, ey] = L.e, [tx, ty] = L.h, W = o.w, WO = W + 2 * OW, c = L.cls || 'x';
    const up = `M${f(sx)} ${f(sy)}L${f(ex)} ${f(ey)}`, lo = `M${f(ex)} ${f(ey)}L${f(tx)} ${f(ty)}`;
    const at = t => [sx + (ex - sx) * t, sy + (ey - sy) * t];
    let upF = ln(up, W, o.upper);
    if (o.sleeve) {
      const [mx, my] = at(o.sleeveFrac);
      upF += ln(`M${f(sx)} ${f(sy)}L${f(mx)} ${f(my)}`, W + .2, o.sleeve, 'butt') + `<circle cx="${f(sx)}" cy="${f(sy)}" r="${f((W + .2) / 2)}" fill="${o.sleeve}"/>`;
      // Ärmelbund in der Akzentfarbe, wenn Trikot und Fell/Haut zu ähnlich sind
      if (o.cuff) { const [cx, cy] = at(o.sleeveFrac - .2); upF += ln(`M${f(cx)} ${f(cy)}L${f(mx)} ${f(my)}`, W + .2, o.cuff, 'butt'); }
    }
    let loF = ln(lo, W, o.lower);
    if (o.rings) loF += ln(lo, W, o.rings, 'butt', ' stroke-dasharray="1.1 1.9" stroke-dashoffset="-1"');
    if (o.joint) loF += `<circle cx="${f(ex)}" cy="${f(ey)}" r="1.5" fill="${o.joint}" ${s1(1)}/>`;
    loF += o.tip(tx, ty, L);
    return G(c + '-u', sx, sy, ln(up, WO, OUT) + G(c + '-l', ex, ey, ln(lo, WO, OUT)) + upF + G(c + '-l', ex, ey, loF));
  }

  function shoeSVG(x, y, kind, toe, col) {
    const [fill, stripe] = col;
    const at = `transform="translate(${f(x)} ${f(y)}) rotate(${toe})"`;
    if (kind === 'side') return `<g ${at}><path d="M-2.4 -2.3C0.6 -3.1 4.8 -2 5 0.8C5.1 2.4 4.1 2.8 2.8 2.8L-2.3 2.8C-3.7 2.8 -4 -1.5 -2.4 -2.3Z" fill="${fill}" ${S}/><path d="M-2.7 1.5L4.4 1.5" stroke="${stripe}" stroke-width="1.1"/></g>`;
    if (kind === 'sole') return `<g ${at}><ellipse cx="0" cy="0" rx="2.9" ry="3.4" fill="${fill}" ${S}/><ellipse cx="0" cy="0.3" rx="1.6" ry="2.1" fill="${stripe}" opacity=".85"/></g>`;
    return `<g ${at}><ellipse cx="0" cy="1" rx="3.4" ry="2.5" fill="${fill}" ${S}/><path d="M-2.5 2.3Q0 3.3 2.5 2.3" stroke="${stripe}" stroke-width="1.1" fill="none"/><ellipse cx="-1" cy=".2" rx="1" ry=".6" fill="#fff" opacity=".55"/></g>`;
  }

  /* ---------- Frisuren (Kopf-Koordinaten, Kopfmitte = 0,0; Kopf rx 12.6 / ry 11.8) ---------- */
  function hairSVG(av, s, T, covered) {
    const hc = av.hairColor, style = av.hair, side = s > 0;
    const P0 = (x, y) => `${f(x)} ${f(y)}`, pt = (x, y) => `${f(T(x))} ${f(y)}`;
    let behind = '', front = '';
    const lb = side ? 6 : 3, rb = side ? -1.6 : 3;
    const outer = `M${P0(-12.9, lb)}C${P0(-14.4, -6.5)} ${P0(-8.8, -13.4)} ${P0(0, -13.3)}C${P0(8.8, -13.4)} ${P0(14.4, -6.5)} ${P0(12.9, rb)}`;
    const rightLock = side ? `L${pt(11.8, -2.6)}L${pt(9.6, -3.2)}` : `Q${pt(11.6, 4)} ${pt(10.4, 2.6)}Q${pt(10.6, -1)} ${pt(9.6, -3.2)}`;
    const leftLock = side ? `Q${pt(-10.8, 0)} ${pt(-10.2, 3.6)}Q${pt(-11.4, 6.8)} ${P0(-12.9, lb)}Z` : `Q${pt(-10.6, -1)} ${pt(-10.4, 2.6)}Q${pt(-11.6, 4)} ${P0(-12.9, lb)}Z`;
    const fringe = `Q${pt(8.2, -1.2)} ${pt(6.2, -4.4)}Q${pt(4.4, -1.6)} ${pt(2, -4.8)}Q${pt(-.2, -1.6)} ${pt(-2.4, -4.8)}Q${pt(-4.4, -1.4)} ${pt(-6.4, -4.4)}Q${pt(-8.4, -1.2)} ${pt(-9.6, -3.2)}`;
    const cap = `<path d="${outer}${rightLock}${fringe}${leftLock}" fill="${hc}" ${S}/>`;
    switch (style) {
      case 'kurz': front = cap; break;
      case 'stachel':
        front = `<path d="M${P0(-12.9, lb)}L${P0(-13.6, -4.6)}L${P0(-16.4, -8.4)}L${P0(-12, -10.2)}L${P0(-12.4, -15.4)}L${P0(-6.8, -13.8)}L${P0(-4.6, -18.6)}L${P0(-.4, -15)}L${P0(3.6, -19)}L${P0(5.8, -14.2)}L${P0(11.4, -16)}L${P0(11.2, -10.6)}L${P0(16.2, -8.2)}L${P0(13.4, -4.4)}L${P0(12.9, rb)}L${pt(11, side ? -2 : 2.4)}L${pt(10.2, -3.4)}L${pt(7.8, -1.4)}L${pt(5.8, -5.2)}L${pt(3, -1.8)}L${pt(.8, -5.6)}L${pt(-2, -1.6)}L${pt(-4.2, -5.4)}L${pt(-6.8, -1.4)}L${pt(-8.8, -4.6)}L${pt(-10.4, -1.2)}L${pt(-11, lb - 1)}Z" fill="${hc}" ${S}/>`;
        break;
      case 'lang':
        behind = `<path d="M-11.4 -6.4C-15.2 -1.6 -15.4 6 -14.6 11.6Q-14.2 15.2 -11.2 14.2Q-9.2 16.4 -6.6 14.6L6.6 14.6Q9.2 16.4 11.2 14.2Q14.2 15.2 14.6 11.6C15.4 6 15.2 -1.6 11.4 -6.4Z" fill="${hc}" ${S}/>`;
        if (side) behind = `<g transform="translate(-2.4 0)">${behind}</g>`;
        front = `<path d="M${P0(-13.1, 8.4)}C${P0(-14.6, -6)} ${P0(-9, -13.5)} ${P0(0, -13.4)}C${P0(9, -13.5)} ${P0(14.6, -6)} ${P0(13.1, side ? 1.4 : 8.4)}${side ? `L${pt(11.8, .6)}` : `Q${pt(12.4, 9.8)} ${pt(11.2, 8.8)}`}C${pt(11.4, 1)} ${pt(8.4, -5.2)} ${pt(.8, -7.6)}Q${pt(0, -6.2)} ${pt(-.8, -7.6)}C${pt(-8.4, -5.2)} ${pt(-11.4, 1)} ${pt(-11.2, 8.8)}Q${pt(-12.4, 9.8)} ${P0(-13.1, 8.4)}Z" fill="${hc}" ${S}/>`;
        break;
      case 'zopf':
        behind = `<path d="M-10.4 -9.4C-17.8 -11.4 -22.2 -3 -20 4.6C-19 8.6 -16.2 10.4 -15.4 8.2C-17 3 -15.6 -2.4 -11 -3.6Z" fill="${hc}" ${S}/>`;
        front = `<path d="M${P0(-12.9, lb)}C${P0(-14.4, -6.5)} ${P0(-8.8, -13.4)} ${P0(0, -13.3)}C${P0(8.8, -13.4)} ${P0(14.4, -6.5)} ${P0(12.9, side ? -1.6 : 1.4)}Q${pt(11.6, -2.4)} ${pt(9.8, -3.6)}C${pt(6, -6.4)} ${pt(1, -5.6)} ${pt(-3, -2.6)}C${pt(-6, -.4)} ${pt(-9, .6)} ${pt(-10.4, 3)}Q${pt(-11.6, 4.6)} ${P0(-12.9, lb)}Z" fill="${hc}" ${S}/><circle cx="${f(side ? -11.6 : -11.8)}" cy="-6.6" r="2.1" fill="#FF6FA8" ${s1(1.1)}/>`;
        break;
      case 'dutt':
        // großer, hoher Dutt mit Haargummi – bei 56 px klar von "Kurz" zu unterscheiden. Unter Kappe, Mütze, Helm und
        // Cowboyhut sitzt er als tiefer Knoten im Nacken (oben auf dem Hut las er sich wie ein zweiter Bommel)
        if (covered) behind = side ? `<circle cx="-12.2" cy="1.6" r="4.6" fill="${hc}" ${S}/><rect x="-10.6" y="-.4" width="2.6" height="4.4" rx="1.3" fill="#FF6FA8" ${s1(1)}/>`
          : `<circle cx="-10.4" cy="8.4" r="3.9" fill="${hc}" ${S}/>`;
        else behind = `<circle cx="0" cy="-17.4" r="6.4" fill="${hc}" ${S}/><path d="M-3.4 -20.2Q-1 -22.4 2.2 -21.6" stroke="#fff" stroke-width="1.3" fill="none" opacity=".4"/>`;
        front = cap + (covered ? '' : `<rect x="${f(T(-4))}" y="-15.4" width="8" height="3" rx="1.5" fill="#FF6FA8" ${s1(1.1)}/>`);
        break;
      case 'locken': {
        const cs = []; for (let i = 0; i < 11; i++) { const a = Math.PI * (0.9 + i * 0.12); cs.push([Math.cos(a) * 11.6, Math.sin(a) * 10.6 - .6, 4.6]); }
        cs.push([-13.2, 6.4, 3.8], [13.2, 6.4, 3.8]);
        // Glanzbögen auf einzelnen Locken: die Wolke bleibt auch dunkel (auf dunkler Haut) lesbar
        const hi = (pts, d) => ln(pts.map(([x, y]) => `M${f(x - 1.9 * d)} ${f(y - .5 * d)}Q${f(x - .8 * d)} ${f(y - 2.3 * d)} ${f(x + 1.1 * d)} ${f(y - 2.2 * d)}`).join(''), .9, tint(hc, .5), 'round', ' opacity=".8"');
        behind = cloud(cs, hc) + hi([cs[3], cs[5], cs[7]], 1.2);
        if (side) behind = `<g transform="translate(-2.2 0)">${behind}</g>`;
        const fc = [[-8.4, -4.8, 3], [-4.4, -6.8, 3.2], [0, -7.4, 3.2], [4.4, -6.8, 3.2], [8.4, -4.8, 3]].map(([x, y, r]) => [T(x), y, r]);
        front = cloud(fc, hc) + hi([fc[1], fc[3]], .9);
        break;
      }
      case 'irokese':
        front = `<path d="M${pt(-10.6, -4)}Q${pt(0, -8.8)} ${pt(10.6, -4)}" stroke="${shade(hc, .1)}" stroke-width="3" fill="none" opacity=".28"/>`
          + `<path d="M${pt(-3.2, -9.4)}C${pt(-4.8, -14.6)} ${pt(-3.4, -19.6)} ${pt(-1.4, -21.2)}L${pt(-.2, -17.4)}L${pt(1.6, -22)}L${pt(2.8, -17.2)}L${pt(4.8, -20.2)}C${pt(5.6, -15)} ${pt(4.6, -11.2)} ${pt(3.2, -9.4)}Z" fill="${hc}" ${S}/>`;
        break;
      case 'glatze':
        front = `<path d="M${pt(-6.4, -7.6)}Q${pt(-3, -10.6)} ${pt(1.2, -9.8)}" stroke="#fff" stroke-width="1.7" fill="none" opacity=".65"/>`; break;
    }
    return { behind, front, ears: !['lang', 'locken'].includes(style) };
  }

  /* Haar (auch Bart und Brauen) muss sich von der Haut abheben: sehr dunkles Haar etwas aufhellen (sonst verschmilzt es
     mit der Kontur), ähnliche Töne auf dunkler Haut (z. B. Braun auf Dunkel) abdunkeln bzw. aufhellen, der Farbton bleibt */
  function hairOn(hc, skin) {
    if (lum(hc) < .2) return tint(hc, .12);
    if (lum(skin) > .5) return hc; // auf heller Haut trennt die Kontur genug
    const up = lum(hc) >= lum(skin);
    let c = hc;
    for (let i = 1; i <= 8 && dist(c, skin) < 72; i++) c = up ? scale(hc, 1 + i * .08) : shade(hc, i * .06);
    return c;
  }

  /* ---------- Kopf ---------- */
  function headSVG(av, human, k, ctx) {
    const { view, s, expr, lead, clip, defs, color } = ctx;
    if (human) av = { ...av, hairColor: hairOn(av.hairColor, av.skin) };
    const T = x => x + s * (1 - Math.min(1, Math.abs(x) / 13));
    const side = view === 'side';
    const id = human ? 'mensch' : av.base;
    const fur = human ? av.skin : k.fur;
    const frog = id === 'frosch', robot = !!k.robot, panda = k.face === 'panda';
    const shapeAttr = robot ? `<rect x="-12.4" y="-11.2" width="24.8" height="22.4" rx="6"` : frog ? `<ellipse cx="0" cy=".8" rx="13.4" ry="10.8"` : `<ellipse cx="0" cy="0" rx="12.6" ry="11.8"`;
    defs.push(`<clipPath id="${clip}">${shapeAttr}/></clipPath>`);
    const covered = ['cap', 'muetze', 'helm', 'cowboy'].includes(av.hat);
    let behind = '', inClip = '', face = '', eyes = '', glasses = '', earsTop = '', frogBumps = '';
    const EX = k.eyeX || 4.7, EY = k.eyeY ?? 2.2;
    const e0 = T(-EX), e1 = T(EX), mx = T(0);

    /* Ohren, Mähnen, Frisur */
    let hair = { behind: '', front: '', ears: true };
    if (human) {
      hair = hairSVG(av, s, T, covered);
      behind += hair.behind;
      const ear = (x, y) => `<circle cx="${f(x)}" cy="${f(y)}" r="2.5" fill="${av.skin}" ${S}/><path d="M${f(x - .6)} ${f(y - 1)}Q${f(x + .8)} ${f(y)} ${f(x - .6)} ${f(y + 1)}" stroke="${shade(av.skin, .25)}" stroke-width=".9" fill="none"/>`;
      if (!side && hair.ears) behind += ear(-12.3, 2.8) + ear(12.3, 2.8);
    } else {
      const ec = k.earC || k.fur;
      switch (k.ears) {
        case 'fox': behind += mir(`<path d="M-12 -2.4L-11.4 -16.6Q-11 -18.4 -9.6 -17.2L-2.6 -10.6Z" fill="${k.fur}" ${S}/><path d="M-10.4 -6L-10.2 -14.2L-5.4 -10Z" fill="#FFE2CC"/><path d="M-11.45 -15.2L-11.4 -16.6Q-11 -18.4 -9.6 -17.2L-8.2 -15.9Z" fill="${OUT}"/>`); break;
        case 'cat': behind += mir(`<path d="M-12.2 -1.6L-11.4 -15.6Q-11 -17.2 -9.6 -16.2L-2.6 -10.8Z" fill="${k.fur}" ${S}/><path d="M-10.6 -5L-10.1 -13.2L-5.4 -10.2Z" fill="#FF9EBB"/>`); break;
        case 'round': behind += mir(`<circle cx="-9.4" cy="-8.8" r="4.5" fill="${ec}" ${S}/><circle cx="-9.4" cy="-8.8" r="2.3" fill="${k.inner}"/>`); break;
        case 'bunny': {
          // Hasenohren stecken durch Kappe, Mütze und Co.; Krone und Partyhut sitzen davor (sonst verdecken die Ohren sie fast ganz)
          const ears = mir(`<g transform="rotate(-10 -5 -12)"><ellipse cx="-5" cy="-19" rx="3.6" ry="8.8" fill="${k.fur}" ${S}/><ellipse cx="-5" cy="-18.4" rx="1.7" ry="6.2" fill="#FFB6CB"/></g>`);
          if (['party', 'krone'].includes(av.hat)) behind += ears; else earsTop += ears;
          break;
        }
        case 'uni': behind += mir(`<g transform="rotate(-28 -9 -9.6)"><ellipse cx="-9" cy="-10.6" rx="2.8" ry="4.8" fill="${k.fur}" ${S}/><ellipse cx="-9" cy="-10.2" rx="1.2" ry="2.8" fill="#FFB6CB"/></g>`); break;
      }
      // Froschaugen-Hügel: eigene Ebene, damit Hüte dahinter sitzen können
      if (frog) frogBumps = [e0, e1].map(x => `<circle cx="${f(x)}" cy="${EY}" r="5.4" fill="${k.fur}" ${S}/>`).join('');
      if (id === 'einhorn') behind += [[-11, -6.4, '#C89BFF'], [-13.2, -1.2, '#FF8FB8'], [-13.2, 4.2, '#FFD23F'], [-11.4, 9, '#6EEBB0']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="4" fill="${c}" ${s1(1.3)}/>`).join('');
      if (robot) behind += `<path d="M0 -11L0 -16.4" stroke="${OUT}" stroke-width="1.8"/><circle cx="0" cy="-17.8" r="2.4" fill="#FF4D6A" ${S}/><circle cx="-.7" cy="-18.5" r=".7" fill="#fff" opacity=".8"/>`
        + `<rect x="-14.8" y="-2.6" width="3" height="6" rx="1.2" fill="#8C96A8" ${s1(1.2)}/><rect x="11.8" y="-2.6" width="3" height="6" rx="1.2" fill="#8C96A8" ${s1(1.2)}/>`;
      /* Fellzeichnung im Kopf-Clip */
      switch (k.face) {
        case 'fox': inClip += `<path d="M-14 .6C-10.6 .4 -7.4 5.8 ${f(T(-2.8))} 5.2Q${f(mx)} 3.8 ${f(T(2.8))} 5.2C7.4 5.8 10.6 .4 14 .6L14 14L-14 14Z" fill="${k.chest}"/>`; break;
        case 'bear': inClip += `<ellipse cx="${f(mx)}" cy="6.3" rx="4" ry="3.2" fill="#E8C29A"/>`; break;
        case 'panda': inClip += [e0, e1].map((x, i) => `<ellipse cx="${f(x)}" cy="${EY + .5}" rx="3.3" ry="4" transform="rotate(${i ? 28 : -28} ${f(x)} ${EY})" fill="#30354D"/>`).join(''); break;
        case 'cat': inClip += [-2.6, 0, 2.6].map(x => ln(`M${f(T(x))} -12.4L${f(T(x * .85))} -8.6`, 1.4, shade(k.fur, .28))).join(''); break;
        case 'tiger': inClip += [-3, 0, 3].map(x => ln(`M${f(T(x))} -12.6L${f(T(x * .8))} ${x ? -9 : -8.2}`, 1.5, '#3A2A2A')).join('')
            + ln('M-13.4 -.6L-9.8 .4M-13.4 2.8L-10.2 2.8M13.4 -.6L9.8 .4M13.4 2.8L10.2 2.8', 1.4, '#3A2A2A')
            + `<ellipse cx="${f(mx)}" cy="6.4" rx="4.2" ry="3.1" fill="#fff"/>`; break;
        case 'peng': inClip += `<ellipse cx="${f(T(-4.2))}" cy="2" rx="5" ry="5.6" fill="#fff"/><ellipse cx="${f(T(4.2))}" cy="2" rx="5" ry="5.6" fill="#fff"/><ellipse cx="${f(mx)}" cy="6.4" rx="7.4" ry="5.2" fill="#fff"/>`; break;
        case 'frog': inClip += `<ellipse cx="${f(mx)}" cy="8.8" rx="9" ry="4.6" fill="${k.chest}"/>`; break;
      }
    }

    /* Gesicht: Wangen, Bart, Nase, Mund (-> face); Augen (-> eyes); Brillen (-> glasses) */
    const animal = !human && !robot;
    const beardHi = human ? tint(av.hairColor, .42) : '#fff';
    const blush = (x, w = 1) => `<ellipse cx="${f(x)}" cy="${frog ? 5.6 : 5.8}" rx="${f(2.3 * w)}" ry="1.35" fill="${BLUSH}" opacity=".45"/>`;
    if (!robot) face += blush(T(frog ? -9 : -8.3), side ? .8 : 1) + blush(T(frog ? 9 : 8.3));
    if (human && av.beard === 'vollbart') face += `<path d="M-12.3 1.6C-12.2 9 -6.4 13 ${f(mx)} 13C6.4 13 12.2 9 12.3 1.6C10.8 4.8 8.4 6.4 ${f(T(4.2))} 6.6Q${f(mx)} 4.4 ${f(T(-4.2))} 6.6C-8.4 6.4 -10.8 4.8 -12.3 1.6Z" fill="${av.hairColor}" ${s1(1.2)}/>`
      + ln(`M${f(T(-7.4))} 9.4Q${f(mx)} 12.6 ${f(T(7.4))} 9.4`, .8, beardHi, 'round', ' opacity=".7"');
    const my = EY + 4.5;
    if (human && av.beard === 'kinnbart') face += `<path d="M${f(mx - 3.4)} ${f(my + 2.2)}Q${f(mx)} ${f(my + 3.2)} ${f(mx + 3.4)} ${f(my + 2.2)}Q${f(mx + 3.2)} ${f(my + 7.6)} ${f(mx)} ${f(my + 8.8)}Q${f(mx - 3.2)} ${f(my + 7.6)} ${f(mx - 3.4)} ${f(my + 2.2)}Z" fill="${av.hairColor}" ${s1(1.1)}/>`
      + ln(`M${f(mx - 1.4)} ${f(my + 4.2)}Q${f(mx - 1.2)} ${f(my + 6.6)} ${f(mx)} ${f(my + 7.4)}`, .8, beardHi, 'round', ' opacity=".75"');
    if (animal) {
      if (k.face === 'peng') face += `<path d="M${f(mx - 2.4)} ${EY + 3}Q${f(mx)} ${EY + 2.2} ${f(mx + 2.4)} ${EY + 3}L${f(mx)} ${EY + 5.4}Z" fill="#FFA42E" ${s1(1)}/>`;
      else if (!frog) face += `<ellipse cx="${f(mx)}" cy="${EY + 2.4}" rx="1.5" ry="1.05" fill="${['cat', 'bunny', 'tiger', 'uni'].includes(k.face) ? '#FF7FA6' : OUT}"/>`;
    }
    const amy = animal ? EY + 4.6 : my;
    const mouthStroke = human && av.beard === 'vollbart' ? '#FFFFFF' : EYE;
    if (robot) {
      const led = '#6EF3FF';
      face += `<rect x="${f(T(-9.4))}" y="-4.4" width="${f(T(9.4) - T(-9.4))}" height="12" rx="3.6" fill="#1E2540" ${s1(1.2)}/>`;
      // bei Führung verdecken die Sonnenbrillen die LED-Augen
      if (!lead) {
        if (expr === 'sleep' || expr === 'calm') eyes += [e0, e1].map(x => ln(`M${f(x - 1.8)} ${EY}Q${f(x)} ${EY + 1.4} ${f(x + 1.8)} ${EY}`, 1.3, led)).join('');
        else if (expr === 'effort') eyes += ln(`M${f(e0 - 1.6)} ${EY - 1.6}L${f(e0 + 1.2)} ${EY}L${f(e0 - 1.6)} ${EY + 1.6}M${f(e1 + 1.6)} ${EY - 1.6}L${f(e1 - 1.2)} ${EY}L${f(e1 + 1.6)} ${EY + 1.6}`, 1.3, led);
        else if (expr === 'cheer' || expr === 'munch') eyes += [e0, e1].map(x => ln(`M${f(x - 1.8)} ${EY + .8}Q${f(x)} ${EY - 1.8} ${f(x + 1.8)} ${EY + .8}`, 1.4, led)).join('');
        else eyes += [e0, e1].map(x => `<rect x="${f(x - 1.5)}" y="${EY - 2}" width="3" height="4" rx="1.3" fill="${led}"/>`).join('');
      }
      face += expr === 'sleep' ? `<circle cx="${f(mx)}" cy="5.8" r=".9" fill="${led}"/>` : lead ? ln(`M${f(mx - 2.6)} 4.8Q${f(mx)} 7.6 ${f(mx + 2.6)} 4.8`, 1.3, led) : ln(`M${f(mx - 1.8)} 5.2Q${f(mx)} 6.8 ${f(mx + 1.8)} 5.2`, 1.1, led);
      face += `<rect x="${f(T(-8.2))}" y="4.6" width="1.8" height="1" rx=".5" fill="${BLUSH}" opacity=".9"/><rect x="${f(T(6.4))}" y="4.6" width="1.8" height="1" rx=".5" fill="${BLUSH}" opacity=".9"/>`;
    } else {
      const wmouth = y => `M${f(mx - 2.3)} ${f(y - .5)}Q${f(mx - 1.15)} ${f(y + 1.3)} ${f(mx)} ${f(y - .2)}Q${f(mx + 1.15)} ${f(y + 1.3)} ${f(mx + 2.3)} ${f(y - .5)}`;
      let mouth = '';
      if (frog) {
        if (expr === 'cheer' || expr === 'run' || lead) mouth = `<path d="M${f(mx - 5.4)} 4.6Q${f(mx)} 11 ${f(mx + 5.4)} 4.6Q${f(mx)} 7 ${f(mx - 5.4)} 4.6Z" fill="#8E2E45" ${s1(1.1)}/>`;
        else if (expr === 'effort') mouth = ln(`M${f(mx - 4)} 6L${f(mx + 4)} 6`, 1.3, EYE);
        else mouth = ln(`M${f(mx - 5.2)} 4.8Q${f(mx)} 8.8 ${f(mx + 5.2)} 4.8`, 1.2, EYE);
      } else if (expr === 'cheer' || (lead && expr === 'run')) {
        const y = animal ? amy + .4 : amy;
        mouth = `<path d="M${f(mx - 2.6)} ${f(y - .3)}Q${f(mx)} ${f(y + .4)} ${f(mx + 2.6)} ${f(y - .3)}Q${f(mx + 2.3)} ${f(y + 3.4)} ${f(mx)} ${f(y + 3.5)}Q${f(mx - 2.3)} ${f(y + 3.4)} ${f(mx - 2.6)} ${f(y - .3)}Z" fill="#8E2E45" ${s1(1)}/><path d="M${f(mx - 1.5)} ${f(y + 2.6)}Q${f(mx)} ${f(y + 1.5)} ${f(mx + 1.5)} ${f(y + 2.6)}Q${f(mx)} ${f(y + 3.5)} ${f(mx - 1.5)} ${f(y + 2.6)}Z" fill="#FF8FA3"/>`;
        if (animal) mouth = ln(`M${f(mx)} ${EY + 3.3}L${f(mx)} ${f(y - .1)}`, 1, EYE) + mouth;
      } else if (expr === 'run') {
        mouth = animal ? ln(wmouth(amy), 1.05, mouthStroke) + `<ellipse cx="${f(mx)}" cy="${f(amy + 1.6)}" rx="1.1" ry="1" fill="#8E2E45"/>`
          : `<path d="M${f(mx - 1.9)} ${f(amy - .2)}Q${f(mx)} ${f(amy + .3)} ${f(mx + 1.9)} ${f(amy - .2)}Q${f(mx + 1.5)} ${f(amy + 2.4)} ${f(mx)} ${f(amy + 2.4)}Q${f(mx - 1.5)} ${f(amy + 2.4)} ${f(mx - 1.9)} ${f(amy - .2)}Z" fill="#8E2E45" ${s1(.9)}/>`;
      } else if (expr === 'effort') {
        mouth = `<rect x="${f(mx - 2.5)}" y="${f(amy - .8)}" width="5" height="2.6" rx="1.1" fill="#fff" ${s1(1)}/><path d="M${f(mx - 2.3)} ${f(amy + .5)}L${f(mx + 2.3)} ${f(amy + .5)}" stroke="${EYE}" stroke-width=".7"/>`;
      } else if (expr === 'munch') {
        mouth = ln(`M${f(mx - 2)} ${f(amy + .2)}Q${f(mx - 1)} ${f(amy - .7)} ${f(mx)} ${f(amy + .2)}Q${f(mx + 1)} ${f(amy + 1.1)} ${f(mx + 2)} ${f(amy + .2)}`, 1.1, mouthStroke)
          + `<circle cx="${f(mx + 3.4)}" cy="${f(amy + 2.2)}" r=".55" fill="#F5B82E"/><circle cx="${f(mx - 2.8)}" cy="${f(amy + 2.8)}" r=".45" fill="#F5B82E"/>`;
      } else if (expr === 'sleep') {
        mouth = `<ellipse cx="${f(mx)}" cy="${f(amy + .9)}" rx="1.1" ry="1.3" fill="#8E2E45" ${s1(.8)}/>`;
      } else {
        mouth = animal ? ln(wmouth(amy), 1.1, mouthStroke) : ln(`M${f(mx - 2)} ${f(amy)}Q${f(mx)} ${f(amy + 2)} ${f(mx + 2)} ${f(amy)}`, 1.15, mouthStroke);
      }
      if (id === 'hase' && !['cheer', 'sleep'].includes(expr)) mouth += `<rect x="${f(mx - 1.1)}" y="${f(amy + .7)}" width="2.2" height="1.9" rx=".5" fill="#fff" ${s1(.7)}/>`;
      face += mouth;
      // Schnurrbart: breiter und mit heller Innenlinie, damit er auch auf dunkler Haut sichtbar bleibt
      if (human && av.beard === 'schnurrbart') face += `<path d="M${f(mx)} ${f(my - 1.3)}C${f(mx - 1.8)} ${f(my - 3.2)} ${f(mx - 5.6)} ${f(my - 2.8)} ${f(mx - 6)} ${f(my + .2)}C${f(mx - 3.8)} ${f(my - .8)} ${f(mx - 1.6)} ${f(my - .1)} ${f(mx)} ${f(my - .5)}C${f(mx + 1.6)} ${f(my - .1)} ${f(mx + 3.8)} ${f(my - .8)} ${f(mx + 6)} ${f(my + .2)}C${f(mx + 5.6)} ${f(my - 2.8)} ${f(mx + 1.8)} ${f(my - 3.2)} ${f(mx)} ${f(my - 1.3)}Z" fill="${av.hairColor}" ${s1(1)}/>`
        + ln(`M${f(mx - 4.4)} ${f(my - 1.3)}Q${f(mx - 2.6)} ${f(my - 2.3)} ${f(mx - 1)} ${f(my - 1.6)}M${f(mx + 1)} ${f(my - 1.6)}Q${f(mx + 2.6)} ${f(my - 2.3)} ${f(mx + 4.4)} ${f(my - 1.3)}`, .75, beardHi, 'round', ' opacity=".8"');
      /* Augen */
      const narrow = side ? .84 : 1, lineEye = panda ? '#FFFFFF' : EYE;
      // Erwachsene (Bart) bekommen kräftige Augenbrauen in Haarfarbe
      if (human && av.beard !== 'keiner' && !lead) eyes += [e0, e1].map((x, i) => ln(`M${f(x - 2.3)} ${f(EY - 3.6 + (i ? .5 : 0))}Q${f(x)} ${f(EY - 4.7)} ${f(x + 2.3)} ${f(EY - 3.6 + (i ? 0 : .5))}`, 1.5, av.hairColor)).join('');
      // sehr dunkle Haut: feiner heller Lidrand und größerer Glanzpunkt, sonst gehen die Augen bei 56 px unter
      const deep = human && lum(av.skin) < .3;
      const eyeOpen = (x, w) => `<ellipse cx="${f(x)}" cy="${EY}" rx="${f(2.05 * w)}" ry="2.75" fill="${panda ? '#11131F' : EYE}"${deep ? ' stroke="#fff" stroke-opacity=".35" stroke-width=".6"' : ''}/><circle cx="${f(x + .75 * w)}" cy="${f(EY - 1.05)}" r="${panda ? 1.2 : deep ? 1.3 : 1}" fill="#fff"/><circle cx="${f(x - .65 * w)}" cy="${f(EY + 1.15)}" r=".5" fill="#fff"/>`;
      // bei Führung verdecken die Sonnenbrillen die Augen
      if (!lead) {
        if (frog) eyes += [e0, e1].map(x => `<circle cx="${f(x)}" cy="${EY}" r="3.9" fill="#fff"/>`).join('');
        if (expr === 'calm' || expr === 'sleep') eyes += [e0, e1].map(x => ln(`M${f(x - 2)} ${f(EY - .2)}Q${f(x)} ${f(EY + 1.8)} ${f(x + 2)} ${f(EY - .2)}`, 1.3, lineEye)).join('');
        else if (expr === 'effort') eyes += ln(`M${f(e0 - 1.8)} ${f(EY - 1.8)}L${f(e0 + 1.4)} ${EY}L${f(e0 - 1.8)} ${f(EY + 1.8)}M${f(e1 + 1.8)} ${f(EY - 1.8)}L${f(e1 - 1.4)} ${EY}L${f(e1 + 1.8)} ${f(EY + 1.8)}`, 1.4, lineEye);
        else if (expr === 'munch') eyes += [e0, e1].map(x => ln(`M${f(x - 2)} ${f(EY + .9)}Q${f(x)} ${f(EY - 1.6)} ${f(x + 2)} ${f(EY + .9)}`, 1.35, lineEye)).join('');
        else eyes += eyeOpen(e0, frog ? 1 : narrow) + eyeOpen(e1, 1);
      }
      if (k.face === 'cat') face += ln(`M${f(T(-7))} 5.6L-14.6 4.4M${f(T(-7))} 6.8L-14.4 7.8M${f(T(7))} 5.6L14.6 4.4M${f(T(7))} 6.8L14.4 7.8`, .7, OUT);
    }
    if (expr === 'effort') face += `<path d="M${f(T(10.6))} -6.4Q${f(T(12.4))} -3.6 ${f(T(10.6))} -2.4Q${f(T(8.8))} -3.6 ${f(T(10.6))} -6.4Z" fill="#9EE7FF" ${s1(.9)}/>`;

    /* Brillen. Roboter: heller Rahmen über dem Visier, LED-Augen leuchten durch die Gläser */
    const gs = robot ? '#E9EEF7' : OUT;
    const arm = side ? ln(`M${f(e0 - 3.4)} ${f(EY - .6)}L-9.6 ${f(EY)}`, .9, gs) : '';
    if (lead) {
      const rim = robot ? `stroke="#6EF3FF" stroke-width="1"` : s1(1);
      const lens = x => `<path d="M${f(x - 3.6)} ${f(EY - 2)}L${f(x + 3.6)} ${f(EY - 2)}L${f(x + 3.1)} ${f(EY + 1.6)}Q${f(x)} ${f(EY + 3.4)} ${f(x - 3.1)} ${f(EY + 1.6)}Z" fill="#11142A" ${rim}/>`;
      glasses += lens(e0) + lens(e1) + ln(`M${f(e0 + 3.4)} ${f(EY - 1.6)}L${f(e1 - 3.4)} ${f(EY - 1.6)}`, 1.3, robot ? '#6EF3FF' : '#1B1F33')
        + ln(`M${f(e0 - 2.2)} ${f(EY - 1)}L${f(e0 - .6)} ${f(EY - 1)}M${f(e1 - 2.2)} ${f(EY - 1)}L${f(e1 - .6)} ${f(EY - 1)}`, .9, robot ? '#FFFFFF' : '#9EE7FF')
        + (side && !robot ? ln(`M${f(e0 - 3.6)} ${f(EY - 1.4)}L-9.4 ${f(EY - 1)}`, 1.1, '#1B1F33') : '');
    } else if (av.glasses === 'rund') { // Frosch: Ränder um die großen Augenhügel statt Ringe um die Iris
      const r = frog ? 5.1 : 3.5;
      glasses += arm + [e0, e1].map(x => `<circle cx="${f(x)}" cy="${EY}" r="${r}" fill="#fff" fill-opacity=".22" stroke="${gs}" stroke-width="1.2"/>`).join('') + ln(`M${f(e0 + r)} ${f(EY - .5)}Q${f(mx)} ${f(EY - 1.6)} ${f(e1 - r)} ${f(EY - .5)}`, 1.1, gs);
    } else if (av.glasses === 'nerd') {
      const [w, h] = frog ? [10.4, 9] : [8, 6.2];
      glasses += arm + [e0, e1].map(x => `<rect x="${f(x - w / 2)}" y="${f(EY - h / 2 + .1)}" width="${w}" height="${h}" rx="${frog ? 2.6 : 1.8}" fill="#fff" fill-opacity=".2" stroke="${gs}" stroke-width="1.9"/>`).join('') + ln(`M${f(e0 + w / 2)} ${f(EY - .8)}L${f(e1 - w / 2)} ${f(EY - .8)}`, 1.6, gs);
    } else if (av.glasses === 'sport') { // Frosch: hochgeschoben über den Augen, die Pupillen bleiben frei
      const y = frog ? EY - 6.6 : EY - 2.4, h = frog ? 3.8 : 4.8, x0 = frog ? e0 - 5.6 : e0 - 4;
      glasses += (frog ? '' : arm) + `<rect x="${f(x0)}" y="${f(y)}" width="${f(e1 - e0 + 2 * (e0 - x0))}" height="${h}" rx="${h / 2}" fill="#FF5DA2" fill-opacity="${robot ? .75 : .92}" stroke="${robot ? '#FFB3D6' : OUT}" stroke-width="1.2"/>` + ln(`M${f(x0 + 1.6)} ${f(y + 1.4)}L${f(x0 + 4)} ${f(y + 1.4)}`, .9, '#fff');
    }
    else if (av.glasses === 'pilot') glasses += arm + [e0, e1].map(x => `<path d="M${f(x - 3.4)} ${f(EY - 2)}L${f(x + 3.4)} ${f(EY - 2)}Q${f(x + 3.6)} ${f(EY + 3)} ${f(x)} ${f(EY + 2.8)}Q${f(x - 3.6)} ${f(EY + 3)} ${f(x - 3.4)} ${f(EY - 2)}Z" fill="#3A3F58" stroke="#F5B82E" stroke-width="1.1"/>`).join('') + ln(`M${f(e0 + 3.4)} ${f(EY - 1.8)}L${f(e1 - 3.4)} ${f(EY - 1.8)}`, 1.1, '#F5B82E');
    if (id === 'einhorn') face = `<path d="M${f(T(-10.6))} -4.8C${f(T(-11))} -11 ${f(T(-4))} -13.8 ${f(T(1.6))} -11.4C${f(T(-3))} -10.4 ${f(T(-6.2))} -8.4 ${f(T(-10.6))} -4.8Z" fill="#FF8FB8" ${s1(1.2)}/><path d="M${f(T(-6.4))} -10.6C${f(T(-3.4))} -13.4 ${f(T(2.6))} -13.8 ${f(T(5.4))} -10.8C${f(T(1.6))} -11.4 ${f(T(-2.4))} -10.8 ${f(T(-6.4))} -10.6Z" fill="#9EE7FF" ${s1(1.2)}/>` + face;

    /* Hüte */
    let hat = '', phones = '';
    // Kappe und Mütze in Trikotfarbe; ist die der Kopffarbe zu ähnlich (dunkles Trikot auf Pinguin, weißes auf Panda),
    // wird die Kuppel heller bzw. dunkler, sonst verschwindet sie im Kopf
    const hatC = dist(color, fur) < 80 ? (lum(color) > .5 ? shade(color, .2) : tint(color, .3)) : color;
    // Kappenschirm/Naht/Knopf: dunkle Kappen bekommen einen helleren Ton derselben Farbe (Weiß wirkte wie ein Helm),
    // Kappen in Kopffarbe einen Kontrast, alle anderen einen dunkleren Ton
    const darkHat = lum(hatC) < .2, lowHat = !darkHat && dist(hatC, fur) < 80;
    const brim = darkHat ? tint(hatC, .34) : lowHat ? (lum(hatC) > .72 ? '#2B3A67' : '#FFFFFF') : shade(hatC, .22);
    const seam = darkHat ? tint(hatC, .2) : lowHat ? brim : shade(hatC, .3);
    const hairClipId = clip + 'h';
    if (human && covered) defs.push(`<clipPath id="${hairClipId}"><rect x="-20" y="${av.hat === 'cowboy' ? -5.6 : av.hat === 'muetze' ? -1.6 : -2.6}" width="40" height="30"/></clipPath>`);
    const hatLift = human && ['stachel', 'irokese', 'locken', 'dutt'].includes(av.hair) ? 3.4 : 0;
    switch (av.hat) {
      case 'cap':
        // Stoffkuppel mit Glanz und Naht; von vorn ein breiter, flacher Schirm (ein schmaler Bogen las sich wie ein Helmvisier).
        // Dunkle Kappen von vorn ohne Glanzbogen, der machte sie zur Helmschale
        hat += `<path d="M-13.1 -1.6C-13.6 -11.4 -7.2 -15 0 -15C7.2 -15 13.6 -11.4 13.1 -1.6Q0 -4.4 -13.1 -1.6Z" fill="${hatC}" ${S}/>`
          + (darkHat && !side ? '' : ln(`M${f(T(-9.4))} -6.6Q${f(T(-7.6))} -11.4 ${f(T(-2.8))} -12.6`, 1.5, '#fff', 'round', ' opacity=".3"'))
          + ln(`M${f(mx)} -14.6Q${f(T(-.6))} -9 ${f(mx)} -3.4`, .9, seam) + `<circle cx="${f(mx)}" cy="-14.6" r="1.3" fill="${brim}" ${s1(1)}/>`;
        hat += side ? `<path d="M3 -3.6C9 -4.8 16.6 -4.6 18.4 -2.4C17 -.2 9 -.6 2.4 -1.4Z" fill="${brim}" ${S}/>`
          : `<path d="M-12.6 -2.8C-10.6 1.4 10.6 1.4 12.6 -2.8Q0 -5.8 -12.6 -2.8Z" fill="${brim}" ${S}/>`;
        break;
      case 'muetze': {
        const band = lum(hatC) > .85 ? '#E23E3E' : '#fff';
        hat += `<path d="M-13.2 -1C-13.8 -12 -7.2 -15.6 0 -15.6C7.2 -15.6 13.8 -12 13.2 -1Z" fill="${hatC}" ${S}/><rect x="-13.8" y="-4.8" width="27.6" height="4.6" rx="2.2" fill="${band}" ${S}/>`
          + ln('M-9 -4.2L-9 -.8M-4.5 -4.2L-4.5 -.8M0 -4.2L0 -.8M4.5 -4.2L4.5 -.8M9 -4.2L9 -.8', .7, 'rgba(38,42,68,.35)') + cloud([[0, -16.4, 3.5]], band);
        break;
      }
      case 'stirnband':
        hat += `<path d="M-12.8 -4.6Q0 -9.4 12.8 -4.6L12.6 -1.2Q0 -6 -12.6 -1.2Z" fill="#E23E3E" ${S}/><path d="M-12.4 -3.4C-15 -3.4 -17 -5.6 -18.4 -4.2C-17.4 -2.4 -15 -1.8 -12.6 -2.2Z" fill="#E23E3E" ${s1(1.1)}/><path d="M-12.4 -2.6C-14.6 -1.2 -16 1.4 -15 2.8C-13.4 2.2 -12.4 .2 -12 -1.4Z" fill="#E23E3E" ${s1(1.1)}/>`;
        break;
      case 'helm':
        // Einhorn: ohne Mittelstreifen, dort sitzt das Horn
        hat += `<path d="M-13.8 -.2C-14.6 -12.4 -7.4 -16.4 0 -16.4C8 -16.4 14.6 -12.4 13.8 -.2Q0 -4.4 -13.8 -.2Z" fill="#FFD23F" ${S}/>` + ln(`M${f(T(-5))} -13.6L${f(T(-4))} -6.2${id === 'einhorn' ? '' : `M${f(mx)} -15L${f(mx)} -6.8`}M${f(T(5))} -13.6L${f(T(4))} -6.2`, 1.6, OUT)
          + `<path d="M${f(T(-8))} -3.6Q${f(mx)} -6.2 ${f(T(8))} -3.6L${f(T(8.6))} -1.6Q${f(mx)} -4.2 ${f(T(-8.6))} -1.6Z" fill="#23283A"/>`;
        break;
      case 'cowboy':
        hat += `<path d="M-7.8 -7.4C-8.4 -16.6 -3 -17.4 0 -15.2C3 -17.4 8.4 -16.6 7.8 -7.4Z" fill="#B0773F" ${S}/><path d="M-7.9 -10.4L7.9 -10.4L7.8 -8.2L-7.8 -8.2Z" fill="#5C3A2B"/>`
          + `<path d="M-19.6 -7.4Q-19 -11 -13.6 -9.2Q0 -5 13.6 -9.2Q19 -11 19.6 -7.4Q16.4 -4.4 0 -4.6Q-16.4 -4.4 -19.6 -7.4Z" fill="#9A6536" ${S}/>`;
        break;
      case 'party': {
        const b = (frog ? -12.6 : -10.6) - hatLift;
        // Einhorn: Partyhut schräg neben dem Horn (sonst kreuzen sich zwei Kegel)
        hat += `<g transform="${id === 'einhorn' ? `translate(-6.4 1.8) rotate(-24 0 ${b})` : `rotate(10 0 ${b})`}"><path d="M-6.2 ${b}L0 ${b - 15.4}L6.2 ${b}Q0 ${b + 1.6} -6.2 ${b}Z" fill="#9B5DE5" ${S}/>` + ln(`M-4.1 ${b - 4.6}L3.6 ${b - 6}M-2.2 ${b - 9.6}L2 ${b - 10.6}`, 1.5, '#FFD23F') + cloud([[0, b - 16, 2.4]], '#FFD23F') + '</g>';
        break;
      }
      case 'krone': {
        const b = (frog ? -14.2 : -10.2) - hatLift;
        hat += `<path d="M-7.6 ${b}L-8.6 ${b - 8.6}L-4 ${b - 4.8}L0 ${b - 10.6}L4 ${b - 4.8}L8.6 ${b - 8.6}L7.6 ${b}Q0 ${b + 1.6} -7.6 ${b}Z" fill="#F5B82E" ${S}/><circle cx="0" cy="${b - 3}" r="1.5" fill="#E23E3E" ${s1(.8)}/><circle cx="-8.6" cy="${b - 8.8}" r="1.1" fill="#fff"/><circle cx="8.6" cy="${b - 8.8}" r="1.1" fill="#fff"/><circle cx="0" cy="${b - 10.8}" r="1.1" fill="#fff"/>`;
        break;
      }
    }
    if (av.extra === 'kopfhoerer') {
      // Bügel hell in der Muschelfarbe, damit er sich von dunklem Haar abhebt; auf pinkem Haar/Fell türkis statt pink
      const pc = dist(human ? av.hairColor : fur, '#FF5DA2') < 100 ? '#33C3EE' : '#FF5DA2';
      const band = 'M-13.2 1C-14.6 -13 -8 -17.4 0 -17.4C8 -17.4 14.6 -13 13.2 1';
      phones += ln(band, 4.4, OUT) + ln(band, 2.4, tint(pc, .45));
      phones += side ? `<rect x="-13.6" y="-3.2" width="5.4" height="8" rx="2.4" fill="${pc}" ${S}/>`
        : `<rect x="-15.6" y="-3.6" width="5" height="8" rx="2.2" fill="${pc}" ${S}/><rect x="10.6" y="-3.6" width="5" height="8" rx="2.2" fill="${pc}" ${S}/>`;
    }
    let top = '';
    if (id === 'einhorn') top += `<path d="M${f(T(-2.6))} -10.4L${f(T(1.2))} -23L${f(T(3.2))} -10Q${f(T(.4))} -8.8 ${f(T(-2.6))} -10.4Z" fill="#FFD23F" ${S}/>` + ln(`M${f(T(-1.4))} -13.6L${f(T(2.6))} -14.8M${f(T(-.4))} -17.4L${f(T(2))} -18.2`, .9, OUT);
    top += earsTop;

    const shape = `${shapeAttr} fill="${fur}"/>`, outline = `${shapeAttr} fill="none" ${S}/>`;
    const skinLayer = `${shape}<g clip-path="url(#${clip})">${inClip}</g>${outline}`;
    const eyeLayer = robot ? glasses + eyes : eyes + glasses;
    if (frog) {
      // Frosch: Kappe, Mütze, Helm und Cowboyhut sitzen in voller Größe oben AUF den Augenhügeln (Pupillen bleiben frei),
      // Partyhut und Krone stehen dahinter, das Stirnband liegt unter den Augen
      const lift = { cap: -10.4, muetze: -11, helm: -10.4, cowboy: -7.8 }[av.hat];
      const onTop = lift ? `<g transform="translate(0 ${lift})">${hat}</g>` : '';
      const behindHat = ['party', 'krone'].includes(av.hat) ? hat : '';
      const band = av.hat === 'stirnband' ? `<g transform="translate(0 2.6)">${hat}</g>` : '';
      return { back: behind + behindHat + frogBumps, main: `${skinLayer}${band}${face}${eyeLayer}${phones}${onTop}${top}` };
    }
    const hairFront = human ? (covered ? `<g clip-path="url(#${hairClipId})">${hair.front}</g>` : hair.front) : '';
    // Tierohren stecken durch Kappen und Mützen durch; unter Helm und Cowboyhut bleiben sie hinten (Schale bzw. Krempe davor)
    const earsOverHat = !human && ['cap', 'muetze'].includes(av.hat) && ['fox', 'cat', 'round'].includes(k.ears) ? earOnly(k) : '';
    return { back: behind, main: `${skinLayer}${hairFront}${face}${eyeLayer}${hat}${phones}${earsOverHat}${top}` };
  }
  // Tierohren noch einmal über der Kopfbedeckung (nur die oberen Spitzen sichtbar)
  function earOnly(k) {
    const ec = k.earC || k.fur;
    switch (k.ears) {
      case 'fox': return mir(`<path d="M-11.6 -9.6L-11.4 -16.6Q-11 -18.4 -9.6 -17.2L-5.2 -13Z" fill="${k.fur}" ${S}/><path d="M-11.45 -15.2L-11.4 -16.6Q-11 -18.4 -9.6 -17.2L-8.2 -15.9Z" fill="${OUT}"/>`);
      case 'cat': return mir(`<path d="M-11.6 -9L-11.4 -15.6Q-11 -17.2 -9.6 -16.2L-5.4 -12.6Z" fill="${k.fur}" ${S}/>`);
      case 'round': return mir(`<path d="M-13.6 -8.2A4.5 4.5 0 0 1 -5.4 -11.6Z" fill="${ec}" ${S}/>`);
    }
    return '';
  }

  /* ---------- Körper ---------- */
  const EGG = 'M0 -8C5.6 -8 8.6 -3.6 8.6 1C8.6 5.6 5.1 8 0 8C-5.1 8 -8.6 5.6 -8.6 1C-8.6 -3.6 -5.6 -8 0 -8Z';
  const BOX = 'M-5 -7.8H5Q8.5 -7.8 8.5 -4.3V4.5Q8.5 8 5 8H-5Q-8.5 8 -8.5 4.5V-4.3Q-8.5 -7.8 -5 -7.8Z';

  function tailSVG(k, fur) {
    const hook = 'M0 0C-5.4 1 -9.6 -1.8 -9.4 -6.8C-9.2 -10.8 -12.4 -13.2 -14.6 -11.4';
    switch (k.tail) {
      case 'fox': return `<path d="M1 1.4C-4.4 3.4 -11.6 2 -15 -3.6C-17.4 -8 -15.4 -13.2 -11.6 -14C-10.4 -9.2 -7.2 -5.6 -1 -4Z" fill="${fur}" ${S}/><path d="M-15 -3.6C-17.4 -8 -15.4 -13.2 -11.6 -14C-11 -11.6 -10.2 -9.8 -9 -8.2C-11.6 -7.6 -13.6 -6 -15 -3.6Z" fill="#FFF4E8" ${S}/>`;
      case 'cat': return ln(hook, 3.4 + 2 * OW, OUT) + ln(hook, 3.4, fur) + ln(hook, 3.4, shade(fur, .25), 'butt', ' stroke-dasharray="1.4 2.6" stroke-dashoffset="-2"');
      case 'tiger': return ln(hook, 3.6 + 2 * OW, OUT) + ln(hook, 3.6, fur) + ln(hook, 3.6, '#3A2A2A', 'butt', ' stroke-dasharray="1.3 2.4" stroke-dashoffset="-2"');
      case 'round': return `<circle cx="-2" cy="-.6" r="3.1" fill="${fur}" ${S}/>`;
      case 'fluff': return cloud([[-2.6, -1.4, 2.6], [-4.2, 1.2, 2.4], [-1.2, 1.4, 2.2]], '#FFFFFF');
      case 'rainbow': {
        const bands = [['#C89BFF', -3], ['#FF8FB8', 0], ['#FFD23F', 3]].map(([c, o]) => [c, `M0 ${o * .4}C-5 ${2 + o * .4} -10 ${-1 + o} -12.6 ${-6 + o * 1.2}`]);
        return bands.map(([, d]) => ln(d, 2.8 + 2 * OW, OUT)).join('') + bands.map(([c, d]) => ln(d, 2.8, c)).join('');
      }
      case 'peng': return `<path d="M0 -1L-5 2.4L0 3.4Z" fill="${fur}" ${S}/>`;
    }
    return '';
  }

  function bodySVG(P, k, human, av, color, view, defs, cid) {
    const [bx, by, ang] = P.body;
    const shape = k.robot ? BOX : EGG;
    const accent = lum(color) > .72 ? '#2B3A67' : '#FFFFFF';
    const shorts = lum(color) < .3 ? '#5B6685' : '#2F3757';
    const chest = human ? av.skin : k.chest;
    defs.push(`<clipPath id="${cid}"><path d="${shape}"/></clipPath>`);
    const vx = view === 'side' ? 2.6 : 0;
    // Pinguin: tiefer V-Ausschnitt bis zum Brustring, damit der weiße Bauch sichtbar bleibt
    const vb = k.deepV ? -.2 : -2.6, vw = k.deepV ? 6 : 4.8;
    let inner = `<rect x="-12" y="-.4" width="24" height="2" fill="${accent}"/><rect x="-12" y="4.3" width="24" height="10" fill="${shorts}"/>`;
    inner += `<path d="M${f(vx - vw)} -9.4L${vx} ${vb}L${f(vx + vw)} -9.4Z" fill="${chest}"/>` + ln(`M${f(vx - vw - .1)} -8.8L${vx} ${f(vb + .1)}L${f(vx + vw + .1)} -8.8`, 1.8, accent);
    if (k.robot) inner += `<circle cx="${vx + 4.4}" cy="-4.6" r="1" fill="#6EF3FF" ${s1(.7)}/>`;
    return { svg: `<g transform="translate(${bx} ${by}) rotate(${ang})"><path d="${shape}" fill="${color}"/><g clip-path="url(#${cid})">${inner}</g><path d="${shape}" fill="none" ${S}/></g>`, accent, shorts };
  }

  // Führungs-Flammen: Spitze am Ankerpunkt (Ferse/Hinterrad), Flammen zeigen nach hinten
  const flamesSVG = (x, y, sc = 1) => `<g transform="translate(${f(x)} ${f(y)}) scale(${sc})"><g class="flames" style="transform-origin:0px 0px"><path d="M0 1Q-9 -1 -16 1.8Q-9 4.6 0 3Z" fill="#FFB02E"/><path d="M0 -3Q-10 -6.4 -14 -3.4Q-9 0 0 -.6Z" fill="#FF6A3D"/><path d="M0 -.4Q-6 -1.8 -11 -.2Q-6 1.4 0 .8Z" fill="#FFF2B0"/></g></g>`;

  /* ---------- Figur ---------- */
  function figureSVG({ id = '', uid = '', avatar, color = '#FF7A45', wins = 0, pose = 'run', idle = false, lead = false, sleep = false, web = false, portrait = false }) {
    color = hexOr(color, '#FF7A45');
    const av = allowed(normalize(avatar, id), wins);
    const pz = portrait ? 'stand' : sleep ? 'sleep' : (POSES[pose] ? pose : 'run');
    const P = POSES[pz], view = P.view, human = av.base === 'mensch';
    const k = human ? { fur: av.skin, chest: av.skin } : KIND[av.base];
    // deterministische IDs: gleicher Input -> gleicher String (app.js vergleicht fe._h und rendert sonst jedes Mal neu)
    const pre = `k${String(uid || 'x').replace(/[^\w-]/g, '')}-${pz}-${av.base}${portrait ? '-p' : ''}`;
    const defs = [];
    const isLead = lead && !sleep && !portrait;
    const body = bodySVG(P, k, human, av, color, view, defs, pre + 'b');
    const [bx, by, bang] = P.body;
    const rot = (x, y) => { const a = bang * Math.PI / 180; return [bx + x * Math.cos(a) - y * Math.sin(a), by + x * Math.sin(a) + y * Math.cos(a)]; };
    const onBody = inner => `<g transform="translate(${bx} ${by}) rotate(${bang})">${inner}</g>`;

    /* Glieder */
    const limbC = k.limb || k.fur;
    const cuff = dist(color, limbC) < 80 || lum(color) < .2 ? body.accent : null;
    const shoeCol = { weiss: ['#FFFFFF', lum(color) > .85 ? '#E23E3E' : color], rot: ['#E23E3E', '#FFFFFF'], schwarz: ['#2F3450', '#FFFFFF'], gold: ['#F5B82E', '#FFF1B0'] }[av.shoes];
    const dark = (c, far) => far ? shade(c, .14) : c;
    const armSVG = L => {
      const c = dark(limbC, L.far), hand = dark(k.hand || limbC, L.far);
      const hi = lum(hand) < .35 ? .6 : 0; // Glanzpunkt auf dunklen Händen (Panda, Pinguin, Fuchs)
      return limbSVG(L, { w: 4.3, upper: c, lower: c, sleeve: dark(color, L.far), sleeveFrac: .5, cuff: cuff && dark(cuff, L.far), joint: k.robot ? dark('#6B7488', L.far) : null,
        rings: k.rings ? dark(k.rings, L.far) : null,
        tip: (x, y) => (L.cls === 'munch' ? `<path d="M${f(x - 4.6)} ${f(y - 1.4)}Q${f(x - 3.4)} ${f(y - 4)} ${f(x - .8)} ${f(y - 3.2)}Q${f(x - 1.4)} ${f(y - .4)} ${f(x - 4.6)} ${f(y - 1.4)}Z" fill="#FFD23F" ${s1(1)}/>` : '')
          + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(2.55 + OW / 2)}" fill="${hand}" ${S}/>` + (hi ? `<circle cx="${f(x - .9)}" cy="${f(y - 1)}" r=".9" fill="#fff" opacity="${hi}"/>` : '') });
    };
    const legSVG = L => {
      const c = dark(limbC, L.far), low = dark(k.shin || limbC, L.far);
      const col = L.far ? shoeCol.map(x => shade(x, .12)) : shoeCol;
      return limbSVG(L, { w: 4.8, upper: c, lower: low, sleeve: dark(body.shorts, L.far), sleeveFrac: .55, joint: k.robot ? dark('#6B7488', L.far) : null,
        rings: k.rings ? dark(k.rings, L.far) : null, tip: (x, y) => shoeSVG(x, y, P.foot, L.toe || 0, col) });
    };
    // im Porträt liegen die Beine ganz unterhalb des Ausschnitts
    const limbs = [...(portrait ? [] : P.legs.map(L => ({ L, svg: legSVG(L) }))), ...P.arms.map(L => ({ L, svg: armSVG(L) }))];
    const pick = pred => limbs.filter(x => pred(x.L)).map(x => x.svg).join('');
    const farLimbs = pick(L => L.far);
    const underLimbs = pick(L => !L.far && (!L.z || L.z === 'under'));
    const overLimbs = pick(L => !L.far && L.z === 'over');
    const topLimbs = pick(L => !L.far && L.z === 'top');

    /* Schwanz (in Frontansicht verdeckt der Körper Stummelschwänze, im Porträt würde er nur angeschnitten) */
    let tail = '';
    if (!human && !portrait && k.tail && !(view === 'front' && ['round', 'peng'].includes(k.tail))) {
      const [tx, ty] = rot(-6.2, 4.4);
      tail = `<g transform="translate(${f(tx)} ${f(ty)}) rotate(${bang + (view === 'side' ? -18 : 0)})"><g class="j tail" style="transform-origin:0px 0px">${tailSVG(k, k.tail === 'round' ? limbC : k.fur)}</g></g>`;
    }

    /* Umhang: groß und wehend hinter beiden Schultern, ÜBER dem Schwanz; vorne Goldschließe am Kragen */
    let cape = '', neck = '';
    if (av.extra === 'umhang') {
      // Umhang rot, auf rotem Trikot lila (sonst kaum Kontrast); Futter als hellerer Ton
      const cc = dist(color, CAPE) < 90 ? '#7A3FBF' : CAPE, lc = tint(cc, .45);
      // Frontansicht: Breite/Saumhöhe je Pose (im Sitzen breitet sich der Umhang am Boden aus, damit er neben Armen/Beinen sichtbar bleibt)
      const [w, h] = P.cape || [14.6, 11.8];
      const x = k => f(-w * k), X = k => f(w * k);
      const d = view === 'side'
        ? 'M1 -7.8C-5 -9.4 -13 -7.6 -21.6 -2.2L-18.8 .4L-21.4 4L-16.8 4.4L-17.6 8.6C-12.4 6.6 -8.2 3.6 -5.4 -1.4L-2 -3.4Z'
        : `M-5.8 -7.4C-9.6 -6.4 ${x(.82)} -1.6 ${x(.92)} 3.6L${x(1)} ${h}Q${x(.76)} ${f(h + 1.8)} ${x(.51)} ${h}Q${x(.26)} ${f(h + 2)} 0 ${f(h + .2)}Q${X(.26)} ${f(h + 2)} ${X(.51)} ${h}Q${X(.76)} ${f(h + 1.8)} ${X(1)} ${h}L${X(.92)} 3.6C${X(.82)} -1.6 9.6 -6.4 5.8 -7.4Z`;
      const lining = view === 'side' ? ln('M-6.4 -1.8C-9.4 1.6 -13 4.6 -17.2 6.8', 1.1, lc, 'round', ' opacity=".7"') : ln(`M${x(.8)} 4.4L${x(.86)} ${f(h - 1.2)}M${X(.8)} 4.4L${X(.86)} ${f(h - 1.2)}`, 1.1, lc, 'round', ' opacity=".7"');
      cape = onBody(`<g class="j cape" style="transform-origin:0px -7px"><path d="${d}" fill="${cc}" ${S}/>${lining}</g>`);
      // vorne: Umhang liegt sichtbar über den Schultern, Goldschließe am Kragen
      neck += onBody(view === 'side' ? `<circle cx="4.6" cy="-6.4" r="1.5" fill="#F5B82E" ${s1(1)}/>`
        : mir(`<path d="M-3.2 -7.9Q-7.8 -7.9 -9 -3.2Q-7.4 -4.4 -5.4 -4.2Q-5.8 -6.2 -2.8 -6.5Z" fill="${cc}" ${s1(1.2)}/>`) + ln('M-3.4 -6.9Q0 -4.4 3.4 -6.9', 1.4, cc) + `<circle cx="0" cy="-5.6" r="1.6" fill="#F5B82E" ${s1(1)}/>`);
    }
    if (av.extra === 'medaille') {
      const o = view === 'side' ? 2.8 : 0;
      neck += onBody(`${ln(`M${o - (view === 'side' ? 4 : 3.8)} -7.4L${o} -.4L${o + (view === 'side' ? 2.6 : 3.8)} -7.4`, 1.7, '#E23E3E')}<circle cx="${o}" cy="1.6" r="3" fill="#F5B82E" ${s1(1.1)}/><path d="M${o} .1L${o + .5} 1.2L${o + 1.5} 1.3L${o + .7} 2L${o + 1} 3.1L${o} 2.5L${o - 1} 3.1L${o - .7} 2L${o - 1.5} 1.3L${o - .5} 1.2Z" fill="#FFF1B0"/>`);
    }
    let scarf = '';
    if (av.extra === 'schal') {
      const band = view === 'side' ? 'M-6.4 -8.2Q0 -4.6 7.4 -8.2' : 'M-7.4 -8.4Q0 -4.6 7.4 -8.4';
      const end = view === 'side' ? 'M-5 -6.4L-10.6 -1.6' : 'M-4.4 -6L-5.8 1.4';
      scarf = onBody(`${ln(band, 3.6 + 2 * OW, OUT)}<g class="j tail" style="transform-origin:-5px -6px">${ln(end, 3.2 + 2 * OW, OUT)}${ln(end, 3.2, '#E23E3E')}${ln(end, 3.2, '#fff', 'butt', ' stroke-dasharray="1 1.6" stroke-dashoffset="-1.4" opacity=".9"')}</g>${ln(band, 3.6, '#E23E3E')}`);
    }

    /* Kopf */
    const [hx, hy, ht] = P.head;
    const H = headSVG(av, human, k, { view, s: P.look || 0, expr: P.expr, lead: isLead, clip: pre + 'h', defs, color });
    // Erwachsene (Bart): Kopf etwas kleiner und höher, dazwischen ein kurzer Hals – sonst wirken sie wie Kleinkinder
    const adult = human && av.beard !== 'keiner', NL = adult ? 2.2 : 0, ba = bang * Math.PI / 180;
    const HX = f(hx + NL * Math.sin(ba)), HY = f(hy - NL * Math.cos(ba)), HS = adult ? .92 : 1;
    const htr = `translate(${HX} ${HY}) rotate(${ht})${adult ? ` scale(${HS})` : ''}`;
    const neckStub = adult ? onBody(`<rect x="${view === 'side' ? -1.4 : -2.8}" y="-12.4" width="5.6" height="6" rx="2" fill="${av.skin}" ${S}/>`) : '';
    const head = `<g transform="${htr}">${H.main}</g>`, headBack = H.back ? `<g transform="${htr}">${H.back}</g>` : '';

    /* Umgebung */
    let envBack = '', mid = '', afterBody = '', front = '';
    if (P.shadow && !portrait) envBack += `<ellipse cx="${P.shadow[0]}" cy="66.3" rx="${P.shadow[1]}" ry="2" fill="#0A1440" opacity=".28"/>`;
    const HOLD = (x, y, c, r = 2.4) => `<path d="M${f(x - r)} ${f(y + .4)}C${f(x - r)} ${f(y - r)} ${f(x + r * .6)} ${f(y - r * 1.1)} ${f(x + r)} ${f(y - .2)}C${f(x + r * 1.1)} ${f(y + r * .9)} ${f(x - r * .4)} ${f(y + r)} ${f(x - r)} ${f(y + .4)}Z" fill="${c}" ${s1(1.2)}/><circle cx="${f(x - r * .35)}" cy="${f(y - r * .35)}" r="${f(r * .28)}" fill="#fff" opacity=".45"/>`;
    if (pz === 'climb') {
      // Kletterwand rechts: durchscheinendes Paneel mit Felskante, das nach oben und rechts weich ausläuft
      // (eine helle Leiste mit harten Kanten las sich auf der Bahn wie ein Auswahlrahmen), dazu 4 große Griffe:
      // Hand oben, Hand unten, Tritt, nächster Griff
      const wm = pre + 'w', edge = 'M47.4 67.06L47 61.4L48.2 56.2L47.6 50.6L48.8 45.4L48.2 39.6L49.4 34.4L48.9 28.6L50 23.6L49.6 17.8L50.6 12.4L50.4 7';
      defs.push(`<radialGradient id="${wm}g" gradientUnits="userSpaceOnUse" cx="47" cy="54" r="19" gradientTransform="translate(47 54) scale(1 2.2) translate(-47 -54)"><stop offset=".45" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`
        + `<mask id="${wm}" maskUnits="userSpaceOnUse" x="40" y="0" width="30" height="68"><rect x="40" y="0" width="30" height="68" fill="url(#${wm}g)"/></mask>`);
      envBack += `<g mask="url(#${wm})"><path d="${edge}L68 7L68 67.06Z" fill="#fff" fill-opacity=".3"/>${ln(edge, 1.4, OUT, 'round', ' stroke-opacity=".6"')}`
        + [[53.6, 16.6], [55.4, 27], [53, 40.4], [55.6, 53.4], [53.4, 62.4]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".8" fill="${OUT}" opacity=".35"/>`).join('') + '</g>'
        + HOLD(49.8, 20.6, '#9B5DE5', 2.8) + HOLD(48.6, 33.2, '#FF4FA0', 3.3) + HOLD(48, 48.6, '#FFC21A', 3.1) + HOLD(47.4, 60.8, '#2FCB7A', 3.1);
      // Chalkbag hinten am Gürtel
      const [cx, cy] = rot(-8.4, 2.6);
      afterBody += `<g transform="translate(${f(cx)} ${f(cy)}) rotate(-6)"><rect x="-2.6" y="-2.4" width="5.2" height="5.8" rx="1.8" fill="#9B5DE5" ${s1(1.2)}/><path d="M-2.3 -1.4Q0 -2.8 2.3 -1.4" stroke="#fff" stroke-width="1.3" fill="none"/></g>`;
    }
    if (pz === 'run' && !idle) envBack += `<g class="speed" stroke="#fff" stroke-opacity=".8" stroke-width="1.8"><path d="M8 38L14 38"/><path d="M6 45.5L13 45.5"/><path d="M9 53L14 53"/></g>`;
    if (pz === 'bike') {
      const fr = lum(color) > .85 || ['#FF8FB8', '#FFB4F0'].includes(color) ? '#6EEBB0' : '#E9EEF7';
      const wheel = x => `<circle cx="${x}" cy="59" r="6.9" fill="#fff" fill-opacity=".1" stroke="${OUT}" stroke-width="2.8"/><circle cx="${x}" cy="59" r="5.3" fill="none" stroke="#DDE3EE" stroke-width="1"/><g class="j spin" style="transform-origin:${x}px 59px">${ln(`M${x - 5.2} 59L${x + 5.2} 59M${x} 53.8L${x} 64.2M${x - 3.7} 55.3L${x + 3.7} 62.7M${x - 3.7} 62.7L${x + 3.7} 55.3`, .6, '#C3CBDA')}</g><circle cx="${x}" cy="59" r="1.3" fill="${OUT}"/>`;
      const tube = 'M13.4 59L30.8 58.6L27.4 51.6ZM27.4 51.6L44.6 49.4L30.8 58.6M44.6 49.4L50.6 59';
      mid += wheel(13.4) + wheel(50.6) + ln(tube, 3.2 + 2 * 1.2, OUT) + ln(tube, 3.2, fr)
        + ln('M44.6 49.4L45.6 44.6', 2 + 2.4, OUT) + ln('M44.6 49.4L45.6 44.6', 2, '#C3CBDA')
        + `<path d="M23.4 51.2Q27.6 49.2 31.4 51.2Q27.4 52.8 23.4 51.2Z" fill="#2F3450" ${s1(1.1)}/><circle cx="30.8" cy="58.6" r="2.3" fill="#DDE3EE" ${s1(1.1)}/>`
        + `<rect x="43.2" y="43.4" width="4.8" height="2.6" rx="1.3" fill="#2F3450" ${s1(1)}/>`;
      if (isLead) mid += flamesSVG(P.fl[0], P.fl[1], P.flS); // brennt am Hinterrad, vor dem Reifen
    }
    if (pz === 'workout') {
      // Langhantel auf Hüfthöhe vor den Oberschenkeln, große rote Scheiben neben den Beinen
      const y = 56;
      const plate = (x, h, w, c) => `<rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${w}" height="${h}" rx="1.5" fill="${c}" ${s1(1.2)}/>`;
      afterBody += ln(`M5.4 ${y}L58.6 ${y}`, 2 + 2.4, OUT) + ln(`M5.4 ${y}L58.6 ${y}`, 2, '#DDE3EE')
        + plate(9.6, 18, 4.8, '#E23E3E') + plate(14, 12.6, 3.4, '#3A3F58') + plate(54.4, 18, 4.8, '#E23E3E') + plate(50, 12.6, 3.4, '#3A3F58')
        + `<rect x="15.8" y="${y - 2.4}" width="1.6" height="4.8" rx=".6" fill="#C3CBDA" ${s1(.9)}/><rect x="46.6" y="${y - 2.4}" width="1.6" height="4.8" rx=".6" fill="#C3CBDA" ${s1(.9)}/>`
        + `<rect x="8.2" y="${y - 7.4}" width="1.2" height="12" rx=".6" fill="#fff" opacity=".4"/><rect x="53" y="${y - 7.4}" width="1.2" height="12" rx=".6" fill="#fff" opacity=".4"/>`;
    }
    if (pz === 'yoga') {
      envBack += `<rect x="7" y="62.6" width="50" height="3.6" rx="1.8" fill="#9B5DE5" ${s1(1.2)}/>`;
      front += `<g class="sparkle" fill="#FFF1B0">${[[11, 26, 1.6], [53, 22, 2], [50, 40, 1.3]].map(([x, y, r]) => `<path d="M${x} ${y - 2 * r}Q${x} ${y} ${x + 2 * r} ${y}Q${x} ${y} ${x} ${y + 2 * r}Q${x} ${y} ${x - 2 * r} ${y}Q${x} ${y} ${x} ${y - 2 * r}Z"/>`).join('')}</g>`;
    }
    if (pz === 'sofa') {
      envBack += `<rect x="8" y="37" width="48" height="24" rx="7" fill="#8A5A44" ${S}/>` + ln('M21.5 40L21.5 54M42.5 40L42.5 54', 1, '#6F4533')
        + `<rect x="5" y="47" width="10" height="17" rx="5" fill="#7A4C38" ${S}/><rect x="49" y="47" width="10" height="17" rx="5" fill="#7A4C38" ${S}/>` + ln('M10 64L10 66.4M54 64L54 66.4', 2.6, '#3E271D');
      afterBody += `<rect x="12" y="55.6" width="40" height="8.6" rx="4" fill="#A56B50" ${S}/>`
        + `<g transform="rotate(-8 16 51)"><path d="M11.6 45.6L20.4 45.6L21 56.6L11 56.6Z" fill="#FFD23F" ${S}/><path d="M11.4 49.4L20.7 49.4L20.8 52L11.2 52Z" fill="#E23E3E"/><path d="M11.6 45.6L20.4 45.6L21 56.6L11 56.6Z" fill="none" ${S}/>${ln('M12 45.2L13.2 44.2L14.4 45.2L15.6 44.2L16.8 45.2L18 44.2L19.2 45.2L20.2 44.4', 1, OUT)}</g>`;
    }
    // Flammen am Fuß (nicht beim Schlafen, beim Rad am Hinterrad – siehe oben)
    // Hantel: vor den Scheiben zeichnen, sonst verdeckt die linke Scheibe die Flammen
    let flames = isLead && pz !== 'bike' && P.fl ? flamesSVG(P.fl[0], P.fl[1], P.flS || 1) : '';
    if (P.flFront) { front += flames; flames = ''; }
    let overlay = '';
    if (sleep) {
      const Z = (x, y, s, d) => { const p = `M${x} ${y}L${x + s} ${y}L${x} ${y + s * 1.05}L${x + s} ${y + s * 1.05}`; return `<g style="animation-delay:${d}s">${ln(p, 1.6 + 2.6, OUT)}${ln(p, 1.6, '#fff')}</g>`; };
      overlay += `<g class="zz">${Z(40.8, 29.8, 4.4, 0)}${Z(45.4, 20.6, 5.4, .6)}${Z(50.6, 10.8, 6.4, 1.2)}</g>`;
      // Rotzblase an der Nase, größer und mit kräftigem Rand
      const [bxx, byy] = [HX + 3.4 * HS, HY + 6.6 * HS];
      overlay += `<g class="snot" style="transform-origin:${f(bxx - 1)}px ${f(byy)}px"><circle cx="${f(bxx + 1.6)}" cy="${f(byy + .6)}" r="3.9" fill="#D9F3FF" fill-opacity=".85" stroke="#4FB0E6" stroke-width="1.2"/><circle cx="${f(bxx + .4)}" cy="${f(byy - .8)}" r="1" fill="#fff"/></g>`;
    }
    if (web) overlay += `<g transform="translate(5 8)"><g stroke="#fff" stroke-opacity=".85" stroke-width=".7" fill="none"><path d="M0 0L22 0M0 0L0 22M0 0L17 11M0 0L10 17M0 0L20 5M0 0L5 20"/><path d="M6 0Q5 3 5.4 3.4Q3 5 0 6M12 0Q11 5 10.2 6.6Q6 10 0 12M18 0Q16.6 6 15 8.8Q9.6 14.6 0 18"/><path d="M13.6 8.6L13.6 20"/></g><circle cx="13.6" cy="21.4" r="1.9" fill="#23283A" stroke="#fff" stroke-width=".6"/></g>`;

    // Ebenen: Haare/Ohren hinten, hintere Glieder, Requisiten, Schwanz, Umhang (über dem Schwanz), vordere Glieder, Körper, ...
    const figure = `${headBack}${farLimbs}${mid}${tail}${cape}${underLimbs}${neckStub}${body.svg}${afterBody}${neck}${overLimbs}${head}${scarf}${topLimbs}`;
    let scene = `${envBack}${flames}<g class="bob">${figure}</g>${front}${overlay}`;
    // Porträt: unten (Körper) und seitlich abschneiden, nach oben dürfen hohe Hüte, Ohren und Frisuren überstehen
    if (portrait) { defs.push(`<clipPath id="${pre}c"><rect x="10.5" y="-40" width="43" height="90.53"/></clipPath>`); scene = `<g clip-path="url(#${pre}c)">${scene}</g>`; }
    return `<svg viewBox="${portrait ? PORTRAIT_VIEWBOX : VIEWBOX}" class="kn p-${pz}${idle ? ' idle' : ''}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><defs>${defs.join('')}</defs>${scene}</svg>`;
  }

  const Figure = { OUT, shade, BASES, BASE, SKINS, HAIR_COLORS, JERSEYS, PARTS, DEFAULT, POSES, VIEWBOX, PORTRAIT_VIEWBOX, GROUND, normalize, allowed, randomAvatar, figureSVG };
  if (typeof module !== 'undefined' && module.exports) module.exports = Figure;
  global.Figure = Figure;
})(typeof window !== 'undefined' ? window : globalThis);
