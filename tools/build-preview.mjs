/**
 * Build the before/after preview pages for dsh-plugin-sidebar-polish.
 *
 * The stylesheets under preview/ are extracted verbatim from the shipped DSH
 * bundles (real class-name hashes, real geometry, real token palette), and the
 * markup mirrors the DOM the shell actually renders, so the "before" panel is a
 * faithful render of today's sidebar. The session rows are hand-written sample
 * content — the shell, its geometry and its colours are not.
 *
 * Run: node tools/build-preview.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const preview = join(root, 'preview');
const read = (name) => readFileSync(join(preview, name), 'utf8');

const css = [
  read('palette.css'),
  read('layout.css'),
  read('shell.css'),
  read('workspace.css'),
  read('theme.css'),
].join('\n');

/**
 * The official `StateDot` stylesheet, verbatim from
 * `@deepseek-ai/dsh-client-ui-primitives`. Included so the preview's status dots
 * are the real 10px box / `::after{inset:20%}` 6px core (class hashes do not
 * matter here because markup and stylesheet are taken from the same source).
 *
 * `ShortcutKeys.module.css` comes from the same package and is included for the
 * same reason: the New Session button carries the ⌘N keycap, and its type/colour
 * (`12px`, `label-tertiary`) is what the redrawn row has to coexist with.
 */
const primitiveCss = [
  readFileSync(join(root, 'core/dsh/node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/StateDot.module.css'), 'utf8'),
  readFileSync(join(root, 'core/dsh/node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/ShortcutKeys.module.css'), 'utf8'),
].join('\n');


/**
 * The exact rule set the plugin installs, scoped under `.after` so one page can
 * show the patched and unpatched shells side by side.
 */
const PATCH = `
.after [data-slot="sidebar"] > div > div[data-window-drag]:has([data-slot="sidebar.brand.name"]) { display: none !important; }
/* 规则 2 的对照组：上一版的预览面板仍按上一版处理（新会话按钮被隐藏） */
.after.oldrow [data-slot="sidebar"] > div > button { display: none !important; }
/* 规则 2 的预览变体：新会话按钮保留，但与 nav 里的面板行同款（32px 胶囊 / 16px 图标 /
   padding 5px 8px / 左右外边距 0 / 下外边距 4px = 面板行间距 / 无描边无底色）。
   注意：真实插件是把它整行隐藏（规则 2），这里保留只为让预览能展示「行高统一」的完整一行。 */
.after:not(.oldrow) [data-slot="sidebar"] > div > button { height: 32px; min-height: 32px; margin: 0 0 4px;
  padding: 5px 8px; border: none; border-radius: var(--dsw-radius-md);
  background: transparent !important; color: var(--dsw-alias-label-primary); font-weight: 400; }
.after:not(.oldrow) [data-slot="sidebar"] > div > button:hover { background: var(--dsw-alias-interactive-bg-hover) !important; }
.after:not(.oldrow) [data-slot="sidebar"] > div > button:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -2px; }
/* 内容左对齐 + 图标 16px：:has(> span) 只在宽态（渲染了文字）成立 */
.after:not(.oldrow) [data-slot="sidebar"] > div > button > span:first-child > span:has(> span) {
  justify-content: flex-start; width: auto; gap: 8px; }
.after:not(.oldrow) [data-slot="sidebar"] > div > button > span:first-child > span:has(> span) > svg { width: 16px; height: 16px; }
.after.g8 [data-slot="sidebar"] > div > nav > button { margin-left: 0; margin-right: 0; gap: 8px; }
.after.g8 [data-slot="sidebar"] [data-row-key^="workspace:"] { gap: 8px; }
.after.g8 [data-slot="sidebar"] [data-row-key^="session:"] > span:nth-child(2) { margin-left: 8px; }
/* 上一版的间距（12px），仅用于对照 */
.after.g12old [data-slot="sidebar"] > div > nav > button { margin-left: 0; margin-right: 0; gap: 12px; }
.after.g12old [data-slot="sidebar"] [data-row-key^="workspace:"] { gap: 12px; }
.after.g12old [data-slot="sidebar"] [data-row-key^="session:"] > span:nth-child(2) { margin-left: 12px; }
.after.g12old [data-slot="sidebar"] button[data-row-key^="overflow:"] { padding-left: calc(36px + var(--dsh-workspace-indent, 0px)); }
.after.pad [data-slot="sidebar"] > div { --dsh-sidebar-inline-padding: 8px; }
.after.overflow [data-slot="sidebar"] button[data-row-key^="overflow:"] { margin-top: 2px;
  padding-left: calc(32px + var(--dsh-workspace-indent, 0px)); border-radius: var(--dsw-radius-md); font-size: 0; }
.after.overflow [data-slot="sidebar"] button[data-row-key^="overflow:"]::after { content: "更多会话"; font-size: 14px; }
.after.overflow [data-slot="sidebar"] button[data-row-key^="overflow:"][aria-expanded="true"]::after { content: "收起"; }
.after.overflow [data-slot="sidebar"] button[data-row-key^="overflow:"]:hover { background: var(--dsw-alias-interactive-bg-hover); }
.after.h36 [data-slot="sidebar"] [data-row-key^="workspace:"],
.after.h36 [data-slot="sidebar"] [data-row-key^="session:"],
.after.h36 [data-slot="sidebar"] button[data-row-key^="overflow:"] { height: 36px; }
/* 规则 9（现在）：所有行统一 32px —— 工作区/会话/更多会话 + 区段标题行 + 面板行。
   面板行官方靠 min-height:36px + padding:7px 8px 撑高（行高 22px），
   上下内边距收到 5px 才是 22 + 10 = 32。 */
.after.h32 [data-slot="sidebar"] [data-row-key^="workspace:"],
.after.h32 [data-slot="sidebar"] [data-row-key^="session:"],
.after.h32 [data-slot="sidebar"] button[data-row-key^="overflow:"],
.after.h32 [data-slot="sidebar.workspaces"] > div > :first-child { height: 32px; }
.after.h32 [data-slot="sidebar"] > div > nav > button { min-height: 32px; height: 32px;
  padding-top: 5px; padding-bottom: 5px; }
/* 规则 15：工作区与工作区之间 4px → 8px（只动跨组间距，组内 2px 不动） */
.after.groups8 [data-slot="sidebar"] [class*="groupSection"] + [class*="groupSection"] { margin-top: 8px; }
.newfill[data-dark] div:has(> [data-slot="sidebar"]) { --dsw-specific-sidebar-fill: #151517; }
/* 亮色同名旋钮：基色换成对话区底色，不透明度 40% → 90%（见 client.js 规则 10/12） */
.lightfill div:has(> [data-slot="sidebar"]) { --dsw-specific-sidebar-fill: #ffffff; --dsw-alpha-light: 90%; }
.lightfill.nograd div:has(> [data-slot="sidebar"]) {
  background: color-mix(in srgb, color-mix(in srgb, var(--dsw-specific-sidebar-fill) 97%, #7a9bf0) var(--dsw-alpha-light), transparent); }
.after.folderMono [data-slot="sidebar"] [class*="folderActive"] { color: inherit; }
.after.nograd[data-dark] div:has(> [data-slot="sidebar"]) { background: color-mix(in srgb, #151517 50%, transparent); }
.after.head16 [data-slot="sidebar.workspaces"] > div > :first-child { padding-left: 8px; }
.after.head16 [data-sidebar-collapsed] [data-slot="sidebar.workspaces"] > div > :first-child { padding-left: 0; }
/* 上一轮的状态（内边距 8px + 间距 4px），仅用于对照展示 */
.after.gaps4 [data-slot="sidebar"] > div > nav > button { margin-left: 0; margin-right: 0; gap: 4px; }
.after.gaps4 [data-slot="sidebar"] [data-row-key^="workspace:"] { gap: 4px; }
.after.gaps4 [data-slot="sidebar"] [data-row-key^="session:"] > span:nth-child(2) { margin-left: 4px; }
/* 规则 13：无状态（idle）的会话行，左侧空座位补一个 6px 灰点
   （官方 idle 状态色；官方彩色实心点同为 10px 盒 / 6px 可见圆） */
.after [data-slot="sidebar"] [data-row-key^="session:"] > span:has(> [data-slot="sidebar.session.row.leading"]:empty)::after {
  content: ""; flex: none; width: 6px; height: 6px; border-radius: 50%;
  background: var(--dsw-alias-state-idle-primary);
}
`;

