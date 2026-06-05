# Agent Workbench 基础架构产品 SPEC

> **创建日期：** 2026-06-04
> **作者：** xbits / Codex
> **状态：** 草稿
> **适用范围：** 产品方向未定前的通用 Agent 工作台基座

---

## 1. 核心判断

当前可以先不决定最终产品方向。

无论后续做企业知识工作台、个人交易员工作台，还是其它垂直 Agent 产品，底层都需要同一套基础能力：

```text
AgentPane / Conversation
-> Agent Runtime
-> Skills
-> Tools
-> Memory
-> ArtifactPane / Artifact
-> Permission
-> Audit
```

因此第一阶段应集中建设"产品无关的 Agent Workbench 基座"。产品方向确定后，再通过插件、Skill、Tool、Conversation Inline Renderer、Artifact Renderer 和场景 Sidebar 扩展。

---

## 2. 产品定位

这是一个通用 Agent 桌面工作台基础架构，不绑定具体行业。

它的目标不是先做完整业务产品，而是先建立：

- 标准对话框架
- Agent 任务执行框架
- Skill 组合机制
- Tool 调用机制
- Artifact 产物系统
- 记忆系统
- 权限与审计系统
- 插件式场景扩展机制

后续业务产品通过插件化接入：

```text
企业知识工作台 = 通用基座 + 文档/邮件/知识库/项目 Skills
交易员工作台 = 通用基座 + 行情/图表/风控/交易 Skills
其它产品 = 通用基座 + 对应场景 Skills + Tools + Renderers
```

---

## 3. 架构原则

| 原则 | 说明 |
|---|---|
| 产品方向可插拔 | 基座不写死企业办公、交易、代码等业务逻辑 |
| UI 与 Agent 解耦 | Conversation 和 Artifact 只消费事件与状态，不直接执行任务 |
| Agent 与 Tools 解耦 | Agent 通过 Tool Registry / Tool Router 找工具，不直接依赖具体工具实现 |
| Artifact 与业务解耦 | Artifact 通过类型和 Renderer 渲染，不绑定某个产品场景 |
| Skill 可组合 | Skill 是可复用任务能力，不只是 Prompt 模板 |
| 权限独立 | 权限判断不放在 UI 卡片或具体工具里，而是统一服务 |
| 记忆可控 | 记忆必须可见、可编辑、可删除、可按项目/场景隔离 |
| 审计默认开启 | Agent 行为、工具调用、高风险操作默认留痕 |

---

## 4. 基础 UI

### 4.1 总体布局

长期 UI 基础结构与 `docs/design/2026-06-04-agent-workbench-ui-foundation.md` 对齐：

```text
ActivityBar + Sidebar + AppSpace { AgentPane + ArtifactPane }
```

标准布局：

```text
┌────────────┬──────────────┬────────────────────────────────────┐
│ Activity   │ Sidebar      │ AppSpace                            │
│ Bar        │              │                                    │
│            │              │ ┌────────────────┬───────────────┐ │
│            │              │ │ AgentPane       │ ArtifactPane  │ │
│            │              │ │ Conversation    │ Artifacts     │ │
│            │              │ └────────────────┴───────────────┘ │
└────────────┴──────────────┴────────────────────────────────────┘
```

### 4.2 ActivityBar

ActivityBar 是平台级一级导航，不属于具体产品插件。

负责：

- 切换 Activity
- 展示全局入口
- 提供插件入口
- 显示全局状态 badge

ActivityBar 只决定当前 Activity，不直接承载业务逻辑。

### 4.3 Sidebar

Sidebar 是 Shell 级容器，但内容由当前 Activity 或插件贡献。

负责：

- 展示当前 Activity 的上下文导航
- 支持搜索、过滤、分组、折叠
- 管理当前场景的列表型上下文

设计原则：

- Sidebar 容器归 Shell 管理。
- 插件只贡献 Sidebar 内容，不重复实现 Sidebar 容器。
- Sidebar 的宽度、折叠、标题栏、安全区、空状态保持平台一致。

### 4.4 AgentPane / Conversation

AgentPane 是用户与 Agent 的核心交互面板，默认承载 Conversation。

Conversation 不是普通聊天框，而是 Agent 的控制台。

负责：

- 接收用户自然语言目标
- 展示 Agent 消息
- 展示计划和任务进度
- 展示工具调用摘要
- 展示权限确认
- 展示错误、暂停、重试
- 展示轻量中间结果
- 引导用户打开或修改 Artifact

不负责：

- 渲染完整复杂图表
- 承载长文档编辑
- 直接调用 LLM
- 直接执行工具
- 直接写文件或写数据库
- 直接生成复杂 Artifact
- 直接处理业务逻辑

AgentPane 消费统一事件流：

