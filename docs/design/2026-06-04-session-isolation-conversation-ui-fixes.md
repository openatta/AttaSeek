# Session 隔离 + Conversation UI + 测试修复 架构设计

> **日期：** 2026-06-04
> **问题来源：** Chat/Projects 共享状态、连通性测试、Tool name 错误、IM 风格 UI

---

## 1. Session 隔离 — Chat / Projects 独立实例

### 现状

`currentSessionIdAtom` 是单一值 `'session_default'`。切换 Activity 时，Chat 和 Projects 共享同一个 session——消息混在一起。

### 设计

每个 Activity 绑定独立的 session ID。利用已有的 `sessionAtom` 结构，将 `currentSessionIdAtom` 从单一值改为 **per-activity session 映射**。

```
用户行为:
  切换到 Chat → ChatWorkspace 渲染 → Conversation 使用 sessionId = "chat_session"
  切换到 Projects → ProjectsWorkspace 渲染 → Conversation 使用 sessionId = "projects_session"
  切回 Chat → 恢复 chat_session 的消息历史（从 AgentEventBus 回放）
```

**实现方式**：

```
sessionAtom.ts:
  currentSessionIdAtom   → 改为派生 atom: 从 activityAtom 推导 session ID
  activitySessionMap      → { chat: "sid_xxx", projects: "sid_yyy", ... }
  
  新增:
  - ensureSession(activity: string): string   // 不存在则创建
  - sessionEventsAtom 不变（已是全局 events 数组 + filter by sessionId）
  - agentTasksAtom 不变（filter by sessionId 即可）

Shell.tsx:
  → 移除 WorkspaceRouter 内部直接渲染 Conversation
  → AgentPane 固定渲染 Conversation，传 sessionId
  → Session ID 由 currentSessionIdAtom 自动推导

ChatWorkspace / ProjectsWorkspace:
  → 不再自己渲染 Conversation，改为渲染各自的面板内容（Chat 无额外内容，Projects 有项目面板）
  → Shell 的 AppSpace.agentPane 始终是 Conversation
```

**组件树变更**：

```
当前:
  Shell → AppSpace → WorkspaceRouter → ChatWorkspace/ProjectsWorkspace
          每个 Workspace 各自包含 Conversation

目标:
  Shell → AppSpace → AgentPane(Conversation, sessionId=derived)
                    → ArtifactPane
  WorkspaceRouter 降级：只渲染 Sidebar 对应的内容区（若有），不渲染 Conversation
```

### 涉及文件

| 文件 | 改动 |
|---|---|
| `sessionAtom.ts` | currentSessionIdAtom 改为 derived（per-activity），新增 ensureSession |
| `Shell.tsx` | AgentPane 固定渲染 Conversation，传入 sessionId |
| `ChatWorkspace.tsx` | 移走 Conversation，可能变成空壳或仅渲染特定面板 |
| `ProjectsWorkspace.tsx` | 同上 |
| `WorkspaceRouter.tsx` | 不再渲染 Conversation |

---

## 2. 连通性测试修复

### 现状问题

用户反馈"仍然连接通就是通"——三步检测中 API 调用验证未生效。

### 根因分析

`doApiCheck()` 调用 `provider.validateKey(apiKey)`。对于 AnthropicProvider，`validateKey` 发最小请求 `{ model: 'claude-haiku-4-5-20251001', max_tokens: 1, messages: [{role:'user', content:'ping'}] }`。

但当前 config 的 `models: []`（schema 迁移后为默认空数组），`defaultModel: ''` 或已是旧值。当 Anthropic API 收到不存在的模型名时，返回 404。`validateKey` 的 catch 将 404 当作失败→返回 false→`doApiCheck` 返回 `{ success: false, ... }`→最终 test 返回失败。

但用户看到的是"connected"——说明**前端展示未正确读取 test 结果**。

### 设计修复

**后端**（ModelConfigService.test）——已经是三步，不需改逻辑，只需确保错误码传递：

```
Step 1: checkNetwork() → { ok: bool, error?: string }
  fail → { success:false, errorCode:'network_unreachable' }
  
Step 2: getApiKey() → null → { success:false, errorCode:'auth_failed', error:'No API key...' }

Step 3: doApiCheck() → provider.validateKey()
  fail → { success:false, errorCode:'auth_failed'|'model_not_found', error: detailed message }
  success → { success:true, latencyMs, model }
```

**前端**（ModelSettings.tsx ModelCard）——测试结果显示：

```
[Test Connection]  ← 按钮文字

结果:
  ✓ Connected · 230ms                                     ← 成功
  ✗ Network unreachable — check endpoint URL              ← 网络不通
  ✗ Auth failed — API key invalid or expired   [Details]  ← API 调用失败
  ✗ Model not found — check model name          [Details]  ← 模型错误
```

`[Details]` 按钮展开显示完整 API 错误响应（截断到 500 字符）。

### 涉及文件

| 文件 | 改动 |
|---|---|
| `ModelConfigService.ts` | 不改（三步已正确） |
| `ModelSettings.tsx` | 测试结果展示改为文字行 + Details 展开 |
| `ModelConfigForm.tsx` | 测试结果展示同样改为文字行 + Details |

---

## 3. Tool Name Sanitize + 错误 Details

### 问题

Tool name 含空格（`"Read File"`），违反 Anthropic API `^[a-zA-Z0-9_-]+$` 规则。调用 API 时报 400。

### 设计

在将 tool manifest 转为 LLM tool definition 时做 sanitize：**用 `id` 替代 `name`** 作为 tool name。`id` 已是 snake_case。