const CHROME_STRIP = `
<div class="_3WPZCG_topStrip" data-window-drag>
  <span class="mockLights"><i></i><i></i><i></i></span>
  <button class="_3WPZCG_iconButton _3WPZCG_toggle" aria-label="收起侧边栏">
    <svg class="_3WPZCG_panelIcon" width="16" height="16" viewBox="0 0 16 16" fill="none"
         stroke="currentColor" stroke-width="1.2"><rect x="1.5" y="2.5" width="13" height="11" rx="2"/><path d="M6 2.5v11"/></svg>
  </button>
</div>`;

const FISH = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M2.6 13.2c3-4.4 7-6.6 11.4-6.6 3.2 0 5.9 1.2 8 3.4-1.2 3.6-3.9 6.2-7.6 7.4-4.3 1.4-8.2.4-11.2-2.6a.6.6 0 0 1-.6-1.6Zm13.1-2.1a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3Z"/></svg>`;
const PLUS = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6.2"/><path d="M8 5.4v5.2M5.4 8h5.2"/></svg>`;

const logoRow = (darwin) => `
<div class="_3WPZCG_logoRow" data-window-drag>
  <${darwin ? 'span' : 'button'} class="_3WPZCG_brand _3WPZCG_wide"${darwin ? '' : ' aria-label="新会话"'}>
    <span class="_3WPZCG_brandIdentity" aria-hidden="true">
      <span class="_3WPZCG_brandMark"><div data-slot="sidebar.brand.mark" style="display:contents">${FISH}</div></span>
      <span class="_3WPZCG_brandName"><div data-slot="sidebar.brand.name" style="display:contents">deepseek<b class="mockBadge">HARNESS</b></div></span>
    </span>
  </${darwin ? 'span' : 'button'}>
</div>`;

/**
 * The New Session button exactly as the shell renders it while wide: the 14px
 * medium new-chat glyph, the label, and the ⌘N keycap (`ShortcutKeys` variant
 * "plain" → unboxed `<kbd>`s, hidden until hover).
 */
const newSession = `
<button class="_3WPZCG_newSession" aria-label="新会话">
  <span class="_3WPZCG_newSessionLabelMask"><span class="_3WPZCG_newSessionContent">
    ${PLUS}<span class="_3WPZCG_newSessionLabel _3WPZCG_wide">新会话</span>
  </span></span>
  <span class="_3WPZCG_newSessionShortcut" aria-hidden="true"><span class="keys"><kbd class="key">⌘</kbd><kbd class="key">N</kbd></span></span>
</button>`;

const folder = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1.8 4.2c0-.7.6-1.2 1.2-1.2h3l1.4 1.6h5.6c.7 0 1.2.5 1.2 1.2v6.4c0 .7-.5 1.2-1.2 1.2H3c-.6 0-1.2-.5-1.2-1.2V4.2Z"/></svg>`;
const chevron = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3.2 1.6 6.8 5l-3.6 3.4"/></svg>`;
const sliders = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2.5 5h11M2.5 11h11"/><circle cx="6" cy="5" r="1.7"/><circle cx="10.5" cy="11" r="1.7"/></svg>`;

/** Official `StateDot` markup for a solid state: a 10px box painted by ::after. */
const officialDot = (state) =>
  `<span class="dot" data-state="${state}" aria-hidden="true" style="width:10px;height:10px"></span>`;
/** Official `StateDot` markup for `ongoing`: the 14px two-arc loader. */
const officialSpinner = `<svg class="spinner" data-state="ongoing" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><g class="spinnerMotion"><circle class="spinnerTrack" cx="12" cy="12" r="9.5"/><circle class="spinnerArc" cx="12" cy="12" r="9.5"/></g></svg>`;

/**
 * The row's leading 16px cell, exactly as `ui-workspace` renders it: a
 * `StateDot` while the primary status is not `idle`, and — while it *is* `idle` —
 * the `sidebar.session.row.leading` seat, whose anchor is normally empty. That
 * empty anchor is what rule 13 paints the grey dot into.
 */
const leadingCell = (state) =>
  state === 'running'
    ? officialSpinner
    : state === 'warning'
      ? officialDot('warning')
      : state === 'done'
        ? officialDot('done')
        : '<div data-slot="sidebar.session.row.leading" style="display:contents"></div>';

const project = (name, active) => `
<div class="jJkEga_projectRow" data-row-key="workspace:${name}" role="treeitem" aria-expanded="true">
  <span class="jJkEga_slot jJkEga_folder${active ? ' jJkEga_folderActive' : ''}">${folder}</span>
  <span class="jJkEga_slot jJkEga_chevron">${chevron}</span>
  <span class="jJkEga_projectText"><span class="jJkEga_title">${name}</span></span>
</div>`;

const session = (title, meta, state) => `
<div class="jJkEga_sessionRow${state === 'selected' ? ' jJkEga_selected' : ''}" data-row-key="session:${title}" role="treeitem">
  <span class="jJkEga_slot">${leadingCell(state)}</span>
  <span class="jJkEga_title">${title}</span>
  <span class="jJkEga_time">${meta}</span>
</div>`;

const browser = (compact = false) => `
<div class="_7514NG_root">
  <div class="_7514NG_sectionHeader">
    <span class="_7514NG_sectionLabel _7514NG_wide">工作区</span>
    <div class="_7514NG_searchSlot"><div class="_7514NG_search">
      <button class="_7514NG_searchButton" aria-label="搜索会话">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="7" cy="7" r="4.4"/><path d="m10.4 10.4 3 3"/></svg>
      </button>
    </div></div>
    <div class="_7514NG_headerActions"><button class="_7514NG_iconButton" aria-label="视图选项">${sliders}</button></div>
  </div>
  <div class="_7514NG_listArea"><div class="_7514NG_treeBody _7514NG_wide">
    <div class="_7514NG_list" role="tree" aria-label="会话">
      <div class="_7514NG_groupSection">
        ${project('DSH UI Lab', true)}
        ${session('设计一个重定义侧边栏的插件', '2 分钟前', 'selected')}
        ${session('调研 DSH 侧边栏的扩展机制', '1 小时前', 'running')}
        ${session('修复 asar 解包工具的 offset 问题', '昨天', 'warning')}
        <button class="_7514NG_sessionOverflowButton" data-row-key="overflow:DSH UI Lab" aria-expanded="false">展开其余 4 个会话</button>
      </div>
      ${
        compact
          ? ''
          : `<div class="_7514NG_groupSection">
        ${project('dsh-plugin-appshot', false)}
        ${session('截图插件的权限弹窗', '3 天前', '')}
        ${session('Windows 采集代理的边界情况', '上周', '')}
      </div>`
      }
    </div>
  </div></div>
</div>`;

