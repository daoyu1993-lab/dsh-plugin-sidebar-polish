/**
 * Verify rule 14 (the settings entry) in a real engine.
 *
 * The plugin's browser half is loaded from `dsh-plugin-sidebar-polish/client.js`, the shipped
 * stylesheets come from `preview/`, and the settings row's own styles are read out of the
 * shipped `app.asar` (`tools/asar-reader.cjs`) — so the cascade under test is the real one.
 *
 * Rule 14 is the one piece of this plugin that is a real component rather than a stylesheet:
 * a `<button class="dsh-settings-entry">` registered into the shell's `sidebar.footer.action`
 * seat. The load-bearing assertions are therefore about **two separate hit areas**:
 *
 *   - the button is a 28×28 box whose icon centre sits on the "new workspace" icon's line
 *     (column width − 22px), with the same radius and hover fill;
 *   - the account row next to it **stops before** the button (no overlap), so clicking the
 *     gear cannot open the account menu;
 *   - in the 56px rail nothing is drawn and the foot area is back to the shipped column.
 *
 * Usage: node tools/verify-settings-entry.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
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

const PLUGIN_SOURCE = read('dsh-plugin-sidebar-polish/client.js');

const SHIPPED_CSS = ['palette.css', 'layout.css', 'shell.css', 'workspace.css', 'theme.css']
  .map((f) => read(join('preview', f)))
  .join('\n');

/**
 * Every `const css$N = "…"` module stylesheet of the two packages that own the settings row
 * (`ui-settings-general` renders the row, `ui-settings-account` occupies its launcher seat
 * with the avatar + name). Read straight from the shipped archive.
 */
const SETTINGS_CSS = (() => {
  const { readArchive, listFiles, DEFAULT_ARCHIVE } = require('../tools/asar-reader.cjs');
  const fs = require('node:fs');
  const archive = readArchive(DEFAULT_ARCHIVE);
  const files = listFiles(archive.header);
  const wanted = [
    '/dsh/node_modules/@deepseek-ai/dsh-client-ui-settings-general/lib/client.js',
    '/dsh/node_modules/@deepseek-ai/dsh-client-ui-settings-account/lib/client.js',
  ];
  const out = [];
  for (const path of wanted) {
    const entry = files.find((f) => f.path === path);
    if (!entry) throw new Error(`missing ${path} in ${DEFAULT_ARCHIVE}`);
    const buf = Buffer.alloc(entry.size);
    fs.readSync(archive.fd, buf, 0, entry.size, archive.dataOffset + entry.offset);
    const source = buf.toString('utf8');
    const rules = [...source.matchAll(/const css\$\w+ = "((?:[^"\\]|\\.)*)"/g)];
    if (rules.length === 0) throw new Error(`no module CSS found in ${path}`);
    for (const [, css] of rules) out.push(JSON.parse(`"${css}"`));
  }
  return out.join('\n');
})();

const GLYPH = (d) => `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">${d}</svg>`;
const SLIDERS = GLYPH('<path d="M2.5 5h11M2.5 11h11"/><circle cx="6" cy="5" r="1.7"/><circle cx="10.5" cy="11" r="1.7"/>');
const PROJECT_ADD = GLYPH('<path d="M2.6 4.4c0-.7.5-1.2 1.2-1.2h2.6l1.3 1.5h4.5c.7 0 1.2.5 1.2 1.2v5.7c0 .7-.5 1.2-1.2 1.2H3.8c-.7 0-1.2-.5-1.2-1.2V4.4Z"/><path d="M8 7.3v3.4M6.3 9h3.4"/>');

/**
 * One sidebar column. The foot area is the shipped pair — `footerActions` (where rule 14's
 * button lands, rendered by the shell's `sidebar.footer.action` list seat) above
 * `settingsArea` — and rule 14 is what turns those two rows into one row of two columns.
 */
