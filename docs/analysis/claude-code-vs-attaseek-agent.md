# Claude Code vs AttaSeek Agent 实现差异分析

> 分析日期：2026-06-08
> 对比对象：`AttaCode/3rds/claude-code-main/src/` (TypeScript) vs `AttaSeek/src/main/agent/` (TypeScript/Electron)

---

## 1. 主要业务处理流程 (Turn Loop)

### 1.1 顶层入口

| 维度 | Claude Code | AttaSeek |
|------|-------------|----------|
| 主入口文件 | `src/QueryEngine.ts` + `src/query.ts` | `src/main/agent/orchestrator/QueryEngine.ts` + `query-loop.ts` |
| 会话模型 | `QueryEngine` 类，一 session 一实例，持有 `mutableMessages` | 同架构：`QueryEngine` 类，一 session 一实例，全局 `_engines` Map 管理 |
| 提交入口 | `submitMessage(prompt, options?)` → AsyncGenerator | `submitMessage(input)` 同模式 |
| 对外暴露 | 同时有 `ask()` 便捷函数（内部 new QueryEngine） | `AgentRuntime` 作为 Electron 宿主适配层管理 `QueryEngine` 生命周期 |

**结论：顶层架构高度一致，AttaSeek 直接复刻了 Claude Code 的 QueryEngine + query-loop 双层模式。**

### 1.2 Turn Loop 内部结构

Claude Code 的 `queryLoop()` (in `query.ts`):

```
while (true):
  1. memory prefetch (fire-and-forget)
  2. skill discovery prefetch (fire-and-forget)
  3. context budget enforcement (tool result truncation)
  4. snip compaction
  5. microcompact
  6. context collapse
  7. autocompact (may splice boundary + continue)
  8. prompt-too-long pre-check
  9. callModel() streaming loop →
      - accumulate tool_use blocks
      - StreamingToolExecutor: execute tools as they arrive
  10. handle fallback (model switch)
  11. recovery paths (PTL/max_output_tokens/reactive compact)
  12. handleStopHooks (extractMemories, confidence, session memory, prompt coaching)
  13. token budget check
  14. if tool_use: runTools() / getRemainingResults()
  15. tool use summary (fire-and-forget Haiku call)
  16. attachment injection
  17. check maxTurns → continue/break
```

AttaSeek 的 `queryLoop()` (in `query-loop.ts`):

```
while (true):
  1. token budget check → inject meta continue message
  2. compact warning check → emit head-up
  3. compaction pipeline (5-stage: Snip→TimeMicrocompact→Collapse→AutoCompact)
  4. tool pairing validation → repair orphaned tool_use blocks
  5. LLM call with inner fallback loop →
      - primary model via StreamingToolExecutor
      - on error: model fallback
      - on max_tokens: escalate max_output_tokens
      - on context-length: Collapse drain (L1) → Reactive compact (L2)
      - on other: routeError() with 5 recovery levels + circuit breaker
  6. post-sampling hooks + Stop hooks
  7. tool execution (streaming results + batch results)
  8. tool use summary (heuristic for ≤2 tools, LLM for >2 tools)
  9. append to history + microcompact
  10. extract memories (fire-and-forget)
```

### 1.3 流程关键差异

| 差异点 | Claude Code | AttaSeek | 影响 |
|--------|-------------|----------|------|
| **Memory prefetch 时机** | 在 compact 之前、loop 刚开始时 | 不在 query-loop 中，由 ContextAssembler 在 assemble 时处理 | AttaSeek 的 memory 加载是同步阻塞的，Claude Code 是 fire-and-forget |
| **context budget enforcement** | 独立步骤，在 compact 前做 tool result 替换 | 合并在 CompactionPipeline 中做 | Claude Code 更显式 |
| **tool pairing validation** | 没有显式步骤 | 有独立 `toolPairing` 模块，修复孤儿 tool_use | **AttaSeek 特有**，防止 Anthropic API 400 错误 |
| **recovery 体系** | 分散在 query.ts 中（PTL/max_tokens/fallback 各自独立处理） | 统一 `recovery-router.ts`：5 层 + circuit breaker | **AttaSeek 更系统化** |
| **stop hooks 内容** | extractMemories + confidence rating + prompt suggestion + session memory + prompt coaching | HookPipeline 的 Stop 事件 + HookManager 的 post-sampling | Claude Code 有更多内置 stop hook（confidence、coaching） |
| **model fallback** | 在 callModel 外层 catch `FallbackTriggeredError`，清状态重试 | 在 query-loop 内的 inner loop 中，切换 provider 重试 | 机制相同，位置不同 |

