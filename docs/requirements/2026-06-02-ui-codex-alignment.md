# UI 对齐 Codex Desktop 需求说明

> **创建日期：** 2026-06-02
> **作者：** xbits
> **状态：** 已确认
> **参考：** OpenAI Codex Desktop — Settings Panel、Activity Bar、Session Header、Composer、Review Panel、Terminal、Browser、File Explorer
> **调研覆盖：** 15+ 信息源，含官方文档 (developers.openai.com/codex)、deepwiki 社区拆解、实测截图文章

---

## 1. 概述

### 1.1 目标

将 AttaSeek 的 UI **一次性对齐** OpenAI Codex Desktop 的核心能力和视觉规范。覆盖七大改造域：Settings 面板（多分类）→ 深色/浅色主题 → ActivityBar 重构（真实图标+Chats）→ Conversation Header（三键布局）→ 输入区（Composer）→ AI 输出区（四面板 Tab 系统）→ 标题栏统一高度。

### 1.2 背景

Codex Desktop 是 OpenAI 在 2025–2026 年主推的 AI Agent 工作台桌面应用。其 GUI 承载了"多线程对话 + 项目管理 + 插件生态 + 自动化 + 全局设置"的完整工作流。AttaSeek 的设计参考源头就是 Codex Desktop（见 `CLAUDE.md` 和 `docs/ui.md`）。

根据调研，Codex Desktop 的 GUI 关键特征：

- **左侧 Activity Bar**：New Chat → Chats → Search → Plugins → Automations → Skills → Projects；底部 Settings
- **Settings 面板**（`Cmd+,`）：14 个分类，左侧导航+右侧内容区
- **Appearance**：深色/浅色基础主题 + 自定义 accent/background/foreground + UI/Code 字体
- **Conversation Header**：左侧可编辑标题 + 中央上下文用量环形指示器 + 右侧模型选择器/权限模式/应用按键
- **Composer 输入区**：多行自动扩展 + @mentions + /commands + 模型选择器 + Plan Mode + context chips + Send/Stop
- **AI 输出区**：多 Tab 面板系统 — Browser / Files / Terminal / Review
- **Review Panel**：右侧展示 Agent 对文件的所有变更（Git worktree diff），支持行级接受/拒绝
- **Terminal Panel**：每个项目独立内置终端，支持多终端标签
- **Browser Panel**：内嵌浏览器，用户可直接在页面上评论
- **File Explorer**：文件树，支持文件夹展开/折叠、右键菜单

### 1.3 用户角色

| 角色 | 说明 |
|------|------|
| AttaSeek 用户 | 日常使用 AI Agent 工作台进行代码开发、审查、终端操作的开发者 |

---

## 2. 功能范围

### 2.1 In Scope（本次做）

#### A. Settings 面板

多分类设置页，左侧导航 + 右侧内容区。涵盖 10 个分类：

| 分类 | 说明 |
|------|------|
| General | 文件打开行为、命令输出详细度、`Cmd+Enter` 发送、运行时禁止休眠 |
| Profile | 会话统计（lifetime tokens / peak tokens / streaks / longest task） |
| Appearance | 基础主题（Dark/Light/System）+ 强调色 + UI 字体 + Code 字体 + 主题预览 |
| Configuration | Agent 配置：模型选择、reasoning effort、approval policy、sandbox mode |
| Personalization | 个性语气（Friendly/Pragmatic/None）+ 自定义指令 |
| Keyboard Shortcuts | 快捷键列表 + 搜索 + 自定义/重置 |
| Notifications | Turn 完成通知开关 |
| Agent Config | 模型、审批策略、沙盒模式、计划模式默认值 |
| Git | 分支命名规范、Force Push 开关、Commit/PR 描述模板 |
| Integrations | MCP 服务器列表 + 启用/禁用 + 添加自定义服务器 |

#### B. 深色/浅色主题

- 支持 Dark / Light / System 三种模式
- 在 Appearance Settings 中切换，**即时生效**
- CSS 变量方案，覆盖 Tailwind 4 的默认色板
- 完整色板对照表见 §6.5

#### C. ActivityBar 重构

- 在现有 7 项之上增加 **Chats（对话列表）** 入口，位于 New 之下
- **全部图标改用 Lucide React**（社区标准图标库，Phosphor 备选）
- 图标映射见 §6.1

#### D. Conversation Header（三键布局）

- 左侧：可编辑的当前对话标题
- 中央：上下文用量环形指示器（悬停展开详情浮层）
- 右侧：三个功能按键
  - **应用面板** — 打开/切换到 Browser / Files / Terminal / Review
  - **环境信息** — 显示/关闭当前对话上下文详情（文件、模型、token 用量）
  - **AI 输出区域** — 显示/关闭下方 AI 输出区域

