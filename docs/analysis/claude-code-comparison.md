# AttaSeek Agent vs Claude Code 参考实现 — 完整比较分析

> 分析日期: 2026-06-08
> 参考源码: `../AttaCode/3rds/claude-code-main/src/`
> 分析范围: 4 维度 × 2 代码库 = 8 方向深度探索

---

## 1. 主要业务处理流程

### 整体架构对比

两个系统都使用 **三层 AsyncGenerator 管道** 架构：

| 层 | Claude Code (CC) | AttaSeek (AS) |
|---|---|---|
| 入口 | `QueryEngine.submitMessage()` (1295行) | `AgentRuntime.createTask()` → `QueryEngine.submitMessage()` (205 + 393行) |
| 核心循环 | `queryLoop()` 在 `query.ts` (1729行) | `queryLoop()` 在 `orchestrator/query-loop.ts` (1159行) |
| 委托 | `yield*` 从 QueryEngine → queryLoop | `yield*` 从 QueryEngine → queryLoop |
| 事件流 | `AsyncGenerator<Message \| StreamEvent, Terminal>` | `AsyncGenerator<SessionEvent, QueryLoopResult>` |

### 循环迭代管线（per-turn pipeline）

两个实现在 per-turn 循环中的管线顺序基本一致：

| 步骤 | Claude Code | AttaSeek |
|------|-------------|----------|
| 1 | Snip (HISTORY_SNIP feature) | Abort check + Memory prefetch |
| 2 | Microcompact | Token budget evaluation + USD cost check |
| 3 | Context Collapse (CONTEXT_COLLAPSE) | Tool result budget enforcement |
| 4 | Autocompact | Compaction warning check |
| 5 | Blocking-limit check | 5-stage compaction pipeline |
| 6 | LLM call (streaming + inner fallback) | Tool pairing validation |
| 7 | Post-sampling hooks (fire-and-forget) | LLM call (streaming + inner fallback) |
| 8 | Abort handling | Post-sampling hooks |
| 9 | Tool execution (streaming + batch) | Stop hooks |
| 10 | Stop hooks | Tool execution (streaming + batch) |
| 11 | Attachments (file changes, memory, skills, commands) | Structured output extraction |
| 12 | Token budget continuation | Tool use summary |
| 13 | Next turn or terminate | Next turn or terminate |

**关键差异:**
- CC 用多个文件模块化其查询循环（`stopHooks.ts`、`tokenBudget.ts`、`query/config.ts`、`query/deps.ts`），而 AS 将大部分逻辑内联在单个 `query-loop.ts` 中
- CC 将附件处理（文件变更、命令队列、内存预取消耗、技能发现）集成到查询循环中，AS 将这些分离到 `ContextAssembler`
- CC 内联处理命令队列消耗和任务生命周期通知，AS 将它们推迟到 `AgentRuntime` 和 `CronScheduler`/`MonitorManager`

### 错误恢复路径

两个实现都有分层错误恢复，但 AS 将其形式化得更干净：

| Claude Code | AttaSeek |
|---|---|
| 内联 `catch` 块，附带 feature-gated `if` 判断 | `recovery-router.ts` (219行)，含 5 层、每层限制、断路器 |
| Max output recovery: 硬编码逻辑 | `escalateMaxOutputTokens()` 含 `MAX_OUTPUT_RECOVERY_ATTEMPTS` (3次) |
| Fallback model: `FallbackTriggeredError` + retry | 相同模式，`FallbackTriggeredError` + `slotResolver.fallback()` |
| Reactive compact: `tryReactiveCompact()` 内联在 `query.ts` | `ReactiveCompactor` 模块 (324行)，含渐进回退 |

---

## 2. 主要模块划分

### 模块大小对比

| 模块 | CC 文件数 | AS 文件数 | CC 代码行数 | AS 代码行数 | CC 总计 | AS 总计 |
|---|---|---|---|---|---|---|
| 查询循环/引擎 | 6 | 10 | ~3,200 | ~3,070 | | |
| 工具系统 | 184+ | 34 | ~40,000+ | ~2,894 | | |
| 压缩 | 12 | 14 | ~3,960 | ~2,653 | | |
| 钩子系统 | 17 | 8 | ~3,500+ | ~854 | | |
| MCP | 22 | 6 | ~6,000+ | ~1,056 | | |
| LLM/API | 散布各处 | 17 | ~2,500+ | ~3,214 | | |
| 技能 | 3 | 7 | ~1,350 | ~738 | | |
| 上下文 | 散布各处 | 4 | ~200 | ~1,103 | | |
| 内存 | 2 | 4 | ~500 | ~754 | | |
| 子代理/协调器 | 4 任务类型 | 9 | ~2,200+ | ~1,160 | | |

