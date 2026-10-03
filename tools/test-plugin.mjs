/**
 * Offline test for dsh-plugin-sidebar-polish.
 *
 * Loads the browser half with a fake `window`/`document`, emulating how DSH's
 * module loader consumes it, then asserts:
 *   1. it registers itself under the right module id,
 *   2. `apply` exports are present and `inject` is empty,
 *   3. exactly one <style> is installed, owned by the plugin,
 *   4. the stylesheet carries all three expected selectors,
 *   5. unload removes it,
 *   6. a second apply (hot reload) does not stack duplicates.
 *
 * Usage: node tools/test-plugin.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Resolve the plugin directory in both layouts: this workspace and the plugin repo. */
const pluginDir = [root, join(root, 'dsh-plugin-sidebar-polish')].find((dir) =>
  existsSync(join(dir, 'client.js')),
);
if (pluginDir === undefined) throw new Error('cannot locate the plugin directory (client.js)');

/** Selectors the plugin must ship. */
const EXPECTED_SELECTORS = [
  '[data-slot="sidebar"] > div > div[data-window-drag]:has([data-slot="sidebar.brand.name"])',
  '[data-slot="sidebar"] > div > button',
  '[data-slot="sidebar"] > div > button:hover',
  '[data-slot="sidebar"] > div > button:focus-visible',
  '[data-slot="sidebar"] > div > button > span:first-child > span:has(> span)',
  '[data-slot="sidebar"] > div > button > span:first-child > span:has(> span) > svg',
  'html[data-platform="darwin"]:not([data-fullscreen]) [data-slot="sidebar"] > div > :first-child',
  '[data-slot="sidebar"] > div > nav > button',
  '[data-slot="sidebar"] [data-row-key^="workspace:"]',
  '[data-slot="sidebar"] button[data-row-key^="overflow:"]',
  '[data-slot="sidebar"] button[data-row-key^="overflow:"]::after',
  '[data-slot="sidebar"] button[data-row-key^="overflow:"][aria-expanded="true"]::after',
  '[data-slot="sidebar"] button[data-row-key^="overflow:"]:hover',
  '[data-slot="sidebar.workspaces"] > div > :first-child',
  '[data-sidebar-collapsed] [data-slot="sidebar.workspaces"] > div > :first-child',
  'div:has(> [data-slot="sidebar"])',
  '[data-slot="sidebar"] [class*="folderActive"]',
  '[data-platform="darwin"] div:has(> [data-slot="sidebar"])',
  '[data-platform="darwin"] [data-ds-dark-theme] div:has(> [data-slot="sidebar"])',
  '[data-slot="sidebar"] [data-row-key^="session:"] > span:has(> [data-slot="sidebar.session.row.leading"]:empty)::after',
  '[data-slot="sidebar"] [class*="groupSection"] + [class*="groupSection"]',
];
/** 底色旋钮的基色：两态都取对话区 --dsw-alias-bg-base（官方原值 #1b1b1c / #f9fafb）。 */
const EXPECTED_FILL = ['#151517', '#ffffff'];
/** 底色旋钮的不透明度：暗色沿用官方 50%，亮色从官方 40% 提到 90%。 */
const EXPECTED_ALPHA = ['--dsh-sidebar-alpha-dark: 50%', '--dsh-sidebar-alpha-light: 90%'];
/** 溢出按钮「展开」态的新文案。 */
const EXPECTED_TEXT = '更多会话';

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

// ---- fake browser environment + DSH module loader -------------------------
const head = [];
const document = {
  createElement: () => ({
    dataset: {},
    textContent: '',
    removed: false,
    remove() {
      this.removed = true;
    },
  }),
  head: { appendChild: (el) => head.push(el) },
};

let entry = null;
const window = { __ModuleLoader__: { load: (e) => (entry = e) } };

// Execute the bundle the way a classic script would be executed.
new Function('window', 'document', readFileSync(join(pluginDir, 'client.js'), 'utf8'))(
  window,
  document,
);

