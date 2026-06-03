# 自动化 / 插件 / 项目 三个 Workspace 需求分析

**目标：** 将 Automation、Plugin、Projects 三个 Workspace 从占位实现升级为功能完整的交互页面，统一采用 Chat 页的左边栏模式（空标题栏 + 标题在下方），并 mock 合理数据。

**背景：** 当前三个 workspace 全是 "coming soon" 占位。用户要求按 CODEX 的交互模式实现，数据 mock。

---

## 1. 三个 Workspace 统一的左边栏模式

**对齐 ChatsSidebar 的结构：**

```
┌─ Left Sidebar (260px) ─────────────────────┐
│  [40px 空标题栏 — 纯拖动区域]                 │  ← drag region
│                                             │
│  TITLE TEXT                 [+]             │  ← 标题在内容区 (与 CHATS 一致)
│  ─────────────────────────────────          │
│  列表内容 ...                                │
│                                             │
└─────────────────────────────────────────────┘
```

三个 workspace 的左边栏全部改为：空 40px drag 区 + 标题（大字）在下方带 `+` 按键。

---

## 2. 自动化 (Automation) — 2 区布局

### UI 设计

```
┌── Left (260px) ──────────┬── Main (flex-1) ───────────────────────┐
│  [空标题栏 40px]           │  [空标题栏 40px — drag]                 │
│                           │                                        │
│  AUTOMATION          [+]  │  ┌─────────────────────────────────┐   │
│  ─────────────────────    │  │ 📋 Daily Backup                  │   │
│                           │  │    定时备份 ~/Work 到 NAS        │   │
│  ◉ Daily Backup           │  │    Cron: 0 2 * * *              │   │
│  ◉ Sync Repos             │  │    状态: ● 运行中 (3m ago)       │   │
│  ○ Report Generator       │  │    [暂停] [编辑] [查看日志]      │   │
│  ○ Clean Logs             │  └─────────────────────────────────┘   │
│  ◐ Health Check           │                                        │
│                           │  ┌─────────────────────────────────┐   │
│                           │  │ 📋 Sync Repos                    │   │
│                           │  │    自动同步所有 git 仓库          │   │
│                           │  │    Hook: on file change          │   │
│                           │  │    状态: ◎ 空闲 (last: 12m ago)  │   │
│                           │  │    [启动] [编辑] [查看日志]       │   │
│                           │  └─────────────────────────────────┘   │
│                           │                                        │
│                           │  ... 更多任务卡片 ...                   │
└───────────────────────────┴────────────────────────────────────────┘
```

### 交互
- 左边栏：自动化任务列表，标题 "AUTOMATION"，右侧 `+` 新建任务按键
- 每个任务有状态指示器：`◉` 运行中 / `◎` 空闲 / `◐` 定时待触发 / `○` 已停用
- 点击任务 → 右侧显示任务详情卡片（名称、描述、触发条件、最近运行记录）
- 右侧详情含操作按键：启动/暂停、编辑、查看日志

### Mock 数据（~5 个任务）
| 任务 | 触发 | 状态 | 最近运行 |
|------|------|------|---------|
| Daily Backup | Cron: `0 2 * * *` | 运行中 | 3m ago |
| Sync Repos | Hook: file change | 空闲 | 12m ago |
| Report Generator | 手动触发 | 已停用 | 2d ago |
| Clean Logs | Cron: `0 9 * * 1` | 定时 | — |
| Health Check | Cron: `*/30 * * * *` | 运行中 | 28m ago |

---

## 3. 插件 (Plugin) — 3 级导航

### UI 设计

