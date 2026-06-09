# Agent V3 — Claude Code 深度对齐 架构设计

**日期：** 2026-06-07
**基于分析：** 2026-06-07 agent 代码级对比简报 + `docs/design/2026-06-07-agent-alignment.md` + `docs/design/2026-06-06-agent-v2.2-claude-alignment-architecture.md`

---

## 设计原则

1. **AgentProfile 系统保留** — 声明式 domain-specific 配置是 AttaSeek 的结构性优势，不可丢弃
2. **多后端 LLM 保留** — `ModelProvider` 接口 + slot 系统 (main/subagent/compact) 是差异化能力
3. **其余尽量对齐** — 循环架构、压缩管线、工具执行、错误恢复、上下文构建、消息类型全面与 Claude Code 对齐
4. **编程提示词锚定 Claude Code** — 对齐后 coding profile 的 system prompt 与 Claude Code 保持等效，确保编程能力一致
5. **DI 化** — 所有外部依赖通过注入，使内层循环可独立测试

---

## 一、组件结构

### 1.1 顶层重组

```
src/main/agent/
├── index.ts                                  [修改] 精简导出，移除过度单例
├── AgentRuntime.ts                           [修改] 委托给 QueryEngine
├── AgentEventBus.ts                          [保留] 不做变更
│
├── orchestrator/                             [重构]
│   ├── QueryEngine.ts                        [新建] 外层会话管理器（对齐 CC QueryEngine）
│   ├── query-loop.ts                         [新建] 内层纯 AsyncGenerator 循环（对齐 CC queryLoop）
│   ├── QueryDeps.ts                          [新建] DI 容器（对齐 CC QueryDeps）
│   ├── QueryConfig.ts                        [新建] 不可变 per-turn 配置（对齐 CC buildQueryConfig）
│   ├── AgentOrchestrator.ts                  [删除] 功能被 QueryEngine + query-loop 取代
│   ├── AgentState.ts                         [重构] 扩展状态字段 + Continue 转换追踪
│   └── transitions.ts                        [新建] Terminal / Continue 判别联合类型
│
├── compact/                                  [重构]
│   ├── compact-prompt.ts                     [保留] 压缩 LLM prompt
│   ├── ContextCompactor.ts                   [重构] 5 级压缩管线编排
│   ├── SnipCompactor.ts                      [新建] Snip 压缩（移除中间保留首尾）
│   ├── Microcompactor.ts                     [新建] 时间微压缩 + 缓存微压缩
│   ├── CollapseManager.ts                    [新建] 上下文坍塌（非破坏性 commit log 回放）
│   ├── CollapseStore.ts                      [新建] 坍塌 commit 持久化
│   ├── AutoCompactor.ts                      [重构] 拆出自 ContextCompactor，加滞后追踪
│   ├── ReactiveCompactor.ts                  [重构] 拆出自 ContextCompactor，加 media size 触发
│   └── token-counter.ts                      [保留]
│
├── context/                                  [新建]
│   ├── ContextAssembler.ts                   [新建] 统一上下文组装器（替代 ContextBuilder）
│   ├── GitContext.ts                         [新建] Git 状态采集（memoized）
│   ├── AttachmentResolver.ts                 [新建] 附件解析 + 去重
│   ├── MemoryPrefetcher.ts                   [新建] 异步记忆预热
│   ├── SystemPromptParts.ts                  [新建] 多源系统提示词组件
│   └── ContextBuilder.ts                     [删除] 功能迁移到 ContextAssembler
│
├── tools/                                    [重构]
│   ├── StreamingToolExecutor.ts              [重构] 完整状态机 + progress + discard
│   ├── ToolOrchestrator.ts                   [重构] 动态 concurrency-safe + context modifier
│   ├── ToolProgressBus.ts                    [新建] 工具执行进度推送
│   ├── ToolContextModifier.ts                [新建] 工具间上下文传递链路
│   └── implementations/                      [保留] 逐工具实现
│
├── llm/
│   ├── ModelProvider.ts                      [保留] 多后端接口
│   ├── AnthropicProvider.ts                  [修改] 增加 prompt caching + beta header
│   ├── OpenAICompatibleProvider.ts           [保留]
│   ├── ModelProviderRegistry.ts              [修改] 增加 fallback chain
│   ├── ProviderFactory.ts                    [保留]
│   ├── ModelResolver.ts                      [保留] Slot 系统
│   ├── withRetry.ts                          [重构] 10 次重试 + 529 区分 + fallback model
│   ├── ProviderFallback.ts                   [新建] Provider 级 fallback 链
│   ├── PromptCache.ts                        [新建] Prompt cache 断点管理
│   └── ... (其余 llm 文件保留)               [保留]
│
├── hooks/                                    [保留] 当前实现
├── coordinator/                              [保留]
├── subagent/                                 [保留]
├── mcp/                                      [保留]
├── memory/                                   [保留]
├── skills/                                   [保留]
├── profile/                                  [保留] AgentProfile 不动
├── prompt/                                   [保留] PromptTemplate 不动
├── cache/                                    [保留]
│
├── features/                                 [新建]
│   └── FeatureFlags.ts                       [新建] 实验功能开关（编译级 + 运行时）
│
└── messages/                                 [新建]
    ├── MessageTypes.ts                       [新建] 扩展消息类型系统
    ├── TombstoneMessage.ts                   [新建] 压缩后消息占位
    ├── ToolUseSummaryMessage.ts              [新建] 工具使用摘要
    └── ProgressMessage.ts                    [新建] 工具执行进度消息
```

