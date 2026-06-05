# Agent Engine V2 架构设计

**日期：** 2026-06-05
**基于需求：** `docs/reqs/2026-06-05-agent-engine-v2.md`

---

## 组件结构

### 整体分层

```
src/main/agent/
├── orchestrator/                    [新建]
│   ├── AgentOrchestrator.ts         # 核心执行循环 — AsyncGenerator 驱动
│   ├── AgentState.ts                # 执行状态机 State + Terminal + Continue 类型
│   └── AgentOrchestrator.test.ts
│
├── profile/                         [新建]
│   ├── AgentProfile.ts              # AgentProfile 类型 + 校验 + 默认值回退
│   ├── profiles/                    # 预置场景 profiles
│   │   ├── coding-profile.ts       # 编码 Agent（对齐 Claude Code 编程能力）
│   │   ├── research-profile.ts     # 科研 Agent
│   │   ├── writing-profile.ts      # 文档编写 Agent
│   │   ├── operations-profile.ts   # 运营 Agent
│   │   ├── data-analysis-profile.ts
│   │   └── trading-profile.ts
│   └── AgentProfile.test.ts
│
├── prompt/                          [新建]
│   ├── PromptTemplate.ts            # 分节模板引擎（Section 组装 + 条件注入）
│   ├── sections/                    # 内置提示词段
│   │   ├── identity.ts             # Agent 身份描述（按 profile 动态选择）
│   │   ├── tools-usage.ts          # 工具使用规范
│   │   ├── memory-context.ts       # 记忆上下文注入段
│   │   ├── session-info.ts         # 会话信息段
│   │   ├── tone-and-style.ts       # 语调风格段
│   │   ├── output-format.ts        # 输出格式要求
│   │   └── error-recovery.ts       # 错误恢复指引
│   ├── compact-prompt.ts            # 上下文压缩专用提示词
│   └── extract-memories-prompt.ts   # 记忆提取专用提示词
│
├── compact/                         [新建]
│   ├── ContextCompactor.ts          # 触发检测 + 摘要生成 + 消息替换
│   ├── token-counter.ts             # Token 计数器（字符估算 + tiktoken 可选）
│   └── ContextCompactor.test.ts
│
├── memory/                          [重构]
│   ├── MemoryManager.ts             # 统一记忆管理（L1暂存 + L2 SQLite + 文件系统）
│   ├── MemoryExtractor.ts           # 对话后自动提取记忆 [新建]
│   ├── FileMemory.ts                # 文件系统记忆（CLAUDE.md + .attaseek/memory/）[新建]
│   ├── MemoryService.ts             # [删除] 合并到 MemoryManager
│   └── MemoryManager.test.ts
│
├── llm/                             [重构]
│   ├── LLMProvider.ts               # LLMProvider 接口 + LLMChunk/LLMChatResult 类型
│   ├── AnthropicProvider.ts         # Anthropic SDK 实现 [从 LLMProvider.ts 拆出]
│   ├── OpenAICompatibleProvider.ts  # OpenAI 兼容实现 [已有，移入]
│   ├── LLMProviderRegistry.ts       # Provider 注册表 [从 LLMProvider.ts 拆出]
│   ├── ProviderFactory.ts           # Provider 工厂 [已有，移入]
│   └── LLMProvider.test.ts
│
├── tools/                           [重构]
│   ├── ToolExecutor.ts              # 工具执行管道（权限→执行→审计）[已有，微调]
│   ├── ToolOrchestrator.ts          # 工具编排（并行/串行调度）[新建]
│   ├── ToolRegistry.ts              # 工具注册表 [已有]
│   ├── ToolRouter.ts                # 工具 Top-K 选择 [已有]
│   ├── ToolImplementations.ts       # 内置工具实现 [已有，按工具拆文件]
│   ├── implementations/             # [新建] 按工具拆分
│   │   ├── read-file.ts
│   │   ├── search-code.ts
│   │   ├── create-document.ts
│   │   ├── send-email.ts
│   │   └── git-commit.ts
│   ├── packs/                       # [已有]
│   └── ToolOrchestrator.test.ts
│
├── subagent/                        [新建]
│   ├── SubAgentManager.ts           # 子 Agent 创建、fork、resume、生命周期
│   ├── SubAgentContext.ts           # 子 Agent 上下文隔离与共享
│   ├── built-in/                    # 内置子 Agent 类型
│   │   ├── explore-agent.ts        # 搜索/探索 Agent
│   │   ├── plan-agent.ts           # 规划 Agent
│   │   ├── verify-agent.ts         # 验证 Agent
│   │   └── review-agent.ts         # 代码审查 Agent
│   └── SubAgentManager.test.ts
│
├── AgentRuntime.ts                  # [修改] 任务生命周期 → 委托给 AgentOrchestrator
├── AgentEventBus.ts                 # [保持不变] 事件 pub/sub
├── ContextBuilder.ts                # [重构] 保留上下文组装，提示词委托给 PromptTemplate
└── index.ts                         # [修改] barrel
```

