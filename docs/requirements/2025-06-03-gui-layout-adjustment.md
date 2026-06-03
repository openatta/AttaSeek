# GUI 布局调整 需求分析（修订版）

**目标：** 修复 Activity Bar / 标题栏 / 工作区的视觉和交互问题；优化 SessionHeader 和 Composer 的交互，使其对齐 CODEX Desktop 参考实现。

**背景：** 上一轮完成了颜色 token 化和 workspace 架构重构，遗留以下问题：(a) Activity Bar 分隔线太突兀；(b) Shell 固定三列布局约束了工作区自由度；(c) SessionHeader 和 OutputArea 标题栏功能不完整；(d) Composer 布局偏离 CODEX 参考；(e) Activity Bar 上 `chat` 和 `new session` 语义重复。

---

## 范围

### In scope

| # | 需求 | 涉及模块 |
|---|------|---------|
| **R1** | Activity Bar 背景稍微加深，淡化分隔线——不再需要一条显式的横线，用渐隐或色差过渡替代 | ActivityBar, index.css |
| **R2** | Shell 框架重构：Activity + Workspace 两列。Workspace 自行决定是否要左边栏、是否要右边栏。Shell 不再固定持有 Sidebar 列 | Shell, WorkspaceRouter, 全部 7 个 Workspace |
| **R3** | 对话交互区标题栏和 AI 输出区标题栏统一高度（40px），均可拖动窗口 | SessionHeader, OutputArea |
| **R4** | 左边栏标题不与 macOS 红绿灯重叠。标题栏的 `traffic-lights-spacer` 区域和侧边栏内容区域有明确分隔 | TitleBar, WorkspaceSidebar |
| **R5** | 首页：无左边栏，Dashboard 全幅占满 Activity 右侧全部空间。Quick Start 垂直居中 | DashboardWorkspace |
| **R6** | Chat SessionHeader：移除上下文进度环；重构三个右侧按键 | SessionHeader（移除 ContextRing） |
| **R7** | 右侧按键交互：左边 = App 启动器下拉；中间 = 系统信息弹层；右边 = 显示/隐藏 AI 输出区。**打开输出区后，SessionHeader 上的右边按键消隐**，关闭操作移至 AI 输出区标题栏自身 | SessionHeader, OutputArea |
| **R8** | AI 输出区可见时，SessionHeader 的切换按键消失；关闭/隐藏操作在输出区标题栏右侧执行 | OutputArea, SessionHeader |
| **R9** | AI 输出区全屏展开：点击标题栏左侧 Maximize → 撑满 Conversation + OutputArea 的全部空间（覆盖替代式，参考 CODEX） | OutputArea（新 atom: `outputFullscreenAtom`） |
| **R10** | Workspace 左边栏和右边栏宽度可拖拽调整（分隔线可拖动） | WorkspaceLayout, ChatWorkspace 等 |
| **R11** | Composer 重构为 CODEX 风格：`+` 按钮（附加上下文/文件）；默认权限模式标签；推理 effort 切换；语音按钮；⌘+Enter 发送提示 | Composer（重写），新建 atoms |
| **R12** | 保留模型选择器和命令提示（`@file @folder /plan /review...`）。**移除输入区与消息流之间的显式分隔线**——输入区自然上升，消息与输入之间的空白作为视觉隔断。参考 CODEX Desktop 做法 | Composer, MessageFlow, Conversation |
| **R13** | Activity Bar 去掉 `chat` 图标，合并到 `new session`（`SquarePen` 图标）。"添加对话"和"对话列表"统一入口：左边栏 CHATS 标题右侧添加 `+` 按键，右对齐，用于新对话 | ActivityBar, WorkspaceSidebar/ChatsList |

### Out of scope

- 各面板的具体功能实现（文件树、终端、浏览器内容）
- App 下拉的实际进程启动（UI 完成，动作留桩）
- 系统信息弹层的实际数据（UI 骨架）
- 拖拽标签拆出独立窗口、Side Chat、Fork
- 语音按钮的实际录音/转发（UI 完成，动作留桩）

### 依赖

- `themeAtom`, `activityAtom`, `outputTabsAtom`, `outputAreaVisibleAtom`
- 已有 `WorkspaceLayout.Left/Main/Right` 槽位
- 已有 `WorkspaceRouter`
- Electron `hiddenInset` 标题栏模式

