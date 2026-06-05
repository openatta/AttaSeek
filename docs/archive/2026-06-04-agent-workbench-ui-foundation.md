# Agent Workbench UI 基础架构设计

> **日期：** 2026-06-04
> **状态：** 草稿
> **关联需求：** `docs/requirements/2026-06-04-agent-workbench-foundation-spec.md`

---

## 1. 设计结论

AttaSeek 的长期 UI 基础架构采用：

```text
ActivityBar + Sidebar + AppSpace { AgentPane + ArtifactPane }
```

其中：

- `ActivityBar` 是平台级一级导航。
- `Sidebar` 是当前 Activity 的上下文导航。
- `AgentPane` 是与 AI 交互的核心面板，默认承载 Conversation。
- `ArtifactPane` 是完整产物展示、编辑、预览和审查区域。

这个结构保留自然语言交互作为产品核心，同时允许不同垂直场景通过插件扩展 Sidebar、Skills、Tools、Inline Renderers 和 Artifact Renderers。

---

## 2. 为什么不是传统 Workspace-first

传统结构通常是：

```text
ActivityBar + Sidebar + Workspace
```

不同应用在 Workspace 内提供完整业务 UI，例如文档编辑器、交易看盘页、项目管理页。

这种方式适合传统软件，但容易让 AI 退化为侧边助手。AttaSeek 的目标不是"传统软件 + AI 助手"，而是"以 Agent 为中心的工作台"。

因此核心交互应始终围绕：

```text
用户提出目标
-> Agent 理解 / 计划 / 执行
-> Conversation 展示过程和确认
-> Artifact 展示完整结果
-> 用户在 Artifact 中人工编辑或审阅
```

---

## 3. 总体布局

### 3.1 标准布局

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

### 3.2 组件层级

```text
Shell
  ActivityBar
  SidebarSlot
  AppSpace
    AgentPane
      Conversation
      InlineArtifactPreview
      ToolCallCard
      PermissionInline
      AgentStatus
      Composer
    ArtifactPane
      ArtifactTabs
      ArtifactRendererHost
      ArtifactToolbar
```

---

## 4. ActivityBar

ActivityBar 是平台级入口，不属于任何垂直应用。

职责：

- 切换 Activity
- 展示全局入口
- 提供插件入口
- 显示全局状态 badge

示例入口：

```text
Home
Chat
Projects
Documents
Trading
Mail
Plugins / Skills
Settings
```

ActivityBar 只决定当前 Activity，不直接决定具体业务逻辑。

---

## 5. Sidebar

Sidebar 是 Shell 级容器，但内容由当前 Activity 或插件贡献。

职责：

- 展示当前 Activity 的上下文导航
- 支持搜索、过滤、分组、折叠
- 管理当前场景的列表型上下文

示例：

| Activity | Sidebar 内容 |
|---|---|
| Chat | 会话列表、项目分组、归档 |
| Projects | 项目列表、文件树、任务 |
| Documents | 文档列表、模板、最近编辑 |
| Trading | Watchlist、持仓、策略、日志 |
| Mail | 邮箱、分类、重要邮件、待办 |
| Settings | 设置分类 |

设计原则：

- Sidebar 容器归 Shell 管理。
- 插件只贡献 Sidebar 内容，不重复实现 Sidebar 容器。
- Sidebar 的宽度、折叠、标题栏、安全区、空状态保持平台一致。

---

## 6. AgentPane

AgentPane 是产品的核心交互面板，默认承载 Conversation。

### 6.1 定位

AgentPane 不是普通聊天框，而是 Agent 的控制台。

负责：

- 接收用户自然语言目标
- 展示 Agent 计划
- 展示执行进度
- 展示工具调用摘要
- 展示权限确认
- 展示错误、暂停、重试
- 展示轻量中间结果
- 引导用户打开 Artifact

不负责：

- 渲染完整复杂图表
- 承载长文档编辑
- 直接调用 LLM
- 直接执行工具
- 直接写文件或数据库

### 6.2 Conversation 中可嵌入内容

Conversation 支持轻量 Inline Artifact Preview。

适合嵌入：

- Markdown 摘要
- 小型走势图
- 小型脑图预览
- Diff 摘要
- 表格摘要
- 工具结果卡片
- 文件 / Artifact 引用卡片

不适合完整嵌入：

- 长文档编辑器
- 完整交易图表
- 完整脑图编辑器
- 大型表格
- 复杂 Dashboard
- 长回测报告

这些内容应在 ArtifactPane 中完整展示。

