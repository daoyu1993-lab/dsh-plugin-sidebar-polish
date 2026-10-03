# DSH 侧边栏现状调研

> 目标：为「写一个重新定义 DSH 侧边栏 UI 与功能的插件」建立事实基线。
> 调研对象：本机安装的 DeepSeek Harness 桌面版 **0.2.0-rc.2**（`@deepseek-ai/dsh-desktop-runtime`）。
> 所有结论都标注了来源；`[实证]` 表示我用脚本在本机跑出来的结果，`[文档]` 表示包内 README，`[代码]` 表示读打包后的实现。

---

## 0. 一句话结论

**DSH 的「侧边栏」不是一个组件，而是三个层次拼出来的插件组合：**

1. `dsh-client-ui-layout` 声明一个三栏骨架，并开出三个「座位」：`sidebar`（左栏）、`main`（中栏，keyed）、`rightbar`（右栏）。
2. `dsh-client-ui-sidebar` 占住 `sidebar` 座位，渲染导航壳（品牌行 / 新建会话 / 全局面板入口 / 工作区区域 / 底部设置），**并在自己的注册里声明 7 个子座位**。
3. `dsh-client-ui-workspace`、`dsh-client-ui-settings`、`dsh-client-ui-plugin-manager` 等插件再填进那 7 个子座位。

所以「重新定义侧边栏 UI」在 DSH 里是一件**一等公民能力**：只要写一个新插件接管 `sidebar` 座位，就能整体替换外观而保留全部既有功能。代价和边界见 §7 —— 其中最关键的一条是：**接管者无法「继承」官方外壳声明的子座位**，所以完整替换必须把官方外壳从组合里摘掉。

另外两点先说清楚：

- **右侧栏是另一个独立体系**（`dsh-client-ui-sidebar-right` + `dsh-client-ui-dockkit`），和左侧栏只共享布局列，不共享代码。
- **你机器上装了第三方插件 `dsh-better-sidebar@0.21.1`，但它当前是「装了但没生效」的状态**：不在 `dsh.profile.bundles` 里，而且被 peer 版本闸门在启动时拒绝加载（详见 §9.1）。所以**现在你看到的右侧栏是官方原版**，没有和任何第三方重叠——两条侧边栏都还没被人改造过。

---

## 1. 相关包与角色

版本统一为 `0.2.0-rc.2`（来自 app.asar 内 `/dsh/package.json`）。

| 包 | 角色 | 关键导出 |
|---|---|---|
| `dsh-client-ui-layout` | 三栏骨架所有者、`ctx.layout` 服务、主题呈现 | `sidebar` / `main` / `rightbar` / `shell.overlay` / `shell.leading` 五个座位 |
| `dsh-client-ui-sidebar` | **左侧栏外壳** | 占 `sidebar`，声明 7 个子座位 |
| `dsh-client-ui-workspace` | **侧边栏内容**：工作区/会话浏览器 | 占 `sidebar.workspaces`；`ctx.uiWorkspace` 服务 |
| `dsh-client-ui-settings` | 设置入口行 | 占 `sidebar.settings` |
| `dsh-client-ui-plugin-manager` | 侧边栏「插件」全页面板（范例） | 占 `sidebar.panellist` + `main` 的 keyed 项 |
| `dsh-client-ui-cordis` | 侧边栏底部一个动作 | 占 `sidebar.footer.action` |
| `dsh-client-ui-brand-official` | 品牌 slot 的官方占用者 | 占 `sidebar.brand.mark` / `sidebar.brand.name` |
| `dsh-client-ui-sidebar-right` | **右侧栏**（每会话一个停靠面板） | `ctx.sidebarRight`、`ctx.sidebarRightTabs` |
| `dsh-client-ui-dockkit` | 右侧栏的分屏/拖拽内核（与产品无关） | — |
| `dsh-client-ui-slots` | 槽位**纯内核**（无 React，23KB） | `SlotCore`、`SlotOwnershipError`、`StaleAuthorizationError` |
| `dsh-client-ui-renderer` | 槽位的 React 渲染器 + `ctx.slots` 服务 | `ctx.slots.register/inject/renderSlot` |

`[代码]` 活跃组合清单见 `@deepseek-ai/dsh-web-app/cordis.patch.yml:261-344`。

---

## 2. 三栏布局与几何

来源：`[文档]` `dsh-client-ui-layout/README.md` + `[代码]` `lib/client.js:38`、`:319-336`。

```
┌──────────────┬────────────────────────────┬──────────────────────┐
│  sidebar     │  main                      │  rightbar            │
│  左栏        │  中栏（keyed 槽位）        │  右栏（可停靠面板）  │
│  264–420px   │  min 400px（有右栏时）     │  45%→70% cap, min300 │
│  默认 280px  │                            │  可 fullscreen       │
│  收起 56px   │                            │                      │
└──────────────┴────────────────────────────┴──────────────────────┘
```

- 左栏宽度 `sidebar === 0` 表示收起；收起时轨道宽度 `collapsedWidth` 默认 **56px**。
- 收起/展开由 `ctx.layout.toggleSidebar()` 驱动；快捷命令 id `sidebar.left.toggle`（桌面 `Mod+B`）。
- 宽度 < 1024px 自动收起；打开右栏会收起「手动展开」的左栏（除非处于 narrowExpanded）。
- 布局状态**不持久化**，刷新即回到默认（280px，右栏关闭）。

CSS 关键变量（`[代码]` `dsh-client-ui-sidebar/lib/client.js` CSS 块）：

| 变量 | 含义 |
|---|---|
| `--dsh-sidebar-inline-padding: 12px` | 左栏左右内边距 |
| `--dsw-specific-sidebar-fill` | 左栏底色 |
| `--dsh-scrollbar-thumb` / `-hover` | 滚动条缩略图（离开指针时被改成 `transparent`） |
| `--dsh-frame-top-clearance` | 顶部预留条（macOS 48px / Windows 标题栏高） |
| `--dsh-frame-leading-clearance` | macOS 收起时左上角给窗口控件留的横向净空（160px / 全屏 84px） |
| `--dsh-windows-titlebar-height` / `--dsh-windows-sidebar-width` / `--dsh-windows-content-radius` | Windows 标题栏集成 |

