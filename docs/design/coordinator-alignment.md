# 协调器模式对齐设计

> 设计日期: 2026-06-08
> 基于: `docs/analysis/coordinator-mode-deep-dive.md`
> 目标: 将 AttaSeek 的协调器/多代理能力与 Claude Code 功能对齐

---

## 范围

### In
- **P0 — 核心功能对齐**: LLM 任务分解、增强 AgentTool schema、异步子代理执行、Worker 结果通知注入
- **P1 — Worker 通信**: SendMessage 工具、Worker 继续机制
- **P2 — 协调器智商**: Coordinator AgentProfile（系统提示）、Fork 子代理（上下文继承）

### Out
- tmux/swarm 进程管理（AttaSeek 在 Electron 内运行，不需要外部进程）
- 远程 Agent 执行（CCR — 云环境，不在 AttaSeek 范围内）
- TeamCreate/TeamDelete 工具（需要的只是 SwarmManager 增强，而非 swarm session 创建）
- 权限模式透传（bubble permissions to parent — 后续迭代）

---

## 场景梳理

### 正常流程

```
用户: "调查并修复 auth 模块的空指针异常"
  │
  ▼
协调器 (coordinator AgentProfile)
  │  decomposes goal via LLM → 3 subtasks:
  │    1. 调查 auth 模块 (explore, 无依赖)
  │    2. 调查测试覆盖 (explore, 无依赖)
  │    3. 修复 + 验证 (coding, dependsOn: [1,2])
  │
  ├──▶ [后台] Worker A: explore profile, "探索 auth 模块空指针根因…"
  ├──▶ [后台] Worker B: explore profile, "找出 auth 测试覆盖情况…"
  │    返回后不阻塞，协调器继续
  │
  ▼
协调器收到 Worker A、B 完成通知 → 综合发现 → 生成修复方案
  │
  └──▶ [后台/同步] Worker C: coding profile, "修复 validate.ts:42…"
  │
  ▼
协调器收到 Worker C 完成通知 → 确认修复 → 向用户报告
```

### 异常流程

1. **Worker 失败**: 失败通知注入 → 协调器读取错误 → 决定重试/换个方案/向用户报告
2. **Worker 超时**: 达到 maxTurns → 终止 → 协调器决定是否继续
3. **用户中断**: abort signal 传播 → 所有后台 Worker 取消
4. **递归防护**: 子代理尝试 fork 另一个子代理 → `RecursionGuard` 拒绝
5. **Worktree 创建失败**: fallback 到 `inline` 执行 → console.warn → 不影响流程

### 边界条件

- Worker 间通信: Worker A 和 B 独立，不能直接通信（设计如此 — 只有协调器能看到全局）
- 并发 Worker 数量: 受 `SubAgentManager` 限制（当前无明确限制，建议 ≤10 并发）
- Worker 结果大小: tool result budget 限制（50K chars），超出的截断
- 协调器消息流中的通知去重: 每个 Worker 的完成通知只注入一次

---

## 架构设计

### 组件划分

```
                        ┌─────────────────────┐
                        │   query-loop.ts      │
                        │   (协调器主循环)      │
                        └──────┬──────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
            ▼                  ▼                  ▼
   ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐
   │ AgentTool       │  │ SendMessage  │  │ TaskStopTool    │
   │ (spawn_agent)   │  │ Tool (new)   │  │ (增强)          │
   └──────┬─────────┘  └──────┬───────┘  └────────┬────────┘
          │                   │                    │
          ▼                   ▼                    ▼
   ┌──────────────────────────────────────────────────┐
   │              SubAgentManager                       │
   │  fork()          — 同步（等待完成）               │
   │  forkAsync()     — 异步（后台运行，返回 agentId） │
   │  continueWorker() — 向 Worker 发送后续消息 (new)  │
   │  cancel()        — 取消 Worker                    │
   │  cancelAll()     — 取消全部                       │
   └──────┬───────────────────────────────────────────┘
          │
          ▼
   ┌──────────────────────────────────────────────────┐
   │         TaskNotificationQueue (new)               │
   │  收集已完成的 Worker 结果                          │
   │  去重 + 格式化 <task-notification> XML             │
   │  注入协调器消息流                                  │
   └──────┬───────────────────────────────────────────┘
          │
          ▼
   ┌──────────────────────────────────────────────────┐
   │         AgentEventBus (已有)                      │
   │  emitAsync(task_notification event)               │
   │  协调器主循环每轮消耗 pending notifications        │
   └──────────────────────────────────────────────────┘
```