const settingsRow = `
<div class="_3WPZCG_footArea">
  <div class="_3WPZCG_settingsArea">
    <button class="mockSetting">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.6v1.8M8 12.6v1.8M1.6 8h1.8M12.6 8h1.8M3.5 3.5l1.3 1.3M11.2 11.2l1.3 1.3M12.5 3.5l-1.3 1.3M4.8 11.2l-1.3 1.3"/></svg>
      <span>设置</span>
    </button>
  </div>
</div>`;

const puzzleGlyph = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M6 2.6h4v1.6a1.4 1.4 0 1 0 2.8 0V2.6h.6c.6 0 1 .4 1 1v3.2h-1.6a1.4 1.4 0 1 0 0 2.8h1.6v3c0 .6-.4 1-1 1H10v-1.6a1.4 1.4 0 1 0-2.8 0v1.6H4c-.6 0-1-.4-1-1V9.4h1.6a1.4 1.4 0 1 0 0-2.8H3V3.6c0-.6.4-1 1-1h2Z"/></svg>`;
const skillGlyph = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M3.2 2.4h5.4l3.2 3.2v8H3.2z"/><path d="M8.6 2.4v3.2h3.2"/><path d="M5.5 8.6h4.4M5.5 11h2.8"/></svg>`;
const clockGlyph = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="5.8"/><path d="M8 4.6V8l2.4 1.6"/></svg>`;
const rssGlyph = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.6 6.4a7 7 0 0 1 7 7M2.6 2.6a10.8 10.8 0 0 1 10.8 10.8"/><circle cx="3.6" cy="12.4" r="1.1" fill="currentColor" stroke="none"/></svg>`;

/** Global panel rows: the `sidebar.panellist` registrations (Plugins, Schedules, …). */
const panelList = (collapsed) => `
<nav class="_3WPZCG_panelList" aria-label="面板">
  ${[
    ['插件', puzzleGlyph],
    ['Skill/MCP', skillGlyph],
    ['自动化任务', clockGlyph],
    ['乔木 RSS', rssGlyph],
  ]
    .map(
      ([label, glyph]) => `
  <button class="_3WPZCG_panelRow" aria-label="${label}">
    <span class="_3WPZCG_panelGlyph" aria-hidden="true">${glyph}</span>
    ${collapsed ? '' : `<span class="_3WPZCG_panelTitle _3WPZCG_wide">${label}</span>`}
  </button>`,
    )
    .join('')}
</nav>`;

const sidebar = ({ darwin, collapsed, patched, compact = false }) => `
<div class="_6Qf49G_sidebarCol">
  <div data-slot="sidebar" style="display:contents">
    <div class="_3WPZCG_root${collapsed ? ' _3WPZCG_collapsed' : ''}">
      ${darwin && !collapsed ? CHROME_STRIP : ''}
      ${collapsed ? `
        <div class="_3WPZCG_logoRow" data-window-drag>
          <button class="_3WPZCG_iconButton _3WPZCG_toggle" aria-label="展开侧边栏">
            <span class="_3WPZCG_railMark"><div data-slot="sidebar.brand.mark" style="display:contents">${FISH}</div></span>
          </button>
        </div>` : logoRow(darwin)}
      ${collapsed ? `
        <button class="_3WPZCG_newSession" aria-label="新会话" style="justify-content:center">${PLUS}</button>` : newSession}
      ${panelList(collapsed)}
      <div class="_3WPZCG_regionArea"><div data-slot="sidebar.workspaces" style="display:contents">
        ${collapsed ? '' : browser(compact)}
      </div></div>
      ${collapsed || compact ? '' : settingsRow}
    </div>
  </div>
</div>`;

/** One panel: a sidebar plus a slice of the conversation column for context. */
const panel = (label, opts) => `
<figure class="panel${opts.trim || opts.patched || opts.prev || opts.mid || opts.mid16 ? ' after' : ''}${opts.patched ? ` pad g8 overflow head16 h32 groups8 folderMono ${opts.light ? 'lightfill' : 'newfill'}${opts.withGrad ? '' : ' nograd'}` : ''}${opts.mid ? ' pad g12old overflow head16 h36' : ''}${opts.prev ? ' pad gaps4' : ''}${opts.mid16 ? ' pad g12old head16' : ''}${opts.hover ? ' forceHover' : ''}${opts.prev || opts.mid || opts.mid16 ? ' oldrow' : ''}"${opts.patched && !opts.light ? ' data-dark' : ''}>
  <figcaption>${label}</figcaption>
  <div class="_6Qf49G_frame" data-platform="darwin" style="grid-template-columns:${opts.collapsed ? 56 : 280}px minmax(0,1fr)">
    ${sidebar(opts)}
    <div class="_6Qf49G_centerCol">
      <div class="mockCenter"><div class="mockMsg"></div><div class="mockMsg short"></div></div>
    </div>
  </div>
</figure>`;

const page = (title, panelsHtml) => `<!doctype html>
<html lang="zh" data-platform="darwin"><head><meta charset="utf-8">
<title>${title}</title>
<style>${css}</style>
<style>${primitiveCss}</style>
<style id="sidebar-polish">${PATCH}</style>
<style>
  html,body{margin:0;background:#0b0b0d;font-family:-apple-system,"SF Pro Text","PingFang SC",system-ui,sans-serif}
  .wrap{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#2a2a30}
  .panel{margin:0;background:#0b0b0d;min-width:0}
  figcaption{color:#8b8b95;font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:8px 12px;background:#141417}
  ._6Qf49G_frame{height:520px}
  .mockLights{display:flex;gap:8px;margin-right:auto;padding-left:4px}
  .mockLights i{width:12px;height:12px;border-radius:50%;background:#ffffff2e;display:block}
  .mockBadge{border:.5px solid currentColor;border-radius:3px;font-size:10px;font-weight:600;
    letter-spacing:.08em;padding:1px 5px;margin-left:8px;opacity:.85;vertical-align:2px}
  .mockSetting{display:flex;align-items:center;gap:10px;width:100%;height:38px;padding:0 10px;
    border:0;border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-primary);
    font-size:13px;font-family:inherit;cursor:pointer}
  .mockSetting:hover{background:var(--dsw-alias-interactive-bg-hover)}
  .mockCenter{padding:28px 32px;display:flex;flex-direction:column;gap:14px}
  .mockMsg{height:64px;border-radius:12px;background:#ffffff0d}
  .mockMsg.short{height:32px;width:60%}
  .note{grid-column:1/-1;margin:0;padding:10px 14px;background:#141417;color:#7b7b85;
    font-size:11.5px;line-height:1.7}
  .note b{color:#a9a9b3;font-weight:600}
</style></head>
<body data-ds-dark-theme>
<div class="wrap">
${panelsHtml}
<p class="note"><b>说明：</b>侧边栏外壳的 CSS（含 class 哈希、几何与配色令牌）逐字取自
<code>@deepseek-ai/dsh-client-ui-sidebar</code> 与 <code>@deepseek-ai/dsh-client-ui-layout</code> 的真实产物，
DOM 层级按 shell 的 JSX 复刻，因此「改造前」面板与真实应用一致；
<b>工作区/会话列表条目为示意内容</b>（标题与时间戳；行的结构、状态圆点与样式都是真实的）。
「改造后」面板额外应用了本插件的全部规则（含无状态行的灰点）。</p>
</div>
</body></html>`;