const column = ({ id, collapsed }) => `
<div class="_6Qf49G_frame" id="${id}"${collapsed ? ' data-sidebar-collapsed' : ''}
     style="width:900px;height:560px;grid-template-columns:${collapsed ? 56 : 280}px minmax(0,1fr) 0px">
  <div class="_6Qf49G_sidebarCol">
    <div data-slot="sidebar" style="display:contents">
      <div class="_3WPZCG_root${collapsed ? ' _3WPZCG_collapsed' : ''}">
        ${collapsed ? '' : `
        <div class="_3WPZCG_regionArea"><div data-slot="sidebar.workspaces" style="display:contents">
          <div class="_7514NG_root">
            <div class="_7514NG_sectionHeader">
              <span class="_7514NG_sectionLabel _7514NG_wide">工作区</span>
              <div class="_7514NG_searchSlot"><div class="_7514NG_search">
                <button class="_7514NG_searchButton" aria-label="搜索会话">${GLYPH('<circle cx="7" cy="7" r="4.4"/><path d="m10.4 10.4 3 3"/>')}</button>
              </div></div>
              <div class="_7514NG_headerActions">
                <button class="_7514NG_iconButton" aria-label="视图选项">${SLIDERS}</button>
                <button class="_7514NG_iconButton" aria-label="新建工作区">${PROJECT_ADD}</button>
              </div>
            </div>
          </div>
        </div></div>`}
        <div class="_3WPZCG_footArea">
          <div class="_3WPZCG_footerActions">
            <div data-slot="sidebar.footer.action" style="display:contents">
              <button type="button" class="dsh-settings-entry" aria-label="设置"></button>
            </div>
          </div>
          <div class="_3WPZCG_settingsArea">
            <div data-slot="sidebar.settings" style="display:contents">
              <div class="Dws9Sa_triggerRow">
                <div data-slot="settings.launcher" style="display:contents">
                  <div class="ZogL4G_root">
                    <span class="ZogL4G_anchor">
                      <button type="button" class="ZogL4G_trigger" aria-label="账号菜单" aria-haspopup="menu"
                              aria-expanded="false"${collapsed ? ' data-collapsed="true" data-signed-out="false"' : ''}>
                        <span class="ZogL4G_avatar">${GLYPH('<circle cx="8" cy="6" r="2.6"/><path d="M3.4 13c.6-2.4 2.4-3.6 4.6-3.6s4 1.2 4.6 3.6"/>')}</span>
                        <span class="ZogL4G_label">王道裕</span>
                      </button>
                    </span>
                  </div>
                </div>
                <!-- ConnectionIndicator renders nothing while connected (state === undefined),
                     so the row has a single child and the trigger fills it. -->
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="_6Qf49G_centerCol"></div>
</div>`;

const MEASURE = `
<pre id="out"></pre>
<script>
const rel = (el, host) => {
  const r = el.getBoundingClientRect(), h = host.getBoundingClientRect();
  return { x: +(r.left - h.left).toFixed(2), right: +(r.right - h.left).toFixed(2),
           w: +r.width.toFixed(2), h: +r.height.toFixed(2),
           cx: +((r.left + r.right) / 2 - h.left).toFixed(2),
           cy: +((r.top + r.bottom) / 2 - h.top).toFixed(2) };
};
const measure = (frameId) => {
  const frame = document.getElementById(frameId);
  const col = frame.querySelector('._6Qf49G_sidebarCol');
  const button = frame.querySelector('.dsh-settings-entry');
  const plus = frame.querySelector('button[aria-label="新建工作区"]');
  const trigger = frame.querySelector('[data-slot="sidebar.settings"] button[aria-haspopup]');
  const foot = frame.querySelector('._3WPZCG_footArea');
  const cs = getComputedStyle(button);
  const after = getComputedStyle(button, '::after');
  const plusCs = plus ? getComputedStyle(plus) : null;
  return {
    colW: +col.getBoundingClientRect().width.toFixed(2),
    button: rel(button, col),
    plus: plus ? rel(plus, col) : null,
    trigger: rel(trigger, col),
    foot: { display: getComputedStyle(foot).display, columns: getComputedStyle(foot).gridTemplateColumns,
            gap: getComputedStyle(foot).columnGap },
    style: { display: cs.display, width: cs.width, height: cs.height, borderRadius: cs.borderRadius,
             background: cs.backgroundColor, color: cs.color, cursor: cs.cursor, border: cs.borderTopWidth },
    plusStyle: plusCs ? { borderRadius: plusCs.borderRadius } : null,
    after: { content: after.content, width: after.width, height: after.height, inset: after.inset,
             background: after.backgroundColor, mask: (after.maskImage || '').slice(0, 24) },
  };
};
const result = {};
result.wide = measure('wide');
result.rail = measure('rail');
/* the button's own hit area vs the row: they must not overlap (separate hot zones) */
result.wide.gapToRow = +(result.wide.button.x - result.wide.trigger.right).toFixed(2);
document.getElementById('out').textContent = 'RESULT:' + JSON.stringify(result);
</script>`;

