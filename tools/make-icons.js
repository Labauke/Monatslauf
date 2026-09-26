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
function figure(scale) {
  // Figur mit Flammen und Sonnenbrille (Spitzenreiter), zentriert
  const svg = Figure.figureSVG({ uid: 'icon', avatar, color: '#FFD23F', pose: 'run', lead: true, idle: true });
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const s = 512 * scale / 70;
  const tx = 256 - 20 * s, ty = 256 - 17 * s;
  return `<g transform="translate(${tx} ${ty}) scale(${s})">${inner}</g>`;
}
function iconSVG({ scale, rounded }) {
  const bg = rounded ? `<rect width="512" height="512" rx="112" fill="#2451B8"/>` : `<rect width="512" height="512" fill="#2451B8"/>`;
  const lanes = `<path d="M0 404 H512" stroke="rgba(255,255,255,.35)" stroke-width="10"/><path d="M0 120 H512" stroke="rgba(255,255,255,.18)" stroke-width="6"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${bg}${lanes}${figure(scale)}</svg>`;
}

fs.writeFileSync(path.join(out, 'icon.svg'), iconSVG({ scale: .74, rounded: true }));
const variants = [
  ['icon-512.png', 512, iconSVG({ scale: .74, rounded: false })],
  ['icon-192.png', 192, iconSVG({ scale: .74, rounded: false })],
  ['apple-touch-icon.png', 180, iconSVG({ scale: .74, rounded: false })],
  ['icon-maskable-512.png', 512, iconSVG({ scale: .56, rounded: false })],
];

const browsers = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const browser = browsers.find(b => fs.existsSync(b));
if (!browser) { console.error('Kein Edge/Chrome gefunden, nur icon.svg erzeugt.'); process.exit(1); }

const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'icons-'));
for (const [name, size, svg] of variants) {
  const html = path.join(tmp, name + '.html');
  fs.writeFileSync(html, `<!doctype html><html><body style="margin:0;background:#2451B8"><div style="width:${size}px;height:${size}px">${svg.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</div></body></html>`);
  execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${size},${size}`, `--screenshot=${path.join(out, name)}`, 'file:///' + html.replace(/\\/g, '/')], { stdio: 'ignore' });
  console.log('geschrieben:', name);
}
fs.rmSync(tmp, { recursive: true, force: true });
