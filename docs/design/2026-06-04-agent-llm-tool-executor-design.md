# Agent LLM + Streaming + ToolExecutor 架构设计

> **日期：** 2026-06-04
> **基于需求：** 差异审计 P0 项 (N1, N2, N5)
> **依赖文档：** `2026-06-04-agent-workbench-electron-architecture.md`

---

## 1. 组件结构（标注新/改/删）

```
src/main/
  agent/
    AgentRuntime.ts          [改] 从 mock transition table 改为真实 LLM agent loop
    AgentEventBus.ts          [不改] 复用
    ├── ContextBuilder.ts     [新] 组装 system prompt + history + tools + memory
    ├── LLMProvider.ts        [新] 抽象接口 + Anthropic 实现
    └── AgentLoop.ts          [新] agent loop 核心（plan → execute → verify 循环）
  tools/
    ToolRegistry.ts           [不改] 复用
    ToolRouter.ts             [不改] 复用
    ├── ToolExecutor.ts       [新] 统一 tool 执行入口，串联 Permission + Audit
    └── ToolImplementations.ts [新] 真实 tool 实现（read_file, create_document 等）
  permission/
    PermissionService.ts      [不改] 复用
    ├── PermissionBridge.ts   [新] 阻塞式等待 renderer 权限确认的桥
  store/
    ├── secrets.ts            [新] Electron safeStorage 加密的 API key 存取

src/renderer/
  core/types/
    SessionEvent.ts           [改] 新增 AgentMessageChunk 事件类型
  atoms/
    sessionAtom.ts            [改] handleAgentEvent 支持 chunk 累积
  components/Conversation/events/
    AgentMessageEvent.tsx     [改] 支持增量渲染（chunk append）
    ├── AgentMessageChunkEvent.tsx [新] streaming chunk 渲染器
```

---

## 2. LLM Provider 抽象

### 2.1 接口

```ts
// src/main/agent/LLMProvider.ts

interface LLMProviderConfig {
  apiKey: string
  model: string
  maxTokens: number
}

interface LLMToolDef {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

interface LLMMessage {
  role: 'user' | 'assistant'
  content: string | LLMContentBlock[]
}

type LLMContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string }

interface LLMChatParams {
  systemPrompt: string
  messages: LLMMessage[]
  tools: LLMToolDef[]
}

interface LLMChatResult {
  content: LLMContentBlock[]
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens'
  usage: { inputTokens: number; outputTokens: number }
}

// Streaming callback
type LLMChunkCallback = (chunk: LLMChunk) => void

interface LLMChunk {
  type: 'text_delta' | 'tool_use_start' | 'tool_use_delta' | 'content_block_stop' | 'message_stop'
  text?: string
  toolUseId?: string
  toolName?: string
  toolInput?: unknown
}

interface LLMProvider {
  readonly name: string
  readonly models: string[]
  chat(params: LLMChatParams): Promise<LLMChatResult>
  chatStream(params: LLMChatParams, onChunk: LLMChunkCallback): Promise<LLMChatResult>
  validateKey(apiKey: string): Promise<boolean>
}

class AnthropicProvider implements LLMProvider {
  // 封装 @anthropic-ai/sdk Messages API
  // chat() 用 messages.create()
  // chatStream() 用 messages.stream() 逐 token yield
}

class LLMProviderRegistry {
  // 管理多个 provider，按名称查找
  // MVP 只注册 AnthropicProvider
}
```

### 2.2 API Key 管理

```ts
// src/main/store/secrets.ts

// Electron safeStorage API — 系统级加密存储
// macOS Keychain / Windows DPAPI / Linux libsecret

function storeApiKey(provider: string, key: string): void
function getApiKey(provider: string): string | null
function deleteApiKey(provider: string): void
function isEncryptionAvailable(): boolean
```

- API key 永不暴露给 renderer（不进 preload API）
- renderer 通过 `config:validate-key` IPC 检查 key 是否已配置，只返回 `{ configured: true/false }`
- renderer 通过 `config:set-key` IPC 设置 key，key 只流经 main process
- 应用启动时检查 key 存在性，不存在则在 UI 提示用户配置

### 2.3 技术决策

| 决策 | 方案 | 理由 |
|---|---|---|
| Provider 抽象 | 接口 + Registry | 未来可扩展 OpenAI/本地模型，MVP 只有 Anthropic |
| Streaming | SDK 原生 stream() | Anthropic SDK 内置 SSE stream，无需自己解析 |
| API key 存储 | Electron safeStorage | 系统级加密，不落明文到 SQLite |
| 模型选择 | main process 配置 | renderer 通过 IPC 查询可用模型列表，切换由 main process 执行 |

