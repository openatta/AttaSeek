# Agent 测试体系 需求规格

**目标：** 为 Agent Engine V2 建立两层测试体系——Mock 场景测试覆盖功能逻辑路径，LLM 集成测试验证真实 API 交互下的端到端行为。

**背景：** 当前 Agent 模块仅有 4 个单元测试（`AgentOrchestrator.test.ts`）覆盖构造和默认值。缺乏对核心执行循环、工具调用、权限流程、上下文压缩、记忆提取、子 Agent fork 的功能验证。参考 AttaCode 的 89 场景数据驱动测试 + 对照实验方案，为 AttaSeek 设计适配 TypeScript/Electron 环境的等效体系。

---

## 范围

### In scope

**第一类：Mock 场景测试**

1. **MockLLMProvider** — 实现 `LLMProvider` 接口的模拟器，支持预编程 FIFO 队列的 LLM 响应。每个 `chatStream()` 调用消费队列中下一个预定义 turn。支持注入 `text_delta`、`tool_use`、`end_turn`、`error` 响应。

2. **场景 JSON 驱动** — 测试用例以 JSON/Markdown 文件定义（参考 AttaCode 的 89 场景）。每个场景定义：agent profile、用户输入、mock LLM 响应序列、期望的工具调用、期望的事件序列、期望的最终状态。运行器读取场景文件，注入 MockLLMProvider，执行 AgentOrchestrator，逐断言验证。

3. **工具真实执行** — 仅 LLM 被 mock，工具实现（ToolImplementations）真实运行。测试可验证工具结果内容是否正确注入消息历史。

4. **权限模拟** — Mock 权限决策注入：`allow`（直接允许）、`deny`（拒绝）、`ask_approve`（用户批准）、`ask_deny`（用户拒绝）。不依赖真实 PermissionBridge 的 UI 交互。

5. **场景覆盖矩阵** — 至少覆盖以下路径：
   - 纯文本回复（无工具调用）— end_turn 路径
   - 单工具调用往返（read_file → 返回文件内容 → LLM 回复）
   - 多工具并行调用（read_file + search_code 并行）
   - 权限拒绝路径（risky 工具 → deny → 任务终止）
   - 权限确认路径（risky 工具 → ask → approve → 继续）
   - 多轮工具循环（3+ turns）
   - 上下文压缩触发（消息超 85% 预算 → 自动 compact）
   - 用户中断（AbortController signal）
   - 无 provider 配置 → no_provider 终止
   - LLM API 错误 → model_error 终止
   - 子 Agent fork → 完成 → 结果注入主 Agent

**第二类：LLM 集成测试**

6. **真实 LLM 调用** — 使用真实 API key（环境变量配置），调用真实 LLM 驱动 AgentOrchestrator 完成预定义任务。验证端到端行为：Agent 能否理解目标、选择合适的工具、生成合理输出。

7. **多阶段提示词** — 集成测试使用结构化提示词：给定项目环境（文件树 + 文件内容）→ Agent 探索 → Agent 修改 → Agent 验证。每阶段验证中间状态。

8. **测试任务设计** — 设计 3-5 个核心任务覆盖主要场景：
   - 代码探索任务：给定一个包含 bug 的 TypeScript 文件，要求 Agent 找到 bug 并修复
   - 文档生成任务：要求 Agent 分析代码并生成 README
   - 多步骤重构任务：要求 Agent 跨多个文件提取公共逻辑
   - （可选）研究任务：给定一个主题，要求 Agent 搜索并生成结构化报告

9. **结果验证** — 每轮测试后验证：Agent 是否调用了预期的工具类别、是否产生了有效的输出、token 消耗是否在合理范围内、是否存在错误或恢复。

10. **测试运行脚本** — 提供 `npm run test:agent:mock` 和 `npm run test:agent:live` 命令。前者在 CI 中运行（无外部依赖），后者需要 `ATTASEEK_API_KEY` 环境变量手动运行。

### Out of scope

- UI 层面的 E2E 测试（Electron renderer + Playwright）
- 性能基准测试（benchmark / latency）
- 与外部 Agent 的 A/B 对照实验（如 AttaCode 的 comparison-lab）
- 多 Agent 协调器（Coordinator）测试
- 真实 MCP 服务器交互测试

### 前置依赖

- Agent Engine V2 模块已就绪（`AgentOrchestrator`、`LLMProvider` 接口、`AgentProfile`、`ToolOrchestrator` 等）
- `vitest` 测试框架已配置
- `src/main/agent/llm/LLMProvider.ts` 中的 `LLMProvider` 接口支持 mock 注入
- `AgentOrchestrator` 支持依赖注入（provider 参数化）

