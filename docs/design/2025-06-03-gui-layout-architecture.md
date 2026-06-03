# GUI 布局调整 架构设计

**日期：** 2025-06-03
**基于需求：** [docs/requirements/2025-06-03-gui-layout-adjustment.md](../requirements/2025-06-03-gui-layout-adjustment.md)

---

## 组件结构

### 顶层布局树（After）

```
App
└── Shell                             ← 两列：ActivityBar + WorkspaceArea
    ├── ActivityBar                   ← 48px，背景加深，无显式分隔线
    └── #workspace-area               ← flex-1，全高。由 WorkspaceRouter 填充
        └── WorkspaceRouter           ← Activity → Workspace 分派
            ├── ChatWorkspace         ← [Left: ChatsSidebar(260px)] [Main: Conversation] [Right: OutputArea(400px)]
            ├── ProjectsWorkspace     ← [Left: FileTree(260px)] [Main: Conversation] [Right: OutputArea(400px)]
            ├── SettingsWorkspace     ← [Left: SettingsNav(220px)] [Main: SettingsContent]
            ├── DashboardWorkspace    ← [Main: Dashboard(全幅, 无侧栏)]
            ├── SearchWorkspace       ← [Main: SearchContent(全幅, 无侧栏)]
            ├── AutomationWorkspace   ← [Left: TaskList(260px)] [Main: Conversation]
            └── PluginWorkspace       ← [Left: PluginList(260px)] [Main: PluginDetail]
```

### 组件职责一览

| 组件 | 新/改/删 | 职责 |
|------|----------|------|
| **Shell** | 改 | 两列布局容器。左边 ActivityBar（固定 48px），右边 `#workspace-area`（flex-1）。不再持有 Sidebar 列、TitleBar |
| **ActivityBar** | 改 | 背景 `var(--app-bg-inset)`，取消分隔线。图标列表移除 `MessageSquareText`（chats） |
| **TitleBar** | 删 | 不再独立存在——各 Workspace 的左边栏或主区顶部自行包含标题栏/拖动区域 |
| **WorkspaceLayout** | 改 | `Left`/`Main`/`Right` 槽位增加拖拽分隔线能力。`Main` 增加拖动区域 props |
| **WorkspaceRouter** | 改 | 移除 `WorkspaceSidebar` 导出。Sidebar 路由改为各 Workspace 内部自行调用 |
| **ChatWorkspace** | 改 | 三区：左 ChatsSidebar（含 chats 标题+新建+列表），中 Conversation，右 OutputArea。左/右栏宽度可拖拽 |
| **ProjectsWorkspace** | 改 | 三区：左 FileTreeSidebar，中 Conversation，右 OutputArea |
| **SettingsWorkspace** | 改 | 两区：左 SettingsNav（220px），右 SettingsContent |
| **DashboardWorkspace** | 改 | 单区全宽。顶部拖动条，内容垂直居中 |
| **SearchWorkspace** | 改 | 单区全宽。顶部拖动条 |
| **AutomationWorkspace** | 改 | 两区：左 TaskList，右占位 |
| **PluginWorkspace** | 改 | 两区：左 PluginList，右占位 |
| **Conversation** | 改 | 去掉 `SessionHeader` 与 `MessageFlow` 之间的隐式依赖分隔。布局变为：SessionHeader / MessageFlow（无上 border）/ Composer（无上 border） |
| **SessionHeader** | 改 | 40px，可拖动窗口。去 ContextRing。三个右侧按键重构。右侧按键区固定宽度防跳动 |
| **MessageFlow** | 改 | 无变化（仅移除 AgentStatusBar 上方可能的 border） |
| **Composer** | 重写 | CODEX 风格：输入框（无上 border） + 工具条（`+` / 权限 / 推理 / 语音 / ⌘Enter） |
| **ContextRing** | 删 | 不再使用 |
| **ModelSelector** | 保留 | 位置从 Composer 工具条移到 SessionHeader 或保持在 Composer 中（设计决策见下） |
| **OutputArea** | 改 | 标题栏 40px，可拖动。Tab 列表 + 全屏/关闭按键。全屏展开覆盖 Conversation |
| **AppLauncher** | 新 | 下拉菜单：Browser / Terminal / Finder，受控 open/close |
| **SystemInfoPopup** | 新 | 右上角浮层：环境、版本、连接状态等骨架 |
| **ChatsSidebar** | 新 | 替换 `WorkspaceRouter.WorkspaceSidebar('chat')`——CHATS 标题行（左文字右 `+` 按键）+ ChatsList |
| **ResizeHandle** | 新 | 可拖拽分隔线组件：`onMouseDown` 启动拖拽，限制 min/max。左右方向复用 |

---

## 数据流

### 状态层级