check('向 __ModuleLoader__ 注册', entry !== null);
check('模块 id 正确', entry?.id === 'dsh-plugin-sidebar-polish', entry?.id);

/**
 * The one dependency the bundle may ask for: React, used by rule 14's settings entry.
 * Anything else would be a mistake, so the stub throws for it.
 */
const reactCalls = [];
const react = {
  createElement: (type, props, ...children) => {
    reactCalls.push({ type, props, children });
    return { type, props, children };
  },
};
const mod = entry.factory((name) => {
  if (name === 'react') return react;
  throw new Error(`不应 require 任何依赖，却请求了 ${name}`);
});
check('导出 apply', typeof mod.apply === 'function');
check(
  '导出 inject 为 slots + shortcuts',
  Array.isArray(mod.inject) && mod.inject.join(',') === 'slots,shortcuts',
  JSON.stringify(mod.inject),
);

// ---- ctx.effect + slots + shortcuts emulation ----------------------------
const effects = [];
const registrations = [];
const ctx = {
  effect: (fn, label) => {
    effects.push({ label, dispose: fn() });
  },
  slots: {
    inject: (key, callback) => {
      effects.push({ label: `slots.inject(${key})`, dispose: callback() });
    },
    register: (options, component) => {
      registrations.push({ options, component });
      return () => {};
    },
  },
  /* The service surface has no invoke; the registry it owns is what runs a command. */
  shortcuts: { registry: { invoke: (...args) => invoked.push(args) } },
};
const invoked = [];
mod.apply(ctx);

check('安装了两个 effect（样式表 + 座位注册）', effects.length === 2, effects.map((e) => e.label).join(' | '));
check('注入了 1 个 <style>', head.length === 1);
check('style 带插件归属标记', head[0]?.dataset.plugin === 'dsh-plugin-sidebar-polish');

const css = head[0]?.textContent ?? '';
/** Declarations only: comments may legitimately quote a shipped hash class. */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
for (const selector of EXPECTED_SELECTORS) {
  check(`含规则 ${selector.slice(0, 42)}…`, css.includes(selector));
}
check('未使用哈希类名', !/\._[A-Za-z0-9]+_/.test(rules));
check('激活态用稳定后缀而非完整哈希类名', !/\.[A-Za-z0-9_-]+_folderActive/.test(rules));
check(
  '已去掉侧栏渐变（没有任何 background 声明用渐变）',
  !/background[^;{}]*linear-gradient/.test(css),
);
check('保留了「减少透明度」无障碍偏好分支', /prefers-reduced-transparency:\s*reduce/.test(css));
check(`含新文案「${EXPECTED_TEXT}」`, css.includes(`content: "${EXPECTED_TEXT}"`));
for (const color of EXPECTED_FILL) {
  check(`底色旋钮含对话区色值 ${color}`, css.includes(color));
}
for (const alpha of EXPECTED_ALPHA) {
  check(`底色旋钮含不透明度 ${alpha}`, css.includes(alpha));
}
check(
  '两条 darwin 规则都引用不透明度旋钮（没有写死的百分比）',
  /var\(--dsh-sidebar-alpha-light\)/.test(css) && /var\(--dsh-sidebar-alpha-dark\)/.test(css),
);
check('亮暗两态分别绑定', /body\[data-ds-dark-theme\] div:has\(> \[data-slot="sidebar"\]\)/.test(css));
check(
  '行高统一为 32px（工作区 / 会话 / 更多会话 / 区段标题行）',
  /data-row-key\^="workspace:"\][\s\S]*?overflow:"\][\s\S]*?data-slot="sidebar\.workspaces"[\s\S]*?height: 32px/.test(css),
);
check(
  '面板行也压到 32px（官方是 min-height:36px + padding:7px 8px，收到 5px 才是 22+10）',
  /min-height:\s*32px;\s*\n\s*height:\s*32px;\s*\n\s*padding-top:\s*5px;\s*\n\s*padding-bottom:\s*5px;/.test(css),
);
check(
  '行高规则只动纵向（不含任何横向属性，不会横移图标/文字）',
  (() => {
    const start = css.indexOf('── 9. 行高统一为 32px');
    const end = css.indexOf('── 10.');
    const block = css.slice(start, end);
    return start > 0 && end > start && !/padding-(left|right)|margin|gap/.test(block);
  })(),
);
check(
  '两态文案分别指定（收起态保留官方字样）',
  /aria-expanded="true"\]::after[^}]*content: "收起"/s.test(css),
);

