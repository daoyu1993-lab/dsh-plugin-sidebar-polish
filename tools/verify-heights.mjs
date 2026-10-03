/**
 * Verify rule 9 of dsh-plugin-sidebar-polish in a real engine (headless Chrome):
 * every visible sidebar row is exactly 32px, and nothing else moved.
 *
 * Two columns of the same markup are measured in one page: `#before` carries the
 * shipped stylesheets only, `#after` adds the plugin's stylesheet. What is
 * asserted:
 *
 *   before → the official rhythm (panel 36 / header 36 / workspace 34 /
 *            session 32 / overflow 28) proves the control really is unpatched;
 *   after  → all five are 32, i.e. rule 9 covers panel rows, the section-header
 *            row, workspace rows, session rows and the "show more" button;
 *   both   → the horizontal alignment lines are untouched (glyph x = 16,
 *            text x = 40 from the column edge), because the rows only lost
 *            vertical padding;
 *   rail   → the 56px rail's own `36×36` icon squares are NOT shrunk: the
 *            shipped `._x_collapsed ._x_panelRow` rule is more specific than
 *            rule 9, so the collapsed surface keeps its scale.
 *
 * Usage: node tools/verify-heights.mjs
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
  .map((f) => readFileSync(join(preview, f), 'utf8'))
  .join('\n');

const glyph = `<span class="_3WPZCG_panelGlyph" aria-hidden="true"><svg width="16" height="16"></svg></span>`;
const panelRow = (label, wide = true) =>
  `<button class="_3WPZCG_panelRow" aria-label="${label}">${glyph}${wide ? `<span class="_3WPZCG_panelTitle _3WPZCG_wide">${label}</span>` : ''}</button>`;

/** One column: the shell's real markup, trimmed to the rows under test. */
const COLUMN = (id) => `
<div id="${id}" class="_6Qf49G_sidebarCol" style="width:280px">
  <div data-slot="sidebar" style="display:contents">
    <div class="_3WPZCG_root">
      <!-- The topStrip is what rule 2b targets; without it the nav below would be
           the root's first child and get its 88px left padding. -->
      <div class="_3WPZCG_topStrip" data-window-drag><button class="_3WPZCG_iconButton" aria-label="收起侧边栏"></button></div>
      <nav class="_3WPZCG_panelList" aria-label="面板">${panelRow('插件')}${panelRow('自动化任务')}</nav>
      <div class="_3WPZCG_regionArea"><div data-slot="sidebar.workspaces" style="display:contents">
        <div class="_7514NG_root">
          <div class="_7514NG_sectionHeader">
            <span class="_7514NG_sectionLabel _7514NG_wide">工作区</span>
          </div>
          <div class="_7514NG_listArea"><div class="_7514NG_treeBody _7514NG_wide">
            <div class="_7514NG_list" role="tree">
              <div class="_7514NG_groupSection">
                <div class="jJkEga_projectRow" data-row-key="workspace:DSH UI Lab" role="treeitem">
                  <span class="jJkEga_slot">${glyph}</span>
                  <span class="jJkEga_projectText"><span class="jJkEga_title">DSH UI Lab</span></span>
                </div>
                <div class="jJkEga_sessionRow" data-row-key="session:one" role="treeitem">
                  <span class="jJkEga_slot"><div data-slot="sidebar.session.row.leading" style="display:contents"></div></span>
                  <span class="jJkEga_title">无状态的会话</span>
                  <span class="jJkEga_time">1 分钟前</span>
                </div>
                <div class="jJkEga_sessionRow" data-row-key="session:two" role="treeitem">
                  <span class="jJkEga_slot"><div data-slot="sidebar.session.row.leading" style="display:contents"></div></span>
                  <span class="jJkEga_title">另一个无状态的会话</span>
                  <span class="jJkEga_time">昨天</span>
                </div>
                <button class="_7514NG_sessionOverflowButton" data-row-key="overflow:DSH UI Lab" aria-expanded="false">展开其余 4 个会话</button>
              </div>
              <!-- second workspace: the gap between two groupSections is the
                   cross-workspace spacing under test -->
              <div class="_7514NG_groupSection">
                <div class="jJkEga_projectRow" data-row-key="workspace:Pico" role="treeitem">
                  <span class="jJkEga_slot">${glyph}</span>
                  <span class="jJkEga_projectText"><span class="jJkEga_title">Pico</span></span>
                </div>
                <div class="jJkEga_sessionRow" data-row-key="session:three" role="treeitem">
                  <span class="jJkEga_slot"><div data-slot="sidebar.session.row.leading" style="display:contents"></div></span>
                  <span class="jJkEga_title">Pico 里的会话</span>
                  <span class="jJkEga_time">上周</span>
                </div>
              </div>
            </div>
          </div></div>
        </div>
      </div></div>
    </div>
  </div>
</div>`;

