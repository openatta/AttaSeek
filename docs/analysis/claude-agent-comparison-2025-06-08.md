# Claude Code vs AttaCode Engine vs AttaSeek Agent 对比分析

> **日期**: 2025-06-08
> **范围**: 只读分析，不动代码
> **对比对象**:
> - **Claude Code**: `AttaCode/3rds/claude-code-main/src/` (TypeScript, CLI)
> - **AttaCode Engine**: `AttaCode/crates/attacode-engine/src/` (Rust, 引擎 crate)
> - **AttaSeek Agent**: `AttaSeek/src/main/agent/` (TypeScript, Electron)

---

## 一、总览

### 1.1 三套代码的定位

| 维度 | Claude Code | AttaCode Engine | AttaSeek Agent |
|------|-------------|-----------------|----------------|
| **语言** | TypeScript | Rust (`#![forbid(unsafe_code)]`) | TypeScript |
| **运行时** | Node.js (Bun target) | Native binary | Electron 主进程 |
| **UI 层** | Ink (React for terminal) | TUI + JSON headless | React (渲染进程) |
| **成熟度** | 生产级（Anthropic 官方产品） | Beta（独立开发中） | Beta（多阶段并行开发中） |
| **规模** | ~1730 行 query.ts + 60+ 子系统文件 | ~35,000 行 Rust（60+ 文件） | ~25 工具实现 + ~15 子系统模块 |
| **架构类型** | 紧密集成的单体应用 | 基于 trait 的干净分层 | 多阶段逐步移植，双通路并行 |

### 1.2 关键架构差异

**Claude Code (TS)** 和 **AttaSeek** 都是 TypeScript，但架构哲学不同:

- **Claude Code**: 内部紧密耦合（`query.ts` 一个文件 1730 行），通过 `deps` 注入接口实现可测试性。Ink UI 和逻辑混合在同一进程。
- **AttaCode Engine (Rust)**: 最干净的架构。`Engine` struct 通过 `Arc<dyn Trait>` 持有所有依赖，每个子系统是独立 trait。类型系统强制安全。
- **AttaSeek**: 多阶段并行开发——同时存在 `QueryEngine + query-loop`（新）和 `AgentOrchestrator`（旧）两条执行通路，`ContextBuilder`（旧）和 `ContextAssembler`（新）两套上下文组装。

---

## 二、查询循环 (Query Loop) 深度对比

### 2.1 循环结构

```
Claude Code:               AttaCode Engine:              AttaSeek (新通路):
while(true)                loop {                        for (turn < maxTurns)
  ├ 修剪/预算/压缩           ├ 取消检查                    ├ 压缩检查
  ├ 自动压缩                 ├ max_api_calls 守卫          ├ token 预算
  ├ 阻塞限制检查             ├ 模型自动路由                ├ LLM 调用 (内层 while(true))
  ├ LLM 调用                 ├ frozen 重建                 ├   ├ 模型回退
  ├ 流式工具执行             ├ 请求构建+token检查          ├   ├ max_tokens 升级
  ├ 后采样钩子               ├ 自动压缩 (4级)              ├   └ 统一恢复路由
  ├ 无工具 → 停止钩子        ├ 硬阻塞限制                  ├ 后采样钩子
  └ 有工具 → 执行 → 继续     ├ consume_stream              ├ 停止钩子
                              ├ 错误恢复 (match 多分支)      ├ 工具执行
                              ├ max_tokens 恢复             └ 继续或终止
                              └ 工具分发
```

### 2.2 关键差异点

| 特性 | Claude Code | AttaCode Engine | AttaSeek |
|------|-------------|-----------------|----------|
| **迭代守护** | 无限制 (由工具是否继续决定) | `max_api_calls_per_turn` (默认 200) | `profile.execution.maxTurns` (默认 20) |
| **LLM 调用策略** | 一次调用 → 捕获 FallbackTriggeredError → 重试 | `consume_stream` → match 多分支错误恢复 | 内层 `while(true)` 循环含 3 条恢复路径 |
| **模型自动路由** | ❌ | ✅ 3+ tool calls / 出错 / 8+ messages → 切换到 strong model | ✅ `slotResolver.fallback()` 仅 on error |
| **消息队列管理** | ✅ `queuedCommandsSnapshot` 在轮次间注入 | ❌ | ❌ |
| **查询链追踪** | ✅ `queryTracking` (chainId, depth) | ✅ 遥测埋点 | ❌ |
| **取消粒度** | Ctrl+C → 多级中断处理 | `cancel.is_cancelled()` 每轮检查 | `AbortController` 每个 session |