```text
UserMessage
AgentMessage
PlanCreated
PlanUpdated
ToolCallStarted
ToolCallFinished
PermissionRequested
ArtifactCreated
ArtifactUpdated
TaskPaused
TaskCompleted
TaskFailed
```

Conversation 支持轻量 Inline Artifact Preview，例如 Markdown 摘要、小型走势图、小型脑图预览、Diff 摘要、表格摘要、工具结果卡片和 Artifact 引用卡片。完整文档、完整图表、脑图编辑器、大型表格、复杂 Dashboard 和长报告应在 ArtifactPane 中展示。

### 4.5 ArtifactPane

ArtifactPane 是完整产物区。

负责：

- 展示 Agent 生成的内容
- 支持多 Artifact Tab
- 根据 Artifact 类型选择 Renderer
- 支持编辑、版本、对比、导出、局部修改入口

Artifact 类型由插件扩展：

```text
Document
Markdown
HTML
SVG
Chart
Table
Code
Diff
Form
Dashboard
TradePlan
ResearchReport
EmailDraft
TaskList
RiskCheck
JournalEntry
ReviewReport
```

---

## 5. Agent Runtime

### 5.1 Agent 职责

Agent 是任务编排器，不是 UI 组件。

负责：

```text
理解用户目标
-> 组装上下文
-> 选择 Skill
-> 生成计划
-> 申请权限
-> 调用工具
-> 创建 / 修改 Artifact
-> 验证结果
-> 写入记忆
-> 写入审计
-> 输出总结
```

Agent 不应直接依赖具体业务 UI。

### 5.2 通用任务状态机

```text
idle
-> intake
-> context_assembling
-> skill_selecting
-> planning
-> awaiting_permission
-> executing
-> generating_artifact
-> verifying
-> writing_memory
-> completed
```

异常状态：

```text
paused
waiting_user_input
failed
cancelled
denied
```

### 5.3 AgentTask

每次用户请求创建一个 AgentTask。

```text
AgentTask
- id
- sessionId
- projectId
- goal
- domain
- status
- constraints
- contextRefs
- selectedSkills
- plan
- artifactRefs
- auditRefs
```

---

## 6. Skills

### 6.1 Skill 定位

Skill 是可组合的 Agent 能力单元。

它不是简单 Prompt，而是包含：

- 输入要求
- 输出类型
- 可用工具
- 默认计划
- 风险等级
- 验证规则

### 6.2 Skill 分层

```text
Atomic Skill
- summarize
- rewrite
- extract_todos
- classify
- generate_doc
- generate_chart
- review
- verify

Scenario Skill
- customer_email_response
- technical_proposal
- stock_research
- trade_plan_generator
- project_daily_report

Workflow Skill
- mail_to_doc_to_tasks
- requirement_to_plan_to_code
- research_to_trade_plan_to_journal
```

### 6.3 Skill 插件化

不同产品方向通过 Skill Pack 接入：

```text
enterprise-productivity-skill-pack
trading-workbench-skill-pack
coding-workflow-skill-pack
```

每个 Skill Pack 提供：

- Skills
- Tool dependencies
- Artifact types
- Renderer hints
- Default workflows
- Permission defaults

---

## 7. Tools

### 7.1 Tool 定位

Tool 是 Agent 操作外部能力和数据源的边界。

Tool 不直接操作 UI，只返回结构化结果。

### 7.2 Tool 分类

| 类型 | 示例 |
|---|---|
| Read Tool | 读文件、搜索知识库、查询行情、读取邮件、查询持仓 |
| Write Tool | 创建文档、更新 Artifact、写日志、创建任务、创建模拟订单 |
| Risky Tool | 发送邮件、删除文件、真实下单、推送代码、修改外部系统 |

### 7.3 Tool Registry / Router

Agent 不直接加载所有工具。

需要统一 Tool Registry 和 Tool Router：

```text
Tool Registry
- 记录所有可用工具
- 管理工具 schema
- 管理风险等级
- 管理所属插件

Tool Router
- 根据任务目标选择相关工具
- 控制注入给 LLM 的工具数量
- 避免上下文被工具 schema 撑爆
```

---

## 8. Memory

### 8.1 双层记忆

```text
L1 Session Scratchpad
- 当前任务临时上下文
- 中间结果
- 当前计划
- 工具调用结果摘要

L2 Persistent Memory
- 用户偏好
- 项目记忆
- 场景知识
- 长期任务状态
```

### 8.2 记忆要求

- 可查看
- 可编辑
- 可删除
- 可按项目隔离
- 可按插件/场景隔离
- 可关闭
- 使用重要记忆时应说明来源

### 8.3 写入策略

不是所有内容都写入长期记忆。

长期记忆只写：

- 用户明确要求记住的内容
- 稳定偏好
- 已确认项目决策
- 长期任务状态
- 可复用业务知识