### 1.4 工具执行流程

两者完全一致的三层架构：

```
Layer 1: 多工具编排
  Claude Code: toolOrchestration.ts  → runTools()
  AttaSeek:    ToolOrchestrator.ts   → orchestrateTools()
  功能: partitionToolCalls() → 并发安全分组 → 并行/串行批次执行

Layer 2: 流式工具执行
  Claude Code: StreamingToolExecutor.ts (同一文件名)
  AttaSeek:    StreamingToolExecutor.ts (同一文件名)
  功能: 状态机 per slot (accumulating→queued→executing→completed→yielded)
        工具随 streaming content_block_stop 到达即开始执行
        兄弟工具错误级联取消

Layer 3: 单工具执行
  Claude Code: toolExecution.ts → runToolUse()
  AttaSeek:    ToolExecutor.ts  → execute()
  功能: 查工具 → validateInput → checkPermissions → canUseTool → preHooks → tool.call() → postHooks → 结果截断/持久化
```

**Tool 抽象差异：**

| 维度 | Claude Code | AttaSeek |
|------|-------------|----------|
| 工具定义 | `Tool<Input, Output, P>` 结构类型，单文件 `Tool.ts` 约 ~300 行 | `ToolManifest` (注册表元数据) + `TOOL_IMPLS` Map (实现函数)，分离在两个模块 |
| 注册机制 | `getAllBaseTools()` 返回全量清单，`assembleToolPool()` 组装可用池 | `ToolRegistry` 单例注册表，MCP 工具以 `mcp:<server-id>` 前缀注册 |
| 权限检查 | `checkPermissions()` 在 Tool 上（每个 tool 可选覆盖），`canUseTool` 做通用检查 | `PermissionService` 集中管理，按 scope 分级 (tool > plugin > project > session) |
| 工具路由 | 无（全量工具始终发送） | `ToolRouter` 基于 Jaccard 相似度的 Top-K 选择 |
| 渲染 | 每个 tool 有 `renderToolUseMessage/renderToolResultMessage`（React 组件） | 渲染逻辑在 renderer 进程，通过 `SessionEvent` 事件类型分发 |

**关键差异：Claude Code 的工具自带 UI 渲染；AttaSeek 有 ToolRouter 做工具筛选（减少 token 消耗），Claude Code 无此概念。**

### 1.5 流式处理

两者都是 SSE streaming + StreamingToolExecutor 并行执行。差异：

| 维度 | Claude Code | AttaSeek |
|------|-------------|----------|
| API SDK | 自己的 `services/api/claude.ts` 封装（Bun/Node） | `AnthropicProvider` + `OpenAICompatibleProvider`，支持多 provider |
| 模型切换 | `fallbackModel` 单层 fallback | `ProviderFallback` 链式 fallback（slot → fallback slots → ultimate fallback） |
| 事件持久化 | 直接写 JSONL transcript | `AgentEventBus` 异步缓冲（100ms debounce，50 事件强制 flush） |
| 多 provider | 仅 Anthropic API | Anthropic + OpenAI Compatible（DeepSeek 等） |

---

## 2. 主要模块划分

### 2.1 模块对照表

