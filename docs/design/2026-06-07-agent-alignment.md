# AttaSeek ↔ Claude Code Agent 功能对齐分析

> 2026-06-07 | 只读分析 | 对标 `../AttaCode/3rds/claude` (claude-code-main)

## 总体结论

AttaSeek 的 Agent 架构**骨架已基本对齐** —— 核心循环范式（AsyncGenerator）、多 Provider 支持、工具编排、MCP 集成、子代理分叉、上下文压缩、技能系统等关键子系统均已实现。但在**成熟度、深度和功能广度**上仍有显著差距。Claude Code 是一个经过大量工程化打磨的生产级系统（2300+ 源文件），AttaSeek 在多个维度上处于"已实现但简化"或"尚未实现"的状态。

---

## 一、已对齐的核心能力

| 能力域 | 对齐程度 | 说明 |
|--------|----------|------|
| **Agent Loop** | 高 | 双方均使用 AsyncGenerator 流式主循环；状态机驱动；可中断取消 |
| **LLM Provider** | 中高 | Anthropic + OpenAI 兼容均已实现；流式响应；指数退避重试；模型别名 |
| **工具编排** | 中高 | 并行/串行分派；并发安全分组；流式工具执行（FIFO 完成检测） |
| **MCP 集成** | 中 | 服务端生命周期；stdio/SSE 传输；工具/资源/提示发现；崩溃恢复 |
| **子代理** | 中 | Fork 模式；递归防护；工作树隔离；内置Explore/Plan/Review/Verify |
| **上下文压缩** | 中 | 多级压缩管线；LLM 摘要；微压缩（工具结果截断）；熔断器 |
| **技能系统** | 中 | `.claude/skills/` 加载；参数解析；多源发现；调用工具 |
| **记忆系统** | 中 | CLAUDE.md + MEMORY.md；自动提取；LLM 驱动；差量游标 |
| **Hooks** | 中 | 事件驱动管线；优先级排序；阻断/放行决策；内置 hook |
| **权限模型** | 中 | 允许/询问/拒绝三态；规则匹配；用户对话框 |

---

## 二、差距详解

### 2.1 Agent Loop — 恢复与容错（差距：中）

| Claude Code 有，AttaSeek 缺/弱 | 影响 |
|---|---|
| `max_output_tokens` 逐级升级（8K→64K）后自动恢复 | 长输出场景下会过早截断 |
| `Continue` 转换有 8 种显式原因类型，每个恢复路径可追踪 | AttaSeek 的 RecoveryLevel 仅 5 级，缺少 `collapse_drain_retry`、`token_budget_continuation` |
| 结构化输出强制重试（schema validation → retry） | 缺，AgentOrchestrator 不验证 LLM JSON 输出结构 |
| Transcript 持久化为第一优先级 | AttaSeek 的事件历史在内存（1000 条上限），持久化由外部 SessionStore 管理 |
| 预算检查覆盖 USD、最大轮次、token 多维度 | AttaSeek 仅有轮次上限和 token 估算 |

### 2.2 LLM Provider — 深度与容错（差距：中高）

| Claude Code 有，AttaSeek 缺/弱 | 影响 |
|---|---|
| **模型回退链**（Sonnet→Haiku 在容量不足时自动切换） | 生产环境 API 容量波动时 AttaSeek 直接报错 |
| **Fast Mode** + cooldown 追踪 + 超量拒绝 | 缺快速模式，无法在速度和成本间灵活切换 |
| **Provider 矩阵**：Anthropic + Bedrock + Vertex AI + Ollama + LM Studio + codex-rs ChatGPT | AttaSeek 仅 Anthropic + OpenAI 兼容（覆盖面够，但无云厂商托管版） |
| **Prompt cache 断裂检测与诊断** | 已实现缓存但无诊断，缓存命中率不可观测 |
| **Haiku 专用快速路径**（`queryHaiku` 用于摘要、分类、记忆提取） | AttaSeek 所有调用走默认 provider，轻量任务成本高 |
| **Beta header 管理**（latching session-stable headers） | 缺，API 版本兼容风险 |

### 2.3 工具系统 — 丰富度与可观测性（差距：高）

Claude Code 工具接口约 **40 个属性**，AttaSeek 的 ToolManifest 约 **15 个字段**。关键差距：