---

## 3. 左侧栏外壳（`dsh-client-ui-sidebar`）详解

### 3.1 渲染出来的 DOM 树

`[代码]` `lib/client.js:262-410`（JSX 逐行核对）。展开态：

```
div.root                                     ← 宽度 style，指针进出控制滚动条
│   class: root [collapsed] [railIn] [fading] [quietBars]
├── div.topStrip  [data-window-drag]         ← 仅 macOS：置顶条 + 收起按钮
├── div.logoRow   [data-window-drag]
│   ├── span.brand.wide | button.brand.wide  ← 非 macOS 时整行可点 = 新建会话
│   │   └── span.brandIdentity[aria-hidden]
│   │       ├── span.brandMark  → renderSlot('sidebar.brand.mark', {size:24})
│   │       └── span.brandName  → renderSlot('sidebar.brand.name', {})
│   └── Tooltip > button.iconButton.toggle   ← 收起按钮 aria-label + aria-keyshortcuts
│       ├── span.railMark        → renderSlot('sidebar.brand.mark')（收起、非 Windows）
│       ├── IconPanelLeftOutlineRegular.panelIcon  (16px wide / 18px rail)
│       └── renderSlot('sidebar.toggle.badge')     （仅收起时，非交互状态角标）
├── Tooltip > button.newSession              ← 新建会话
│   ├── span.newSessionLabelMask > span.newSessionContent
│   │   ├── IconNewChatOutlineMedium / Regular
│   │   └── span.newSessionLabel（宽态才显示文字）
│   └── span.newSessionShortcut（宽态，显示快捷键键帽）
├── nav.panelList  [aria-label]              ← 仅当有全局面板注册时才渲染
│   └── PanelRow × N                         ← 来自 sidebar.panellist
├── div.regionArea
│   └── renderSlot('sidebar.workspaces', { wide, expandSidebar })   ← 会话/工作区浏览器
└── div.footArea
    ├── div.footerActions → renderSlot('sidebar.footer.action', { wide })
    └── div.settingsArea  → renderSlot('sidebar.settings', { wide })
```

macOS 收起时，`HeaderLeadingControls` 会额外注册进 `shell.leading`（布局层的窗口 chrome 座位），渲染在红绿灯旁边。

### 3.2 左侧栏声明的 7 个子座位（这是改造的核心接口）

`[代码]` `lib/client.js:487-520`：

```js
ctx.slots.inject('sidebar', () => ctx.slots.register({
  name: 'sidebar',
  locale: 'sidebar',
  children: {
    'sidebar.brand.mark':   { kind: 'single', scope: 'root' },
    'sidebar.brand.name':   { kind: 'single', scope: 'root' },
    'sidebar.toggle.badge': { kind: 'single', scope: 'root' },
    'sidebar.panellist':    { kind: 'list',   scope: 'root' },
    'sidebar.workspaces':   { kind: 'single', scope: 'root' },
    'sidebar.settings':     { kind: 'single', scope: 'root' },
    'sidebar.footer.action':{ kind: 'list',   scope: 'root' },
  },
  inject: injectProps,
}, SidebarRoot));
```

| 座位 | kind | 占用者 | occupant 收到的 props |
|---|---|---|---|
| `sidebar.brand.mark` | single | `ui-brand-official`（可无） | `{ size: 24 }` |
| `sidebar.brand.name` | single | `ui-brand-official`（可无） | `{}` |
| `sidebar.toggle.badge` | single | 无 | `{}` |
| `sidebar.panellist` | list | `ui-plugin-manager` 等 | `{ size, active }` |
| `sidebar.workspaces` | single | **`ui-workspace`** | `{ wide, expandSidebar }` |
| `sidebar.settings` | single | `ui-settings` | `{ wide }` |
| `sidebar.footer.action` | list | `ui-cordis` 等 | `{ wide }` |

`[文档]` 类型契约（npm 包里的 `lib/types/client/contract/slots.d.ts`）：

```ts
export type SidebarRootComponentProps =
  & PropsRuntime<'sidebar'>                      // 来自 layout：collapsed, width
  & PropsRenderSlots<'sidebar.brand.mark' | 'sidebar.brand.name' | 'sidebar.toggle.badge'
                   | 'sidebar.panellist' | 'sidebar.workspaces' | 'sidebar.settings'
                   | 'sidebar.footer.action'>
  & InjectFace<SidebarRootInjected>              // startSession / toggleSidebar / selectPanel / hooks
  & PropsLocale<'sidebar'>;
```

### 3.3 外壳插件本体

`[代码]` `lib/client.js:436-445`：

```js
const inject = ['slots', 'layout', 'uiWorkspace', 'locale', 'shortcuts'];
function apply(ctx) { … }
```

- 监听 `sidebar.panellist` 的注册变化，投影成有序的面板元数据（`ctx.slots.entriesOfSlot` + `ctx.slots.subscribe`）。
- `injectProps()` 提供 `startSession(workspaceId?)`、`toggleSidebar()`、`selectPanel(id)`，以及 `hooks.panels` / `hooks.shortcuts` 两个可观察源。
- `lib/index.js` 是宿主侧入口，空实现（纯浏览器插件）。

### 3.4 交互与平台分支（重写时必须复刻）

`[文档]` `README.md:34-56`，`[代码]` CSS 块：

- **品牌行点击 = 新建会话**（非 macOS）；macOS 下品牌行不可点，只能用专用 New Session 按钮。
- **收起动画**：内容在当前位置淡出 → 上部控件整体左移进 56px 轨道（`rail-in .15s var(--ds-ease-in-out)`，起始 `translate(49px)`）→ 布局列滑动收尾。`prefers-reduced-motion` 关闭全部过渡。
- **滚动条**：指针不在栏内时把 `--dsh-scrollbar-thumb` 置为 `transparent`，离开后再保留 2s；预留宽度由 `ui-workspace` 负责，所以显隐不会让行位移。
- **Windows**：`html[data-windows-titlebar]` 下收起栏整列消失，收起按钮固定在标题栏左上角，新建会话按钮移到 `left:48px`，两者为 28px 圆形；侧栏通过 `--dsh-windows-menu-start` 给桌面菜单让位。
- **macOS**：`html[data-platform='darwin']` 下顶部 52px 条避开 hiddenInset 红绿灯；整列在收起时完全隐藏（不留 56px 轨道），改由 `shell.leading` 座位提供重新打开按钮。

