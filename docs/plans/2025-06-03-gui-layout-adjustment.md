# GUI 布局调整 实现计划

**目标：** 完成 Activity Bar、Shell 框架、标题栏系统、Composer 和首页的 13 项布局与交互调整
**涉及进程：** renderer（仅前端组件和状态管理，不涉及 main/preload）
**预期任务数：** 25

---

## Phase 1: 基础重构 — 先把骨架调对

### Task 1: Shell 两列布局 — 移除 Sidebar 列和 TitleBar

**Files:**
- Modify: `src/renderer/layouts/Shell.tsx`
- Delete: `src/renderer/components/TitleBar/TitleBar.tsx`

- [ ] Shell 从三列（ActivityBar + SidebarColumn + MainCanvas）改为两列（ActivityBar + WorkspaceArea）。移除 `<div className="flex flex-col flex-shrink-0 border-r...">` Sidebar 列及其内部的 `<TitleBar />` 和 `<WorkspaceSidebar>`。WorkspaceArea 仅渲染 `<WorkspaceRouter activity={activeActivity} />`，不再硬编码 Conversation/Settings/OutputArea。
- [ ] 删除 `TitleBar.tsx`（不再需要，各 Workspace 自行提供 drag 区域）
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit`

### Task 2: WorkspaceRouter 移除 Sidebar 路由

**Files:**
- Modify: `src/renderer/layouts/WorkspaceRouter.tsx`

- [ ] 移除 `WorkspaceSidebar` 导出函数及其内部 switch/case 逻辑、`SidebarWrapper`、`PLACEHOLDER` 常量
- [ ] 移除 `ChatsList` 和 `SettingsSidebar` 的 import（不再由此文件路由 Sidebar 内容）
- [ ] `WorkspaceMain` 保持不变——仅做 Activity → Workspace 组件分派
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit`

### Task 3: ActivityBar 背景加深 + 去分隔线

**Files:**
- Modify: `src/renderer/components/ActivityBar/ActivityBar.tsx`
- Modify: `src/renderer/assets/index.css`

- [ ] ActivityBar 最外层 div 背景从无设置改为 `bg-[var(--app-bg-inset)]`
- [ ] 删除分隔线 `<div className="w-6 h-px bg-[var(--app-border-muted)] my-3" />`，导航图标区和插件区之间用 `mt-3` 自然留白
- [ ] 在 `traffic-lights-spacer` 下方增加一个与 TitleBar 等高的区域（40px 的空白块），使 ActivityBar 顶部与 Sidebar 列标题栏视觉对齐，分隔自然从此开始
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit`

### Task 4: ActivityBar 去 chats 图标

**Files:**
- Modify: `src/renderer/components/ActivityBar/ActivityBar.tsx`
- Modify: `src/renderer/atoms/activityAtom.ts`

- [ ] 从 `TOP_ITEMS` 数组中删除 `{ id: 'chats', icon: MessageSquareText, label: 'Chats' }`
- [ ] 从 `activityAtom.ts` 的 `Activity` 类型中删除 `'chats'` 字面量
- [ ] 从 `WorkspaceRouter.tsx` 的 `WORKSPACES` 映射中删除 `chats: ChatWorkspace` 条目
- [ ] 从 lucide-react import 中删除 `MessageSquareText`
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit && npx vitest run test/unit/components/ActivityBar.test.tsx`

### Task 5: 各 Workspace 自行持有左/右边栏（ChatWorkspace）

**Files:**
- Modify: `src/renderer/workspaces/ChatWorkspace.tsx`
- Create: `src/renderer/workspaces/ChatsSidebar.tsx`

- [ ] 创建 `ChatsSidebar.tsx`：包含 40px 标题栏（CHATS 标题 + 可拖动区域 + 右侧 `+` 按键）和 `ChatsList` 列表
- [ ] `ChatWorkspace` 改为三区布局：`WorkspaceLayout.Left` 嵌入 `<ChatsSidebar />`，`WorkspaceLayout.Main` 嵌入 `<Conversation />`，`WorkspaceLayout.Right` 嵌入 `<OutputArea />`
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit`

### Task 6: 各 Workspace 自行持有左/右边栏（其余 6 个）

**Files:**
- Modify: `src/renderer/workspaces/ProjectsWorkspace.tsx`
- Modify: `src/renderer/workspaces/SettingsWorkspace.tsx`
- Modify: `src/renderer/workspaces/DashboardWorkspace.tsx`
- Modify: `src/renderer/workspaces/SearchWorkspace.tsx`
- Modify: `src/renderer/workspaces/AutomationWorkspace.tsx`
- Modify: `src/renderer/workspaces/PluginWorkspace.tsx`

- [ ] `ProjectsWorkspace` — 三区：左用 `WorkspaceLayout.Left`（含 40px 标题栏 "PROJECTS" + 占位），中 Conversation，右 OutputArea
- [ ] `SettingsWorkspace` — 两区：左用 `WorkspaceLayout.Left`（width=220px，含 40px 标题栏 "SETTINGS" + SettingsSidebar），右 Settings 内容
- [ ] `DashboardWorkspace` — 单区全宽：顶部 40px 可拖动标题栏，内容区 flex-1 垂直居中 Quick Start
- [ ] `SearchWorkspace` — 两区：左 220px 搜索分类列表，右搜索结果占位。顶部 40px 拖动条
- [ ] `AutomationWorkspace` — 两区：左 260px 任务列表 + 40px 标题栏，右占位
- [ ] `PluginWorkspace` — 两区：左 260px 插件列表 + 40px 标题栏，右占位
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit`

