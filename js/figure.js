/* Monatslauf – Figuren und Baukasten.
   Läuft im Browser (window.Figure) und in Node (für die Icon-Erzeugung). */
(function (global) {
  const OUT = '#10182A';

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = c => Math.round(c * (1 - k));
    return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`;
  }
  function hash(s) { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

  /* ---------- Baukasten-Teile ---------- */
  const BASES = [
    { id: 'mensch',  label: 'Mensch' },
    { id: 'fuchs',   label: 'Fuchs',   fur: '#F07A2E' },
    { id: 'baer',    label: 'Bär',     fur: '#8B5A3C' },
    { id: 'panda',   label: 'Panda',   fur: '#FFFFFF', limbs: '#23283A' },
    { id: 'katze',   label: 'Katze',   fur: '#9AA3B5' },
    { id: 'hase',    label: 'Hase',    fur: '#F3EEF3' },
    { id: 'frosch',  label: 'Frosch',  fur: '#6CCB5F', eyeDy: -6, crown: 10.5 },
    { id: 'einhorn', label: 'Einhorn', fur: '#FFFFFF' },
    { id: 'tiger',   label: 'Tiger',   fur: '#F59A23' },
    { id: 'pinguin', label: 'Pinguin', fur: '#23283A', noMouth: true },
    { id: 'roboter', label: 'Roboter', fur: '#BFC8D6', led: true, square: true },
  ];
  const BASE = Object.fromEntries(BASES.map(b => [b.id, b]));
  const SKINS = ['#F7D7BD', '#EAB88E', '#C98E62', '#8F5B3A', '#5E3B25'];
  const HAIR_COLORS = ['#2A2238', '#6B4226', '#E7C16B', '#C8552D', '#D7DCE5', '#FF5DA2', '#4FA3FF'];
  const JERSEYS = ['#FF7A45', '#FFD23F', '#FFFFFF', '#6EEBB0', '#FF8FB8', '#C9F26B', '#FFB4F0', '#9EE7FF', '#E23E3E', '#23283A'];
  // [id, Bezeichnung, benötigte Monatssiege]
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
    return out;
  }
  // Ersetzt Teile, für die noch nicht genug Siege da sind.
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

  /* ---------- Posen ---------- */
  const POSES = {
    run:     { head: [25, 8.5], S: [24.2, 17.5], H: [21, 31], face: 'side', shadow: true,
               arms: [{ pts: [[23, 19], [16, 24.5], [19, 30]], cls: 'a1', back: true }, { pts: [[23, 19], [29.5, 23], [33.5, 18.5]], cls: 'a2' }],
               legs: [{ pts: [[21, 31], [15.5, 38.5], [10.5, 43]], cls: 'l1', back: true }, { pts: [[21, 31], [26.5, 38.5], [25, 47]], cls: 'l2' }] },
    climb:   { head: [24, 9.5], S: [24, 17], H: [24, 31], face: 'back',
               arms: [{ pts: [[24, 19], [17, 13], [15.5, 4]], cls: 'c1' }, { pts: [[24, 19], [31, 15], [33.5, 9.5]] }],
               legs: [{ pts: [[24, 31], [17.5, 37], [17.5, 45.5]] }, { pts: [[24, 31], [30.5, 38], [32.5, 44.5]] }] },
    workout: { head: [24, 11], S: [24, 18.5], H: [24, 33], face: 'front', shadow: true,
               arms: [{ pts: [[24, 20.5], [15, 14], [14, 1.5]] }, { pts: [[24, 20.5], [33, 14], [34, 1.5]] }],
               legs: [{ pts: [[24, 33], [18, 40], [17, 48]] }, { pts: [[24, 33], [30, 40], [31, 48]] }] },
    yoga:    { head: [24, 10], S: [24, 18], H: [24, 33], face: 'front',
               arms: [{ pts: [[24, 20], [14, 12], [21, -2.5]] }, { pts: [[24, 20], [34, 12], [27, -2.5]] }],
               legs: [{ pts: [[24, 33], [24, 47.5]] }, { pts: [[24, 33], [32, 38], [25, 40.5]], noShoe: true }] },
    cheer:   { head: [24, 9], S: [24, 17], H: [24, 31], face: 'front', shadow: true,
               arms: [{ pts: [[24, 19], [16.5, 12], [13.5, 2]] }, { pts: [[24, 19], [31.5, 12], [34.5, 2]] }],
               legs: [{ pts: [[24, 31], [19, 40], [17, 48]] }, { pts: [[24, 31], [29, 40], [31, 48]] }] },
    bike:    { head: [30.5, 10], S: [27.5, 18.5], H: [20.5, 29.5], face: 'side', shadow: true,
               arms: [{ pts: [[27, 20], [31.5, 25.5], [35.5, 24]], back: true }, { pts: [[27.5, 20], [33, 26], [37, 24.2]] }],
               legs: [{ pts: [[20.5, 29.5], [26.5, 35], [21.5, 44.5]], cls: 'k1', back: true }, { pts: [[20.5, 29.5], [28.5, 33.5], [25.5, 41.5]], cls: 'k2' }] },
    sofa:    { head: [22, 15.5], S: [22, 23], H: [21, 35], face: 'front',
               arms: [{ pts: [[22, 26], [15, 32]], back: true }, { pts: [[22, 26], [28, 31], [30.5, 27.5]], cls: 'munch' }],
               legs: [{ pts: [[21, 35], [32, 35], [33, 46]] }] },
  };
  const pathOf = pts => 'M' + pts.map(p => p.join(' ')).join(' L');

  /* ---------- Tierköpfe ---------- */
  function animalParts(ch, hx, hy, view, ex, ey) {
    const f = ch.fur, s = `stroke="${OUT}" stroke-width="1.1" stroke-linejoin="round"`, face = view !== 'back';
    const fx = view === 'side' ? hx + 2.8 : hx;
    const nose = (c = OUT) => `<ellipse cx="${fx}" cy="${hy + 1.6}" rx="1.4" ry="1" fill="${c}"/>`;
    const roundEars = (outer, inner) => [-1, 1].map(k => `<circle cx="${hx + k * 6}" cy="${hy - 6}" r="3.3" fill="${outer}" ${s}/><circle cx="${hx + k * 6}" cy="${hy - 6}" r="1.6" fill="${inner}"/>`).join('');
    const cheeks = c => [-1, 1].map(k => `<circle cx="${fx + k * 4.6}" cy="${hy + 2.6}" r="1.4" fill="${c}" opacity=".8"/>`).join('');
    let behind = '', fur = '', mark = '', top = '';
    switch (ch.id) {
      case 'fuchs':
        behind = `<path d="M${hx - 6.8} ${hy - 2.5} L${hx - 8} ${hy - 13.5} L${hx - 1.5} ${hy - 6.8}Z" fill="${f}" ${s}/><path d="M${hx + 1.5} ${hy - 6.8} L${hx + 8} ${hy - 13.5} L${hx + 6.8} ${hy - 2.5}Z" fill="${f}" ${s}/><path d="M${hx - 7.8} ${hy - 11.3} L${hx - 8} ${hy - 13.5} L${hx - 6} ${hy - 12.1}Z M${hx + 6} ${hy - 12.1} L${hx + 8} ${hy - 13.5} L${hx + 7.8} ${hy - 11.3}Z" fill="#2A2238"/>`;
        mark = `<path d="M${fx - 7} ${hy + .5} Q${fx} ${hy + 4} ${fx + 7} ${hy + .5} L${fx + 7} ${hy + 9} L${fx - 7} ${hy + 9}Z" fill="#fff"/>` + nose(); break;
      case 'baer':
        behind = roundEars(f, '#D9A77A');
        mark = `<ellipse cx="${fx}" cy="${hy + 3}" rx="4.2" ry="3.2" fill="#D9A77A"/>` + nose(); break;
      case 'panda':
        behind = roundEars('#23283A', '#23283A');
        mark = ex.map((x, i) => `<ellipse cx="${x}" cy="${ey + .3}" rx="2.9" ry="3.5" transform="rotate(${i ? 25 : -25} ${x} ${ey})" fill="#23283A"/>`).join('') + nose(); break;
      case 'katze':
        behind = [-1, 1].map(k => `<path d="M${hx + k * 7} ${hy - 3} L${hx + k * 6.6} ${hy - 12.5} L${hx + k * 1.5} ${hy - 7}Z" fill="${f}" ${s}/><path d="M${hx + k * 6} ${hy - 5} L${hx + k * 5.9} ${hy - 10} L${hx + k * 3.2} ${hy - 7}Z" fill="#FF8FB8"/>`).join('');
        fur = `<path d="M${hx - 1.6} ${hy - 7.6} L${hx - 1.2} ${hy - 5} M${hx + 1.6} ${hy - 7.6} L${hx + 1.2} ${hy - 5}" stroke="#6F788C" stroke-width="1.2" stroke-linecap="round"/>`;
        mark = `<path d="M${fx - 1.4} ${hy + 1} L${fx + 1.4} ${hy + 1} L${fx} ${hy + 2.4}Z" fill="#FF8FB8"/>`;
        if (face) top = `<path d="M${fx - 3} ${hy + 2.2} L${fx - 9.5} ${hy + 1.2} M${fx - 3} ${hy + 3} L${fx - 9.5} ${hy + 3.8} M${fx + 3} ${hy + 2.2} L${fx + 9.5} ${hy + 1.2} M${fx + 3} ${hy + 3} L${fx + 9.5} ${hy + 3.8}" stroke="${OUT}" stroke-width=".6" stroke-linecap="round"/>`; break;
      case 'hase':
        behind = [-1, 1].map(k => `<ellipse cx="${hx + k * 3.2}" cy="${hy - 13}" rx="2.8" ry="7" transform="rotate(${k * 12} ${hx + k * 3.2} ${hy - 13})" fill="${f}" ${s}/><ellipse cx="${hx + k * 3.2}" cy="${hy - 13}" rx="1.3" ry="5" transform="rotate(${k * 12} ${hx + k * 3.2} ${hy - 13})" fill="#FFB4C8"/>`).join('');
        mark = cheeks('#FFB4C8') + nose('#FF8FB8');
        if (face) top = `<rect x="${fx - 1.1}" y="${hy + 4.1}" width="2.2" height="2" rx=".4" fill="#fff" stroke="${OUT}" stroke-width=".5"/>`; break;
      case 'frosch':
        behind = ex.map(x => `<circle cx="${x}" cy="${ey}" r="3.4" fill="${f}" ${s}/>`).join('');
        mark = cheeks('#FF8FB8'); break;
      case 'einhorn':
        behind = [['#C89BFF', -3, -8.6], ['#FF8FB8', -6.6, -6], ['#FFD23F', -8.8, -2], ['#6EEBB0', -9, 2.4], ['#9EE7FF', -7.6, 6]].map(([c, dx, dy]) => `<circle cx="${hx + dx}" cy="${hy + dy}" r="2.8" fill="${c}" stroke="${OUT}" stroke-width=".9"/>`).join('')
          + `<path d="M${hx + 3} ${hy - 6.5} L${hx + 5.8} ${hy - 12} L${hx + 7} ${hy - 4.2}Z" fill="${f}" ${s}/>`;
        mark = cheeks('#FFB4C8');
        top = `<path d="M${hx + .2} ${hy - 6.8} L${hx + 2.6} ${hy - 17} L${hx + 4.2} ${hy - 6.2}Z" fill="#F5B82E" ${s}/><path d="M${hx + .9} ${hy - 9.4} L${hx + 3.9} ${hy - 10.2} M${hx + 1.6} ${hy - 12.4} L${hx + 3.4} ${hy - 13}" stroke="${OUT}" stroke-width=".6"/>`; break;
      case 'tiger':
        behind = roundEars(f, '#fff');
        fur = `<path d="M${hx - 2.2} ${hy - 7.8} L${hx - 1.5} ${hy - 4.6} M${hx + 2.2} ${hy - 7.8} L${hx + 1.5} ${hy - 4.6} M${hx} ${hy - 7.8} L${hx} ${hy - 5.4} M${hx - 7.8} ${hy - 1} L${hx - 5} ${hy - .2} M${hx - 7.8} ${hy + 2.2} L${hx - 5.2} ${hy + 2.2} M${hx + 7.8} ${hy - 1} L${hx + 5} ${hy - .2} M${hx + 7.8} ${hy + 2.2} L${hx + 5.2} ${hy + 2.2}" stroke="${OUT}" stroke-width="1.3" stroke-linecap="round"/>`;
        mark = `<ellipse cx="${fx}" cy="${hy + 3.4}" rx="4.4" ry="3" fill="#fff"/>` + nose('#FF8FB8'); break;
      case 'pinguin':
        mark = `<ellipse cx="${fx}" cy="${hy + 3.4}" rx="6.4" ry="5.4" fill="#fff"/>` + ex.map(x => `<circle cx="${x}" cy="${ey}" r="3.2" fill="#fff"/>`).join('');
        if (face) top = view === 'side'
          ? `<path d="M${fx + 1} ${hy + 1.2} L${fx + 6.8} ${hy + 2.6} L${fx + 1} ${hy + 4}Z" fill="#FFA42E" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>`
          : `<path d="M${fx - 2.3} ${hy + 1.6} L${fx + 2.3} ${hy + 1.6} L${fx} ${hy + 4.6}Z" fill="#FFA42E" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>`; break;
      case 'roboter':
        behind = `<path d="M${hx} ${hy - 7} L${hx} ${hy - 12}" stroke="${OUT}" stroke-width="1.4"/><circle cx="${hx}" cy="${hy - 12.8}" r="1.9" fill="#FF4D5E" ${s}/><rect x="${hx - 9.4}" y="${hy - 1.6}" width="2.4" height="3.4" rx=".6" fill="#8C96A8" ${s}/><rect x="${hx + 7}" y="${hy - 1.6}" width="2.4" height="3.4" rx=".6" fill="#8C96A8" ${s}/>`;
        mark = `<rect x="${fx - 2.8}" y="${hy + 2.8}" width="5.6" height="2.2" rx=".6" fill="#23283A"/><path d="M${fx - 1} ${hy + 2.8} L${fx - 1} ${hy + 5} M${fx + 1} ${hy + 2.8} L${fx + 1} ${hy + 5}" stroke="#6EF3FF" stroke-width=".5"/>`; break;
    }
    return { behind, clipped: fur + (face ? mark : ''), top };
  }

  /* ---------- Menschenköpfe: Frisuren ---------- */
  function hairParts(av, hx, hy, view, covered) {
    const hc = av.hairColor, st = `stroke="${OUT}" stroke-width="1" stroke-linejoin="round"`;
    let style = av.hair;
    if (covered && ['stachel', 'irokese', 'dutt'].includes(style)) style = 'kurz';
    let behind = '', front = '';
    const topFront = `<path d="M${hx - 7.7} ${hy - .8} Q${hx - 8.2} ${hy - 9.6} ${hx} ${hy - 9} Q${hx + 8.2} ${hy - 9.6} ${hx + 7.7} ${hy - .8} Q${hx + 6.5} ${hy - 4.6} ${hx + 2} ${hy - 5.2} Q${hx - 3} ${hy - 4} ${hx - 7.7} ${hy - .8}Z" fill="${hc}" ${st}/>`;
    const topSide = `<path d="M${hx - 7.6} ${hy + 3.5} Q${hx - 8.8} ${hy - 9.6} ${hx} ${hy - 9} Q${hx + 7.8} ${hy - 9} ${hx + 7.6} ${hy - 2} Q${hx + 4} ${hy - 5.2} ${hx - .5} ${hy - 4.6} Q${hx - 3.2} ${hy - 1.5} ${hx - 3.6} ${hy + 3.8} Z" fill="${hc}" ${st}/>`;
    const topBack = `<path d="M${hx - 7.7} ${hy + 3} A7.7 7.7 0 1 1 ${hx + 7.7} ${hy + 3} Q${hx} ${hy + 6} ${hx - 7.7} ${hy + 3}Z" fill="${hc}" ${st}/>`;
    const top = view === 'back' ? topBack : view === 'side' ? topSide : topFront;
    switch (style) {
      case 'kurz': front = top; break;
      case 'stachel':
        front = (view === 'back' ? topBack : '') + `<path d="M${hx - 7.3} ${hy - 1.5} L${hx - 6.5} ${hy - 9} L${hx - 3.2} ${hy - 6.2} L${hx - 1} ${hy - 11.5} L${hx + 2} ${hy - 7} L${hx + 5.2} ${hy - 10.5} L${hx + 6} ${hy - 5} L${hx + 7.4} ${hy - 1.5} Q${hx} ${hy - 4.5} ${hx - 7.3} ${hy - 1.5}Z" fill="${hc}" ${st}/>`; break;
      case 'lang':
        behind = view === 'side'
          ? `<path d="M${hx - 8} ${hy - 3} Q${hx - 11.5} ${hy + 10} ${hx - 6} ${hy + 13.5} L${hx + 1} ${hy + 12} Q${hx + 2} ${hy + 4} ${hx + 3} ${hy} Z" fill="${hc}" ${st}/>`
          : `<path d="M${hx - 8.2} ${hy - 3} Q${hx - 10.8} ${hy + 9} ${hx - 7.5} ${hy + 13.5} L${hx + 7.5} ${hy + 13.5} Q${hx + 10.8} ${hy + 9} ${hx + 8.2} ${hy - 3} Z" fill="${hc}" ${st}/>`;
        front = top; break;
      case 'zopf':
        behind = `<g class="tail" style="transform-origin:${hx - 6}px ${hy - 3}px"><ellipse cx="${hx - 10}" cy="${hy + 1}" rx="3.3" ry="5.6" transform="rotate(25 ${hx - 10} ${hy + 1})" fill="${hc}" ${st}/></g>`;
        front = top + `<circle cx="${hx - 6.9}" cy="${hy - 2.6}" r="1.6" fill="#FF8FB8" stroke="${OUT}" stroke-width=".8"/>`; break;
      case 'dutt':
        behind = `<circle cx="${hx}" cy="${hy - 9.6}" r="3.8" fill="${hc}" ${st}/>`;
        front = top; break;
      case 'locken':
        behind = `<circle cx="${hx}" cy="${hy - 1.8}" r="10.2" fill="${hc}" ${st}/>`;
        front = view === 'back' ? topBack : [[-5.2, -5.8], [-2.6, -7.2], [.4, -7.6], [3.4, -7], [5.8, -5.4]].map(([dx, dy]) => `<circle cx="${hx + dx}" cy="${hy + dy}" r="2.5" fill="${hc}" stroke="${OUT}" stroke-width=".8"/>`).join(''); break;
      case 'irokese':
        front = `<path d="M${hx - 4} ${hy - 5.5} Q${hx - 3} ${hy - 14} ${hx} ${hy - 8.5} Q${hx + 1.5} ${hy - 15} ${hx + 3.5} ${hy - 8} Q${hx + 6} ${hy - 13} ${hx + 6} ${hy - 4.5} Z" fill="${hc}" ${st}/>`; break;
      case 'glatze':
        front = `<path d="M${hx - 3.4} ${hy - 5.2} Q${hx - .5} ${hy - 7.2} ${hx + 2.6} ${hy - 6.2}" stroke="#fff" stroke-width="1.3" stroke-linecap="round" fill="none" opacity=".6"/>`; break;
    }
    return { behind, front };
  }

  /* ---------- Figur ---------- */
  function figureSVG({ id = '', uid = '', avatar, color = '#FF7A45', wins = 0, pose = 'run', idle = false, lead = false, sleep = false, web = false }) {
    const av = allowed(normalize(avatar, id), wins);
    const P = POSES[pose] || POSES.run, [hx, hy] = P.head, view = P.face;
    const human = av.base === 'mensch';
    const ch = human ? { id: 'mensch', fur: av.skin } : BASE[av.base];
    const cap = 'stroke-linecap="round" stroke-linejoin="round" fill="none"';
    const furC = ch.limbs || ch.fur, back = shade(furC, .22);
    const shoe = { weiss: ['#FFFFFF', shade(color, .5)], rot: ['#E23E3E', '#FFFFFF'], schwarz: ['#23283A', '#FFFFFF'], gold: ['#F5B82E', '#B07A10'] }[av.shoes];
    const stroke = (d, w, c) => `<path d="${d}" stroke="${OUT}" stroke-width="${w + 2.6}" ${cap}/><path d="${d}" stroke="${c}" stroke-width="${w}" ${cap}/>`;
    const limb = (L, isLeg) => {
      const c = L.back ? back : furC, end = L.pts[L.pts.length - 1], [ox, oy] = L.pts[0];
      const tip = isLeg
        ? (L.noShoe ? '' : `<ellipse cx="${end[0] + 2}" cy="${end[1] + .6}" rx="3.9" ry="2.3" fill="${shoe[0]}" stroke="${OUT}" stroke-width="1.2"/><path d="M${end[0] - .5} ${end[1] + 1.8} L${end[0] + 5} ${end[1] + 1.8}" stroke="${shoe[1]}" stroke-width="1.1"/>`)
        : `<circle cx="${end[0]}" cy="${end[1]}" r="2.4" fill="${c}" stroke="${OUT}" stroke-width="1.2"/>`;
      return `<g class="limb ${L.cls || ''}" style="transform-origin:${ox}px ${oy}px">${stroke(pathOf(L.pts), isLeg ? 5 : 4.2, c)}${tip}</g>`;
    };
    const [sx, sy] = P.S, [px, py] = P.H;
    const mx = sx + (px - sx) * .62, my = sy + (py - sy) * .62;
    let torso = stroke(`M${sx} ${sy} L${px} ${py}`, 8.5, color) + `<path d="M${mx} ${my} L${px} ${py}" stroke="#1B2440" stroke-width="8.8" ${cap}/>`;
    if (pose === 'climb') torso += `<rect x="${px + 3}" y="${py - 5}" width="5" height="6" rx="1.5" fill="#fff" stroke="${OUT}" stroke-width="1"/>`;
    const backs = P.arms.filter(a => a.back).map(a => limb(a)).join('') + P.legs.filter(l => l.back).map(l => limb(l, true)).join('');
    const frontLegs = P.legs.filter(l => !l.back).map(l => limb(l, true)).join('');
    const frontArms = P.arms.filter(a => !a.back).map(a => limb(a)).join('');

    /* Kopf */
    const frog = ch.id === 'frosch';
    const ex = view === 'side' ? (frog ? [hx + .6, hx + 5.4] : [hx + 1.2, hx + 4.8]) : (frog ? [hx - 3.7, hx + 3.7] : [hx - 2.7, hx + 2.7]);
    const ey = hy - .3 + (ch.eyeDy || 0), po = view === 'side' ? .7 : 0;
    const fx = view === 'side' ? hx + 2.8 : hx;
    const covered = ['cap', 'muetze', 'helm', 'cowboy'].includes(av.hat);
    let behind = '', clipped = '', afterHead = '', top = '';
    if (human) {
      const hp = hairParts(av, hx, hy, view, covered);
      const ear = (x, y) => `<circle cx="${x}" cy="${y}" r="2.2" fill="${av.skin}" stroke="${OUT}" stroke-width="1"/><circle cx="${x}" cy="${y}" r="1" fill="${shade(av.skin, .18)}"/>`;
      behind = hp.behind + (view === 'side' ? '' : ear(hx - 7.5, hy + .8) + ear(hx + 7.5, hy + .8));
      afterHead = hp.front + (view === 'side' ? ear(hx - 3.2, hy + 1.8) : '');
      if (view !== 'back') {
        clipped = [-1, 1].map(k => `<circle cx="${fx + k * 4.4}" cy="${hy + 2.6}" r="1.5" fill="#FF8FA3" opacity=".35"/>`).join('');
        afterHead += view === 'side'
          ? `<path d="M${hx + 7.3} ${hy - .4} Q${hx + 9.4} ${hy + 1.3} ${hx + 7.2} ${hy + 2.2}" fill="${av.skin}" stroke="${OUT}" stroke-width=".9"/>`
          : `<path d="M${hx - .8} ${hy + 1.3} Q${hx} ${hy + 2.3} ${hx + .8} ${hy + 1.3}" stroke="${shade(av.skin, .35)}" stroke-width=".9" fill="none" stroke-linecap="round"/>`;
      }
    } else {
      const ap = animalParts(ch, hx, hy, view, ex, ey);
      behind = ap.behind; clipped = ap.clipped; top = ap.top;
    }
    let face = '';
    if (view !== 'back') {
      const mouthX = view === 'side' ? hx + 3.2 : hx;
      if (sleep) face = ex.map(x => `<path d="M${x - 1.7} ${ey} Q${x} ${ey + 1.5} ${x + 1.7} ${ey}" stroke="${OUT}" stroke-width="1.1" ${cap}/>`).join('');
      else if (lead) face = `<path d="M${hx - 7.4} ${ey - 1} L${ex[0] - 2.6} ${ey - 1}" stroke="${OUT}" stroke-width="1.2"/><rect x="${ex[0] - 2.8}" y="${ey - 2.6}" width="${ex[1] - ex[0] + 5.6}" height="4.4" rx="2" fill="${OUT}"/><path d="M${ex[0] - 1.4} ${ey - 1.4} L${ex[0] + .6} ${ey - 1.4}" stroke="#9EE7FF" stroke-width=".9" stroke-linecap="round"/>`;
      else if (ch.led) face = ex.map(x => `<rect x="${x - 1.6}" y="${ey - 1.3}" width="3.2" height="2.6" rx=".8" fill="#6EF3FF" stroke="${OUT}" stroke-width=".7"/>`).join('');
      else face = ex.map(x => `<ellipse cx="${x}" cy="${ey}" rx="1.9" ry="2.2" fill="#fff" stroke="${OUT}" stroke-width=".8"/><circle cx="${x + po}" cy="${ey + .2}" r="1" fill="${OUT}"/><circle cx="${x + po + .4}" cy="${ey - .4}" r=".35" fill="#fff"/>`).join('');
      /* Bart */
      if (human && av.beard !== 'keiner') {
        const hc = av.hairColor;
        if (av.beard === 'vollbart') face += `<path d="M${fx - 7.4} ${hy + .2} Q${fx - 6.4} ${hy + 9.6} ${fx} ${hy + 10.2} Q${fx + 6.4} ${hy + 9.6} ${fx + 7.4} ${hy + .2} Q${fx + 5} ${hy + 2.4} ${fx + 3} ${hy + 2.8} Q${fx} ${hy + 1.8} ${fx - 3} ${hy + 2.8} Q${fx - 5} ${hy + 2.4} ${fx - 7.4} ${hy + .2}Z" fill="${hc}" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>`;
        if (av.beard === 'kinnbart') face += `<path d="M${fx - 2.2} ${hy + 6.2} L${fx + 2.2} ${hy + 6.2} L${fx} ${hy + 10.2}Z" fill="${hc}" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>`;
      }
      if (!ch.noMouth && ch.id !== 'roboter') face += sleep ? `<ellipse cx="${mouthX}" cy="${hy + 3.9}" rx="1.1" ry="1.3" fill="${OUT}"/>`
        : `<path d="M${mouthX - 1.8} ${hy + 3.3} Q${mouthX} ${hy + (lead ? 5.7 : 4.9)} ${mouthX + 1.8} ${hy + 3.3}" stroke="${av.beard === 'vollbart' ? '#fff' : OUT}" stroke-width="1.1" ${lead ? 'fill="#fff"' : cap}/>`;
      if (human && av.beard === 'schnurrbart') face += `<path d="M${fx - 3.4} ${hy + 3.2} Q${fx - 1.6} ${hy + 1.5} ${fx} ${hy + 2.4} Q${fx + 1.6} ${hy + 1.5} ${fx + 3.4} ${hy + 3.2} Q${fx + 1.6} ${hy + 3} ${fx} ${hy + 3} Q${fx - 1.6} ${hy + 3} ${fx - 3.4} ${hy + 3.2}Z" fill="${av.hairColor}" stroke="${OUT}" stroke-width=".7"/>`;
      /* Brille (die Spitze trägt automatisch Sonnenbrille) */
      if (!lead && av.glasses !== 'keine') {
        const [a, b] = ex, arm = view === 'side' ? `<path d="M${a - 2.6} ${ey - .4} L${hx - 1.4} ${ey - .4}" stroke="${OUT}" stroke-width=".8"/>` : '';
        if (av.glasses === 'rund') face += arm + ex.map(x => `<circle cx="${x}" cy="${ey}" r="2.7" fill="rgba(255,255,255,.25)" stroke="${OUT}" stroke-width="1"/>`).join('') + `<path d="M${a + 2.7} ${ey - .4} L${b - 2.7} ${ey - .4}" stroke="${OUT}" stroke-width=".9"/>`;
        if (av.glasses === 'nerd') face += arm + ex.map(x => `<rect x="${x - 2.8}" y="${ey - 2.3}" width="5.6" height="4.4" rx="1.2" fill="rgba(255,255,255,.2)" stroke="${OUT}" stroke-width="1.5"/>`).join('');
        if (av.glasses === 'sport') face += arm + `<rect x="${a - 3.2}" y="${ey - 2}" width="${b - a + 6.4}" height="3.8" rx="1.9" fill="#FF5DA2" opacity=".9" stroke="${OUT}" stroke-width=".9"/><path d="M${a - 1.8} ${ey - .9} L${a + .4} ${ey - .9}" stroke="#fff" stroke-width=".8" stroke-linecap="round"/>`;
        if (av.glasses === 'pilot') face += arm + ex.map(x => `<path d="M${x - 2.8} ${ey - 1.8} L${x + 2.8} ${ey - 1.8} Q${x + 2.8} ${ey + 2.6} ${x} ${ey + 2.4} Q${x - 2.8} ${ey + 2.6} ${x - 2.8} ${ey - 1.8}Z" fill="#23283A" stroke="#F5B82E" stroke-width="1"/>`).join('') + `<path d="M${a + 2.8} ${ey - 1.6} L${b - 2.8} ${ey - 1.6}" stroke="#F5B82E" stroke-width="1"/>`;
      }
    }

    /* Kopfhörer, Hüte */
    let gear = '';
    if (av.extra === 'kopfhoerer') {
      gear += `<path d="M${hx - 8} ${hy + 1} Q${hx - 9} ${hy - 11} ${hx} ${hy - 10.4} Q${hx + 9} ${hy - 11} ${hx + 8} ${hy + 1}" stroke="${OUT}" stroke-width="3.2" ${cap}/><path d="M${hx - 8} ${hy + 1} Q${hx - 9} ${hy - 11} ${hx} ${hy - 10.4} Q${hx + 9} ${hy - 11} ${hx + 8} ${hy + 1}" stroke="#23283A" stroke-width="1.8" ${cap}/>`;
      gear += view === 'side' ? `<circle cx="${hx - 1.6}" cy="${hy + .8}" r="3.4" fill="#FF5DA2" stroke="${OUT}" stroke-width="1"/>`
        : [-1, 1].map(k => `<rect x="${hx + k * 8.6 - 2}" y="${hy - 2.6}" width="4" height="6.4" rx="1.6" fill="#FF5DA2" stroke="${OUT}" stroke-width="1"/>`).join('');
    }
    const hatC = color, s1 = `stroke="${OUT}" stroke-width="1.1" stroke-linejoin="round"`;
    const dome = (r, bottom) => `M${hx - r} ${hy + bottom} A${r} ${r} 0 0 1 ${hx + r} ${hy + bottom} Z`;
    switch (av.hat) {
      case 'cap':
        gear += `<path d="${dome(7.9, -1.6)}" fill="${hatC}" ${s1}/>` + (view === 'back' ? '' : `<path d="M${hx + 3} ${hy - 2.2} L${hx + 13} ${hy - 1.6} Q${hx + 11.5} ${hy + .6} ${hx + 3} ${hy - .2}Z" fill="${shade(hatC, .2)}" ${s1}/>`) + `<circle cx="${hx}" cy="${hy - 9.3}" r="1.1" fill="${OUT}"/>`; break;
      case 'muetze':
        gear += `<path d="${dome(7.9, -2.2)}" fill="${hatC}" ${s1}/><rect x="${hx - 8.4}" y="${hy - 4}" width="16.8" height="3.6" rx="1.6" fill="#fff" ${s1}/><circle cx="${hx}" cy="${hy - 10.8}" r="2.8" fill="#fff" ${s1}/>`; break;
      case 'stirnband':
        gear += `<rect x="${hx - 7.8}" y="${hy - 4.8}" width="15.6" height="3.2" rx="1.3" fill="#E23E3E" stroke="${OUT}" stroke-width=".9"/><path d="M${hx - 7.4} ${hy - 3.4} L${hx - 12} ${hy - 1.2} M${hx - 7.4} ${hy - 2.6} L${hx - 11.4} ${hy + .8}" stroke="#E23E3E" stroke-width="1.6" stroke-linecap="round"/>`; break;
      case 'helm':
        gear += `<path d="M${hx - 8.8} ${hy - .8} A8.8 8.8 0 0 1 ${hx + 8.8} ${hy - .8} L${hx + 9.4} ${hy + .4} L${hx - 9.4} ${hy + .4}Z" fill="#FFD23F" ${s1}/><path d="M${hx - 4} ${hy - 7.6} L${hx - 3} ${hy - 4.6} M${hx} ${hy - 8.6} L${hx} ${hy - 5.2} M${hx + 4} ${hy - 7.6} L${hx + 3} ${hy - 4.6}" stroke="${OUT}" stroke-width="1.1" stroke-linecap="round"/>`; break;
      case 'cowboy':
        gear += `<path d="M${hx - 5.6} ${hy - 5} Q${hx - 6.2} ${hy - 13} ${hx - 2} ${hy - 12} Q${hx} ${hy - 10} ${hx + 2} ${hy - 12} Q${hx + 6.2} ${hy - 13} ${hx + 5.6} ${hy - 5}Z" fill="#A56B3F" ${s1}/><rect x="${hx - 5.6}" y="${hy - 7.4}" width="11.2" height="1.8" fill="#5C3A2B"/><ellipse cx="${hx}" cy="${hy - 5}" rx="12.5" ry="2.6" fill="#8A5A34" ${s1}/>`; break;
      case 'party':
        gear += `<path d="M${hx - 5} ${hy - 6} L${hx + 1.2} ${hy - 19.5} L${hx + 5} ${hy - 6}Z" fill="#9B5DE5" ${s1}/><circle cx="${hx - 1}" cy="${hy - 9}" r="1" fill="#FFD23F"/><circle cx="${hx + 2.2}" cy="${hy - 12}" r="1" fill="#6EEBB0"/><circle cx="${hx + .4}" cy="${hy - 15}" r=".9" fill="#FFD23F"/><circle cx="${hx + 1.2}" cy="${hy - 19.8}" r="2.1" fill="#FFD23F" ${s1}/>`; break;
      case 'krone': {
        const cy = hy - (ch.crown || 8) - (human && ['stachel', 'irokese', 'locken', 'dutt'].includes(av.hair) ? 3 : 0);
        gear += `<path d="M${hx - 6.5} ${cy + 6} L${hx - 5.5} ${cy - .5} L${hx - 2.7} ${cy + 3.5} L${hx} ${cy - 1.5} L${hx + 2.7} ${cy + 3.5} L${hx + 5.5} ${cy - .5} L${hx + 6.5} ${cy + 6} Z" fill="#F5B82E" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/><circle cx="${hx}" cy="${cy + 3.8}" r="1.1" fill="#E23E3E"/>`; break;
      }
    }

    const shape = ch.square ? `<rect x="${hx - 7.4}" y="${hy - 7.4}" width="14.8" height="14.8" rx="3.6"` : `<circle cx="${hx}" cy="${hy}" r="7.6"`;
    const clipId = `hc-${uid || 'x'}-${pose}`;
    const head = `${behind}${shape} fill="${ch.fur}"/><clipPath id="${clipId}">${shape}/></clipPath><g clip-path="url(#${clipId})">${clipped}</g>${shape} fill="none" stroke="${OUT}" stroke-width="1.3"/>${afterHead}${face}${top}${gear}`;

    /* Umhang, Schal, Medaille */
    let capeBehind = '', neck = '';
    if (av.extra === 'umhang' && pose !== 'sofa') {
      const c = '#C2344D';
      if (view === 'back') neck += `<path d="M${sx - 4.5} ${sy} L${sx + 4.5} ${sy} L${sx + 7.5} ${py + 8} L${sx - 7.5} ${py + 8}Z" fill="${c}" stroke="${OUT}" stroke-width="1.1" stroke-linejoin="round"/>`;
      else if (view === 'side') capeBehind = `<g class="cape" style="transform-origin:${sx}px ${sy}px"><path d="M${sx - 1} ${sy - 1} Q${sx - 7} ${sy + 8} ${sx - 17} ${py + 3} L${sx - 12} ${py + 9} Q${sx - 4} ${py + 3} ${sx + 2} ${sy + 2}Z" fill="${c}" stroke="${OUT}" stroke-width="1.1" stroke-linejoin="round"/></g>`;
      else capeBehind = `<path d="M${sx - 4} ${sy} L${sx + 4} ${sy} L${sx + 10} ${py + 10} Q${sx} ${py + 13} ${sx - 10} ${py + 10} Z" fill="${c}" stroke="${OUT}" stroke-width="1.1" stroke-linejoin="round"/>`;
    }
    if (av.extra === 'schal') {
      neck += `<path d="M${sx - 4} ${sy - .5} Q${sx} ${sy + 2.2} ${sx + 4} ${sy - .5}" stroke="${OUT}" stroke-width="4.6" ${cap}/><path d="M${sx - 4} ${sy - .5} Q${sx} ${sy + 2.2} ${sx + 4} ${sy - .5}" stroke="#E23E3E" stroke-width="2.8" ${cap}/>`
        + `<g class="tail" style="transform-origin:${sx - 3}px ${sy}px"><path d="M${sx - 3} ${sy + .5} L${sx - 9.5} ${sy + 3.5}" stroke="${OUT}" stroke-width="4.2" ${cap}/><path d="M${sx - 3} ${sy + .5} L${sx - 9.5} ${sy + 3.5}" stroke="#E23E3E" stroke-width="2.4" ${cap}/></g>`;
    }
    if (av.extra === 'medaille' && view !== 'back') neck += `<path d="M${sx - 3} ${sy - 1} L${sx} ${sy + 4.5} L${sx + 3} ${sy - 1}" fill="none" stroke="#E23E3E" stroke-width="1.5"/><circle cx="${sx}" cy="${sy + 6.2}" r="2.8" fill="#F5B82E" stroke="${OUT}" stroke-width=".8"/>`;

    /* Umgebung je Pose */
    let under = '', over = '';
    if (P.shadow) under += `<ellipse cx="22" cy="50" rx="13" ry="2.2" fill="rgba(0,0,0,.28)"/>`;
    if (pose === 'climb') under += `<rect x="7" y="-6" width="34" height="56" rx="3" fill="rgba(255,255,255,.12)"/>` +
      [[15.5, 2.5, '#FFD23F'], [34, 8.5, '#6EEBB0'], [17.5, 47.5, '#FF8FB8'], [33, 46.5, '#9EE7FF'], [29, 24, '#FF7A45'], [12, 30, '#C9F26B']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="2.5" fill="${c}" stroke="${OUT}" stroke-width=".8"/>`).join('');
    if (pose === 'bike') {
      const frame = shade(color === '#FFFFFF' ? '#9EE7FF' : color, .15);
      const wheel = x => `<circle cx="${x}" cy="44" r="7.6" fill="none" stroke="${OUT}" stroke-width="2.6"/><circle cx="${x}" cy="44" r="7.6" fill="none" stroke="#DDE3EE" stroke-width="1.2"/><g class="spin" style="transform-origin:${x}px 44px"><path d="M${x - 6.6} 44 L${x + 6.6} 44 M${x} 37.4 L${x} 50.6 M${x - 4.7} 39.3 L${x + 4.7} 48.7 M${x - 4.7} 48.7 L${x + 4.7} 39.3" stroke="#AAB3C5" stroke-width=".6"/></g><circle cx="${x}" cy="44" r="1.2" fill="${OUT}"/>`;
      const tube = `M5 44 L22 44 L18.5 29.5 Z M18.5 29.5 L34 27.5 L22 44 M34 27.5 L39 44`;
      under += wheel(5) + wheel(39) + `<path d="${tube}" fill="none" stroke="${OUT}" stroke-width="3.4" stroke-linejoin="round"/><path d="${tube}" fill="none" stroke="${frame}" stroke-width="1.8" stroke-linejoin="round"/>`
        + `<path d="M15.5 28.4 L21.5 28.4" stroke="${OUT}" stroke-width="2.6" stroke-linecap="round"/><path d="M34 27.5 L35 23.6 L38.5 24" stroke="${OUT}" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="22" cy="44" r="2.4" fill="#DDE3EE" stroke="${OUT}" stroke-width="1"/>`;
    }
    if (pose === 'yoga') under +=`<rect x="6" y="48.6" width="36" height="2.6" rx="1.3" fill="#9B5DE5" stroke="${OUT}" stroke-width=".8"/>`;
    if (pose === 'sofa') {
      under += `<rect x="3" y="24" width="42" height="16" rx="5" fill="#8A5A44" stroke="${OUT}" stroke-width="1.2"/><rect x="1" y="34" width="46" height="10" rx="4" fill="#A56B50" stroke="${OUT}" stroke-width="1.2"/><rect x="-1" y="29" width="7" height="15" rx="3" fill="#7A4C38" stroke="${OUT}" stroke-width="1.2"/><rect x="42" y="29" width="7" height="15" rx="3" fill="#7A4C38" stroke="${OUT}" stroke-width="1.2"/><path d="M5 44 L5 48 M43 44 L43 48" stroke="#3E271D" stroke-width="2.5" stroke-linecap="round"/>`;
      over += `<rect x="29" y="27" width="8" height="10" rx="1.5" fill="#FFD23F" stroke="#E23E3E" stroke-width="1.4"/><circle cx="31" cy="26.5" r="1.3" fill="#F5B82E" stroke="${OUT}" stroke-width=".5"/>`;
    }
    if (pose === 'workout') over += `<path d="M6 1.5 L42 1.5" stroke="#DDE3EE" stroke-width="2.2" stroke-linecap="round"/><rect x="3" y="-4.5" width="5.5" height="12" rx="1.5" fill="#1A1F2B" stroke="#fff" stroke-width=".7"/><rect x="39.5" y="-4.5" width="5.5" height="12" rx="1.5" fill="#1A1F2B" stroke="#fff" stroke-width=".7"/>`;
    const speed = pose === 'run' && !idle ? `<g class="speed" stroke="rgba(255,255,255,.75)" stroke-width="1.6" stroke-linecap="round"><path d="M-3 17 L5 17"/><path d="M-9 25 L2 25"/><path d="M-5 33 L3 33"/></g>` : '';
    const flames = lead ? `<g class="flames"><path d="M10 47 Q2 44 -9 47.5 Q1 50 10 49 Z" fill="#FFB02E"/><path d="M10 43 Q0 39 -7 42 Q1 45.5 10 45 Z" fill="#FF6A3D"/><path d="M10 45.5 Q5 44 0 45.5 Q5 47 10 46.5 Z" fill="#FFF2B0"/></g>` : '';
    const zz = sleep ? `<g class="zz"><text x="${hx + 8}" y="${hy - 7}" font-size="7">z</text><text x="${hx + 12}" y="${hy - 12}" font-size="8.5">z</text><text x="${hx + 17}" y="${hy - 17}" font-size="10">Z</text></g>` : '';
    const cob = web ? `<g stroke="rgba(255,255,255,.8)" stroke-width=".6" fill="none"><path d="M-11 -17 L7 -17 M-11 -17 L-11 1 M-11 -17 L4 -6 M-11 -17 L-2 -1 M-11 -17 L6 -11"/><path d="M-6 -17 Q-7 -12 -11 -11 M-1 -17 Q-3 -9 -11 -6 M4 -17 Q1 -4 -11 -1"/><path d="M4 -6 L4 1"/></g><circle cx="4" cy="2" r="1.7" fill="#fff"/>` : '';
    return `<svg viewBox="-12 -18 64 70" class="p-${pose}${idle ? ' idle' : ''}" aria-hidden="true">${speed}${flames}${cob}${under}<g class="bob">${capeBehind}${backs}${torso}${neck}${frontLegs}${head}${frontArms}${over}</g>${zz}</svg>`;
  }

  const Figure = { OUT, shade, BASES, BASE, SKINS, HAIR_COLORS, JERSEYS, PARTS, DEFAULT, POSES, normalize, allowed, randomAvatar, figureSVG };
  if (typeof module !== 'undefined' && module.exports) module.exports = Figure;
  global.Figure = Figure;
})(typeof window !== 'undefined' ? window : globalThis);