### 模块职责（逐模块）

| 模块 | 新建/修改/删除 | 职责 |
|------|-------------|------|
| `orchestrator/AgentOrchestrator` | 新建 | 核心执行循环：组装上下文 → LLM调用 → 工具循环 → 压缩 → 记忆提取 → 收尾。以 AsyncGenerator 模式 yield 事件。接收 `AgentProfile` 参数化所有行为。 |
| `orchestrator/AgentState` | 新建 | 执行状态机类型定义：`State`（消息数组、工具上下文、压缩追踪、轮次计数）、`Terminal`（完成原因）、`Continue`（继续原因）。 |
| `profile/AgentProfile` | 新建 | Profile 类型定义 + 校验函数 + 默认值回退。声明式配置：提示词模板、工具列表、技能集、记忆策略、上下文预算、执行策略。 |
| `profile/profiles/*` | 新建 | 六个预置场景配置，每个文件导出 `AgentProfile` 对象。coding-profile 对齐 Claude Code 编程能力基准。 |
| `prompt/PromptTemplate` | 新建 | 分节模板引擎。`Section[]` → 按 priority 排序 → 检查 condition → 渲染 content（静态字符串或 `(ctx) => string` 动态函数）→ 拼接为最终 system prompt。 |
| `prompt/sections/*` | 新建 | 内置提示词段。每个段独立文件，包含静态/动态内容和条件注入逻辑。 |
| `prompt/compact-prompt` | 新建 | 压缩专用提示词：指导 LLM 生成结构化对话摘要（保留决策、代码变更、关键信息）。 |
| `prompt/extract-memories-prompt` | 新建 | 记忆提取提示词：指导 LLM 从对话中提取事实、偏好、决策、项目约定。 |
| `compact/ContextCompactor` | 新建 | 压缩检测（token 使用率 > 阈值）→ 打包早期消息 → 调用 LLM 生成摘要 → 替换消息历史。产出一个 `CompactResult`（摘要文本 + 节省 token 数 + 边界事件）。 |
| `compact/token-counter` | 新建 | Token 计数：优先使用 tiktoken（如可用），回退到字符估算 `ceil(len/4)`。支持按消息/工具定义/提示词段分别估算。 |
| `memory/MemoryManager` | 修改 | 合并原 `MemoryService`，新增 L0 文件系统记忆层 + 统一接口。三层记忆：L0（文件系统 CLAUDE.md + .attaseek/memory/）、L1（会话暂存 Map）、L2（SQLite 持久化）。 |
| `memory/MemoryExtractor` | 新建 | 对话后自动提取记忆：取最近一轮完整对话 → 调用 LLM（extract-memories prompt）提取事实/偏好/决策 → 去重（与已有记忆对比）→ 写入 L0 + L2。Fire-and-forget 模式。 |
| `memory/FileMemory` | 新建 | 文件系统记忆读写：扫描项目根目录 CLAUDE.md 和 `.attaseek/memory/*.md`，解析 frontmatter 元数据，支持增删改。 |
| `llm/LLMProvider` | 修改 | 从当前混合文件拆出纯接口 + 通用类型（`LLMProvider`、`LLMChunk`、`LLMChatParams`、`LLMChatResult`、`LLMError`）。 |
| `llm/AnthropicProvider` | 修改 | 从 `LLMProvider.ts` 拆出 Anthropic SDK 实现，独立文件。 |
| `llm/LLMProviderRegistry` | 修改 | 从 `LLMProvider.ts` 拆出注册表逻辑，独立文件。 |
| `tools/ToolOrchestrator` | 新建 | 工具调度：按类型分组（读/写/风险），独立工具并行执行（默认最大 16 并发），冲突工具串行执行。 |
| `tools/implementations/*` | 修改 | 从 `ToolImplementations.ts` 拆出每个工具一个文件。 |
| `subagent/SubAgentManager` | 新建 | 子 Agent 全生命周期：创建（分配 profile + 工具子集 + 上下文快照）、fork（从当前状态分叉）、resume（恢复暂停的 Agent）、cancel。 |
| `subagent/SubAgentContext` | 新建 | 子 Agent 上下文隔离：共享项目文件结构信息，不共享对话历史和工具调用记录。隔离工作空间（可选的 git worktree）。 |
| `subagent/built-in/*` | 新建 | 四个内置子 Agent 类型：Explore（搜索探索）、Plan（任务规划）、Verify（结果验证）、Review（代码审查）。 |
| `AgentRuntime` | 修改 | 简化：任务创建 → 委托 `AgentOrchestrator.submitMessage()`。保留任务生命周期（create/cancel/get/list）。 |
| `AgentEventBus` | 保持不变 | 事件 pub/sub + 历史存储。无需变化。 |
| `ContextBuilder` | 重构 | 保留消息历史组装 + 工具选择逻辑。系统提示词组装委托给 `PromptTemplate`。 |

