# 协调器模式 (Coordinator Mode) 深度分析

> 分析日期: 2026-06-08
> 比较对象: Claude Code `coordinator/coordinatorMode.ts` vs AttaSeek `coordinator/CoordinatorMode.ts` + `coordinator/SwarmManager.ts`

---

## 一、核心概念

协调器模式是一种 **Leader/Worker 多代理协作架构**。一个"协调器"(Leader，通常是主会话 Agent)负责接收用户目标，分解为子任务，分派给多个"工作者"(Worker / SubAgent)并行或串行执行，收集结果并综合输出。

```
用户: "调查这个 bug 并修复它"
  │
  ▼
协调器 (Leader Agent)
  │
  ├──▶ 工作者 1: "探索 bug 根因" (研究，只读)
  ├──▶ 工作者 2: "找出相关测试" (研究，只读)
  │
  │  (等两个都完成)
  ▼
协调器: 综合发现，编写修复方案
  │
  ├──▶ 工作者 1: "按方案修代码" (实现，读写)
  │
  ▼
协调器: 确认修复
  │
  └──▶ 工作者 3: "验证修复" (验证，测试)
```

---

## 二、Claude Code 实现

### 2.1 模块结构

```
coordinator/
  coordinatorMode.ts          369 行  — 核心协调逻辑 + 系统提示

tools/AgentTool/
  AgentTool.tsx               ~500+  — Worker 生成工具
  forkSubagent.ts             184 行  — Fork 子代理（继承对话上下文）
  runAgent.ts                 ~500+  — Agent 执行生命周期
  agentToolUtils.ts           —       工具函数
  resumeAgent.ts              179 行  — Resume 子代理（从磁盘恢复）
  builtInAgents.ts            —       内置 Agent 类型注册
  loadAgentsDir.ts            —       从文件系统加载自定义 Agent
  constants.ts                —       常量定义
  UI.tsx                      —       UI 渲染组件

tools/SendMessageTool/
  SendMessageTool.ts          120+ 行 — 发送消息给运行中的 Worker
  constants.ts / prompt.ts    —       工具定义

tools/TeamCreateTool/         —       创建 Team
tools/TeamDeleteTool/         —       删除 Team

utils/swarm/
  constants.ts                34 行   — Swarm 常量（tmux 会话名等）
  teamHelpers.ts              —       Team 文件管理
  inProcessRunner.ts          —       进程内 Teammate 运行器
  teammateInit.ts / spawnUtils.ts —  生成逻辑
  backends/                   —       后端抽象（pane/process）
  permissionSync.ts           —       权限同步
  reconnection.ts             —       重新连接
```

### 2.2 核心接口

#### 入口函数

```typescript
// 检查是否启用协调器模式（通过环境变量 + feature flag）
export function isCoordinatorMode(): boolean

// 恢复会话时匹配模式
export function matchSessionMode(
  sessionMode: 'coordinator' | 'normal' | undefined
): string | undefined

// 生成 Worker 工具列表和应用户上下文
export function getCoordinatorUserContext(
  mcpClients: ReadonlyArray<{ name: string }>,
  scratchpadDir?: string,
): { [k: string]: string }

// 生成协调器系统提示（~260 行，这是协调器的"大脑"）
export function getCoordinatorSystemPrompt(): string
```

#### AgentTool 输入 Schema

```typescript
// 基础字段
{
  description: string       // 3-5 个词的任务简述
  prompt: string            // Worker 的完整任务描述
  subagent_type?: string    // Agent 类型（'worker' 在协调器模式下）
  model?: 'sonnet'|'opus'|'haiku'  // 模型覆盖
  run_in_background?: boolean     // 后台运行（异步）

  // 多代理扩展字段 (KAIROS feature gate)
  name?: string             // Worker 名字，用于 SendMessage(to: name)
  team_name?: string        // 所属 Team
  mode?: PermissionMode     // 权限模式
  isolation?: 'worktree' | 'remote'  // 隔离模式
  cwd?: string              // 工作目录覆盖
}
```

#### AgentTool 输出 Schema

```typescript
// 同步完成
{ status: 'completed', prompt: string }

// 异步启动（后台运行）
{ status: 'async_launched', agentId: string, description: string,
  prompt: string, outputFile: string, canReadOutputFile: boolean }

// Teammate 生成（swarms 启用时）
{ status: 'teammate_spawned', teammate_id: string, agent_id: string,
  name: string, color: string, ... }

// 远程启动
{ status: 'remote_launched', taskId: string, sessionUrl: string, ... }
```

### 2.3 工作流程

#### 启动：进入协调器模式

```bash
# 环境变量控制
export CLAUDE_CODE_COORDINATOR_MODE=1
```