### 3.5 几何常量

| 项 | 展开 | 收起（56px 轨道） |
|---|---|---|
| root padding | `6px 12px` | `18px 10px 6px` |
| logoRow 高 | 60px（下边距 4px） | 36px（下边距 12px） |
| 图标按钮 | 28×28 | 36×36 |
| 新建会话按钮 | 常规 | 36×36 透明底 |

---

## 4. 左侧栏的内容：会话/工作区浏览器（`dsh-client-ui-workspace`）

`[文档]` `README.md` `[代码]` `lib/client.js`。这是用户实际使用频率最高的一块。

**能做什么**：分组的会话列表 / 扁平列表、选工作区新建会话、工作区的新增/重命名/排序/删除、会话的重命名/复制(fork)/归档/取消归档/置顶/拖拽排序、搜索、展示待处理交互。

**几个值得注意的行为**：

- 展开的工作区默认显示 **5 条**空闲非空会话；运行中的会话不受配额限制。每次「显示更多」+5。
- 排序模式：**最后更新**（按最后一条用户输入时间，置顶的排最前）与**手动**（保存的完整顺序）。切换回最后更新会丢弃手动布局。
- 分组模式：**按工作区分组**（默认）或**工作区树**（按最近的已注册祖先嵌套）；分组与折叠状态存在浏览器本地，工作区组的顺序是 Host 持久化的。
- 搜索：折叠态是一个 header 动作，展开后横跨 header；标题/工作区子串立即匹配，250ms 防抖后再请求 Host 做正文检索；结果上限 20。
- 行状态：`pendingInteraction` 分类（等待审批 / 计划待审 / 等待回答）→ 警告点，并把更新时间替换成文字；空闲无点，未读完成用 done 点。
- **可供插件扩展的行内座位**（重要）：
  - `sidebar.session.row.leading`（single，仅行主状态为 idle 时渲染；日程标记就在这里）
  - `sidebar.session.row.hover`（list）
  - `sidebar.workspaces.session.row.action`（list）
  - `sidebar.workspaces.session.menu.item`（list）← 置顶/重命名/复制/归档本身就是这个 list 的条目
  - `sidebar.workspaces.directoryFlow`（single）
- 导航服务：`ctx.uiWorkspace.openSession(target)`、`openWorkspace(id, beforeOpen?)`、`forkSession(id)`、`startSession(workspaceId?)`。
- 主视图服务：`ctx.layout.selectPanel(id)`，`null` = 回到会话；未注册的 id 会抛错且不改变当前选择。

**实现细节（重写时要知道的）**：

- **无虚拟化**：列表是全量渲染的，性能靠 `AnimatedRows`（class 组件，100ms 淡入 / 200ms 滑动，用 FLIP + `element.animate`）。
- 树形缩进用行内变量 `--dsh-workspace-indent: Npx`，**每层 12px**。
- 视图状态持久化在浏览器本地，key 是 **`dsh.workspace.view.v5`**（`{ groupBy, orderBy, groupExpansion, sessionOrderByAccount, archivedFilter }`）。
- 状态点优先级：`approval | plan-review | question`（warning 点）> `running` > 有子代理活动 > `done`（未读完成）> `idle`（无点）。
- 会话行的 `data-row-key` 形如 `workspace:<key>` / `session:<id>` / `overflow:<key>` / `empty`——皮肤和自动化都该用这个选择器。
- 工作区浏览器自己又声明了 5 个座位：`sidebar.workspaces.directoryFlow`、`sidebar.workspaces.session.menu.item`（内置 pin/rename/fork/archive）、`sidebar.workspaces.session.row.action`、`sidebar.session.row.leading`、`sidebar.session.row.hover`。
- 外层 `sidebar` 座位**由 ui-layout 声明**（owner props `{collapsed, width}`）；注册到它 = 替换整列，并让上面这 8 个子座位的声明全部失效。

---

## 5. 右侧栏（`dsh-client-ui-sidebar-right`）——与左侧栏是两套东西

`[文档]` `README.md`。

- 结构：每会话一个**停靠表面**（docking surface），由 `dsh-client-ui-dockkit` 提供分屏树/拖拽/浮动面板。
- 两种呈现：`push`（默认，占右列，会话让宽）与 `fullscreen`（覆盖视口，保留底下的宽屏列）。视口 < 768px 时自动全屏。
- 面板**没有 header 行**：呈现切换和收起按钮挂在右上分屏 tab 条的最右端。
- 右栏隐藏时，会话 header 角落座位 `conversation.session.header.corner` 放一个展开按钮。
- 扩展点（服务 + 座位）：
  - **`ctx.sidebarRightTabs` —— tab 类型注册表（推荐入口）**
    ```js
    ctx.sidebarRightTabs.register({
      id, kind,                 // 一个实现 id = 注册表身份 = 座位 key
      priority: 'extension',    // 档位：extension > builtin > fallback
      patterns?, canOpen?,      // canOpen 控制能否接管某个资源
      title, guide?, keepMounted?,
    })                          // 返回 disposer
    ```
    每种 `kind` 同时最多一个 builtin + 一个 extension；**extension 生效时 builtin 让位，extension 卸载后 builtin 自动恢复**——这是 DSH 里最干净的「替换某类页面」机制，不用遮蔽任何座位。
  - `ctx.sidebarRight` —— 导航控制器（`openTab` / `openResource` / `close` / `active` / `isExpanded` / `toggleExpanded` / `mounted`）
  - 座位：`sidebar.right.pane.tab`（+ `.title`，按实现 id 作 key）、`sidebar.right.tab.guide` / `.guide.entry`、`sidebar.right.tab.menu.item`、`sidebar.right.tab.files.actions`、`sidebar.right.tab.document.*`、`sidebar.right.toggle`
