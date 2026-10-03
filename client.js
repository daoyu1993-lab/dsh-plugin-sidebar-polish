/**
 * dsh-plugin-sidebar-polish — browser half.
 *
 * Polishes the shipped left sidebar (`@deepseek-ai/dsh-client-ui-sidebar`):
 * it removes one row, redraws another, then aligns, re-colours and re-fills the
 * rest. The stylesheet below is the authority — this is only the index:
 *
 *   1.    the top brand row (fish mark + "deepseek HARNESS" + build badge) — removed
 *   2.    the "+ New Session" button — kept, drawn as one more row of the global
 *         panel list (Plugins / Skill-MCP / Schedules / 乔木 RSS) above it
 *   2b.   the collapse toggle pinned to the same point in both states
 *   3–9.  pill fill, indents, glyph-to-label gaps and hover states unified; every
 *         row (panel / new session / section title / workspace / session / overflow)
 *         set to one 32px height
 *   10–12. the fill tuned per theme (dark + light) and the gradient tint dropped
 *   13.   idle session rows get the grey status dot the shell omits them
 *   14.   a real settings-entry button on the account row
 *   15.   the gap between workspaces widened 4px → 8px
 *
 * WHY A STYLESHEET INSTEAD OF A COMPONENT
 * The sidebar shell owns those rows, and the only supported ways to replace them
 * are to register into the `sidebar` slot (which costs every child seat the shell
 * declares, including `sidebar.workspaces`) or to disable the shell outright.
 * A stylesheet keeps the shell, its seats and every occupant intact — the worst
 * possible failure mode is "the rules stop matching and the rows come back",
 * never a broken sidebar. It is also pure CSS, so no build step is required.
 *
 * WHY THESE SELECTORS
 * Every class name in DSH is a CSS-module hash (`_3WPZCG_logoRow`) that changes
 * per build, so class selectors are unusable. Two build-stable anchors are used
 * instead:
 *
 *   - the renderer wraps every slot outlet in `<div data-slot="KEY">`
 *     (`@deepseek-ai/dsh-client-ui-renderer/lib/client.js`);
 *   - the shell's `logoRow` / `topStrip` carry `data-window-drag`.
 *
 * Rule 1 matches the drag row **only while it renders the expanded brand
 * identity** (`sidebar.brand.name`, which the shell renders only when wide).
 * That is deliberate: in the 56px rail the same row holds the expand button, so
 * a blanket `display:none` would trap the user in the collapsed state on the Web
 * surface. Keying on the brand-name slot makes the rule self-disabling in the
 * rail.
 *
 * Rule 2 matches the root's only direct-child `<button>`: the New Session
 * control. The collapse toggle lives inside `logoRow`/`topStrip`, and panel rows
 * inside `<nav>`, so neither is touched (`Tooltip` clones its child and adds no
 * wrapper element). It keeps that button — the shell's own rendering is a 38px
 * bordered "elevated" card, which next to the flat panel rows below it reads as
 * a card sitting on top of a list; the rule re-draws it as one more list row.
 *
 * Rule 2b pins the collapse toggle (the panel icon) in the expanded sidebar to
 * the exact spot the shipped overlay uses when the sidebar is fully hidden on
 * macOS: a collapsed macOS sidebar is 0px wide (`collapsedWidth = 0`, no rail),
 * so the shell hands the toggle to the frame's `shell.leading` seat
 * (`HeaderLeadingControls`), whose host is absolutely placed at
 * `top: 11px; left: 88px` — beside the traffic lights. The expanded strip is
 * pushed to the far right by `justify-content: flex-end` instead, so the same
 * button used to jump 152px sideways on every toggle. The rule turns the strip
 * around (`flex-start`) and gives it the overlay's left offset, which lands the
 * button on the identical box (`x 88..116`, `y 11..39`). Fullscreen is excluded
 * because the overlay and the strip already agree at `left: 12px` there.
 *
 * Rule 3 aligns the global panel rows (Plugins / Schedules / …) with the
 * workspace and session pills below them. Those rows carry `margin: 0 2px`, so
 * their pill sits 14px from the column edge while every list pill sits at 12px;
 * zeroing the margin lines them up (and moves their glyph from 22px to 20px,
 * matching the workspace folder icons).
 *
 * All of them were verified against a DOM replica of the shell's JSX across
 * web/darwin x expanded/collapsed x with/without global panels, and the geometry
 * was measured in a real browser against the shipped stylesheets.
 *
 * Requires `:has()` (Chrome 105+/Safari 15.4+); if a runtime ever lacked it,
 * rule 1 silently stops matching and the brand row reappears — nothing breaks.
 *
 * Envelope: DSH browser bundles register themselves on the injected
 * `window.__ModuleLoader__` facade keyed by package id; the loader then calls
 * `apply(ctx)` and reads `inject` for service gating.
 */