`isCoordinatorMode()` 检查 `feature('COORDINATOR_MODE')` **和** `CLAUDE_CODE_COORDINATOR_MODE` 环境变量。两个都必须为真。

#### 运行：Worker 生命周期

```
1. AgentTool.call() 被调用
   │
2. 检查 Agent 类型 (built-in vs 自定义 vs fork)
   │
3. 如果是 fork subagent (FORK_SUBAGENT feature):
   ├── 继承父会话的完整对话上下文
   ├── 共享 prompt cache key
   └── 自动后台运行，统一 <task-notification> 交互模型
   │
4. 如果是 built-in agent (worker/general-purpose/...):
   ├── runAgent() → 调用 query() 在独立上下文中
   ├── 创建独立 FileStateCache
   ├── 初始化 Agent 专属 MCP 服务器
   ├── 加载 Skills、注册 Hooks
   └── 在 try/catch 中执行 query()，返回结果
   │
5. 如果是远程 agent (REMOTE_AGENT feature):
   └── 在 CCR 云端环境中启动，轮询结果
   │
6. 如果是 teammate (swarms):
   └── 生成 tmux pane 中的独立 Claude 进程
   │
7. 结果通过 <task-notification> XML 注入回协调器的消息流
```

#### 通信：SendMessage 工具

```typescript
// 继续一个 Worker（它保持会话上下文）
SendMessage({
  to: "agent-a1b",           // Worker 的 ID
  message: "Fix the null pointer in src/auth/validate.ts:42..."  // 新指令
})
```

Worker 结果通过 `<task-notification>` XML 回到协调器：
```xml
<task-notification>
  <task-id>agent-a1b</task-id>
  <status>completed</status>
  <summary>Agent "Investigate auth bug" completed</summary>
  <result>Found null pointer in src/auth/validate.ts:42...</result>
  <usage><total_tokens>N</total_tokens></usage>
</task-notification>
```

#### Fork 子代理（继承上下文）

`forkSubagent.ts` 的核心机制：

1. **提示缓存共享**: 所有 fork 子代理的 API 请求前缀字节完全一致
2. **占位符**: 所有 tool_result 块使用同一个占位符文本 `"Fork started — processing in background"`
3. **指令注入**: 只有最后的 text block 不同（每个子代理的唯一指令）
4. **递归防护**: `isInForkChild()` 检查 `FORK_BOILERPLATE_TAG` 在消息历史中

### 2.4 协调器系统提示（Coordinator System Prompt）

这是协调器模式的核心——一个 **~260 行的结构化系统提示**，定义了协调器的行为准则：

- **Section 1 - 角色定义**: 你是协调器，不是执行者
- **Section 2 - 可用工具**: AgentTool、SendMessage、TaskStop
- **Section 3 - Worker 能力**: Worker 可以访问哪些工具
- **Section 4 - 任务工作流**: Research → Synthesis → Implementation → Verification 四阶段
- **Section 5 - 编写 Worker Prompts 的规则**: 始终综合 (Always synthesize) 原则，Continue vs Spawn Fresh 选择表，Good/Bad 示例
- **Section 6 - 示例会话**: 完整的多轮协调示例

关键设计原则：
- **并行是超能力**: 独立 Worker 应并发启动
- **始终综合 (Always synthesize)**: 协调器必须阅读理解 Worker 的发现，然后编写具体的实施规范——不能偷懒说"基于你的发现，修复它"
- **Continue vs Spawn 决策**: 高上下文重叠 → Continue (保留 Worker 记忆)，低重叠 → Spawn Fresh (干净上下文)

### 2.5 Swarm / Team 管理

Claude Code 有一个更底层的 Swarm 系统（通过 `utils/swarm/`），用于管理 tmux pane 中的实际进程：

```typescript
// Team 文件格式
type TeamFile = {
  name: string
  leadAgentId: string
  members: Array<{
    agentId: string, name: string, color: string, prompt: string
    planModeRequired: boolean, joinedAt: number
  }>
}
```

Team 操作：
- `TeamCreateTool`: 创建 Team，生成 Leader pane
- `TeamDeleteTool`: 删除 Team，清理 pane 和 task 目录
- `SendMessageTool`: 向 Teammate 发送消息（支持结构化消息：shutdown_request、shutdown_response、plan_approval_response）

---

## 三、AttaSeek 实现

### 3.1 模块结构