### 1.2 模块职责表

| 模块 | 状态 | 职责 |
|------|------|------|
| `QueryEngine` | 新建 | 会话生命周期、消息持久化、权限管理、用户输入处理。一个会话一个实例。 |
| `query-loop` | 新建 | 纯 AsyncGenerator。不可变 params → 压缩链 → LLM 调用 → 工具执行 → hooks。零副作用。 |
| `QueryDeps` | 新建 | DI 容器：callModel, microcompact, autocompact, snipCompact, collapseContext, memoryPrefetch |
| `QueryConfig` | 新建 | Per-turn 不可变配置快照：feature flags, env, session metadata |
| `AgentState` | 重构 | 扩展 mutable 跨迭代状态 + `Continue` 枚举（8 种转换原因） |
| `transitions` | 新建 | `Terminal` + `Continue` 判别联合类型 |
| `ContextAssembler` | 新建 | 统一上下文组装：systemPrompt + userContext + systemContext + memoryContext |
| `GitContext` | 新建 | Memoized git 状态采集（branch, status, log, user） |
| `AttachmentResolver` | 新建 | 文件附件解析、去重、token 预算控制 |
| `MemoryPrefetcher` | 新建 | 异步记忆预热（不阻塞 LLM 调用），含 `using` dispose 语义 |
| `SnipCompactor` | 新建 | Snip 压缩 — 移除对话中间部分，保留开头和结尾。创建压缩边界消息 |
| `Microcompactor` | 新建 | 时间微压缩（基于时间戳移除旧 tool_call 对）+ 缓存编辑微压缩 |
| `CollapseManager` | 新建 | 非破坏性上下文坍塌 — commit log 回放模式，跨 turn 持久化 |
| `AutoCompactor` | 重构 | LLM 摘要压缩，增加滞后追踪防重复压缩，使用 compact slot 模型 |
| `ReactiveCompactor` | 重构 | API 错误触发压缩，增加 media size error 触发，更激进裁剪 |
| `StreamingToolExecutor` | 重构 | 完整状态机 (queued→executing→completed→yielded)，progress 实时产出，sibling abort，discard |
| `ToolOrchestrator` | 重构 | 运行时 `isConcurrencySafe(parsedInput)`，contextModifier 链，并发上限 env 可控 |
| `ToolProgressBus` | 新建 | 工具执行进度事件总线，实时推送到 UI |
| `ToolContextModifier` | 新建 | 工具间上下文传递：每个工具完成后可修改 ToolUseContext |
| `AnthropicProvider` | 修改 | Prompt cache 断点注入 (`cache_control: {type: 'ephemeral'}`)，beta header 管理 |
| `withRetry` | 重构 | 10 次最大重试，529 区分前后台，fallback model 自动切换 |
| `ProviderFallback` | 新建 | Provider 级回退：主 provider 不可用 → 自动切换下一个可用 provider |
| `PromptCache` | 新建 | Cache key 生成、命中判定、静态前缀 + 动态边界标记 |
| `FeatureFlags` | 新建 | 实验功能开关系统（开发期编译 + 运行时 toggle） |
| `MessageTypes` | 新建 | 扩展消息判别联合：Tombstone, ToolUseSummary, Progress |
| `AgentOrchestrator` | 删除 | 被 QueryEngine + query-loop 取代 |
| `ContextBuilder` | 删除 | 被 ContextAssembler 取代 |

---

## 二、数据流

### 2.1 完整请求管线