- 呈现控制：`ctx.layout.openRightbar(track, fullscreen)` / `closeRightbar()`。
- ⚠️ **要等「服务」而不是「座位声明」**：座位声明早于服务 provide，如果你用 `slots.inject('sidebar.right.pane.tab', …)` 去触发注册，可能永远不执行。正确姿势是 `ctx.inject(['sidebarRightTabs'], …)`。
- ⚠️ 不要在会话列表里读「当前会话」（列表没有这个字段），用 `ctx.sidebarRight.mounted` 作为唯一可信来源，并按会话排队。`[我推断]`

---

## 6. 槽位系统：整个 UI 的扩展机制

`[文档]` `dsh-client-ui-slots/README.md`，`[代码]` `lib/index.js`、`dsh-client-ui-renderer/lib/client.js`。

**四种 kind**：`single`（一个占用者）、`list`（有序多条目）、`keyed`（按键分发）、`chain`（条目自选举，带 `priority` + `select`）。

**核心规则（都已在代码中核对）**：

1. **声明即认领**：只有声明了某个子槽的注册者才能 `renderSlot` 它。
   `[代码]` renderer `lib/client.js:330-333`：
   ```js
   const declared = entry.children?.[key];
   if (declared === void 0) throw new SlotOwnershipError(`slot '${key}' is not declared by this entry's children`);
   ```
   即 **A 组件无法渲染 B 声明的槽**，即使那个槽已经被声明、也已经有人注册进去了。

2. **`ctx.slots.inject(key, cb)` = 等声明**：key 一旦被声明就执行 `cb`；声明消失后再出现会重新执行。这就是「替换者无论先加载还是后加载都能生效」的机制。`[代码]` renderer `:1343-1385`。

3. **`single` 槽位可以按 priority 遮蔽**：同优先级重复注册会抛错，**不同优先级则允许共存，数值最小者渲染**。
   `[代码]` slots `lib/index.js:167-172`、`:221`、`:263-293`。

4. **遮蔽者不能重复声明别人的子槽**：`[代码]` `lib/index.js:191-194`，子槽已被声明就抛
   `slot "sidebar.brand.mark" is already declared`。

5. **降级容错**：渲染崩溃时该条目会「abdicate」（退位），同格的下一个条目接管 —— 所以遮蔽者崩了，被遮蔽的原件会自动回来。`[代码]` `lib/index.js:436-460`。

---

## 7. 实证：到底能不能「换掉」侧边栏？

我用真实的 `SlotCore` 跑了一次实验（脚本：`tools/slot-shadow-probe.mjs`），复刻「ui-layout 声明 sidebar → ui-sidebar 占位并声明 7 个子槽 → ui-workspace 填 sidebar.workspaces → 新插件尝试接管」：

| 尝试 | 结果 |
|---|---|
| 同优先级再注册 `sidebar` | ❌ 抛错：`single slot "sidebar" already has a registration at priority 0 — register at a different priority to shadow it (lowest renders)` |
| `priority: -1` **且声明同样的子槽** | ❌ 抛错：`slot "sidebar.brand.mark" is already declared` |
| `priority: -1` **且不声明子槽** | ✅ 注册成功，**且成为唯一渲染者**（最低优先级获胜） |
| `priority: -1` 遮蔽**叶子座位**（如 `sidebar.workspaces`） | ✅ 成功，且**无冲突**——叶子座位没有子槽声明，是最安全的替换方式（路线 A+） |
| 被遮蔽的原件仍在账本上时 | 它声明的子槽**依然有效**，`ui-workspace` 仍能正常注册进 `sidebar.workspaces` |
| 被遮蔽的原件被卸载后 | 它声明的子槽随之塌陷，填入的占用者一起死亡 |

**补充机制（来自 `dsh-cordis-client-runner`，已核对源码）**：DSH 里没有 `replace()` API，替换 = 优先级遮蔽。对**动态包**（运行时由 Agent 写入并加载的包），runner 会给每次非 chain 注册**自动分配递减优先级**：

```js
// dsh-cordis-client-runner/lib/client.js:275-280, 615
const spec = slots.spec(slot);
if (spec === void 0 || spec.kind !== "chain") {
  options.priority = env.allocatePriority();   // allocatePriority: () => --this.nextPriority
}
```
`nextPriority` 从 0 开始，所以动态包第一次注册拿到 `-1`，**自动压过所有官方条目（官方为 0）**。
⚠️ 但这是**动态包专用**的保护代理（`guardedSlots`）；**以 profile bundle 形式安装的普通插件走的是直连 `ctx.slots`，不会自动降优先级**，必须自己显式传 `priority: -1`，否则同优先级重复注册会直接抛错。

**结论：四条可行路线**

### 路线 A —— 增量扩展（风险最低，先做这个）
保留官方外壳，只用现成座位 + 设计令牌。
- 加功能：`sidebar.footer.action`、`sidebar.panellist`（+ 一个 `main` keyed 面板）、`sidebar.session.row.leading/hover`、`sidebar.workspaces.session.*`、`sidebar.right.*`。
- 改观感：覆盖 `--dsw-*` / `--dsh-*` 变量，用 `[data-slot="…"]` / `data-row-key` 选择器写样式。
- 优点：不动结构，官方升级不易崩。缺点：**改不了外壳结构**（品牌行、新建会话按钮、区域的顺序与几何都是写死的），56px 轨道也是布局层的决定。

### 路线 A+ —— 整体换掉「内容区」而不是外壳
`sidebar.workspaces` 是 `single` 叶子座位，用 `priority: -1` 遮蔽它，就能用自己的组件完全替换会话/工作区浏览器，同时保留官方外壳的品牌行/新建会话/设置行。
- 座位是叶子、没有子槽声明冲突，是**唯一能安全遮蔽的官方座位类型**。
- 代价：要自己实现工作区树、分组、搜索、排序、拖拽、状态点等（数据可以从 `useSessions` / `useWorkspaces` / `ctx.uiWorkspace` 拿到）。
- 同理可换：`sidebar.settings`、`sidebar.brand.mark`、`sidebar.brand.name`。

### 路线 B —— 整体替换外壳（真正的「重新定义 UI」）
在自己的 bundle patch 里把 `@deepseek-ai/dsh-client-ui-sidebar` 设为 `disabled: true`，然后自己 `ctx.slots.inject('sidebar', …)` 注册一个**声明完全相同 7 个子槽**的新外壳。
- 优点：**100% 外观自由**，同时 `ui-workspace`、`ui-settings`、`plugin-manager`、`brand-official` 全部照常工作，功能零损失。
- 代价：要自己复刻收起动画、`reduced-motion`、macOS hiddenInset 顶条、Windows 固定标题栏几何、滚动条策略、无障碍属性；并满足 §3.2 的 props 契约。
- **必须禁用原件**：不禁用就会子槽声明冲突（见上表）。若只遮蔽不禁用，官方子槽的 `slots.inject` 注册会永远 pending，会话树和设置行都不会出现。
- 顺带说明：`root` 座位**绝对不要**注册——官方 slot 目录有明确警告：`root` 是 `single`，二次注册会遮蔽 AppFrame，整个页面只剩你的组件。

### 路线 C —— 纯优先级遮蔽（不推荐）
`priority: -1` 占住 `sidebar` 但**不声明**任何子槽。
- 结果：你能画自己的侧边栏，但**无法渲染官方的会话树/设置行**（`renderSlot` 只允许渲染自己声明的子槽，否则抛 `SlotOwnershipError`），它们变成孤儿。
- 只适合完全自给自足、不需要任何既有座位的极端设计，而且原件一旦卸载/崩溃你的 UI 会连带失效。

---

## 8. 样式接口：能依赖什么、不能依赖什么

`[实证]` 我拆了外壳包的 CSS。

**❌ 不能依赖**：类名是 **CSS Modules 哈希**，每次构建都会变，例如
左栏 `._3WPZCG_root`、工作区 `._7514NG_list` / `.jJkEga_sessionRow`、品牌 `.DL-xwG_iconButton`、插件管理 `.ZVcBiW_card`。写 `.root { … }` 这类皮肤必然跨版本失效。
（找到官方样式表的办法：`<style data-plugin-css="@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css">`。）

**✅ 可以依赖（稳定契约）**：

| 类别 | 例子 | 说明 |
|---|---|---|
| **座位锚点 `[data-slot]`** | `[data-slot="sidebar"]`、`[data-slot="sidebar.workspaces"]`、`[data-slot="sidebar.settings"]` | 渲染器给**每一个**座位输出 `<div data-slot="KEY" style="display:contents">`（`ui-renderer/lib/client.js:1098-1102`）。**这是重写 UI 最有力的稳定选择器** |
| **行标识 `[data-row-key]`** | `data-row-key="workspace:<key>"` / `"session:<id>"` / `"overflow:<key>"` / `"empty"` | 工作区/会话行的最佳定位方式 |
| 设计令牌 `--dsw-*` | `--dsw-alias-bg-base`、`--dsw-alias-label-secondary`、`--dsw-alias-border-l3`、`--dsw-radius-lg`、`--dsw-alias-state-warn-primary` | 前端 CSS 里出现 440 次；外壳 CSS 里独立出现 95 个 |
| DSH 框架变量 `--dsh-*` | `--dsh-frame-top-clearance`、`--dsh-sidebar-inline-padding:12px`、`--dsh-workspace-indent:Npx`（12px/级）、`--dsh-scrollbar-thumb`、`--dsh-windows-menu-start`、`--dsh-windows-*` | 布局/外壳公开的契约 |
| 过渡变量 `--ds-*` | `--ds-transition-duration-slow`、`--ds-ease-in-out` | 与布局滑动共用同一条曲线 |
| 组件级 `--dsl-*` | `--dsl-terminal-*` | 局部 |
| HTML 属性选择器 | `html[data-platform='darwin']`、`html[data-windows-titlebar]`、`html[data-fullscreen]`、`body[data-ds-dark-theme]`、`[data-window-drag]`、`[data-animating]`、`[data-dragging]`、`[data-sidebar-collapsed]`、`[data-shell-leading]`、`[data-shell-overlay]` | 稳定 |
| 语义/无障碍 | `role="tree/treeitem/group/menuitem/tooltip"`、`aria-label/keyshortcuts/current/expanded/selected/description`、`StateDot` 上的 `data-state="ongoing|done|idle|warning"`、标题上的 `data-scrolled/-clipped` | 稳定，可安全用于样式与断言 |

> 结论：**用 `[data-slot]` + `[data-row-key]` + `--dsw-*`/`--dsh-*` 写皮肤是可持续的；用类名必然崩。**

---

## 9. 现成先例

### 9.1 `dsh-better-sidebar@0.21.1`（装了，但**当前被拒绝加载**）
`~/.dsh/profiles/desktop/node_modules/dsh-better-sidebar/`，MIT，带完整 TypeScript 源码。

**状态核实（两重原因，都成立）**：
1. 它只出现在 `package.json` 的 `dependencies` 里，**不在 `dsh.profile.bundles` 里** —— 而 bundles 才是「启用」开关。
2. 即使加进 bundles，启动也会拒绝它。`[实证]` `.plugin-manager/logs/*/pnpm.log` 原文：

```
dsh: warning: Plugin dsh-better-sidebar@0.21.1 is incompatible with dsh 0.2.0-rc.2:
peerDependencies {"@deepseek-ai/dsh-client-ui-sidebar-right":"^0.1.7-rc.1", ...}
… it stays installed but profile startup denies it until you grant an exemption
for those exact versions. Exact-version exemption: not active.
```

→ **结论：当前右侧栏是官方原版，没有被任何第三方改造。** 交互上这反而是好消息：右侧栏完全空着等你做。
想强行启用它需要显式接受风险：`dsh plugin --profile desktop allow-version dsh-better-sidebar@0.21.1 --dsh-version 0.2.0-rc.2 --accept-risk`。

> **状态更新（2026-10-03 11:40）**：该包随后已被从 profile 的 `dependencies` 中**彻底移除**（锁文件从 48KB 缩到 4KB），
> 因此现在连「装而未启用」都不成立 —— 它已经不在这个 profile 里了。下面的描述保留，用于说明**机制**。

**它本来打算怎么扩展右侧栏（对我们很有参考价值）**：它**不替换、也不禁用** `ui-sidebar-right`，而是注入该包并注册进它的 **tab 类型注册表**——`ctx.sidebarRightTabs.register({ id, kind, priority:'extension', … })`，用一个 `extension` 档的注册接管内置的 `files` 页；正文/标题再通过 `ctx.slots.register({ name:'sidebar.right.pane.tab', key:id })` 挂进去。
它还向其他插件暴露服务 `ctx.betterSidebar`（`registerTab` / `registerFileViewer` / `registerFileIcon` / `openTab` / `subscribe` + `version` 与单调递增的 `features` 能力列表）。
`[我推断]` 这是全 DSH 里最「正规」的扩展范式：**用公开的注册表 + 优先级档位，而不是遮蔽别人的座位。**

### 9.2 `dsh-plugin-appshot`（你自己的插件，v0.6.0）
`~/Documents/deepseek-harness/dsh-plugin-appshot/`，可作为插件骨架的直接参考：

```json
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": {
    "platform": "web",
    "inject": ["@deepseek-ai/dsh-client-ui-slots", "@deepseek-ai/dsh-client-ui-conversation"],
    "immediately": false
  }
}
```

### 9.3 一个最小可跑插件的骨架（5 个文件）

```jsonc
// package.json
{
  "name": "dsh-plugin-my-sidebar",
  "type": "module",
  "main": "./dist/index.js",                     // 宿主半边
  "exports": { ".": "./dist/index.js", "./client": "./dist/client.js" },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" }, // 让 dsh plugin add 自动挂载
    "client": {
      "platform": "web",                         // 必填
      "inject": ["@deepseek-ai/dsh-client-ui-slots", "@deepseek-ai/dsh-client-ui-sidebar-right"]
    }                                            // ↑ 这里是「客户端包 id」，不是服务名
  },
  "files": ["dist", "cordis.patch.yml", "locale"],  // 注意把懒加载 chunk 也算进去
  "icon": "./icon.svg"
  // ⚠️ 故意不写 @deepseek-ai/dsh-* 的 peerDependencies：那正是触发版本闸门的开关
}
```

```yaml
# cordis.patch.yml —— 全部内容
- insert:
    - id: my-sidebar                 # 挂载点的 id，随便取
      name: 'dsh-plugin-my-sidebar'  # 必须是包名
      # config: { ... }              # 这里对应你自己的 Config
```

```ts
// src/index.ts —— 宿主半边（可以是空的，官方 ui-sidebar 的宿主半边就是 function apply(){}）
export const name = 'dsh-plugin-my-sidebar';
export const inject: string[] = [];              // Cordis 服务名
export function apply(ctx: any, config?: unknown) {}
// 需要设置项时：export const Config = z.object({...})   （@deepseek-ai/schemastery，实时偏好用 .volatile()）
```

```tsx
// src/client.tsx —— 浏览器半边
export const inject = ['slots', 'locale', 'sidebarRightTabs'];   // 服务名
export function apply(ctx: any) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }));
  ctx.effect(() => ctx.sidebarRightTabs.register({ id: KIND, kind: KIND, priority: 'extension', title, guide: [...] }));
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: KIND, locale: NS }, Body));
  // 所有注册都放进 ctx.effect(...)，这样热更新/禁用时能干净卸载
}
```

**打包**：两次 esbuild —— 宿主 `{ platform:'node', format:'esm', packages:'external' }`；浏览器 `{ platform:'browser', format:'cjs', external:['react','react-dom','react/jsx-runtime'] }`，并用 `banner`/`footer` 把产物包进
`window.__ModuleLoader__.load({ id:'<包名>', factory: (require) => { var module={exports:{}}, exports=module.exports; … return module.exports } })`。

**装**：`dsh plugin --profile desktop add link:/abs/path/to/dsh-plugin-my-sidebar`（开发用 link；正式发 tgz）。桌面版 profile 由 App 托管，最省事是走 App 内侧边栏的 **Plugins 页**（Add plugin 支持绝对路径）。

### 9.4 官方「往侧边栏加一个功能页」的标准范例
`@deepseek-ai/dsh-client-ui-plugin-manager` 用三个注册就完成了：侧边栏入口 + 主区全页面板 + 顶部提示。

```js
ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
  name: 'sidebar.panellist', id: PANEL_ID, order: 0, /* label 走 locale */
}, IconComponent));