---

## 3. ContextBuilder

### 3.1 职责

ContextBuilder 将分散的上下文片段组装为一次 LLM 调用的完整消息列表。

```ts
// src/main/agent/ContextBuilder.ts

interface ContextParams {
  goal: string
  sessionId: string
  projectId?: string
}

interface AssembledContext {
  systemPrompt: string
  messages: LLMMessage[]
  tools: LLMToolDef[]
  memoryContext: string
}

class ContextBuilder {
  constructor(
    private toolRegistry: ToolRegistry,
    private toolRouter: ToolRouter,
    private memoryService: MemoryService,
    private skillRegistry: SkillRegistry,
    private eventBus: AgentEventBus,
  ) {}

  async build(params: ContextParams): Promise<AssembledContext> {
    // 1. 获取历史消息（最近 N 轮，从 EventBus 历史中取）
    // 2. ToolRouter 选出 Top-K 工具 并转为 LLM tool def 格式
    // 3. MemoryService.recall() 回忆相关 L2 记忆
    // 4. 组合 system prompt：base prompt + skill prompts + memory context + constraints
    // 5. 返回组装结果
  }
}
```

### 3.2 Token 预算

```
总预算: ~100K tokens（模型上下文窗口 200K 的 50%）
  systemPrompt:  ~8K   (base 2K + skills 4K + memory 2K)
  tools defs:    ~12K  (Top-5 tools × ~2.4K each)
  messages:      ~60K  (最近 20 轮)
  reserve:       ~20K  (LLM 输出 + tool results 空间)
```

### 3.3 System Prompt 结构

```
[Base Prompt (~2K)]
"You are AttaSeek, an AI agent workbench assistant..."
← 定义 Agent 身份、能力边界、行为规则

[Active Skills (~4K)]
"Available skills: summarize, generate_doc, review_code, project_report"
← 从 SkillRegistry 列出当前 Activity 相关的 skill

[Memory Context (~2K)]
"User preferences: ... Project context: ..."
← 从 MemoryService.recall() 取回的相关记忆
```

---

## 4. Streaming 事件扩展

### 4.1 新事件类型

```ts
// 新增到 SessionEventType
| 'AgentMessageChunk'   // 流式文本增量

// 新增 payload
interface AgentMessageChunkPayload {
  content: string       // 本次 delta 文本
  isFinal: boolean      // true = 这是最后一块，消息完整
  messageId: string     // 关联的 AgentMessage ID（多轮对话中区分）
}
```

### 4.2 事件时序

```
ToolCallStarted →
ToolCallFinished →
AgentMessageChunk { content: "I ", isFinal: false } →
AgentMessageChunk { content: "found ", isFinal: false } →
AgentMessageChunk { content: "3 files", isFinal: true } →
ArtifactCreated →
TaskCompleted
```

### 4.3 Renderer 消费

```
AgentMessageChunk →
  handleAgentEvent() 检查 isFinal:
    false → 累积到临时 buffer（按 messageId）
    true  → 将完整文本作为 AgentMessage 追加到 sessionEventsAtom
  AgentMessageEvent 组件按 messageId 读取 buffer 渐进渲染
```

### 4.4 技术决策

| 决策 | 方案 | 理由 |
|---|---|---|
| Chunk 粒度 | 每个 token delta 一个事件 | IPC push 已就绪，低延迟 |
| 事件频率控制 | main process 侧 throttle (50ms) | 避免 IPC 洪水（1 token/ms → 50 tokens/event） |
| 历史存储 | 只存合并后的 AgentMessage，不存 chunk | 历史查询不需要逐 token 精度 |
| Renderer 渲染 | requestAnimationFrame 批量 apply | 避免 React 每个 chunk 触发一次完整 re-render |

---

## 5. ToolExecutor

### 5.1 执行链路

```ts
// src/main/tools/ToolExecutor.ts

interface ToolExecParams {
  toolId: string
  toolCallId: string
  input: Record<string, unknown>
  taskId: string
  sessionId: string
  projectId?: string
}

interface ToolExecResult {
  success: boolean
  output?: unknown
  error?: ToolError
  permissionDecision?: 'allow' | 'deny'
}

class ToolExecutor {
  constructor(
    private toolRegistry: ToolRegistry,
    private permissionService: PermissionService,
    private auditService: AuditService,
    private permissionBridge: PermissionBridge,
  ) {}

  async execute(params: ToolExecParams): Promise<ToolExecResult> {
    // 1. 查 tool manifest
    // 2. build PermissionContext
    // 3. permissionService.check() → decision
    // 4. decision === 'deny' → return denied
    // 5. decision === 'ask'  → emit PermissionRequested event → wait for renderer response via PermissionBridge
    // 6. Get tool implementation → run
    // 7. auditService.log(tool_call_started / tool_call_completed)
    // 8. return result
  }
}
```