| 维度 | Claude Code | AttaSeek |
|------|-------------|----------|
| 工具数量 | 40+ | ~20（含部分 mock） |
| 逐工具 UI 渲染 | `renderToolUseMessage/Result/Progress/Rejected/Error` — 每种工具自定义渲染 | 统一渲染，无逐工具定制 |
| 进度流 | `onProgress` 回调，工具执行中间状态实时展示 | 缺 |
| 工具摘要 | `getToolUseSummary` / `getActivityDescription` 供 UI 展示 | 缺 |
| 延迟加载 | `shouldDefer` / `alwaysLoad` + ToolSearch 关键词匹配 | 工具全量注册，无按需加载 |
| 中断行为 | 逐工具 `interruptBehavior: 'cancel' \| 'block'` | 统一取消 |
| 同级错误级联 | Bash 错误自动终止同级 Bash | 缺 |
| 自动分类 | `toAutoClassifierInput` + 独立分类器 LLM 调用 | 缺自动分类 |
| 输入预校验 | `validateInput` 在权限检查前先行校验 | 缺 |

**Claude Code 有而 AttaSeek 缺的工具**：
- `MonitorTool` — 流式日志监控
- `CronCreate/Delete/List` — 定时任务
- `TeamCreate/Delete` — 团队协作
- `SendMessage` — 代理间消息
- `WorkflowTool` — 多代理编排脚本
- `NotebookEdit` — Jupyter Notebook 编辑
- `WebBrowserTool` — 内置浏览器
- `Sleep` — 延时等待
- `ListPeersTool` — 对等代理发现

**AttaSeek 有而 Claude Code 缺的工具**：
- 文档工具（`create/review/format/outline_document`）
- `send_email`（mock）

### 2.4 记忆系统 — 团队与发现（差距：中）

| Claude Code 有，AttaSeek 缺/弱 | 影响 |
|---|---|
| **团队记忆同步**（`teamMemorySync/`） | 无法在多用户/多代理间共享记忆 |
| **嵌套 CLAUDE.md**（工作目录中的自动附加） | 仅读项目根目录 |
| **环境变量发现**（`CLAUDE_CODE_AUTO_MEMORY`） | 无自动发现机制 |
| **Haiku 分类器做记忆相关性判定** | AttaSeek 用默认 provider，轻量任务成本偏高 |
| **WHEN_TO_ACCESS / TRUSTING_RECALL** 等结构化记忆段 | AttaSeek 前端元数据更简单 |

### 2.5 MCP 集成 — 认证与高级传输（差距：中高）

| Claude Code 有，AttaSeek 缺/弱 | 影响 |
|---|---|
| **OAuth 2.1 完整认证流**（89K `auth.ts`） | 无法接入需要 OAuth 的 MCP 服务 |
| **InProcessTransport**（进程内 MCP） | 所有 MCP 必须经子进程 |
| **SdkControlTransport** | 不支持 SDK 控制的传输 |
| **Channel MCP**（Slack/Teams 集成） | 无频道式 MCP |
| **延迟工具加载** + ToolSearch | 全量启动加载，大型 MCP 服务启动慢 |
| **MCPConnectionManager UI 组件**（45K React hook） | UI 层 MCP 管理较简单 |
| **XAA / IdP 企业认证** | 缺企业认证集成 |

### 2.6 Hooks 系统 — 事件覆盖与类型（差距：高）

**事件类型对比：**
- Claude Code: **20+** 种事件（PreToolUse, PostToolUse, PostToolUseFailure, PermissionDenied, Notification, PreCompact, PostCompact, SessionStart, SessionEnd, Setup, Stop, StopFailure, SubagentStart, SubagentStop, TeammateIdle, TaskCreated, TaskCompleted, ConfigChange, CwdChanged, FileChanged, InstructionsLoaded）
- AttaSeek: **9** 种事件（PreToolUse, PostToolUse, UserPromptSubmit, SessionStart, Stop, PreCompact, PostCompact, Notification, PostSampling）

**Hook 类型对比：**
- Claude Code: **5** 种（command, prompt, agent, http, function）
- AttaSeek: **3** 种（callback, command, prompt）