### 数据流

```
1. 协调器 LLM 调用 spawn_agent(run_in_background=true)
   │
2. query-loop.runToolBatch() 识别 agent 工具调用
   │  run_in_background=true → forkAsync()
   │  run_in_background=false/undefined → fork() (同步等待)
   │
3. SubAgentManager.forkAsync()
   │  创建独立 QueryEngine (modelSlot='subagent')
   │  在 detached Promise 中执行 engine.submitMessage()
   │  立即返回 { agentId, status: 'async_launched' }
   │
4. Worker 完成 (在后台 Promise 中)
   │  agentEventBus.emitAsync(TaskNotification event)
   │  → TaskNotificationQueue 缓存
   │
5. 协调器下一轮循环开始
   │  TaskNotificationQueue.drainPending()
   │  → 返回 <task-notification> 格式的 user message
   │  → 注入 state.messages (在 LLM 调用之前)
   │
6. 协调器 LLM 看到 <task-notification> → 读取 Worker 结果
   │  综合 → 决定下一步 (continue/spawn/stop/report)
   │
7. 协调器调用 send_message(to: agentId, message: "继续修…")
   │  → SubAgentManager.continueWorker()
   │  → 生成新子代理 (带上下文引用)
```

### IPC 与事件

所有组件在主进程中运行，无需跨进程 IPC。组件间通过 AgentEventBus 通信。

**新增事件类型:**

```typescript
// SessionEvent.ts 新增
TaskNotification: {
  agentId: string         // Worker 的 ID
  status: 'completed' | 'failed' | 'killed'
  summary: string         // 人类可读的状态摘要
  result?: string         // Worker 的最终输出文本
  usage?: {
    totalTokens: number
    toolUses: number
    durationMs: number
  }
  errorMessage?: string   // 仅在 status='failed' 时
}
```

---

## 关键决策

### 决策 1: Worker 结果通知通过 AgentEventBus + 队列注入

**理由**: 
- 不直接修改 QueryEngine 的 messages 列表（避免并发写入问题）
- 协调器主循环在每轮开始时轮询队列（确定性的消费点，mirrors Claude Code 的 queuedCommands 模式）
- AgentEventBus 已实现 fire-and-forget emitAsync（适合后台 Worker 完成通知）

**替代方案考虑**:
- 直接 push 到 QueryEngine.messages: 存在并发安全问题（Worker 在后台完成，协调器正在流式输出）
- 通过 QueryEngine 的回调: 耦合太重

### 决策 2: forkAsync 使用独立 QueryEngine（与 fork 相同）

**理由**:
- 子代理需要独立的上下文、工具集和模型槽位
- 不共享消息历史（避免协调器的推理链影响 Worker 判断）
- modelSlot='subagent' 确保使用正确的模型配置

**当前限制**:
- 不实现 Fork subagent 上下文继承（prompt cache sharing）—— 这是 P2 优化
- 子代理的 ContextAssembler 独立装配上下文，不继承协调器的对话历史

### 决策 3: SendMessage 的 MVP 实现为"spawn continuation sub-agent"

**理由**:
- Worker 的 QueryEngine 在执行完成后销毁，无法"继续注入消息"
- 要保持 Worker 的上下文（messages），需要让其 QueryEngine 持续存活
- MVP 方案: 新生成子代理，带上原 Worker 的 agentId 引用和 "continuing work from agent X" 的上下文提示
- 后续: 实现 Worker 的持久化上下文（serialize/resume QueryEngine messages）

**Claude Code 的处理方式**:
- Claude Code 的 Worker（LocalAgentTask）有持久化的消息列表
- `SendMessage` 向 `pendingMessages` 队列追加消息
- Worker 轮询 `pendingMessages` 并处理

### 决策 4: 协调器系统提示作为 AgentProfile 实现