// ---- 13. idle 会话行补灰点 -------------------------------------------------
check(
  '灰点只在座位真空（:empty）时命中，别的插件占了座位就不画',
  /\[data-slot="sidebar\.session\.row\.leading"\]:empty/.test(css),
);
check(
  '灰点用官方 idle 状态色（不是槽位的文字灰）',
  /background:\s*var\(--dsw-alias-state-idle-primary\)/.test(css),
);
check(
  '灰点可见直径 6px（= 官方 .dot 10px × inset 20%）',
  /width:\s*6px;\s*\n\s*height:\s*6px;/.test(css),
);
check('灰点不参与行布局（flex:none，槽位宽度不变）', /content: "";\s*\n\s*flex:\s*none;/.test(css));

// ---- 15. 工作区之间的间距 4px → 8px ----------------------------------------
check(
  '跨工作区用稳定后缀匹配 groupSection（不碰哈希类名）',
  /\[data-slot="sidebar"\] \[class\*="groupSection"\] \+ \[class\*="groupSection"\]/.test(css),
);
check(
  '跨工作区间距 = 8px，且只写 margin-top（组内 2px / 标题行 4px 不动）',
  (() => {
    const start = css.indexOf('── 15. 工作区与工作区之间');
    const end = css.indexOf('/* 说明：会话/工作区区域');
    const block = css.slice(start, end);
    return start > 0 && end > start && /margin-top:\s*8px;/.test(block) && !/padding|height/.test(block);
  })(),
);

