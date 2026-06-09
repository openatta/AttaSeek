# Bug Fix 简报 — Agent 核心修复

> 基于 `docs/analysis/claude-agent-comparison-2025-06-08.md` 的对比分析，对三个高优问题 + 整合双通路做深入诊断。

---

## 问题 1: QueryEngine.mutableMessages 状态回收断裂

### 症状
- `QueryEngine.getMessages()` 永远返回 `[]`（或初始空数组）
- Session 恢复时无法从消息历史继续

### 根因
`QueryEngine.submitMessage()` (`QueryEngine.ts:155-157`) 有一行明确的注释承认 gap：

```typescript
// Messages from the query loop are accumulated in its internal state;
// for now we rely on AgentEventBus history. Full state sync in Phase C.
```

**调用链追踪:**
```
QueryEngine.submitMessage()
  ├ 102: const messages = [...this.mutableMessages, ...ctx.messages]  // mutableMessages = []
  ├ 141: yield* queryLoop({ messages, ... })                         // 传入循环
  │    └ query-loop.ts 内部修改 state.messages (appendTurnToHistory)
  │    └ 循环结束后 state.messages 只在局部变量中，不回写
  ├ 157: this.turnCount++  // ← 只更新了 turnCount，没更新 mutableMessages
  └ finalize → memoryExtract(this.mutableMessages, ...)  // ← 传入了空数组！
```

实际上消息流是**隐式工作**的：下一轮 `contextBuilder.build()` 从 `agentEventBus.getHistory(sessionId)` 重新读取事件历史，不走 `mutableMessages`。但 `getMessages()` API 是坏的，`finalize()` 中传给 `extractMemories()` 的也是空数组。

**影响范围：**
- `extractMemories(this.mutableMessages, ...)` 在 `QueryEngine.ts:239-241` → 每次传入空数组，自动记忆提取完全不工作
- `getMessages()` 对外 API 返回错误数据
- Session resume 走 AgentEventBus 绕行，不走状态对象（性能更差）

### 修复方案

在 `queryLoop()` 返回后，从循环的 final state 回写 `mutableMessages`：

1. 让 `queryLoop()` 在返回 `TerminalReason` 的同时暴露 final `AgentState`
2. `QueryEngine.submitMessage()` 回收 `state.messages` → `this.mutableMessages`

**具体改动：**
- `query-loop.ts`: 返回值从 `TerminalReason` 改为 `{ reason: TerminalReason; finalMessages: LLMMessage[]; totalTokens: {...} }`
- `QueryEngine.ts`: 消费新返回值，回写 `this.mutableMessages = finalMessages`，更新 `this.totalUsage`

**副作用**: 低。query-loop 的调用者只有 QueryEngine（subagent 走 AgentOrchestrator）。

**回归风险**: 低。这是一个明显的 data flow gap，不改变循环逻辑。

---

## 问题 2: 缺少 API 调用前的工具配对验证

### 症状
- 如果某个 `tool_use` 没有被执行（权限拒绝 / 中断 / 错误），历史的 `assistant` 消息中有孤立的 `tool_use` 但没有对应的 `tool_result`
- Anthropic API 拒绝这种消息并返回 400 错误

### 根因

查看 `appendTurnToHistory()` (`query-loop.ts:598-616`)：

```typescript
function appendTurnToHistory(state, contentBlocks, toolResults, toolSummaryMessage?) {
  const assistantBlocks = contentBlocks.filter(b => b.type === 'text' || b.type === 'tool_use')
  state.messages.push({ role: 'assistant', content: assistantBlocks })
  if (toolResults.length > 0) {
    const compacted = microcompact(toolResults)
    state.messages.push({ role: 'user', content: compacted })
  }
}
```

**两个故障场景：**

**场景 A**: `runToolBatch()` 中 `orchestrateTools()` 执行成功但某个工具被权限拒绝 → `orchestrator.denied = true` → 返回 `'denied'`。此时 `appendTurnToHistory` 还没被调用（因在 `runToolBatch` 的调用者中走了 early return），但如果 streaming executor 的结果中有流式工具的部分结果，那些结果被 yield 了但对应的 `tool_use` 在 assistant 消息中留下了孤立的块。

**场景 B**: 中断（Ctrl+C / abort）在工具执行中间发生 → `signal.aborted` → 返回 `'aborted'`。此时 assistant 消息已追加（在 streaming 期间），但 user 消息（tool_result）可能不全。

**根本原因**: `appendTurnToHistory` 没有做 pre-flight 检查：遍历 assistant 消息中的 `tool_use` 块，验证对应的 `tool_result` 在紧接着的 user 消息中存在。Claude Code 和 AttaCode Engine 都在每次 API 调用前做这个检查。

### 修复方案

在 `query-loop.ts` 的每次 LLM 调用前（主循环第 258 行附近），新增验证步骤：