| 功能域 | Claude Code | AttaSeek | 对齐程度 |
|--------|-------------|----------|----------|
| **Turn Loop** | `QueryEngine.ts` + `query.ts` | `orchestrator/QueryEngine.ts` + `query-loop.ts` | ★★★★★ 高度对齐 |
| **Tool 定义** | `Tool.ts` + `tools.ts` + `tools/` 目录 (~50+ 工具) | `tools/ToolOrchestrator.ts` + `tools/implementations/` (~25+ 工具) | ★★★☆☆ 概念对齐，实现差异 |
| **Tool 执行** | `services/tools/toolExecution.ts` + `toolOrchestration.ts` + `StreamingToolExecutor.ts` | `tools/ToolExecutor.ts` (主进程) + `agent/tools/ToolOrchestrator.ts` + `agent/tools/StreamingToolExecutor.ts` | ★★★★★ 高度对齐 |
| **Compact** | `services/compact/` 12 个文件 (compact, microCompact, autoCompact, snipCompact, grouping, prompt, postCompactCleanup, timeBasedMCConfig, sessionMemoryCompact, compactWarningHook, compactWarningState, apiMicrocompact) | `compact/` 14 个文件 (CompactionPipeline, ContextCompactor, AutoCompactor, CollapseManager, CollapseStore, Microcompactor, ReactiveCompactor, SnipCompactor, CompactWarningState, EditorBridge, FileStateCache, compact-prompt, token-counter) | ★★★★☆ 策略相当, AttaSeek 更多 stage |
| **Hooks** | `hooks/` 目录（permission hooks, tool permission UI, notification hooks） | `hooks/HookPipeline.ts` (12 事件类型) + `hooks/HookManager.ts` (legacy) | ★★★☆☆ Claude Code 更面向 UI，AttaSeek 更面向生命周期 |
| **Memory** | `services/SessionMemory/` + `services/extractMemories/` | `memory/MemdirManager.ts` + `memory/MemoryExtractor.ts` + `memory/FileMemory.ts` + `memory/SessionMemory.ts` | ★★★★☆ 分层相同，AttaSeek 更多格式 |
| **MCP** | `services/mcp/` (client, config, auth, types, normalization, transports, elicitation) | `mcp/MCPServerManager.ts` + `mcp/MCPClient.ts` + `mcp/MCPTransport.ts` + `mcp/MCPConfigLoader.ts` + `mcp/MCPOAuth.ts` | ★★★★☆ 功能对齐 |
| **LSP** | `services/lsp/` (LSPClient, LSPServerManager, LSPServerInstance, LSPDiagnosticRegistry, manager, config, passiveFeedback) | 无独立 LSP 目录；通过 `tools/implementations/lsp.ts` 工具实现 | ★★☆☆☆ **AttaSeek 缺失完整 LSP 子系统** |
| **Skills** | `engine/src/skill_loader.rs` (AttaCode Rust 版) / 内置 `src/commands.ts` 中的 skill 命令 | `skills/SkillLoader.ts` + `skills/SkillSourceLoader.ts` + `skills/SkillExecutor.ts` | ★★★☆☆ 功能近似 |
| **SubAgent** | `services/AgentSummary/` + coordinator 内建 | `subagent/SubAgentManager.ts` + `subagent/RecursionGuard.ts` + `subagent/worktree/` + 4 个 built-in agent | ★★★★☆ AttaSeek 更完整 |
| **Profile** | 无独立概念（通过 system prompt 配置） | `profile/AgentProfile.ts` + 3 内置 profiles (coding/research/writing) | ★★★★★ **AttaSeek 特有优势** |
| **Prompt 组装** | `context.ts` 中直接组装 + `customSystemPrompt/appendSystemPrompt` | `prompt/PromptTemplate.ts` 分节引擎 + 4 sections (identity/tools/memory/session) | ★★★★☆ AttaSeek 更模块化 |
| **LLM Provider** | `services/api/claude.ts` (仅 Anthropic) | `llm/` 目录 17 个文件：Anthropic + OpenAI Compatible + retry + cache + fallback + cost | ★★★★★ **AttaSeek 更完善和通用** |
| **权限** | `PermissionDecision` + RuleSet 规则引擎 + AutoClassifier | `permission/PermissionService.ts` 按 scope 分级 | ★★★☆☆ Claude Code 规则引擎更复杂 |
| **配置** | 4 层深合并 (env → user settings → project settings → CLI) | `config/ConfigManager.ts` + `AttaSettingsLoader.ts` | ★★★☆☆ |
| **Slash Commands** | `commands.ts` + `commands/` 目录（~80+ 命令） | `agent/commands/` 目录 | ★★☆☆☆ Claude Code 命令数量远超 |
| **Context 组装** | `context.ts` | `context/ContextAssembler.ts` + legacy `ContextBuilder.ts` | ★★★★☆ |
| **Remote/CCR** | `remote/` 完整远程会话管理 (SessionsWebSocket, RemoteSessionManager, sdkMessageAdapter, remotePermissionBridge) | `coordinator/` 多 Agent 协调 (CoordinatorMode, SwarmManager) | ★★☆☆☆ 不同方向：Claude Code 做远程接入，AttaSeek 做多 Agent 协调 |
| **Error Recovery** | 分散在 query.ts (PTL/max_tokens/fallback) | `orchestrator/recovery-router.ts` 统一 5 层 + circuit breaker | ★★★★★ **AttaSeek 特有优势** |
| **Token Budget** | `query/tokenBudget.ts` | `orchestrator/token-budget.ts` | ★★★★☆ |
| **Tool Summary** | fire-and-forget Haiku call | `orchestrator/tool-summary.ts` (heuristic + LLM) | ★★★☆☆ |
| **Feature Flags** | GrowthBook 集成 | `features/FeatureFlags.ts` 简单开关 | ★★☆☆☆ |
| **Telemetry** | `services/analytics/` + OpenTelemetry | `telemetry/TelemetryService.ts` | ★★★☆☆ |
| **VCR/Record** | `services/vcr.ts` (录制/回放) | `llm/vcr.ts` (录制/回放) | ★★★★☆ |