---

## 数据流

### 核心执行循环（AgentOrchestrator）

```
User Input (Composer → IPC → AgentRuntime.createTask)
    │
    ▼
AgentRuntime.createTask(goal, sessionId, profileId?)
    │  选择 profile（默认 coding，或用户指定）
    │  创建 AgentTask { status: 'idle' }
    │  发射 UserMessage event
    ▼
AgentOrchestrator.submitMessage(task, profile)  ──→  AsyncGenerator<AgentEvent>
    │
    │  ┌──────────────────────────────────────────────┐
    │  │           每轮迭代 (while true)               │
    │  │                                              │
    │  │  1. ContextAssembly                          │
    │  │     PromptTemplate.render(profile, ctx)       │
    │  │       → sections/* 按条件动态组装             │
    │  │     ContextBuilder.build(goal, sessionId)     │
    │  │       → 消息历史 + 工具定义 + 记忆上下文      │
    │  │     token-counter.estimate(assembled)         │
    │  │                                              │
    │  │  2. ContextManagement                        │
    │  │     if ContextCompactor.shouldCompact(state): │
    │  │       compacted = ContextCompactor.compact()  │
    │  │       yield CompactBoundary event             │
    │  │       state.messages = compacted.messages     │
    │  │                                              │
    │  │  3. LLM Call                                 │
    │  │     provider.chatStream(params, onChunk)      │
    │  │       → yield AgentMessageChunk events        │
    │  │     catch → 升级恢复梯                        │
    │  │       L1: 透明重试                            │
    │  │       L2: 等待后重试 (rate_limit)             │
    │  │       L3: 上下文坍缩                          │
    │  │       L4: 反应式压缩                          │
    │  │       L5: failTask                            │
    │  │                                              │
    │  │  4. Tool Execution                           │
    │  │     if hasToolUse:                            │
    │  │       ToolOrchestrator.execute(toolUses)      │
    │  │         ├─ 分组: 独立工具 → 并行 (max 16)     │
    │  │         ├─ 分组: 冲突工具 → 串行              │
    │  │         └─ 每个工具:                          │
    │  │             查找清单 → 权限检查 →             │
    │  │             [用户确认(如 ask)] → 执行 → 审计  │
    │  │       yield ToolCallStarted/Finished events   │
    │  │     else:                                     │
    │  │       break  // end_turn → 任务完成           │
    │  │                                              │
    │  │  5. Post-Turn                                │
    │  │     if turnCount >= profile.maxTurns: break   │
    │  │     if aborted: cleanup → break               │
    │  │     turnCount++                               │
    │  └──────────────────────────────────────────────┘
    │
    ▼ (循环退出后)
    │
    ├─ 6. MemoryExtraction (fire-and-forget)
    │     if profile.autoExtractMemories:
    │       MemoryExtractor.extract(state.messages)
    │         → LLM 提取关键事实
    │         → 去重
    │         → 写入 MemoryManager (L0 + L2)
    │
    └─ 7. Finalize
          artifactService.create()     (如 enabled)
          memoryManager.store()        (task_state)
          auditService.log()
          autoTitle()                  (如 enabled)
          yield TaskCompleted event
```

