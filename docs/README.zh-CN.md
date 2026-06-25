<p align="center">
  <img src="../resources/icon.png" width="128" alt="AttaSeek 图标" />
</p>

<h1 align="center">AttaSeek</h1>

<p align="center">
  <strong>可编程的 AI Agent 工作站</strong><br/>
  在桌面上构建、部署、编排 AI Agent —— 原生 TypeScript 驱动，为极致定制而生。
</p>

<p align="center">
  <a href="../README.md">English Docs</a> &nbsp;|&nbsp;
  <a href="#核心特性">核心特性</a> &nbsp;|&nbsp;
  <a href="#架构">架构</a> &nbsp;|&nbsp;
  <a href="#快速开始">快速开始</a> &nbsp;|&nbsp;
  <a href="#定制开发">定制开发</a>
</p>

---

**AttaSeek** 是一个桌面 AI Agent 工作站 —— Agent **真正运行的地方**。它不是一个套了 API 壳的聊天界面，而是一个拥有完整 Agent 运行时、原生 TypeScript 执行引擎、模块化架构的工具台。它的能力远超"跟大模型聊天"。

如果说 IDE 是开发者的代码工作站，AttaSeek 就是 **AI Agent 的 VS Code**：一个可扩展、可编程的主程序，让你定义 Agent *是谁*、*能用什么工具*、*怎么思考*、*跑在哪儿*。

---

## AttaSeek 跟其他工具有什么不同？

| 能力维度 | 其他桌面工具 | AttaSeek |
|---|---|---|
| Agent 定义 | 一段 prompt 字符串 | **TypeScript 模块** —— 完整人格、工具集、记忆、预算 |
| 多 Agent 协作 | 手动 / 临时拼接 | **原生 Coordinator + Swarm** —— 分解 → 委派 → 合稿 |
| 工具系统 | 写死在代码里 | **可扩展注册表** —— 加工具就像加文件、MCP 服务或插件 |
| 上下文压缩 | 简单截断 | **5 级管线** —— Snip → Microcompact → Collapse → Auto → Reactive |
| LLM 提供商 | 1-3 家 | **任意** Anthropic 或 OpenAI 兼容 —— 按模型槽路由、缓存、重试、自动容灾 |
| 插件模型 | 受限 | **MCP + 原生插件 IPC** —— 插件以隔离子进程运行 |
| 场景定制 | 仅聊天 | **atta-core 模式** —— 编程、研究、写作、股票量化、虚拟币量化……自由组合 |
| 桌面体验 | WebView | **原生 Electron** —— hiddenInset 标题栏、毛玻璃侧边栏、托盘、全局快捷键、自动更新 |

---

## 核心特性

### 🧠 Agent 引擎（原生 TypeScript）

AttaSeek 的 Agent **不是一段 prompt 文本**，而是一个完整的 TypeScript 运行时：

```
AgentProfile → PromptTemplate（18 段） → ContextAssembler → QueryLoop → ToolOrchestrator → AgentEventBus
```

- **Agent 定义即代码** — 每个 profile（`coding-profile.ts`、`research-profile.ts`、自定义量化交易 profile）是一个独立的 TypeScript 模块，包含系统身份、工具白名单、记忆范围、Token 预算和执行策略。
- **18 段提示词组合引擎** — 静态段（身份、工具台描述、任务哲学、工具指引、格式约定）+ 动态段（会话、记忆、环境、语言、MCP），按精细优先级每次对话按需渲染。
- **Token 感知的 5 级压缩管线** — 自动运转：头尾裁剪 → 工具结果微压缩 → 多轮折叠为摘要 → 85% 预算自动触发 → 上下文超长被动抢救。无状态丢失，无上下文爆炸。
- **事件驱动架构** — Agent 的每个动作都会发出类型化的 `SessionEvent`。UI 订阅事件总线，Agent 从不阻塞在渲染上。17 种事件类型携带结构化数据穿越 IPC 桥。

### 🤖 多 Agent 协同

不止"开个线程跑"。AttaSeek 内置了一套**生产级多 Agent 协调系统**：