window.__ModuleLoader__.load({
	id: 'dsh-plugin-sidebar-polish',
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

		/** Only the one real component (rule 14) needs React; the rest is a stylesheet. */
		const React = require('react');

		/** Plugin id, reused as the stylesheet owner marker. */
		const PLUGIN_ID = 'dsh-plugin-sidebar-polish';

		const CSS = `
/* ── 1. 顶部品牌行 ────────────────────────────────────────────────
   只在渲染了品牌标识（sidebar.brand.name，仅展开态）时命中；
   收起态不命中，56px 轨道里的展开按钮因此得以保留。 */
[data-slot="sidebar"] > div > div[data-window-drag]:has([data-slot="sidebar.brand.name"]) {
  display: none !important;
}

/* ── 2. 新会话按钮：与全局面板行（插件 / Skill-MCP / …）同款的列表行 ──
   sidebar 根容器唯一的直接子 <button>（折叠开关在 topStrip 里、品牌行按钮在
   logoRow 里，都不是直接子元素，所以不受影响）。

   官方把它画成一张独立卡片：38px 高、0.5px 描边、elevated 半透明底、内容居中、
   下外边距 12px。品牌行（规则 1）去掉后它正好落在 nav 那组面板行的上面 ——
   一张卡片 + 一份列表并排，看起来是两种东西。这里把它改成与面板行同款的一行：
   32px 胶囊（高度与上下内边距由规则 9 统一）、无描边无底色、图标 16px、
   图标→文字 8px、文字落在 40px 垂线、hover 用同一个 --dsw-alias-interactive-bg-hover。

   · 左右外边距 0：与规则 3 处理过的面板行同边距（pill 左边缘由规则 6 的
     8px 内边距决定）；下外边距 4px = nav.panelList 的行间距，于是它与面板行
     之间的间距和面板行彼此之间完全一样，读起来是同一份列表。
   · 底色必须用 !important：官方在 macOS 上给的是 elevated 半透明底
     （#ffffff8c / 暗色 #ffffff26，hover 另有两条），选择器是
     [data-platform=darwin] .newSession 这类 2~4 层，普通规则压不过。
     作用域只有这一个按钮；展开态与收起态要的都是「无底色 + hover 底色」，
     所以收起态（56px 轨道 / Windows 折叠）不需要再写复位。
   · 行内几何按 .panelRow 抄：border-radius 本就是同一个 --dsw-radius-md，
     高度与上下内边距也跟面板行同步（规则 9：5px + 22px 行高 = 32px），
     所以这里的 32px / 5px 与规则 9 写的是同一个值 —— 规则 9 负责「所有行一样高」，
     这一条负责「这一行长什么样」，两处一致才不会谁盖过谁产生疑义。
   · 内容左对齐：官方把内容居中（.newSessionContent{justify-content:center;
     width:100cqw}），要改成 flex-start + width:auto。
     两条内容规则都用 :has(> span) 限定，因为**只有宽态才渲染文字 span**
     （宽态 = 展开，或收起动画的前 150ms；收起态的轨道里只有图标）——
     于是轨道里的 36×36 居中图标与 18px 图标尺寸一字不动。
     图标同理：宽态 14px → 16px（与面板行的 16px 图标同尺寸），收起态保持官方值。
   · 快捷键键帽保留（只在 hover 显示，静止态不可见，不影响与列表行的对齐）；
     官方 .newSession 没有 focus-visible 描边，这里补上面板行同款。 */
[data-slot="sidebar"] > div > button {
  height: 32px;
  min-height: 32px;
  margin: 0 0 4px;
  padding: 5px 8px;
  border: none;
  border-radius: var(--dsw-radius-md);
  background: transparent !important;
  color: var(--dsw-alias-label-primary);
  font-weight: 400;
}
[data-slot="sidebar"] > div > button:hover {
  background: var(--dsw-alias-interactive-bg-hover) !important;
}
[data-slot="sidebar"] > div > button:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -2px;
}
[data-slot="sidebar"] > div > button > span:first-child > span:has(> span) {
  justify-content: flex-start;
  width: auto;
  gap: 8px;
}
[data-slot="sidebar"] > div > button > span:first-child > span:has(> span) > svg {
  width: 16px;
  height: 16px;
}

/* ── 2b. 折叠开关（面板图标）固定到红绿灯右侧，展开/收起同一位 ────────
   macOS 桌面端收起侧栏时，布局层直接把整列宽度归 0
   （AppFrame：collapsedWidth = darwin ? 0 : 56，即「收起 = 整列隐藏，没有轨道」），
   这时开关由侧栏之外的官方浮层接管：HeaderLeadingControls 渲染在
   .leadingSeat{position:absolute; top:11px; left:88px} 里，正好落在红绿灯右侧。
   展开态开关仍由侧栏自己的 topStrip 承载，官方给它 justify-content:flex-end，
   于是被推到侧栏最右边（280px 列，实测按钮 x = 240..268、中心 254）。

   同一个按钮两个落点 —— 展开/收起时横向跳 152px。这条规则把展开态也钉到浮层的
   落点：主轴 flex-end → flex-start，左内边距 = 浮层的 left（88px 旋钮）。

   垂直方向本来就相等，不用动：topStrip 高 52px、下内边距 2px、align-items:center
   → 按钮 y = 11..39；浮层 top:11px + 按钮 28px → y = 11..39。实测两者的图标中心
   都在 y = 24.75，只有 x 不同。

   必须排除全屏：那时没有红绿灯，官方把浮层挪到 left:12px、topStrip 也改成
   flex-start（按钮已经落在 x = 12..40，两态本来就重合），不排除会被推右。

   选择器用「sidebar 根容器的第一个子元素」定位 topStrip：它只在 darwinDesktop
   下渲染，而 isDarwinDesktop() 就是读 [data-platform="darwin"]（同一个属性），
   两者同义，所以 Web 端永远不会命中这一条（那里第一个子元素是品牌行）。 */
html[data-platform="darwin"]:not([data-fullscreen]) [data-slot="sidebar"] > div > :first-child {
  --dsh-sidebar-toggle-left: 88px;   /* ← 与官方 .leadingSeat 的 left 同值；上游若改要同步 */
  justify-content: flex-start;
  padding-left: var(--dsh-sidebar-toggle-left);
}

/* ── 3. 全局面板行（插件 / 自动化任务 / …）─────────────────────────
   官方给这些行留了 margin: 0 2px，pill 因此比列表 pill 多内缩 2px；
   归零后两类 pill 左右相等（绝对值由规则 6 决定）。
   gap 统一为 8px —— 三种行的「图标→文字」间距一致，文字才会同线（40px）。 */
[data-slot="sidebar"] > div > nav > button {
  margin-left: 0;
  margin-right: 0;
  gap: 8px;
}

/* ── 4. 工作区行（DSH UI Lab / Pico / …）─────────────────────────
   图标→文字间距同 8px（官方 6px）。 */
[data-slot="sidebar"] [data-row-key^="workspace:"] {
  gap: 8px;
}

/* ── 5. 会话行：图标→文字间距同 12px ──────────────────────────────
   官方这里不是 flex gap（行 gap:0 + 标题 margin-left:4px），所以只能改标题自己的
   左外边距 —— 直接给行加 gap 会把标题与时间戳之间也撑开。
   标题恒为行的第 2 个子元素（第 1 个是状态/图标槽），故用结构选择器，不碰哈希类名。 */
[data-slot="sidebar"] [data-row-key^="session:"] > span:nth-child(2) {
  margin-left: 8px;
}

/* ── 6. 整体左右内边距：12px → 8px ────────────────────────────────
   官方把这个值写在根元素自己身上（--dsh-sidebar-inline-padding: 12px），
   所以必须命中同一个元素才能覆盖（[data-slot] 属性的特异性高于 lone class）。
   它一处决定三件事：
     · 行 pill 的左右外边距     12px → 8px
     · 面板行 pill 的左右外边距  12px → 8px
     · 工作区的 edge-inset（含 scrollbar-gutter 预留算法，仍然左右对称）
   图标随之外移：20px → 16px。 */
[data-slot="sidebar"] > div {
  --dsh-sidebar-inline-padding: 8px;
}

/* ── 7. 「展开其余 N 个会话」按钮：与上方会话行同款 ────────────────
   官方：高 28px、字号 12px、小圆角、hover 只变色不加底、文字起点 36px。
   这里对齐成与行一致：字号 14px、圆角 12px、同款 hover 底色、
   文字起点 40px（padding-left 32px = 行内边距 8 + 图标 16 + 间距 8）；
   高度由规则 9 统一。

   文案由 i18n 生成，且同一个按钮复用「展开 / 收起」两态，所以：
     · 用 font-size: 0 隐藏官方文字（文本仍在 DOM 里，屏幕阅读器仍能读到计数）；
     · 用 ::after 显示新文案，并以 aria-expanded 区分两态。
   选择器用 button[...] 是为了压过官方的 margin-top: 0（同特异性时靠声明顺序，
   不可靠），元素选择器让特异性明确更高。 */
[data-slot="sidebar"] button[data-row-key^="overflow:"] {
  margin-top: 2px;
  padding-left: calc(32px + var(--dsh-workspace-indent, 0px));
  border-radius: var(--dsw-radius-md);
  font-size: 0;
}
[data-slot="sidebar"] button[data-row-key^="overflow:"]::after {
  content: "更多会话";
  font-size: 14px;
}
[data-slot="sidebar"] button[data-row-key^="overflow:"][aria-expanded="true"]::after {
  content: "收起";
}
[data-slot="sidebar"] button[data-row-key^="overflow:"]:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

/* ── 8. 「工作区」区段标题：左内边距 4px → 8px ─────────────────────
   目标：标题与它下面那组图标落在同一条 16px 垂线上
   （官方 12px = pill 内边距 8 + 标题行内边距 4）。
   标题行没有专属标记，就用「工作区区域根元素的第一个子元素」定位 ——
   展开态与收起态它都是区段标题行。
   收起态官方把该行的 padding-left 归零（轨道里只剩图标按钮），
   所以显式复位，免得把轨道图标推右 8px。 */
[data-slot="sidebar.workspaces"] > div > :first-child {
  padding-left: 8px;
}
[data-sidebar-collapsed] [data-slot="sidebar.workspaces"] > div > :first-child {
  padding-left: 0;
}

/* ── 9. 行高统一为 32px ──────────────────────────────────────────
   官方四档不一：面板行 36、区段标题行 36、工作区行 34、会话行 32
   （「更多会话」按钮 28）。全部统一到 32px（= 官方会话行的原生高度）。
   行内内容都是垂直居中的，所以只是上下留白变化，图标与文字的基线不动：
   横向那三条对齐线（8 / 16 / 40）不受影响。

   面板行要比别人多一点：官方不是用 height，而是 min-height:36px + padding:7px 8px
   （行高 22px）撑出来的 —— 只改 height 会把 22px 的文字夹在 18px 的内容盒里。
   把上下内边距收到 5px，正好 22 + 5 + 5 = 32px。

   「新会话」行（规则 2 把它做成面板行同款的一行）也在这一组里：选择器
   > div > button 与规则 2 同特异性，本规则在样式表里更靠后，所以压得住它的 36px。
   两个规则的分工：规则 2 管「长什么样」，规则 9 管「多高」。

   注意轨道（收起态 56px）：官方给轨道里的面板行单独写了
   ._3WPZCG_collapsed ._3WPZCG_panelRow{width:36px;height:36px;padding:0}，
   它比本规则的选择器特异性高，所以轨道里的方形图标按钮仍是 36×36，不会被压小；
   新会话按钮在轨道里同理（规则 2 的宽态几何用 :has(> span) 限定，规则 9 的
   height 被官方 ._3WPZCG_collapsed ._3WPZCG_newSession 的 36×36 压过）。 */
[data-slot="sidebar"] [data-row-key^="workspace:"],
[data-slot="sidebar"] [data-row-key^="session:"],
[data-slot="sidebar"] button[data-row-key^="overflow:"],
[data-slot="sidebar.workspaces"] > div > :first-child {
  height: 32px;
}
[data-slot="sidebar"] > div > nav > button,
[data-slot="sidebar"] > div > button {
  min-height: 32px;
  height: 32px;
  padding-top: 5px;
  padding-bottom: 5px;
}

/* ── 10. 侧边栏底色：四个旋钮（基色 × 不透明度，暗/亮各一套）─────
   底色不是外壳画的，而是「布局的侧栏列」画的，macOS 下是两层叠加：
     顶层 linear-gradient(#7a9bf0…, #8f89b8…)        ← 顶部淡蓝、底部淡紫的染色
     底层 color-mix(in srgb, <基色> <不透明度>, transparent) ← 半透明，透出窗口毛玻璃
   基色就是 --dsw-specific-sidebar-fill（暗色 #1b1b1c / 亮色 #f9fafb）。
   外壳 _3WPZCG_root 也用它，但 [data-platform=darwin] 下外壳的底色被置为 0 0。

   这里把基色与不透明度都显式化成变量（规则 12 引用），想微调只改这四行。

   官方原值 → 现在，两态都取「中栏对话区的 --dsw-alias-bg-base」：
     暗色 #1b1b1c（bluish-900）  → #151517（bluish-950）＝ 对话区底色   不透明度 50% → 50%（未动）
     亮色 #f9fafb（bluish-50）   → #ffffff（bluish-00） ＝ 对话区底色   不透明度 40% → 90%
   亮色必须连不透明度一起改：macOS 的窗口材质（vibrancy: "sidebar"）是浅灰的，
   40% 的基色压不住它 —— 只换基色实测只从 rgb(227,227,228) 走到 rgb(229,227,228)（对话区是
   rgb(255,255,255)），肉眼不可见；90% 时落到 ≈rgb(247,248,250)，两栏才真正贴近。

   注意：基色先被 color-mix 稀释，所以**观感变化比输入的色差更柔和**；亮色尤其如此，最终
   颜色 = 不透明度 × 基色 + (1 − 不透明度) × 窗口材质。

   作用域用 div:has(> [data-slot="sidebar"]) 锁在侧栏列上（座位锚点是它的直接子元素），
   避免影响同样用到这个 token 的其它界面。 */
div:has(> [data-slot="sidebar"]) {
  --dsh-sidebar-fill-dark: #151517;   /* ← 暗色基色 = 对话区 --dsw-alias-bg-base（官方原值 #1b1b1c） */
  --dsh-sidebar-fill-light: #ffffff;  /* ← 亮色基色 = 对话区 --dsw-alias-bg-base（官方原值 #f9fafb = bluish-50） */
  --dsh-sidebar-alpha-dark: 50%;      /* ← 暗色不透明度（官方值，未改） */
  --dsh-sidebar-alpha-light: 90%;     /* ← 亮色不透明度（官方 40%；提到 90% 才压得住窗口的浅灰材质） */
  --dsw-specific-sidebar-fill: var(--dsh-sidebar-fill-light);
}
body[data-ds-dark-theme] div:has(> [data-slot="sidebar"]) {
  --dsw-specific-sidebar-fill: var(--dsh-sidebar-fill-dark);
}

/* ── 12. 去掉侧栏的渐变染色，只保留半透明基色 ────────────────────
   官方在 macOS 下给侧栏列叠了两层：一层写死的 linear-gradient（顶部 #7a9bf0 淡蓝、
   底部 #8f89b8 淡紫）+ 一层半透明基色。这里只去掉渐变那一层，逐态复刻官方的基色算法，
   因此半透明观感与"减少透明度"无障碍偏好都不受影响。

   注意必须逐态覆盖：我的普通规则特异性高于官方那条 @media (prefers-reduced-transparency)
   里的规则，不显式复刻的话会把该偏好顶掉。
   该偏好分支仍是官方的 90%（暗色下把 50% 提到 90%；亮色现在本身就是 90%，等价）。 */
[data-platform="darwin"] div:has(> [data-slot="sidebar"]) {
  background: color-mix(in srgb, color-mix(in srgb, var(--dsw-specific-sidebar-fill) 97%, #7a9bf0) var(--dsh-sidebar-alpha-light), transparent);
}
[data-platform="darwin"] [data-ds-dark-theme] div:has(> [data-slot="sidebar"]) {
  background: color-mix(in srgb, var(--dsw-specific-sidebar-fill) var(--dsh-sidebar-alpha-dark), transparent);
}
@media (prefers-reduced-transparency: reduce) {
  [data-platform="darwin"] div:has(> [data-slot="sidebar"]) {
    background: color-mix(in srgb, var(--dsw-specific-sidebar-fill) 90%, transparent);
  }
}

/* ── 11. 激活工作区的文件夹图标：去掉蓝色强调，改用与文字同色 ──────
   官方 .folderActive{color:var(--dsw-alias-state-business-primary)}（蓝色强调）。
   这个「激活」态没有稳定属性标记，只有 CSS Modules 的构建哈希类名。
   但该类名的形式是 <构建哈希>_folderActive —— 前半段每次构建都变，后半段来自
   源文件的 key（已核对映射表 "folderActive": "jJkEga_folderActive"），跨版本稳定。
   所以用 [class*=] 匹配后缀，比写死完整类名安全得多；
   万一上游重命名该 key，规则静默失效（只是变回蓝色），不会影响别的东西。
   color:inherit 让它跟随行自身的文字色，将来主题调整也不会脱节。 */
[data-slot="sidebar"] [class*="folderActive"] {
  color: inherit;
}

/* ── 13. 无状态（idle）的会话行：左侧 16px 槽位补一个灰色圆点 ──────
   官方只为「有状态」的会话画点：primary 状态不是 idle 时渲染 StateDot
   （done 绿 10px / warning 琥珀 10px / ongoing 14px 转圈）；一旦是 idle
   （不忙、没有待审批、没有子代理、没有完成提醒），槽位里只剩
   sidebar.session.row.leading 座位本身（默认空），于是行首什么都不画 ——
   同一列里只有一部分行有圆点，左侧这一列看起来是断的。
   需求：无状态时也画一个点，尺寸与官方彩色点一致。

   为什么用 CSS 而不是往座位里注册组件：
     · 座位（kind:list）是留给别的插件放「环境标记」的（官方注释里说的
       ambient automation mark），占用它会和那些标记并排出现两个东西；
     · 纯 CSS 的最坏结果是「规则不再命中，圆点消失」，回到官方行为。

   为什么选择器能精确命中「idle」：
     div[data-slot="sidebar.session.row.leading"] 是渲染器给该座位包的锚点
     （display:contents，只在会话行里渲染）。官方分支是
       !archived && !blank && primary !== idle  → 渲染 StateDot
       !archived && !blank && primary === idle  → 渲染该座位锚点
     所以「锚点存在」本身就等价于 idle，再用 :empty 确认没有被别的插件占用。
     归档行与「新会话」占位行根本不渲染这个锚点，天然不命中 —— 官方要求这两类
     行的槽位保持空白，规则不改变它。

   尺寸与位置为什么与彩色点一致：
     官方 .dot 是 10px 的槽内盒子，颜色画在 ::after{inset:20%} 上 —— 实际可见
     圆 = 10px × 60% = 6px。槽位自己是 inline-flex + center/center，6px 与 10px
     的盒子同心，所以这里直接画 6px 的圆：可见直径与圆心都与彩色点重合。
     颜色用官方 idle 状态色（亮 #d4d4d4 / 暗 #545557），不是槽位的文字灰。 */
[data-slot="sidebar"] [data-row-key^="session:"] > span:has(> [data-slot="sidebar.session.row.leading"]:empty)::after {
  content: "";
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsw-alias-state-idle-primary);
}


/* ── 14. 设置行右侧的设置入口：一个真实按钮 ───────────────────────
   sidebar.settings 座位渲染的第一行（.triggerRow）左边是头像 + 名字，整行是一个按钮
   —— 有账号插件时它是账号菜单的触发者，没有时是官方那个直接打开设置的回退按钮。
   官方在这行的右侧留白。

   这一条和前面 13 条不同：它要的不只是「看起来像」，而是**一个自己的热区**（点齿轮
   只开设置，不该弹出账号菜单），所以齿轮是 sidebar.footer.action 座位里的一个真实
   <button>（见下面 apply 里的注册），由这段样式排到设置行的右端：

     · 「脚区」从官方的「竖排两行」改成「一行两列」：设置行占第 1 列，
       footerActions（我们的按钮就在里面）占第 2 列。两者同一行、align-items:center
       所以按钮自动落在设置行的垂直中线上，不需要写死任何高度 —— 官方那行是 44px
       还是 32px（未登录）都不影响（行的上下外边距是对称的，中线就是行中心）。
     · 设置行因此让出第 2 列的宽度（28px + 4px 间隙）：头像 + 名字照旧左对齐，
       它的 hover 胶囊止步于两列之间的间隙之前 —— 齿轮有自己独立的 hover 底色，
       两个热区不重叠、互不触发。
     · 按钮 28×28 / --dsw-radius-sm / label-secondary / hover
       interactive-bg-hover，与工作区区段标题上的「新建工作区」按钮同款。
       第 2 列宽就是 28px，右缘落在「侧栏列 − 8px」，图标中心 = 列宽 − 22px，
       与「新建工作区」按钮的图标落在同一条垂线上。
     · 齿轮图标是官方 IconSettingsOutlineMedium 的 path 做的遮罩（16px / 1.3 描边），
       画在按钮的 ::after 上 —— 按钮自己的底色留给 hover 胶囊。 */
div:has(> [data-slot="sidebar"]) {
  /* ← 官方 IconSettingsOutlineMedium 的 path，逐字抄自
       @deepseek-ai/dsh-client-ui-primitives（viewBox 0 0 16 16 / stroke 1.3） */
  --dsh-settings-gear: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='16'%20height='16'%20viewBox='0%200%2016%2016'%20fill='none'%20stroke='%23000'%20stroke-width='1.3'%3E%3Cpath%20d='M8%209.75012C8.9665%209.75012%209.75%208.96662%209.75%208.00012C9.75%207.03362%208.9665%206.25012%208%206.25012C7.0335%206.25012%206.25%207.03362%206.25%208.00012C6.25%208.96662%207.0335%209.75012%208%209.75012Z'/%3E%3Cpath%20d='M13.0107%207.79377C12.9505%207.89401%2012.9205%207.94413%2012.9205%207.99951C12.9205%208.0549%2012.9505%208.10502%2013.0106%208.20528L13.9849%209.83006C14.045%209.93029%2014.0751%209.9804%2014.0751%2010.0358C14.0751%2010.0911%2014.045%2010.1413%2013.9849%2010.2415L13.0037%2011.8777C12.9468%2011.9726%2012.9184%2012.0201%2012.8725%2012.0461C12.8267%2012.072%2012.7713%2012.072%2012.6607%2012.072H10.6704C10.5598%2012.072%2010.5045%2012.072%2010.4586%2012.098C10.4128%2012.1239%2010.3843%2012.1714%2010.3274%2012.2662L9.33825%2013.9142C9.28133%2014.009%209.25287%2014.0564%209.20703%2014.0823C9.16118%2014.1083%209.10588%2014.1083%208.99529%2014.1083H7.00486C6.89426%2014.1083%206.83896%2014.1083%206.79312%2014.0823C6.74727%2014.0564%206.71881%2014.009%206.6619%2013.9142L5.67273%2012.2662C5.61581%2012.1714%205.58735%2012.1239%205.54151%2012.098C5.49566%2012.072%205.44036%2012.072%205.32977%2012.072H3.33945C3.2288%2012.072%203.17347%2012.072%203.12761%2012.0461C3.08176%2012.0201%203.0533%2011.9726%202.9964%2011.8777L2.0152%2010.2415C1.9551%2010.1413%201.92505%2010.0911%201.92505%2010.0358C1.92505%209.9804%201.9551%209.93029%202.0152%209.83006L2.98951%208.20528C3.04963%208.10502%203.07969%208.0549%203.07969%207.99951C3.07968%207.94413%203.04961%207.89401%202.98946%207.79377L2.01529%206.17011C1.95514%206.06987%201.92507%206.01975%201.92507%205.96437C1.92506%205.90899%201.95512%205.85886%202.01524%205.7586L2.9964%204.1224C3.0533%204.0275%203.08176%203.98005%203.12761%203.95408C3.17347%203.92811%203.2288%203.92811%203.33945%203.92811H5.32977C5.44036%203.92811%205.49566%203.92811%205.54151%203.90216C5.58735%203.87621%205.61581%203.82879%205.67273%203.73397L6.6619%202.08599C6.71881%201.99116%206.74727%201.94375%206.79312%201.9178C6.83896%201.89185%206.89426%201.89185%207.00486%201.89185H8.99529C9.10588%201.89185%209.16118%201.89185%209.20703%201.9178C9.25287%201.94375%209.28133%201.99116%209.33825%202.08599L10.3274%203.73397C10.3843%203.82879%2010.4128%203.87621%2010.4586%203.90216C10.5045%203.92811%2010.5598%203.92811%2010.6704%203.92811H12.6607C12.7713%203.92811%2012.8267%203.92811%2012.8725%203.95408C12.9184%203.98005%2012.9468%204.0275%2013.0037%204.1224L13.9849%205.7586C14.045%205.85886%2014.0751%205.90899%2014.0751%205.96437C14.0751%206.01975%2014.045%206.06987%2013.9849%206.17011L13.0107%207.79377Z'/%3E%3C/svg%3E");
}
div:has(> [data-slot="sidebar"]) [data-slot="sidebar"] > div > div:has(> div > [data-slot="sidebar.settings"]) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 4px;
}
div:has(> [data-slot="sidebar"]) [data-slot="sidebar"] > div > div:has(> div > [data-slot="sidebar.settings"]) > :first-child {
  grid-area: 1 / 2;   /* footerActions：设置入口所在的那一列 */
}
div:has(> [data-slot="sidebar"]) [data-slot="sidebar"] > div > div:has(> div > [data-slot="sidebar.settings"]) > :last-child {
  grid-area: 1 / 1;   /* settingsArea：账号行 */
}
.dsh-settings-entry {
  box-sizing: border-box;
  position: relative;
  flex: none;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--dsw-radius-sm);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.dsh-settings-entry::after {
  content: "";
  position: absolute;
  inset: 6px;                        /* 28 − 16 = 12，16px 图标居中 */
  background-color: currentColor;
  -webkit-mask: var(--dsh-settings-gear) center / 16px 16px no-repeat;
  mask: var(--dsh-settings-gear) center / 16px 16px no-repeat;
}
.dsh-settings-entry:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-settings-entry:focus-visible {
  outline: var(--dsh-focus-ring-width) solid var(--dsh-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -2px;
}
/* 收起态（Web/Windows 的 36px 轨道）：脚区复位成官方的竖排，入口不显示 ——
   轨道里的账号行本身就是设置符号。复位规则要写全 div:has(> [data-slot="sidebar"])，
   否则特异性比上面那几条低一级，压不住。 */
[data-sidebar-collapsed] div:has(> [data-slot="sidebar"]) [data-slot="sidebar"] > div > div:has(> div > [data-slot="sidebar.settings"]) {
  display: flex;
  flex-direction: column;
  align-items: center;
  column-gap: 0;
}
[data-sidebar-collapsed] .dsh-settings-entry {
  display: none;
}

/* ── 15. 工作区与工作区之间：4px → 8px ─────────────────────────────
   列表里每一个工作区是一个 .groupSection（工作区行 + 它的会话行）。官方用
   「.groupSection + .groupSection{margin-top:4px}」分组，而组内相邻行是 2px
   —— 4px 只比组内大一倍，分组读不出来。这里把跨组间距提到 8px（组内行距的 4 倍）；
   组内 2px 与「区段标题行 → 第一个工作区」的 4px 都不动。

   选择器只能用后缀匹配：类名是 CSS Modules 哈希（_7514NG_groupSection），
   前半段每次构建都变、后半段来自源文件的 key，跨版本稳定（与规则 11 的
   folderActive 同一套路）。三个属性段的特异性高于官方那条两类的规则，
   不需要 !important；上游若重命名该 key，规则静默失效（回到 4px）。 */
[data-slot="sidebar"] [class*="groupSection"] + [class*="groupSection"] {
  margin-top: 8px;
}

/* 说明：会话/工作区区域自身是 flex:1，品牌行消失后会自动补位，因此不需要额外的
   布局规则；新会话行是固定高度的 flex:none 项，只把列表整体往下推 36px
   （32px 行 + 4px 行间距），与它上方 / 下方的间距同款。
   收起态的轨道图标行保持不变（新会话按钮在轨道里仍是官方的 36×36 图标按钮，
   规则 2 的几何与内容对齐都只作用于宽态）。 */
`;

		/**
		 * Install the stylesheet; `ctx.effect` removes it again on unload and
		 * re-runs on hot reload, so iterations never stack duplicate tags.
		 * @param ctx - client root context.
		 */
		/**
		 * Open the settings panel the way the shipped ⌘, does.
		 *
		 * `ui-settings-general` registers the `settings.open` command inside its `sidebar.settings`
		 * inject — the same command ⌘, is bound to. The **service** (`ctx.shortcuts`) only exposes
		 * register/edit/describe; the "run it without a keystroke" entry (`invoke(id, context)`)
		 * lives on the `ShortcutRegistry` the service owns, which is what the native menu bridge
		 * uses for a menu click (`registry.invoke(input.commandId, context)`).
		 *
		 * The context is the same shape the DOM/native handlers build: `modal: null` = no modal is
		 * open, `region: 'page'` = focus is outside the terminal/editable. With `modal: null` the
		 * settings command's own `resolve` runs `…actions.open()` — exactly like ⌘,.
		 *
		 * Nothing here reads or writes the settings store: if the command is ever renamed, the click
		 * becomes a no-op instead of breaking anything.
		 * @param ctx - client root context (needs the `shortcuts` service).
		 */
		function openSettings(ctx) {
			const registry = ctx.shortcuts?.registry;
			if (registry === void 0 || typeof registry.invoke !== 'function') return;
			registry.invoke('settings.open', { modal: null, region: 'page' });
		}

		/**
		 * Install the stylesheet and the one real component the plugin owns.
		 *
		 * The stylesheet is the whole plugin: removing it restores the shipped sidebar. The
		 * component is rule 14's settings entry — a button with its own hit area, rendered into
		 * the shell's `sidebar.footer.action` seat and laid out next to the account row by CSS.
		 * It has to be an element (not a pseudo-element) precisely because it must be its own
		 * hot zone: clicking it opens the settings panel, while clicking the rest of the row
		 * still opens the account menu.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			ctx.effect(
				() => {
					const tag = document.createElement('style');
					tag.dataset.plugin = PLUGIN_ID;
					tag.textContent = CSS;
					document.head.appendChild(tag);
					return () => tag.remove();
				},
				'sidebar-polish: styles',
			);

			const SettingsEntry = () =>
				React.createElement('button', {
					type: 'button',
					className: 'dsh-settings-entry',
					'aria-label': '设置',
					onClick: () => openSettings(ctx),
				});

			ctx.slots.inject('sidebar.footer.action', () =>
				ctx.slots.register(
					{
						name: 'sidebar.footer.action',
						id: 'settings-entry',
					},
					SettingsEntry,
				),
			);
		}

		exports.apply = apply;
		/** `slots` for the settings entry; `shortcuts` for the `settings.open` command it runs. */
		exports.inject = ['slots', 'shortcuts'];
		return module.exports;
	},
});
