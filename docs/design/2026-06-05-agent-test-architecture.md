# Agent 测试体系 架构设计

**日期：** 2026-06-05
**基于需求：** `docs/reqs/2026-06-05-agent-test-system.md`

---

## 组件结构

```
test/agent/
├── mock/                              [新建]
│   ├── MockLLMProvider.ts             # FIFO 队列模拟器，实现 LLMProvider
│   ├── MockPermissionBridge.ts        # 权限决策注入模拟
│   └── helpers.ts                     # 流事件构建辅助函数
│
├── scenarios/                         [新建]
│   ├── runner.ts                      # 场景 JSON 加载器 + 执行器
│   ├── assertions.ts                  # 断言辅助（事件匹配、状态验证）
│   ├── setup.ts                       # 临时目录 + 文件 + profile 初始化
│   │
│   ├── basic/                         # 基础路径场景
│   │   ├── 01-plain-text.json         # 纯文本回复，无工具调用
│   │   ├── 02-single-tool.json        # 单工具调用往返
│   │   ├── 03-multi-tool.json         # 多工具并行调用
│   │   ├── 04-no-provider.json        # 无 LLM provider 错误
│   │   └── 05-interrupt.json          # 用户中断取消
│   │
│   ├── permission/                    # 权限路径场景
│   │   ├── 01-deny.json               # deny → 终止
│   │   ├── 02-ask-approve.json        # ask → 用户批准 → 继续
│   │   └── 03-ask-deny.json           # ask → 用户拒绝 → 终止
│   │
│   ├── loop/                          # 多轮循环场景
│   │   ├── 01-three-turn.json         # 3 轮工具循环
│   │   └── 02-max-turns.json          # 达到 maxTurns 终止
│   │
│   ├── compact/                       # 上下文压缩场景
│   │   └── 01-auto-compact.json       # 消息超 85% → 自动压缩
│   │
│   └── subagent/                      # 子 Agent 场景
│       └── 01-fork-review.json        # fork review 子 Agent → 完成
│
├── integration/                       [新建]
│   ├── runner.ts                      # 集成测试运行器（真实 LLM）
│   ├── tasks/                         # 集成测试任务
│   │   ├── 01-find-fix-bug.ts        # 代码探索 + 修复
│   │   ├── 02-generate-readme.ts     # 文档生成
│   │   └── 03-extract-shared.ts      # 多步骤重构
│   └── setup.ts                       # 真实 LLM provider 初始化
│
└── fixtures/                          [新建]
    ├── projects/                      # 测试用迷你项目
    │   ├── bug-project/               # 含 bug 的 TypeScript 项目
    │   │   ├── src/bug.ts
    │   │   └── package.json
    │   └── dup-project/               # 含重复代码的项目
    │       ├── src/a.ts
    │       ├── src/b.ts
    │       └── src/c.ts
    └── profiles/                      # 测试用 profile 覆盖
        └── test-profile.ts            # 最小 profile 用于快速测试
```

### 模块职责

| 模块 | 状态 | 职责 |
|------|------|------|
| `mock/MockLLMProvider` | 新建 | 实现 `LLMProvider` 接口。内部维护 FIFO 队列 `turns: LLMChunk[][]`，每个 `chatStream()` 调用消费队首 turn 的 chunks 序列。支持 push `text_delta`、`tool_use_start`、`tool_use_delta`、`content_block_stop`、`message_stop`、`error` 响应。记录所有请求参数供断言使用。 |
| `mock/MockPermissionBridge` | 新建 | 注入权限决策到 `ToolExecutor`。提供 `setDecision(decision)` 预设对下一个权限请求的响应。模拟 `awaitPermission()` 立即返回预设值（不等待 UI）。 |
| `mock/helpers` | 新建 | 流事件构建函数：`textDelta(text)`, `toolUseStart(id, name)`, `toolUseDelta(id, json)`, `blockStop(index)`, `messageStop()`, `endTurn(content, usage)`. 返回 `LLMChunk` 和 `LLMChatResult`。 |
| `scenarios/runner` | 新建 | 读取 JSON 场景文件，构建 `MockLLMProvider` + `AgentProfile` + `AgentTask`，执行 `AgentOrchestrator.submitMessage()`，收集所有 yield 事件，调用断言函数验证。 |
| `scenarios/assertions` | 新建 | 断言函数：`assertTerminalReason(events, expected)`, `assertEventSequence(events, [...types])`, `assertToolCallCount(events, n)`, `assertFinalTextContains(events, substr)`, `assertEventNotContain(events, type)`. |
| `scenarios/setup` | 新建 | 创建临时目录、写入 guest 文件、初始化 `ToolRegistry`、加载 profile。每个场景运行前后自动清理。 |
| `integration/runner` | 新建 | 从环境变量读取 API key，创建真实 `LLMProvider`，执行 `AgentOrchestrator`，验证结果。 |
| `integration/tasks/*` | 新建 | 每个任务定义一个 `runIntegrationTask()` 函数：设置临时项目 → 构建 prompt → 执行 Agent → 验证。 |
| `fixtures/*` | 新建 | 静态测试数据：迷你项目（含 bug、含重复代码）+ 测试用 profile。 |