```
User Input (Renderer)
  │
  ▼
AgentRuntime.createTask()
  │
  ▼
QueryEngine.submitMessage(userContent)
  │
  ├─ 1. processUserInput(userContent)
  │    ├─ 解析 slash commands
  │    ├─ 解析 @mentions / attachments
  │    └─ 构建 userMessage
  │
  ├─ 2. 触发 MemoryPrefetcher (异步预热，不阻塞)
  │
  ├─ 3. 启动 queryLoop (AsyncGenerator)
  │    │
  │    ├─▶ while(true):
  │    │   │
  │    │   ├─ 3a. 压缩管线 (按序执行)
  │    │   │   ├─ SnipCompactor.snipIfNeeded(messages)
  │    │   │   ├─ Microcompactor.apply(messages)
  │    │   │   ├─ CollapseManager.applyIfNeeded(messages)
  │    │   │   └─ AutoCompactor.compactIfNeeded(messages, tracking)
  │    │   │
  │    │   ├─ 3b. 构建 query params
  │    │   │   ├─ ContextAssembler.buildUserContext()
  │    │   │   ├─ ContextAssembler.buildSystemContext()
  │    │   │   └─ asSystemPrompt(systemPromptParts)
  │    │   │
  │    │   ├─ 3c. LLM 调用
  │    │   │   └─ deps.callModel(params, onChunk)
  │    │   │       ├─ text_delta → yield AgentMessageChunk
  │    │   │       ├─ tool_use_start/delta/stop → StreamingToolExecutor
  │    │   │       └─ message_stop → 完成流式收集
  │    │   │
  │    │   ├─ 3d. 工具执行
  │    │   │   ├─ runTools(toolUseBlocks)
  │    │   │   │   ├─ partitionToolCalls(blocks, context)
  │    │   │   │   ├─ concurrent batch: runToolsConcurrently()
  │    │   │   │   └─ serial batch: runToolsSerially()
  │    │   │   └─ 各工具产出的 contextModifier 链式应用
  │    │   │
  │    │   ├─ 3e. Post-sampling hooks
  │    │   │   └─ HookManager.execute(ctx)
  │    │   │
  │    │   ├─ 3f. Stop hooks
  │    │   │   └─ HookPipeline.execute('Stop', ctx)
  │    │   │
  │    │   └─ 3g. 判断是否继续
  │    │       ├─ 有 tool_use → state = nextState, continue
  │    │       ├─ end_turn  → return 'completed'
  │    │       └─ error     → recoverFromError() → continue 或 return Terminal
  │    │
  │    └─ return Terminal
  │
  ├─ 4. Consumer memory prefetch result
  │
  ├─ 5. Finalize
  │    ├─ artifact creation
  │    ├─ memory persistence
  │    ├─ audit logging
  │    └─ title generation
  │
  └─ 6. Return terminal reason
```

### 2.2 关键状态位置

| 状态 | 位置 | 作用域 |
|------|------|--------|
| `mutableMessages` | `QueryEngine` 实例字段 | 会话级（跨 turn 持久化） |
| `fileStateCache` | `QueryEngine` 实例字段 | 会话级 |
| `totalUsage` | `QueryEngine` 实例字段 | 会话级（累计 token 和成本） |
| `permissionDenials` | `QueryEngine` 实例字段 | 会话级 |
| `autoCompactTracking` | `queryLoop` 内 `State` | 循环级（每 turn 重置） |
| `recoveryAttempts` | `queryLoop` 内 `State` | 循环级 |
| `turnCount` | `queryLoop` 内 `State` | 循环级 |
| `maxOutputTokensRecoveryCount` | `queryLoop` 内 `State` | 循环级 |
| `toolUseContext` | `queryLoop` 内 `State` | 循环级（工具间共享上下文） |
| `taskBudgetRemaining` | `queryLoop` 局部变量 | 循环级（跨 compact 边界追踪） |

---

## 三、关键接口定义

### 3.1 QueryEngine