### 2.3 AttaSeek 与 Claude Code 的具体差距

1. **消息队列**: Claude Code 在轮次间通过 `queuedCommandsSnapshot` 自动注入 prompt/notification 命令。AttaSeek 没有等效机制。

2. **内存预取**: Claude Code 用 `using pendingMemoryPrefetch` 异步模式，在 LLM 流式返回期间后台检索相关记忆，工具执行完成后消费。AttaSeek 在 `ContextBuilder.build()` 中**同步**加载记忆。

3. **技能发现**: Claude Code 有 `EXPERIMENTAL_SKILL_SEARCH` 功能，在模型流式返回期间异步预取技能发现结果。AttaSeek 仅在 context-build 时将技能注入系统提示。

4. **状态持久化**: Claude Code 的 `QueryEngine` 正确地从查询循环回收可变消息状态；AttaSeek 的 `QueryEngine.mutableMessages` 有明确注释标注**未从循环中更新**（已知 gap）。

5. **Max turns 语义**: Claude Code 在**工具继续处**检查 maxTurns，允许模型自然结束；AttaSeek 在 `for` 循环头检查，可能截断进行中的工作。

---

## 三、工具系统对比

### 3.1 工具定义模型

| 维度 | Claude Code | AttaCode Engine (Rust) | AttaSeek |
|------|-------------|------------------------|----------|
| **定义方式** | `buildTool(def)` 工厂函数，60+ 方法接口 | `Tool` trait（~12 方法） | 清单注册 + 独立实现文件 |
| **输入验证** | Zod schema | `input_schema() -> Value` (JSON Schema) | JSON Schema 字符串 |
| **并发安全** | `isConcurrencySafe(input)` per-tool | `is_concurrency_safe(input)` per-tool | Manifest 函数 + boolean + 名字启发式 |
| **权限模型** | `checkPermissions(input, context)` → `{behavior, message}` | `check_permissions(input, ctx)` → `PermissionDecision` | `riskLevel` + `PermissionService` |
| **自动分类器输入** | `toAutoClassifierInput(input)` | `LlmAutoClassifier` (Haiku cheap model) | ❌ 无等效 |
| **只读标记** | `isReadOnly(input)` | `is_read_only(input)` | 无 per-tool 标记 |
| **破坏性标记** | `isDestructive()` | `is_destructive(input)` | ❌ 无等效 |

### 3.2 工具执行流程

```
Claude Code:                     AttaCode Engine:              AttaSeek:
runTools()                       dispatch_tool_calls()         ToolOrchestrator.orchestrateTools()
 ├ 分区 (安全/不安全)             ├ collect tool_use blocks      ├ partitionToolCalls() (安全/不安全)
 ├ 并行执行安全工具               ├ StreamToolState 并发控制     ├ 并行执行安全工具 (maxParallelTools)
 ├ 串行执行不安全工具             ├ FuturesUnordered + semaphore ├ 串行执行不安全工具
 ├ Permission check              ├ Permission gate              ├ Permission check
 ├ PreToolUse hook               ├ PreToolUse hook              ├ PreToolUse hook
 ├ tool.call()                   ├ tool.call()                  ├ tool.call()
 ├ PostToolUse hook              ├ PostToolUse hook             ├ PostToolUse hook
 └ format/persist large result   └ truncate result              └ truncate result
```

### 3.3 AttaSeek 工具系统的缺口

1. **无 `isReadOnly` / `isDestructive` trait**: 无法在工具级别声明只读/破坏性语义，依赖 `riskLevel` 字符串。

2. **无自动分类器 (Auto Classifier)**: AttaCode 和 Claude Code 都有 LLM 自动分类器（用 Haiku 判断工具调用是否"明显安全"），AttaSeek 没有。