### Task 7: 清理 WorkspaceLayout 过期内容，为拖拽预留接口

**Files:**
- Modify: `src/renderer/layouts/WorkspaceLayout.tsx`

- [ ] `Left` 组件增加 `onResize`、`minWidth`、`maxWidth`、`showResizeHandle` 可选 props（默认值：minWidth=200, maxWidth=400, showResizeHandle=true）
- [ ] `Right` 组件增加 `onResize`、`minWidth`、`maxWidth`、`showResizeHandle` 可选 props（默认值：minWidth=280, maxWidth=600, showResizeHandle=true）
- [ ] 当 `showResizeHandle=true` 时，在边框内侧渲染一个 4px 宽的拖拽手柄区域（视觉为透明+ hover 变色，cursor col-resize），`onMouseDown` 触发时调用 `onResize(delta)`。此阶段先接线不实现完整拖拽（完整拖拽在 Phase 3）
- [ ] `Main` 增加可选 `draggable` prop（默认 true），为 true 时顶部 40px 区域设 `-webkit-app-region: drag`
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit`

---

## Phase 2: 标题栏系统

### Task 8: SessionHeader 去掉 ContextRing

**Files:**
- Modify: `src/renderer/components/Conversation/SessionHeader.tsx`

- [ ] 移除 `<ContextRing>` 的 import 和渲染
- [ ] 中央区域从 ContextRing 改为 `flex-1` 空占位（标题左侧，按键右侧）
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit && npx vitest run test/unit/components/SessionHeader.test.tsx`

### Task 9: SessionHeader 标题栏 40px + drag

**Files:**
- Modify: `src/renderer/components/Conversation/SessionHeader.tsx`

- [ ] 最外层 div 添加 `style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}`
- [ ] 三个按键区域添加 `style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}` 防止拖拽事件被按键消费
- [ ] 确认高度为 `h-[40px]`
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit`

### Task 10: OutputArea 标题栏 40px + drag

**Files:**
- Modify: `src/renderer/components/OutputArea/OutputArea.tsx`

- [ ] 标题栏高度从 `h-[32px]` 改为 `h-[40px]`
- [ ] 标题栏 div 添加 `style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}`
- [ ] Tab button 和按键区域添加 `style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}`
- [ ] 全屏按键（Maximize2）移到标题栏左侧（Tab 列表左边）
- [ ] 关闭按键（X）保持在右侧，点击关闭 `outputAreaVisibleAtom` 设为 false
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit`

### Task 11: 创建 AppLauncher 组件

**Files:**
- Create: `src/renderer/components/Conversation/AppLauncher.tsx`

- [ ] 创建下拉菜单组件：点击触发按键（Monitor 图标）展开菜单浮层
- [ ] 菜单项：Browser（Globe 图标）、Terminal（Terminal 图标）、Finder（FolderOpen 图标）
- [ ] 点击菜单项执行 `console.log('launch: <id>')`（桩），然后关闭菜单
- [ ] click-outside 关闭
- [ ] 浮层定位：按键下方右对齐，使用 `absolute` 定位
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit`

### Task 12: 创建 SystemInfoPopup 组件

**Files:**
- Create: `src/renderer/components/Conversation/SystemInfoPopup.tsx`

- [ ] 创建弹出浮层组件：点击触发按键（Info 图标）展开
- [ ] 浮层内容骨架：App 名 "AttaSeek"、版本 "0.1.0"、环境 "development"、主题、连接状态占位
- [ ] 浮层定位：fixed，按键下方右对齐（右上角区域）
- [ ] click-outside 关闭；再次点击 toggle
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit`

### Task 13: SessionHeader 三按键重构 + 消隐逻辑

**Files:**
- Modify: `src/renderer/components/Conversation/SessionHeader.tsx`

