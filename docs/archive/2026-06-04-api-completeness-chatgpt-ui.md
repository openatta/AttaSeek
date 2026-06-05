# API 完备性 + ChatGPT UI 架构设计

> **日期：** 2026-06-04

---

## 一、组件结构

```
src/main/agent/
  LLMProvider.ts          [改] AnthropicProvider: temperature/topP/topK/toolChoice/stopSequences/thinking, 结构化错误
  AgentLoop.ts            [改] 停止支持(AbortController)/token统计(accumulate usage)/LLMProviderConfig传递

src/main/model/
  OpenAICompatibleProvider.ts [改] temperature/topP/freqPenalty/presencePenalty/responseFormat/toolChoice/stop, 结构化错误, SSE断流恢复

src/renderer/components/Conversation/
  MessageFlow.tsx         [改] 滚动底部按钮, Markdown渲染, 停止生成接入
  events/
    AgentMessageEvent.tsx [改] Markdown渲染 + 代码块Copy + 思考过程折叠
    UserMessageEvent.tsx  [改] Edit → 回填Composer
  Composer.tsx            [改] 停止按钮(■)接入 + Edit回填接收
  MarkdownRenderer.tsx    [新] Conversation内Markdown渲染(低重量级,不同于Artifact renderer)
  ThinkingCard.tsx        [新] 推理过程折叠卡片

src/renderer/atoms/
  composerAtom.ts         [改] 增加 editTextAtom(编辑模式文本)
  sessionAtom.ts          [改] 增加 lastUserMessageAtom(最后用户消息,用于regenerate)

package.json              [改] 增加 react-markdown, remark-gfm
```

---

## 二、API 完备性设计

### 2.1 LLMProviderConfig（新增）

```
interface LLMProviderConfig {
  temperature?: number
  topP?: number
  maxTokens?: number
  toolChoice?: 'auto' | 'any' | 'tool' | 'none'
  stopSequences?: string[]
  thinkingBudget?: number       // Anthropic only: extended thinking tokens
  responseFormat?: 'text' | 'json_object'  // OpenAI only
  frequencyPenalty?: number     // OpenAI only
  presencePenalty?: number      // OpenAI only
  topK?: number                 // Anthropic only
}
```

此配置从 `ModelConfig.extraParams` 深度提取（不覆盖 `model`/`messages`/`stream` 内部字段），由 `AgentLoop` 传 `LLMProviderConfig` 给 provider 的 `chat/chatStream`。

### 2.2 AnthropicProvider 改造

从 extraParams 提纯到请求顶层字段：
- `temperature` → `messages.create.temperature`
- `top_p` → `messages.create.top_p`  
- `top_k` → `messages.create.top_k`
- `stop_sequences` → `messages.create.stop_sequences`
- `tool_choice` → `messages.create.tool_choice: { type: 'auto'|'any'|'tool' }`
- `thinking` → `messages.create.thinking: { type: 'enabled', budget_tokens: N }`（仅 Opus，非 Opus 模型忽略）

错误处理：解析 `AnthropicError.error.type`（如 `authentication_error`/`invalid_request_error`/`not_found_error`）→ `LLMError` 结构化错误。

### 2.3 OpenAICompatibleProvider 改造

从 extraParams 提纯到请求 body 顶层：
- `temperature/top_p/frequency_penalty/presence_penalty` → body 顶层
- `tool_choice` → body.tool_choice: `'auto'|'none'|'required'` 或 `{ type: 'function', function: { name } }`
- `stop` → body.stop
- `response_format` → body.response_format: `{ type: 'json_object' }`
- extraParams 深度 merge 防护：只 spread `{...safe, ...extraParams}`，但排除 `model/messages/tools/stream/max_tokens` 五个内部键

SSE 断流恢复：`fetchWithTimeout` 增加 AbortController + 30s timeout → `AbortError` → 重试 1 次。

错误处理：解析 `{ error: { type, code, message } }` → `LLMError`。

### 2.4 结构化错误（LLMError）

```
class LLMError extends Error {
  code: 'auth' | 'rate_limit' | 'invalid_request' | 'not_found' | 'server' | 'timeout' | 'unknown'
  statusCode?: number
  rawResponse?: string
}
```

`AgentLoop` 根据 `LLMError.code` 决定是否重试：`auth`/`invalid_request` → 不重试直接 fail，`rate_limit`/`server`/`timeout` → 指数退避重试（最多 2 次）。

### 2.5 Token 统计

`AgentLoop` 已接收 `LLMChatResult.usage`（包含 `inputTokens`/`outputTokens`），当前写死 0。改为累计所有轮次的 usage，任务完成后写入 `ModelUsageTracker.record()`。

---

## 三、ChatGPT UI 对齐设计

### 3.1 Markdown 渲染

`AgentMessageEvent` 当前纯 `<p>{content}</p>`。改为 `react-markdown` 组件渲染：

```
<ReactMarkdown remarkPlugins={[remarkGfm]} components={{
  code: CodeBlock,      // 自定义：深色背景 + 语法高亮 + 右上角 Copy
  table: TableBlock,    // 带边框
  a: LinkBlock,         // 新窗口打开
}}>
  {displayContent}
</ReactMarkdown>
```