### 5.2 Tool Implementations (MVP)

```ts
// src/main/tools/ToolImplementations.ts

// 每个 tool 实现是一个纯函数
type ToolImpl = (input: Record<string, unknown>) => Promise<unknown>

const TOOL_IMPLS: Record<string, ToolImpl> = {
  read_file: async (input) => {
    // fs.readFile(path, 'utf-8')
    // path 必须在允许的目录内（沙箱检查）
  },
  create_document: async (input) => {
    // 通过 ArtifactService.create() 创建 Artifact
  },
  search_code: async (input) => {
    // 用 ripgrep 或 Node fs + glob 搜索
  },
  // send_email / git_commit 暂为 mock（输出预览）
}
```

### 5.3 PermissionBridge（阻塞式权限等待）

当前 PermissionService 是同步的 `check()` + 异步的 `requestPermission()`/`resolveRequest()`。ToolExecutor 需要在 `ask` 决策时等待 renderer 用户选择。

```ts
// src/main/permission/PermissionBridge.ts

class PermissionBridge {
  // 发送 PermissionRequested 事件，等待 renderer 的 permission:respond IPC
  // 用 Promise + 事件监听实现阻塞等待
  async awaitPermission(request: PermissionRequest, timeoutMs: number = 120_000): Promise<'allow' | 'deny'>

  // renderer 调用 permission:respond 时，resolve 对应的 Promise
  resolve(requestId: string, decision: 'allow' | 'deny'): void
}
```

### 5.4 技术决策

| 决策 | 方案 | 理由 |
|---|---|---|
| Tool 实现注册 | `Record<string, ToolImpl>` | MVP 简单直接；后续复杂 tool 可按插件贡献 |
| 文件 sandbox | 配置允许的目录列表（默认为用户 home + 当前项目） | 安全基础线 |
| 权限等待 | Promise-based bridge with timeout | 不阻塞 main process event loop |
| 超时处理 | 默认 120s，超时 = deny | 防止用户离开导致 agent 永久挂起 |

---

## 6. AgentRuntime 改造（Agent Loop）

### 6.1 当前 → 目标

```
当前 (mock transition table):
  UserMessage → [800ms timer] → AgentMessage → [500ms] → ToolCallStarted →
  [700ms] → ToolCallFinished → [600ms] → ArtifactCreated → TaskCompleted

目标 (real agent loop):
  UserMessage →
  AgentLoop.start(task)
    ├─ ContextBuilder.build()           // 组装上下文
    ├─ LLMProvider.chatStream()         // 调用 LLM，流式输出
    │   ├─ text_delta → AgentMessageChunk event
    │   └─ tool_use → ToolExecutor.execute() → tool_result → 继续 LLM
    ├─ ArtifactService.create()         // 生成产物
    ├─ MemoryService.store()            // 写入记忆
    ├─ AuditService.log()               // 审计日志
    └─ TaskCompleted event
```

### 6.2 AgentLoop 状态机（简化）

```
idle →
  context_assembling →   // ContextBuilder.build()
  executing →            // LLMProvider.chatStream()
    (text → AgentMessageChunk, tool_use → ToolExecutor → loop back to executing)
  generating_artifact →  // ArtifactService.create()
  writing_memory →       // MemoryService.store()
  completed

异常:
  awaiting_permission →  // ToolExecutor 等待权限确认
  waiting_user_input →   // LLM 请求用户补充信息
  failed / cancelled / denied
```

### 6.3 AgentLoop 伪代码