```
demo-tools.ts:
  id: 'read_file',   name: 'Read File'
  id: 'search_code', name: 'Search Code'
  id: 'create_document', name: 'Create Document'
  ...

转为 LLMToolDef 时:
  { name: tool.id, description: tool.description, input_schema: tool.inputSchema }
  而不是:
  { name: tool.name, description: tool.description, input_schema: tool.inputSchema }
```

**改动点**：ContextBuilder.ts 中 tools 转换：

```diff
- name: t.name,
+ name: t.id,  // 使用 snake_case id 而非人类可读 name
```

同时更新 ToolExecutor 中通过 tool name 查找 tool 的逻辑——统一用 `id`。

### 错误 Details 展开组件

新增 `ErrorDetails` 小组件：

```
Connection failed  [Details ▾]
  ┌─────────────────────────────────────┐
  │ Error 400                            │
  │ {"error":{"message":"Invalid..."}}   │
  └─────────────────────────────────────┘
```

用于 ModelSettings 测试结果展示和 NoModelPrompt 附近的错误信息。

### 涉及文件

| 文件 | 改动 |
|---|---|
| `ContextBuilder.ts` | tool LLM def 用 `tool.id` 替代 `tool.name` |
| `ToolExecutor.ts` | 按 `toolId`(即 tool.id) 查找 |
| `OpenAICompatibleProvider.ts` | `buildRequestBody` 中 tools 的 name 用传入的值 |
| `ModelSettings.tsx` | 错误 Details 展开 |
| `ErrorDetails.tsx` [新] | 可折叠错误详情组件 |

---

## 4. ChatGPT 风格 Conversation UI

### 现状 vs 目标

```
当前 (IM 风格):
┌──────────────────────────────────────┐
│              用户消息气泡 (右对齐)    │
│    AI消息气泡 (左对齐)               │
│              用户消息气泡 (右对齐)    │
└──────────────────────────────────────┘

目标 (ChatGPT 风格):
┌──────────────────────────────────────┐
│ 👤 You                                │
│ 用户消息文本 (左对齐，无气泡)         │
│                                       │
│ 🤖 AttaSeek                           │
│ AI 消息文本 (左对齐，无气泡)          │
│                                       │
│ 👤 You                                │
│ 用户消息文本                          │
└──────────────────────────────────────┘
```

### 组件设计

每个事件渲染器从"气泡卡片"改为"带标识的文本块"：

**UserMessageEvent**：
```
<div>
  <div>👤 You</div>              ← 用户标识行
  <div>{payload.content}</div>   ← 消息正文，纯文本
</div>
```

**AgentMessageEvent**：
```
<div>
  <div>🤖 AttaSeek</div>         ← AI 标识行
  <div>{displayContent}</div>    ← 消息正文 + streaming 光标
</div>
```

**ToolCallStartedEvent**：
```
<div>
  <div>🔧 Tool: {toolName}</div>  ← 工具标识行
  <div>Running...</div>
</div>
```

**PlanCreatedEvent** / **ArtifactCreatedEvent** / **TaskCompletedEvent** / **TaskFailedEvent** / **PermissionRequestedEvent**：
```
各自保留卡片样式，但去掉左/右浮动对齐，统一左对齐
```

### MessageFlow 容器

```
<div>                              ← 去掉 max-w-3xl 居中限制
  {events.map(event => (
    <EventCard />                  ← 每个事件独立块，上下间距
  ))}
</div>
```

移除非事件的 "AttaSeek Agent Workbench" 欢迎页（空状态只显示提示文字即可）。

### 涉及文件

| 文件 | 改动 |
|---|---|
| `UserMessageEvent.tsx` | 去气泡，改为标识行 + 文本 |
| `AgentMessageEvent.tsx` | 去气泡，改为标识行 + 文本 + streaming 光标 |
| `ToolCallStartedEvent.tsx` | 去气泡/动画，改为标识行 |
| `ToolCallFinishedEvent.tsx` | 同上 |
| `PlanCreatedEvent.tsx` | 去气泡 |
| `ArtifactCreatedEvent.tsx` | 改为 InlineArtifactPreview（已是） |
| `TaskCompletedEvent.tsx` | 去气泡 |
| `TaskFailedEvent.tsx` | 用 ErrorCard（已是） |
| `PermissionRequestedEvent.tsx` | 保留卡片（权限确认需要突出） |
| `MessageFlow.tsx` | 去 max-w-3xl + 改欢迎页 |

---

## 5. 实现顺序

```
Phase 1: 紧急修复（阻塞用户使用）
  P1.1: Tool name sanitize (ContextBuilder.ts + 相关)
  P1.2: 连通性测试结果展示 (ModelSettings.tsx + ErrorDetails.tsx)

Phase 2: Conversation UI 风格
  P2.1: 9 个 event renderer 组件改为 ChatGPT 风格
  P2.2: MessageFlow 容器调整

Phase 3: Session 隔离
  P3.1: currentSessionIdAtom 改为 per-activity derived
  P3.2: Shell AgentPane 固定渲染 Conversation
  P3.3: Workspace 组件清理
```

---

## 简报

**4 个问题，3 个 Phase，约 15 个文件改动**：

| 问题 | 方案 | 关键改动 |
|---|---|---|
| Session 隔离 | `currentSessionIdAtom` 从单一值→per-activity derived atom，自动根据当前 Activity 切换 session | `sessionAtom.ts`, `Shell.tsx`, Workspace 清理 |
| 连通性测试 | 三步检测已正确，修复前端展示：结果文字行+ErrorDetails 折叠 | `ModelSettings.tsx`, `ErrorDetails.tsx` [新] |
| Tool name 400 错误 | `tool.id`(snake_case) 替代 `tool.name`(含空格) 传给 LLM | `ContextBuilder.ts` |
| ChatGPT 风格 UI | 9 个 event renderer 去气泡→左对齐标识行+纯文本 | `events/*.tsx`, `MessageFlow.tsx` |