---

## 3. 主要模块功能特性对比

### 3.1 Compaction 系统

| 特性 | Claude Code | AttaSeek |
|------|-------------|----------|
| 策略数量 | 4: snip, microcompact, collapse, full_compact | 5: Snip, TimeMicrocompact, Collapse, AutoCompact, ReactiveCompact |
| 触发时机 | autoCompactIfNeeded (每 turn 开始) | CompactionPipeline (每 turn 开始) + ReactiveCompact (错误触发) |
| PTL 重试 | compact 内部有 PTL retry loop (截断旧 rounds 重试 3 次) | query-loop 中有 Collapse drain (L1) + Reactive compact (L2) |
| Post-compact | 生成边界标记 + summary + 文件附件 + plan/skills/agent/MCP deltas | 生成压缩事件 + telemetry |
| 状态追踪 | 无显式跨 turn 状态 | `pipelineTracking` + `compactSummary` + `collapseManager` on AgentState |
| Warning 系统 | `compactWarningHook.ts` + `compactWarningState.ts` | `CompactWarningState.ts` (同模式) |

### 3.2 Memory 系统

| 特性 | Claude Code | AttaSeek |
|------|-------------|----------|
| L0 (文件) | `~/.claude/projects/<path>/memory/*.md` + `MEMORY.md` index | `CLAUDE.md` + `~/.atta/seek/memories/*.md` + `MEMORY.md` index |
| L1 (会话) | Session memory markdown file (post-sampling hook) | SessionMemory.ts (同模式) |
| L2 (持久化) | 无独立 L2（文件即持久化） | SQLite via MemoryService |
| 自动提取 | `extractMemories.ts`: cursor + overlap guard + coalescer + 5 turn max | `MemoryExtractor.ts`: cursor + coalescer (同模式) |
| 提取工具 | `runForkedAgent()` with restricted `canUseTool` | 同模式，fork agent 做提取 |
| 主 Agent 互斥 | 检查主 agent 是否已写 (mutual exclusion) | 未明确 |

### 3.3 Hook 系统

| 特性 | Claude Code | AttaSeek |
|------|-------------|----------|
| 事件类型 | 9 事件 (PreToolUse, PostToolUse, Stop, etc.) | 12 事件类型 (PreToolUse, PostToolUse, PermissionRequest, Stop, SubagentStart/Stop, etc.) |
| Hook 类型 | Command/Prompt/HTTP/Agent 4 种 | Command/HTTP/Prompt 3 种 |
| 插件集成 | Plugin TOML `[hooks]` section | 通过 `SkillSourceLoader` 加载 |
| 执行方式 | 同步/异步混合 | HookPipeline (event-driven) + HookManager (post-sampling, legacy) |

### 3.4 MCP 集成

| 特性 | Claude Code | AttaSeek |
|------|-------------|----------|
| Transport | stdio + StreamableHttp | stdio + SSE + HTTP + WebSocket (4 种) |
| OAuth | 完整 OAuth2 流程 | MCPOAuth.ts |
| 重连 | lazy reconnect + 指数退避 | 崩溃恢复 (3 次重启 + 指数退避) |
| 工具命名 | `mcp__server__tool` 前缀 | `mcp:<server-id>` 前缀 |
| 权限 | `channelPermissions.ts` | 通过 PermissionService 统一管理 |
| 配置加载 | `config.ts` | `MCPConfigLoader.ts` (from `.claude/mcp.json`) |