---

## 用户场景

### 场景 1: Mock 测试 — 纯文本回复路径

- **给定:** MockLLMProvider 预编程一个 turn：`text_delta("Hello")` → `message_stop`
- **当:** 执行 `orchestrator.submitMessage(task, profile)`
- **则:** 事件流 yied `AgentMessage` → `AgentMessageChunk("Hello")` → `TaskCompleted`；terminal reason = `completed`；消息历史包含 1 条 assistant 消息

### 场景 2: Mock 测试 — 单工具调用往返

- **给定:** MockLLMProvider 预编程两个 turn：turn1: `tool_use(read_file, {path: "test.ts"})` → turn2: `text_delta("Found bug on line 5")`
- **当:** 执行 orchestrator
- **则:** ToolCallStarted(read_file) → ToolExecutor 真实读取文件 → ToolCallFinished(含文件内容) → AgentMessage(text_delta + message_stop) → TaskCompleted；消息历史包含 tool_result 块

### 场景 3: Mock 测试 — 权限拒绝

- **给定:** MockLLMProvider 预编程：`tool_use(git_commit)` → 权限模拟返回 `deny`
- **当:** 执行 orchestrator
- **则:** ToolCallStarted → ToolCallFinished(permissionDecision=deny) → terminal reason = `denied`；git_commit 未被实际执行

### 场景 4: Mock 测试 — 上下文压缩触发

- **给定:** 大量预填充的消息历史（接近 token 预算 85%）+ profile 启用 autoCompact
- **当:** 继续执行新 turn
- **则:** shouldCompact 返回 true → compactConversation 被调用 → CompactBoundary 事件被 yield → 消息历史被压缩

### 场景 5: LLM 集成测试 — 代码探索与修复

- **给定:** 临时目录创建项目 + 一个包含 bug 的 TypeScript 文件；环境变量 ATTASEEK_API_KEY 已配置
- **当:** 使用 coding-profile 提交 prompt "find and fix the bug in src/bug.ts"
- **则:** Agent 调用 read_file 读取文件 → 识别 bug → 返回修复后的代码；至少调用 1 次 read_file 工具；最终状态 = completed

### 场景 6: LLM 集成测试 — 多步骤重构

- **给定:** 临时目录包含 3 个文件，每个有重复的 helper 函数
- **当:** 使用 coding-profile 提交 prompt "extract the duplicated helper into a shared module"
- **则:** Agent 读取文件 → 分析重复 → 创建新共享文件（create_document）或返回重构方案；工具调用 > 1 次

### 场景 7: 边界条件 — Mock 测试运行不依赖 API key

- **给定:** 未设置 ATTASEEK_API_KEY
- **当:** 运行 `npm run test:agent:mock`
- **则:** 所有 mock 场景测试正常运行并全部通过；不发起任何网络请求

---

## 待澄清

- [ ] LLM 集成测试是否纳入 CI（需要 API key），还是仅本地手动运行？
   - 本地手动；
- [ ] 场景 JSON 文件存放路径：`test/agent/scenarios/` 还是 `test/fixtures/agent/`？
   - 你定，长期有利为准；
- [ ] 是否需要测试多 profile 场景（coding + research + writing），还是先聚焦 coding profile？
   - 保留架构，先聚集coding，对齐参考；
- [ ] 权限模拟的 `ask` 路径：是否需要一个专门的 `MockPermissionBridge` 来注入用户决策？
   -  可以，注入用户决策好了；

---

## 风险

- **MockLLMProvider 与实际 LLM 行为偏差风险** — mock 的 SSE chunk 序列可能与真实 Anthropic API 的 chunk 顺序/粒度不一致，导致 mock 测试通过但真实调用失败。需要定期用集成测试校准 mock 响应模式。
- **集成测试 API 成本风险** — 每次集成测试消耗真实 API token。需要控制测试频率（不进入 CI）和 prompt 长度（使用小任务）。
- **场景爆炸风险** — 参考 AttaCode 89 场景 + 持续增长，维护负担增加。需要场景分类和去重机制。
- **工具真实执行带来的环境依赖** — 场景测试中 `read_file` 依赖实际文件系统状态，需要标准化的临时目录创建/清理逻辑。
- **权限模拟侵入性** — 当前 `ToolExecutor` 直接调用 `PermissionService` 和 `PermissionBridge`，没有注入点。可能需要重构以支持权限决策注入。
