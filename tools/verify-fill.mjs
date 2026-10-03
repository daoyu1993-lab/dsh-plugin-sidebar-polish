/**
 * Verify the sidebar fill rules of dsh-plugin-sidebar-polish in a real engine.
 *
 * The plugin's browser half is loaded from `dsh-plugin-sidebar-polish/client.js`,
 * the sidebar column markup and the shipped stylesheets come from `preview/`
 * (extracted verbatim from the DSH bundles), so what this checks is the actual
 * cascade: the plugin must override the official
 * `[data-platform=darwin] .*_sidebarCol` rules — including the shipped
 * `linear-gradient(...)` and its `prefers-reduced-transparency` sibling — and
 * resolve the sidebar column's background to
 *
 *   light: 0.9 × #ffffff (over the macOS sidebar material)
 *   dark:  0.5 × #151517
 *
 * Both themes are measured in one page: the dark pass just flips
 * `data-ds-dark-theme` on <body> after the light pass has been read.
 *
 * Usage: node tools/verify-fill.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const preview = join(root, 'preview');
/** Resolve a path in both layouts: this workspace (`dsh-plugin-x/…`) and the plugin repo. */
const read = (p) =>
  readFileSync(
    [join(root, p), join(root, p.replace(/^dsh-plugin-[^/]+\//, ''))].find((candidate) =>
      existsSync(candidate),
    ) ?? join(root, p),
    'utf8',
  );

/** The plugin's stylesheet, lifted out of the `const CSS = \`…\`` template. */
const PLUGIN_CSS = (() => {
  const src = read('dsh-plugin-sidebar-polish/client.js');
  const start = src.indexOf('const CSS = `') + 'const CSS = `'.length;
  const end = src.indexOf('\n`;', start);
  if (start < 'const CSS = `'.length || end < 0) throw new Error('cannot locate the CSS template in client.js');
  return src.slice(start, end);
})();

const SHIPPED_CSS = ['palette.css', 'layout.css', 'shell.css', 'workspace.css', 'theme.css']
  .map((f) => read(join('preview', f)))
  .join('\n');

/** Same DOM shape the layout renders: the seat anchor is the column's child. */
const COLUMN = `
<div class="_6Qf49G_frame" data-platform="darwin" style="grid-template-columns:280px minmax(0,1fr)">
  <div class="_6Qf49G_sidebarCol"><div data-slot="sidebar" style="display:contents"></div></div>
  <div class="_6Qf49G_centerCol"></div>
</div>`;

const MEASURE = `
<pre id="out"></pre>
<script>
const col = document.querySelector('._6Qf49G_sidebarCol');
const center = document.querySelector('._6Qf49G_centerCol');
const read = (el) => {
  const cs = getComputedStyle(el);
  return {
    background: cs.backgroundColor,
    backgroundImage: cs.backgroundImage,
    fill: cs.getPropertyValue('--dsw-specific-sidebar-fill').trim(),
    alphaLight: cs.getPropertyValue('--dsh-sidebar-alpha-light').trim(),
    alphaDark: cs.getPropertyValue('--dsh-sidebar-alpha-dark').trim(),
  };
};
const result = { light: read(col), centerLight: getComputedStyle(center).backgroundColor };
document.body.setAttribute('data-ds-dark-theme', '');
result.dark = read(col);
result.centerDark = getComputedStyle(center).backgroundColor;
document.getElementById('out').textContent = 'RESULT:' + JSON.stringify(result);
</script>`;

const html = `<!doctype html><html lang="zh" data-platform="darwin"><head><meta charset="utf-8">
<style>${SHIPPED_CSS}</style>
<style id="sidebar-polish">${PLUGIN_CSS}</style>
</head><body>
${COLUMN}
${MEASURE}
</body></html>`;

const tmp = join(tmpdir(), 'dsh-sidebar-fill-verify.html');
writeFileSync(tmp, html);

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].find((p) => existsSync(p));
if (!CHROME) throw new Error('no Chrome/Chromium found to run the verification');

const dom = execFileSync(
  CHROME,
  ['--headless=new', '--disable-gpu', '--no-first-run', '--dump-dom', '--virtual-time-budget=2000', `file://${tmp}`],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
const match = dom.match(/RESULT:(\{.*?\})<\/pre>/s);
if (!match) throw new Error('the measuring page produced no RESULT payload');
const r = JSON.parse(match[1]);

/** `color(srgb 1 1 1 / 0.9)` or `rgba(255, 255, 255, 0.9)` → {rgb, alpha}. */
const parseColor = (value) => {
  let m = value.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/);
  if (m) return { rgb: m.slice(1, 4).map((v) => Math.round(Number(v) * 255)), alpha: m[4] === undefined ? 1 : Number(m[4]) };
  m = value.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { rgb: parts.slice(0, 3), alpha: parts.length > 3 ? parts[3] : 1 };
  }
  return { rgb: null, alpha: null, raw: value };
};

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
/** The light branch keeps the official `97% fill + 3% #7a9bf0` inner blend. */
const lightBase = hex('#ffffff');
const TINT = hex('#7a9bf0');
const blend = (base, tintStops) => base.map((v, i) => v * (1 - tintStops) + TINT[i] * tintStops);
const expect = {
  light: blend(lightBase, 0.03),
  dark: hex('#151517'),
};
/** The conversation column paints `--dsw-alias-bg-base` opaquely. */
const centerExpect = { light: hex('#ffffff'), dark: hex('#151517') };

for (const theme of ['light', 'dark']) {
  const m = parseColor(r[theme].background);
  const rgbOk = m.rgb && m.rgb.every((v, i) => near(v, expect[theme][i]));
  check(`${theme}: 半透明基色 = ${expect[theme].join(',')}`, rgbOk, r[theme].background);
  check(`${theme}: 不透明度 = ${theme === 'light' ? 0.9 : 0.5}`, m.alpha !== null && near(m.alpha, theme === 'light' ? 0.9 : 0.5, 0.001), String(m.alpha));
  check(`${theme}: --dsw-specific-sidebar-fill = ${theme === 'light' ? '#ffffff' : '#151517'}`, r[theme].fill === (theme === 'light' ? '#ffffff' : '#151517'), r[theme].fill);
  check(`${theme}: 官方 linear-gradient 已去掉`, r[theme].backgroundImage === 'none', r[theme].backgroundImage);
  const center = `center${theme[0].toUpperCase()}${theme.slice(1)}`;
  const c = parseColor(r[center]);
  check(
    `${theme}: 对话区底色 = ${centerExpect[theme].join(',')}`,
    c.rgb && c.rgb.every((v, i) => near(v, centerExpect[theme][i])),
    r[center],
  );
}
check('亮色 alpha 旋钮 = 90%', r.light.alphaLight === '90%', r.light.alphaLight);
check('暗色 alpha 旋钮 = 50%', r.light.alphaDark === '50%', r.light.alphaDark);

console.log('\nraw computed values:');
for (const [k, v] of Object.entries(r)) console.log(`  ${k}: ${typeof v === 'string' ? v : v.background}`);
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