### 3.5 SubAgent / 多 Agent

| 特性 | Claude Code | AttaSeek |
|------|-------------|----------|
| 通信方式 | 无内建 subagent（通过 Agent tool） | `SubAgentManager`: fork/cancel/list + `RecursionGuard` |
| Worktree 隔离 | WorktreeTool | `WorktreeManager` (专用模块) |
| 内置 Agent | 无 | 4 个 built-in: explore, plan, review, verify |
| 多 Agent 协调 | 无（单 Agent 设计） | `CoordinatorMode` + `SwarmManager` |
| 并发 Agent | 无 | 16 agent 上限 |

**关键差异：Claude Code 是单 Agent 设计，AttaSeek 原生支持多 Agent 协调。这是 AttaSeek 最大的架构扩展。**

### 3.6 LLM Provider 层

| 特性 | Claude Code | AttaSeek |
|------|-------------|----------|
| Provider 数量 | 1 (Anthropic) | 2+ (Anthropic + OpenAI Compatible) |
| Fallback 机制 | `fallbackModel` 单层 | `ProviderFallback` 链式 (slot → fallback slots → ultimate) |
| Retry | `withRetry.ts` | `withRetry.ts` + exponential backoff (10x max) |
| Prompt Cache | 无独立模块 | `PromptCache.ts` + `cache-break-detector.ts` |
| Cost 追踪 | `cost-tracker.ts` | `cost-tracker.ts` |
| VCR | `vcr.ts` (录制/回放) | `vcr.ts` |
| Model 解析 | 无（直接使用 model string） | `ModelResolver.ts` + `ProviderDef.ts` (slot-based) |
| 流解析 | SDK 原生 | `OpenAIStreamParser.ts` (自定义解析) |

### 3.7 Slash Commands

Claude Code: ~80+ 命令（`commands.ts` + `commands/` 目录），覆盖：
- 会话管理: /clear, /compact, /resume, /export, /undo, /retry
- 模型配置: /model, /status, /cost, /temperature, /max-tokens
- 工具: /tools, /permissions, /mode, /output-style
- 开发: /diff, /review, /commit, /pr, /init
- 插件: /mcp, /skills, /config, /settings
- 其他: /help, /quit, /doctor, /feedback, /tutorial, /brief, /repl

AttaSeek: `agent/commands/` 目录，命令数量明显少于 Claude Code。缺少 `/diff`, `/review`, `/commit`, `/pr` 等开发工作流命令。

---

## 4. 测试与性能

### 4.1 测试

| 维度 | Claude Code (原版 TS) | AttaSeek |
|------|----------------------|----------|
| 单元测试 | Vitest | Vitest (`test/` 目录) |
| 集成测试 | Mock LLM 测试框架：65 完整场景 + 13 集成测试 (turn_loop / resume_compact / scenarios) | 有测试但规模不详 |
| VCR 录制 | `vcr.ts` 录制/回放 API 响应 | `llm/vcr.ts` 同模式 |
| 测试隔离 | DI (QueryLoopDeps) 让 query-loop 完全可测 | 同样的 DI 模式 (`QueryLoopDeps`) |
| E2E | 无（TS 原版） | 无 |

**关键发现：Claude Code 原版有 Mock LLM 测试框架可以驱动引擎全流程，包括 turn_loop、resume_compact、scenarios。AttaSeek 有同样的 DI 设计使 query-loop 可测，但未见类似规模的集成测试套件。**

### 4.2 性能

| 维度 | Claude Code | AttaSeek |
|------|-------------|----------|
| Prompt Cache | SDK 原生 cache 支持 | 独立 `PromptCache.ts` 管理 cache key |
| Token 估算 | `tiktoken-rs` (Rust) / `services/tokenEstimation.ts` | `compact/token-counter.ts` 3-tier estimation (精确/快速/粗略) |
| 事件持久化 | 直接写 JSONL | `AgentEventBus` 异步缓冲 (100ms debounce, 50 events flush) |
| 工具并发 | `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` 默认 10 | 同模式，`maxParallelTools` 可配置 |
| 上下文压缩 | 按需触发 | 5-stage pipeline 每次都评估，可能有更多开销 |
| 内存提取 | fire-and-forget + coalescer | fire-and-forget + coalescer (同模式) |

