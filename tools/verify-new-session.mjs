/**
 * Verify rule 2 (the New Session button drawn as one more panel row) in a real engine.
 *
 * The plugin's browser half is loaded from `dsh-plugin-sidebar-polish/client.js` and the
 * shipped stylesheets come from `preview/`, so this checks the actual cascade — not a
 * hand-computed box model. The markup mirrors the shell's JSX (`SidebarRoot`), including
 * the part rule 2 leans on: **`newSessionLabel` is rendered only while `wide`**, so
 * `:has(> span)` is exactly "the label exists" = "the column is not a rail".
 *
 * The load-bearing assertions are not "the button is 36px" but
 * **"the button's box, glyph, text line and gap are identical to a `.panelRow`'s"** —
 * that is what "same list" means, and it keeps failing loudly if upstream ever changes
 * either one of the two rows.
 *
 * Three states are measured in one page:
 *
 *   darwin  wide      → must equal the panel rows (and drop the shipped elevated card)
 *   darwin  dark      → same, and the shipped #ffffff26 card must be gone
 *   web     collapsed → must stay the shipped 36×36 rail button (centred 18px icon,
 *                       padding 0, 12px below) — the `:has()` guard must not leak
 *
 * Usage: node tools/verify-new-session.mjs
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

/** The real `ShortcutKeys` stylesheet (the ⌘N keycap the button carries while wide). */
const KEYCAP_CSS = read(
  'core/dsh/node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/ShortcutKeys.module.css',
);

const GLYPH = (size) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6.2"/><path d="M8 5.4v5.2M5.4 8h5.2"/></svg>`;

/** `PanelRow` from the shell: glyph slot + title, both 16px/14px while wide. */
const panelRow = (label) => `<button class="_3WPZCG_panelRow" aria-label="${label}">
    <span class="_3WPZCG_panelGlyph" aria-hidden="true">${GLYPH(16)}</span>
    <span class="_3WPZCG_panelTitle _3WPZCG_wide">${label}</span>
  </button>`;

const PANELS = ['插件', 'Skill/MCP', '自动化任务', '乔木 RSS'].map(panelRow).join('\n  ');

/**
 * `newSession` exactly as the shell composes it. While wide the icon is the 14px
 * medium glyph plus the label span; in the rail only the 18px regular glyph is left.
 */
const newSession = (wide) => `<button class="_3WPZCG_newSession" aria-label="新会话">
    <span class="_3WPZCG_newSessionLabelMask"><span class="_3WPZCG_newSessionContent">
      ${GLYPH(wide ? 14 : 18)}${wide ? '<span class="_3WPZCG_newSessionLabel _3WPZCG_wide">新会话</span>' : ''}
    </span></span>
    ${wide ? '<span class="_3WPZCG_newSessionShortcut" aria-hidden="true"><span class="keys"><kbd class="key">⌘</kbd><kbd class="key">N</kbd></span></span>' : ''}
  </button>`;

const FRAMES = `
<div class="_6Qf49G_frame" id="wide" style="width:900px;height:560px;grid-template-columns:280px minmax(0,1fr) 0px">
  <div class="_6Qf49G_sidebarCol">
    <div data-slot="sidebar" style="display:contents">
      <div class="_3WPZCG_root">
        <div class="_3WPZCG_topStrip" data-window-drag>
          <button class="_3WPZCG_iconButton _3WPZCG_toggle" aria-label="toggle"></button>
        </div>
        <div class="_3WPZCG_logoRow" data-window-drag></div>
        ${newSession(true)}
        <nav class="_3WPZCG_panelList" aria-label="面板">
          ${PANELS}
        </nav>
      </div>
    </div>
  </div>
  <div class="_6Qf49G_centerCol"></div>
</div>

<div class="_6Qf49G_frame" id="rail" data-sidebar-collapsed style="width:900px;height:560px;grid-template-columns:56px minmax(0,1fr) 0px">
  <div class="_6Qf49G_sidebarCol">
    <div data-slot="sidebar" style="display:contents">
      <div class="_3WPZCG_root _3WPZCG_collapsed">
        <div class="_3WPZCG_logoRow" data-window-drag>
          <button class="_3WPZCG_iconButton _3WPZCG_toggle" aria-label="expand"></button>
        </div>
        ${newSession(false)}
        <nav class="_3WPZCG_panelList" aria-label="面板">
          ${PANELS}
        </nav>
      </div>
    </div>
  </div>
  <div class="_6Qf49G_centerCol"></div>
</div>`;