/**
 * Light-appearance sibling of `page()`. Two differences matter:
 *   1. no `data-ds-dark-theme`, so the shipped light tokens apply;
 *   2. the page paints the macOS window material the sidebar column actually
 *      sits on, so the translucent fill composites exactly like it does in the
 *      app. `vibrancy: "sidebar"` in light appearance renders ≈#d7d6d5 behind
 *      this window (measured off a real screenshot of the running app).
 */
const MACOS_SIDEBAR_MATERIAL_LIGHT = '#d7d6d5';
const lightPage = (title, panelsHtml) => `<!doctype html>
<html lang="zh" data-platform="darwin"><head><meta charset="utf-8">
<title>${title}</title>
<style>${css}</style>
<style>${primitiveCss}</style>
<style id="sidebar-polish">${PATCH}</style>
<style>
  html,body{margin:0;background:${MACOS_SIDEBAR_MATERIAL_LIGHT};
    font-family:-apple-system,"SF Pro Text","PingFang SC",system-ui,sans-serif}
  .wrap{display:grid;grid-template-columns:1fr 1fr;background:transparent}
  .panel{margin:0;background:transparent;min-width:0}
  figcaption{color:#5f5f66;font-size:11px;letter-spacing:.06em;text-transform:uppercase;
    padding:8px 12px;background:#e9e8e6;border-bottom:1px solid #dcdad8}
  ._6Qf49G_frame{height:520px}
  .mockLights{display:flex;gap:8px;margin-right:auto;padding-left:4px}
  .mockLights i{width:12px;height:12px;border-radius:50%;display:block}
  .mockLights i:nth-child(1){background:#ff5f57}
  .mockLights i:nth-child(2){background:#febc2e}
  .mockLights i:nth-child(3){background:#28c840}
  .mockBadge{border:.5px solid currentColor;border-radius:3px;font-size:10px;font-weight:600;
    letter-spacing:.08em;padding:1px 5px;margin-left:8px;opacity:.85;vertical-align:2px}
  .mockSetting{display:flex;align-items:center;gap:10px;width:100%;height:38px;padding:0 10px;
    border:0;border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-primary);
    font-size:13px;font-family:inherit;cursor:pointer}
  .mockSetting:hover{background:var(--dsw-alias-interactive-bg-hover)}
  .mockCenter{padding:28px 32px;display:flex;flex-direction:column;gap:14px}
  .mockMsg{height:64px;border-radius:12px;background:#0000000a}
  .mockMsg.short{height:32px;width:60%}
  .note{grid-column:1/-1;margin:0;padding:10px 14px;background:#e9e8e6;color:#5f5f66;
    font-size:11.5px;line-height:1.7;border-top:1px solid #dcdad8}
  .note b{color:#3d3d43;font-weight:600}
</style></head>
<body>
<div class="wrap">
${panelsHtml}
<p class="note"><b>说明：</b>这是<b>亮色</b>外观。<code>body</code> 铺的就是 macOS 给侧栏列垫的窗口材质
（<code>vibrancy: "sidebar"</code>，实测 ≈<code>#d7d6d5</code>），所以半透明侧栏在这里的合成结果与真实窗口一致。
左右两格是同一页、同一背景：左边是官方样式（基色 <code>#f9fafb</code> + 40% 不透明），
右边是本插件（基色 <code>#ffffff</code> = 对话区 <code>--dsw-alias-bg-base</code> + 90% 不透明）。
每格右侧是不透明的对话区（中栏，<code>#ffffff</code>）。</p>
</div>
</body></html>`;

const EXPANDED_BEFORE = panel('改造前 · 展开（官方原版）', { darwin: true, collapsed: false });
const EXPANDED_AFTER = panel('改造后 · 展开（本插件生效）', { darwin: true, collapsed: false, patched: true });
const RAIL_BEFORE = panel('改造前 · 收起 56px 轨道', { darwin: false, collapsed: true });
const RAIL_AFTER = panel('改造后 · 收起（轨道展开按钮保留）', { darwin: false, collapsed: true, patched: true });

const files = [
  ['before.html', 'DSH 侧边栏 · 改造前', `${EXPANDED_BEFORE}${RAIL_BEFORE}`],
  ['after.html', 'DSH 侧边栏 · 改造后', `${EXPANDED_AFTER}${RAIL_AFTER}`],
  ['compare.html', 'DSH 侧边栏 · 对照',
    `${EXPANDED_BEFORE}${EXPANDED_AFTER}${RAIL_BEFORE}${RAIL_AFTER}`],
];

for (const [file, title, panelsHtml] of files) {
  writeFileSync(join(preview, file), page(title, panelsHtml));
}

/**
 * A single-panel page plus a measuring script: `--dump-dom` then echoes the
 * geometry Chrome actually computed, so the reported numbers are measured
 * rather than re-derived from the stylesheets.
 */