**理由**:
- AttaSeek 已有 profile 机制（coding/research/writing）
- 协调器是一个有特定行为模式的 Agent，自然适合用 profile 表达
- 系统提示包含行为准则、工具使用说明和示例
- 不需要修改架构——只是在现有 profile 框架中添加新的 profile

### 决策 5: LLM 任务分解使用 compact 模型

**理由**:
- 任务分解是暂态操作（不在关键路径上）
- compact 模型（通常 Haiku 级别）足够做结构化分解
- 成本远低于 main 模型
- 与工具摘要使用相同的 compact 模型一致

---

## 实施路径

### Phase 1: 基础设施（P0 — 异步子代理 + 通知协议）

**T1: 新增 SessionEvent 类型**
- 文件: `src/shared/types/SessionEvent.ts`
- 内容: 在 `SessionEventPayloadMap` 中新增 `TaskNotification` 事件类型
- 依赖: 无

**T2: SubAgentManager.forkAsync()**
- 文件: `src/main/agent/subagent/SubAgentManager.ts`
- 内容: 
  - 新增 `forkAsync()` 方法（返回 `{ agentId, status: 'async_launched' }`）
  - Worker 在 detached Promise 中执行
  - 完成时 emitAsync TaskNotification 事件
- 依赖: T1

**T3: TaskNotificationQueue**
- 文件: `src/main/agent/coordinator/TaskNotificationQueue.ts` (new)
- 内容: 
  - 收集当前 session 的已完成 Worker 结果
  - `drainPending(sessionId): LLMMessage[]` 返回格式化的通知消息
  - 去重（每个 agentId 只返回一次）
- 依赖: T1, T2

**T4: 增强 AgentTool Schema**
- 文件: `src/main/agent/tools/implementations/agent-tools.ts`
- 内容: 
  - 新增字段: `description`, `subagent_type`, `run_in_background`, `name`, `isolation`
  - `subagent_type` 支持: `explore`, `plan`, `review`, `verify`, `coding`, `research`, `writing`
- 依赖: 无

**T5: 增强 AgentTool 实现**
- 文件: `src/main/agent/tools/implementations/agent-tool-impl.ts`
- 内容:
  - 处理 `run_in_background=true` → 调用 `forkAsync()`
  - 处理扩展的 `subagent_type` 选择
  - 返回格式包含 `agentId` 和 `status`
- 依赖: T2, T4

### Phase 2: Worker 通信（P1 — SendMessage + 通知注入）

**T6: SendMessage Tool**
- 文件: 
  - `src/main/agent/tools/implementations/send-message-tools.ts` (new)
  - `src/main/agent/tools/implementations/send-message-impl.ts` (new)
- 内容:
  - Tool manifest 和实现
  - 输入: `to` (agentId), `summary` (可选), `message` (文本)
  - MVP: spawn continuation sub-agent
- 依赖: T2

**T7: Query Loop 集成 — 通知注入**
- 文件: `src/main/agent/orchestrator/query-loop.ts`
- 内容:
  - 在每轮循环开始时调用 `TaskNotificationQueue.drainPending()`
  - 将通知格式化为 user-role 消息注入 `state.messages`
  - `<task-notification>` XML 格式 mirrors Claude Code
- 依赖: T3, T5

**T8: Query Loop 集成 — run_in_background 处理**
- 文件: `src/main/agent/orchestrator/query-loop.ts`
- 内容:
  - `runToolBatch()` 中识别 `run_in_background` agent 调用
  - 同步 agent 调用: 当前行为 (fork + await)
  - 异步 agent 调用: forkAsync + 返回 `async_launched` 结果
- 依赖: T5

### Phase 3: 协调器智商（P2 — 系统提示 + 分解 + Fork）

**T9: Coordinator AgentProfile**
- 文件: `src/main/agent/profile/profiles/coordinator-profile.ts` (new)
- 内容:
  - 系统提示 (~100 行) 定义协调器行为准则
  - 工具列表: spawn_agent, send_message, task_stop, read_file, search_code
  - 行为准则: Always synthesize, parallel is superpower, continue vs spawn 决策表
  - maxTurns=30 (协调器需要更多轮次来管理 Worker)
- 依赖: T6 (reference send_message tool name)

