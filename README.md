<p align="center">
  <img src="resources/icon.png" width="128" alt="AttaSeek Logo" />
</p>

<h1 align="center">AttaSeek</h1>

<p align="center">
  <strong>The Programmable Agent Workstation</strong><br/>
  Build, deploy, and orchestrate AI agents on your desktop — with native TypeScript power.
</p>

<p align="center">
  <a href="docs/README.zh-CN.md">中文文档</a> &nbsp;|&nbsp;
  <a href="#features">Features</a> &nbsp;|&nbsp;
  <a href="#architecture">Architecture</a> &nbsp;|&nbsp;
  <a href="#getting-started">Getting Started</a> &nbsp;|&nbsp;
  <a href="#customization">Customization</a>
</p>

---

**AttaSeek** is a desktop agent workstation — the place where AI agents *live*. It is not a thin UI wrapper around an API; it is a full-stack agent runtime with native TypeScript execution, a modular architecture, and deep customization that goes far beyond "chat with an LLM."

Think of it as the **VS Code for AI Agents**: an extensible, programmable host that lets you define *who* the agent is, *what* it can do, *how* it thinks, and *where* it runs.

---

## Why AttaSeek?

| Capability | Other Desktops | AttaSeek |
|---|---|---|
| Agent profiles | Prompt strings | **TypeScript modules** — complete personality, toolset, memory, budget |
| Multi-agent | Manual / ad-hoc | **Native coordinator + swarm** — decompose → delegate → synthesize |
| Tool system | Hardcoded | **Extensible registry** — add tools as TS files, MCP servers, or plugins |
| Compaction | Basic truncation | **5-stage pipeline** — Snip → Microcompact → Collapse → Auto → Reactive |
| LLM providers | 1-3 | **Any** Anthropic or OpenAI-compatible — with per-model-slot routing, caching, retry, fallback |
| Plugin model | Limited | **Full MCP + custom plugin IPC** — plugins are isolated child processes |
| Scenarios | Chat only | **atta-core profiles** — coding, research, writing, stock quant, crypto quant, and beyond |
| Desktop feel | WebView | **Native Electron** — hiddenInset titlebar, vibrancy, tray, global shortcuts, auto-update |

---

## Features

### 🧠 Agent Engine (Native TypeScript)

The agent is **not a prompt template**. It is a complete TypeScript runtime:

```
AgentProfile → PromptTemplate (18 sections) → ContextAssembler → QueryLoop → ToolOrchestrator → AgentEventBus
```

- **Profiles are code** — each profile (`coding-profile.ts`, `research-profile.ts`) is a self-contained TypeScript module defining system identity, tool allowlists, memory scopes, token budgets, and execution strategy.
- **18-section prompt composition** — static sections (identity, harness, task philosophy, tool guidance, formatting) + dynamic sections (session, memory, environment, language, MCP) rendered per-turn with fine-grained priority ordering.
- **Token-aware compaction** — 5-level pipeline runs transparently: head/tail snip → micro-compact tool results → collapse turns into summaries → auto-trigger at 85% budget → reactive on context-length errors. No lost state, no context window explosion.
- **Event-driven architecture** — every agent action emits a typed `SessionEvent`. The UI subscribes; the agent never blocks on rendering. 17 event types carry structured payloads across the IPC bridge.

### 🤖 Multi-Agent Coordination

Not just "spawn a thread." AttaSeek has a **native coordinator** patterned after production multi-agent systems:

- **CoordinatorMode** — one coordinator agent decomposes tasks, delegates to specialists, synthesizes results.
- **SwarmManager** — parallel agent swarms with independent worker contexts, keep-alive management, and recursion guard.
- **TaskDecomposer** — LLM-powered task decomposition with dependency ordering.
- **SubAgentManager** — 8 built-in agent types (explore, plan, review, verify, coding, research, writing, general) + custom sub-agent profiles. Background execution, named workers, git worktree isolation.

### 🔧 Tool System

~35 built-in tools across 10 categories. Every tool is a manifest + implementation pair, registered in a central `ToolRegistry`:

| Category | Tools |
|---|---|
| **File Ops** | read_file, write_file, edit_file, glob, grep |
| **Shell** | bash (sandboxed, dangerous-command blocked) |
| **Search** | web_search (DuckDuckGo), web_fetch (HTTP + optional LLM summary) |
| **Code Intelligence** | lsp_diagnostic, lsp_definition, lsp_references |
| **Task Mgmt** | task_create, task_update, task_list, task_output, task_stop |
| **Agent Ops** | spawn_agent, send_message, invoke_skill |
| **Cron/Monitor** | cron_create, cron_delete, cron_list, monitor |
| **Workflow** | workflow (fan-out orchestration), tool_search (deferred discovery) |
| **UI** | ask_user_question, push_notification, enter_plan_mode, exit_plan_mode |
| **Content** | create_document, todo_write |