```typescript
// src/main/agent/orchestrator/QueryEngine.ts

interface QueryEngineConfig {
  cwd: string
  tools: ToolManifest[]
  commands: Command[]
  mcpClients: MCPServerConnection[]
  agents: AgentDefinition[]
  canUseTool: CanUseToolFn
  getAppState: () => AppState
  setAppState: (f: (prev: AppState) => AppState) => void
  initialMessages?: Message[]
  readFileCache: FileStateCache
  customSystemPrompt?: string
  appendSystemPrompt?: string
  userSpecifiedModel?: string
  fallbackModel?: string
  thinkingConfig?: ThinkingConfig
  maxTurns?: number
  maxBudgetUsd?: number
  taskBudget?: { total: number }
  jsonSchema?: Record<string, unknown>
  abortController?: AbortController
  includePartialMessages?: boolean
  replayUserMessages?: boolean
  snipReplay?: SnipReplayHandler
}

class QueryEngine {
  private config: QueryEngineConfig
  private mutableMessages: Message[]
  private abortController: AbortController
  private permissionDenials: SDKPermissionDenial[]
  private totalUsage: NonNullableUsage
  private readFileState: FileStateCache
  private discoveredSkillNames: Set<string>
  private loadedNestedMemoryPaths: Set<string>

  constructor(config: QueryEngineConfig)

  // 主入口 —— 每个 turn 调用一次
  async *submitMessage(
    userContent: UserContent,
    options?: SubmitOptions
  ): AsyncGenerator<SessionEvent, TerminalReason, void>

  // 中断当前执行
  interrupt(): void

  // 获取会话级状态
  getMessages(): Message[]
  getTotalUsage(): NonNullableUsage
  getPermissionDenials(): SDKPermissionDenial[]
}
```

### 3.2 query-loop 内层循环

```typescript
// src/main/agent/orchestrator/query-loop.ts

// 不可变 per-turn 参数
interface QueryParams {
  messages: Message[]
  systemPrompt: SystemPrompt
  userContext: Record<string, string>
  systemContext: Record<string, string>
  canUseTool: CanUseToolFn
  toolUseContext: ToolUseContext
  fallbackModel?: string
  querySource: QuerySource
  maxOutputTokensOverride?: number
  maxTurns?: number
  skipCacheWrite?: boolean
  taskBudget?: { total: number }
  deps?: QueryDeps
}

// Mutable 跨迭代状态
interface QueryLoopState {
  messages: Message[]
  toolUseContext: ToolUseContext
  autoCompactTracking: AutoCompactTrackingState | undefined
  maxOutputTokensRecoveryCount: number
  hasAttemptedReactiveCompact: boolean
  maxOutputTokensOverride: number | undefined
  pendingToolUseSummary: Promise<ToolUseSummaryMessage | null> | undefined
  stopHookActive: boolean | undefined
  turnCount: number
  transition: Continue | undefined  // 为什么上一轮继续了
}

// DI 容器
interface QueryDeps {
  callModel: (params: CallModelParams, onChunk: ChunkCallback) => Promise<CallModelResult>
  microcompact: (messages: Message[], context: ToolUseContext, source: QuerySource) => Promise<MicrocompactResult>
  autocompact: (messages: Message[], context: ToolUseContext) => Promise<CompactResult>
  uuid: () => string
}

// 转换类型
type Terminal =
  | 'completed'
  | 'max_turns'
  | 'aborted'
  | 'denied'
  | 'model_error'
  | 'blocking_limit'
  | 'no_provider'
  | 'token_budget_exhausted'

type Continue =
  | 'tool_use_found'
  | 'max_output_tokens_recovery'
  | 'reactive_compact_recovery'
  | 'fallback_model_recovery'
  | 'retry_recovery'
  | 'wait_retry_recovery'
  | 'context_collapse_recovery'
  | 'token_budget_continuation'

// 主循环 —— 纯 AsyncGenerator
async function* queryLoop(
  params: QueryParams,
  consumedCommandUuids: string[],
): AsyncGenerator<
  StreamEvent | RequestStartEvent | Message | TombstoneMessage | ToolUseSummaryMessage,
  Terminal
>
```

### 3.3 压缩管线