```typescript
function validateToolPairing(messages: LLMMessage[]): void {
  for (let i = 0; i < messages.length - 1; i++) {
    const msg = messages[i]
    const nextMsg = messages[i + 1]
    if (msg.role !== 'assistant' || nextMsg.role !== 'user') continue
    
    const toolUses = (msg.content as LLMContentBlock[]).filter(b => b.type === 'tool_use')
    const toolResults = (nextMsg.content as LLMContentBlock[]).filter(b => b.type === 'tool_result')
    
    // Check each tool_use has a matching tool_result
    const resultIds = new Set(toolResults.map(r => r.tool_use_id))
    const orphaned = toolUses.filter(tu => !resultIds.has(tu.id))
    
    if (orphaned.length > 0) {
      // Repair: add synthetic tool_result blocks for orphaned tool_use
      // Or: remove orphaned tool_use blocks from the assistant message
    }
  }
}
```

**具体改动：**
- 新增 `validateToolPairing()` 函数在 `query-loop.ts`
- 新增 `repairDanglingToolUses()` 函数（给孤立的 tool_use 生成 `[tool execution interrupted]` 的 synthetic tool_result，或直接移除孤立的 tool_use）
- 在主循环的 LLM 调用前（token budget check 之后，LLM call 之前）调用
- 同样在 `AgentOrchestrator.submitMessage()` 的 LLM 调用前加入（如果需要保留双通路）

**副作用**: 中。需要在消息历史中注入 synthetic tool_result 块，可能改变模型行为（但比 API 400 错误好得多）。

**回归风险**: 低-中。synthetic 块的设计需谨慎——`is_error: true` 的 tool_result 是最好的选择（Claude Code 的做法）。

---

## 问题 3: thinking 签名剥离

### 症状
- 假设未来支持 extended thinking（Opus 模型），模型切换时 thinking 块可能泄漏

### 根因分析（重新评估）

**深入代码后的结论：这不是一个实际的 bug。**

`AnthropicProvider.toLLMBlock()` (`AnthropicProvider.ts:247-257`) 的 default 分支会丢弃所有非 `text`/`tool_use` 类型的块（包括 `thinking`、`redacted_thinking`）：

```typescript
function toLLMBlock(block: Anthropic.ContentBlock): LLMContentBlock | null {
  switch (block.type) {
    case 'text': return { type: 'text', text: block.text }
    case 'tool_use': return { type: 'tool_use', id: block.id, name: block.name, input: block.input }
    default: return null  // ← thinking blocks dropped here
  }
}
```

`appendTurnToHistory()` (`query-loop.ts:604`) 也过滤了 thinking 块：
```typescript
const assistantBlocks = contentBlocks.filter(b => b.type === 'text' || b.type === 'tool_use')
```

**结论**: thinking 块在进入消息历史之前就被过滤掉了。模型切换时不会泄漏。**不需要修复。**

### 调整后的优先级

| 原优先级 | 问题 | 诊断结论 | 新优先级 |
|----------|------|----------|----------|
| 🔴 高 | 状态回收断裂 | **确认 bug**，影响记忆提取 + getMessages() | 🔴 高 |
| 🔴 高 | 缺少工具配对验证 | **确认 bug**，API 400 风险 | 🔴 高 |
| 🔴 高 | thinking 签名剥离 | **非 bug**，已有隐式过滤 | ~~移除~~ |
| 🔴 高 | Max turns 语义 | **确认 bug**，最后工具结果不被消费 | 🟡 中（确认存在，但严重度低于前两个） |

---

## 问题 4: Max turns 语义不当

### 症状
- 当模型在最后一轮使用了工具，工具结果追加后循环退出，模型看不到最后一次工具执行的结果

### 根因

`query-loop.ts:199`: `while (state.turnCount < profile.execution.maxTurns)`

**执行序列分析（maxTurns=20）:**
```
Turn 0:  LLM → tools → appendTurn → turnCount=1 → continue
...
Turn 18: LLM → tools → appendTurn → turnCount=19 → continue
Turn 19: LLM → tools → appendTurn → turnCount=20 → while: 20<20 false → return 'max_turns'
```

当 turn 19 的 LLM 调用了工具：工具结果被追加到历史，turnCount 变成 20，循环退出。模型**永远看不到 turn 19 工具执行的结果**。

对比 Claude Code：它在"是否有工具需要继续"的地方检查 maxTurns，而不是在循环头上。这意味着如果模型在最后一轮**没有**请求工具（自然结束），直接返回 `completed`；如果请求了工具，**允许额外一轮**来处理工具结果。

### 修复方案

改为在工具执行后、continue 前检查 maxTurns，而不是在循环头：

```typescript
// 当前（循环头检查）:
while (state.turnCount < profile.execution.maxTurns) { ... }

// 改为（循环头：无条件，内部：工具后检查）:
while (true) {
  // ... LLM call, hooks, tools ...
  
  if (toolUses.length === 0) return 'completed'
  
  // 工具执行 ...
  appendTurnToHistory(...)
  state.turnCount++
  
  // 在这里检查：给模型一次机会消化最后的工具结果
  if (state.turnCount >= profile.execution.maxTurns) {
    return 'max_turns'  // 但会先让 LLM 看到最后一次工具结果
  }
}
```