#### E. 输入区（Composer）

完整的 Agent 对话输入区：

- 多行自动扩展（最大 40% 面板高度）
- `@` 提及系统：@file / @folder / @agent / @plugin
- `/` 命令系统：/plan /review /explain /fix /diff /side
- 附加上下文 Chip（文件、文件夹），每个可 × 删除
- 模型选择器（下拉）与权限模式切换（循环按钮）
- Plan Mode 开关
- Send 按钮（Enter 发送，Shift+Enter 换行）
- Stop 按钮（Agent 运行时显示，中断执行）
- 麦克风按钮占位（语音输入预留）

#### F. AI 输出区（四面板 Tab 系统）

可拖拽面板区的下半部分，以 Tab 页签形式承载四个功能面板：

| Tab | 功能 | 实现依赖 |
|-----|------|---------|
| **Browser** | 内嵌浏览器，预览 Web 应用 / HTML / 图片 / PDF | Electron `<webview>` 或 `iframe` |
| **Files** | 文件树 + Monaco Editor 代码查看/编辑 | Monaco Editor |
| **Terminal** | 集成终端，支持多标签、命令历史 | xterm.js |
| **Review** | Diff 审查面板，行级接受/拒绝，与 Codex Review Panel 对齐 | Monaco Editor Diff 模式 |

每个 Tab：
- 点击切换
- 可拖拽排序
- 可 × 关闭
- 可拖出到新面板（触发分栏）
- 右键菜单：关闭 / 关闭其他 / 关闭右侧 / 移动到新面板

#### G. 标题栏统一高度

三个区域（TitleBar / Sidebar 顶 / Conversation Header）的标题栏高度均为 **40px**。仅 Conversation Header 有底部横线。

#### H. 消息显示格式

对话流中不同类型消息的渲染规范：

| 消息类型 | 视觉表现 |
|---------|---------|
| **用户消息** | 右对齐气泡（或左对齐纯文本），中性色背景 |
| **Agent 文本** | 左对齐，Markdown 渲染（标题/列表/代码块/表格） |
| **Agent 计划** | 可折叠步骤卡片，"展开计划详情 ▸" |
| **工具调用卡片** | 可折叠结果卡片，一行摘要 + 展开后完整输入/输出，撤销按钮（↩） |
| **Inline Diff 卡片** | Monaco Diff 内联渲染，行级 [接受]/[拒绝] 按钮 |
| **权限确认** | 内联在消息流中，不弹模态框：[允许本次] [允许本会话] [拒绝] [查看详情] |
| **错误/警告** | Agent 消息旁错误指示器 + [重试] [跳过] [复制日志] |
| **上下文用量提示** | 接近上限时的紧凑警告条 |

#### I. Chats Sidebar 内容

ActivityBar 点击 Chats 后，Sidebar 显示对话列表：

```
┌─ Chats ──────────────────────┐
│ 搜索会话...              [+]  │
│──────────────────────────────│
│ 筛选: [全部] [进行中] [归档]   │
│──────────────────────────────│
│ ▼ 项目名 A                    │
│   ├ 重构 api 模块       2h    │
│   ├ 写测试用例           5h    │
│ ▼ 项目名 B                    │
│   ├ 修连接 Bug          1d    │
│ ● 无项目                      │
│   └ 随便聊聊             6d    │
└──────────────────────────────┘
```

### 2.2 Out of Scope（本次不做）

- Codex Pets（桌面宠物动画）
- Computer Use（macOS 屏幕操控 / 虚拟光标）
- Automations 实际实现（定时任务引擎）
- 真实 MCP 服务器连接和 OAuth 流程
- 实际模型切换逻辑（仅 UI 控件占位）
- 插件市场完整功能（仅保留入口图标）
- Git 操作实际实现（仅 UI 占位）
- 语音输入实际功能（仅麦克风按钮占位）
- 实际 Agent 后端对接（消息为 mock 数据）

---

## 3. 用户场景

### 3.1 完整工作流 — 打开项目并与 Agent 协作

```
1. 用户启动 AttaSeek
2. ActivityBar 显示 8 个导航图标（含 Chats）
3. 用户点击 Chats → Sidebar 显示历史对话列表（按项目分组）
4. 用户点击某条对话或 [+]
5. Conversation 面板加载：
   - SessionHeader：对话标题 + 上下文用量环 + 三键
   - MessageFlow：历史消息流（用户/AI/工具调用/Diff）
   - Composer：输入框 + 模型选择器 + Plan Mode
6. 用户在 Composer 中 @file 选择文件，输入 "/review 请审查这个 PR"
7. Agent 回复，在 AI 输出区 Review Tab 中展示 Diff
8. 用户点击 Review Tab → 逐行审查 → 接受/拒绝
9. 用户点击 Terminal Tab → 运行测试命令验证
```