### 6.3 AgentPane 事件流

AgentPane 通过统一事件流渲染状态：

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

AgentPane 不关心具体业务插件如何执行，只消费事件和 Artifact 引用。

---

## 7. ArtifactPane

ArtifactPane 是完整产物区。

### 7.1 定位

ArtifactPane 承载 Agent 输出的正式结果，并支持用户人工编辑、审阅和继续操作。

负责：

- 展示完整 Artifact
- 支持多 Tab
- 支持编辑
- 支持版本对比
- 支持导出
- 支持局部修改入口
- 支持插件 Renderer

### 7.2 Artifact 类型

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
ResearchReport
TradePlan
RiskCheck
EmailDraft
TaskList
JournalEntry
ReviewReport
```

### 7.3 Renderer Registry

ArtifactPane 通过 Renderer Registry 选择渲染器：

```text
markdown -> Markdown Renderer
html -> WebView / iframe Renderer
svg -> SVG Renderer
chart -> Chart Renderer
code -> Monaco Renderer
diff -> Diff Renderer
table -> Table Renderer
form -> Form Renderer
custom -> Plugin Renderer
```

ArtifactPane 不直接理解业务含义，只根据 Artifact 类型、renderer hint 和插件注册信息渲染。

---

## 8. 插件扩展模型

垂直产品不应重写 Shell。

插件贡献：

```text
Activity entry
Sidebar view
Skills
Tools
Conversation inline renderers
Artifact types
Artifact renderers
Artifact actions
Settings pages
Permission defaults
```

### 9.1 企业知识工作台插件

```text
Sidebar:
- 项目
- 文档
- 邮件
- 模板

Inline:
- 文档摘要
- 邮件摘要
- 任务列表摘要

Artifact:
- Document
- EmailDraft
- MindMap
- TaskList
```

### 9.2 个人交易员工作台插件

```text
Sidebar:
- Watchlist
- 持仓
- 策略
- 日志

Inline:
- 小型走势图
- 交易计划摘要
- 风控摘要

Artifact:
- Chart
- ResearchReport
- TradePlan
- RiskCheck
- JournalEntry
- ReviewReport
```

---

## 9. Conversation 与 Artifact 的分工

| 内容 | Conversation / AgentPane | ArtifactPane |
|---|---|---|
| 用户输入 | 主要承载 | 不承载 |
| Agent 计划 | 展示摘要，可展开 | 可生成计划 Artifact |
| 工具调用 | 卡片摘要 | 详细日志可作为 Artifact |
| 权限确认 | 主要承载 | 可展示操作预览详情 |
| Markdown 短摘要 | 可嵌入 | 可完整展示 |
| 图表 | 轻量预览 | 完整交互图表 |
| 脑图 | 缩略预览 | 完整编辑器 |
| 文档 | 引用和摘要 | 完整编辑器 |
| Diff | 摘要和跳转 | 完整审查 |
| 交易计划 | 摘要和确认 | 完整计划和风险检查 |
| 复盘报告 | 摘要 | 完整报告 |

原则：

> Conversation 承载交互、过程、确认和轻量预览；Artifact 承载完整结果、复杂交互和人工编辑。

---

## 10. 长期设计原则

1. Conversation 是所有垂直场景的默认核心交互面板。
2. ArtifactPane 是完整产物和人工编辑面板。
3. Sidebar 是当前场景上下文，但容器归 Shell 管理。
4. ActivityBar 是平台级导航，不承载业务逻辑。
5. 插件扩展内容，不替换 Shell 结构。
6. 复杂业务 UI 应优先成为 Artifact Renderer，而不是独立重写 Workspace。
7. AgentPane 和 ArtifactPane 是固定布局，AgentPane 在左、ArtifactPane 在右，通过拖拽分隔线调整宽度。
8. 用户可以从自然语言进入工作流，也可以在 Artifact 中直接人工编辑。

---

## 11. 最终结论

推荐长期 UI 架构：

```text
Shell
  ActivityBar
  Sidebar
  AppSpace
    AgentPane
      Conversation
      Inline Previews
      Tool Cards
      Permission UI
    ArtifactPane
      Artifact Tabs
      Renderers
      Editors
```

一句话总结：

> AttaSeek 的 UI 应以 Conversation 作为所有垂直场景的自然语言入口，以 ArtifactPane 作为完整产物与人工编辑区域，以 Sidebar 承载当前场景上下文。这样既保持 AI-native 产品心智，又能长期支持企业知识、交易员、代码、文档等不同垂直平台。