```
┌── Left (260px) ──────────┬── Main (flex-1) ───────────────────────┐
│  [空标题栏 40px]           │  列表视图:                              │
│                           │  ┌─────────────────────────────────┐   │
│  PLUGINS                  │  │ [市场] [已安装] [更新]   🔍搜索  │   │
│  ─────────────────────    │  │─────────────────────────────────│   │
│                           │  │                                  │   │
│  ▼ 本地工具 (3)           │  │  ┌──────────┐ ┌──────────┐      │   │
│    Filesystem             │  │  │ 📁        │ │ 🔧        │      │   │
│    Terminal               │  │  │ File      │ │ Tool      │      │   │
│    SQLite                 │  │  │ System    │ │ Runner    │      │   │
│  ▶ 云端服务 (4)           │  │  │ v1.2.0    │ │ v0.9.1    │      │   │
│  ▶ AI 模型 (3)            │  │  └──────────┘ └──────────┘      │   │
│  ▶ 开发工具 (5)           │  │  ┌──────────┐ ┌──────────┐      │   │
│  ▶ 生产力 (2)             │  │  │ 🌐        │ │ 📊        │      │   │
│                           │  │  │ Web       │ │ Chart     │      │   │
│                           │  │  │ Fetch     │ │ Render    │      │   │
│                           │  │  │ v2.1.0    │ │ v1.0.0    │      │   │
│                           │  │  └──────────┘ └──────────┘      │   │
│                           │  │                                  │   │
│                           │  └─────────────────────────────────┘   │
│                           │                                        │
│                           │  详情视图 (选中插件后):                  │
│                           │  ← 返回  Filesystem                    │
│                           │  ┌─────────────────────────────────┐   │
│                           │  │ 📁 Filesystem Plugin     v1.2.0 │   │
│                           │  │ ─────────────────────────────── │   │
│                           │  │ Provides file system access for │   │
│                           │  │ AI agents. Supports read, write,│   │
│                           │  │ and directory listing in         │   │
│                           │  │ sandboxed paths.                │   │
│                           │  │                                 │   │
│                           │  │ [启用] [配置] [查看文档] [卸载]  │   │
│                           │  └─────────────────────────────────┘   │
└───────────────────────────┴────────────────────────────────────────┘
```

### 交互
- 左边栏：插件分类（可折叠展开），无 `+` 按键（插件从市场安装）
- 右侧默认 = **列表视图**（卡片网格），顶部 tab 切换 [市场] [已安装] [更新]
- 点击插件 → **详情视图**，标题栏有 `←` 返回按键，回列表视图
- 详情页显示名称、版本、描述、操作按键

### Mock 数据（按分类，共 17 个）
| 分类 | 插件 | 版本 | 已安装 |
|------|------|------|--------|
| 本地工具 | Filesystem, Terminal, SQLite | 1.2/1.0/0.5 | ✓✓✓ |
| 云端服务 | GitHub, Slack, Notion, Supabase | 2.0/1.5/1.0/0.8 | ✓✓—✓ |
| AI 模型 | OpenAI, Claude, Gemini | 3.0/2.1/1.5 | ✓✓— |
| 开发工具 | Docker, Redis, PostgreSQL, ESLint, Prettier | ... | ✓—✓✓✓ |
| 生产力 | Google Calendar, Todoist | 1.0/0.9 | —✓ |

---

## 4. 项目 (Projects) — 3 区 + 多层导航

### UI 设计

**层级 1：项目列表 (默认视图)**

```
┌── Left (260px) ──────────┬── Main (flex-1) ───────┬── Right (400px) ───┐
│  [空标题栏 40px]           │  [空标题栏 40px — drag]   │  [空标题栏 40px]     │
│                           │                         │                    │
│  PROJECTS            [+]  │  选择一个项目开始         │  [Files] [Review]  │
│  ─────────────────────    │                         │  ────────────────  │
│                           │                         │                    │
│  ▼ AttaSeek (3)           │                         │  打开文件或查看     │
│    Refactor API module    │                         │  Git 变更           │
│    Write test suite       │                         │                    │
│    Fix bridge connection  │                         │                    │
│  ▶ ClawPod (2)            │                         │                    │
│  ▶ AttaCloud (1)          │                         │                    │
│  ▶ OpenSource (4)         │                         │                    │
│                           │                         │                    │
│                           │                         │                    │
└───────────────────────────┴─────────────────────────┴────────────────────┘
```