```
全局（Jotai atoms）
  ├── themeAtom              主题：dark/light/system      (持久化)
  ├── activeActivityAtom     当前 activity                (内存)
  ├── settingsSectionAtom    设置子页面                    (内存)
  ├── outputTabsAtom         AI 输出区 tabs               (内存)
  ├── activeOutputTabAtom    当前输出 tab                  (内存)
  ├── outputAreaVisibleAtom  输出区可见                    (内存)
  ├── outputFullscreenAtom   输出区全屏 (新)               (内存)
  ├── composerValueAtom      输入文字                      (内存)
  ├── composerChipsAtom      上下文 chips                 (内存)
  ├── isAgentRunningAtom     agent 运行中                  (内存)
  ├── permissionModeAtom     权限模式 (新)                 (内存)
  └── reasoningEffortAtom    推理 effort (新)              (内存)

Workspace 本地状态（useState / useRef）
  ├── sidebarWidth          左边栏当前宽度 (各 workspace 独立)
  └── outputWidth           右边栏当前宽度 (各 workspace 独立)
```

### 关键数据流

**Activity 切换 → Workspace 变更**
```
ActivityBar click → setActiveActivity(id)
                         ↓
activeActivityAtom 变化 → Shell 重渲染
                         ↓
WorkspaceRouter 读取 activeActivityAtom → 选择对应 Workspace 组件
                         ↓
Workspace 挂载，各自从全局 atoms 读取所需状态
```

**输出区可见 → SessionHeader 按键消隐**
```
SessionHeader 点切换按键 → outputAreaVisibleAtom = true
                                ↓
SessionHeader 读取 outputAreaVisibleAtom → 切换按键消隐（opacity-0 + pointer-events-none 占位）
OutputArea 读取 outputAreaVisibleAtom → 显示面板
OutputArea 点关闭 → outputAreaVisibleAtom = false
                                ↓
SessionHeader 切换按键重新显示
```

**输出区全屏展开**
```
OutputArea 点 Maximize → outputFullscreenAtom = true
                                ↓
ChatWorkspace 读取 outputFullscreenAtom → WorkspaceLayout.Main 设为 hidden
                                     → WorkspaceLayout.Right 设为 flex-1 (占满)
OutputArea 再点 Maximize → outputFullscreenAtom = false → 恢复原布局
```

**Activity 切换 → 退出全屏**
```
activeActivityAtom 变化 → outputFullscreenAtom = false (workspace 切换时重置)
```

**拖拽调整宽度**
```
ResizeHandle onMouseDown → 记录 startX
         ↓
document.onMouseMove → deltaX = currentX - startX
         ↓
Workspace 本地 setSidebarWidth(prev + deltaX)
         ↓ 受 min/max 约束
document.onMouseUp → 清理 listener
```

---

## Jotai Atoms

### 新增

| Atom | 类型 | 作用范围 | 持久化 | 说明 |
|------|------|---------|--------|------|
| `outputFullscreenAtom` | `atom<boolean>` | 全局 | 否 | 输出区全屏状态。切换 activity 时重置为 false |
| `permissionModeAtom` | `atom<'default' \| 'auto' \| 'trust'>` | 全局 | 否（会话级） | 默认 `'default'`。CODEX 三档：Default Review / Auto Review / Full Trust |
| `reasoningEffortAtom` | `atom<'low' \| 'medium' \| 'high'>` | 全局 | 否 | 默认 `'medium'`。推理 effort 切换 |

### 修改

| Atom | 变更 |
|------|------|
| `outputAreaVisibleAtom` | 类型不变，消费方从 Shell 移到各 Workspace + SessionHeader |

### 移除

| 移除 | 原因 |
|------|------|
| 无 | — |

---

## 组件接口（Props / Exports）

### AppLauncher

```ts
// Props: 无（自包含 open/close state）
// 行为: 点击外部关闭，选中项 console.log 动作名（桩）
interface AppLauncherProps {}
// 内部 state: isOpen: boolean
// 菜单项: { id: 'browser' | 'terminal' | 'finder', label: string, icon: LucideIcon }
```

### SystemInfoPopup

```ts
interface SystemInfoPopupProps {}
// 内部 state: isOpen: boolean
// 浮层内容: 骨架 UI — App 名、版本、环境、连接状态
// 定位: fixed top-12 right-4
```

### ResizeHandle

```ts
interface ResizeHandleProps {
  direction: 'horizontal' // 未来可扩展 'vertical'
  onResize: (delta: number) => void
  min: number
  max: number
}
// 行为: onMouseDown 启动 document 级 mousemove/mouseup 监听
// 视觉: 4px 宽，hover 时变蓝，cursor: col-resize
```

### WorkspaceLayout 扩展

```ts
// Left / Right 增加 props:
interface SlotProps {
  children: ReactNode
  width: number           // 当前宽度 (px)，受 Workspace 本地 state 控制
  onResize: (delta: number) => void  // 拖拽回调
  minWidth?: number       // 默认 200 / 280
  maxWidth?: number       // 默认 400 / 600
  showResizeHandle?: boolean  // 默认 true，Dashboard 用 false
}
```

### Composer（新结构）