### 3.2 主题切换

```
1. 用户点击 ActivityBar 底部 Settings
2. Sidebar 切换为 10 个分类导航
3. 用户点击 Appearance
4. Canvas 显示：Base Theme 选择（Dark / Light / System）+ 强调色 + 字体
5. 用户选择 Light
6. 整个应用即时切换为浅色主题
7. 主题选择自动持久化（localStorage），下次启动保持
```

### 3.3 AI 输出区面板操作

```
1. Agent 正在输出中
2. 用户点击 SessionHeader 右侧"应用面板"按键 → Terminal Tab 高亮
3. 下方 AI 输出区显示 Terminal 面板
4. 用户输入命令 `npm test`，回车执行
5. 用户点击 Files Tab → 切换到文件树 + 编辑器
6. 用户双击某文件 → 在 Monaco 中打开
7. 用户拖拽 Files Tab 到右侧 → 分栏显示（左 Conversation 右 Files）
8. 用户点击 Browser Tab → 内嵌浏览器打开 localhost:3000 预览
```

### 3.4 异常流程

| 异常 | 触发条件 | 预期行为 |
|------|---------|---------|
| 主题切换失败 | CSS 变量未就绪 | 回退到系统默认暗色 |
| Lucide 图标加载失败 | 包未安装/版本不匹配 | 显示文字占位符 |
| Browser Tab 加载失败 | URL 不可达 | 显示连接失败提示 + 重试按钮 |
| Terminal 连接断开 | 子进程退出 | 显示退出码 + 重新连接按钮 |

### 3.5 边界条件

- 极小窗口（< 900px 宽）：Conversation Header 三键收折为 "..." 菜单
- 标题过长：截断显示，末尾 "..."
- AI 输出区无 Tab：显示空状态引导 + 快捷入口
- 大量消息（1000+）：虚拟滚动按需渲染
- 超大文件 Diff（10000+ 行）：Monaco 原生分页渲染

---

## 4. 涉及范围（Electron 三层）

### 4.1 主进程 (`src/main/`)

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/main/index.ts` | 修改 | BrowserWindow 监听 nativeTheme 变化，通知渲染进程 |
| `src/main/ipc/theme.ts` | 新建 | theme:get / theme:set handler（预留 nativeTheme API） |

### 4.2 预加载 (`src/preload/`)

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/preload/index.ts` | 修改 | 暴露 theme API + terminal API 占位 |
| `src/preload/index.d.ts` | 修改 | 新增类型声明 |

### 4.3 渲染进程 (`src/renderer/`)