- **CoordinatorMode** — 一个协调 Agent 分解任务、委派专家、合稿输出
- **SwarmManager** — 并行 Agent 群，独立工作上下文、Keep-Alive 管理、递归守卫
- **TaskDecomposer** — LLM 驱动任务拆解，带依赖排序
- **SubAgentManager** — 8 种内置子 Agent（探索、规划、审查、验证、编程、研究、写作、通用）+ 自定义子 Agent，支持后台运行、命名工作进程、Git Worktree 隔离

### 🔧 工具系统

~35 个内置工具，覆盖 10 个类别。每个工具 = manifest 定义 + implementation 实现，统一注册到 `ToolRegistry`：

| 类别 | 工具 |
|---|---|
| **文件操作** | read_file, write_file, edit_file, glob, grep |
| **Shell** | bash（沙箱保护，危险命令自动拦截） |
| **搜索** | web_search（DuckDuckGo）, web_fetch（HTTP + 可选 LLM 摘要） |
| **代码智能** | lsp_diagnostic, lsp_definition, lsp_references |
| **任务管理** | task_create, task_update, task_list, task_output, task_stop |
| **Agent 操作** | spawn_agent, send_message, invoke_skill |
| **定时/监控** | cron_create, cron_delete, cron_list, monitor |
| **工作流** | workflow（fan-out 编排）, tool_search（延迟工具发现） |
| **界面交互** | ask_user_question, push_notification, enter_plan_mode, exit_plan_mode |
| **内容创作** | create_document, todo_write |

**工具路由**采用 Jaccard 相似度 Top-K 选择——Agent 只看到与当前上下文相关的工具，每次 API 调用省下数千 Token。

### 🔌 插件与 MCP 生态

AttaSeek 支持**两种扩展模式**：

1. **MCP 协议** — 完整 Model Context Protocol 支持。在 `.claude/mcp.json` 中配置，工具和 prompt 自动发现注册。MCP 服务以子进程运行，带崩溃恢复（3 次重启、指数退避）、OAuth 支持、stdio 传输。

2. **原生插件** — `PluginHostManager` 把插件作为隔离子进程加载，通过类型化 IPC 通信。插件可以贡献：
   - 活动栏入口
   - 侧边栏视图
   - 产物面板
   - 工具实现
   - 技能
   - 主题扩展

两种模式共存——MCP 面向 AI 工具集成，原生插件面向 UI 深度扩展。

### 🎛️ 模型灵活配置

**任意** LLM 提供商。模型配置系统支持：

- **双协议** — Anthropic 原生 + OpenAI 兼容，并存。众多国内厂商同时暴露两种接口（DeepSeek、通义千问、Kimi、智谱、MiniMax）。
- **模型槽** — 按角色分配模型：`opusModel`（强推理）、`sonnetModel`（均衡）、`haikuModel`（快速）、`subagentModel`（工作 Agent）、`compactModel`（摘要）、`searchModel`（工具路由）等。
- **提供商容灾** — 多提供商链式自动故障切换。
- **Prompt 缓存** — Anthropic 缓存断点管理 + 缓存命中检测。
- **重试系统** — 10 级指数退避 + 错误分类。
- **费用追踪** — 每次会话、每个模型的 Token 用量和费用估算。

**12 个内置提供商模板** — Anthropic Claude、OpenAI、Google Gemini、xAI Grok、Mistral、Cohere、DeepSeek、通义千问、Kimi/月之暗面、智谱 GLM、MiniMax。

### 🖥️ 原生桌面体验

这不是一个套了 Electron 壳的网页应用，而是充分利用原生能力：

- **macOS** — hiddenInset 标题栏（traffic lights 嵌入侧边栏），`vibrancy: "sidebar"`（毛玻璃效果）
- **Windows/Linux** — titleBarOverlay 窗口控制叠加
- **系统托盘** — 最小化到托盘、开机自启、全局快捷键（Cmd+Shift+A）
- **自动更新** — 双源检测（GitHub Releases + S3）、下载、校验（SHA512）、平台感知安装
- **窗口状态** — 跨会话记住位置和大小

### 📊 集成面板