### 涉及面板/文件

**修改：**
- `ActivityBar.tsx` — 去 chat 图标，背景加深，分隔线淡化
- `TitleBar.tsx` — 高度/拖拽调整
- `Shell.tsx` — 重构为两列
- `WorkspaceRouter.tsx` — 大改，不再路由 Sidebar
- `WorkspaceLayout.tsx` — 加拖拽分隔线
- 全部 7 个 Workspace — 各自持有左边栏/右边栏
- `SessionHeader.tsx` — 去环，三按键重构，消隐逻辑
- `Conversation.tsx` — 去分隔线
- `Composer.tsx` — 重写为 CODEX 风格
- `OutputArea.tsx` — 全屏展开，标题栏拖动，关闭按键
- `index.css` — Activity Bar 新 token

**新建：**
- `AppLauncher.tsx` — 应用下拉菜单
- `SystemInfoPopup.tsx` — 系统信息浮层
- `outputFullscreenAtom.ts` — 全屏状态

---

## 用户场景

### S1: 首次打开（浅色主题，Chat 默认）

1. 用户打开 AttaSeek
2. **Activity Bar**：48px 宽，背景色比侧边栏/工作区**略深**（如 `--app-bg-inset`），与 TitleBar 形成统一的标题栏条。**无可见分隔线**——导航图标与插件区之间用留白自然分隔，不再需要 `h-px` 横线
3. **TitleBar**：高 40px，三按键在其左侧。左边栏标题 `CHATS` 在标题栏下方，不与红绿灯重叠
4. **Sidebar**：260px，CHATS 标题左侧是文字，右侧是 `+` 新建按键（右对齐）
5. **主画布**：Conversation（SessionHeader + MessageFlow + Composer）+ 右侧 OutputArea
6. **SessionHeader**：40px，左侧会话标题，右侧三个按键（无 ContextRing）
7. **Composer**：输入框上方无分隔线，消息流自然过渡至输入区。输入框下方一行：左侧 `+` + 权限模式 + 推理 + 语音；右侧 `⌘Enter`
8. **OutputArea**：40px 标题栏，Tab 区 + 全屏/关闭按键

### S2: 窗口拖动

1. 拖拽 SessionHeader 标题区域 → 移动窗口
2. 拖拽 OutputArea 标题栏区域 → 同样移动窗口
3. 两者同高（40px）

### S3: 三按键 + 消隐

1. 左侧（App 下拉）：点击弹出 [Browser, Terminal, Finder]
2. 中间（系统信息）：点击弹出右上角浮层
3. 右侧（切换输出区）：点击 → OutputArea 打开，**此按键从 SessionHeader 消失**。关闭操作：点击 OutputArea 标题栏右侧的关闭按键
4. OutputArea 关闭后，SessionHeader 的切换按键重新出现

### S4: 全屏展开

1. 点击 OutputArea 标题栏 Maximize → 撑满 Conversation + OutputArea 全部空间
2. 再点 → 恢复原布局
3. 切换到其他 Activity 时自动退出全屏

### S5: 首页

1. 无左边栏、无右边栏，Dashboard 全幅占满
2. Quick Start 输入框垂直居中
3. 顶部有可拖动标题区域

### S6: 拖拽调整宽度

1. 拖拽左边栏右边界 → 左边栏宽度在 200px~400px 间变化
2. 拖拽右边栏左边界 → 右边栏宽度在 280px~600px 间变化

### S7: 新对话

1. Activity Bar 点 `SquarePen` → 新建会话（Chat workspace 切换至此新会话）
2. Chat workspace 左边栏 CHATS 标题右侧点 `+` → 同样新建会话
3. Activity Bar 无独立的"对话列表"图标；对话列表 = Chat workspace 的左边栏内容

### S8: 边界条件

1. 极窄窗口（<900px）：OutputArea 自动隐藏
2. 主题切换：全部颜色正确响应
3. 浮层 click-outside 关闭
4. 全屏中切换 Activity → 退出全屏

---

## R1 细节：Activity Bar 颜色方案

| 当前 | 目标 |
|------|------|
| 背景与 Sidebar 同为 `var(--app-bg)` | 背景略深，用 `var(--app-bg-inset)` |
| 分隔线 `w-6 h-px bg-[var(--app-border-muted)]` | 取消分隔线。导航图标区与插件区之间用 `gap`/`padding` 留白自然分隔 |