ctx.slots.inject('main', function* () {
  yield ctx.slots.register({ name: 'main', key: PANEL_ID }, PageComponent);
});

ctx.slots.inject('shell.overlay', () => ctx.slots.register({
  name: 'shell.overlay', id: 'plugin-manager.refresh-toast',
}, ToastComponent));
```
`[代码]` `lib/client.js:3703,3712,3769`。

---

## 10. 开发与安装链路

### 10.1 插件的两个半边
- **宿主侧** `lib/index.js`：跑在 Node/Host 进程（`main` 字段）。可注册 Cordis 服务、路由、Agent 工具。
- **浏览器侧** `lib/client.js`：通过 `package.json` 的 `dsh.client` 声明被发现并投递给 Web 客户端。
  `[代码]` 打包格式是 UMD 风格的自注册：`window.__ModuleLoader__.load({ id, factory: (require) => … })`，用 `require()` 取其他插件（如 `@deepseek-ai/dsh-client-ui-slots`）。
- `dsh.client.inject` 列出**必须已加载的依赖包**；`platform: "web"`。

### 10.2 组合与启用（profile 层）
`~/.dsh/profiles/desktop/`：

```
package.json     → dsh.profile.bundles: [ dsh-base, dsh-web-app, …, dshmarket, dsh-plugin-appshot ]
cordis.yml       → 永远是字面量 []（每次启动被重写），只为给 Loader 提供 baseUrl
cordis.patch.yml → 你的本地覆盖层（id 定向的 config 覆盖、disabled、insert）
node_modules/    → 插件包
.plugin-manager/ → 安装操作的日志
```

**层级合并顺序（子代理已核对 `composeProfile` 源码）**：

```
bundle 层（按 dsh.profile.bundles 顺序）
  → profile 的 cordis.patch.yml
  → $DSH_HOME/cordis.patch.yml      ← 家目录层，优先级高于 profile 层
  → --patch <file> 覆盖（可重复，按 argv 顺序）
  → 遥测开关