```
coordinator/
  CoordinatorMode.ts   98 行   — Leader/Worker 任务分解与执行
  SwarmManager.ts     186 行   — Teammate 生命周期管理

subagent/
  SubAgentManager.ts  194 行   — 子代理 fork/cancel/list
  SubAgentContext.ts   50 行   — 上下文共享定义
  RecursionGuard.ts    45 行   — 嵌套防护
  WorktreeManager.ts   90 行   — Git worktree 隔离
  built-in/                      — 4 个内置子代理配置:
    explore-agent.ts   — 只读搜索代理
    plan-agent.ts      — 规划代理
    review-agent.ts    — 代码审查代理（5 维度）
    verify-agent.ts    — 对抗性验证代理
```

### 3.2 核心接口

#### CoordinatorMode

```typescript
interface Subtask {
  title: string
  goal: string
  profileId: string
  dependsOn?: number[]   // 依赖的子任务索引
}

interface CoordinatorResult {
  summary: string
  subtaskResults: SubAgentResult[]
  events: SessionEvent[]
}

class CoordinatorMode {
  // 分解目标为子任务（MVP: 返回单子任务）
  decompose(task: AgentTask, profile: AgentProfile): Promise<Subtask[]>

  // 执行所有子任务，尊重依赖关系
  execute(
    parentTask: AgentTask,
    subtasks: Subtask[],
    profiles: Map<string, AgentProfile>
  ): Promise<CoordinatorResult>
}
```

#### SwarmManager

```typescript
interface Teammate {
  id: string; name: string; teamName: string
  color: string; goal: string
  status: 'running' | 'completed' | 'error' | 'stopped'
}

class SwarmManager {
  spawnTeammate(teamName, name, goal, color?): Promise<Teammate>
  sendMessage(agentId, message): Promise<SendMessageResult | null>
  stopTeammate(agentId): boolean
  listTeam(teamName): Teammate[]
  listAll(): Teammate[]
}
```

#### SubAgentManager

```typescript
interface SubAgentResult {
  agentId: string; summary: string
  events: SessionEvent[]
  status: 'completed' | 'failed' | 'cancelled'
  errorMessage?: string
}

class SubAgentManager {
  fork(parentTask, profile, goal, context): Promise<SubAgentResult>
  cancel(agentId): void
  cancelAll(): void
  list(): SubAgentInfo[]
  get(agentId): SubAgentInfo | undefined
}
```

#### SubAgentContext

```typescript
interface SubAgentContext {
  sharedFileTree: FileNode[]       // 共享的项目文件树
  sharedMemories: MemoryEntry[]    // 共享的项目/全局记忆
  parentSummary: string            // 父任务摘要
  profileOverrides?: Partial<AgentProfile>
  isolation: 'inline' | 'worktree'
}
```

### 3.3 工作流程

#### 执行流程 (CoordinatorMode.execute)

```
1. 获取所有子任务
2. 找出所有"就绪"的子任务（所有依赖已完成）
3. 并行执行就绪的子任务:
   └── 每个子任务: subAgentManager.fork(parentTask, profile, goal, context)
4. 收集结果
5. 标记完成的子任务，回到步骤2
6. 所有子任务完成 → 返回汇总结果
```

#### 子代理执行流程 (SubAgentManager.fork)

```
1. recursionGuard.enter(profileId) → 检查递归深度
2. 如果 isolation='worktree' → 创建 git worktree
3. 创建 AgentTask
4. 创建独立的 QueryEngine (modelSlot='subagent')
5. 发射 SubagentStart 钩子
6. for await (event of engine.submitMessage(goal, task, profile)):
     收集 events
7. 清理: recursionGuard.exit(), worktree discard
8. 发射 SubagentStop 钩子
9. 返回 SubAgentResult
```

#### Swarm Teammate 流程 (SwarmManager.spawnTeammate)

```
1. 生成 agentId
2. 分配颜色
3. 创建 Teammate 记录 (status='running')
4. 创建一个临时 profile (内联 as any 构造)
5. subAgentManager.fork(parentTask, profile, goal, context)
   .then(result → 更新 Teammate 状态)
   .catch(err → 标记 error)
6. 返回 Teammate (不等待完成)
```

### 3.4 与 Query Loop 的集成

在 `query-loop.ts` 的 `runToolBatch()` 中：
```typescript
// Agent 工具调用通过 CoordinatorMode
const agentCalls = toolUses.filter(t => t.name === 'agent')
for (const agentCall of agentCalls) {
  const { coordinatorMode } = await import('../coordinator/CoordinatorMode')
  const subtasks = await coordinatorMode.decompose(task, profile)
  const result = await coordinatorMode.execute(task, subtasks, profiles)
  toolResults.push({ tool_use_id: agentCall.id, content: result.summary })
}
```

---

## 四、关键差异分析

### 4.1 设计哲学