| 关键差距 | 影响 |
|----------|------|
| 缺 `agent` hook 类型（委托子代理执行 hook） | hook 无法触发代理行为 |
| 缺 `http` hook 类型 | hook 无法做外部 HTTP 调用 |
| 缺 `function` hook 类型（编程注册回调） | 技能/插件无法注册原生 hook |
| 缺 `SubagentStart/Stop` 事件 | 子代理生命周期不可观测 |
| 缺 `PostToolUseFailure` 事件 | 工具执行失败无 hook 介入点 |
| 缺 `TaskCreated/Completed` 事件 | 后台任务无 hook  |
| 缺 `ConfigChange/CwdChanged/FileChanged` 事件 | 环境变化不可观测 |
| 缺 `if` 条件（基于工具输入的模式匹配） | hook 触发条件粗粒度（仅工具名） |
| 缺退出码语义（0=continue, 2=block+stderr） | hook 协议不够标准化 |
| 缺异步 hook 回调模式 | 长时 hook 无法异步返回结果 |

### 2.7 上下文压缩 — 成熟度（差距：中高）

Claude Code 有 **6 级**压缩，AttaSeek 也是多级但实现深度不同：

| 压缩等级 | Claude Code | AttaSeek |
|----------|-------------|----------|
| Snip | 完整实现 — 移除"中间"保留首尾，创建压缩边界消息 | 仅移除僵尸 tool_result，较为初级 |
| 时间微压缩 | 完整实现 — 基于时间戳移除旧工具调用对，可服务端缓存编辑 | **占位**（no-op） |
| 缓存微压缩 | 服务端缓存编辑，保持缓存热度 | **占位**（no-op） |
| 会话记忆 | 完整实现，压缩至会话记忆格式 | 有实现但较简单 |
| 自动压缩 | 完整实现（13K），独立 prompt，使用 Haiku，滞后追踪防止重复压缩 | 有实现但使用默认 provider，熔断器更简单 |
| 上下文坍塌 | CONTEXT_COLLAPSE feature — 提交日志回放，非破坏性 | 有恢复 L4（保留最后 4 条消息）但不支持回放 |
| 响应式压缩 | prompt-too-long + media size errors 双重触发 | 仅 prompt_too_long |

关键差距：
- **无缓存编辑**（Claude 可以利用 API 的 cache 编辑能力在服务端做压缩而不打破缓存）
- **无滞后追踪**（频繁压缩的防护较简单）
- **不使用 Haiku**（压缩的 LLM 调用成本高）

### 2.8 子代理系统 — 深度与广度（差距：高）

| Claude Code 有，AttaSeek 缺/弱 | 影响 |
|---|---|
| **AgentTool 234K** — 功能极其丰富 | AttaSeek 的 SubAgentManager 仅是其子集 |
| **代理恢复**（`resumeAgent`）— 从 sidechain 恢复后台代理 | 代理不可恢复 |
| **`.claude/agents/` 目录加载** — 自定义代理定义 | 仅有内置代理，无自定义代理加载 |
| **任务类型**：local_bash, local_agent, remote_agent, in_process_teammate, local_workflow, monitor_mcp, dream | AttaSeek 基本仅 `local_agent` 类型 |
| **权限模式继承**：bubble, auto, restricted | 子代理权限处理较简单 |
| **Fork 缓存共享**（byte-identical prefix） | 有 CacheManager 但无 byte-identical 策略 |
| **Coordinator 模式完整实现** — 依赖感知并行子任务 | AttaSeek 的 CoordinatorMode 是 MVP 桩（decompose 返回单任务） |
| **WorkflowTool** — 多代理编排脚本引擎（pipeline/parallel/phase） | **完全缺失** |
| **团队模式**（TeamCreate/Delete, TeammateIdle） | **完全缺失** |
| **进程内 teammate** | **完全缺失** |

### 2.9 其他 Claude Code 独有能力（AttaSeek 完全缺失）

| 能力 | 说明 |
|------|------|
| **Bridge / Always-On** | WebSocket 连接到 claude.ai，支持远程控制 |
| **插件系统** | 类 VS Code 扩展系统（添加工具/hook/命令/MCP/系统提示） |
| **推测执行** | 用户输入时预生成回复（低延迟 UI 建议） |
| **Voice Mode** | 语音转文字 |
| **Feature Gates** | `feature('NAME')` 编译级死代码消除 |
| **OTel 遥测** | OpenTelemetry 分布式追踪 |
| **VCR 测试** | 录制 API 调用用于回放测试 |
| **自动分类器** | 独立 LLM 调用判定工具安全性 |
| **Bash 推测** | 预分类 bash 命令加速权限决策 |
| **拒绝追踪** | 累计拒绝次数并升级提示 |
| **Auto-Dream** | 自动生成后续问题建议 |