| 文件/组件 | 变更类型 | 说明 |
|-----------|---------|------|
| `src/renderer/App.tsx` | 修改 | ThemeProvider + Settings 模式路由 |
| `src/renderer/atoms/themeAtom.ts` | 新建 | 主题状态持久化 |
| `src/renderer/atoms/activityAtom.ts` | 修改 | 增加 chats + settings sections |
| `src/renderer/atoms/composerAtom.ts` | 新建 | Composer 状态 |
| `src/renderer/atoms/outputTabsAtom.ts` | 新建 | AI 输出区 Tab 管理 |
| `src/renderer/assets/index.css` | 修改 | 浅色主题变量 + 消息样式 |
| `src/renderer/layouts/Shell.tsx` | 修改 | 集成 Settings / AI Output 面板 |
| **ActivityBar** |
| `src/renderer/components/ActivityBar/ActivityBar.tsx` | 重构 | 增加 Chats，全部换 Lucide |
| **TitleBar** |
| `src/renderer/components/TitleBar/TitleBar.tsx` | 修改 | 统一 40px 高度，无底部分割线 |
| **Sidebar** |
| `src/renderer/components/Sidebar/Sidebar.tsx` | 重构 | 支持 Chats 列表 / Settings 导航 / 通用 placeholder |
| `src/renderer/components/Sidebar/ChatsList.tsx` | 新建 | 对话列表（分组、筛选、搜索） |
| **Conversation** |
| `src/renderer/components/Conversation/SessionHeader.tsx` | 重构 | 三键布局 + 上下文用量环 |
| `src/renderer/components/Conversation/Conversation.tsx` | 修改 | 集成 AI 输出区分栏 |
| **Composer（输入区）** |
| `src/renderer/components/Conversation/Composer.tsx` | 重构 | 完整输入区：@mentions、/commands、context chips、模型选择器、Plan Mode、Send/Stop |
| `src/renderer/components/Conversation/ComposerMentions.tsx` | 新建 | @ 提及下拉浮层 |
| `src/renderer/components/Conversation/ComposerCommands.tsx` | 新建 | / 命令下拉浮层 |
| `src/renderer/components/Conversation/ContextChip.tsx` | 新建 | 上下文 Chip 组件 |
| **消息显示** |
| `src/renderer/components/Conversation/MessageFlow.tsx` | 重构 | 多消息类型渲染 |
| `src/renderer/components/Conversation/UserMessage.tsx` | 新建 | 用户消息气泡 |
| `src/renderer/components/Conversation/AgentMessage.tsx` | 新建 | Agent Markdown 渲染 |
| `src/renderer/components/Conversation/ToolCallCard.tsx` | 重构 | 可折叠卡片 + 撤销按钮 |
| `src/renderer/components/Conversation/InlineDiffCard.tsx` | 新建 | 内联 Diff 卡片 + 接受/拒绝 |
| `src/renderer/components/Conversation/PermissionInline.tsx` | 重构 | 权限确认内联 |
| **AI 输出区（四面板）** |
| `src/renderer/components/OutputArea/OutputArea.tsx` | 新建 | AI 输出区容器 + Tab 栏 |
| `src/renderer/components/OutputArea/BrowserPanel.tsx` | 新建 | 内嵌浏览器面板 |
| `src/renderer/components/OutputArea/FilesPanel.tsx` | 新建 | 文件树 + 编辑器面板 |
| `src/renderer/components/OutputArea/TerminalPanel.tsx` | 重构 | 集成终端面板 |
| `src/renderer/components/OutputArea/ReviewPanel.tsx` | 新建 | Diff 审查面板 |
| **Settings** |
| `src/renderer/components/Settings/Settings.tsx` | 新建 | Settings 主组件 |
| `src/renderer/components/Settings/SettingsSidebar.tsx` | 新建 | 分类导航 |
| `src/renderer/components/Settings/GeneralSettings.tsx` | 新建 | General 页 |
| `src/renderer/components/Settings/ProfileSettings.tsx` | 新建 | Profile 页 |
| `src/renderer/components/Settings/AppearanceSettings.tsx` | 新建 | Appearance 页（含主题切换预览） |
| `src/renderer/components/Settings/ConfigurationSettings.tsx` | 新建 | Configuration 页 |
| `src/renderer/components/Settings/PersonalizationSettings.tsx` | 新建 | Personalization 页 |
| `src/renderer/components/Settings/KeyboardSettings.tsx` | 新建 | Keyboard Shortcuts 页 |
| `src/renderer/components/Settings/NotificationsSettings.tsx` | 新建 | Notifications 页 |
| `src/renderer/components/Settings/AgentSettings.tsx` | 新建 | Agent Config 页 |
| `src/renderer/components/Settings/GitSettings.tsx` | 新建 | Git 页 |
| `src/renderer/components/Settings/IntegrationsSettings.tsx` | 新建 | Integrations 页 |

---

## 5. 涉及面板汇总

> 几乎每个面板都有变更。以下标记变更级别：
> **N** = New（新建）/ **R** = Refactor（重构）/ **M** = Modify（修改）

| 面板/模块 | 变更 | 关键改动 |
|-----------|------|---------|
| **ActivityBar** | R | +Chats，全部换 Lucide 图标 |
| **TitleBar** | M | 统一 40px，去底部横线 |
| **Sidebar** | R | Chats 列表 / Settings 导航 / 通用 placeholder |
| **Sidebar → ChatsList** | N | 对话列表（分组、筛选、搜索） |
| **Conversation Header** | R | 三键布局 + 上下文用量环 |
| **Composer** | R | 完整输入区：@、/、chips、model selector、plan mode、send/stop |
| **MessageFlow** | R | 多消息类型：user/agent/tool/diff/permission |
| **UserMessage** | N | 用户消息气泡 |
| **AgentMessage** | N | Agent Markdown 渲染 |
| **ToolCallCard** | R | 可折叠 + 撤销按钮 ⬆ |
| **InlineDiffCard** | N | 内联 Diff + 接受/拒绝 |
| **PermissionInline** | R | 三档授权：本次/本会话/拒绝 |
| **OutputArea** | N | 四面板 Tab 系统容器 |
| **BrowserPanel** | N | 内嵌浏览器 |
| **FilesPanel** | N | 文件树 + Monaco 编辑器 |
| **TerminalPanel** | R | xterm.js 集成终端（多标签） |
| **ReviewPanel** | N | Diff 审查面板（Monaco Diff） |
| **Settings** | N | 10 分类配置面板 |
| **SettingsSidebar** | N | 分类导航列表 |
| **Settings × 10 pages** | N | 每个分类一页 |