const MEASURE = `
<pre id="out"></pre>
<script>
const html = document.documentElement;
const body = document.body;
const rel = (el, host) => {
  const r = el.getBoundingClientRect();
  const h = host.getBoundingClientRect();
  return { x: +((r.left - h.left).toFixed(2)), y: +((r.top - h.top).toFixed(2)),
           w: +r.width.toFixed(2), h: +r.height.toFixed(2), right: +(r.right).toFixed(2), bottom: +(r.bottom).toFixed(2) };
};
const box = (el) => { const r = el.getBoundingClientRect();
  return { x: +r.left.toFixed(2), y: +r.top.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2),
           right: +r.right.toFixed(2), bottom: +r.bottom.toFixed(2) }; };

const measure = (frameId) => {
  const frame = document.getElementById(frameId);
  const col = frame.querySelector('._6Qf49G_sidebarCol');
  const btn = frame.querySelector('._3WPZCG_newSession');
  const row = frame.querySelector('._3WPZCG_panelRow');
  const btnSvgs = btn.querySelectorAll('svg');
  const glyph = btnSvgs[btnSvgs.length - 1];          // the visible glyph
  const label = btn.querySelector('._3WPZCG_newSessionLabel');
  const rowGlyph = row.querySelector('._3WPZCG_panelGlyph');
  const rowGlyphSvg = rowGlyph.querySelector('svg');
  const rowTitle = row.querySelector('._3WPZCG_panelTitle');
  const cs = getComputedStyle(btn);
  const rs = getComputedStyle(row);
  const content = btn.querySelector('._3WPZCG_newSessionContent');
  return {
    colW: +col.getBoundingClientRect().width.toFixed(2),
    btn: rel(btn, col), row: rel(row, col),
    insets: { btn: { left: +(btn.getBoundingClientRect().left - col.getBoundingClientRect().left).toFixed(2),
                     right: +(col.getBoundingClientRect().right - btn.getBoundingClientRect().right).toFixed(2) },
              row: { left: +(row.getBoundingClientRect().left - col.getBoundingClientRect().left).toFixed(2),
                     right: +(col.getBoundingClientRect().right - row.getBoundingClientRect().right).toFixed(2) } },
    gapBelow: +(row.getBoundingClientRect().top - btn.getBoundingClientRect().bottom).toFixed(2),
    glyph: rel(glyph, col), rowGlyph: rel(rowGlyphSvg, col),
    label: label ? rel(label, col) : null, rowTitle: rel(rowTitle, col),
    content: { justify: getComputedStyle(content).justifyContent, width: getComputedStyle(content).width,
               gap: getComputedStyle(content).gap },
    glyphCenterX: +(((glyph.getBoundingClientRect().left + glyph.getBoundingClientRect().right) / 2
                    - (btn.getBoundingClientRect().left + btn.getBoundingClientRect().right) / 2)).toFixed(2),
    btnCenterX: 0,
    style: { height: cs.height, minHeight: cs.minHeight, padding: cs.padding, margin: cs.margin,
             borderWidth: cs.borderTopWidth, borderStyle: cs.borderTopStyle, borderRadius: cs.borderTopLeftRadius,
             background: cs.backgroundColor, fontWeight: cs.fontWeight, color: cs.color },
    rowStyle: { height: rs.height, padding: rs.padding, margin: rs.margin, borderWidth: rs.borderTopWidth,
                borderRadius: rs.borderTopLeftRadius, background: rs.backgroundColor, fontWeight: rs.fontWeight },
    labelFont: label ? getComputedStyle(label).fontSize : null,
    rowTitleFont: getComputedStyle(rowTitle).fontSize,
  };
};

const trim = document.getElementById('sidebar-polish');
const trimHost = trim.parentNode;
const result = {};
result.wide = measure('wide');
body.setAttribute('data-ds-dark-theme', '');
result.dark = measure('wide');
/* with the plugin's stylesheet taken out, the same dark button = the shipped card */
trim.remove();
result.shippedDark = measure('wide');
trimHost.appendChild(trim);
body.removeAttribute('data-ds-dark-theme');
html.removeAttribute('data-platform');
result.rail = measure('rail');

document.getElementById('out').textContent = 'RESULT:' + JSON.stringify(result);
</script>`;

const html = `<!doctype html><html lang="zh" data-platform="darwin"><head><meta charset="utf-8">
<style>${SHIPPED_CSS}</style>
<style>${KEYCAP_CSS}</style>
<style id="sidebar-polish">${PLUGIN_CSS}</style>
<style>body { margin: 0 }</style>
</head><body>
${FRAMES}
${MEASURE}
</body></html>`;

const tmp = join(tmpdir(), 'dsh-sidebar-new-session-verify.html');
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
const box = (b) => `x=${b.x} ${b.w}×${b.h}`;

// ---- wide: the New Session button IS a panel row -------------------------