### 子 Agent 数据流

```
主 Agent (AgentOrchestrator)
    │
    │  LLM 返回 tool_use: { name: 'agent', input: { type: 'review', goal: '...' } }
    │
    ▼
SubAgentManager.fork(parentTask, subProfile, goal)
    │
    │  1. 创建子 AgentTask
    │  2. 构建 SubAgentContext（共享: 项目结构 + 文件树 + 记忆；隔离: 对话历史）
    │  3. 创建子 AgentOrchestrator（独立的 State）
    │  4. 子 Agent 执行（独立工具循环）
    │
    │  yield 子 Agent 事件 → 转发到主 Agent 事件流 (带 agentId 标记)
    │
    ▼
子 Agent 完成 → 返回结果给主 Agent
    │
    │  结果作为 tool_result 注入主 Agent 的消息历史
    │  主 Agent 继续推理
```

### 记忆三层模型

```
┌──────────────────────────────────────┐
│  L0: 文件系统 (项目级, Git 可追踪)     │
│  CLAUDE.md  .attaseek/memory/*.md    │
│  启动时加载, 任务后写入               │
├──────────────────────────────────────┤
│  L1: 会话暂存 (内存, 易失)            │
│  Map<sessionId, Map<key, value>>     │
│  Agent 工具间的临时数据共享           │
├──────────────────────────────────────┤
│  L2: SQLite (持久, 结构化查询)        │
│  memory_entries 表                   │
│  LIKE 搜索召回, 自动提取写入          │
└──────────────────────────────────────┘

写入策略: L0 + L2 双写（文件同步 + DB 查询）
召回策略: L0 全量加载到上下文, L2 按 query 和 scope 过滤（limit 10）
```

---

## IPC Contract

IPC 通道保持现有设计不变。新增事件类型在 `SessionEvent.ts` 中扩展：

| Channel | 方向 | 请求类型 | 响应类型 | 新增/修改 |
|---------|------|---------|---------|----------|
| `agent:create-task` | renderer→main | `{ goal, sessionId, profileId?, modelConfigId? }` | `{ success, task?, error? }` | 修改：新增 `profileId` |
| `agent:cancel-task` | renderer→main | `{ taskId }` | `{ success }` | 不变 |
| `agent:event` | main→renderer | (push) | `SessionEvent` | 修改：新增 3 种事件类型 |

新增事件类型（`SessionEvent.type` 扩展）：

| 事件类型 | Payload | 触发时机 |
|---------|---------|---------|
| `CompactBoundary` | `{ summary: string, tokenSaved: number, compactedMessageCount: number }` | 上下文压缩完成 |
| `MemoryExtracted` | `{ entries: MemoryEntry[], count: number }` | 记忆自动提取完成 |
| `SubAgentStarted` | `{ agentId: string, agentType: string, goal: string }` | 子 Agent 启动 |
| `SubAgentCompleted` | `{ agentId: string, summary: string }` | 子 Agent 完成 |
| `RecoveryStep` | `{ level: number, action: string, detail: string }` | LLM 错误恢复升级梯每步 |