### 结构差异

**Claude Code** 按功能领域组织，深度嵌套:
```
tools/BashTool/          (14 files, 12,411 lines)  -- each tool is a sub-directory
services/compact/        (12 files)                 -- compaction as a service
services/mcp/            (22 files)                 -- MCP as a mature service
utils/hooks/             (17 files)                 -- hook utilities
hooks/                   (React hooks for UI)       -- separate UI hooks
```

**AttaSeek** 按关注点组织:
```
agent/
  orchestrator/     -- query loop + engine + state + recovery + budget + summary
  compact/          -- 5-stage pipeline + collapse + snip + microcompact + autocompact
  tools/            -- orchestrator + streaming executor + implementations
  hooks/            -- pipeline + manager + executors
  llm/              -- provider + retry + fallback + cache + VCR + cost
  skills/           -- loader + executor + activation + bundled
```

**AttaSeek 缺少的关键区域:**
- `coordinator/CoordinatorMode.ts` — 仅 98 行 (CC: 369 行，prompt-driven)
- `coordinator/SwarmManager.ts` — 仅 186 行基本群管理
- `subagent/SubAgentManager.ts` — 仅 194 行 (CC: `LocalAgentTask.tsx` 682 行 + `RemoteAgentTask.tsx` 855 行)
- 没有 `bootstrap/` 目录 (AS 的 `boot.ts` 是 Electron 特定的)
- 没有 `entrypoints/` (AS 的入口是 Electron `main/index.ts`)

---

## 3. 主要模块功能特性

### 3.1 压缩 (Compaction)

| 特性 | Claude Code | AttaSeek |
|---|---|---|
| Snip compaction | `HISTORY_SNIP` feature flag | `SnipCompactor` — fully implemented |
| Microcompact (content) | Native `cache_edit` API | Character-based truncation + `CacheEdit` tracking |
| Microcompact (time) | API-level, native integration | Standalone `timeMicrocompact` (60min gap) |
| Collapse | `CONTEXT_COLLAPSE` feature flag | `CollapseManager` + `CollapseStore`, commit-log replay |
| Auto-compact | LLM summary with forked agent + circuit breaker (3 failures) | LLM summary with compact model slot + hysteresis tracking |
| Reactive compact | Inlined inside `query.ts` | Standalone `ReactiveCompactor` module, progressive fallback |
| Warning suppression | `compactWarningState.ts` (18 lines) | `CompactWarningState` (139 lines), 60s suppression + 5% delta |

### 3.2 工具系统

| 特性 | Claude Code | AttaSeek |
|---|---|---|
| 工具数量 | ~45 内置 + MCP | ~25 实现 |
| Concurrency safety | `isConcurrencySafe()` function + name heuristic per-tool | Same pattern: runtime function → boolean → name heuristic |
| Streaming execution | `StreamingToolExecutor` with slot state machine | `StreamingToolExecutor` with **same slot state machine** |
| Sibling abort | Implicit (via abort controller) | Explicit `siblingAbortController` with error propagation |
| Streaming fallback discard | `discard()` with synthetic errors | `discard()` marks as `STREAMING_FALLBACK` |
| Bash security | Extremely complex (14 files, 12K lines): AST parsing, path validation, sandbox | Basic: `bash.ts` + `bash-tools.ts` |
| Permission pipeline | 5-level cascade: config → memory → classifier → hooks → dialog | `PermissionService` + `PermissionBridge` |
| VCR recording | Full `services/vcr.ts` (406 lines) with path normalization | `llm/vcr.ts`, wrapper decorator + SHA-256 request matching |

### 3.3 钩子系统