const html = `<!doctype html><html lang="zh" data-platform="darwin"><head><meta charset="utf-8">
<style>${SHIPPED_CSS}</style>
<style>${SETTINGS_CSS}</style>
<style id="sidebar-polish">${PLUGIN_CSS}</style>
<style>
body { margin: 0 }
/* ui-workspace computes the list's edge inset in JS and writes it inline; the shipped
   value is 12px, so the CSS default (var(--dsh-sidebar-inline-padding), which this
   plugin shrinks to 8px) is not what the app actually renders. Verified against a real
   window: the "new workspace" glyph sits 8px from the column's right edge. */
._7514NG_root { --dsh-session-list-edge-inset: 12px }
</style>
</head><body>
${column({ id: 'wide', collapsed: false })}
${column({ id: 'rail', collapsed: true })}
${MEASURE}
</body></html>`;

const tmp = join(tmpdir(), 'dsh-sidebar-settings-entry-verify.html');
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
const { wide, rail } = r;

// ---- the component is registered, not drawn -----------------------------------
check('设置入口是 sidebar.footer.action 里的真实 <button>（不是伪元素）',
  /slots\.inject\('sidebar\.footer\.action'/.test(PLUGIN_SOURCE) &&
    /className: 'dsh-settings-entry'/.test(PLUGIN_SOURCE) &&
    /createElement\('button'/.test(PLUGIN_SOURCE));
check('点击跑官方 settings.open 命令（直接开设置面板，不弹账号菜单）',
  /ctx\.shortcuts\?\.registry/.test(PLUGIN_SOURCE) &&
    /registry\.invoke\('settings\.open', \{ modal: null, region: 'page' \}\)/.test(PLUGIN_SOURCE));

// ---- geometry: same size and same line as the "new workspace" button ---------
check('按钮 28×28、无边框、圆角与「新建工作区」按钮相同',
  near(wide.button.w, 28) && near(wide.button.h, 28) && wide.style.border === '0px' &&
    wide.style.borderRadius === wide.plusStyle?.borderRadius,
  `${wide.button.w}×${wide.button.h} radius=${wide.style.borderRadius} vs + ${wide.plusStyle?.borderRadius}`);
check('图标中心 = 新建工作区按钮图标中心（列宽 − 22px，同一条垂线）',
  wide.plus !== null && near(wide.button.cx, wide.plus.cx) && near(wide.button.cx, wide.colW - 22),
  `入口 ${wide.button.cx} vs + ${wide.plus.cx} vs 列宽−22 ${wide.colW - 22}`);
check('按钮右缘 = 列宽 − 8px（与 + 按钮同一条内缩线）',
  near(wide.button.right, wide.colW - 8),
  `入口 ${wide.button.right} vs 列宽−8 ${wide.colW - 8}`);
check('齿轮是 ::after 里 16px 的遮罩（官方 IconSettingsOutlineMedium 的 path）',
  wide.after.content !== 'none' && near(parseFloat(wide.after.width), 16) &&
    near(parseFloat(wide.after.height), 16) && wide.after.mask.startsWith('url("data:image/svg+xml'),
  `${wide.after.width}×${wide.after.height} inset=${wide.after.inset}`);

// ---- two separate hot zones ---------------------------------------------------
check('齿轮与账号行不重叠（各自独立的热区）', wide.gapToRow > 0,
  `入口左缘 ${wide.button.x} vs 账号行右缘 ${wide.trigger.right}（间隙 ${wide.gapToRow}px）`);
check('齿轮与账号行垂直同心（同一行的中线上）', near(wide.button.cy, wide.trigger.cy),
  `入口 cy=${wide.button.cy} vs 账号行 cy=${wide.trigger.cy}`);
const footCols = wide.foot.columns.split(' ').map((v) => parseFloat(v));
check('脚区排成一行两列（grid：设置行占第 1 列，footerActions 第 2 列 = 28px 按钮宽）',
  wide.foot.display === 'grid' && footCols.length === 2 && near(footCols[1], 28) && near(parseFloat(wide.foot.gap), 4),
  `display=${wide.foot.display} columns=${wide.foot.columns} gap=${wide.foot.gap}`);

// ---- rail ---------------------------------------------------------------------
check('收起轨道：入口不显示', rail.style.display === 'none', rail.style.display);
check('收起轨道：脚区复位成官方的竖排（flex）', rail.foot.display === 'flex', rail.foot.display);

console.log('\nraw measured boxes (relative to the sidebar column):');
console.log(`  wide: col=${wide.colW} 入口 ${JSON.stringify(wide.button)} | + 按钮 ${JSON.stringify(wide.plus)}`);
console.log(`        账号行 ${JSON.stringify(wide.trigger)} | 热区间隙 ${wide.gapToRow}px | foot ${JSON.stringify(wide.foot)}`);
console.log(`        ::after ${wide.after.width}×${wide.after.height} inset=${wide.after.inset} mask=${wide.after.mask}…`);
console.log(`  rail: col=${rail.colW} 入口 display=${rail.style.display} foot display=${rail.foot.display}`);
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