```
按行 `id` 后者覆盖前者；**`config` 是整体替换，不做深合并**。没有落盘的合成清单，想看最终树用 `dsh --profile desktop --dump-config`。

patch 行字段：`id / name / config / disabled / inject / intercept / isolate`；`insert:` 追加（`insert.id` 指向 `group: true` 的行则插进它的列表）；带 `id` 的 patch 覆盖该行（`name` 只做**断言**不重命名）；匹配不到目标只警告并跳过。`!!js` 是 Loader 表达式（不是 `!js`），在 `config` 里的表达式以该插件自身的 ctx 求值。

**要禁用官方左栏**（路线 B 的关键动作）就是在 profile 的 `cordis.patch.yml` 加：

```yaml
- id: ui-sidebar
  disabled: true
```

> ⚠️ **准入闸门（本机已实测到真实案例）**：只要包声明了 `@deepseek-ai/dsh-*` 的 peerDependencies，装的时候就会跟运行时版本（`0.2.0-rc.2`）比对；不匹配则**装得上、但启动时被拒绝加载**：
> ```
> Plugin dsh-better-sidebar@0.21.1 is incompatible with dsh 0.2.0-rc.2: peerDependencies {...}
> it stays installed but profile startup denies it until you grant an exemption for those exact versions.
> ```
> 实测来源：`~/.dsh/profiles/desktop/.plugin-manager/logs/*/pnpm.log`。
>
> **给新插件的三条实操结论**：
> 1. **干脆不要写 `@deepseek-ai/dsh-*` 的 peerDependencies**（你自己的 `dsh-plugin-appshot` 就没写，因此从不触发闸门）——用 `devDependencies` 拿类型即可。
> 2. 若一定要写，范围必须覆盖 `0.2.0-rc.2`。
> 3. 万不得已时用逃逸口：`dsh plugin --profile desktop allow-version <pkg@ver> --dsh-version 0.2.0-rc.2 --accept-risk`（写入 profile 的 `compatibility.json`）。

### 10.3 类型与源码从哪来
`[实证]` 官方包已发布到 npm（registry 可达），`next` 标签 = `0.2.0-rc.2`，与本机运行时一致：

- npm 包里**有**类型：`lib/types/client/contract/slots.d.ts` 等 6 个 `.d.ts`（就是 §3.2 的契约）。
- npm 包里**没有** `src/`（`files` 白名单只含 lib），所以想读实现只能看打包后的 `lib/client.js`（可读性尚可，JSX 未被压成一行）。
- app.asar 里**不含**这两个包的 `.d.ts`，所以**做类型化开发必须把对应官方包作为 devDependency 装上**。

### 10.4 安装与启用的实际命令（`[实证]` 已在本机运行 CLI 验证）

```bash
# 装进 profile 并自动挂载 bundle（包声明了 dsh.bundle.patch 时会自动追加到 dsh.profile.bundles）
dsh plugin --profile desktop add ./my-sidebar-plugin      # 也支持 <pkg> / git+<url> / <tgz>
dsh plugin --profile desktop why <pkg>                    # 查它为什么被装/被禁
dsh plugin --profile desktop remove <pkg>
dsh plugin --profile desktop version-exemptions
dsh plugin --profile desktop allow-version <pkg@ver> --dsh-version <exact> --accept-risk
dsh --profile desktop --dump-config                       # 渲染合成后的插件树
```
- 没有 `enable/disable/list` 子命令——启用/禁用就是改 patch（或用侧边栏的 Plugins 页面 / `plugin_manager` 工具）。
- **侧边栏 Plugins 页面（`ui-plugin-manager`）是读写的**：能装/删 bundle、能改 `disabled`，并且 **Add plugin 接受本地绝对路径**。
- 桌面版 CLI 由 `dsh-desktop-host/lib/cli.js` 提供，改动 profile 前需要**完全退出 App**。

### 10.5 热更新与「什么时候要重启」

| 你改了什么 | 生效方式 |
|---|---|
| profile 的 `cordis.patch.yml` | **实时**（`dsh-hmr` 监听两个 patch 文件 + profile manifest） |
| 插件已构建的 client 产物（`exports["./client"]` 指向的文件） | **≤ ~500ms 自动热替换，无需刷新**：`dsh-client-hmr` 每 500ms 按 mtime/ctime/size 轮询，通过 `/plugins/events` SSE 推送 `rebuilt`，浏览器重新执行该 bundle 并**重置插件状态**（React state 丢失，会话/工作区/连接保留）；无失败回滚 |
| 插件的宿主侧 `lib/index.js` | **需要重启 App**：`dsh-hmr` 默认 `config.root: []`，**模块监听是关闭的**（除非把 `- id: hmr` 改成 `config.root: ["."]`） |
| 替换已安装包的版本 | **需要重启 App**（新的宿主 JS 代际） |
| 重建 `dsh-client-modules` 的 bootstrap、或改动 shell/静态模块表 | **需要刷新页面**（重则重启） |

> 注意：本机**没有 DSH 源码 checkout**（只有 app.asar），所以系统提示里的 `pnpm run dev:web` 在这里**不可用**；能走通的只有上面「轮询已构建产物」这条路。

### 10.6 排错入口
- 桌面致命错误：`~/Library/Logs/DeepSeek Harness/crash-<ISO>-host.log`（含宿主 stderr + **渲染进程 console 的 error 段**）。
- 浏览器控制台：`slot entry crashed in '<slot>'` 这类信息会打在这里。
- `window.__DSH_BOOT__`（合成后的浏览器端插件图）、`/plugins/events` SSE。
- 安装操作日志：`$DSH_HOME/profiles/<p>/.plugin-manager/logs/<op-id>/{pnpm,git}.log`。
- 环境变量：`DSH_HOME`、`DSH_PROFILE`、`DSH_PROFILE_DIR`、`DSH_WEB_URL` 等。

**推荐的开发循环**：在工作区写 bundle 目录 → 用侧边栏 Plugins 页 / `plugin_manager install_bundle`（绝对路径）装上 → **看返回的 `application` 字段**（`applied` / `overridden` / `restart-required` / `failed`）而不是猜日志 → 之后每次改构建产物约 500ms 自动生效。

---

## 11. 我建议的下一步

1. **先确认目标**：你要重做的是**左侧导航栏**，还是**右侧停靠面板**？两者的代码、服务、座位完全不相交，做之前必须定一个。
   （**右侧栏目前是官方原版**：唯一装了的第三方 `dsh-better-sidebar` 因 peer 不兼容被拒绝加载，见 §9.1。所以两边都是空地。）
   - 若做**右侧栏**，最正规的做法不是替换座位，而是注册进公开的 tab 类型注册表 **`ctx.sidebarRightTabs`**（`priority: 'extension'` 档位可以接管某个内置 kind，内置实现会在你卸载后自动恢复），详见 §5 / §9.1。
2. **再确认野心**（对应 §7 四条路线）：
   - 只想**加功能 / 换皮肤** → 路线 A（座位 + `[data-slot]` + 令牌），1 天内可出可用版本。
   - 想**换掉会话浏览器**（侧边栏里信息密度最高的那块）→ 路线 A+（遮蔽 `sidebar.workspaces`）。
   - 想**彻底重做整列**（布局、品牌行、新建会话、底部区都能自己定）→ 路线 B（禁用官方外壳 + 自己声明 7 个子槽），功能零损失但要复刻平台行为。
3. 确认后我可以直接产出：插件骨架（`package.json` + `cordis.patch.yml` + `client.ts`）、座位契约的 TS 类型、可一键切回官方外壳的开关、以及 ≤500ms 热替换的本地开发循环。

---

## 12. 关键事实速查

| 问题 | 答案 |
|---|---|
| 左栏插件包 | `@deepseek-ai/dsh-client-ui-sidebar@0.2.0-rc.2`（纯浏览器侧，宿主侧空实现） |
| 左栏外壳声明几个座位 | 7 个（3 single + 2 list + 2 single，见 §3.2），另有 `shell.leading` |
| 内容区插件 | `@deepseek-ai/dsh-client-ui-workspace`，占 `sidebar.workspaces` |
| 有没有替换 API | 没有 `replace()`；靠 `priority` 遮蔽（最低者渲染），动态包自动 -1 |
| 能不能继承官方子座位 | 不能。声明即认领，且 `renderSlot` 只允许渲染自己声明的子槽 |
| 完整替换的正确做法 | patch 里 `- id: ui-sidebar` + `disabled: true`，然后自己声明同一套座位 |
| 类名能做皮肤锚点吗 | 不能（CSS Modules 哈希）。用 `[data-slot]` / `[data-row-key]` / `--dsw-*` / `--dsh-*` |
| 有没有配置 schema | `ui-sidebar` 和 `ui-workspace` 都**没有** Config/schemastery；要设置项得自己实现 |
| 轨道宽度 56px 在哪决定 | `ui-layout` 的布局求解里；macOS 桌面与 Windows 标题栏下是 **0**（整列隐藏） |
| 装上插件要重启吗 | patch 改动实时；client 产物改动 ≤500ms 热替换；宿主代码/换版本要重启 |
| CLI 怎么装 | `dsh plugin --profile desktop add <pkg\|路径\|git+\|tgz\|link:/abs/dir>`（需先退出 App） |
| 本机能用 `pnpm run dev:web` 吗 | 不能，本机没有 DSH 源码 checkout（只有 app.asar） |
| 右侧栏现在被改造过吗 | **没有**。唯一相关的 `dsh-better-sidebar` 装了但被 peer 闸门拒绝加载（§9.1） |
| 右侧栏最正规的扩展方式 | `ctx.sidebarRightTabs.register({ id, kind, priority:'extension' })` + 对应座位；**不要**遮蔽 `rightbar` |
| 两个 `inject` 有什么区别 | `dsh.client.inject`（package.json 里）= **客户端包 id**；模块里 `export const inject` = **Cordis 服务名**。两者别混 |
| 怎么避免被版本闸门拒绝 | **别写 `@deepseek-ai/dsh-*` 的 peerDependencies**（用 devDependencies 拿类型），或范围覆盖 `0.2.0-rc.2` |
| 浏览器产物怎么打包 | 必须包成 `window.__ModuleLoader__.load({ id, factory: (require) => {…} })`；`react`/`react-dom`/`react/jsx-runtime` 保持 external |
| 宿主产物注意什么 | 不能有裸导入（一个漏掉的 `react` 就会让插件加载失败）；只允许 `node:` 内置 |

---

## 附录 A：随本文档附带的工具

| 文件 | 用途 |
|---|---|
| `tools/asar-reader.cjs` | 解析 app.asar 头部（无第三方依赖） |
| `tools/asar-list.cjs` | 把 asar 内全部 12973 个文件索引到 `all-files.txt` |
| `tools/asar-extract.cjs` | 按路径前缀抽取任意包到本地，便于阅读/检索 |
| `tools/slot-shadow-probe.mjs` | 复刻槽位遮蔽实验，验证「能否替换某座位」 |
| `all-files.txt` | asar 完整文件索引（path / size / offset） |
| `reference/slots-catalog.json` | **全部 90 个座位**的结构化目录（kind / scope / ownerProps / 标准 hooks） |
| `reference/slots-and-layout.md` | 槽位系统与布局层的深度报告（每条结论都标了源码行号） |
| `reference/left-sidebar.md` | 左栏 + 工作区的深度报告（含展开/收起/macOS/Windows 四种状态的 DOM 树） |
| `reference/runtime-and-devex.md` | 插件运行时、加载顺序、HMR、CLI、日志的深度报告 |
| `reference/existing-plugins.md` | 两个真实插件（better-sidebar / appshot）的解剖：最小骨架、安装链路、公开服务 API |

用法：

```bash
NODE="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/node/bin/node"
"$NODE" tools/asar-list.cjs
"$NODE" tools/asar-extract.cjs ./core \
  /dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar/ \
  /dsh/node_modules/@deepseek-ai/dsh-client-ui-workspace/
"$NODE" tools/slot-shadow-probe.mjs
```