**层级 2：选择项目后，左边栏显示最近会话**

```
┌── Left (260px) ──────────┬── Main (flex-1 ────────┬── Right (400px) ───┐
│  [空标题栏 40px]           │   ← 返回                │  [Files] [Review]  │
│                           │                         │  ────────────────  │
│  AttaSeek                 │  Refactor API module    │                    │
│  ─────────────────────    │  ───────────────────    │  📁 src/            │
│                           │  Agent: I'll refactor   │    📁 renderer/     │
│  Recent Sessions          │  the API layer into     │      📁 components/│
│  ─────────────────────    │  modular structure…     │        App.tsx      │
│  Refactor API module      │                         │        Shell.tsx    │
│  Write test suite         │  ┌─ 🔧 read src/api ──┐ │      📁 layouts/    │
│  Fix bridge connection    │  └────────────────────┘ │    📁 main/         │
│                           │  ┌─ ⚙ cargo test ────┐ │    📁 preload/      │
│                           │  └────────────────────┘ │    package.json     │
│                           │                         │                    │
└───────────────────────────┴─────────────────────────┴────────────────────┘
```

### 交互
- **层级 1**：左边栏 = 项目列表 + 最近会话（可折叠）。右侧显示 "Select a project" 空状态
- **层级 2**：点击项目展开，左边栏显示项目名 + 最近会话列表
- **层级 3**：点击会话 → 右侧主区显示该会话内容（Conversation 或会话摘要），右边栏显示 Files/Review
- 右边栏两个标签：**Files** (项目目录树，点击文件可打开/预览)、**Review** (Git diff，changed files 列表)
- 右边栏的这两个 Tab 在 OutputArea 架构上实现——即 OutputArea 的 tabs 在多场景下复用

### 与现有 OutputArea 的复用

右栏已有 `TAB_CONFIG = { browser, files, terminal, review }`。在 Projects workspace 中默认打开的是 `files` 和 `review`。点击目录树文件 → 在 OutputArea 中新增一个 code tab（或复用 files tab 的 editor 区域）。

### Mock 数据

| 项目 | 会话数 | 最近会话 |
|------|--------|---------|
| AttaSeek | 3 | Refactor API module, Write test suite, Fix bridge connection |
| ClawPod | 2 | Update proto definitions, Tauri window config |
| AttaCloud | 1 | Deploy coturn setup |
| OpenSource | 4 | PR review #42, Update README, Release v0.2, Fix CI pipeline |

### 项目目录树 (Mock)
```
AttaSeek/
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   └── ipc/theme.ts
│   ├── preload/
│   │   └── index.ts
│   └── renderer/
│       ├── App.tsx
│       ├── layouts/
│       │   ├── Shell.tsx
│       │   ├── WorkspaceLayout.tsx
│       │   └── WorkspaceRouter.tsx
│       └── components/...
├── package.json
└── tsconfig.json
```

---

## 范围

| In scope | Out of scope |
|----------|-------------|
| 三个 workspace 左栏统一为空标题栏 + 标题在下方 | 实际系统自动化执行引擎 |
| 自动化任务列表 + 详情卡片 (mock) | 插件市场在线获取 |
| 插件分类列表 + 详情页 (mock) | 项目真实文件系统读取 |
| 项目列表 → 会话列表 → 会话详情 (mock) | 文件真实编辑 (Monaco) |
| 项目右边栏：Files 目录树 + Review diff (mock) | Git 真实操作 |
| OutputArea tabs 在项目场景中显示 Files/Review | 拖拽面板 (后续) |

---

## 风险

| 风险 | 缓解 |
|------|------|
| 项目多层导航复杂度高 | 用 useState 管理局部 view stack 而非 router |
| OutputArea 复用需要与 Chat 场景行为兼容 | tabs atom 是全局的，每个 workspace 各自操作不会冲突 |
| 插件详情页返回需要 UI 动画过渡 | 简单隐藏/显示（无动画），先保证功能正确 |