`CodeBlock` 组件：
- 检测 `language-xxx` → 显示语言标签左上角
- 深色背景 `bg-[#1e1e1e]` 圆角
- 右上角 Copy 按钮
- MVP 语法高亮用简单正则（关键字/字符串/注释着色），后续可换 Prism

### 3.2 停止生成按钮

当前 Composer 的 ■ 按钮只做 `setIsRunning(false)`（本地状态）。改为：
```
Composer.handleStop()
  → window.api.agent.cancelTask(currentTaskId)
  → IPC agent:cancel-task
  → AgentRuntime.cancelTask()
  → AgentLoop.cancel()
  → abortController.abort()
  → LLM stream 被中断
  → AgentLoop 状态机 → cancelled → TaskFailed(recoverable:false)
```

需要在 `sessionAtom` 中跟踪 `currentTaskId`。

### 3.3 滚动到底部按钮

`MessageFlow` 容器监听 `scrollTop < scrollHeight - clientHeight - 100` → 显示 ↓ 浮动按钮（fixed, bottom-20, right-10）。点击 → `scrollTo({ top: scrollHeight, behavior: 'smooth' })`。流式输出中自动跟随底部，用户手动上滑后停止跟随。

### 3.4 编辑已发消息

UserMessageEvent 的 Edit 按钮点击：
1. 把当前消息文本写入 `composerAtom.editText`
2. Composer 检测 `editText !== null` → 文本区回填 + 光标聚焦
3. 清空当前 session 中该消息及之后的所有 events（regenerate）
4. 用户修改后发送 → 正常流程

### 3.5 推理过程展示

Anthropic extended thinking 返回 `reasoning` 内容。`AgentMessageEvent` 检测 `payload.reasoning` → 渲染 `ThinkingCard`：
```
[Thought ▾]                     ← 可折叠
  推理过程文本（灰色，等宽）
```

---

## 四、数据流

```
用户输入 → Composer.handleSend()
  → hasModelConfigured? no → SystemNotification
  → yes → window.api.agent.createTask(goal, sessionId, projectId, modelConfigId, modelName)
  → IPC → AgentRuntime.createTask() → store currentTaskId
  → AgentLoop.run(task) ← task.modelConfigId/task.modelName
    → LLMProviderRegistry.getById(configId) → provider
    → 从 ModelConfig.extraParams 提取 LLMProviderConfig
    → provider.chatStream(params + LLMProviderConfig, onChunk)

onChunk:
  text_delta → AgentMessageChunk event → streamingBuffersAtom → react-markdown 增量渲染
  reasoning   → AgentMessageChunk.payload.reasoning → ThinkingCard

tool_use → ToolExecutor(含 PermissionService + AuditService)

停止: Composer.■ → cancelTask(taskId) → abortController.abort() → stream中断

完成: AgentLoop 累计 usage.inputTokens/outputTokens → ModelUsageTracker.record()
```

---

## 五、技术决策

| 决策 | 方案 | 理由 |
|---|---|---|
| Markdown 渲染 | react-markdown + remark-gfm | 轻量、可定制组件、安全（不 dangerouslySetInnerHTML） |
| 代码高亮 | 自定义 CodeBlock（正则着色） | MVP 免依赖，后续可换 Prism |
| extraParams 防护 | Whitelist 过滤（排除 model/messages/tools/stream/max_tokens） | 防用户误填覆盖内部字段 |
| SSE 断流恢复 | AbortController + 30s timeout → 重试 1 次 | 简单可靠 |
| 停止生成 | AbortController.abort() → agent:cancel-task IPC | 复用已有 cancel 机制 |
| 编辑消息 | 消息回填 Composer + 清空后续 events | 简单，无需后端改动 |
| Token 统计 | AgentLoop 累计 usage → ModelUsageTracker.record() | 已有基础设施 |

## 六、实现顺序

```
Phase 1: API 完备性 (后端改动，不影响 UI)
  P1.1: LLMProviderConfig 类型 + AnthropicProvider 改造 (temperature/topP/topK/toolChoice/stop/thinking/错误)
  P1.2: OpenAICompatibleProvider 改造 (temperature/topP/toolChoice/stop/responseFormat/错误/SSE恢复)
  P1.3: AgentLoop 接入 LLMProviderConfig + token 累计 + 停止支持

Phase 2: ChatGPT UI 核心 (P0)
  P2.1: 安装 react-markdown + remark-gfm
  P2.2: MarkdownRenderer 组件 (Markdown + CodeBlock + 覆盖组件)
  P2.3: AgentMessageEvent 集成 MarkdownRenderer
  P2.4: 停止生成按钮接线
  P2.5: 滚动到底部 ↓ 按钮

Phase 3: ChatGPT UI 补充 (P1)
  P3.1: 编辑已发消息 (Edit → Composer 回填)
  P3.2: 推理过程折叠 (ThinkingCard)
```

## 简报

两个大方向：API 层补齐 Anthropic/OpenAI 参数字段（temperature/toolChoice/stop/thinking/结构化错误）；UI 层对齐 ChatGPT（react-markdown 渲染、代码高亮+Copy、停止按钮、滚动底部、编辑消息、推理折叠）。12 个 task，3 个 Phase。