3. **工具结果预算**: Claude Code 有 `applyToolResultBudget` 对聚合工具结果大小进行内容替换 + 截断，AttaSeek 只有简单的字符截断。

4. **Bash 错误 → 兄弟取消**: AttaSeek 有 `siblingAbortController`（Bash 错误杀兄弟），但 Claude Code 和 AttaCode Engine 没有此机制（它们选择隔离工具执行）。

5. **MCP 工具去重**: Claude Code 的工具池组装在 `assembleToolPool()` 中有显式的去重逻辑（built-in 赢 MCP），AttaSeek 中是隐式的 `mcp__` 前缀避免冲突。

---

## 四、上下文压缩 (Compaction) 对比

### 4.1 压缩策略层级

| 阶段 | Claude Code | AttaCode Engine | AttaSeek |
|------|-------------|-----------------|----------|
| **0. 工具结果预算** | ✅ `applyToolResultBudget` (内容替换) | ❌ | ❌ |
| **1. Snip** | ✅ 智能截断，保护尾部 | ✅ 机械替换 `[snip:...]` | ✅ 保留头+尾 |
| **2. Microcompact** | ✅ 缓存 microcompact (API 报告) | ✅ 结构化分段 + 关键词保留 | ✅ 内容截断 + 时间截断 |
| **3. Context Collapse** | ✅ 基于提交日志的投影系统 | ✅ 保留最近 K 条消息 + 摘要 | ✅ CollapseStore + commit log |
| **4. Auto Compact** | ✅ LLM 摘要 + 滞后跟踪 | ✅ 3 种策略 (collapse/micro/full) | ✅ LLM 摘要 + 滞后跟踪 |
| **5. Reactive** | ✅ 413 错误触发 + collapse drain | ✅ 上下文超限错误 → 3 次重试 | ✅ API 错误触发 + 渐进策略 |

### 4.2 关键差异

1. **Claude Code 独有**: 工具结果预算 (`applyToolResultBudget`) 在压缩管线最前面执行，不是简单的截断而是有选择的内容替换。

2. **Claude Code 独有**: Context Collapse 作为自动压缩的前置步骤——如果 collapse 后已在阈值以下，**跳过**自动压缩（保留更丰富的上下文）。

3. **AttaCode 独有**: 压缩器共享系统前缀以复用缓存键 (`set_system_prefix`)，避免压缩 LLM 调用时重复缓存。

4. **AttaSeek 的 Microcompact** 分为内容截断和时间截断两个子阶段，但**没有** AttaCode 的结构化分段（Earlier goals/findings/decisions）和关键词保留 (`[PIN]`, `[KEEP]`, `decision:`)。

5. **电路断路器**: AttaSeek 和 AttaCode 都有（3 次连续失败），Claude Code 以不同形式实现（per-turn compact 计数）。

---

## 五、钩子系统对比

| 维度 | Claude Code | AttaCode Engine | AttaSeek |
|------|-------------|-----------------|----------|
| **钩子类型** | Shell + HTTP + Agent + Function | Shell (plugin 注册) | command + http + prompt + callback |
| **事件类型** | 20+ 事件 | 9 事件 | 8 事件 |
| **异步钩子** | ✅ 通过 FD 协议外带响应 | ❌ | ❌ |
| **条件匹配** | `if` 条件 + 工具名 glob | ❌ | 精确 + 管道分隔 + glob 风格匹配 |
| **注入能力** | blockingError, preventContinuation, autoApprove, alwaysAllow | blocking, updated_input, discontinued | injectMessages, block, preventContinuation, suppressOutput, updateInput |
| **Session 级钩子** | ✅ `registerSessionFunctionHook()` | ✅ 通过 `with_plugins()` | ✅ `hookPipeline` 单例 |

### AttaSeek 的钩子特色

- 同时保留了旧 `HookManager` (PostSampling) 和新 `HookPipeline` (事件驱动) 两套系统。
- 支持 HTTP 钩子，这在 AttaCode 中没有。
- 有 `Notification` 事件类型（Claude Code 有 `PermissionRequest`/`PermissionDenied`，AttaCode 无等效）。

### 缺口