| 面板 | 技术栈 | 能力 |
|---|---|---|
| **文件管理** | 自研 + Monaco | 树状浏览、文件预览、十六进制查看、语法高亮 |
| **终端** | xterm.js + node-pty | 完整 PTY、WebGL 渲染、多标签、自适应大小 |
| **Diff 对比** | Monaco Editor | 并排对比、提交历史、内联审查 |
| **浏览器** | WebView | URL 导航、集成到产物标签页 |
| **Agent 对话** | React | 流式消息、工具调用卡片、权限内联确认、Markdown 渲染 |

### 💾 架构设计原则

- **TypeScript 严格模式**全链路 —— 无隐式 `any`，无 class 组件
- **IPC 安全** —— 渲染进程只通过 `contextBridge` 暴露的类型化 API 与主进程通信，渲染进程零 Node.js 权限
- **明文持久化** — `~/.atta/seek/` 下 JSON/JSONL 文件；不做 SQLite 黑盒（正在迁移出）
- **Jotai 原子化状态** — 轻量原子状态、面板级隔离、无 Redux 模板代码
- **注册表模式** — `Registry<T>` 泛型基类支撑活动、产物渲染器、侧边栏、内联渲染器的扩展——插件注册无需触碰核心 UI 代码

---

## 架构全景

```
┌────────────────────────────────────────────────────────────┐
│                     渲染进程 (Renderer)                      │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ActivityBar│  │ SidebarSlot  │  │      AppSpace        │  │
│  │  (48px)   │  │  (260px)     │  │  ┌────────────────┐  │  │
│  │           │  │              │  │  │  AgentPane      │  │  │
│  │ 首页      │  │ 会话列表      │  │  │  对话面板        │  │  │
│  │ 会话      │  │ 自动化       │  │  │  消息流          │  │  │
│  │ 搜索      │  │ 项目         │  │  │  输入框          │  │  │
│  │ 插件      │  │ 插件         │  │  └────────────────┘  │  │
│  │ 项目      │  │              │  │  ═══ 可拖拽分割 ═══  │  │
│  │ 设置      │  │              │  │  ┌────────────────┐  │  │
│  └──────────┘  └──────────────┘  │  │ ArtifactPane    │  │  │
│                                   │  │ 标签页 + 面板    │  │  │
│  状态管理: Jotai atoms            └──────────────────────┘  │
│  (activity, session, composer,                               │
│   settings, theme, update, …)                                │
└───────────────────────┬────────────────────────────────────┘
                        │ contextBridge (类型化, ~70 方法)
┌───────────────────────┴────────────────────────────────────┐
│                      主进程 (Main)                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  AGENT 引擎                            │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │  │
│  │  │ Profile  │→ │ Context  │→ │   QueryLoop      │   │  │
│  │  │ (TS 模块) │  │ Assembler│  │ (yield 生成器)    │   │  │
│  │  └──────────┘  └──────────┘  └────────┬─────────┘   │  │
│  │                                       │              │  │
│  │  ┌────────────────────────────────────┼──────────┐   │  │
│  │  │          压缩管线 (Compaction)      │          │   │  │
│  │  │  Snip → Microcompact → Collapse → Auto → Reactive │  │
│  │  └────────────────────────────────────┼──────────┘   │  │
│  │                                       │              │  │
│  │  ┌──────────┐  ┌──────────┐  ┌───────┴────────┐   │  │
│  │  │   LLM    │←→│  Tool    │→ │ AgentEventBus  │──→│IPC│
│  │  │ Provider │  │Orchestrtr│  └────────────────┘   │  │
│  │  └──────────┘  └──────────┘                       │  │
│  │  Anthropic | OpenAI Compat | 缓存 | 重试            │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
│  │   MCP    │ │ 插件    │ │  Hooks   │ │ Coordinator  │  │
│  │  Server  │ │  Host   │ │ Pipeline │ │  Swarm        │  │
│  │ Manager  │ │ Manager │ │ (14 事件)│ │  Decomposer   │  │
│  └──────────┘ └─────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  Store   │ │ Config  │ │  Tray    │ │   Update     │  │
│  │JSON/JSONL│ │ Manager │ │ Manager  │ │   Manager    │  │
│  └──────────┘ └─────────┘ └──────────┘ └──────────────┘  │
└───────────────────────────────────────────────────────────┘
```

---

## 快速开始

### 环境要求

- **Node.js** ≥ 20
- **npm** ≥ 10

### 安装与运行