```typescript
// src/main/agent/compact/ContextCompactor.ts

interface CompactionPipeline {
  // 步骤 1: Snip —— 移除中间保留首尾
  snipIfNeeded(messages: Message[]): SnipResult
  // 步骤 2: 微压缩 —— tool result 替换 + 时间裁剪
  applyMicrocompact(messages: Message[], context: ToolUseContext): Promise<MicrocompactResult>
  // 步骤 3: 上下文坍塌 —— commit log 回放
  applyCollapsesIfNeeded(messages: Message[], context: ToolUseContext): CollapseResult
  // 步骤 4: 自动压缩 —— LLM 摘要（滞后追踪）
  applyAutocompact(messages: Message[], tracking: AutoCompactTracking): Promise<CompactResult>
  // 步骤 5: 响应式压缩 —— API 错误触发
  applyReactiveCompact(messages: Message[], error: unknown): Promise<CompactResult>
}

// Snip —— 在压缩边界标记处裁剪
interface SnipResult {
  messages: Message[]
  tokensFreed: number
  boundaryMessage?: TombstoneMessage
}

// 微压缩 —— 时间基准裁剪 + 缓存编辑
interface MicrocompactResult {
  messages: Message[]
  compactionInfo?: {
    // 非零时表示已裁剪，可用于滞后追踪
    compactedCount: number
    // 缓存编辑信息（feature gated）
    pendingCacheEdits?: CacheEdit[]
  }
}

// 上下文坍塌 —— 非破坏性
interface CollapseResult {
  messages: Message[]
  newCollapses?: CollapseCommit[]  // 新产生的坍塌 commit（持久化用）
}

// 自动压缩 —— LLM 驱动
interface CompactResult {
  messages: Message[]
  summary: string
  tokensFreed: number
  compressedCount: number
}
```

### 3.4 工具执行

```typescript
// src/main/agent/tools/ToolOrchestrator.ts

interface ToolExecResult {
  toolCallId: string
  toolUse: ToolUseBlock
  success: boolean
  output: unknown
  error?: { code: string; message: string; recoverable: boolean }
  permissionDecision?: 'allow' | 'deny'
  // 新增: 上下文修改器（tools 可影响后续 tool 的行为）
  contextModifier?: (ctx: ToolUseContext) => ToolUseContext
}

interface ToolOrchestrationResult {
  results: ToolExecResult[]
  denied: boolean
  // 新增: 工具执行进度流
  progressEvents: ToolProgressEvent[]
}

// 动态 concurrency-safe 判断（运行时解析 tool input）
function partitionToolCalls(
  toolUseBlocks: ToolUseBlock[],
  context: ToolUseContext,
): Batch[]
// Batch = { isConcurrencySafe: boolean; blocks: ToolUseBlock[] }

// 新增: 运行时进度事件
interface ToolProgressEvent {
  toolCallId: string
  type: 'started' | 'progress' | 'blocked_on_user' | 'completed' | 'failed'
  data?: ToolProgressData
  timestamp: number
}

// 新增: 工具间上下文
interface ToolUseContext {
  // ... 现有字段
  setInProgressToolUseIDs: (fn: (prev: Set<string>) => Set<string>) => void
  abortController: AbortController
  // 同级进程控制
  siblingAbortController: AbortController
  // 内容替换状态
  contentReplacementState?: ContentReplacementState
  // 查询追踪
  queryTracking?: QueryTracking
}
```

### 3.5 Streaming Tool Executor

```typescript
// src/main/agent/tools/StreamingToolExecutor.ts

type ToolSlotStatus = 'queued' | 'executing' | 'completed' | 'yielded'

interface ToolSlot {
  id: string
  block: ToolUseBlock
  status: ToolSlotStatus
  isConcurrencySafe: boolean
  // 新增: 进度消息
  pendingProgress: ToolProgressEvent[]
  // 新增: 上下文修改器
  contextModifiers?: Array<(ctx: ToolUseContext) => ToolUseContext>
  // 执行结果
  result?: ToolExecResult
}

class StreamingToolExecutor {
  // 现有方法保留，增强:
  addTool(block: ToolUseBlock): void
  completeTool(block: ToolUseBlock): void

  // 新增:
  discard(): void                    // streaming fallback 时丢弃进行中工具
  getProgress(): ToolProgressEvent[] // 获取实时进度（非阻塞）
  onProgress(cb: (event: ToolProgressEvent) => void): void  // 进度回调

  // 保留:
  getCompletedResults(): ToolExecResult[]
  getRemainingResults(): Promise<ToolExecResult[]>
  cancelAll(): void
  get allResults(): ToolExecResult[]
}
```

### 3.6 错误恢复