| 维度 | Claude Code | AttaSeek |
|------|-------------|----------|
| 协调方式 | **Prompt-driven**: 协调器是一个带有详细系统提示的 LLM Agent | **Code-driven**: 协调器是一个 TypeScript 类，使用编程式任务分解 |
| 任务分解 | LLM 自主决定何时以及如何分派 Worker | MVP 阶段返回单子任务（未实现 LLM 分解） |
| Worker 通信 | 通过 `<task-notification>` XML 异步注入协调器的消息流 | 通过 SubAgentManager.fork() 同步等待结果 |
| Worker 继续 | SendMessage tool 向 Worker 发送后续指令 | 不支持；每个子任务是单轮 fork |
| 上下文继承 | Fork 子代理继承完整父会话上下文（prompt cache sharing） | 子代理接收 `sharedFileTree` + `sharedMemories` + `parentSummary` |

### 4.2 功能覆盖

| 功能 | Claude Code | AttaSeek |
|------|:----------:|:--------:|
| 任务分解 (Decompose) | ✅ LLM-driven | ❌ MVP 单子任务 |
| 并行 Worker 执行 | ✅ 完整 | ✅ Promise.all() |
| 依赖排序 | ❌ 无（协调器手动管理） | ✅ `dependsOn` 数组 |
| Worker 继续 (Continue) | ✅ SendMessage | ❌ |
| Worker 停止 (Stop) | ✅ TaskStop tool | ✅ SwarmManager.stopTeammate |
| Team 管理 | ✅ TeamCreate/Delete | ✅ SwarmManager |
| 提示缓存共享 | ✅ Fork subagent | ❌ |
| Worktree 隔离 | ✅ worktree isolation | ✅ worktree isolation |
| 远程执行 | ✅ Remote agent (CCR) | ❌ |
| 递归防护 | ✅ `isInForkChild()` | ✅ `RecursionGuard` (maxDepth=1) |
| 钩子集成 | ✅ SubagentStart/Stop hooks | ✅ SubagentStart/Stop hooks |
| 多代理消息 | ✅ SendMessage (结构化) | ✅ SwarmManager.sendMessage (基本) |
| Worker 颜色 | ✅ AgentColorManager | ✅ 8色轮换 |
| Worker 后台运行 | ✅ background + task notification | ❌ (SwarmManager fire-and-forget) |

### 4.3 代码架构对比

| 方面 | Claude Code | AttaSeek |
|------|-------------|----------|
| 核心实现 | 369 行（prompt 占 260 行） | 98 行 + 186 行 = 284 行 |
| 系统提示 | ~260 行详细行为准则 | 无（在 profile.systemPrompt 中） |
| Worker 执行 | `runAgent.ts` (~500 行), `LocalAgentTask.tsx` (682 行) | `SubAgentManager.fork()` (194 行) |
| 进程管理 | Swarm 通过 tmux 管理外部进程 | 全部内联（同一 Electron 进程） |
| 可扩展性 | 自定义 Agent 从文件系统加载 (`loadAgentsDir.ts`) | 内置 profile + 配置化 profile |
| UI 集成 | React/Ink 组件渲染 Worker 进度 | Electron 窗口，通过 SessionEvent 通信 |

---

## 五、AttaSeek 协调器模式的改进路径

基于与 Claude Code 的差异分析，以下是 AttaSeek CoordiantorMode 的改进方向（按优先级排列）：

### P0 — 核心缺失
1. **LLM 驱动的任务分解**: 实现 `decompose()` 通过 LLM 调用将复杂目标分解为子任务列表（而非 MVP 的单个子任务）
2. **Worker 通信协议**: 实现类似 `<task-notification>` 的 Worker 通信机制，使协调器能看到 Worker 的中间结果

### P1 — 增强功能
3. **Worker 继续 (Continue)**: 实现一个 `SendMessage` 等效功能，允许协调器向已完成但保留上下文的 Worker 发送后续指令
4. **Fork 子代理（上下文继承）**: 在 `SubAgentManager` 中实现 `forkSubagent` 模式，继承父会话的提示缓存（当前每个子代理使用独立 QueryEngine）
5. **后台异步 Worker**: 实现 `run_in_background` 机制，Worker 异步运行并在完成时通过通知返回结果

### P2 — 完善体验
6. **协调器系统提示**: 将 Claude Code 的行为准则转化为 AttaSeek 的 `AgentProfile` 格式，包含 Always synthesize、Continue vs Spawn 等原则
7. **结构化消息**: 在 `SwarmManager.sendMessage` 中支持结构化消息（如 plan_approval、shutdown_request）
8. **Worker 权限模式隔离**: 允许协调器为不同 Worker 设置不同的权限模式（plan mode for implementation workers）