敏感信息写入前应提示或要求确认。

---

## 9. Artifact System

### 9.1 Artifact 定位

Artifact 是 Agent 输出的可操作产物，不是普通聊天文本。

```text
Artifact
- id
- type
- title
- contentRef
- version
- sourceTaskId
- rendererHint
- editable
- permissions
```

### 9.2 Renderer Registry

ArtifactPane 通过 Renderer Registry 选择呈现方式：

```text
markdown -> Markdown Renderer
html -> WebView / iframe Renderer
svg -> SVG Renderer
code -> Monaco Renderer
diff -> Diff Renderer
chart -> Chart Renderer
table -> Table Renderer
form -> Form Renderer
custom -> Plugin Renderer
```

### 9.3 Artifact 操作

```text
create
update
patch
derive
compare
restore
export
```

Artifact 上的"继续修改"不直接调用 Agent，而是创建新的 AgentTask。

---

## 10. Permission & Audit

### 10.1 权限三态

```text
allow
ask
deny
```

权限可按以下维度配置：

- tool
- plugin
- project
- session
- risk level

### 10.2 高风险操作

高风险操作必须展示：

- 操作对象
- 操作预览
- 影响范围
- 风险等级
- 可回滚性
- 用户确认入口

### 10.3 审计日志

默认记录：

- taskId
- sessionId
- projectId
- toolId
- riskLevel
- input summary
- output summary
- permission result
- artifact refs
- timestamp

---

## 11. 插件式产品扩展

### 11.1 产品方向不写进基座

基座不应内置具体交易、邮件、企业知识库等业务规则。

产品方向通过插件接入：

```text
Product Plugin
- Activity entries
- Sidebar views
- Skills
- Tools
- Conversation inline renderers
- Artifact types
- Artifact renderers
- Artifact actions
- Permission defaults
- Settings pages
```

### 11.2 示例：企业知识工作台插件

```text
Skills:
- document_generation
- email_summary
- meeting_minutes
- project_report

Tools:
- read_doc
- search_kb
- draft_email
- create_task

Artifacts:
- Document
- EmailDraft
- MindMap
- TaskList

Inline:
- 文档摘要
- 邮件摘要
- 任务列表摘要
```

### 11.3 示例：交易员工作台插件

```text
Skills:
- market_research
- technical_analysis
- trade_plan_generator
- risk_checker
- trade_reviewer

Tools:
- market_data
- news_fetch
- portfolio_query
- order_preview
- broker_order

Artifacts:
- Chart
- ResearchReport
- TradePlan
- RiskCheck
- JournalEntry

Inline:
- 小型走势图
- 交易计划摘要
- 风控摘要
```

---

## 12. MVP 范围

第一阶段做产品无关基座：

1. ActivityBar + Sidebar + AppSpace 基础 Shell
2. AgentPane / Conversation 事件流框架
3. AgentTask 状态机
4. Skill Registry
5. Tool Registry / Router
6. Artifact Model + ArtifactPane Renderer Registry
7. Memory 基础模型
8. Permission Service
9. Audit Log
10. 插件声明机制
11. 一个 demo skill pack 验证闭环

暂时不做：

- 完整企业工作台
- 完整交易员工作台
- 自动化真实业务动作
- 大规模插件市场
- 多人协作
- 云端团队版

---

## 13. 成功标准

基座完成后，应满足：

- 可以用同一套 ActivityBar / Sidebar / AppSpace Shell 承载不同产品场景
- 可以用同一套 AgentPane / Conversation 承载不同产品场景的自然语言交互
- 可以用同一套 Agent Runtime 执行不同 Skill
- 可以接入不同 Tool Pack
- 可以在 ArtifactPane 中生成并渲染不同类型 Artifact
- 可以在 Conversation 中嵌入轻量 Inline Artifact Preview
- 可以对高风险 Tool 统一权限拦截
- 可以按项目/场景隔离记忆
- 可以记录 Agent 执行过程和工具调用
- 新产品方向可以通过插件式扩展，而不是重写主应用

---

## 14. 核心闭环

```text
用户目标
-> AgentPane / Conversation 创建 AgentTask
-> Agent 组装上下文
-> Agent 选择 Skill
-> Agent 路由 Tools
-> Permission 拦截高风险动作
-> Tools 返回结构化结果
-> Artifact Service 生成产物
-> AgentPane / Conversation 展示进度、确认和轻量预览
-> ArtifactPane 展示完整产物和编辑区
-> Memory 保存长期上下文
-> Audit 记录全过程
```

一句话总结：

> 先做产品无关的 Agent Workbench 基座，再用插件决定具体产品方向。这样能降低方向选择风险，同时让后续企业工作台、交易员工作台或其它垂直产品共享同一套核心能力。