---

## Jotai Atoms

UI 部分不在本次设计范围，但引擎产出的新事件类型对应以下 atom 消费点（供后续实现参考）：

| Atom | 类型 | 作用范围 | 消费的事件 |
|------|------|---------|-----------|
| `sessionEventsAtom` | `SessionEvent[]` | 全局 | 所有事件（已有，扩展类型） |
| `agentTasksAtom` | `AgentTask[]` | 全局 | TaskCompleted, TaskFailed, SubAgentStarted, SubAgentCompleted |
| `compactStatusAtom` | `{ lastCompact: number; tokenSaved: number } \| null` | 全局 | CompactBoundary |
| `memoryStatusAtom` | `{ lastExtraction: number; newEntries: number } \| null` | 全局 | MemoryExtracted |

---

## 技术决策

| 决策 | 选择 | 理由 | 替代方案 |
|------|------|------|---------|
| 执行循环模式 | `AsyncGenerator<AgentEvent>` | Claude Code 的 `AsyncGenerator<SDKMessage>` 模式证明可行。生成器天然支持流式消费、中断传播（`return()` / `throw()`）、背压控制。优于回调地狱和 RxJS。 | 回调模式（难以组合和中断）、EventEmitter（无法 `await` 和背压控制） |
| 压缩触发策略 | Token 使用率 > 85% 阈值自动触发 | Claude Code 的自动压缩（`autoCompact`）用同一阈值。85% 给回复预留 15% 空间，减少压缩与回复的竞争。 | 手动触发（用户需感知 token 消耗）、固定消息数（不精确） |
| 记忆提取时机 | 任务完成后 fire-and-forget | Claude Code 的 `extractMemories` 同样 fire-and-forget，不阻塞主流程。提取失败不影响任务成功。 | 同步提取（增加任务延迟）、定时批量提取（需要调度器） |
| Profile 与引擎分离 | Profile 纯数据文件 + 引擎无领域逻辑 | Claude Code 的 Agent 类型（builtin/custom/plugin）共享同一 `QueryEngine`，通过 `getSystemPrompt()` 函数差异化。我们的 profile 模式与其等价：引擎只读配置，不做领域判断。 | 引擎内嵌 if/switch 按领域分支（无法扩展，违反开闭原则） |
| 子 Agent 上下文隔离 | 共享项目信息（文件树+记忆），隔离对话历史 | Claude Code 的 `forkSubagent` 隔离工作树但共享 prompt cache。对话历史隔离防止子 Agent 被主 Agent 的推理链干扰；项目信息共享确保子 Agent 能访问必要的代码上下文。 | 完全隔离（子 Agent 需要重新探索项目，浪费 token）、完全共享（子 Agent 被主对话污染） |
| 文件系统记忆格式 | Markdown + YAML frontmatter | Claude Code 的 `memdir/` 用同格式——人类可读、Git diff 友好、编辑器可直接修改。SQLite 存储作为查询索引（双写同步）。 | 纯 SQLite（不可 Git 追踪）、纯 JSON（diff 不友好） |
| Token 计数 | 双层：tiktoken（优先）+ 字符估算（回退） | Claude Code 使用 Anthropic 的 token 计数 API，我们无法直接使用。tiktoken（OpenAI 开源）覆盖主流模型，字符估算作为无依赖回退。 | 字符估算（不精确，可能导致过早/过晚压缩） |
| 工具并行执行 | 按风险分组：只读工具并行（max 16），写/风险工具串行 | Claude Code 的 `toolOrchestration` 按 `concurrencySafe` 分组。我们简化：风险级别 `read` → 并行，`write`/`risky` → 串行。用户确认的 16 上限与 Claude Code 的 `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY=10` 对齐但更宽松。 | 全部串行（慢）、全部并行（文件写入冲突风险） |

---

## 关键接口（类型签名，非实现）

### AgentOrchestrator