- **无异步钩子**: Claude Code 支持通过 `CLAUDE_CODE_HOOK_RESPONSE_FD` 文件描述符实现外带响应，允许长时间运行的异步钩子。
- **无 Function/Agent 钩子类型**: AttaSeek 只有 command/http/prompt 三种执行方式。
- **缺少事件**: `SubagentStart`, `TaskCompleted`, `TeammateIdle`, `UserPromptSubmit`, `CwdChanged`, `Elicitation`。

---

## 六、技能 (Skills) 系统对比

| 维度 | Claude Code | AttaCode Engine | AttaSeek |
|------|-------------|-----------------|----------|
| **技能来源** | 上线文: bundles, managed, user, project, --add-dir, dynamic, conditional, MCP, legacy | 上线文: bundled, user (~/.atta/), project (.atta/), plugins | 上线文: managed, user, project, bundled (12 个 atta-*) |
| **条件激活** | ✅ `paths` frontmatter 匹配 | ❌ | ✅ `skill-activation.ts` gitignore 风格 |
| **动态发现** | ✅ 从文件路径向上搜索 `.claude/skills/` | ❌ | ❌ |
| **MCP 技能** | ✅ MCP prompts → skills | ❌ | ✅ MCP prompts → skillRegistry |
| **执行模式** | inline (注入 prompt) + fork (子代理) | inline (通过 SkillTool) | inline + fork |
| **Shell 执行** | 通过 Hook 系统 | ❌ | ✅ `SkillExecutor` 支持 ```bash 块 |
| **模型覆盖** | ✅ skill 可指定 model | ❌ | ❌ |

### 缺口

- **无动态发现**: 当工具读取/编辑文件时，Claude Code 从文件路径向上搜索 `.claude/skills/` 目录，自动加载新技能。AttaSeek 没有此机制。
- **无遗留命令支持**: Claude Code 兼容 `.claude/commands/` 目录。
- **条件技能**: Claude Code 将条件技能存入 Map，在文件操作时激活。AttaSeek 的 `skill-activation.ts` 有类似功能但未深度集成到查询循环。

---

## 七、错误恢复对比

### 7.1 恢复策略矩阵

| 错误类型 | Claude Code | AttaCode Engine | AttaSeek |
|----------|-------------|-----------------|----------|
| **速率限制** | Fallback 模型 | 无特殊处理 (依赖 SDK 重试) | L2: 指数退避等待 |
| **上下文超限** | Reactive compact → collapse drain (413 触发) | Reactive compact → trim old results → 硬失败 | L3: reactiveCompact → L4: collapse (截断) → L5: fail |
| **Max output tokens** | 升级 output tokens (多次) + 注入 "continue" | 升级 output tokens (< 2 次) + 注入 "Please continue" | 升级 output tokens (最多 3 次) |
| **流式中断** | 重试一次 | 重试一次 | 含在 recovery router L1 |
| **服务器错误** | Fallback 模型 | Fallback 模型 | recovery router L1 (透明重试) |
| **Auth 过期** | 特定错误码处理 | 无特殊处理 | 含在 withRetry 分类 |

### 7.2 AttaSeek 恢复系统的优势

1. **统一的 recovery-router**: 5 个恢复级别，每级有独立的尝试计数上限和断路器。
2. **断路器机制**: 连续 3 次同级别失败 → 硬失败（`CIRCUIT_BREAKER_THRESHOLD = 3`）。
3. **WAIT_RETRY 指数退避**: L2 速率限制有公式化的退避时间（`base * 2^(n-1)` 上限封顶）。
4. **降级路径清晰**: L3 → L4 → L5 的降级链比 Claude Code 的 scattered 恢复更显式。

### 7.3 缺口

1. **无 withholding 机制**: Claude Code 在流式处理期间暂扣 `prompt_too_long` / `max_output_tokens` / media-size 错误，防止中间错误泄漏给 SDK 消费者。AttaSeek 在 recovery-router 中直接处理，但错误可能已传播。

2. **无 thinking 签名剥离**: AttaCode 在切换模型时剥离 thinking 签名，Claude Code 也有此处理。AttaSeek 没有等效机制（可能因为其 AnthropicProvider 不传递 thinking 块给后续请求）。

3. **AttaCode 独有**: `validate_tool_pairing` 和 `repair_dangling_tool_uses` 作为**每次 API 调用前**的预检步骤。

---

## 八、LLM Provider 层对比

| 维度 | Claude Code | AttaCode Engine | AttaSeek |
|------|-------------|-----------------|----------|
| **提供商** | Anthropic (AWS Bedrock, Vertex, API) | Anthropic (API) | Anthropic + OpenAI Compatible |
| **模型选择** | 直接模型名 + effort + fallback | slot 解析 (base/strong/fallback) | 10-slot 系统 (model/opus/sonnet/haiku/subagent/...) |
| **提示缓存** | ✅ cache_control 标记 | ✅ 4 断点系统 + global cache scope | ✅ 3 断点 + 缓存键 SHA-256 |
| **重试机制** | SDK 内建 + FallbackTriggeredError | 单次 fallback | withRetry (10 次 + 指数退避 + 错误分类) |
| **成本追踪** | ✅ 模型定价表 | ✅ 模型定价表 | ✅ 定价表 (Anthropic/OpenAI/DeepSeek) |
| **跨子代理缓存共享** | ❌ | ❌ | ✅ CacheManager (hash-based, 30min TTL) |

### AttaSeek 独有的优势

- **Provider 抽象**: 同时支持 Anthropic 和 OpenAI Compatible，其他两套代码只支持 Anthropic。
- **Slot 系统**: 10 个可配置 slot，每个有独立的 fallback 链。比 Claude Code 的 effort 值和 AttaCode 的 base/strong/fallback 更灵活。
- **跨子代理缓存键共享**: CacheManager 让父子代理共享提示缓存，减少 API 重复计费。
- **VCR 录制/回放**: `vcr.ts` 用于测试，其他两套代码无等效。

---

## 九、多代理协调对比

| 维度 | Claude Code | AttaCode Engine | AttaSeek |
|------|-------------|-----------------|----------|
| **协调模式** | Coordinator Mode (环境变量控制) | `DefaultCoordinator` (stages) | `CoordinatorMode` + `SwarmManager` |
| **子代理** | AgentTool (sync/background/dynamic) | AgentTool (sync/background/remote) + TeamCreateTool | SubAgentManager (fork/cancel) + SwarmManager |
| **团队** | Team tool (多代理 staged) | TeamCreate (parallel per-stage + LLM 聚合) | Swarm (teammate spawn/send/stop) |
| **邮箱** | 通过 Task 工具通信 | `MailboxStore` (SendMessage/ReadMail/ListPeers) | ❌ 无显式邮箱系统 |
| **工作区隔离** | `EnterWorktreeTool` (git worktree) | AgentTool `worktree` 参数 | `WorktreeManager` |
| **后台代理** | ✅ AgentTool `background` | ✅ AgentTool `background` | ✅ SwarmManager `spawnTeammate` |
| **动态后台化** | ✅ `auto_background_after_secs` | ❌ | ❌ |
| **远程代理** | ❌ | ✅ `RemoteAgentTransport` (stub) | ❌ |
| **代理类型过滤** | Explore + Plan + Coding + Worker | Explore + Plan + Coding | Explore + Plan + Review + Verify |

### 缺口

- **无显式邮箱系统**: AttaCode 的 `MailboxStore` 支持持久化 JSONL 文件和 `SendMessage`/`ReadMail`/`ListPeers` 工具。AttaSeek 的 SwarmManager 有 `sendMessage` 方法但没有独立的 mailbox 抽象。
- **无团队 scratchpad**: AttaCode 的 `DefaultCoordinator` 创建 `.atta/code/teams/<id>/SCRATCHPAD.md`，供代理间共享上下文。AttaSeek 无等效。
- **无 LLM 聚合**: AttaCode 的 `aggregate_stage_results()` 支持 Concat/Best/Aggregate 三种模式，Best 和 Aggregate 用 LLM 评判/合并。AttaSeek 只返回聚合文本。
- **无动态后台化**: Claude Code 支持同步代理在超时后自动转为后台模式 (`auto_background_after_secs`)。

---

## 十、AttaSeek 独有的功能和创新

以上重点说了差异和缺口，以下列出 AttaSeek 中**其他两套代码没有**的功能:

1. **AgentProfile 系统**: 编码/研究/写作三种内置 profile，声明式配置（工具白名单、记忆作用域、上下文budget、maxTurns、toolSelection 策略），其他两套代码通过代码分散配置。

2. **Dual execution pathways**: 同时保留新（QueryEngine + query-loop）和旧（AgentOrchestrator）两条执行通路，支持渐进式迁移。

3. **PromptTemplate 系统**: 基于 section + priority 的系统提示组装引擎，section 可以是静态字符串或动态函数，有条件渲染。

4. **ToolRouter (Jaccard 相似度)**: 基于目标的 Top-K 工具选择，减少发送给 LLM 的工具 schema 数量。

5. **CronScheduler + MonitorManager**: 简化的 cron 调度器和后台 shell 监控器，独立于 query loop。

6. **AttaEnvResolver + AttaSettingsLoader**: 从环境变量和 settings 文件加载 LLM 配置。

7. **ContextBuilder budget 系统**: 为系统提示、工具、记忆、消息、预留各分配独立的 token budget。

8. **FeatureFlags 系统**: 编译时（死代码消除）+ 运行时双层特性开关，10 个特性标志。

---

## 十一、关键差距汇总（按严重程度排序）

### 🔴 高优先级（影响正确性或稳定性）

1. **QueryEngine.mutableMessages 未回收**: 查询循环内部维护自己的消息状态，但 QueryEngine 的 `mutableMessages` 从未从循环中更新。这意味着 `getMessages()` 返回的总是初始状态。

2. **无工具配对验证**: 其他两套代码都在 API 调用前检查 `tool_use` / `tool_result` 配对，AttaSeek 没有等效检查，可能导致 API 错误（400 级别）。

3. **无 thinking 签名剥离**: 当模型 fallback 切换时，上一个模型的 thinking 块可能泄漏到新请求中。

4. **Max turns 语义不当**: 用 `for` 循环头检查而非工具继续处检查，可能截断进行中的工作。

### 🟡 中优先级（影响健壮性）

5. **无 withholding 机制**: 中间错误可能泄漏给流消费者。

6. **无消息队列机制**: Claude Code 的 `queuedCommandsSnapshot` 在轮次间注入 prompt/通知命令。

7. **无动态技能发现**: 文件操作不会触发新技能加载。

8. **无异步钩子**: 不支持长时间运行的外带钩子响应。

9. **无 LLM 工具使用摘要**: 摘要生成是同步启发式的（Claude Code 用 Haiku 异步生成）。

### 🟢 低优先级（功能增强）

10. **无显式 mailbox 系统**: SwarmManager 通信依赖直接方法调用。

11. **无团队 scratchpad**: 多代理间共享上下文受限。

12. **无自动分类器**: 权限模式中缺少 LLM 辅助的自动判断。

13. **无动态后台化**: 同步子代理不能基于超时自动转后台。

14. **微压缩缺少结构化分段 + 关键词保留**: 没有 `[PIN]`/`[KEEP]`/`decision:` 保留机制。

15. **工具缺少 `isReadOnly`/`isDestructive` 声明**: 权限检查粒度不够。

---

## 十二、架构演化建议

基于以上分析，AttaSeek 的 Agent 实现已经覆盖了核心的 agent loop 范式，与两个参考实现在结构上高度一致。主要待补足的是:

1. **整合双通路**: 移除旧的 AgentOrchestrator + ContextBuilder，统一为 QueryEngine + query-loop + ContextAssembler。

2. **补齐关键安全机制**: 工具配对验证、thinking 剥离、状态回收。

3. **丰富中间件**: 消息队列、异步钩子、记忆预取、动态技能发现。

4. **强化协同**: 邮箱系统、团队 scratchpad、LLM 聚合。

其中第 1-2 条是正确性级别的问题，应优先处理；第 3-4 条是健壮性和功能完整性。

---

> 📌 本分析基于 2025-06-08 的代码状态。三个代码库都在活跃开发中，对比结果有时效性。