const MEASURE = `
<pre id="out" style="color:#ddd;font:12px/1.6 ui-monospace,monospace;padding:12px"></pre>
<script>
const out = [];
const px = (v) => Math.round(v * 100) / 100;
const box = (label, el) => {
  if (!el) return out.push(label + ': MISSING');
  const r = el.getBoundingClientRect();
  out.push(label + ': x=' + px(r.x) + ' w=' + px(r.width) + ' h=' + px(r.height) + ' top=' + px(r.top));
};
const q = (s) => document.querySelector('.panel ' + s);
const col = q('._6Qf49G_sidebarCol');
const colRect = col.getBoundingClientRect();
const colX = colRect.x, colR = colRect.right;
box('sidebar column', col);
box('root', q('._3WPZCG_root'));
box('regionArea', q('._3WPZCG_regionArea'));
box('workspace root', q('._7514NG_root'));
box('sectionHeader', q('._7514NG_sectionHeader'));
box('list', q('._7514NG_list'));
const rows = [...document.querySelectorAll('.panel .jJkEga_projectRow, .panel .jJkEga_sessionRow')];
rows.forEach((el, i) => {
  const r = el.getBoundingClientRect();
  out.push('row[' + i + '] ' + (el.classList.contains('jJkEga_projectRow') ? 'project' : 'session') +
    ': left=' + px(r.x) + ' right=' + px(r.right) + ' h=' + px(r.height));
  if (i > 0) {
    const p = rows[i - 1].getBoundingClientRect();
    out.push('  gap above: ' + px(r.top - p.bottom) + 'px (pitch ' + px(r.top - p.top) + 'px)');
  }
});
const listEl = q('._7514NG_list');
const cs = getComputedStyle(listEl);
out.push('list padding: L=' + cs.paddingLeft + ' R=' + cs.paddingRight +
         ' scrollbarGutterOccupied=' + (listEl.offsetWidth - listEl.clientWidth) + 'px');
const titleEl = q('.jJkEga_sessionRow .jJkEga_title');
if (titleEl) out.push('session title left from column: ' + px(titleEl.getBoundingClientRect().x - colX) + 'px');
const folderEl = q('.jJkEga_projectRow .jJkEga_slot');
if (folderEl) out.push('project icon left from column: ' + px(folderEl.getBoundingClientRect().x - colX) + 'px');
if (rows[0]) {
  const r0 = rows[0].getBoundingClientRect();
  const rs = rows.find((r) => r.classList.contains('jJkEga_sessionRow')).getBoundingClientRect();
  out.push('row left inset from column: ' + px(r0.x - colX) + 'px | right inset: ' + px(colR - r0.right) + 'px');
  out.push('session row width: ' + px(rs.width) + 'px | column width: ' + px(colR - colX) + 'px');
}
const header = q('._7514NG_sectionHeader');
if (header) {
  const h = header.getBoundingClientRect();
  const r0 = rows[0].getBoundingClientRect();
  out.push('header bottom -> first row gap: ' + px(r0.top - h.bottom) + 'px');
}
const regions = [...document.querySelectorAll('.panel ._7514NG_groupSection')];
if (regions.length > 1) {
  const a = regions[0].getBoundingClientRect(), b = regions[1].getBoundingClientRect();
  out.push('group pitch (last row of g1 -> first row of g2): measured via group tops: ' + px(b.top - a.top) + 'px');
}
const label = q('._7514NG_sectionLabel');
if (label) out.push('section label left from column: ' + px(label.getBoundingClientRect().x - colX) + 'px');
const ptext = q('.jJkEga_projectRow .jJkEga_projectText');
if (ptext) out.push('project title left from column: ' + px(ptext.getBoundingClientRect().x - colX) + 'px');
const time = q('.jJkEga_sessionRow .jJkEga_time');
if (time) out.push('session time right edge inset: ' + px(colR - time.getBoundingClientRect().right - 12) + 'px inside the row pill');
const row0 = rows[0];
if (row0) {
  const rcs = getComputedStyle(row0);
  out.push('row pill: radius=' + rcs.borderTopLeftRadius + ' paddingLeft=' + rcs.paddingLeft + ' gap=' + rcs.gap);
}
const activeFolder = q('[class*="folderActive"]');
const rowText = q('.jJkEga_projectText');
if (activeFolder) {
  out.push('激活文件夹图标色 = ' + getComputedStyle(activeFolder).color +
    ' | 行文字色 = ' + (rowText ? getComputedStyle(rowText).color : '-'));
}
const ov = q('[data-row-key^="overflow:"]');
if (ov) {
  const r = ov.getBoundingClientRect();
  const cs = getComputedStyle(ov);
  const after = getComputedStyle(ov, '::after');
  const textX = px(r.x - colX + parseFloat(cs.paddingLeft));
  out.push('overflow : left=' + px(r.x) + ' right=' + px(r.right) + ' h=' + px(r.height) +
    ' | insets L=' + px(r.x - colX) + ' R=' + px(colR - r.right) +
    ' | paddingLeft=' + cs.paddingLeft + ' -> text x=' + textX +
    ' | radius=' + cs.borderTopLeftRadius + ' | own font-size=' + cs.fontSize +
    ' | ::after content=' + after.content + ' @' + after.fontSize);
}
const colEl = document.querySelector('div:has(> [data-slot="sidebar"])');
if (colEl) {
  const cs = getComputedStyle(colEl);
  out.push('底色选择器命中: <' + colEl.tagName.toLowerCase() + ' class="' + colEl.className + '">');
  out.push('  基色 --dsw-specific-sidebar-fill = ' + cs.getPropertyValue('--dsw-specific-sidebar-fill').trim());
  const bg = cs.backgroundImage || cs.background;
  const gradients = bg.split('linear-gradient').length - 1;
  out.push('  背景里 linear-gradient 层数: ' + gradients + ' | backgroundImage 长度 ' + bg.length);
  out.push('  backgroundColor = ' + cs.backgroundColor + ' | backgroundImage = ' + bg.substring(0, 120));
  const lbl = document.querySelector('.panel [data-row-key^="workspace:"] .jJkEga_title, .panel .jJkEga_projectText');
  const lblEl = document.querySelector('.panel .jJkEga_projectText');
  out.push('  工作区标题色 = ' + (lblEl ? getComputedStyle(lblEl).color : '-') +
    ' | 面板行标题色 = ' + (document.querySelector('.panel ._3WPZCG_panelTitle') ? getComputedStyle(document.querySelector('.panel ._3WPZCG_panelTitle')).color : '-'));
  out.push('  body 上的 --dsw-specific-sidebar-fill = ' + getComputedStyle(document.body).getPropertyValue('--dsw-specific-sidebar-fill').trim());
  const centerEl = document.querySelector('.panel ._6Qf49G_centerCol');
  if (centerEl) {
    out.push('中栏(对话区) backgroundColor = ' + getComputedStyle(centerEl).backgroundColor +
      '  [--dsw-alias-bg-base=' + getComputedStyle(centerEl).getPropertyValue('--dsw-alias-bg-base').trim() + ']');
  }
  out.push('侧栏列 backgroundColor = ' + cs.backgroundColor + '（半透明层）');
} else {
  out.push('底色选择器: MISSING（:has() 没命中侧栏列）');
}
const panels = [...document.querySelectorAll('.panel ._3WPZCG_panelRow')];
panels.forEach((el, i) => {
  const r = el.getBoundingClientRect();
  const g = el.querySelector('._3WPZCG_panelGlyph');
  const t = el.querySelector('._3WPZCG_panelTitle');
  out.push('panelRow[' + i + ']: left=' + px(r.x) + ' right=' + px(r.right) + ' h=' + px(r.height) +
    ' | insets L=' + px(r.x - colX) + ' R=' + px(colR - r.right) +
    ' | glyph x=' + (g ? px(g.getBoundingClientRect().x - colX) : '-') +
    ' | title x=' + (t ? px(t.getBoundingClientRect().x - colX) : '-'));
});
if (panels.length > 1) {
  const a = panels[0].getBoundingClientRect(), b = panels[1].getBoundingClientRect();
  out.push('panelRow vertical gap: ' + px(b.top - a.bottom) + 'px');
}
// 新会话行：规则 2 把它拉齐成面板行的同款（这一组数就是「是否对齐」的证据）
const nsBtn = q('._3WPZCG_newSession');
if (nsBtn) {
  const r = nsBtn.getBoundingClientRect();
  const cs = getComputedStyle(nsBtn);
  out.push('newSession: left=' + px(r.x) + ' right=' + px(r.right) + ' h=' + px(r.height) +
    ' | insets L=' + px(r.x - colX) + ' R=' + px(colR - r.right) +
    ' | radius=' + cs.borderTopLeftRadius + ' | border=' + cs.borderTopWidth + ' | bg=' + cs.backgroundColor +
    ' | weight=' + cs.fontWeight + ' | padL=' + cs.paddingLeft);
  const glyph = nsBtn.querySelector('svg');
  const label = nsBtn.querySelector('._3WPZCG_newSessionLabel');
  if (glyph) out.push('  glyph x=' + px(glyph.getBoundingClientRect().x - colX) +
    ' w=' + px(glyph.getBoundingClientRect().width));
  if (label) out.push('  label x=' + px(label.getBoundingClientRect().x - colX));
  if (panels[0]) out.push('  gap to first panelRow: ' + px(panels[0].getBoundingClientRect().top - r.bottom) + 'px');
}
// 四条「图标 -> 文字」对齐线对比
const glyphLines = [];
const nsGlyph = nsBtn && nsBtn.querySelector('svg');
const nsLabel = nsBtn && nsBtn.querySelector('._3WPZCG_newSessionLabel');
if (nsGlyph && nsLabel) {
  const g = nsGlyph.getBoundingClientRect(), t = nsLabel.getBoundingClientRect();
  glyphLines.push('newSess : glyph ' + px(g.x - colX) + '..' + px(g.right - colX) +
    ' (w=' + px(g.width) + ')  text ' + px(t.x - colX) + '  gap=' + px(t.x - g.right));
}
const panel0 = panels[0];
if (panel0) {
  const g = panel0.querySelector('._3WPZCG_panelGlyph').getBoundingClientRect();
  const t = panel0.querySelector('._3WPZCG_panelTitle').getBoundingClientRect();
  glyphLines.push('panel   : glyph ' + px(g.x - colX) + '..' + px(g.right - colX) +
    ' (w=' + px(g.width) + ')  text ' + px(t.x - colX) + '  gap=' + px(t.x - g.right));
}
const pj = q('.jJkEga_projectRow');
if (pj) {
  const g = pj.querySelector('.jJkEga_slot').getBoundingClientRect();
  const t = pj.querySelector('.jJkEga_projectText').getBoundingClientRect();
  glyphLines.push('workspace: glyph ' + px(g.x - colX) + '..' + px(g.right - colX) +
    ' (w=' + px(g.width) + ')  text ' + px(t.x - colX) + '  gap=' + px(t.x - g.right));
}
const se = q('.jJkEga_sessionRow');
if (se) {
  const g = se.querySelector('.jJkEga_slot').getBoundingClientRect();
  const t = se.querySelector('.jJkEga_title').getBoundingClientRect();
  glyphLines.push('session : glyph ' + px(g.x - colX) + '..' + px(g.right - colX) +
    ' (w=' + px(g.width) + ')  text ' + px(t.x - colX) + '  gap=' + px(t.x - g.right));
}
out.push('--- 图标/文字对齐线 ---');
glyphLines.forEach((l) => out.push(l));
document.getElementById('out').textContent = out.join('\\n');
</script>`;