// ---- wide, dark: the shipped elevated card must be gone ------------------
const { wide, dark, shippedDark, rail } = r;
// 行高由规则 9 统一：侧栏所有行都是 32px（本规则只负责「长什么样」）。
check('展开态：按钮高 32px（= 面板行，规则 9 统一）', near(wide.btn.h, 32) && near(wide.row.h, 32), `按钮 ${wide.btn.h} / 面板行 ${wide.row.h}`);
check('展开态：按钮 min-height 32px（与 .panelRow 同）', wide.style.minHeight === '32px', wide.style.minHeight);
check('展开态：左右外边距 = 面板行（都在 8px pill 线上）',
  near(wide.insets.btn.left, wide.insets.row.left) && near(wide.insets.btn.right, wide.insets.row.right) &&
  near(wide.insets.btn.left, 8),
  `按钮 ${wide.insets.btn.left}/${wide.insets.btn.right} vs 面板行 ${wide.insets.row.left}/${wide.insets.row.right}`);
check('展开态：下外边距 = 面板行间距 4px（读起来是同一份列表）',
  near(wide.gapBelow, 4), `${wide.gapBelow}px`);
check('展开态：图标 16px 且落在 16px 垂线（= 面板行图标）',
  near(wide.glyph.w, 16) && near(wide.glyph.x, wide.rowGlyph.x) && near(wide.glyph.x, 16),
  `按钮图标 x=${wide.glyph.x} w=${wide.glyph.w} vs 面板行 x=${wide.rowGlyph.x} w=${wide.rowGlyph.w}`);
check('展开态：文字落在 40px 垂线（= 面板行标题）',
  near(wide.label.x, wide.rowTitle.x) && near(wide.label.x, 40),
  `按钮文字 x=${wide.label.x} vs 面板行 x=${wide.rowTitle.x}`);
check('展开态：内容左对齐、图标→文字 8px（官方是居中 + 6px）',
  wide.content.justify === 'flex-start' && wide.content.gap === '8px',
  `justify=${wide.content.justify} gap=${wide.content.gap}`);
check('展开态：官方卡片的描边没了', wide.style.borderWidth === '0px' && wide.style.borderStyle === 'none',
  `${wide.style.borderWidth} ${wide.style.borderStyle}`);
check('展开态：圆角与面板行相同（--dsw-radius-md = 12px）',
  wide.style.borderRadius === wide.rowStyle.borderRadius, `${wide.style.borderRadius} vs ${wide.rowStyle.borderRadius}`);
check('展开态：字号/重量与面板行一致（14px / 400，官方按钮是 500）',
  wide.labelFont === wide.rowTitleFont && wide.style.fontWeight === wide.rowStyle.fontWeight,
  `${wide.labelFont}·${wide.style.fontWeight} vs ${wide.rowTitleFont}·${wide.rowStyle.fontWeight}`);

// ---- wide, dark: the shipped elevated card must be gone ------------------
check('官方暗色确实给过 elevated 卡片底（对照：摘掉本插件后的同一个按钮）',
  shippedDark.style.background !== 'rgba(0, 0, 0, 0)', `官方 ${shippedDark.style.background}`);
check('暗色展开态：底色已是透明的（!important 压过官方的 darwin/暗色卡片底）',
  dark.style.background === 'rgba(0, 0, 0, 0)', `本插件 ${dark.style.background}`);

// ---- rail: untouched -----------------------------------------------------
check('收起轨道：按钮仍是 36×36 图标按钮（未被行样式改写）',
  near(rail.btn.w, 36) && near(rail.btn.h, 36), box(rail.btn));
check('收起轨道：内边距 0、下外边距 12px（官方值）',
  rail.style.padding === '0px' && rail.style.margin === '0px 0px 12px', `${rail.style.padding} / ${rail.style.margin}`);
check('收起轨道：图标仍是官方的 18px（:has(> span) 守卫生效）',
  near(rail.glyph.w, 18), `w=${rail.glyph.w}`);
check('收起轨道：图标仍在按钮正中（内容对齐规则没漏进来）',
  near(rail.glyphCenterX, 0), `偏移 ${rail.glyphCenterX}px`);

console.log('\nraw measured boxes:');
for (const [state, m] of Object.entries(r)) {
  console.log(`  ${state}: col=${m.colW} button ${box(m.btn)} insets ${m.insets.btn.left}/${m.insets.btn.right}` +
    ` | row ${box(m.row)} insets ${m.insets.row.left}/${m.insets.row.right} | gapBelow=${m.gapBelow}` +
    ` | glyph ${m.glyph.x}..${m.glyph.x + m.glyph.w} label ${m.label ? m.label.x : '-'} | bg=${m.style.background}`);
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
