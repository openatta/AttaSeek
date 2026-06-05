# Agent Engine V2 需求规格

**目标：** 构建通用 Agent 执行引擎，一套引擎支撑编码、科研、文档编写、运营、数据分析、股票交易六个领域场景，每个领域仅需替换提示词、工具集和技能配置。

**背景：** 当前 AttaSeek Agent（`AgentLoop`）是单体的、硬编码 MVP 实现——提示词是内联字符串、工具和记忆是固定配置、上下文无压缩机制。Claude Code 的 `QueryEngine` 证明了通用执行引擎设计是可行的：同一个引擎驱动编程主 Agent、压缩 Agent、记忆提取 Agent、Explore/Plan/Verify 子 Agent。AttaSeek 需要借鉴这个模式，构建自己的通用 Agent 引擎。

---

## 范围

### In scope

1. **通用 Agent 执行引擎** — 一个与领域无关的 `AgentOrchestrator`，负责：上下文组装、LLM 调用、工具执行循环、上下文压缩、记忆提取、结果收尾。所有六个领域共享同一套引擎代码。

2. **AgentProfile 场景配置系统** — 每个领域场景通过声明式 profile 定义：系统提示词模板、可用工具列表、技能集、记忆策略、上下文窗口预算、执行策略。引擎读取 profile 后自适应执行。

3. **提示词模板系统** — 分节（Section）组装系统提示词，支持静态文本和动态生成函数，支持条件注入（按场景、按上下文状态）。每个领域有自己的提示词模板文件。

4. **上下文压缩机制** — 当对话历史接近 token 窗口上限时，自动触发 LLM 驱动的对话摘要压缩，用结构化摘要替换早期消息，保留最近 K 条完整消息。参考 Claude Code 的 `services/compact/`。

5. **记忆自动提取** — 任务/对话完成后，调用 LLM 自动提取关键事实、偏好、决策，去重后存入持久记忆。下次任务时自动召回相关记忆注入上下文。参考 Claude Code 的 `services/extractMemories/`。

6. **工具执行管道** — 通用工具执行 pipeline：查找清单 → 权限检查 → （可选）用户确认 → 执行 → 审计日志。支持并行执行无依赖工具。错误分类（可恢复/不可恢复）。

7. **多 Agent 架构** — 支持子 Agent 创建与管理：主 Agent 可 fork 子 Agent 处理独立子任务，子 Agent 共享父 Agent 部分上下文，隔离工作空间。参考 Claude Code 的 `AgentTool` + `runAgent` + `forkSubagent`。

8. **六个领域 Profile** — 预置六个场景配置：
   - 编码（coding）：编程语言工具、代码分析技能、Git 集成
   - 科研（research）：文献搜索、多源验证、引用管理、深度研究
   - 文档编写（writing）：内容创作、格式化、版本对比、审阅
   - 运营（operations）：系统监控、日志分析、告警处理、自动化
   - 数据分析（data-analysis）：数据查询、统计计算、可视化生成
   - 股票交易（trading）：行情查询、技术分析、风险评估、策略回测

9. **流式事件输出** — 引擎以 AsyncGenerator 模式 yield 事件（而非回调），渲染进程实时消费。事件类型覆盖完整生命周期：AgentMessageChunk、ToolCallStarted/Finished、PermissionRequested、CompactBoundary、MemoryExtracted。

10. **上下文生命周期管理** — 精确 token 预算分配（系统提示词 / 工具定义 / 记忆上下文 / 消息历史 / 回复预留），每轮执行前检查，超限触发压缩。

### Out of scope

- Agent 引擎的具体 UI 交互（这是 renderer 层的职责，引擎只产出事件）
- 领域特定的工具实现（引擎提供工具接口和注册机制，各领域工具按需开发）
- 多 Agent 协调器/Team 模式（先做单 Agent + fork 子 Agent，Coordinator 模式留到后续版本）
- Agent 网络通信/远程执行（本地 Agent 优先）
- 模型训练或微调

### 前置依赖

- 当前 `AgentLoop`、`ContextBuilder`、`LLMProvider`、`MemoryService`、`ToolExecutor` 的可复用部分
- `shared/types/` 中已有的类型定义
- `AgentEventBus` 事件系统（保持不变）
- Electron IPC 桥接（保持不变）
- `better-sqlite3` 持久化（保持不变）

---

## 用户场景

### 场景 1: 正常流程 — 用户发起编码任务

- **给定:** 用户已配置 LLM API key，当前处于编码 profile
- **当:** 用户在 Composer 输入"帮我重构 src/main/agent/AgentLoop.ts，拆成多个模块"
- **则:**
  1. `AgentRuntime` 创建任务，调用 `AgentOrchestrator.submitMessage()`
  2. 引擎加载 coding-profile，组装系统提示词（编码助手身份 + 代码工具说明 + 项目文件结构 + 记忆上下文）
  3. 引擎进入工具循环：LLM 返回工具调用（read_file、search_code）→ 引擎执行工具 → 结果返回 LLM → LLM 继续推理
  4. 渲染进程实时收到 AgentMessageChunk 流式文本和 ToolCard 事件
  5. 任务完成：生成 artifact（代码 diff），提取记忆（用户偏好、项目约定），自动生成标题
  6. 用户可在对话历史中看到完整过程