```typescript
interface AgentOrchestrator {
  submitMessage(
    task: AgentTask,
    profile: AgentProfile
  ): AsyncGenerator<SessionEvent, TerminalResult, void>

  interrupt(): void  // 外部中断（用户取消）
}

type TerminalResult = {
  reason: TerminalReason
  task: AgentTask
  usage: TokenUsage
}

type TerminalReason =
  | 'completed'       // 正常完成（end_turn）
  | 'max_turns'       // 达到最大轮次
  | 'aborted'         // 用户中断
  | 'model_error'     // 不可恢复的模型错误
  | 'blocking_limit'  // 上下文超限且压缩禁用
```

### AgentProfile

```typescript
interface AgentProfile {
  id: string
  name: string
  systemPrompt: PromptTemplate

  // 工具配置
  tools: string[]
  disallowedTools?: string[]
  toolSelection: 'all' | 'topk' | 'none'

  // 技能配置
  skills: string[]

  // 记忆配置
  memory: {
    scopes: MemoryScope[]
    recallLimit: number
    autoExtract: boolean
    loadFileMemory: boolean
  }

  // 上下文管理
  context: {
    maxTokens: number
    budgets: TokenBudgets
    autoCompact: boolean
    compactTriggerRatio: number  // 默认 0.85
    keepRecentTurns: number      // 压缩后保留完整轮数
  }

  // 执行策略
  execution: {
    maxTurns: number
    maxParallelTools: number
    planning: 'none' | 'inline'
  }

  // 输出策略
  output: {
    generateArtifact: boolean
    autoTitle: boolean
  }
}

interface TokenBudgets {
  system: number     // 系统提示词
  tools: number      // 工具定义
  memory: number     // 记忆上下文
  messages: number   // 消息历史
  reserve: number    // 回复预留
}
```

### PromptTemplate

```typescript
interface PromptSection {
  name: string
  priority: number
  content: string | ((ctx: PromptContext) => string)
  condition?: (ctx: PromptContext) => boolean
}

interface PromptTemplate {
  sections: PromptSection[]
  render(ctx: PromptContext): string
}

interface PromptContext {
  profile: AgentProfile
  skills: SkillManifest[]
  tools: ToolManifest[]
  memories: MemoryEntry[]
  sessionId: string
  projectId?: string
  date: string
  goal: string
}
```

### SubAgentManager

```typescript
interface SubAgentManager {
  fork(
    parentTask: AgentTask,
    subProfile: AgentProfile,
    goal: string,
    context: SubAgentContext
  ): Promise<SubAgentResult>

  cancel(agentId: string): void
  cancelAll(): void
  list(): SubAgentInfo[]
}

interface SubAgentContext {
  sharedFileTree: FileNode[]       // 项目文件树（只读快照）
  sharedMemories: MemoryEntry[]    // 项目级记忆
  parentSummary: string            // 父任务简短摘要
  isolation?: 'worktree' | 'inline'
}
```

---

## 与现有代码的关系

```
现有文件                         →  新架构中的位置
─────────────────────────────────────────────────────────
AgentLoop.ts (421行)             →  删除。拆为:
                                    AgentOrchestrator.ts (~300行)
                                    ContextCompactor.ts (~150行)
                                    MemoryExtractor.ts (~120行)
ContextBuilder.ts (296行)        →  重构。保留消息历史+工具选择逻辑；
                                    提示词组装委托给 PromptTemplate
LLMProvider.ts (379行)           →  拆为 3 文件:
                                    LLMProvider.ts (接口+类型, ~80行)
                                    AnthropicProvider.ts (~250行)
                                    LLMProviderRegistry.ts (~80行)
MemoryService.ts                 →  合并到 MemoryManager.ts
ToolExecutor.ts                  →  保留核心 pipeline。
                                    新增 ToolOrchestrator.ts (并行调度)
ToolImplementations.ts           →  拆为 implementations/*.ts (每工具1文件)
AgentEventBus.ts                 →  保持不变
AgentRuntime.ts                  →  简化: 委托给 AgentOrchestrator
PermissionService.ts             →  保持不变
PermissionBridge.ts              →  保持不变
AuditService.ts                  →  保持不变
```