---

## 6. 交互设计

### 6.1 ActivityBar 图标映射（Lucide React）

```
┌──────────┐
│ Command  │  ← 仪表盘 (Cmd+0)
│ SquarePen│  ← 新建会话 (Cmd+N)
│ MessageSquareText│← Chats 对话列表 (Cmd+5) [新增]
│ Search   │  ← 全局搜索 (Cmd+Shift+F)
│ Zap      │  ← 自动化 (Cmd+3)
│ Plug2    │  ← 插件 (Cmd+4)
│ FolderGit2│ ← 项目列表 (Cmd+6)
│──────────│  ← 分隔线
│ Puzzle   │  ← 已安装插件 A
│ Puzzle   │  ← 已安装插件 B
│          │
│ Settings │  ← 全局设置 (Cmd+,)
└──────────┘
```

### 6.2 Settings 面板布局

```
┌─ Sidebar (260px) ────┬─ Settings Canvas ───────────────────────────┐
│ ⚙ Settings           │                                              │
│ ────────────────────  │   当前选中分类的配置表单                       │
│ ● General            │                                              │
│ ○ Profile            │   ┌─ General ──────────────────────────────┐│
│ ○ Appearance         │   │  File open behavior:  [dropdown ▾]     ││
│ ○ Configuration      │   │  Command verbosity:   [dropdown ▾]     ││
│ ○ Personalization    │   │  ☐ Require ⌘+Enter to send             ││
│ ○ Keyboard Shortcuts │   │  ☐ Prevent sleep while running         ││
│ ○ Notifications      │   └────────────────────────────────────────┘│
│ ○ Agent Config       │                                              │
│ ○ Git                │                                              │
│ ○ Integrations       │                                              │
└───────────────────────┴──────────────────────────────────────────────┘
```

### 6.3 Conversation Header 三键布局

```
┌─ SessionHeader (40px，仅此区域有底部横线) ─────────────────────────────┐
│                                                                        │
│ ✎ 当前对话标题                    ◉ 82% ████░░  [⬡] [◉] [▶]           │
│                                                                        │
└─┬──────────────────────────────────────────────────────────────────┬───┘
  │ (border-b border-neutral-800)                                    │

按键功能对照（对齐 Codex Desktop）：

| 按键 | 图标 (Lucide) | 功能 | Codex 对应 |
|------|-------------|------|-----------|
| **应用面板** | `Monitor` | 打开/切换到 AI 输出区面板（Browser/Files/Terminal/Review） | Codex 应用按键区（Term/Diff/Brow） |
| **环境信息** | `Info` | 显示/关闭上下文详情浮层（当前文件列表、模型名、token 用量、会话时长） | Codex 上下文用量环形指示器（点击展开详情浮层） |
| **AI 输出区** | `PanelBottom` | 显示/关闭下方 AI 输出区域整体（折叠/展开动画 250ms） | Codex 的 Diff/Review 面板折叠功能 |

上下文用量环形指示器：
- 位于标题和右侧按键之间
- 圆形环形进度（circular ring gauge），填充比例 = 已用 / 总量
- 悬停展开详情浮层：已用 tokens / 剩余 tokens / 总量 / 自动压缩阈值 / [立即压缩]
- 超过 80% 变橙色，超过 95% 变红色
```

### 6.4 Composer 输入区

```
┌─ Composer ────────────────────────────────────────────────────────────┐
│                                                                        │
│ ┌─ Context Chips ─────────────────────────────────────────────────┐   │
│ │ [📄 src/api.ts ×] [📄 src/db.ts ×] [🖼️ arch.png ×]              │   │
│ └──────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│ ┌──────────────────────────────────────────────────────┐ [Opus ▾] [⚡] │
│ │ > 请审查这个 PR 的变更...                              │              │
│ │                                                      │              │
│ │                                                      │              │
│ └──────────────────────────────────────────────────────┘              │
│                                                                        │
│  @file · @folder · @agent · @plugin    /plan · /review · /explain ·   │
│  /fix · /diff · /side                                                    │
│                                                              [▶ 发送]  │
│                                                              [■ 停止]  │
└──────────────────────────────────────────────────────────────────────────┘
```

**@ 提及系统：**