**Tool routing** uses Jaccard similarity-based Top-K selection — the agent only sees tools relevant to the current context, saving thousands of tokens per API call.

### 🔌 Plugin & MCP Ecosystem

AttaSeek supports **two extension models**:

1. **MCP Protocol** — full Model Context Protocol support. Configure servers in `.claude/mcp.json`; tools and prompts auto-discover and register. MCP servers are child processes with crash recovery (3 restarts, exponential backoff), OAuth support, and stdio transport.

2. **Native Plugins** — `PluginHostManager` loads plugins as isolated child processes communicating via typed IPC. Plugins contribute:
   - Activity bar entries
   - Sidebar views
   - Artifact panes
   - Tool implementations
   - Skills
   - Theme extensions

Both models coexist — MCP for AI-tool integration, native plugins for UI extension.

### 🎛️ Model Flexibility

Configure **any** LLM provider. The model config system supports:

- **Dual protocol** — Anthropic native + OpenAI-compatible, side by side. Many providers expose both interfaces (DeepSeek, Qwen, Kimi, GLM, MiniMax).
- **Model slots** — assign specific models to specific roles: `opusModel` (strong reasoning), `sonnetModel` (balanced), `haikuModel` (fast), `subagentModel` (worker agent), `compactModel` (summarization), `searchModel` (tool routing), etc.
- **Provider fallback** — chain multiple providers with automatic failover.
- **Prompt caching** — Anthropic cache breakpoint management with cache-hit detection.
- **Retry system** — 10-level exponential backoff with error classification.
- **Cost tracking** — per-session, per-model token usage with cost estimation.

**12 built-in provider templates** — Anthropic Claude, OpenAI, Google Gemini, xAI Grok, Mistral, Cohere, DeepSeek, Qwen/Tongyi, Kimi/Moonshot, GLM/Zhipu, MiniMax.

### 🖥️ Desktop-Native Experience

This is **not a web app** in an Electron shell. It uses the full native surface:

- **macOS** — hiddenInset titlebar (traffic lights embedded in sidebar), `vibrancy: "sidebar"` (frosted glass effect)
- **Windows/Linux** — titleBarOverlay for window controls in the sidebar region
- **System tray** — minimized to tray, auto-launch, global shortcut (Cmd+Shift+A)
- **Auto-update** — dual-source check (GitHub Releases + S3), download, verify (SHA512), platform-aware install
- **Window state** — position/size persistence across sessions

### 📊 Integrated Panels

| Panel | Stack | Capabilities |
|---|---|---|
| **File Explorer** | Custom + Monaco | Tree view, file preview, hex viewer, syntax highlighting |
| **Terminal** | xterm.js + node-pty | Full PTY, WebGL rendering, multi-tab, resize |
| **Diff Viewer** | Monaco Editor | Side-by-side diff, commit history, inline review |
| **Browser** | WebView | URL navigation, integrated into artifact tabs |
| **Agent Chat** | React | Streaming messages, tool call cards, permission inline, markdown rendering |

### 💾 Architecture Decisions

- **TypeScript strict mode** throughout — no `any` escapes, no class components
- **IPC security** — renderer accesses only `contextBridge`-exposed typed API; zero Node.js in renderer
- **Plaintext persistence** — JSON/JSONL files in `~/.atta/seek/`; no opaque SQLite (migrating away)
- **Jotai atoms** for state — lightweight atomic state, panel-level isolation, no Redux boilerplate
- **Registry pattern** — `Registry<T>` base for extensible activities, artifact renderers, sidebar views, inline renderers — plugins register without touching core UI code

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     RENDERER PROCESS                        │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ActivityBar│  │ SidebarSlot  │  │      AppSpace        │  │
│  │  (48px)   │  │  (260px)     │  │  ┌────────────────┐  │  │
│  │           │  │              │  │  │  AgentPane      │  │  │
│  │ Home      │  │ ChatsList    │  │  │  Conversation   │  │  │
│  │ Sessions  │  │ Automation   │  │  │  MessageFlow    │  │  │
│  │ Search    │  │ Projects     │  │  │  Composer       │  │  │
│  │ Plugins   │  │ Plugins      │  │  └────────────────┘  │  │
│  │ Projects  │  │              │  │  ═══ draggable ═══   │  │
│  │ Settings  │  │              │  │  ┌────────────────┐  │  │
│  └──────────┘  └──────────────┘  │  │ ArtifactPane    │  │  │
│                                   │  │ TabBar + Panes  │  │  │
│  State: Jotai atoms               │  └────────────────┘  │  │
│  (activity, session, composer,    └──────────────────────┘  │
│   settings, theme, update, …)                               │
└───────────────────────┬────────────────────────────────────┘
                        │ contextBridge (typed, ~70 methods)