**更精确的修复**: 保留循环头检查，但在工具结果追加后、下一次 LLM 调用前不检查 maxTurns（即"最后一轮工具结果必须被消费"）。

**副作用**: 中。maxTurns 语义变化——原来是"最多 N 次 LLM 调用"，变为"最多 N 次工具执行循环 + 1 次额外消化"。

**回归风险**: 低-中。需要确保边界条件（maxTurns=1, maxTurns=0）仍然合理。

---

## 问题 5 (架构): 双通路并存

### 症状
- 两套 query loop: `query-loop.ts` (新) + `AgentOrchestrator.submitMessage()` (旧)
- 两套 context assembly: `ContextBuilder` (旧) + `ContextAssembler` (新)
- 两套 hook 系统: `HookManager` (旧 PostSampling) + `HookPipeline` (新 event-driven)
- QueryEngine 用的是旧 ContextBuilder，而 ContextAssembler 已实现但未接入

### 根因

这是多阶段并行开发的自然结果。Phase B/C/D/E 都引入了新的实现但没有废弃旧的。关键断裂点：

1. **AgentRuntime.runTask()** (line 141-154)：尝试 QueryEngine → 失败时 fallback 到 AgentOrchestrator
2. **ContextBuilder vs ContextAssembler**：功能大量重叠（~80%），差异仅在 git context、attachment、user/system context layering
3. **QueryEngine 使用 ContextBuilder**：明明 ContextAssembler 是"Phase E: replaces ContextBuilder"，但 QueryEngine 还是 import ContextBuilder

### 影响
- 维护负担：任何逻辑修改需要在两处做
- 测试覆盖分散
- AgentOrchestrator 的 fallback 路径实际上常被触发（QueryEngine 的 deps 没完全 wired）

### 修复方案（分步，非一次性）

**Step 1**: QueryEngine 切到 ContextAssembler
- 替换 `QueryEngine.submitMessage()` 中的 `contextBuilder.build()` → `contextAssembler.assemble()`
- ContextAssembler 已经提供了 `git`, `attachments`, `userContext`, `systemContext`
- 影响行数：~20 行

**Step 2**: 移除 AgentOrchestrator 作为 fallback
- `AgentRuntime.runTask()` 中删除 fallback 到 AgentOrchestrator 的逻辑
- SubAgentManager 继续使用 AgentOrchestrator（或者也切过来）
- 保留 AgentOrchestrator 类本身（subagent 仍需要），但不再作为主路径

**Step 3**: 废弃 ContextBuilder
- 标记为 `@deprecated`，最终移除

这个不放在本次 bug fix 范围内——属于架构重构，适合 `/atta-refactor`。

---

## 调整后的修复计划

### 🔴 先做（本次 — 必须修复）

| # | 问题 | 文件 | 严重度 | 预估行数 |
|---|------|------|--------|----------|
| 1 | 状态回收断裂 | `query-loop.ts` + `QueryEngine.ts` | 高 | ~30 行 |
| 2 | 缺少工具配对验证 | `query-loop.ts` (新增验证) + `AgentOrchestrator.ts` | 高 | ~50 行 |

### 🟡 再做（下一批）

| # | 问题 | 文件 | 严重度 | 预估行数 |
|---|------|------|--------|----------|
| 3 | Max turns 语义 | `query-loop.ts` | 中 | ~15 行 |
| 4 | 整合双通路 (Step 1) | `QueryEngine.ts` | 中 | ~20 行 |
| 5 | 移除 AgentOrchestrator fallback | `AgentRuntime.ts` | 中 | ~15 行 |

---

## 验证标准

### 修复 1: 状态回收
- `QueryEngine.getMessages()` 在 session 完成后返回完整的消息历史
- `extractMemories()` 接收到非空消息数组
- 第二个 `submitMessage()` 调用能正确继承第一轮的消息

### 修复 2: 工具配对验证
- 模拟：工具执行被中断 → 孤立的 tool_use 被修复（synthetic tool_result）或移除
- LLM API 调用前消息历史满足 `tool_use` ↔ `tool_result` 一一对应
- 权限拒绝的工具不会导致 API 400

### 修复 3: Max turns 语义
- maxTurns=1：模型发出 tool_use → 工具执行 → 模型看到结果后再返回 max_turns
- maxTurns=1：模型自然结束（无 tool_use）→ 正常返回 completed

### 修复 4: ContextAssembler 接入
- QueryEngine 走 ContextAssembler.assemble() 而非 ContextBuilder.build()
- git status、OS、date 信息在系统提示末尾正确注入
- 附件信息在用户消息前正确注入

---

## 不在此次范围（后续独立处理）

- 整合双通路 Step 2/3（移除 AgentOrchestrator fallback、废弃 ContextBuilder）
- Hook 系统统一（移除 HookManager，统一到 HookPipeline）
- 异步钩子支持
- 消息队列机制
- Memory prefetch 异步化
- 动态技能发现
- 自动分类器