### 场景 2: 正常流程 — 用户发起科研任务

- **给定:** 用户切换到 research profile
- **当:** 用户输入"调研 2025-2026 年 LLM Agent 框架的最新进展"
- **则:**
  1. 引擎加载 research-profile（研究者身份 + 搜索/提取/验证工具 + 深度研究技能）
  2. 引擎调用 WebSearch 工具 → LLM 分析搜索结果 → 调用 WebFetch 深入阅读 → LLM 综合
  3. 支持多轮自主搜索和验证（research profile 默认 maxTurns 更高）
  4. 输出结构化研究报告 artifact

### 场景 3: 上下文窗口即将溢出时自动压缩

- **给定:** 用户与 Agent 进行了大量对话，上下文接近 token 上限
- **当:** 引擎的 ContextCompactor 检测到 token 使用率超过 85%
- **则:**
  1. 引擎暂停正常执行
  2. 将早期消息打包，调用 LLM（压缩专用 prompt）生成结构化摘要
  3. 用摘要替换早期消息，保留最近 5 轮完整对话
  4. yield CompactBoundary 事件通知渲染器
  5. 继续正常执行

### 场景 4: 主 Agent fork 子 Agent 处理独立子任务

- **给定:** 用户启动了一个编码项目，需要同时进行代码审查
- **当:** 主 Agent 判断代码审查是独立任务，调用 `forkSubagent('review')`
- **则:**
  1. 创建子 Agent，分配 review profile（审查专用提示词 + 只读工具）
  2. 子 Agent 在隔离上下文中执行（共享项目文件信息，但不共享对话历史）
  3. 子 Agent 完成后将结果返回给主 Agent
  4. 主 Agent 将子 Agent 结果整合到回复中

### 场景 5: 异常流程 — LLM API 调用失败

- **给定:** 引擎正在执行任务
- **当:** LLM API 返回 429（速率限制）或 5xx（服务端错误）
- **则:**
  1. 引擎按错误类型进入升级恢复梯：透明重试（1次）→ 等待后重试 → 上下文坍缩 → 反应式压缩 → 任务失败并报告用户
  2. 每次升级 yield 相应事件，renderer 可展示恢复进度

### 场景 6: 边界条件 — 用户中断执行

- **给定:** 引擎正在执行工具循环
- **当:** 用户点击"停止"按钮
- **则:**
  1. `AgentRuntime.cancelTask()` → AbortController 信号传播
  2. 引擎在下一个检查点（LLM 调用后 / 工具执行前）检测到取消信号
  3. 清理资源（abort LLM 请求、取消待处理工具）
  4. yield TaskFailed 事件（recoverable: false）
  5. 保留已完成的部分结果

### 场景 7: 边界条件 — 无 LLM Provider 配置

- **给定:** 用户未配置任何 LLM API key
- **当:** 用户尝试发起任务
- **则:**
  1. 引擎检测到无可用 provider
  2. yield SystemNotification 事件指向 Settings 页面
  3. 不发起任何 API 调用
  4. 任务状态设为 failed

---

## 待澄清

- [ ] 多 Agent 协调器（Coordinator 模式 / Team 模式）的优先级是否足够高，还是先聚焦单 Agent + fork？
    - 多 Agent协调器需要实现，这个是核心功能；
- [ ] 文件系统记忆（CLAUDE.md / .attaseek/memory/*.md）是否需要在 V2 中实现，还是延后到 V3？
    - 需要实现；
- [ ] 六个场景中，哪些需要优先交付（MVP 先支持哪几个）？
    - 编程，文档，科研； 编程能力对齐claude
- [ ] 工具并行执行的安全限制：默认最大并发数是多少？是否需要每个工具的并发安全声明？
    - 16个吧，可以配置；不用；

---

## 风险

- **上下文压缩质量风险** — LLM 生成的摘要可能丢失关键信息，导致后续对话质量下降。需要压缩验证机制（摘要后追问确认关键信息保留）。
- **多 Agent 资源消耗风险** — 每个子 Agent 独立调用 LLM API，token 消耗翻倍，成本可控性需要预算帽机制。
- **Profile 配置复杂度风险** — 六个领域意味着六套提示词 + 工具 + 技能配置，维护工作量随领域增长。需要 Profile 验证和默认值回退机制。
- **与现有代码兼容性风险** — `AgentLoop` 的调用方（`AgentRuntime`、IPC handler）需要适配新接口，但不影响 renderer 层的事件消费（事件格式可保持向后兼容）。
- **Prompt 注入风险** — 不同领域的提示词模板需要防止用户输入混入系统提示词导致 prompt injection。模板系统需要参数化注入而非字符串拼接。