┌───────────────────────┴────────────────────────────────────┐
│                      MAIN PROCESS                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  AGENT ENGINE                         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │  │
│  │  │ Profile  │→ │ Context  │→ │   QueryLoop      │   │  │
│  │  │ (TS mod) │  │ Assembler│  │ (yield generator) │   │  │
│  │  └──────────┘  └──────────┘  └────────┬─────────┘   │  │
│  │                                       │              │  │
│  │  ┌────────────────────────────────────┼──────────┐   │  │
│  │  │          COMPACTION PIPELINE       │          │   │  │
│  │  │  Snip → Microcompact → Collapse → Auto → Reactive │  │
│  │  └────────────────────────────────────┼──────────┘   │  │
│  │                                       │              │  │
│  │  ┌──────────┐  ┌──────────┐  ┌───────┴────────┐   │  │
│  │  │   LLM    │←→│  Tool    │→ │ AgentEventBus  │──→│IPC│
│  │  │ Provider │  │Orchestrtr│  └────────────────┘   │  │
│  │  └──────────┘  └──────────┘                       │  │
│  │  Anthropic | OpenAI Compat | Caching | Retry       │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
│  │   MCP    │ │ Plugins │ │  Hooks   │ │ Coordinator  │  │
│  │  Server  │ │  Host   │ │ Pipeline │ │  Swarm        │  │
│  │ Manager  │ │ Manager │ │ (14 evt) │ │  Decomposer   │  │
│  └──────────┘ └─────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  Store   │ │ Config  │ │  Tray    │ │   Update     │  │
│  │ JSON/JSONL│ │ Manager │ │ Manager  │ │   Manager    │  │
│  └──────────┘ └─────────┘ └──────────┘ └──────────────┘  │
└───────────────────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 10

### Install & Run

```bash
git clone https://github.com/attago/attaseek.git
cd attaseek
npm install          # postinstall runs electron-rebuild for native modules
npm run dev          # Vite HMR + Electron — opens the app window
```

On first launch, configure at least one LLM provider in **Settings → Model**.

### Build & Package

```bash
npm run build        # production build
npm run package      # package for current platform
npm run package:mac  # macOS DMG + ZIP (arm64 + x64)
npm run package:win  # Windows NSIS installer
npm run package:linux # Linux AppImage + deb
```

### Development Workflow

```bash
npm run typecheck    # strict TypeScript across main + renderer
npm run test         # Vitest unit tests (~55 suites)
npm run test:agent   # agent integration tests (mock + live)
npm run test:e2e     # Playwright end-to-end tests
npm run lint         # ESLint
npm run format       # Prettier
```

---

## The `atta-core` Profile System

The beating heart of AttaSeek. Every agent that runs inside the workstation is governed by an **AgentProfile** — a TypeScript module that defines the agent's complete cognitive architecture:

```typescript
// stock-quant-profile.ts — Quantitative trading agent
import { validateProfile } from '../AgentProfile'

export const stockQuantProfile: AgentProfile = validateProfile({
  id: 'stock-quant',
  name: 'Quantitative Trading Agent',
  description: 'Analyzes stock markets using quantitative models. Runs backtests, evaluates strategies, and generates trading signals.',

  systemPrompt: {
    id: 'stock-quant',
    sections: [
      introSection,           // "You are a quantitative trading agent..."
      customQuantSection,     // Domain-specific: alpha models, risk factors, execution
      usingToolsSection,
      memoryContextSection,
      envInfoSection,
    ],
  },

  tools: [
    'read_file', 'write_file', 'bash',
    'web_search', 'web_fetch',
    'spawn_agent',        // delegate to sub-agents for parallel research
    'cron_create',        // scheduled market data collection
    'monitor',            // watch price triggers
    'task_create', 'task_update',
    'ask_user_question',
  ],

  memory: {
    scopes: ['project', 'user'],
    recallLimit: 15,
    autoExtract: true,    // remember successful strategies
    loadFileMemory: true, // load project-specific CLAUDE.md with strategy docs
  },

  context: {
    maxTokens: 200_000,   // large context for data-heavy analysis
    budgets: { system: 10_000, tools: 8_000, memory: 6_000, messages: 150_000, reserve: 26_000 },
    autoCompact: true,
    compactTriggerRatio: 0.80,
  },

  execution: {
    maxTurns: 50,         // allow deep analysis loops
    maxParallelTools: 16,
    planning: 'inline',
  },
})
```

**This is what sets AttaSeek apart.** Other agent tools let you write a system prompt. AttaSeek lets you write the agent.

