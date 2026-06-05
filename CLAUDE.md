# AttaSeek

Agent 工作台桌面应用。视觉与功能以 Codex Desktop 为源头参考（Claude Code Desktop 同样构建于 Codex UI 框架之上）。

## 边界

- AttaSeek 是独立项目，**不要搜索更上级目录**（`/Users/xbits/Workspace/Atta/` 下的其他项目与本项目无关）
- 所有设计文档在 `docs/` 目录下
- 本项目不依赖 Atta monorepo 中的任何其他子项目

## 技术栈

| 层 | 选型 |
|---|------|
| 桌面框架 | **Electron** |
| 前端 | React 18 + TypeScript |
| 样式 | Tailwind CSS |
| 状态管理 | Jotai（轻量原子化，适合面板级状态隔离） |
| 持久化 | SQLite（better-sqlite3，会话 / 设置 / 缓存） + 文件系统（产物 Artifact） |
| 编辑器 | Monaco Editor（代码 / Diff 面板） |
| 终端 | xterm.js（集成终端面板） |
| 协议 | Atta Proto（与 Bridge / Cloud 通信，如需） |
| 插件 | MCP 协议，插件以独立子进程运行 |
| 打包 | electron-builder |
| 平台 | macOS / Windows / Linux 桌面优先 |

### 窗口配置

```jsonc
// Electron BrowserWindow 关键配置
{
  titleBarStyle: "hiddenInset",  // macOS: 标题栏与侧边栏融合，traffic lights 嵌入侧边栏顶部
  titleBarOverlay: true,         // Windows/Linux: 窗口控制按钮叠加在侧边栏区域
  frame: true,                   // 保留原生窗口边框
  vibrancy: "sidebar",           // macOS: 侧边栏区域使用半透明毛玻璃效果
}
```

## 项目结构

```
AttaSeek/
├── CLAUDE.md                    # 本文件 —— 项目指南 + 开发工作流
├── docs/
│   ├── ui.md                    # UI/UX 设计规格
│   ├── design/                  # 架构设计文档（由 /atta-design-architecture 产出）
│   ├── reqs/                    # 需求规格文档（由 /atta-analyze-requirements 产出）
│   └── plans/                   # 正式实现计划文档（可选，日常用轻量内联任务列表）
├── .claude/
│   └── skills/                  # AI 开发工作流 skill 定义（10 个 atta-* skills）
├── package.json
├── electron-builder.yml
├── tsconfig.json
├── tailwind.config.ts
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # BrowserWindow 创建、窗口管理
│   │   ├── ipc/                 # IPC 处理：文件系统、终端、MCP、Bridge
│   │   └── store/               # SQLite 持久化
│   ├── preload/                 # contextBridge 暴露的安全 API
│   │   └── index.ts
│   └── renderer/                # React 渲染进程
│       ├── App.tsx              # 根组件：Activity Bar + Main Canvas 布局
│       ├── layouts/
│       │   └── Shell.tsx        # 整体 Shell 布局（titlebar + sidebar + canvas）
│       ├── components/
│       │   ├── ActivityBar/     # 48px 左轨导航
│       │   ├── TitleBar/        # Sidebar 区域标题栏（traffic lights 区域）
│       │   ├── Sidebar/         # 上下文面板（260px，内容随 Activity 切换）
│       │   ├── Conversation/    # Agent 对话面板
│       │   │   ├── SessionHeader.tsx    # 会话标题栏（内联）
│       │   │   ├── MessageFlow.tsx      # 消息流
│       │   │   ├── AgentStatusBar.tsx   # AI 输出区状态指示器
│       │   │   ├── ToolCallCard.tsx     # 工具调用卡片（可折叠，带撤销按钮）
│       │   │   ├── PermissionInline.tsx # 权限确认内联
│       │   │   └── Composer.tsx         # 输入区
│       │   ├── Artifact/        # 产物面板
│       │   ├── Terminal/        # 集成终端
│       │   └── Diff/            # Diff 查看器
│       └── panels/              # 可拖拽面板系统
├── resources/                   # 图标、字体等静态资源
└── test/
```

## 本地开发

```sh
# 安装依赖
npm install

# 开发模式（Vite HMR + Electron）
npm run dev

# 构建
npm run build

# 打包为桌面应用
npm run package
```

## 设计参考