```typescript
// src/main/agent/llm/withRetry.ts

interface RetryOptions {
  maxRetries: number                 // 10 (曾 3)
  baseDelayMs: number                // 500 (曾 1000)
  maxDelayMs: number                 // 60_000 (曾 30_000)
  jitter: boolean
  // 新增: 529 重试策略
  isForegroundSource?: boolean       // 前台 source 才重试 529
  // 新增: fallback model
  fallbackModel?: string
  onFallback?: (model: string, reason: string) => void
  // 新增: 重试分类
  shouldRetry: (err: unknown, attempt: number, maxRetries: number) => boolean
  onRetry: (err: unknown, attempt: number, delayMs: number, reason: RetryReason) => void
}

type RetryReason =
  | 'rate_limit'       // 429
  | 'overloaded'       // 529
  | 'server_error'     // 5xx
  | 'network_error'    // DNS/TCP
  | 'auth_expired'     // OAuth/credential refresh
  | 'unknown'

// Error recovery in query-loop:
// L1: max_output_tokens 恢复（查询级，非 withRetry 级）
//     → 8K→16K→32K→64K，最高 3 次升级
// L2: Transparent retry（withRetry 层）
//     → 10 次，指数退避
// L3: Fallback model（withRetry 层）
//     → sonnet 不可用 → 自动切 haiku 或用户指定的 fallback
// L4: Reactive compact（query-loop 层）
//     → prompt_too_long / media_size_error → 激进裁剪
// L5: Context collapse（query-loop 层）
//     → 保留最后 2 turns
// L6: Fail
```

### 3.7 上下文组装

```typescript
// src/main/agent/context/ContextAssembler.ts

interface ContextAssemblerConfig {
  topK: number                       // Tool selection Top-K
  maxRounds: number                  // 最大历史轮次
  tokenBudgets: TokenBudgets         // 各分区预算
}

interface AssembledContext {
  systemPrompt: string
  messages: Message[]
  tools: ToolDef[]
  // 新增: 分层上下文
  userContext: Record<string, string>    // CLAUDE.md, memory, skills
  systemContext: Record<string, string>  // git status, OS, date
  attachments: AttachmentInfo[]          // 文件附件
  tokenUsage: SectionTokenUsage          // 各分区详细 token 数
}

interface SectionTokenUsage {
  systemPromptPrefix: number   // 静态前缀（可缓存）
  systemPromptDynamic: number  // 动态后缀
  tools: number
  userContext: number
  systemContext: number
  messages: number
  attachments: number
  total: number
  budgetLimit: number
}

// 新增: Git context（memoized per session）
interface GitState {
  branch: string
  mainBranch: string
  status: string
  recentCommits: string
  userName: string
  isGit: boolean
}

// 新增: Memory prefetch（异步，含 `using` dispose）
interface MemoryPrefetch {
  settledAt: Promise<void>       // 预热完成时 resolve
  messages: AttachmentMessage[]  // 预热获取的记忆消息
  [Symbol.dispose](): void       // Dispose 语义 — 所有退出路径自动清理
}
```

### 3.8 消息类型扩展

```typescript
// src/main/agent/messages/MessageTypes.ts

// 扩展消息判别联合（补充现有 SessionEvent 类型体系）

interface TombstoneMessage {
  type: 'tombstone'
  originalMessageIds: string[]
  summary: string            // 为何被移除
  tokenCount: number         // 原始 token 数
}

interface ToolUseSummaryMessage {
  type: 'tool_use_summary'
  turnIndex: number
  toolUses: Array<{
    toolName: string
    inputSummary: string    // 输入摘要（≤100 chars）
    outputSummary: string   // 输出摘要（≤200 chars）
    success: boolean
  }>
}

interface ProgressMessage {
  type: 'progress'
  toolCallId: string
  toolName: string
  stage: 'started' | 'running' | 'blocked' | 'finishing'
  message: string
  percentComplete?: number
}

// StreamEvent 扩展（补充现有 LLMChunk）
interface StreamEvent {
  type:
    | 'text_delta'
    | 'tool_use_start'
    | 'tool_use_delta'
    | 'tool_use_stop'
    | 'content_block_start'
    | 'content_block_delta'
    | 'content_block_stop'
    | 'message_stop'
    | 'stream_error'           // 新增: 流错误
    | 'stream_request_start'   // 新增: 请求开始
    | 'compact_boundary'       // 新增: 压缩边界
}
```

### 3.9 Prompt Caching

```typescript
// src/main/agent/llm/PromptCache.ts

interface PromptCacheConfig {
  enabled: boolean
  staticPrefix: string          // 系统提示词静态部分
  toolDefinitions: ToolDef[]    // 工具定义
  modelId: string               // 模型标识
  profileId: string             // Profile 标识
}

interface CacheBreakpoint {
  type: 'ephemeral'
  position: 'system_prefix_end' | 'tools_end'
}

// Cache key = SHA256(staticPrefix + sortedToolNames + modelId)
// 子 Agent fork 时复用父 Agent 的 cache key
// 命中时 Anthropic API 返回 cache_read_input_tokens
// 失效场景:
//   1. 工具集变更（新增/移除工具）
//   2. 模型切换
//   3. Profile 切换
//   4. BrowserWindow 关闭
```