```bash
git clone https://github.com/attago/attaseek.git
cd attaseek
npm install          # postinstall 自动执行 electron-rebuild 编译原生模块
npm run dev          # Vite HMR + Electron —— 打开应用窗口
```

首次启动后，在 **设置 → 模型** 中配置至少一个 LLM 提供商。

### 构建与打包

```bash
npm run build          # 生产构建
npm run package        # 当前平台打包
npm run package:mac    # macOS DMG + ZIP (arm64 + x64)
npm run package:win    # Windows NSIS 安装包
npm run package:linux  # Linux AppImage + deb
```

### 开发命令

```bash
npm run typecheck    # 全量 TypeScript 严格检查（main + renderer）
npm run test         # Vitest 单元测试（~55 套）
npm run test:agent   # Agent 集成测试（mock + 实机）
npm run test:e2e     # Playwright 端到端测试
npm run lint         # ESLint
npm run format       # Prettier
```

---

## `atta-core` Profile 系统

AttaSeek 的灵魂。跑在工作站里的每一个 Agent，都受一个 **AgentProfile** 的支配——这是一个 TypeScript 模块，定义了 Agent 的完整认知架构：

```typescript
// stock-quant-profile.ts —— 量化交易 Agent
import { validateProfile } from '../AgentProfile'

export const stockQuantProfile: AgentProfile = validateProfile({
  id: 'stock-quant',
  name: '量化交易 Agent',
  description: '用定量模型分析股票市场。执行回测、评估策略、生成交易信号。',

  systemPrompt: {
    id: 'stock-quant',
    sections: [
      introSection,           // "你是一个量化交易 Agent……"
      customQuantSection,     // 领域专属：alpha 模型、风险因子、执行策略
      usingToolsSection,      // 工具使用指引
      memoryContextSection,   // 记忆注入
      envInfoSection,         // 环境信息
    ],
  },

  tools: [
    'read_file', 'write_file', 'bash',        // 文件操作 + 脚本执行
    'web_search', 'web_fetch',                // 行情 + 资讯
    'spawn_agent',          // 并行研究（多行业同时分析）
    'cron_create',          // 定时采集数据
    'monitor',              // 价格触发监控
    'task_create', 'task_update',
    'ask_user_question',
  ],

  memory: {
    scopes: ['project', 'user'],
    recallLimit: 15,
    autoExtract: true,      // 自动记住有效策略
    loadFileMemory: true,   // 加载项目级 CLAUDE.md 中的策略文档
  },

  context: {
    maxTokens: 200_000,     // 大上下文处理数据密集型分析
    budgets: { system: 10_000, tools: 8_000, memory: 6_000, messages: 150_000, reserve: 26_000 },
    autoCompact: true,
    compactTriggerRatio: 0.80,
  },

  execution: {
    maxTurns: 50,           // 允许深度分析循环
    maxParallelTools: 16,
    planning: 'inline',
  },
})
```

**这就是 AttaSeek 与所有其他工具的本质区别。** 别的工具让你写 system prompt。AttaSeek 让你写 Agent。

### 内置 Profile

| Profile | 领域 | 特征 |
|---|---|---|
| `coding` | 软件工程 | 读写执行、TDD、Git、LSP、并行工具调用 |
| `research` | 多源分析 | 网络搜索、来源验证、引用、深度发散调研 |
| `writing` | 内容与文档 | 文档创建、格式化、大纲、审查 |
| `coordinator` | 多 Agent 编排 | 任务分解、专家委派、结果合稿 |

### 自定义场景

Profile 系统极其自然地映射到量化研究和专业场景：

| 场景 | Profile 运作方式 |
|---|---|
| **股票量化** | 加载策略文档 → 生成子 Agent 并行分析各行业 → bash 执行回测 → monitor 监控价格触发器 → 生成交易信号 |
| **虚拟币量化** | 链上数据采集 → 技术指标计算 → web_fetch 情绪分析 → cron 自动告警 → 风险调整仓位 |
| **学术研究** | 文献检索 → 来源验证 → 引文管理 → 大纲 → 草稿 → 子 Agent 对抗审阅 |
| **DevOps** | IaC 读写 → bash 执行 kubectl → 日志监控 → 事故响应预案 → 多集群健康检查 |