- [ ] 左边按键：渲染 `<AppLauncher />`
- [ ] 中间按键：渲染 `<SystemInfoPopup />` 的 toggle 按键
- [ ] 右边按键：使用 `PanelLeftClose` / `PanelLeftOpen` 图标（左右分隔样式）。点击设置 `outputAreaVisibleAtom` 为 true/false
- [ ] 读取 `outputAreaVisibleAtom`：当值为 true 时，右边按键设为 `invisible`（opacity-0 + pointer-events-none，保留占位空间）
- [ ] 从 import 和渲染中移除 ContextRing
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit && npx vitest run test/unit/components/SessionHeader.test.tsx`

### Task 14: AppLauncher 和 SystemInfoPopup 的位置调整

**Files:**
- Modify: `src/renderer/components/Conversation/AppLauncher.tsx`
- Modify: `src/renderer/components/Conversation/SystemInfoPopup.tsx`

- [ ] AppLauncher 下拉浮层确保在 SessionHeader 的三个按键右下方（不自带 toggle——toggle 在 SessionHeader 中）
- [ ] SystemInfoPopup 浮层确保在右上角（不自带 toggle——toggle 在 SessionHeader 中）
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit`

---

## Phase 3: 交互增强

### Task 15: 创建 outputFullscreenAtom

**Files:**
- Create: `src/renderer/atoms/outputFullscreenAtom.ts`

- [ ] 创建 `outputFullscreenAtom = atom<boolean>(false)`
- [ ] 验证命令: `npx vitest run test/unit/atoms/`

### Task 16: OutputArea 全屏展开

**Files:**
- Modify: `src/renderer/workspaces/ChatWorkspace.tsx`
- Modify: `src/renderer/components/OutputArea/OutputArea.tsx`

- [ ] `ChatWorkspace` 读取 `outputFullscreenAtom`。当 true 时：`WorkspaceLayout.Main` 设 `hidden`，`WorkspaceLayout.Right` 撑满 flex-1（覆盖式全屏）
- [ ] `OutputArea` 标题栏左侧 Maximize 按键点击时 toggle `outputFullscreenAtom`
- [ ] `WorkspaceRouter` 中 activity 切换时重置 `outputFullscreenAtom` 为 false（在 `WorkspaceMain` 中用 useEffect 监听 activity 变化）
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit`

### Task 17: 创建 ResizeHandle 组件

**Files:**
- Create: `src/renderer/layouts/ResizeHandle.tsx`

- [ ] 创建可拖拽分隔线组件。props: `onResize: (delta: number) => void`, `minWidth: number`, `maxWidth: number`
- [ ] `onMouseDown` 时记录 `startX`，在 `document` 上注册 `mousemove` 和 `mouseup` 监听器
- [ ] `mousemove` 时计算 `deltaX`，调用 `onResize(deltaX)`，更新 `startX` 为当前值
- [ ] 视觉：4px 宽、透明背景、hover 时变为 `var(--app-accent)`、`cursor: col-resize`
- [ ] `mouseup` 时清理 `document` 事件监听
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit`

### Task 18: 左/右边栏可拖拽宽度

**Files:**
- Modify: `src/renderer/layouts/WorkspaceLayout.tsx`
- Modify: `src/renderer/workspaces/ChatWorkspace.tsx`

- [ ] `WorkspaceLayout.Left` 内部集成 `ResizeHandle`——在右边框内侧渲染手柄
- [ ] `WorkspaceLayout.Right` 内部集成 `ResizeHandle`——在左边框内侧渲染手柄
- [ ] `ChatWorkspace` 用 `useState` 管理 sidebarWidth（默认 260）和 outputWidth（默认 400），传给 `WorkspaceLayout.Left` 和 `Right` 的 `width` 和 `onResize`
- [ ] `onResize` 回调中用 `Math.min(Math.max(...))` 约束在 min/max 范围内
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit`

### Task 19: 去除 Conversation 内输入区分隔线

**Files:**
- Modify: `src/renderer/components/Conversation/Composer.tsx`
- Modify: `src/renderer/components/Conversation/MessageFlow.tsx`

- [ ] `Composer` 最外层 div 的 `border-t border-[var(--app-border)]` 移除
- [ ] `Composer` padding 保留，自然间距替代视觉分隔线
- [ ] `MessageFlow` 底部增加 `pb-2` 使消息流与输入框之间自然留白
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit`

---

## Phase 4: Composer + 首页 + CHATS 标题

### Task 20: Composer 工具条 — 添加权限模式、推理、语音、⌘Enter

**Files:**
- Create: `src/renderer/atoms/composerSettingsAtom.ts`
- Modify: `src/renderer/components/Conversation/Composer.tsx`