writeFileSync(
  join(preview, 'measure.html'),
  page('测量 · 改造后', EXPANDED_AFTER).replace('</body>', `${MEASURE}</body>`),
);
writeFileSync(
  join(preview, 'measure-before.html'),
  page('测量 · 改造前', EXPANDED_BEFORE).replace('</body>', `${MEASURE}</body>`),
);

console.log(
  `wrote ${[...files.map((f) => 'preview/' + f[0]), 'preview/measure.html', 'preview/measure-before.html'].join(', ')}`,
);

/**
 * Zoomed alignment check: the left 132px of the sidebar at 3x, with a guide on
 * the workspace-label line (42px) so the panel rows can be compared against the
 * rows below them. Side by side: before / after.
 */
const CROP = 132;
const CROP_H = 330;
/**
 * How far the New Session row (32px tall + its 4px gap) pushes everything below
 * it inside the patched panels. The historic panels (`.oldrow`) still hide that
 * button, so their crops start at 0 while the patched ones start here — that is
 * what keeps the two sides row-for-row comparable in these zoom pages.
 */
const NEW_ROW_SHIFT = 36;
const SCALE = 2.5;
const zoomStrip = (label, opts) => {
  const H = opts.cropH ?? CROP_H;
  const S = opts.scale ?? SCALE;
  const W = opts.cropW ?? CROP;
  const TOP = opts.cropTop ?? 0;
  const FH = opts.frameH ?? H;   // frame 高度要与裁剪窗口分开，否则会把侧边栏压扁
  return `
<figure class="zoomPanel${opts.trim || opts.patched || opts.prev || opts.mid || opts.mid16 ? ' after' : ''}${opts.patched ? ` pad g8 overflow head16 h32 groups8 folderMono newfill${opts.withGrad ? '' : ' nograd'}` : ''}${opts.mid ? ' pad g12old overflow head16 h36' : ''}${opts.prev ? ' pad gaps4' : ''}${opts.mid16 ? ' pad g12old head16' : ''}${opts.hover ? ' forceHover' : ''}${opts.hoverNew ? ' forceHoverNew' : ''}${opts.prev || opts.mid || opts.mid16 ? ' oldrow' : ''}">
  <figcaption>${label}</figcaption>
  <div class="zoomCrop" style="width:${W * S}px;height:${H * S}px">
    <div class="zoomInner" style="transform:scale(${S});margin-top:${-TOP * S}px">
      <div class="guide" style="left:${opts.guide ?? 40}px"></div>
      <div class="_6Qf49G_frame" data-platform="darwin" style="grid-template-columns:280px 0px;height:${FH}px">
        ${sidebar({ ...opts, compact: true })}
      </div>
    </div>
  </div>
</figure>`;
};

const ALIGN_CSS = `
  .zoomWrap{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#2a2a30}
  .zoomPanel{margin:0;background:#0b0b0d}
  .zoomCrop{overflow:hidden;position:relative}
  .zoomInner{transform-origin:top left;width:280px;position:relative}
  .zoomInner .guide{position:absolute;top:0;bottom:0;width:1px;z-index:9;
    background:repeating-linear-gradient(#ff5c8a 0 4px,transparent 4px 8px)}
  .zoomPanel figcaption{color:#ff9ab5}
  .forceHover [data-row-key^="overflow:"]{background:var(--dsw-alias-interactive-bg-hover) !important}
  .zoomLegend{grid-column:1/-1;background:#141417;color:#8b8b95;font-size:11.5px;
    padding:9px 14px;margin:0;line-height:1.7}
`;

writeFileSync(
  join(preview, 'align.html'),
  page(
    '对齐检查',
    `${zoomStrip('上一版 · 图标→文字 12px（文字 44px）', { darwin: true, collapsed: false, mid16: undefined, mid: true })}
     ${zoomStrip('现在 · 图标→文字 8px，文字统一 40px', { darwin: true, collapsed: false, patched: true, cropTop: NEW_ROW_SHIFT })}
     <p class="zoomLegend">粉色虚线 = <b>40px</b> 文字对齐线（8 pill 内边距 + 8 行内边距 + 16 图标 + 8 间距）。左图是上一版（间距 12px → 文字 44px）；右图现在三种行的图标→文字间距都是 8px，文字全部压线。</p>`,
  ).replace('</style>', `${ALIGN_CSS}</style>`),
);
console.log('wrote preview/align.html');

/**
 * The session-overflow button ("show N more sessions") before/after, with the
 * hover pill forced on so a static screenshot can show it.
 */