每个 profile **~100 行 TypeScript**，完全可组合——可以从任意已有 profile 混搭段落、工具集和执行参数。

---

## 插件开发

### MCP 服务

扩展 AttaSeek 最简单的方式。在 `.claude/mcp.json` 添加配置即可：

```json
{
  "mcpServers": {
    "my-tool": {
      "command": "node",
      "args": ["./my-mcp-server.js"],
      "env": { "API_KEY": "${ENV_VAR}" }
    }
  }
}
```

你的服务通过 stdio 实现 MCP 协议。工具和 prompt 自动发现并注册。

### 原生插件

如果需要深度 UI 集成，编写原生插件：

```
my-plugin/
├── package.json        # attaseek-plugin 元信息
├── main.js             # 子进程入口
└── ui/
    ├── sidebar.jsx     # React 侧边栏组件
    └── activity.jsx    # ActivityBar 图标 + 处理逻辑
```

插件通过 `PluginRegistry` 注册，通过类型化 IPC 与主程序通信。协议规范见 `src/main/plugins/PluginIPCProtocol.ts`。

---

## 参与贡献

AttaSeek 遵循基于 **Skill 的开发工作流**，通过 `atta-*` 命令族驱动：

| 阶段 | Skill | 产出 |
|---|---|---|
| 需求分析 | `/atta-analyze-requirements` | `docs/reqs/*.md` |
| 架构设计 | `/atta-design-architecture` | `docs/design/*.md` |
| 计划实施 | `/atta-plan-and-execute` | 代码变更 |
| 审查修复 | `/atta-review-and-fix` | 审查报告 + 修复 |

快捷路径：`/atta-feature-dev`（端到端一口气做完）或 `/atta-implement`（实施 + 检视一步到位）。

### 代码规范

- **TypeScript 严格模式** — 无隐式 `any`，无 class 组件
- 只用 **React 函数组件 + Hooks**
- **IPC**：主进程 → `contextBridge` → 类型化渲染进程 API；渲染进程绝不碰 Node.js
- **CSS**：Tailwind 原子类优先；复用模式提取为组件
- **测试**：Vitest 做单元/集成测试，Playwright 做 E2E；VCR 可录制回放 LLM 响应
- **提交信息**：推荐 conventional commit 前缀

### 项目结构

```
src/
├── main/agent/          # Agent 引擎 (~75 文件, 15 个子系统)
│   ├── orchestrator/    #   QueryEngine, query-loop, AgentState
│   ├── llm/             #   LLM 提供商、缓存、重试、容灾
│   ├── tools/           #   ToolOrchestrator, StreamingExecutor, ~35 实现
│   ├── compact/         #   5 级上下文压缩管线
│   ├── context/         #   ContextAssembler, Git 上下文, 记忆预取
│   ├── profile/         #   AgentProfile 系统 + 5 个内置 profile
│   ├── prompt/          #   18 段提示词模板引擎
│   ├── mcp/             #   MCP 服务生命周期 + 客户端
│   ├── hooks/           #   14 事件钩子管线
│   ├── subagent/        #   8 种子 Agent + Worktree 隔离
│   ├── coordinator/     #   多 Agent 协调、Swarm、任务分解
│   ├── memory/          #   FileMemory、memdir、LLM 记忆提取
│   ├── skills/          #   技能加载、执行、参数解析
│   ├── messages/        #   扩展消息类型
│   └── commands/        #   13 个斜杠命令
├── main/ipc/            # IPC 处理器 (19 个模块)
├── main/store/          # JSON/JSONL 持久化层
├── main/plugins/        # 插件 Host + IPC 协议
├── main/tray/           # 系统托盘 + 全局快捷键
├── main/update/         # 自动更新系统
├── shared/types/        # 17 个共享类型模块 (~200+ 类型定义)
├── preload/             # contextBridge API (~70 个方法)
└── renderer/            # React UI (~70 组件, 9 个工作区, 6 个渲染器)
```

---

## 许可证

UNLICENSED — 专有软件。详见 [LICENSE](../LICENSE)。

---

<p align="center">
  由 TypeScript, React, Electron 和野心构建。<br/>
  <a href="../README.md">English Docs</a>
</p>