// ---- 14. 设置行右侧的设置入口（真实按钮） ------------------------------
check(
  '设置入口注册到 sidebar.footer.action（带 id）',
  registrations.length === 1 &&
    registrations[0].options.name === 'sidebar.footer.action' &&
    registrations[0].options.id === 'settings-entry',
  JSON.stringify(registrations.map((r) => r.options)),
);
check(
  '脚区改成一行两列：设置行在左、footerActions（入口）在右',
  /div:has\(> div > \[data-slot="sidebar\.settings"\]\)\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;/.test(
    css,
  ) &&
    /div:has\(> div > \[data-slot="sidebar\.settings"\]\)\s*>\s*:first-child\s*\{\s*grid-area:\s*1 \/ 2;/.test(css) &&
    /div:has\(> div > \[data-slot="sidebar\.settings"\]\)\s*>\s*:last-child\s*\{\s*grid-area:\s*1 \/ 1;/.test(css),
);
check(
  '入口按钮 28×28 / radius-sm（与「新建工作区」按钮同款）且自带 hover 底色',
  /\.dsh-settings-entry\s*\{[^}]*width:\s*28px;[^}]*height:\s*28px;[^}]*border-radius:\s*var\(--dsw-radius-sm\)/.test(
    css,
  ) && /\.dsh-settings-entry:hover\s*\{\s*background:\s*var\(--dsw-alias-interactive-bg-hover\);/.test(css),
);
check(
  '齿轮用官方 IconSettingsOutlineMedium 的 path 做遮罩（不是画出来的形状）',
  /--dsh-settings-gear:\s*url\("data:image\/svg\+xml,/.test(css) &&
    /mask:\s*var\(--dsh-settings-gear\) center \/ 16px 16px no-repeat/.test(css),
);
check(
  '收起态显式复位，且特异性压得住展开态那几条（写全 div:has(> [data-slot="sidebar"])）',
  /\[data-sidebar-collapsed\] div:has\(> \[data-slot="sidebar"\]\) \[data-slot="sidebar"\] > div > div:has\(> div > \[data-slot="sidebar\.settings"\]\)/.test(
    css,
  ) && /\[data-sidebar-collapsed\] \.dsh-settings-entry\s*\{\s*display:\s*none;/.test(css),
);
check(
  '点击走 registry.invoke 跑官方的 settings.open 命令（不进账号菜单）',
  (() => {
    const node = registrations[0]?.component();
    node?.props?.onClick?.();
    return invoked.length === 1 && invoked[0][0] === 'settings.open' &&
      invoked[0][1]?.modal === null && invoked[0][1]?.region === 'page';
  })(),
  JSON.stringify(invoked),
);

// ---- 2b. 折叠开关固定在红绿灯右侧 ----------------------------------------
check(
  '开关落点旋钮默认 88px（= 官方 .leadingSeat 的 left）',
  /--dsh-sidebar-toggle-left:\s*88px/.test(css),
);
check(
  '展开态 topStrip 主轴改为 flex-start，左内边距取该旋钮',
  /justify-content:\s*flex-start;\s*\n\s*padding-left:\s*var\(--dsh-sidebar-toggle-left\)/.test(css),
);
check(
  '开关规则排除全屏（全屏下浮层与 topStrip 已同为 left:12px）',
  /\[data-platform="darwin"\]:not\(\[data-fullscreen\]\)/.test(css),
);

// ---- 2. 新会话按钮：保留，但与面板行同款 ----------------------------------
check(
  '新会话按钮不再被隐藏（规则 1 之外没有 display:none）',
  !/\[data-slot="sidebar"\] > div > button[^{]*\{[^}]*display:\s*none/.test(css),
);
check(
  '新会话行的几何抄面板行：32px / padding 5px 8px / 圆角 radius-md（行高由规则 9 统一）',
  /\[data-slot="sidebar"\] > div > button\s*\{[^}]*height:\s*32px;[^}]*padding:\s*5px 8px;[^}]*border-radius:\s*var\(--dsw-radius-md\)/.test(
    css,
  ),
);
check(
  '新会话行左右外边距归零、下外边距 4px（= nav.panelList 的行间距）',
  /\[data-slot="sidebar"\] > div > button\s*\{[^}]*margin:\s*0 0 4px;/.test(css),
);
check(
  '新会话行底色 !important（压过 macOS 的 elevated 卡片底/hover 底）',
  /background:\s*transparent !important;/.test(css) &&
    /button:hover\s*\{\s*\n\s*background:\s*var\(--dsw-alias-interactive-bg-hover\) !important;/.test(css),
);
check(
  '新会话行的字体重量与面板行一致（500 → 400）',
  /\[data-slot="sidebar"\] > div > button\s*\{[^}]*font-weight:\s*400;/.test(css),
);
check(
  '内容左对齐 + 图标 16px 只在宽态生效（:has(> span) = 渲染了文字的那一态）',
  /button > span:first-child > span:has\(> span\)\s*\{[^}]*justify-content:\s*flex-start;/.test(css) &&
    /span:has\(> span\) > svg\s*\{[^}]*width:\s*16px;/.test(css),
);
check(
  '新会话行补了面板行同款 focus-visible 描边',
  /button:focus-visible\s*\{[^}]*outline-offset:\s*-2px;/.test(css),
);

// ---- unload + hot reload -------------------------------------------------
effects.forEach((e) => e.dispose());
check('卸载后移除 style', head[0]?.removed === true);

const effects2 = [];
const ctx2 = {
  effect: (fn, label) => effects2.push({ label, dispose: fn() }),
  slots: { inject: (key, callback) => effects2.push({ label: key, dispose: callback() }), register: () => () => {} },
  shortcuts: { invoke: () => {} },
};
mod.apply(ctx2);
const live = head.filter((el) => !el.removed).length;
check('热重载后不堆叠（live=1）', live === 1, `live=${live}`);
check('热重载后槽位只注册一次（inject 一次）', effects2.length === 2, effects2.map((e) => e.label).join(' | '));

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