```ts
// src/main/agent/AgentLoop.ts

class AgentLoop {
  async run(task: AgentTask): Promise<void> {
    task.status = 'context_assembling'
    const ctx = await this.contextBuilder.build({
      goal: task.goal,
      sessionId: task.sessionId,
      projectId: task.projectId,
    })

    task.status = 'executing'
    let messages = ctx.messages

    // Main agent loop — iterate until end_turn or cancelled
    while (task.status === 'executing') {
      const result = await this.llmProvider.chatStream(
        { systemPrompt: ctx.systemPrompt, messages, tools: ctx.tools },
        (chunk) => this.handleChunk(task, chunk),
      )

      if (result.stopReason === 'end_turn') break

      // Process tool_use blocks
      for (const block of result.content) {
        if (block.type !== 'tool_use') continue

        this.eventBus.emit(ToolCallStarted(task, block))
        const execResult = await this.toolExecutor.execute({
          toolId: block.name, toolCallId: block.id,
          input: block.input as Record<string, unknown>,
          taskId: task.id, sessionId: task.sessionId,
        })
        this.eventBus.emit(ToolCallFinished(task, block, execResult))

        // Append tool_result to messages for next LLM turn
        messages.push({ role: 'assistant', content: [block] })
        messages.push({ role: 'user', content: [{
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(execResult.output),
        }] })
      }
    }

    // Finalize
    task.status = 'completed'
    this.eventBus.emit(TaskCompleted(task))
    this.auditService.log({ eventType: 'agent_task_completed', ... })
  }
}
```

---

## 7. 完整数据流

```
User types in Composer
  → Composer.handleSend()
  → window.api.agent.createTask(goal, sessionId)
  → IPC: agent:create-task
  → AgentRuntime.createTask()
  → AgentLoop.run(task)
      │
      ├─ ContextBuilder.build()
      │   ├─ ToolRouter.selectTools(goal, topK=5)
      │   ├─ MemoryService.recall()
      │   └─ SkillRegistry.suggestForTask()
      │
      ├─ LLMProvider.chatStream()
      │   ├─ text_delta → AgentEventBus.emit(AgentMessageChunk)
      │   │   └─ IPC push → renderer → handleAgentEvent → sessionEventsAtom
      │   │       └─ MessageFlow re-renders → AgentMessageEvent
      │   │
      │   └─ tool_use → AgentEventBus.emit(ToolCallStarted)
      │       └─ ToolExecutor.execute()
      │           ├─ PermissionService.check()
      │           │   ├─ 'allow' → continue
      │           │   ├─ 'deny' → return denied
      │           │   └─ 'ask' → AgentEventBus.emit(PermissionRequested)
      │           │       └─ PermissionBridge.awaitPermission()
      │           │           └─ renderer user clicks allow/deny
      │           │               └─ IPC: permission:respond → bridge resolves
      │           ├─ TOOL_IMPLS[toolId](input)
      │           ├─ AuditService.log(tool_call_completed)
      │           └─ AgentEventBus.emit(ToolCallFinished)
      │
      ├─ ArtifactService.create()
      │   └─ AgentEventBus.emit(ArtifactCreated)
      │       └─ IPC push → renderer → artifactsAtom
      │           └─ ArtifactPane re-renders
      │
      ├─ MemoryService.store()
      ├─ AuditService.log(task_completed)
      └─ AgentEventBus.emit(TaskCompleted)
          └─ IPC push → renderer → agentTasksAtom
```

---

## 8. 实现顺序

```
Phase A: 基础设施（不改变 AgentRuntime 行为）
  A1: LLMProvider + AnthropicProvider + secrets.ts
  A2: ContextBuilder
  A3: ToolExecutor + ToolImplementations（read_file, create_document 真实实现）
  A4: PermissionBridge

Phase B: Agent Loop 改造
  B1: AgentLoop 实现（新 agent loop，但保留旧 AgentRuntime 可切换）
  B2: AgentMessageChunk 事件类型 + SessionEvent 扩展
  B3: AgentRuntime 切换为 AgentLoop 驱动

Phase C: Renderer 适配
  C1: AgentMessageChunkEvent 组件
  C2: AgentMessageEvent 支持 chunk 累积渲染
  C3: handleAgentEvent 支持 chunk 处理
```

---

## 9. 技术决策总览

| 决策 | 方案 | 理由 |
|---|---|---|
| LLM Provider | 接口抽象 + Anthropic SDK | 先支持 Anthropic，接口留好 OpenAI 扩展点 |
| API Key | Electron safeStorage | 系统级加密，renderer 不可见 |
| Agent Loop 位置 | Main Process | 需要访问 fs/ToolExecutor/Permission/Audit |
| Tool 执行 | 主进程同步执行（MVP） | 简单；后续高风险 tool 可改子进程 |
| Streaming 事件 | 新增 AgentMessageChunk，throttle 50ms | 复用现有 EventBus + IPC，避免洪水 |
| 权限等待 | PromiseBridge + 120s timeout | 不阻塞 event loop，超时默认 deny |
| Token 预算 | ContextBuilder 内计数 + 截断 | 防止超出模型上下文窗口 |
| 文件 sandbox | 配置允许目录列表（白名单） | 防止 Agent 读/写系统敏感文件 |