writeFileSync(
  join(preview, 'overflow.html'),
  page(
    '更多会话按钮',
    `${zoomStrip('上一版 · 官方按钮（28px / 12px 字 / 无 hover 底色）', { darwin: true, collapsed: false, mid: true, cropH: 460, frameH: 560 })}
     ${zoomStrip('现在 · 32px / 14px 字 / 同款 hover 底色 / “更多会话”', { darwin: true, collapsed: false, patched: true, hover: true, cropTop: NEW_ROW_SHIFT, cropH: 460, frameH: 560 })}
     <p class="zoomLegend">两张都是同一个「展开其余 N 个会话」按钮（<code>data-row-key="overflow:…"</code>）。
     右侧同时演示了 hover：灰色胶囊与上方会话行完全同宽同圆角。粉色虚线仍是 44px 文字对齐线。</p>`,
  ).replace('</style>', `${ALIGN_CSS}</style>`),
);
console.log('wrote preview/overflow.html');

/**
 * Section-header alignment: the filter dropdown row, "工作区" vs the folder icon
 * below it, with the guide on the icon line (16px).
 */
writeFileSync(
  join(preview, 'header.html'),
  page(
    '工作区区段标题对齐',
    `${zoomStrip('上一版 · 「工作区」12px（比图标靠左 4px）', { darwin: true, collapsed: false, mid: true, cropH: 340, frameH: 400, guide: 16 })}
     ${zoomStrip('现在 · 「工作区」16px（与文件夹图标同线）', { darwin: true, collapsed: false, patched: true, cropTop: NEW_ROW_SHIFT, cropH: 340, frameH: 400, guide: 16 })}
     <p class="zoomLegend">粉色虚线 = <b>16px</b>，所有图标所在的垂线。
     左图「工作区」在 12px（偏左 4px），右图与下方文件夹图标、以及所有行的图标落在同一条线上。</p>`,
  ).replace('</style>', `${ALIGN_CSS}</style>`),
);
console.log('wrote preview/header.html');

/**
 * Row-height rhythm: official 36/34/32 vs the unified 32px.
 */
writeFileSync(
  join(preview, 'heights.html'),
  page(
    '行高统一',
    `${zoomStrip('上一版 · 工作区 34px / 会话 32px', { darwin: true, collapsed: false, mid: true, cropH: 400, frameH: 460, guide: 16 })}
     ${zoomStrip('现在 · 全部 32px', { darwin: true, collapsed: false, patched: true, cropTop: NEW_ROW_SHIFT, cropH: 400, frameH: 460, guide: 16 })}
     <p class="zoomLegend">同样数量的行：左图工作区行 34px、会话行 32px 两档不一；
     右图工作区行、会话行、面板行、「更多会话」按钮、区段标题行全部 32px。</p>`,
  ).replace('</style>', `${ALIGN_CSS}</style>`),
);
console.log('wrote preview/heights.html');

/**
 * Active-workspace folder icon: blue accent vs monochrome (same as row text).
 * Cropped tight around the workspace row so the icon colour is obvious.
 */
writeFileSync(
  join(preview, 'folder.html'),
  page(
    '激活工作区图标颜色',
    `${zoomStrip('上一版 · 蓝色强调 rgb(122,170,255)', { darwin: true, collapsed: false, mid: true, cropW: 150, cropH: 110, frameH: 420, cropTop: 232, scale: 4 })}
     ${zoomStrip('现在 · 与文字同色 rgb(249,250,251)', { darwin: true, collapsed: false, patched: true, cropW: 150, cropH: 110, frameH: 420, cropTop: 232 + NEW_ROW_SHIFT, scale: 4 })}
     <p class="zoomLegend">同一行「当前会话所在的工作区」。左边文件夹是 <code>--dsw-alias-state-business-primary</code>（蓝色强调），
     右边改成 <code>color: inherit</code>，与右侧工作区名文字完全同色。</p>`,
  ).replace('</style>', `${ALIGN_CSS}</style>`),
);
console.log('wrote preview/folder.html');

/**
 * Sidebar fill vs the conversation column: official #1b1b1c base vs the
 * conversation's own #151517, both keeping the 50% translucency.
 */
writeFileSync(
  join(preview, 'fill.html'),
  page(
    '侧栏底色 vs 对话区',
    `${panel('上一版 · 基色 #1b1b1c（比对话区亮）', { darwin: true, collapsed: false, mid: true })}
     ${panel('现在 · 基色 #151517 = 对话区底色', { darwin: true, collapsed: false, patched: true })}
     <p class="note">每格左侧是侧边栏、右侧是对话区（中栏），同一页同一背景，可直接比对。
     两格都保留 <b>50% 半透明 + 顶部淡蓝/底部淡紫渐变</b>；差别只在半透明层的基色。
     注意侧栏是半透明的，最终观感 = 50% 基色 + 50% 窗口背后的材质，所以它不会与不透明的对话区完全相等 ——
     但基色取成对话区同色后，两者的差值已经<b>只由透明度和那两层染色造成</b>。</p>`,
  ),
);
console.log('wrote preview/fill.html');

/**
 * The same comparison in light appearance: official #f9fafb at 40% vs the
 * conversation's own #ffffff at 90% (see client.js rule 10/12).
 */
writeFileSync(
  join(preview, 'fill-light.html'),
  lightPage(
    '亮色 · 侧栏底色 vs 对话区',
    `${panel('官方 · 基色 #f9fafb / 40% 不透明', { darwin: true, collapsed: false })}
     ${panel('现在 · 基色 #ffffff / 90% 不透明', { darwin: true, collapsed: false, patched: true, light: true })}
     <p class="note">亮色下侧栏比对话区暗，是<b>两层原因</b>叠加：基色本身是灰的（<code>#f9fafb</code>，不是对话区的
     <code>#ffffff</code>），而且只有 <b>40%</b> 不透明 —— 剩下 60% 透出 macOS 的窗口材质（浅灰）。
     只把基色换成 <code>#ffffff</code> 实测只从 <code>rgb(227,227,228)</code> 走到 <code>rgb(229,227,228)</code>，
     所以这里把不透明度也一起提到 <b>90%</b>，侧栏落到 <code>rgb(248,248,250)</code> —— 与对话区的
     <code>rgb(255,255,255)</code> 只差 7 级。暗色那套没动（基色 <code>#151517</code>、50% 不透明）。</p>`,
  ),
);
console.log('wrote preview/fill-light.html');

/**
 * Sidebar gradient: the shipped blue/purple tint vs a flat translucent fill.
 */
writeFileSync(
  join(preview, 'grad.html'),
  page(
    '侧栏渐变色',
    `${panel('上一版 · 保留写死的渐变染色', { darwin: true, collapsed: false, patched: true, withGrad: true })}
     ${panel('现在 · 去掉渐变，只剩半透明基色', { darwin: true, collapsed: false, patched: true })}
     <p class="note">左右都是同一页、同一背景、同一基色（#151517 = 对话区底色），
     差别只在官方那层 <b>linear-gradient（顶部 #7a9bf0 淡蓝、底部 #8f89b8 淡紫）</b>。
     注意渐变在这种大图上很微妙：顶部和底部各有一层薄薄的冷色，中部基本透明。</p>`,
  ),
);
console.log('wrote preview/grad.html');

/**
 * Rule 13 — "no status" session rows. A tight zoom on the leading 16px cell,
 * before/after, with real `StateDot` markup so the grey dot is compared against
 * the coloured dots (running loader / amber / green) at their true size.
 */