---

## 四、技术决策

| # | 决策 | 选择 | 理由 | 替代方案 |
|---|------|------|------|---------|
| 1 | **双层循环架构** | QueryEngine (外层) + queryLoop (内层) | CC 成熟模式。外层管理会话状态，内层是纯 AsyncGenerator，DI 注入依赖，可独立测试 | 保持单层 AgentOrchestrator（紧耦合，测试依赖 mock 单例） |
| 2 | **DI 方式** | `QueryDeps` 接口 + 默认 `productionDeps()` | 简单接口，无需 IoC 容器。测试时传入 mock deps，生产时用默认实现 | 完整 IoC 容器（过度工程化，JS/TS 不需要） |
| 3 | **压缩排序** | Snip → Microcompact → Collapse → Autocompact（LLM 前）；Reactive（LLM 后） | 轻量压缩先做减少 token，昂贵的 LLM 摘要后做。Collapse 在 Autocompact 前做可保留更细粒度上下文 | 全在 LLM 前一次性执行（某些压缩步骤做无用功） |
| 4 | **concurrency-safe 判断** | 运行时 `tool.isConcurrencySafe(parsedInput)` | CC 模式。同一工具不同输入可能需要不同策略（如 Bash: `ls` 可并发，`npm install` 不可） | 静态 manifest 标记（当前方案，过于粗糙） |
| 5 | **Sibling abort** | Bash 错误 → `siblingAbortController.abort()` | 阻止同级并发 Bash 浪费资源，但不 abort parent turn | 不 abort sibling（资源浪费）；abort parent（一个工具失败全盘皆输） |
| 6 | **Retry 上限** | 10（曾 3） | 对齐 CC。生产环境 API 容量波动频繁，3 次不足 | 动态上限（过于复杂）；保持 3（不够） |
| 7 | **529 处理** | 区分 foreground/background source，foreground 才重试 | CC 模式。后台任务重试 529 是网关放大，反而加剧容量问题 | 统一重试（后台任务加重 API 容量危机） |
| 8 | **Fallback model** | Provider 级 fallback: main → fallback → 下一 provider | 生产必备。API 容量波动时自动降级，用户无感知 | 不 fallback（API 不可用时直接报错） |
| 9 | **Prompt caching** | System prompt 静态前缀 + 工具定义末尾断点 | CC 模式。跨子 Agent 复用时 cache hit 率最高 | 全量 cache（动态上下文每次不同，命中率低）；不 cache（成本高、延迟高） |
| 10 | **Feature flags** | 编译级 `feature()` 宏 + 运行时 `enableFeature()` | 实验功能可 DCE 移除，减小打包体积。运行时 toggle 用于开发/测试 | 无 flag 系统（所有功能全量打包）；纯运行时 flag（无 DCE，体积不减） |
| 11 | **Memory prefetch** | Async prefetch + `using` dispose | CC 模式。预热不阻塞 LLM 调用，dispose 保证清理 | 同步加载（阻塞首轮延迟）；无 dispose（资源泄漏） |
| 12 | **Git context** | `memoize()` per session | Git 状态在整个会话中不变，memo 避免重复 `git status` 开销 | 每轮实时查询（浪费时间，尤其是大型 repo） |
| 13 | **Message 类型扩展** | 新增 Tombstone, ToolUseSummary, Progress | 支撑压缩（占位消息）、UI 展示（摘要卡片）、工具实时反馈（进度条） | 继续用现有 15 种 SessionEvent（压缩后无法追溯、工具进度不可见） |
| 14 | **Context modifier chain** | 每个工具执行后可选返回 `contextModifier` | 工具执行可影响后续工具行为（如 `setConfig` 后 `bash` 有不同权限模式） | 工具完全独立（限制工具间的协调能力） |
| 15 | **Streaming discard** | `discard()` — streaming fallback 时丢弃进行中的工具结果 | Fallback model 的请求是独立的，前一个模型的工具结果不应污染 | 保留旧结果（混淆来源）；等待完成（增加延迟） |
| 16 | **Profile 系统保留** | AgentProfile 不动，仅调用方从 queryLoop 改为 QueryEngine | 声明式配置是 AttaSeek 差异化优势 | 移除 profile（退化到 CC 的分散配置） |
| 17 | **多后端保留** | ModelProvider 接口 + ModelResolver slot 系统不动 | 11 provider 模板 + slot fallback chain 是核心差异化能力 | 锁到单一 provider |
| 18 | **编程提示词对齐** | 对齐后 coding profile system prompt 与 Claude Code 等效 | 用户要求"编程功能上能力一致" | 自创提示词（能力不一致） |