---

## 三、架构范式对比

| 范式 | Claude Code | AttaSeek | 评价 |
|------|-------------|----------|------|
| **主循环** | AsyncGenerator + State 不可变覆盖 | AsyncGenerator + AgentState 不可变模式 | 对齐 |
| **工具接口** | 垂直单体（每工具约 40 属性，包含渲染/权限/进度） | 水平分离（manifest + 实现分离） | 各有优劣 — AttaSeek 更模块化但逐工具 UI 定制力弱 |
| **Provider 抽象** | 无统一接口——API 调用直接嵌入 query 函数 | `LLMProvider` 接口 + 工厂模式 | AttaSeek 更规范，易于扩展 |
| **Prompt 组装** | 分散在多个位置（系统提示部分 + 动态附件） | 集中式 `PromptTemplate` + 优先级分段 | AttaSeek 更清晰 |
| **状态管理** | 全局 AppState Store（~130 字段） | Jotai 原子化 + 事件总线 | AttaSeek 更细粒度，适合多面板 UI |
| **权限层级** | Hook → 规则 → 自动分类器 → 用户对话框（4 层） | 权限策略 + 用户对话框（2 层） | Claude 更安全 |
| **压缩策略** | 6 级 + 服务端缓存编辑 + 滞后追踪 + Haiku 专用模型 | 多级 + 熔断器 + 默认 Provider | Claude 更高效 |
| **单例管理** | 无集中模式——服务通过 AppState 获取 | 明确的 Singleton 模式（6+ 个单例） | AttaSeek 更简单但有紧耦合风险 |

---

## 四、优先级建议

### 高优先级（影响核心 Agent 质量，建议近期补上）

1. **模型回退链** — 容量不足时自动切换备选模型，生产必备
2. **Hooks 事件补全** — 至少补上 `PostToolUseFailure`、`SubagentStart/Stop`、`TaskCreated/Completed`
3. **子代理 `.claude/agents/` 加载** — 让用户可自定义代理，解锁真正多代理场景
4. **上下文压缩深化** — Snip 从"仅移除僵尸"升级到"移除中间保留首尾"；时间微压缩从占位到实现
5. **压缩使用 Haiku** — 降低压缩的 LLM 调用成本
6. **工具输入预校验** — `validateInput` 在权限检查前运行

### 中优先级（显著提升能力广度）

7. **Hook `agent` + `http` 类型** — 允许 hook 委托子代理或调用外部 API
8. **Coordinator 模式完整实现** — 从单任务桩升级到依赖感知并行分解
9. **MCP OAuth 认证** — 接入需要 OAuth 的 MCP 服务
10. **延迟 MCP 工具加载** + ToolSearch — 大型 MCP 服务启动优化
11. **逐工具 UI 渲染** — `renderToolUseProgress` 至少支持长时工具进度
12. **`max_output_tokens` 逐级升级** — 长输出场景自动恢复
13. **Workflow 引擎** — 多代理编排（pipeline/parallel/phase），Claude Code 的差异化能力

### 低优先级（锦上添花，或 AttaSeek 自身定位不需要）

14. 插件系统（类 VS Code 扩展）
15. 团队记忆同步 / 团队协作工具
16. OTel 遥测 + VCR 测试
17. Voice Mode
18. Bridge / Always-On 连接（AttaSeek 定位不同）
19. Feature Gates（打包优化，非功能需求）
20. 推测执行 / Auto-Dream

---

## 五、AttaSeek 的差异化优势

在追赶 Claude Code 的同时，AttaSeek 有几项**不应丢弃**的自身优势：

1. **Profile 驱动架构** — `AgentProfile` 声明式配置比 Claude Code 的分散配置更清晰，适合多场景切换
2. **LLMProvider 接口抽象** — 比 Claude Code 的 vendor-locked 模式更具扩展性
3. **PromptTemplate 分段组装** — 优先级+条件筛选机制比 Claude Code 的分散 prompt 组装更利于维护
4. **AgentEventBus** — 解耦的事件分发，适合多面板 GUI（Claude Code 是单 CLI TUI）
5. **文档/写作工具** — Claude Code 无此能力，差异化场景
6. **MemdirManager** — MEMORY.md 索引管理比 Claude Code 的直接文件读取更结构化