### Built-in Profiles

| Profile | Domain | Key Traits |
|---|---|---|
| `coding` | Software engineering | Read/write/execute, TDD, Git, LSP, parallel tool execution |
| `research` | Multi-source analysis | Web search, source verification, citation, deep fan-out |
| `writing` | Content & documentation | Document creation, formatting, outline, review |
| `coordinator` | Multi-agent orchestration | Task decomposition, specialist delegation, result synthesis |

### Custom Scenarios

The profile system maps naturally to quantitative domains:

| Scenario | Profile Shape |
|---|---|
| **Stock Quant** | Load strategy docs from memory → spawn sub-agents for parallel sector analysis → run backtests in bash → monitor price triggers → generate signals |
| **Crypto Quant** | On-chain data fetching → technical indicator computation → sentiment analysis via web_fetch → automated alerting via cron → risk-adjusted position sizing |
| **Academic Research** | Literature search → source verification → citation management → outline → draft → review pipeline with sub-agent adversarial verification |
| **DevOps** | Infrastructure-as-code read/write → kubectl via bash → log monitoring → incident response playbooks → multi-cluster health checks |

Each profile is **~100 lines of TypeScript** and fully composable — mix sections, tools, and execution parameters from any existing profile.

---

## Plugin Development

### MCP Server

The simplest way to extend AttaSeek. Add to `.claude/mcp.json`:

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

Your server implements the MCP protocol over stdio. Tools and prompts auto-discover on agent start.

### Native Plugin

For deep UI integration, write a native plugin:

```
my-plugin/
├── package.json        # attaseek-plugin metadata
├── main.js             # child process entry
└── ui/
    ├── sidebar.jsx     # React sidebar component
    └── activity.jsx    # ActivityBar icon + handler
```

Plugins register via `PluginRegistry` and communicate with the host over typed IPC. See `src/main/plugins/PluginIPCProtocol.ts` for the protocol spec.

---

## For Contributors

AttaSeek follows a **skill-based development workflow** via the `atta-*` command family:

| Phase | Skill | Output |
|---|---|---|
| Requirements | `/atta-analyze-requirements` | `docs/reqs/*.md` |
| Architecture | `/atta-design-architecture` | `docs/design/*.md` |
| Implementation | `/atta-plan-and-execute` | Code changes |
| Review | `/atta-review-and-fix` | Review report + fixes |

Or use the fast path: `/atta-feature-dev` (end-to-end) or `/atta-implement` (implement + review in one step).

### Code Conventions

- **TypeScript strict mode** — no implicit `any`, no class components
- **React function components + hooks** only
- **IPC**: main process → `contextBridge` → typed renderer API; renderer never touches Node.js
- **CSS**: Tailwind atomic classes; extract shared patterns into components
- **Testing**: Vitest for unit/integration, Playwright for E2E; VCR available for LLM response replay
- **Commits**: conventional commit prefixes encouraged

### Project Structure

```
src/
├── main/agent/          # Agent engine (~75 files, 15 subsystems)
│   ├── orchestrator/    #   QueryEngine, query-loop, AgentState
│   ├── llm/             #   Providers, caching, retry, fallback
│   ├── tools/           #   ToolOrchestrator, StreamingExecutor, ~35 implementations
│   ├── compact/         #   5-stage compaction pipeline
│   ├── context/         #   ContextAssembler, Git, memory prefetch
│   ├── profile/         #   AgentProfile system + 5 built-in profiles
│   ├── prompt/          #   18-section prompt template engine
│   ├── mcp/             #   MCP server lifecycle + client
│   ├── hooks/           #   14-event hook pipeline
│   ├── subagent/        #   8 sub-agent types + worktree isolation
│   ├── coordinator/     #   Multi-agent coordinator, swarm, decomposer
│   ├── memory/          #   FileMemory, memdir, LLM extraction
│   ├── skills/          #   Skill loader, executor, arg parser
│   ├── messages/        #   Extended message types
│   └── commands/        #   13 slash commands
├── main/ipc/            # IPC handlers (19 modules)
├── main/store/          # JSON/JSONL persistence layer
├── main/plugins/        # Plugin host + IPC protocol
├── main/tray/           # System tray + global shortcuts
├── main/update/         # Auto-update system
├── shared/types/        # 17 shared type modules (~200+ types)
├── preload/             # contextBridge API surface (~70 methods)
└── renderer/            # React UI (~70 components, 9 workspaces, 6 renderers)
```

---

## License

UNLICENSED — proprietary. See [LICENSE](LICENSE).

---

<p align="center">
  Built with TypeScript, React, Electron, and ambition.<br/>
  <a href="docs/README.zh-CN.md">中文文档</a>
</p>