---

## 数据流

### Mock 场景测试

```
场景 JSON 文件
    │  { name, config, guestFiles, turns: [...] }
    ▼
runner.ts 解析 JSON
    │
    ├─ setup.ts 创建临时目录 + 写入 guestFiles + 加载 profile
    ├─ helpers.ts 构建 LLMChunk[][] 从 turns[].mockResponses
    ├─ MockLLMProvider 注入 chunks
    ├─ MockPermissionBridge 注入 decisions
    ├─ AgentOrchestrator.submitMessage(task, profile)
    │       │
    │       ▼  AsyncGenerator<SessionEvent>
    │  收集所有事件
    │       │
    │       ▼
    └─ assertions.ts 逐条验证
           ├─ assertTerminalReason(generator return)
           ├─ assertEventSequence(events, expected)
           ├─ assertToolCallCount(events, n)
           ├─ assertToolResultText(events, expected)
           └─ assertMessageHistory(state.messages, expected)
    │
    ▼
vitest 报告: ✅ / ❌
```

### LLM 集成测试

```
环境变量 ATTASEEK_API_KEY
    │
    ▼
integration/runner.ts
    │
    ├─ integration/setup.ts 创建真实 AnthropicProvider
    ├─ integration/tasks/01-find-fix-bug.ts
    │       ├─ 临时目录: fixtures/projects/bug-project
    │       ├─ Profile: coding-profile
    │       ├─ Prompt: "find and fix the bug..."
    │       ├─ AgentOrchestrator.submitMessage()
    │       │       ▼
    │       │   真实 LLM API 调用 (消耗 token)
    │       │       ▼
    │       └─ 验证: ≥1 read_file 调用, 输出含修复代码, terminal=completed
    │
    └─ 结果报告
```

### 场景 JSON 格式

```json
{
  "name": "single-tool-read-file",
  "description": "Agent reads a file and reports the content",
  "profile": "coding",
  "guestFiles": { "hello.txt": "Hello World" },
  "turns": [
    {
      "userMessage": "Read hello.txt and tell me what it says",
      "mockResponses": [
        [
          { "type": "text_delta", "text": "Let me read the file." },
          { "type": "tool_use_start", "id": "tu_1", "name": "read_file" },
          { "type": "tool_use_delta", "id": "tu_1", "input_json": "{\"path\":\"hello.txt\"}" },
          { "type": "content_block_stop", "index": 1 },
          { "type": "message_stop" }
        ],
        [
          { "type": "text_delta", "text": "The file says: Hello World" },
          { "type": "message_stop" }
        ]
      ],
      "assert": {
        "terminalReason": "completed",
        "toolCalls": 1,
        "toolsUsed": ["read_file"],
        "finalTextContains": "Hello World",
        "eventsContain": ["ToolCallStarted", "ToolCallFinished", "TaskCompleted"],
        "eventsNotContain": ["TaskFailed"]
      }
    }
  ]
}
```

---

## 技术决策