const idleRows = `
      <div class="_7514NG_list" role="tree" aria-label="会话">
        <div class="_7514NG_groupSection">
          ${project('DSH UI Lab', true)}
          ${session('正在运行的会话', '刚刚', 'running')}
          ${session('等待审批的会话', '2 分钟前', 'warning')}
          ${session('刚完成的会话', '1 小时前', 'done')}
          ${session('无状态的会话 · 一', '昨天', 'idle')}
          ${session('无状态的会话 · 二', '昨天', 'idle')}
          ${session('无状态的会话 · 三', '上周', 'idle')}
        </div>
      </div>`;

const dotZoom = (label, opts) => `
<figure class="zoomPanel${opts.patched ? ' after pad g8 overflow head16 h32 groups8 folderMono lightfill nograd' : ''}">
  <figcaption>${label}</figcaption>
  <div class="zoomCrop" style="width:${opts.w * opts.s}px;height:${opts.h * opts.s}px">
    <div class="zoomInner" style="transform:scale(${opts.s});margin-top:${-opts.top * opts.s}px">
      <div class="guide" style="left:${opts.guide}px"></div>
      <div class="_6Qf49G_frame" data-platform="darwin" style="grid-template-columns:280px 0fr;height:${opts.frameH}px">
        <div class="_6Qf49G_sidebarCol">
          <div data-slot="sidebar" style="display:contents">
            <div class="_3WPZCG_root">
              <div class="_3WPZCG_regionArea"><div data-slot="sidebar.workspaces" style="display:contents">
                <div class="_7514NG_root">
                  <div class="_7514NG_listArea"><div class="_7514NG_treeBody _7514NG_wide">
                    ${idleRows}
                  </div></div>
                </div>
              </div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</figure>`;

const LIGHT_ZOOM_CSS = `
  .zoomWrap{background:#dcdad8}
  .zoomPanel{background:#d7d6d5}
  .zoomPanel figcaption{background:#e9e8e6;color:#5f5f66;border-bottom:1px solid #dcdad8}
  .zoomPanel .guide{background:repeating-linear-gradient(#e0578a 0 4px,transparent 4px 8px)}
  .zoomLegend{background:#e9e8e6;color:#5f5f66;border-top:1px solid #dcdad8}
  .zoomLegend b{color:#3d3d43}
`;

writeFileSync(
  join(preview, 'idle-dot.html'),
  lightPage(
    '无状态会话行 · 左侧灰点',
    `${dotZoom('官方 · 无状态行左侧是空的（只有正在运行/待审批/刚完成才有圆点）', { w: 190, h: 210, top: 42, s: 3, frameH: 420, guide: 20 })}
     ${dotZoom('现在 · 无状态行也画一个灰点，与彩色点同尺寸同心', { w: 190, h: 210, top: 42, s: 3, frameH: 420, guide: 16, patched: true })}
     <p class="zoomLegend">同一份真实样式与真实 <code>StateDot</code> 标记（<code>10px</code> 盒、
     <code>::after{inset:20%}</code> → 可见圆 <b>6px</b>）。粉色虚线是左侧槽位的中心线（官方 20px / 本插件 16px，
     差值是规则 6 的整体内边距 12px → 8px）。官方只在「有状态」时渲染圆点，
     无状态行只剩一个空的 <code>sidebar.session.row.leading</code> 座位，所以行首什么都不画；
     本插件给这个空座位补上官方 <code>idle</code> 状态色（亮 <code>#d4d4d4</code>）的同尺寸圆点。
     尺寸/颜色/圆心已由 <code>tools/verify-idle-dot.mjs</code> 在真实 Chrome 里与官方 idle 点<b>逐像素比对</b>通过。</p>`,
  ).replace('</style>', `${ALIGN_CSS}${LIGHT_ZOOM_CSS}</style>`),
);
console.log('wrote preview/idle-dot.html');

/**
 * Rule 2 — the New Session button redrawn as one more row of the global panel
 * list. Before: the shipped 38px bordered "elevated" card with centred content
 * and a 12px drop below it. After: the same 32px pill / 16px glyph / 8px gap /
 * 40px text line as the panel rows, and the same hover fill.
 *
 * Hover is forced through a class (as in `overflow.html`) because a static
 * screenshot cannot hover: the shipped card's hover is
 * `--dsw-alias-button-floating-hover`, the list rows' is
 * `--dsw-alias-interactive-bg-hover`.
 */
const NEW_SESSION_CSS = `
  .forceHoverNew._3WPZCG_x { }
  .forceHoverNew ._3WPZCG_newSession { background: var(--dsw-alias-button-floating-hover) !important; }
  [data-platform="darwin"] .forceHoverNew ._3WPZCG_newSession { background: #ffffff4d !important; }
  [data-platform="darwin"] [data-ds-dark-theme] .forceHoverNew ._3WPZCG_newSession { background: #fff3 !important; }
  .forceHoverNew.after:not(.oldrow) [data-slot="sidebar"] > div > button { background: var(--dsw-alias-interactive-bg-hover) !important; }
  .forceHoverNew ._3WPZCG_newSessionShortcut { opacity: 1; }
  .newSessionLegend code { color:#c9c9d4 }
`;

writeFileSync(
  join(preview, 'new-session.html'),
  page(
    '新会话按钮 · 列表行化',
    `${zoomStrip('官方原版 · 一张 38px 卡片：描边 + elevated 底 + 内容居中', { darwin: true, collapsed: false, cropW: 264, cropH: 330, scale: 2, guide: 40 })}
     ${zoomStrip('现在 · 与面板行同款的一行：32px 胶囊 / 16px 图标 / 文字 40px', { darwin: true, collapsed: false, patched: true, cropW: 264, cropH: 330, scale: 2, guide: 40 })}
     ${zoomStrip('官方原版 · hover（floating 底，卡片更亮）', { darwin: true, collapsed: false, cropW: 264, cropH: 330, scale: 2, guide: 40, hoverNew: true })}
     ${zoomStrip('现在 · hover 与面板行完全相同（interactive-bg-hover）', { darwin: true, collapsed: false, patched: true, cropW: 264, cropH: 330, scale: 2, guide: 40, hoverNew: true })}
     <p class="zoomLegend newSessionLegend">上下两组分别是<b>静止</b>与 <b>hover</b>（静态截图用 class 强制）。
     左列是官方原版：新会话按钮是一张独立的 <code>38px</code> 卡片 —— <code>.5px</code> 描边、elevated 半透明底、
     内容居中、下外边距 <code>12px</code>；它紧挨着的 <code>nav</code> 面板行（插件 / Skill-MCP / 自动化任务 / 乔木 RSS）
     却是 <code>32px</code> 无底色胶囊，两种东西并排。
     右列是本插件规则 2：行高 <code>32px</code>（规则 9 统一）、<code>padding: 5px 8px</code>、左右外边距 <code>0</code>、
     下外边距 <code>4px</code>（= 面板行的行间距）、图标 <code>16px</code>、图标→文字 <code>8px</code>、
     文字重量 <code>400</code>，hover 底色也换成官方给列表行的 <code>--dsw-alias-interactive-bg-hover</code>。
     粉色虚线是 <b>40px</b> 文字对齐线：右列「新会话」与下面每一行的文字都压在同一条线上。
     ⌘N 键帽（<code>ShortcutKeys</code>，官方 <code>12px</code> / label-tertiary）只在 hover 出现，静止态与列表行无异。</p>`,
  ).replace('</style>', `${ALIGN_CSS}${NEW_SESSION_CSS}</style>`),
);
console.log('wrote preview/new-session.html');