---

## 五、IPC 契约（不变部分）

本次重构**不新增 IPC channel**，仅改变主进程内部架构。现有 IPC 通道：

```
agent:create-task       renderer→main  (不变)
agent:cancel-task       renderer→main  (不变)
agent:get-task          renderer→main  (不变)
agent:list-events       renderer→main  (不变)
agent:event             main→renderer  (不变 — AgentEventBus 推送)
```

工具执行进度（新增的 ProgressMessage）通过 `agent:event` 通道复用 `SessionEvent` 类型传递，不新增 IPC channel。

---

## 六、与现有代码的关系

| 现有文件 | 处理方式 | 说明 |
|---------|---------|------|
| `AgentOrchestrator.ts` | **删除** | 功能拆分到 QueryEngine + query-loop |
| `ContextBuilder.ts` | **删除** | 功能迁移到 ContextAssembler + 子模块 |
| `AgentState.ts` | **重构** | 扩展状态字段 + Continue/Terminal 类型 |
| `ContextCompactor.ts` | **拆分** | 分解为 SnipCompactor + Microcompactor + CollapseManager + AutoCompactor + ReactiveCompactor |
| `ToolOrchestrator.ts` | **重构** | 动态 concurrency-safe + context modifier |
| `StreamingToolExecutor.ts` | **重构** | 完整状态机 + progress + discard |
| `withRetry.ts` | **重构** | 10 次重试 + 529 区分 + fallback model |
| `AnthropicProvider.ts` | **修改** | Prompt caching + beta header |
| `ModelProviderRegistry.ts` | **修改** | Fallback chain 支持 |
| `AgentRuntime.ts` | **修改** | 委托给 QueryEngine |
| `AgentEventBus.ts` | **保留** | 不变 |
| `ModelProvider.ts` | **保留** | 多后端接口不变 |
| `OpenAICompatibleProvider.ts` | **保留** | 不变 |
| `ProviderFactory.ts` | **保留** | 不变 |
| `ModelResolver.ts` | **保留** | Slot 系统不变 |
| `AgentProfile.ts` | **保留** | Profile 系统不动 |
| `PromptTemplate.ts` | **保留** | 提示词模板系统不动（后续阶段单独重构） |
| `HookManager.ts` | **保留** | 不变 |
| `CoordinatorMode.ts` | **保留** | 不变 |
| `SubAgentManager.ts` | **保留** | 不变 |
| `MCP*.ts` (mcp/) | **保留** | 不变 |
| `MemoryExtractor.ts` | **保留** | 不变 |

---

## 七、实施路径提示

本设计不定义实施顺序，但建议的自然分组：

**Phase A — 基础架构重构（低风险，为后续铺路）**
1. `QueryDeps` + `QueryConfig` 新建（纯类型定义）
2. `AgentState` + `transitions` 重构（扩展类型）
3. `FeatureFlags` 新建（开关系统）
4. `MessageTypes` 扩展（Tombstone, ToolUseSummary, Progress）

**Phase B — 核心循环对齐（中风险，Agent 行为改变）**
5. `query-loop` 新建（内层纯循环）
6. `QueryEngine` 新建（外层会话管理）
7. `AgentRuntime` 修改（委托给 QueryEngine）
8. `AgentOrchestrator` 删除

**Phase C — 压缩管线升级（中风险）**
9. `SnipCompactor` + `Microcompactor` + `CollapseManager` 新建
10. `AutoCompactor` + `ReactiveCompactor` 重构
11. `ContextCompactor.ts` 删除

**Phase D — 工具执行升级（高风险，影响所有工具）**
12. `ToolOrchestrator` 重构（动态 concurrency-safe + context modifier）
13. `StreamingToolExecutor` 重构（状态机 + progress + discard）
14. `ToolProgressBus` + `ToolContextModifier` 新建

**Phase E — 上下文 + 错误恢复 + 缓存（中风险）**
15. `ContextAssembler` + `GitContext` + `AttachmentResolver` + `MemoryPrefetcher` 新建
16. `withRetry` + `ProviderFallback` 重构
17. `AnthropicProvider` + `PromptCache` 修改

**Phase F — 提示词重构（后续阶段，不在本设计范围）**
18. 基于 AgentProfile 重构 system prompt sections
19. Coding profile 提示词与 Claude Code 锚定