| 命令 | 行为 |
|------|------|
| `@file` | 弹出文件搜索浮层，选择后添加文件 Chip |
| `@folder` | 弹出文件夹搜索浮层 |
| `@agent` | 引用另一个 Agent |
| `@plugin` | 调用插件能力 |

**/ 命令系统：**

| 命令 | 行为 |
|------|------|
| `/plan` | 切换 Plan Mode（先规划后执行） |
| `/review` | 请求 Agent 审查当前 Diff |
| `/explain` | 请求 Agent 解释代码 |
| `/fix` | 请求 Agent 修复问题 |
| `/diff` | 查看当前变更 Diff |
| `/side` | 打开 Side Chat（临时提问，不干扰主流程） |
| `/compact` | 手动压缩上下文 |

**控件说明：**

| 控件 | 位置 | 功能 |
|------|------|------|
| 模型选择器 [Opus ▾] | 输入框上方右侧 | 下拉选择模型，切换即时生效 |
| Plan Mode [⚡] | 模型选择器旁 | 开关 Plan Mode（先规划再执行） |
| Send [▶] | 输入框右侧 | 发送消息（Enter），Agent 空闲时显示 |
| Stop [■] | 输入框右侧 | 中断 Agent 执行，取代 Send 按钮位置 |
| 🎤 麦克风 | Send 左侧 | 语音输入按钮（预留占位） |

### 6.5 AI 输出区（四面板 Tab 系统）

```
┌─ OutputArea ───────────────────────────────────────────────────────────┐
│ [🌐 Browser] [📂 Files] [▶ Terminal] [📊 Review]            [⤢] [✕]   │
│──────────────────────────────────────────────────────────────────────│
│                                                                        │
│                    当前选中 Tab 的内容                                   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Tab 栏：**
- 左侧 = TAB 列表，可拖拽排序
- 右侧 = 两个按键：[⤢] 全屏展开 / [✕] 隐藏整个输出区
- 每个 Tab 有图标+名称+×关闭按钮
- 未打开的 Tab 灰度显示
- 当前选中 Tab 高亮（品牌色下划线）

**四个面板详解：**

#### Browser Panel
```
┌─ Browser ──────────────────────────────────────────────────────┐
│ [◀] [▶] [↻]  http://localhost:3000                    [🔗] [⟐] │
│────────────────────────────────────────────────────────────────│
│                                                                │
│                  内嵌浏览器视口                                   │
│                (Electron webview / iframe)                      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```
- 地址栏 + 前进/后退/刷新
- `Cmd+L` 聚焦地址栏
- 支持多个 Browser Tab（不同 URL）

#### Files Panel
```
┌─ Files ────────────────────────────────────────────────────────┐
│ ┌─ File Tree ────┬─ Editor (Monaco) ────────────────────────┐ │
│ │ 📂 src/         │  1 │ import React from 'react'          │ │
│ │  ├ 📂 main/     │  2 │                                    │ │
│ │  ├ 📂 preload/  │  3 │ export default function App() {   │ │
│ │  ├ 📂 renderer/ │  4 │   return (                        │ │
│ │  │  ├ 📂 comp…  │  5 │     <div>Hello</div>              │ │
│ │  │  ├ 📂 layo…  │  6 │   )                               │ │
│ │  │  ├ 📂 atoms/ │  7 │ }                                  │ │
│ │  │  ├ 📄 App.…  │  8 │                                    │ │
│ │  ├ 📄 index…    │    │                                    │ │
│ └─────────────────┴────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```
- 左侧文件树（可折叠、右键菜单）
- 右侧 Monaco Editor（语法高亮、minimap）
- 双击文件 → 在 Editor 中打开
- 文件变更标记（M/Git 状态颜色）

#### Terminal Panel
```
┌─ Terminal ─────────────────────────────────────────────────────┐
│ [tab: main] [tab: test] [tab: logs]                       [+]  │
│────────────────────────────────────────────────────────────────│
│ $ npm run dev                                                   │
│ > attaseek@0.1.0 dev                                           │
│ > electron-vite dev                                             │
│                                                                 │
│ vite v5.4.21 building...                                       │
│ dev server running at http://localhost:5173/                    │
│                                                                 │
│ $ _                                                             │
└────────────────────────────────────────────────────────────────┘
```
- xterm.js 实现
- 多标签，每个独立 shell 进程
- `Cmd+T` 新建终端标签
- `Cmd+W` 关闭当前标签
- 支持复制/粘贴、命令历史

#### Review Panel
```
┌─ Review ───────────────────────────────────────────────────────┐
│ ┌─ Changed Files ─┬─ Diff View (Monaco) ────────────────────┐ │
│ │ 📄 src/api.ts    │   ┌──────────────────────────────────┐ │ │
│ │  +12 -3          │   │ - const old = legacy()           │ │ │
│ │ 📄 src/db.ts     │   │ + const updated = modern()       │ │ │
│ │  +45 -2          │   │   const same = unchanged()       │ │ │
│ │ 📄 test/api.t…   │   │                                  │ │ │
│ │  +23 -0          │   │   [接受] [拒绝]                   │ │ │
│ │                  │   └──────────────────────────────────┘ │ │
│ └─────────────────┴────────────────────────────────────────┘ │
│                                                [全部接受] [全部拒绝] │
└────────────────────────────────────────────────────────────────┘
```
- 左侧变更文件列表
- 右侧 Monaco Diff Editor（行级 diff）
- 逐行/逐块接受/拒绝
- 全局接受/拒绝按钮
- 与 Codex Review Panel 对齐

### 6.6 标题栏统一高度规范

```
┌──────┬─────────────────────┬─────────────────────────────────────────┐
│ Act  │ TitleBar (40px)     │ SessionHeader (40px — 有底部横线)        │
│ Bar  │ • 无底部横线         │─────────────────────────────────────────│
│      │ • macOS traffic     │                                         │
│ 48px │   lights 占位区域    │  MessageFlow                            │
│      │                     │  (可滚动消息流)                           │
│      ├─────────────────────┤                                         │
│      │ Sidebar Header(40px)│                                         │
│      │ • 无底部横线         │                                         │
│      │ • 显示 Activity 名称 │                                         │
│      ├─────────────────────┤                                         │
│      │                     │                                         │
│      │ Sidebar Content     │                                         │
│      │ (可滚动)             │                                         │
│      │                     ├─────────────────────────────────────────│
│      │                     │  Composer (固定底部)                      │
│      │                     ├─────────────────────────────────────────│
│      │                     │  OutputArea (Tab 栏 + 面板内容)           │
└──────┴─────────────────────┴─────────────────────────────────────────┘