| 特性 | Claude Code | AttaSeek |
|---|---|---|
| 钩子事件 | 15+ event types | 14 event types |
| 执行后端 | Shell, HTTP, Agent, Prompt | Command, HTTP, Prompt (no Agent backend) |
| Post-sampling | `executePostSamplingHooks()` fire-and-forget | `HookManager.execute()` |
| Stop hooks | `handleStopHooks()` with blocking/continue | `HookPipeline.execute('Stop')` |
| 优先级排序 | Yes | Yes (`priority` field in `HookManager`) |
| Async HTTP | OAuth-style deferred callback | Async mode `{"async": true}` |

### 3.4 MCP

| 特性 | Claude Code | AttaSeek |
|---|---|---|
| 传输 | Stdio, SSE, HTTP, WS, SDK, In-process | Stdio, SSE (stub), HTTP, WS |
| 服务器管理 | Full `client.ts` (3,348 lines) | `MCPServerManager.ts` (246 lines) |
| OAuth | Full flow with browser launch | "Lightweight" Auth Code Grant with local callback (port 18923) |
| 崩溃恢复 | Reconnect via `PendingMCPServer` | 3 auto-restarts with exponential backoff |
| 资源 | `ListMcpResourcesTool` + `ReadMcpResourceTool` | Basic resource list/read |
| 提示→技能 | Yes | Yes (`MCPBridge`) |
| 工具名规范化 | `mcp__ServerName__toolName` | `mcp:<server>:<tool>` |

### 3.5 LLM 集成

| 特性 | Claude Code | AttaSeek |
|---|---|---|
| 提供者 | Anthropic (native) + Bedrock + Vertex + Foundry | Anthropic + OpenAI Compatible |
| 重试逻辑 | `withRetry.ts` (823 lines), subscriber-aware | `withRetry.ts` (349 lines), 10 retries |
| 模型回退 | Opus → Sonnet with `FallbackTriggeredError` | Slot fallback chain via `slotResolver.fallback()` |
| 提示缓存管理 | Server-side, with `promptCacheBreakDetection.ts` (728 lines) | Client-side `PromptCache.ts` with SHA-256 keys + per-message caching |
| VCR | Full fixture system with pipeline normalization | `wrapWithVCR()` decorator, JSONL storage |
| 成本跟踪 | Per-model with OTEL counters | `CostTracker` with per-model pricing tables + fuzzy resolution |
| 配置 | Settings files + managed + env | 7-layer: shared → app → env → project → local |

### 3.6 子代理 / 多代理

| 特性 | Claude Code | AttaSeek |
|---|---|---|
| 子代理 | `LocalAgentTask.tsx` (682 lines): independent query, background run | `SubAgentManager.ts` (194 lines): independent QueryEngine, context isolation |
| Worktree isolation | Via `EnterWorktreeTool` | `WorktreeManager` (90 lines) |
| Coordinator mode | `CoordinatorMode` (369 lines): full leader/worker, mostly prompt-based | `CoordinatorMode` (98 lines): MVP single-subtask decomposition |
| Swarm management | Via `TeamCreateTool`/`TeamDeleteTool`/`SendMessageTool` | `SwarmManager` (186 lines): spawnTeammate, sendMessage, stopTeammate |
| 内置代理配置 | General-purpose agent + extensible built-in | 4 built-in profiles: explore, plan, review, verify |

---

## 4. 测试与性能

### 测试覆盖

| 方面 | Claude Code | AttaSeek |
|---|---|---|
| 测试文件 | **无测试文件** (源码快照中) | 20+ files in `test/unit/agent/`, `test/agent/scenarios/`, `test/agent/integration/` |
| 测试基础设施 | Embedded VCR + `NODE_ENV === 'test'` guards | Full vitest config + mock provider + scenario runner |
| Mock infrastructure | TestingPermissionTool + rate-limit mocking | `MockModelProvider` (FIFO queue) + stream builders + JSON scenarios |
| VCR system | Full `services/vcr.ts` (406 lines) with path normalization | `llm/vcr.ts` with SHA-256 request hashing + JSONL |
| Scenario tests | Not observed | 12 scenarios: plain-text, single/multi-tool, permission-deny, multi-turn, interrupt, error recovery, edge cases |
| Integration tests | Not observed | Live task engine tests, todo tools, plan tools |
| **未测试的** | Cannot determine (no test files) | MCPBridge, MCPTransport, MCPOAuth, StreamingToolExecutor, TokenBudgetTracker, RecoveryRouter, CompactionPipeline, FeatureFlags, CostTracker |