/** The collapsed 56px rail, where the shipped stylesheet keeps its own scale. */
const RAIL = `
<div id="rail" class="_6Qf49G_sidebarCol" style="width:56px">
  <div data-slot="sidebar" style="display:contents">
    <div class="_3WPZCG_root _3WPZCG_collapsed" style="padding:18px 10px 6px">
      <div class="_3WPZCG_logoRow">
        <button class="_3WPZCG_iconButton" aria-label="展开侧边栏"></button>
      </div>
      <nav class="_3WPZCG_panelList" aria-label="面板">${panelRow('插件', false)}${panelRow('自动化任务', false)}</nav>
    </div>
  </div>
</div>`;

const MEASURE = `
<pre id="out" hidden></pre>
<script>
const px = (v) => Math.round(v * 100) / 100;
const pick = (root, selector) => root.querySelector(selector);
const box = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { w: px(r.width), h: px(r.height), x: px(r.x) };
};
const measure = (id) => {
  const col = document.getElementById(id);
  const colX = col.getBoundingClientRect().x;
  const q = (s) => box(pick(col, s));
  const glyphX = pick(col, '.jJkEga_sessionRow .jJkEga_slot') ?? pick(col, '.jJkEga_projectRow .jJkEga_slot');
  const titleX = pick(col, '.jJkEga_sessionRow .jJkEga_title') ?? pick(col, '.jJkEga_projectRow .jJkEga_title');
  return {
    panel: q('._3WPZCG_panelRow'),
    header: q('._7514NG_sectionHeader'),
    workspace: q('.jJkEga_projectRow'),
    session: q('.jJkEga_sessionRow'),
    overflow: q('[data-row-key^="overflow:"]'),
    panelGlyphX: pick(col, '._3WPZCG_panelGlyph') ? px(pick(col, '._3WPZCG_panelGlyph').getBoundingClientRect().x - colX) : null,
    panelTitleX: pick(col, '._3WPZCG_panelTitle') ? px(pick(col, '._3WPZCG_panelTitle').getBoundingClientRect().x - colX) : null,
    glyphX: glyphX ? px(glyphX.getBoundingClientRect().x - colX) : null,
    titleX: titleX ? px(titleX.getBoundingClientRect().x - colX) : null,
    sessionPitch: (() => {
      const rows = [...col.querySelectorAll('.jJkEga_sessionRow')].map((el) => el.getBoundingClientRect());
      return rows.length > 1 ? px(rows[1].top - rows[0].top) : null;
    })(),
    // 跨工作区：第二个 groupSection 的上边缘 − 第一个 groupSection 的下边缘
    groupGap: (() => {
      const groups = [...col.querySelectorAll('._7514NG_groupSection')].map((el) => el.getBoundingClientRect());
      return groups.length > 1 ? px(groups[1].top - groups[0].bottom) : null;
    })(),
    // 组内相邻两行（工作区行 → 第一条会话行）的间隙
    rowGap: (() => {
      const group = col.querySelector('._7514NG_groupSection');
      const a = group.querySelector('.jJkEga_projectRow').getBoundingClientRect();
      const b = group.querySelector('.jJkEga_sessionRow').getBoundingClientRect();
      return px(b.top - a.bottom);
    })(),
    // 「更多会话」按钮与它上一行的间隙（官方给了它 margin-top:0）
    overflowGap: (() => {
      const group = col.querySelector('._7514NG_groupSection');
      const rows = [...group.children];
      const btn = group.querySelector('[data-row-key^="overflow:"]');
      const prev = rows[rows.indexOf(btn) - 1].getBoundingClientRect();
      return px(btn.getBoundingClientRect().top - prev.bottom);
    })(),
    // 区段标题行 → 第一个工作区行
    headerGap: (() => {
      const header = col.querySelector('._7514NG_sectionHeader').getBoundingClientRect();
      const first = col.querySelector('.jJkEga_projectRow').getBoundingClientRect();
      return px(first.top - header.bottom);
    })(),
  };
};
document.getElementById('out').textContent = 'RESULT:' + JSON.stringify({
  main: measure('main'),
  rail: {
    panel: box(document.querySelector('#rail ._3WPZCG_panelRow')),
    panelGlyphX: px(document.querySelector('#rail ._3WPZCG_panelGlyph').getBoundingClientRect().x - document.getElementById('rail').getBoundingClientRect().x),
  },
});
</script>`;