三区标题栏规格：
┌──────────────────┬──────────┬──────────┬─────────────────────┐
│ 区域             │ 高度     │ 底部横线  │ 内容                 │
├──────────────────┼──────────┼──────────┼─────────────────────┤
│ TitleBar         │ 40px     │ ❌ 无     │ macOS traffic lights │
│ Sidebar Header   │ 40px     │ ❌ 无     │ Activity 名称         │
│ SessionHeader    │ 40px     │ ✅ 有     │ 标题 + 用量环 + 三键  │
│ OutputArea TabBar│ 32px     │ ✅ 有     │ Tab 列表 + ⤢✕        │
└──────────────────┴──────────┴──────────┴─────────────────────┘
```

### 6.7 深色/浅色主题色板

```css
/* Dark theme (default) */
:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #171717;
  --bg-tertiary: #1f1f1f;
  --bg-panel: #0a0a0a;
  --text-primary: #f5f5f5;
  --text-secondary: #a3a3a3;
  --text-tertiary: #737373;
  --border-primary: #262626;
  --border-secondary: #1f1f1f;
  --brand: #3b82f6;
  --brand-hover: #2563eb;
}

/* Light theme */
[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-tertiary: #e5e5e5;
  --bg-panel: #ffffff;
  --text-primary: #171717;
  --text-secondary: #737373;
  --text-tertiary: #a3a3a3;
  --border-primary: #e5e5e5;
  --border-secondary: #f0f0f0;
  --brand: #2563eb;
  --brand-hover: #1d4ed8;
}
```

---

## 7. 数据 & 状态

### 7.1 Jotai Atoms

| Atom 名 | 类型 | 作用范围 | 持久化 |
|---------|------|---------|--------|
| `activeActivityAtom` | Activity（扩展为含 chats） | 全局 | ❌ |
| `themeAtom` | `'dark' \| 'light' \| 'system'` | 全局 | ✅ localStorage |
| `settingsSectionAtom` | SettingsSection 枚举 | Settings 内 | ❌ |
| `composerValueAtom` | string | Conversation 内 | ❌ |
| `composerChipsAtom` | Chip[] | Conversation 内 | ❌ |
| `isAgentRunningAtom` | boolean | Conversation 内 | ❌ |
| `contextUsageAtom` | { used, total, pct } | Conversation 内 | ❌ |
| `messageListAtom` | Message[] | Conversation 内 | ❌ |
| `outputTabsAtom` | OutputTab[] | OutputArea 内 | ✅ localStorage |
| `activeOutputTabAtom` | string \| null | OutputArea 内 | ❌ |
| `outputAreaVisibleAtom` | boolean | 全局 | ❌ |

### 7.2 关键类型

```typescript
type Activity = 'home' | 'chat' | 'chats' | 'projects' | 'search' | 'automation' | 'plugin' | 'settings';

