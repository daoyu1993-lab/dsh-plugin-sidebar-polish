/**
 * Verify rule 2b (pin the collapse toggle beside the traffic lights) in a real engine.
 *
 * The plugin's browser half is loaded from `dsh-plugin-sidebar-polish/client.js` and the
 * shipped stylesheets come from `preview/`, so what this checks is the actual cascade —
 * not a hand-computed box model.
 *
 * The rule exists because the shipped shell has **two hosts for the same button**:
 *
 *   expanded  the sidebar's own `topStrip`, `justify-content: flex-end`  → far right
 *   collapsed `HeaderLeadingControls` in the frame's `shell.leading` seat,
 *             `.leadingSeat{top:11px;left:88px}`                          → beside the lights
 *
 * A collapsed macOS sidebar is 0px wide (`collapsedWidth = darwin ? 0 : 56`), so the
 * seat is what the user sees when collapsed. The plugin turns the expanded strip around
 * so both hosts put the button on the same box.
 *
 * So the load-bearing assertion is not "the strip is 88px" but **"expanded and collapsed
 * land on the same box"** — that stays true (and the test keeps passing) even if upstream
 * moves `.leadingSeat`, and it fails loudly if the two ever drift apart again.
 *
 * Four states are measured in one page by flipping `<html>` attributes between passes,
 * exactly like `verify-fill.mjs` flips the theme:
 *
 *   darwin                 → both hosts must agree
 *   darwin + fullscreen    → plugin must NOT apply (no traffic lights; overlay moves to 12px)
 *   web (no data-platform) → plugin must NOT apply (there is no topStrip at all)
 *
 * Usage: node tools/verify-toggle.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
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

/**
 * The sidebar root's first child is `topStrip` **only** when `darwinDesktop` is true, and
 * `isDarwinDesktop()` is literally `documentElement.dataset.platform === 'darwin'`, so the
 * two frames below cover the whole cross-product that matters.
 */
const FRAMES = `
<div class="_6Qf49G_frame" id="expanded" style="width:1200px;height:120px;grid-template-columns:280px minmax(0,1fr) minmax(0px,0px)">
  <div class="_6Qf49G_sidebarCol">
    <div data-slot="sidebar" style="display:contents">
      <div class="_3WPZCG_root">
        <div class="_3WPZCG_topStrip" data-window-drag>
          <button class="_3WPZCG_iconButton _3WPZCG_toggle" aria-label="toggle"></button>
        </div>
        <div class="_3WPZCG_logoRow" data-window-drag></div>
        <button class="_3WPZCG_newSession" aria-label="new"></button>
      </div>
    </div>
  </div>
  <div class="_6Qf49G_centerCol"></div>
</div>

<div class="_6Qf49G_frame" id="collapsed" data-sidebar-collapsed style="width:1200px;height:120px;grid-template-columns:0px minmax(0,1fr) minmax(0px,0px)">
  <div class="_6Qf49G_sidebarCol"></div>
  <div class="_6Qf49G_centerCol"></div>
  <div class="_6Qf49G_leadingSeat"><div class="DL-xwG_controls">
    <button class="DL-xwG_iconButton" aria-label="open"></button>
    <button class="DL-xwG_iconButton" aria-label="new"></button>
  </div></div>
</div>`;

const MEASURE = `
<pre id="out"></pre>
<script>
const html = document.documentElement;
const frameExpanded = document.getElementById('expanded');
const frameCollapsed = document.getElementById('collapsed');
const strip = frameExpanded.querySelector('[data-window-drag]');
const logoRow = frameExpanded.querySelectorAll('[data-window-drag]')[1];
const toggle = frameExpanded.querySelector('button[aria-label=toggle]');
const seatToggle = frameCollapsed.querySelector('button[aria-label=open]');

/* Box of \`el\` measured from its frame's content origin — the same origin \`.leadingSeat\` uses. */
const rel = (el, frame) => {
  const r = el.getBoundingClientRect();
  const f = frame.getBoundingClientRect();
  return { x: r.left - f.left, y: r.top - f.top, w: r.width, h: r.height };
};
const stripStyle = () => {
  const cs = getComputedStyle(strip);
  return { paddingLeft: cs.paddingLeft, justifyContent: cs.justifyContent, stripBox: rel(strip, frameExpanded) };
};

const result = {};

result.darwin = { strip: stripStyle(), toggle: rel(toggle, frameExpanded), seat: rel(seatToggle, frameCollapsed), logoRowPaddingLeft: getComputedStyle(logoRow).paddingLeft };

html.setAttribute('data-fullscreen', 'true');
result.fullscreen = { strip: stripStyle(), toggle: rel(toggle, frameExpanded), seat: rel(seatToggle, frameCollapsed) };
html.removeAttribute('data-fullscreen');

html.removeAttribute('data-platform');
result.web = { strip: stripStyle(), toggle: rel(toggle, frameExpanded) };

document.getElementById('out').textContent = 'RESULT:' + JSON.stringify(result);
</script>`;