### 性能监控

| 方面 | Claude Code | AttaSeek |
|---|---|---|
| 遥测框架 | OpenTelemetry (metrics, logs, traces) + BigQuery + Perfetto | Custom `QueryProfiler` + `TelemetryService` (JSONL) |
| Exporters | OTLP/gRPC, OTLP/http, Prometheus, BigQuery custom | No external exporters (file-only JSONL) |
| Checkpoints | `queryCheckpoint()` + headlessProfiler | `queryCheckpoint()` + per-stage timing with `SLOW` flag (>100ms) |
| TTFT (Time to First Token) | Via Perfetto traces | `first_chunk_received` checkpoint |
| Sampling | Not sampled (always-on for Ant) | Configurable sample rate (default 1%, env var) |
| Cost tracking | OTEL counters + recursive advisor tracking | `CostTracker` singleton + `maxBudgetUsd` param |
| Tracing format | Chrome Trace Event (Perfetto) + OTEL spans | No distributed tracing |

### 资源管理

| 方面 | Claude Code | AttaSeek |
|---|---|---|
| Connection pool | Global keep-alive pool + disable-keepalive on ECONNRESET | Basic (via `node-fetch`) |
| Preconnect | API preconnect HEAD request overlapped with startup | None |
| Lazy loading | ~1.2MB OTEL exporters + ~929KB AWS SDK + ~1.5MB undici | Lazy dynamic imports for hook executors |
| Memory limits | Bounded caches: 10 tracked sources, 50K Perfetto events, 30min span TTL | Max 500 tasks, LRU cache 50 entries, 30min TTL |
| MCP connections | Single transport per server, managed via state machine | Single transport per server, 3-crash restart limit |
| Graceful shutdown | `setupGracefulShutdown()` + OTEL flush + txn rollback | MCP shutdown via events + event bus flush |

---

## 5. 高层结论

### AttaSeek 做得好的地方:

1. **测试基础设施** — AS 有实际的测试文件、mock providers、scenario runner 和集成测试。CC 参考快照没有测试文件。

2. **压缩形式化** — 5-stage pipeline 更加明确地结构化和文档化，有清晰的阶段边界和 hysteresis tracking。

3. **错误恢复架构** — `recovery-router.ts` (5 levels, per-level limits, circuit breaker) 比 CC 的 feature-gated 内联 `catch` 块更干净、更可测试。

4. **DI 模式** — `QueryLoopDeps` (20+ injectable functions) 在整个系统中一致使用。CC 只注入 4 个 deps (`callModel`, `microcompact`, `autocompact`, `uuid`)。

5. **代码组织** — AS 的扁平模块结构更容易定位特定组件。CC 的大型单文件 (`query.ts` 1729行, `QueryEngine.ts` 1295行) 更难导航。

6. **LLM 配置** — 7层级联配置比 CC 的基于 settings 的方法更复杂。

### AttaSeek 存在差距的地方:

1. **工具复杂度** — CC 的 BashTool (14 files, 12K lines) 有 AST 级别的安全解析。AS 的 Bash 实现基本得多。

2. **协调器模式** — CC 的 coordinator mode 有成熟的 prompt-driven leader/worker 模式，带 swarm/tmux 集成。AS 的版本是 MVP (98 lines, single subtask)。

3. **MCP 成熟度** — CC 的 MCP 实现 (22 files, ~6K+ lines) 处理更多传输类型、OAuth 流程和资源管理。AS 有 SSE transport stub 和更简单的 OAuth。

4. **性能基础设施** — CC 使用 OpenTelemetry with multiple exporters, Perfetto for tracing, 和 lazy loading of heavy deps。AS 有更简单的 custom profiler 和 file-based telemetry。

5. **无实现** — AS 的 `EditorBridge` 接口 (18 methods) 没有实现。SSE transport 被 stubbed。Image attachment handling 被 deferred。

6. **代码量差距** — CC 参考实现有显著更多的生产代码，特别是在 tools (40K+ vs 3K lines) 和 MCP (6K+ vs 1K lines) 方面。

7. **连接管理** — 缺少 API preconnect、keep-alive pool management 和 lazy-loaded exporters。
