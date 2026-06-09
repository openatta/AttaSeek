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
├── CLAUDE.md                         # 本文件 —— 项目指南 + 开发工作流
├── docs/
│   ├── design/                       # 架构设计文档（/atta-design-architecture 产出）
│   ├── reqs/                         # 需求规格文档（/atta-analyze-requirements 产出）
│   └── plans/                        # 正式实现计划文档（可选）
├── .claude/
│   └── skills/                       # 12 个 atta-* 开发工作流 skill
├── package.json
├── electron-builder.yml
├── tsconfig.json / tsconfig.web.json / tsconfig.node.json
├── src/
│   ├── shared/types/                 # 主进程+渲染进程共享类型（唯一跨层依赖）
│   │   ├── model.ts                  # ModelConfig, UsageSummary
│   │   ├── AgentTask.ts / SessionEvent.ts / Artifact.ts / Audit.ts
│   │   ├── Memory.ts / Permission.ts / Plugin.ts / Skill.ts / Tool.ts
│   ├── main/                         # Electron 主进程
│   │   ├── index.ts                  # BrowserWindow 创建、生命周期
│   │   ├── boot.ts                   # 启动序列（插件、服务）
│   │   ├── perf.ts                   # 性能埋点与监控
│   │   ├── ipc/                      # IPC handler（agent/artifact/model/session/…）
│   │   ├── config/                   # 配置管理（ConfigManager, defaults）
│   │   ├── agent/                    # Agent 引擎（QueryEngine, query-loop, AgentProfile, PromptTemplate）
│   │   │   ├── orchestrator/         #   查询循环（QueryEngine, query-loop, AgentState, transitions）
│   │   │   ├── tools/                #   工具执行（ToolOrchestrator, StreamingToolExecutor, ToolProgressBus）
│   │   │   │   └── implementations/  #   工具实现（~25 文件）
│   │   │   ├── compact/              #   5 级压缩管线（Snip→Microcompact→Collapse→Auto→Reactive）
│   │   │   ├── context/              #   上下文组装（ContextAssembler, GitContext, MemoryPrefetcher）
│   │   │   ├── llm/                  #   LLM Provider（Anthropic, OpenAI Compat, retry, cache, fallback）
│   │   │   ├── hooks/                #   钩子系统（HookManager, HookPipeline）
│   │   │   ├── profile/              #   AgentProfile + 3 内置 profile（coding/research/writing）
│   │   │   ├── prompt/               #   PromptTemplate + 4 sections（identity/tools/memory/session）
│   │   │   ├── features/             #   特性开关（FeatureFlags）
│   │   │   ├── messages/             #   扩展消息类型（Tombstone, ToolUseSummary, Progress）
│   │   │   ├── subagent/             #   子代理（SubAgentManager, worktree）
│   │   │   ├── mcp/                  #   MCP 集成
│   │   │   ├── memory/               #   记忆系统（FileMemory, MemoryExtractor）
│   │   │   ├── skills/               #   技能加载
│   │   │   ├── coordinator/          #   多 Agent 协调
│   │   │   └── cache/                #   Prompt 缓存
│   │   ├── model/                    # 模型配置服务（ModelConfigService, ProviderFactory）
│   │   ├── tools/                    # 工具基础设施（ToolRegistry, ToolRouter, ToolExecutor）
│   │   │   ├── ToolRegistry.ts       #   工具清单注册表（单例）
│   │   │   ├── ToolRouter.ts         #   基于 Jaccard 相似度的 Top-K 工具选择
│   │   │   ├── ToolExecutor.ts       #   完整执行流水线：权限→执行→审计
│   │   │   ├── ToolImplementations.ts #   TOOL_IMPLS 查找表
│   │   │   └── QuestionBridge.ts     #   AskUserQuestion Promise 桥接
│   │   ├── permission/              # 权限服务（PermissionService, PermissionBridge）
│   │   ├── memory/ / audit/ / artifacts/ / plugins/ / skills/
│   │   └── store/                    # SQLite 持久化、ID 生成、密钥存储、工具函数
│   ├── preload/                      # contextBridge 安全桥接（类型化 API）
│   │   └── index.ts
│   └── renderer/                     # React 渲染进程
│       ├── main.tsx                  # 入口
│       ├── App.tsx                   # 根组件 + IPC 事件订阅
│       ├── layouts/                  # Shell, AppSpace, AgentPane, WorkspaceRouter, SidebarSlot
│       ├── atoms/                    # Jotai 状态原子（session/composer/settings/theme/…）
│       ├── registries/               # Registry<T> 泛型基类 + 4 注册表
│       ├── hooks/                    # useDragResize
│       ├── components/
│       │   ├── ActivityBar/ / Sidebar/ / Artifact/ / Settings/
│       │   └── Conversation/         # Agent 对话面板
│       │       ├── Composer / MessageFlow / SessionHeader / ModelSelector
│       │       ├── MarkdownRenderer / InlineArtifactPreview / NoModelPrompt
│       │       └── events/           # 事件渲染组件（10 种事件类型）
│       ├── renderers/                # 产物渲染器（code/diff/html/markdown/svg/table）
│       ├── workspaces/               # 工作区组件（Dashboard/Chat/Projects/…）
│       ├── assets/                   # 静态资源（CSS）
│       └── i18n/                     # 国际化
├── resources/                        # 图标、字体等静态资源
└── test/                             # Vitest 单元测试
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
| `/atta-refactor` | 重构优化 —— 七维分析+决策门+逐项重构+回归，不增功能不修 bug |
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
| 优化代码质量、消除技术债 | `refactor`（分析后确认再动手） |

### 阶段隔离原则

- **需求/问题阶段** → 不读代码（CLAUDE.md 除外）
- **设计/方案阶段** → 只读代码，不改代码
- **实施阶段** → 严格按 task 范围改，不顺手重构
- **检视阶段** → 只检视本次变更，不扩展范围
- **简化全流程的决策门** → 简报后必须等用户确认才能动手