const html = (withPlugin) => `<!doctype html><html lang="zh" data-platform="darwin"><head><meta charset="utf-8">
<style>${SHIPPED_CSS}</style>
<style>html,body{margin:0;background:#0b0b0d}</style>
${withPlugin ? `<style id="sidebar-polish">${PLUGIN_CSS}</style>` : '<!-- unpatched control: the plugin stylesheet is absent -->'}
</head><body>
${COLUMN('main')}
${RAIL}
${MEASURE}
</body></html>`;

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].find((p) => existsSync(p));
if (!CHROME) throw new Error('no Chrome/Chromium found to run the verification');

const run = (withPlugin) => {
  const page = join(tmpdir(), `dsh-sidebar-heights-${withPlugin ? 'after' : 'before'}.html`);
  writeFileSync(page, html(withPlugin));
  const dom = execFileSync(
    CHROME,
    ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
     '--window-size=1000,700', '--virtual-time-budget=2000', '--dump-dom', `file://${page}`],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const match = dom.match(/RESULT:(\{.*?\})<\/pre>/s);
  if (!match) throw new Error('the measuring page produced no RESULT payload');
  return JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
};

const before = run(false);
const after = run(true);
const r = { before: before.main, after: after.main, rail: after.rail };

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

/** Official heights, measured in the unpatched column. */
const OFFICIAL = { panel: 36, header: 36, workspace: 34, session: 32, overflow: 28 };
console.log('── 官方（对照组）────────────────────────────────────');
for (const [key, expected] of Object.entries(OFFICIAL)) {
  check(`${key} = ${expected}px`, r.before[key]?.h === expected, `${r.before[key]?.h}px`);
}

console.log(`  （对照组横向：panel glyph ${r.before.panelGlyphX} / title ${r.before.panelTitleX}，session glyph ${r.before.glyphX} / title ${r.before.titleX}）`);

console.log('\n── 本插件：全部 32px ────────────────────────────────');
for (const key of Object.keys(OFFICIAL)) {
  check(`${key} = 32px`, r.after[key]?.h === 32, `${r.after[key]?.h}px`);
}
check('会话行行距 = 32 + 2px 间隙 = 34px', r.after.sessionPitch === 34, `${r.after.sessionPitch}px`);

console.log('\n── 工作区之间 / 组内的间隔 ──────────────────────────');
check('跨工作区：组与组之间 8px（官方 4px，规则 15 拉到 8px）',
  r.after.groupGap === 8, `${r.after.groupGap}px（官方 ${r.before.groupGap}px）`);
check('组内：工作区行 → 第一条会话行 2px（`.groupSection > * + *{margin-top:2px}`）',
  r.after.rowGap === 2, `${r.after.rowGap}px`);
check('组内：「更多会话」按钮也是 2px（官方给它 margin-top:0，本插件拉齐成普通行距）',
  r.after.overflowGap === 2, `${r.after.overflowGap}px（官方 ${r.before.overflowGap}px）`);
check('只有跨组变松：官方本来就是组内 2px / 跨组 4px',
  r.before.groupGap === 4 && r.before.rowGap === 2, `${r.before.groupGap}px / ${r.before.rowGap}px`);
check('区段标题行 → 第一个工作区行仍是 4px（没被一起改）',
  r.after.headerGap === 4, `${r.after.headerGap}px`);
check('跨组间距与行高无关：8px 是 margin，不是行高',
  r.after.workspace.h === 32 && r.after.session.h === 32, `${r.after.workspace.h}px / ${r.after.session.h}px`);

console.log('\n── 横向对齐线没被行高改动带跑 ──────────────────────');
for (const [key, expected] of [['panelGlyphX', 16], ['panelTitleX', 40], ['glyphX', 16], ['titleX', 40]]) {
  check(`${key} = ${expected}px`, r.after[key] === expected, `${r.after[key]}px`);
}
// 行高只动纵向：会话标题在改动前后都落在同一条 40px 文字线上
// （官方 12px pill 内边距 + 20px 槽位 + 4px 标题外边距 = 12+8+16+4；
//   本插件 8px + 8px + 16px + 8px = 40 —— 规则 5/6 互相抵消，规则 9 不参与）。
check('会话标题在改动前也是 40px（行高改动没有横移文字）', r.before.titleX === 40, `${r.before.titleX}px`);
check('对照组的面板行标题仍是官方的 46px', r.before.panelTitleX === 46, `${r.before.panelTitleX}px`);

console.log('\n── 56px 轨道不受影响 ───────────────────────────────');
check('轨道里的面板行仍是 36×36（官方轨道规则特异性更高）', r.rail.panel?.w === 36 && r.rail.panel?.h === 36, `${r.rail.panel?.w}×${r.rail.panel?.h}`);
check('轨道图标仍居中于方形按钮（(36 − 16) / 2 = 10）', r.rail.panelGlyphX - 10 === 10, `glyph x = ${r.rail.panelGlyphX}px`);

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
