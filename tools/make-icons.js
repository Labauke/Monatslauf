// Erzeugt die App-Icons aus einer Figur.
// Aufruf: node tools/make-icons.js   (braucht Microsoft Edge oder Chrome für die PNG-Dateien)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Figure = require('../js/figure.js');

const root = path.join(__dirname, '..');
const out = path.join(root, 'icons');
fs.mkdirSync(out, { recursive: true });

const avatar = { base: 'mensch', skin: '#EAB88E', hair: 'stachel', hairColor: '#2A2238', glasses: 'keine', extra: 'nichts', shoes: 'weiss' };
// Spitzenreiter: Laufpose mit Flammen und Sonnenbrille, ohne Animation
const svg = Figure.figureSVG({ uid: 'icon', avatar, color: '#FFD23F', pose: 'run', lead: true, idle: true });

// Sichtbarer Inhalt der Laufpose in Figur-Koordinaten, aus den Posendaten statt aus festen Zahlen:
// links die Flammenspitze (16 Einheiten hinter dem Ankerpunkt), rechts der Kopf, oben die Frisur, unten Boden und Schatten
const P = Figure.POSES.run;
const box = { x: P.fl[0] - 17, y: P.head[1] - 20, r: P.head[0] + 14, b: Figure.GROUND + 2.4 };
box.w = box.r - box.x; box.h = box.b - box.y;

// Figur als eingebettetes <svg>: Inhalt (box) mittig, Höhe = scale × 512; gibt auch die Bodenlinie zurück
function figure(scale) {
  const h = 512 * scale, k = h / box.h, w = box.w * k;
  const x = 256 - w / 2, y = 256 - h / 2;
  const inner = svg.replace(/^<svg[^>]*?viewBox="[^"]*"/, `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}" overflow="visible"`);
  return { inner, top: y, ground: y + (Figure.GROUND - box.y) * k };
}
function iconSVG({ scale, rounded }) {
  const bg = rounded ? `<rect width="512" height="512" rx="112" fill="#2451B8"/>` : `<rect width="512" height="512" fill="#2451B8"/>`;
  // Bahnlinien: unten auf Fußhöhe, oben über der Frisur
  const f = figure(scale), line = Math.round(f.ground + 4), upper = Math.round(Math.min(512 - line, f.top - 10));
  const lanes = `<path d="M0 ${line} H512" stroke="rgba(255,255,255,.35)" stroke-width="10"/><path d="M0 ${upper} H512" stroke="rgba(255,255,255,.18)" stroke-width="6"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${bg}${lanes}${f.inner}</svg>`;
}

// maskable: der Inhalt muss in den sicheren Kreis (80 % Durchmesser) passen
fs.writeFileSync(path.join(out, 'icon.svg'), iconSVG({ scale: .7, rounded: true }));
const variants = [
  ['icon-512.png', 512, iconSVG({ scale: .7, rounded: false })],
  ['icon-192.png', 192, iconSVG({ scale: .7, rounded: false })],
  ['apple-touch-icon.png', 180, iconSVG({ scale: .7, rounded: false })],
  ['icon-maskable-512.png', 512, iconSVG({ scale: .54, rounded: false })],
];

const browsers = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const browser = browsers.find(b => fs.existsSync(b));
if (!browser) { console.error('Kein Edge/Chrome gefunden, nur icon.svg erzeugt.'); process.exit(1); }

// Der Edge-Starter kehrt unter Windows sofort zurück, der Browser arbeitet im Hintergrund weiter.
// Darum: eigenes Profil je Bild (sonst übernimmt ein schon laufender Edge den Aufruf) und warten, bis die PNG fertig ist.
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function waitForFile(file, timeout = 30000) {
  let last = -1;
  for (const end = Date.now() + timeout; Date.now() < end; sleep(150)) {
    const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
    if (size > 0 && size === last) return true;
    last = size;
  }
  return false;
}
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'icons-'));
let failed = 0;
variants.forEach(([name, size, svg], i) => {
  const html = path.join(tmp, name + '.html'), png = path.join(out, name);
  fs.writeFileSync(html, `<!doctype html><html><body style="margin:0;background:#2451B8"><div style="width:${size}px;height:${size}px">${svg.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</div></body></html>`);
  fs.rmSync(png, { force: true });
  execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${path.join(tmp, 'profil' + i)}`, `--window-size=${size},${size}`, `--screenshot=${png}`, 'file:///' + html.replace(/\\/g, '/')], { stdio: 'ignore' });
  if (waitForFile(png)) console.log('geschrieben:', name);
  else { console.error('FEHLER, nicht erzeugt:', name); failed++; }
});
try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); }
catch { console.warn('Hinweis: Temp-Ordner konnte nicht gelöscht werden:', tmp); }
if (failed) process.exit(1);