浅色模式下 `--app-bg-inset` = `#f5f5f5`（比 `--app-bg` = `#ffffff` 略深），深色模式 `--app-bg-inset` = `#1f1f1f`（比 `--app-bg` = `#0a0a0a` 略浅）。

## R11 细节：CODEX 风格 Composer

参考 CODEX Desktop 输入区布局：

```
┌──────────────────────────────────────────────────────────┐
│ (message flow — no border here, natural spacing)         │
│                                                          │
│ > 输入文字…                                              │ ← 输入框，无上边框
│                                                          │
│ [+]  [Default Review ▾]  [Reasoning ▾]  [Mic]    ⌘Enter │ ← 工具条
└──────────────────────────────────────────────────────────┘
```

- `+`：点击展开上下文菜单（@file, @folder, @agent, @plugin 等）
- `Default Review ▾`：权限模式切换下拉（Default Review / Auto Review / Full Trust）
- `Reasoning ▾`：推理 effort（Low / Medium / High）
- `Mic`：语音输入（UI 占位）
- 右侧：`⌘Enter` 发送提示
- 输入框与消息流之间**无分隔线**——自然空白作为视觉断点
- 模型选择器保留（可能在工具条中或 SessionHeader 中）

## R13 细节：Activity Bar 图标调整

**Before:**
```
top:
  Command (home)
  SquarePen (new session)    ← 去掉这个
  MessageSquareText (chats)  ← 或去掉这个
  Search
  Zap
  Plug2
  FolderGit2
```

**After:**
```
top:
  Command (home)
  SquarePen (new session)    ← 保留，新建对话即进入 chat workspace
  Search
  Zap
  Plug2
  FolderGit2
```

去掉 `MessageSquareText` (chats)。`SquarePen` 是唯一对话入口——点击 = 新建会话并切换到 Chat workspace（左边栏即对话列表）。

## 变更汇总

| 变更点 | 类型 | 文件 |
|--------|------|------|
| Activity Bar 背景加深 | 修改 | `ActivityBar.tsx`, `index.css` |
| Activity Bar 去分隔线 | 修改 | `ActivityBar.tsx` |
| Activity Bar 去 chat 图标 | 修改 | `ActivityBar.tsx`, `activityAtom.ts` |
| Shell 两列布局 | 修改 | `Shell.tsx` |
| Workspace 自行持有 Sidebar | 重构 | `WorkspaceRouter.tsx`, 全部 Workspace |
| 左边栏/右边栏可拖拽 | 增强 | `WorkspaceLayout.tsx` |
| 标题栏拖动 | 修改 | `SessionHeader.tsx`, `OutputArea.tsx` |
| SessionHeader 去环 | 修改 | `SessionHeader.tsx` |
| 三按键行为 + 消隐 | 新建+修改 | `SessionHeader.tsx`, `AppLauncher.tsx`, `SystemInfoPopup.tsx` |
| OutputArea 全屏 | 增强 | `OutputArea.tsx`, `outputFullscreenAtom.ts` |
| Composer CODEX 化 | 重写 | `Composer.tsx` |
| 去输入区分隔线 | 修改 | `Conversation.tsx`, `Composer.tsx` |
| 左边栏 CHATS + 新建 | 修改 | `WorkspaceRouter.tsx`, `ChatsList.tsx` |
| 首页无侧栏 | 修改 | `DashboardWorkspace.tsx` |
| 全屏切换 | 增强 | `OutputArea.tsx` |

## 风险

| 风险 | 缓解 |
|------|------|
| 拖拽分隔线需处理 drag 事件在 Electron 的 `-webkit-app-region: drag` 区域冲突 | 分隔线不设置 drag，用独立的 `onMouseDown` 实现 resize |
| Activity Bar 颜色变更可能与其他面板对比不一 | 使用已有 token `--app-bg-inset`，已在 Settings/Composer 中使用，色调一致 |
| Composer 重构后状态管理复杂度上升 | 新增权限模式/推理 atom 保持独立，不耦合到现有 composerAtom |
| R7/R8 消隐逻辑可能导致 SessionHeader 按钮跳动 | 右侧按键区固定宽度（place-holder），消失后用 invisible 占位而非移除 DOM |

---

## 交接

需求已完整，共 13 项，无歧义。交接至 → `/design-architecture`。