### 4.3 错误处理与韧性

| 维度 | Claude Code | AttaSeek |
|------|-------------|----------|
| PTL 恢复 | compact PTL retry loop (3 次) | Collapse drain + ReactiveCompact (2 层) |
| Max tokens 恢复 | escalate max_output_tokens (3 次，cap→64K) | 同模式 |
| Circuit breaker | 无 | 3 次同层失败 → 断路由 (`recovery-router.ts`) |
| Tool 结果持久化 | 大结果存磁盘，消息中替换为引用 | 同模式 |

---

## 5. 总结

### 5.1 AttaSeek 领先于 Claude Code 原版的领域

1. **多 Provider LLM 层** — Anthropic + OpenAI Compatible，ProviderFallback 链式 fallback，slot-based model resolution
2. **多 Agent 协调** — CoordinatorMode + SwarmManager + SubAgentManager + RecursionGuard，Claude Code 是单 Agent
3. **Profile 架构** — 3 个内置 profile (coding/research/writing)，行为由 profile 驱动而非代码分支
4. **Error Recovery** — 统一 5 层 recovery-router + circuit breaker，比 Claude Code 的分散处理更系统
5. **Tool Pairing** — 显式验证/修复孤儿 tool_use 块，防止 API 400 错误
6. **Prompt 组装** — PromptTemplate 分节引擎，比 Claude Code 的直接拼接更模块化
7. **事件持久化** — AgentEventBus 异步缓冲，减少磁盘 I/O

### 5.2 Claude Code 原版领先于 AttaSeek 的领域

1. **Slash Commands** — ~80+ vs AttaSeek 的有限数量；缺少 /diff, /review, /commit, /pr 等开发工作流
2. **LSP 集成** — 完整的 LSP 子系统 (LSPClient, LSPServerManager, LSPServerInstance, LSPDiagnosticRegistry, passiveFeedback)；AttaSeek 只有工具级实现
3. **Tool 数量** — 50+ vs 25+；缺少 Workflow/ToolSearch/TeamCreate 等高级工具
4. **权限规则引擎** — RuleSet (specificity + source priority + behavior rank) + AutoClassifier；AttaSeek 的 scope-based 相对简单
5. **Feature Flags** — GrowthBook 集成（A/B testing, 灰度发布）；AttaSeek 是简单开关
6. **Remote/CCR** — 完整的远程会话管理（SessionsWebSocket, RemoteSessionManager, sdkMessageAdapter）；AttaSeek 无此能力
7. **Mock 测试框架** — 65 场景 + 13 集成测试
8. **Tool 渲染** — 每个 tool 自带 React UI 渲染；AttaSeek 渲染逻辑与工具分离

### 5.3 架构差异总结

| 维度 | Claude Code | AttaSeek |
|------|-------------|----------|
| 设计哲学 | 大而全的单 Agent 工作台 | 多 Agent + 多 Provider + 多 Profile 的通用平台 |
| Agent 模型 | 单 Agent | 多 Agent (Coordinator + Swarm + SubAgent) |
| 扩展性 | 工具/命令/插件可扩展 | Profile 驱动 + 多 Provider + MCP 扩展 |
| 目标场景 | CLI 终端用户 | Electron 桌面应用 (GUI + CLI) |
| 代码结构 | 扁平（大量文件在 src/ 根目录） | 深度嵌套（agent/ 下有 20+ 子目录） |
| 技术债 | 原始 Claude Code TS 版本，legacy 代码共存 | 同时存在 legacy AgentOrchestrator 和 current QueryEngine 两套引擎 |

### 5.4 建议关注的改进方向

1. **补齐 Slash Commands** — 特别是 /diff, /review, /commit, /pr 等开发工作流命令
2. **完善 LSP 子系统** — 从工具级实现提升为独立子系统
3. **增强权限规则引擎** — 考虑引入 specificity + source priority + behavior rank
4. **扩展测试套件** — 基于现有 DI 设计构建 Mock LLM 集成测试
5. **清理 legacy 代码** — 移除 AgentOrchestrator 和 ContextBuilder
6. **Feature Flags** — 考虑集成 GrowthBook 或更丰富的灰度发布能力