type SettingsSection = 'general' | 'profile' | 'appearance' | 'configuration'
  | 'personalization' | 'keyboard' | 'notifications' | 'agent' | 'git' | 'integrations';

type OutputTab = {
  id: string;
  type: 'browser' | 'files' | 'terminal' | 'review';
  label: string;
  icon: LucideIcon;
};

type Message = UserMessage | AgentTextMessage | AgentPlanMessage
  | ToolCallMessage | InlineDiffMessage | PermissionMessage;

type Chip = { id: string; type: 'file' | 'folder' | 'agent' | 'plugin'; label: string; path?: string };
```

### 7.3 依赖变更

```bash
npm install lucide-react
```

---

## 8. 安全考量

- [x] IPC 输入校验（theme 值仅允许 dark/light/system）
- [x] Browser Panel：Electron webview 使用独立 partition，隔离 session
- [x] Terminal Panel：子进程限制在项目目录内
- [x] 图标组件不涉及用户输入
- [x] 主题切换仅修改 CSS 变量，无 JS 注入风险
- [x] Composer 输入：@ 和 / 命令在渲染进程本地处理，不发送到主进程
- [x] contextBridge 暴露面保持最小化

---

## 9. 平台差异

| 平台 | 差异点 |
|------|--------|
| macOS | traffic lights 嵌入 TitleBar（`hiddenInset`）；Browser 使用 WKWebView |
| Windows | titleBarOverlay 覆盖；窗口控制按钮在右上角；Browser 使用 Chromium webview |
| Linux | 同 Windows |

> 标题栏统一 40px 高度在三个平台均适用。

---

## 10. 验收标准

### 构建与测试
- [ ] `npx vitest run` — 所有测试通过（含新增测试）
- [ ] `npx tsc --noEmit -p tsconfig.node.json` — 主进程编译通过
- [ ] `npx tsc --noEmit -p tsconfig.web.json` — 渲染进程编译通过
- [ ] `npm run build` — electron-vite 三进程构建成功
- [ ] `npm run dev` — Electron 窗口正常启动

### ActivityBar
- [ ] 显示 8 个导航项（含 Chats，位于 New 和 Search 之间）
- [ ] 所有图标为 Lucide React 组件
- [ ] 点击 Chats → Sidebar 显示对话列表
- [ ] 点击 Settings → Sidebar 显示 10 个设置分类

### Settings
- [ ] 左侧分类导航可点击切换
- [ ] Appearance → 可选择 Dark / Light / System，即时生效
- [ ] 主题切换后刷新页面保持
- [ ] 10 个分类各有对应的表单内容

### Conversation Header
- [ ] 左侧：当前对话标题（默认 "New Session"）
- [ ] 中央：上下文用量环形指示器
- [ ] 右侧：三个功能按键（应用面板 / 环境信息 / AI 输出区）
- [ ] 高度 40px，**仅**此区域有底部横线

### 标题栏
- [ ] TitleBar / Sidebar Header / Conversation Header 高度均为 40px
- [ ] TitleBar 和 Sidebar Header 无底部横线
- [ ] Conversation Header 有底部横线

### Composer
- [ ] 多行输入框可用
- [ ] @ 输入弹出文件/文件夹/agent/plugin 搜索浮层
- [ ] / 输入弹出命令列表
- [ ] 选中文件后出现 Chip，可 × 删除
- [ ] 模型选择器下拉可用
- [ ] Plan Mode 开关可切换
- [ ] Send / Stop 按钮状态切换正确

### AI 输出区
- [ ] 四个 Tab：Browser / Files / Terminal / Review
- [ ] 点击 Tab 切换面板内容
- [ ] 可 × 关闭 Tab
- [ ] [⤢] 全屏展开 / [✕] 隐藏
- [ ] Browser：地址栏 + 内嵌视口
- [ ] Files：左侧文件树 + 右侧 Monaco Editor
- [ ] Terminal：xterm.js 终端可用
- [ ] Review：左侧文件列表 + 右侧 Monaco Diff

### 消息显示
- [ ] 用户消息和 Agent 消息视觉区分
- [ ] Agent Markdown 渲染正确
- [ ] 工具调用卡片可折叠/展开
- [ ] Inline Diff 卡片有 [接受]/[拒绝] 按钮
- [ ] 权限确认内联渲染