| 决策 | 选择 | 理由 | 替代方案 |
|------|------|------|---------|
| Mock 注入层级 | `LLMProvider` 接口层 | AttaCode 的 `MockAnthropicClient` 在同层注入。TypeScript 的接口比 Rust trait 更轻量，无需依赖注入容器，直接传参即可。`AgentOrchestrator` 的 `submitMessage` 已接受 `profile`，只需额外支持 `provider` 参数覆盖。 | 在 HTTP 层 mock（需启动本地服务器，太重）；在 AgentOrchestrator 内部 mock（侵入性强） |
| 场景格式 | JSON 文件 | AttaCode 89 场景用 JSON，已验证可维护。JSON 允许非开发人员（QA）编写场景。每个场景独立文件，git diff 友好。 | YAML（不如 JSON 在 JS 生态中自然）；TypeScript 文件（需要编译，不如 JSON 即插即用） |
| 工具执行策略 | 真实执行 | AttaCode 同样真实执行工具。能验证工具结果内容是否正确注入消息历史、权限检查是否生效。工具本身轻量（文件读写），执行速度快。 | 全部 mock（无法验证工具交互正确性） |
| 权限模拟方式 | `MockPermissionBridge` 独立类 | 当前 `ToolExecutor` 直接依赖 `PermissionService` + `PermissionBridge` 单例。mock 方案：提供 `MockPermissionBridge.setDecision()` 注入，不修改生产代码。 | 修改 `ToolExecutor` 添加依赖注入（改动生产代码、风险高） |
| 场景文件路径 | `test/agent/scenarios/` | 与 AttaCode 的 `tests/scenarios/` 对齐。按子目录分类（basic/permission/loop/compact/subagent），便于按类别运行。 | 扁平目录（难以选择性运行） |
| 集成测试 API key | 环境变量 `ATTASEEK_API_KEY` | 标准 12-factor 模式。不与代码耦合，CI 中不设置即自动跳过。 | 配置文件（可能被误提交到 git） |
| 集成测试运行 | 仅本地手动 `npm run test:agent:live` | 避免 CI 中消耗 API 费用。开发者提交前本地运行验证。 | CI 中运行（成本不可控） |
| 流事件构建 | 工厂函数而非 JSON 枚举 | `textDelta()` / `toolUseStart()` 等 helper 保证 `LLMChunk` 类型正确，IDE 补全友好。场景 JSON 中用字符串标签引用这些 helper。 | 纯 JSON 手写 chunk 对象（易出错、无类型检查） |

---

## 关键接口（类型签名）

### MockLLMProvider

```typescript
interface MockLLMProvider extends LLMProvider {
  // 预编程: 每个 turn 是一个 LLMChunk[] 序列
  pushTurn(chunks: LLMChunk[]): void
  
  // 预设完整 turn（chunks + final result）
  pushFullTurn(chunks: LLMChunk[], result: LLMChatResult): void
  
  // 预设错误
  pushError(error: LLMError): void
  
  // 断言辅助
  nthRequest(n: number): LLMChatParams | undefined
  requestCount: number
}
```

### 场景类型

```typescript
interface ScenarioFile {
  name: string
  description?: string
  profile: 'coding' | 'research' | 'writing' | 'default'
  guestFiles?: Record<string, string>
  turns: ScenarioTurn[]
}

interface ScenarioTurn {
  userMessage: string
  mockResponses: LLMChunk[][]   // 每个内层数组 = 一个 LLM turn 的 chunks
  assert: ScenarioAssert
}

interface ScenarioAssert {
  terminalReason?: string
  toolCalls?: number
  toolsUsed?: string[]
  finalTextContains?: string
  eventsContain?: string[]
  eventsNotContain?: string[]
  messageCount?: number
}
```

### 流事件构建 helpers

```typescript
// 构建 LLMChunk
function textDelta(text: string): LLMChunk
function toolUseStart(id: string, name: string): LLMChunk
function toolUseDelta(id: string, json: string): LLMChunk
function blockStop(index: number): LLMChunk
function messageStop(): LLMChunk

// 构建 LLMChatResult
function endTurnResult(content: string, usage: TokenUsage): LLMChatResult
function toolUseResult(tools: ToolUseBlock[], usage: TokenUsage): LLMChatResult
```