**T10: LLM-driven decompose()**
- 文件: `src/main/agent/coordinator/CoordinatorMode.ts`
- 内容:
  - 替换 MVP 单子任务逻辑为 LLM 调用
  - 使用 compact 模型调用
  - 异步分解: 将目标 + 项目上下文发送给 LLM
  - 解析结构化响应为 Subtask[] (含 dependsOn)
  - 保留原有依赖排序执行逻辑
- 依赖: T9 (needs coordinator profile for model resolution)

**T11: Fork SubAgent 上下文继承**
- 文件: `src/main/agent/subagent/SubAgentManager.ts`
- 内容:
  - 新增 `forkWithContext()` 方法（继承父会话的 messages + systemPrompt）
  - 继承父会话的 prompt cache key
  - 子代理创建时复用父 ContextAssembler 的部分结果
- 依赖: T2

### Phase 4: 收尾

**T12: 导出和索引更新**
- 文件: `src/main/agent/index.ts`
- 内容: 导出新模块 (TaskNotificationQueue, coordinatorProfile, sendMessage 工具)

**T13: 工具注册**
- 文件: `src/main/tools/` (工具注册相关)
- 内容: 将 send_message 和增强的 spawn_agent 注册到 ToolRegistry

**T14: 全量验证**
- typecheck + build + vitest
- 新增 scenarios: coordinator decompose, background agent lifecycle, send_message

---

## 关键接口定义

### SubAgentManager.forkAsync() 签名

```typescript
interface AsyncForkResult {
  agentId: string
  status: 'async_launched'
  outputFile: string          // 输出持久化路径
  canReadOutputFile: boolean  // 协调器是否可读取输出
}

class SubAgentManager {
  forkAsync(
    parentTask: AgentTask,
    profile: AgentProfile,
    goal: string,
    context: SubAgentContext,
  ): Promise<AsyncForkResult>
}
```

### TaskNotificationQueue 接口

```typescript
class TaskNotificationQueue {
  /** 注册一个 pending notification。当 Worker 完成时由 SubAgentManager 调用。 */
  enqueue(sessionId: string, notification: TaskNotification): void

  /** 
   * 消费指定 session 的所有 pending notifications。
   * 返回格式化为 user-role LLMMessage 的列表。
   * 每个 notification 只返回一次（去重）。
   */
  drainPending(sessionId: string): LLMMessage[]

  /** 取消指定 agentId 的 pending notification */
  cancel(agentId: string): void
}
```

### TaskNotification 格式

```xml
<task-notification>
  <task-id>{agentId}</task-id>
  <status>completed|failed|killed</status>
  <summary>{human-readable status summary}</summary>
  <result>{agent's final text response (optional)}</result>
  <usage>
    <total_tokens>N</total_tokens>
    <tool_uses>N</tool_uses>
    <duration_ms>N</duration_ms>
  </usage>
</task-notification>
```

### SendMessage Tool Schema

```typescript
{
  name: 'send_message',
  description: 'Send a follow-up message to a running or completed worker agent.',
  inputSchema: {
    type: 'object',
    properties: {
      to: {
        type: 'string',
        description: 'Recipient worker agentId (from spawn_agent result)'
      },
      summary: {
        type: 'string',
        description: '5-10 word summary shown as a preview (optional)'
      },
      message: {
        type: 'string',
        description: 'The message to send — a follow-up instruction or correction'
      }
    },
    required: ['to', 'message']
  }
}
```

### 增强的 spawn_agent Schema

```typescript
{
  name: 'spawn_agent',
  description: 'Spawn a sub-agent for focused task execution. Use subagent_type to select capability profile. Set run_in_background for parallel workers.',
  inputSchema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: '3-5 word description of the task (shown in notifications)'
      },
      goal: {
        type: 'string',
        description: 'Complete task description — self-contained, all context the worker needs'
      },
      subagent_type: {
        type: 'string',
        enum: ['explore', 'plan', 'review', 'verify', 'coding', 'research', 'writing', 'general'],
        description: 'Type of worker agent. Default: coding.'
      },
      model: {
        type: 'string',
        enum: ['sonnet', 'opus', 'haiku'],
        description: 'Optional model override for this worker'
      },
      run_in_background: {
        type: 'boolean',
        description: 'Set to true to run this worker in the background. Results arrive as task notifications.'
      },
      name: {
        type: 'string',
        description: 'Name for this worker — makes it addressable via send_message(to: name)'
      },
      isolation: {
        type: 'string',
        enum: ['inline', 'worktree'],
        description: 'Isolation mode. "worktree" creates a temporary git worktree.'
      }
    },
    required: ['goal']
  }
}
```