```ts
// 不再需要 interface 改动，内部结构完全重写
// 工具条:
//   [+] button → 展开上下文菜单 (file/folder/agent/plugin)
//   [permission tag] → 循环点击切换 → Default Review ▾ / Auto Review ▾ / Full Trust ▾
//   [reasoning tag] → 循环切换 → Reasoning ▾ (Low/Med/High)
//   [mic button] → 桩
//   spacer
//   [model selector] — 保留
//   ⌘Enter label
```

### SessionHeader（新结构）

```ts
// 无 ContextRing
// 三个按键:
//   左: AppLauncher (Monitor icon)
//   中: SystemInfoPopup toggle (Info icon)  
//   右: outputAreaVisible 切换 (PanelLeftClose/PanelLeftOpen icon)
//       当 outputAreaVisible=true 时此按键 invisible
// 整行 -webkit-app-region: drag（除按键区域设为 no-drag）
```

---

## IPC Contract

本次变更 **不涉及 IPC 新增**。语音按钮、App 启动器均为前端桩。

---

## 技术决策

| # | 决策 | 方案 | 理由 | 替代方案 |
|---|------|------|------|---------|
| D1 | Shell 不再持有 Sidebar | Workspace 自行从 WorkspaceLayout 组合左/右栏 | 各 workspace 自由度最大，Dashboard 无需 hack 隐藏 | Shell 传 `showSidebar: boolean`——但 Workspace 组合更清晰 |
| D2 | 拖拽用纯 React 状态 | `useState` + `onMouseMove` 本地状态，不写入 atom | 宽度是视觉偏好，不跨 session 持久化 | atomWithStorage 持久化——当前不需要，后续可加 |
| D3 | 右边栏关闭后 SessionHeader 按键消隐 | `opacity-0 pointer-events-none` 占位，非 `display:none` | 避免右侧按键区宽度跳动 | `visibility:hidden` 同样可行 |
| D4 | 全屏展开用 atom | `outputFullscreenAtom` 全局 atom，切换 workspace 时 reset | 全局状态，方便 Workspace 层读取决定布局 | 写在 OutputArea 本地 state——但 Workspace 需要知道是否全屏才能调整 flex |
| D5 | 去输入区分隔线 | `border-t` 移除，换为自然 padding 间距 | CODEX 风格，视觉更干净 | 保留但设为 transparent——不干净 |
| D6 | Activity Bar 去 chats 图标 | 只保留 `SquarePen` 作为对话入口 | `chat` 和 `new session` 语义重复，用户也指出了 | 保留 chats 但改行为——语义仍然重叠 |
| D7 | Activity Bar 背景用 `--app-bg-inset` | 与 输入框/inset 面板同色 | 统一视觉层次，已有 token 无需新增 | 新建专用 token——过度设计 |
| D8 | TitleBar 组件删除 | 各 Workspace 左/主区各自带 drag 区域 | TitleBar 原本只为 Sidebar 列服务，Sidebar 列已移入 Workspace | TitleBar 保留为通用组件——但不同 workspace 对 drag 区域需求不同 |
| D9 | 全屏展开 WorkSpace 负责布局切换 | ChatWorkspace 读 `outputFullscreenAtom`，CSS 切换 flex/grow | 单一 workspace 的布局逻辑集中在自身 | OutputArea 用 absolute 定位覆盖——可能遮挡 Conversation |
| D10 | ModelSelector 保留在 Composer | 位置不动，作为工具条的一部分 | CODEX 也把模型放在输入区附近；SessionHeader 已足够拥挤 | 移到 SessionHeader——但三按键+标题已满 |

---

## 实现顺序

```
Phase 1: 基础重构（无新功能，先把骨架调对）
  ├── P1.1  R2: Shell 两列布局 → 移除 Sidebar 列、TitleBar
  ├── P1.2  R1: ActivityBar 背景加深 + 去分隔线 + R13: 去 chats 图标
  ├── P1.3  R4: Traffic lights spacer 调整（28px → 与标题栏对齐）
  └── P1.4  各 Workspace 自行持有左/右边栏（先不实现拖拽）

Phase 2: 标题栏系统
  ├── P2.1  R3: SessionHeader / OutputArea 标题栏统一 40px + drag
  ├── P2.2  R6: SessionHeader 去掉 ContextRing
  └── P2.3  R7/R8: 三按键重构 + AppLauncher + SystemInfoPopup + 消隐

Phase 3: 交互增强
  ├── P3.1  R9: OutputArea 全屏展开
  ├── P3.2  R10: 左/右边栏拖拽调整宽度（ResizeHandle）
  └── P3.3  R12: 去输入区分隔线

Phase 4: Composer + 首页 + CHATS 标题
  ├── P4.1  R11: Composer CODEX 化
  ├── P4.2  R5: 首页重写（无侧栏，居中）
  └── P4.3  R13: CHATS 标题右侧 + 按键

Phase 5: 清理 + 验证
  ├── P5.1  删除 ContextRing 文件
  ├── P5.2  更新测试
  └── P5.3  typecheck + build + test
```

---

## 交接

架构设计完成，共 5 个 Phase。交接至 → `/write-plan`。