- **源头参考**：Codex Desktop（OpenAI）—— Session Header、权限模式、工具调用卡片、上下文指示器
- **扩展参考**：Claude Code Desktop（Anthropic）—— 可拖拽面板系统、Side Chat、多会话管理、Diff 审查
- 详细 UI 规格见 `docs/ui.md`

## 代码风格

- TypeScript 严格模式，ESLint + Prettier
- React 函数组件 + Hooks，无 class 组件
- IPC 通信：主进程暴露 API 经 contextBridge，渲染进程不直接访问 Node.js
- CSS：Tailwind 原子类为主，必要时 `components/` 层提取复用样式

## 开发工作流（Skill 体系）

11 个 `atta-*` skill，三层设计：**完整流程**（分步，每步可审阅）、**快捷路径**（合并最后两步）、**简化全流程**（端到端，实施前有决策门）。Skill 定义在 `.claude/skills/atta-*/SKILL.md`。

### 完整流程（6 skills，分步执行）

```
特性开发 track:
  /atta-analyze-requirements → /atta-design-architecture ↘
                                                            /atta-plan-and-execute → /atta-review-and-fix
问题修复 track:                                                ↗
  /atta-describe-problem     → /atta-design-fix
```

| Skill | 阶段 | 产出 | 铁律 |
|-------|------|------|------|
| `/atta-analyze-requirements` | 需求分析 | `docs/reqs/*.md` | 不读代码、不讨论技术方案 |
| `/atta-design-architecture` | 架构设计 | `docs/design/*.md` | 不写实现代码、不分解任务 |
| `/atta-describe-problem` | 问题说明 | 对话内问题报告 | 不查代码、不猜根因、不提方案 |
| `/atta-design-fix` | 修改方案 | 对话内修复方案 | 只读代码不改代码 |
| `/atta-plan-and-execute` | 计划与实施 | 代码变更 | 每个 task 可构建、不顺手改无关代码 |
| `/atta-review-and-fix` | 检视与修复 | 审查结论 + 变更总结 | 不新增功能、不重构无关代码 |

### 快捷路径（1 skill，合并最后两步）

`/atta-implement` 合并 `/atta-plan-and-execute` + `/atta-review-and-fix`。在前面设计/方案已就绪时使用：

```
...-design-architecture ↘
                          → /atta-implement（一步收尾）
...-design-fix          ↗
```

### 简化全流程（2 skills，端到端）

`/atta-feature-dev` 和 `/atta-bug-fix` 端到端完成全部工作。内部两个阶段：
1. **分析/诊断**（只读，输出简报）
2. **实施/收尾**（用户确认后才执行）

| Skill | 覆盖 | 决策门 | 适用 |
|-------|------|--------|------|
| `/atta-feature-dev` | 需求分析 → 架构设计 → 实施 → 检视 | 实施前 | 中等特性 |
| `/atta-bug-fix` | 问题诊断 → 修改方案 → 实施 → 检视 | 修复前 | 可快速定位的 bug |

### 辅助 skill

| Skill | 用途 |
|-------|------|
| `/atta-status` | 项目状态评估 —— 审计代码库与文档的一致性，只读不写 |
| `/atta-help` | 工作流帮助 —— 展示 skill 全景、选径指南、单 skill 详情 |

### 选哪条路径

| 场景 | 路径 |
|------|------|
| 跨模块大特性，需独立文档和审阅 | `analyze-requirements` → `design-architecture` → `plan-and-execute` → `review-and-fix` |
| 大特性，已有设计，快捷收尾 | `analyze-requirements` → `design-architecture` → `implement` |
| 中等特性，端到端一步搞定 | `feature-dev`（实施前会确认） |
| 复杂 bug，需独立分析 | `describe-problem` → `design-fix` → `plan-and-execute` → `review-and-fix` |
| bug 定位后快捷修复 | `describe-problem` → `design-fix` → `implement` |
| 可快速修复的 bug | `bug-fix`（修复前会确认） |
| 了解项目状态 | `status` |

### 阶段隔离原则

- **需求/问题阶段** → 不读代码（CLAUDE.md 除外）
- **设计/方案阶段** → 只读代码，不改代码
- **实施阶段** → 严格按 task 范围改，不顺手重构
- **检视阶段** → 只检视本次变更，不扩展范围
- **简化全流程的决策门** → 简报后必须等用户确认才能动手