---

## 协调器系统提示（AgentProfile 核心内容）

```
You are AttaSeek Coordinator, an AI assistant that orchestrates
software engineering tasks across multiple workers.

## Role

You are a coordinator. Your job is to:
- Help the user achieve their goal
- Direct workers to research, implement, and verify code changes
- Synthesize results and communicate with the user
- Answer questions directly when possible — don't delegate what you can handle

## Tools

- spawn_agent: Spawn a new worker
- send_message: Continue an existing worker
- task_stop: Stop a running worker

## Workers

Workers are independent sub-agents that execute autonomously. Each has
access to filesystem tools, search, and command execution.

When calling spawn_agent:
- Do NOT use one worker to check on another — workers notify you when done
- Do NOT use workers for trivial file reads or commands — do those yourself
- Continue workers whose work is complete via send_message
- After launching workers, briefly tell the user what you launched

## Task Workflow

| Phase       | Who                    | Purpose                              |
|-------------|------------------------|--------------------------------------|
| Research    | Workers (parallel)     | Investigate, find files, understand  |
| Synthesis   | You (coordinator)      | Read findings, craft implementation specs |
| Implement   | Workers                | Make targeted changes per spec       |
| Verify      | Workers                | Test changes work                    |

## Writing Worker Prompts

ALWAYS synthesize — your most important job. Workers cannot see your
conversation. Every prompt must be self-contained.

Read worker findings → understand → write specific prompts with file
paths, line numbers, and exactly what to change.

Never write "based on your findings" — prove you understood.

### Continue vs Spawn Fresh

| Situation                              | Mechanism    | Why                          |
|----------------------------------------|--------------|------------------------------|
| Research explored files that need edits | Continue     | Worker has relevant context  |
| Research was broad, task is narrow     | Spawn fresh  | Avoid exploration noise      |
| Correcting a failure or extending work | Continue     | Worker has error context     |
| Verifying another worker's code        | Spawn fresh  | Fresh eyes on the code       |

### What "Done" Looks Like

- Implementation: "Run relevant tests and typecheck, then commit and report"
- Research: "Report findings — do not modify files"
- Verification: "Prove the code works — don't just confirm it exists"

## Handling Worker Results

Worker results arrive as <task-notification> messages. They look like
user messages but are internal signals — never thank or acknowledge them.
Summarize new information for the user as it arrives.

## Parallelism

Parallelism is your superpower. Launch independent workers concurrently.
Read-only tasks (research) — run in parallel freely.
Write-heavy tasks (implementation) — one at a time per file area.
```

---

## 风险

1. **forkAsync 的 detached Promise 异常处理**: Worker 在后台崩溃时，需要确保错误被捕获并注入通知队列，否则协调器会永远等待。缓解: 在 detached Promise 中 try/catch 所有异常，emit TaskNotification(status='failed')。

2. **通知注入时机**: 如果通知在 LLM 调用期间到达（协调器正在流式输出中），需要等到下一轮循环才能消费。—— 这是设计如此（mirrors Claude Code），不是 bug。

3. **compact 模型可用性**: `decompose()` 依赖 compact 模型。如果用户没有配置 compact 模型，降级为 MVP 行为（单子任务）。缓解: fallback to main model for decompose。

4. **Worker 数量爆炸**: 协调器可能生成过多 Worker 并发运行，消耗大量 API token。缓解: SubAgentManager 添加最大并发限制（建议 ≤10），超过的排队。

5. **QueryEngine 生命周期**: forkAsync 创建的 QueryEngine 在子代理完成后自动销毁，不持久化消息列表。这意味着 SendMessage 无法恢复完整上下文。—— P2 迭代中解决（持久化子代理状态）。

6. **类型安全**: agent-tool-impl.ts 中使用 `as any` 构建临时 AgentTask/AgentProfile。缓解: 创建适当的工厂函数构建有效对象。