const html = `<!doctype html><html lang="zh" data-platform="darwin"><head><meta charset="utf-8">
<style>${SHIPPED_CSS}</style>
<style id="sidebar-polish">${PLUGIN_CSS}</style>
<style>body { margin: 0 }</style>
</head><body>
${FRAMES}
${MEASURE}
</body></html>`;

const tmp = join(tmpdir(), 'dsh-sidebar-toggle-verify.html');
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

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};
const near = (a, b, tol = 0.51) => Math.abs(a - b) <= tol;
const box = (b) => `x=${b.x.toFixed(2)} y=${b.y.toFixed(2)} ${b.w.toFixed(0)}×${b.h.toFixed(0)}`;

// ---- darwin: the two hosts must agree ------------------------------------
const { darwin, fullscreen, web } = r;
check('展开态 topStrip 主轴 = flex-start（不再被推到最右）', darwin.strip.justifyContent === 'flex-start', darwin.strip.justifyContent);
check('展开态 topStrip 左内边距 = 88px 旋钮', darwin.strip.paddingLeft === '88px', darwin.strip.paddingLeft);
check(
  '展开态按钮落点 = 折叠态按钮落点（x 相同）',
  near(darwin.toggle.x, darwin.seat.x),
  `展开 ${darwin.toggle.x.toFixed(2)} vs 折叠 ${darwin.seat.x.toFixed(2)}`,
);
check(
  '展开态按钮落点 = 折叠态按钮落点（y 相同）',
  near(darwin.toggle.y, darwin.seat.y),
  `展开 ${darwin.toggle.y.toFixed(2)} vs 折叠 ${darwin.seat.y.toFixed(2)}`,
);
check(
  '两态按钮尺寸都是 28×28',
  near(darwin.toggle.w, 28) && near(darwin.toggle.h, 28) && near(darwin.seat.w, 28) && near(darwin.seat.h, 28),
  `${darwin.toggle.w.toFixed(0)}×${darwin.toggle.h.toFixed(0)} / ${darwin.seat.w.toFixed(0)}×${darwin.seat.h.toFixed(0)}`,
);
check('落点就是 88..116 / 11..39（红绿灯右侧那一格）', near(darwin.toggle.x, 88) && near(darwin.toggle.y, 11), box(darwin.toggle));
check('规则没碰到品牌行（logoRow 左内边距仍是官方的 4px）', darwin.logoRowPaddingLeft === '4px', darwin.logoRowPaddingLeft);

// ---- fullscreen: no traffic lights, official layout already agrees --------
check('全屏：本规则不生效（左内边距回到官方 12px）', fullscreen.strip.paddingLeft === '12px', fullscreen.strip.paddingLeft);
check('全屏：主轴仍是官方的 flex-start', fullscreen.strip.justifyContent === 'flex-start', fullscreen.strip.justifyContent);
check(
  '全屏：展开态与浮层本来就重合（都是 12px）',
  near(fullscreen.toggle.x, 12) && near(fullscreen.toggle.x, fullscreen.seat.x),
  `展开 ${fullscreen.toggle.x.toFixed(2)} vs 浮层 ${fullscreen.seat.x.toFixed(2)}`,
);

// ---- web: no data-platform, no topStrip ----------------------------------
check('Web：本规则不生效（左内边距 12px）', web.strip.paddingLeft === '12px', web.strip.paddingLeft);
check('Web：主轴仍是官方的 flex-end', web.strip.justifyContent === 'flex-end', web.strip.justifyContent);
check('Web：按钮没被钉到 88px', web.toggle.x > 200, box(web.toggle));
check(
  'Web：按钮仍按官方贴在最右（右边缘 = strip 右边缘 − 12px 内边距）',
  near(web.toggle.x + web.toggle.w + 12, web.strip.stripBox.x + web.strip.stripBox.w),
  `按钮右缘 ${(web.toggle.x + web.toggle.w).toFixed(2)} vs 预期 ${(web.strip.stripBox.x + web.strip.stripBox.w - 12).toFixed(2)}`,
);

console.log('\nraw measured boxes:');
for (const [state, m] of Object.entries(r)) {
  console.log(`  ${state}: strip padding-left=${m.strip.paddingLeft} justify=${m.strip.justifyContent} toggle ${box(m.toggle)}${m.seat ? ` seat ${box(m.seat)}` : ''}`);
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