- [ ] 创建 `composerSettingsAtom.ts`：`permissionModeAtom<'default'|'auto'|'trust'>` 和 `reasoningEffortAtom<'low'|'medium'|'high'>`
- [ ] Composer 最外层 div 保留（去掉 border-t 已在 Task 19 完成）
- [ ] 工具条重写为 CODEX 风格：
  - `+` 按键（Plus 图标），点击展开上下文菜单（@file / @folder / @agent / @plugin）
  - 权限模式标签（`permissionModeAtom` 循环切换：Default Review ▾ / Auto Review ▾ / Full Trust ▾）
  - 推理 effort 标签（`reasoningEffortAtom` 循环切换：Low ▾ / Medium ▾ / High ▾）
  - 语音按键（Mic 图标，桩）
  - spacer
  - ModelSelector
  - ⌘Enter 文字提示
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit && npx vitest run test/unit/components/Composer.test.tsx`

### Task 21: 首页重写 — 无侧栏，Quick Start 居中

**Files:**
- Modify: `src/renderer/workspaces/DashboardWorkspace.tsx`

- [ ] 顶部 40px 可拖动标题栏（`-webkit-app-region: drag`），显示 "AttaSeek" 文字
- [ ] 下方全幅内容区，flex-1 垂直居中
- [ ] 中央：Quick Start 输入框（textarea），placeholder "What do you want to build?"
- [ ] 去掉原来的统计卡片网格（Active Sessions 等占位）
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit`

### Task 22: CHATS 标题右侧 + 按键

**Files:**
- Modify: `src/renderer/workspaces/ChatsSidebar.tsx`

- [ ] 标题行：左侧 "CHATS" 文字（12px 小写加宽），右侧 `+` 按键（Plus 图标，16px）
- [ ] `+` 点击行为：重置 `composerValueAtom` 为空，切换到 Chat workspace（当前已在 Chat workspace，未来可扩展为新建会话）
- [ ] 标题行 `-webkit-app-region: drag`，按键 `no-drag`
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit`

---

## Phase 5: 清理 + 验证

### Task 23: 删除 ContextRing 文件

**Files:**
- Delete: `src/renderer/components/Conversation/ContextRing.tsx`

- [ ] 删除文件
- [ ] 确认无其他文件 import ContextRing（`grep -r "ContextRing" src/` 结果为空）
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit`

### Task 24: 更新测试

**Files:**
- Modify: `test/unit/components/Shell.test.tsx`
- Modify: `test/unit/components/Sidebar.test.tsx`
- Modify: `test/unit/components/SessionHeader.test.tsx`
- Modify: `test/unit/components/Composer.test.tsx`
- Modify: `test/unit/components/ActivityBar.test.tsx`

- [ ] `Shell.test.tsx`：更新为两列布局的断言。确认 ActivityBar 和 WorkspaceArea 渲染，不再查找 Sidebar 标题
- [ ] `Sidebar.test.tsx`：重写为 `ChatsSidebar.test.tsx`，测试 CHATS 标题、`+` 按键、ChatsList 内容
- [ ] `SessionHeader.test.tsx`：更新断言——无 ContextRing；三按键存在（AppLauncher toggle、Info toggle、PanelLeftClose toggle）
- [ ] `Composer.test.tsx`：更新断言——无 border-t；工具条包含 `+`、权限标签、推理标签、Mic、ModelSelector、⌘Enter
- [ ] `ActivityBar.test.tsx`：更新断言——无分隔线；无 chats 图标；图标数量减少
- [ ] 验证命令: `npx vitest run`

### Task 25: 全量验证

**Files:**
- 无（验证任务）

- [ ] `npx tsc -p tsconfig.web.json --noEmit` — 零错误
- [ ] `npx vitest run` — 全部通过
- [ ] `npm run build` — 构建成功
- [ ] 验证命令: `npx tsc -p tsconfig.web.json --noEmit && npx vitest run && npm run build`

---

## 自检

| # | 需求 | 对应 Task |
|---|------|----------|
| R1 | Activity Bar 背景加深 + 淡化分隔线 | T3 |
| R2 | Shell 两列布局 | T1, T2, T5, T6, T7 |
| R3 | 标题栏 40px + drag | T9, T10 |
| R4 | 左栏标题不重叠红绿灯 | T3 (spacer), T5 (ChatsSidebar drag 区域) |
| R5 | 首页无侧栏居中 | T6 (DashboardWorkspace), T21 |
| R6 | SessionHeader 去环 | T8 |
| R7 | 三按键 + 消隐 | T11, T12, T13, T14 |
| R8 | 输出区关闭在自身标题栏 | T10, T13 |
| R9 | AI 输出区全屏展开 | T15, T16 |
| R10 | 左右栏可拖拽宽度 | T17, T18 |
| R11 | Composer CODEX 化 | T20 |
| R12 | 去输入区分隔线 | T19 |
| R13 | 去 Activity Bar chats + CHATS `+` | T4, T22 |
