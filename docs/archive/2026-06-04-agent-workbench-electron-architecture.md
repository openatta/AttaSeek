# Agent Workbench Electron 架构设计

> **日期：** 2026-06-04
> **状态：** 已实施 (v0.2.0) — 核心架构对齐，参见末尾实施备注
> **基于需求：** `docs/requirements/2026-06-04-agent-workbench-foundation-spec.md`
> **基于 UI：** `docs/design/2026-06-04-agent-workbench-ui-foundation.md`

---

## 1. 设计目标

本设计定义 AttaSeek 的长期 Electron 基础架构。重点不是适配当前已有实现，而是建立一个可长期承载不同垂直 Agent 产品的通用基座。

长期目标：

```text
Shell UI
-> Agent Runtime
-> Skill Registry
-> Tool Registry / Router
-> Artifact Service
-> Memory Service
-> Permission Service
-> Audit Service
-> Plugin System
```

后续企业知识工作台、个人交易员工作台、代码工作台等，都应通过插件、Skill、Tool、Artifact Renderer 和 Sidebar 扩展接入，而不是重写主应用。

---

## 2. Electron 三层分工

### 2.1 Main Process

Main Process 是可信系统能力层。

负责：

- 创建 BrowserWindow
- 注册 IPC handlers
- 管理 Agent Runtime
- 管理 Tool 调用
- 管理插件加载
- 管理 SQLite / 文件系统 / 审计日志
- 管理权限策略
- 管理外部进程、MCP server、sidecar
- 管理高风险操作的最终拦截

不负责：

- React UI 渲染
- Conversation 消息 DOM
- Artifact 具体前端展示

建议目录：

```text
src/main/
  index.ts
  ipc/
    agent.ts
    artifact.ts
    tool.ts
    skill.ts
    memory.ts
    permission.ts
    audit.ts
    plugin.ts
  agent/
    AgentRuntime.ts
    AgentTaskRunner.ts
    AgentEventBus.ts
    ContextBuilder.ts
  skills/
    SkillRegistry.ts
    SkillLoader.ts
  tools/
    ToolRegistry.ts
    ToolRouter.ts
    ToolExecutor.ts
  artifacts/
    ArtifactService.ts
    ArtifactStore.ts
  memory/
    MemoryService.ts
  permission/
    PermissionService.ts
  audit/
    AuditService.ts
  plugins/
    PluginRegistry.ts
    PluginLoader.ts
  store/
    db.ts
    schema.ts
```

### 2.2 Preload

Preload 是安全桥。

负责：

- 通过 `contextBridge` 暴露最小 API
- 封装 renderer 可调用的 IPC
- 订阅 main process 事件流
- 屏蔽 Node.js / Electron 原生对象

不负责：

- 权限判断
- 数据持久化
- 工具执行
- 插件加载

建议暴露：

```text
window.api.agent
window.api.artifact
window.api.skill
window.api.tool
window.api.memory
window.api.permission
window.api.audit
window.api.plugin
window.api.theme
```

### 2.3 Renderer

Renderer 是 UI 和交互层。

负责：

- Shell 布局
- ActivityBar
- Sidebar
- AgentPane / Conversation
- ArtifactPane
- Inline Artifact Preview
- Permission UI
- Settings UI
- Renderer Registry
- Jotai 状态

不负责：

- 直接访问文件系统
- 直接访问 SQLite
- 直接调用 LLM
- 直接执行 Tool
- 直接加载外部插件进程

建议目录：

```text
src/renderer/
  layouts/
    Shell.tsx
    AppSpace.tsx
    SidebarSlot.tsx
    AgentPane.tsx
    ArtifactPane.tsx
  components/
    ActivityBar/
    Sidebar/
    Conversation/
    Artifact/
    Permission/
  renderers/
    markdown/
    html/
    svg/
    table/
    chart/
    code/
    diff/
  registries/
    activityRegistry.ts
    sidebarRegistry.ts
    inlineRendererRegistry.ts
    artifactRendererRegistry.ts
  atoms/
    shellAtom.ts
    sessionAtom.ts
    agentTaskAtom.ts
    eventAtom.ts
    artifactAtom.ts
    permissionAtom.ts
```

---

## 3. UI 架构

长期 UI 结构固定为：

```text
ActivityBar + Sidebar + AppSpace { AgentPane + ArtifactPane }
```

组件树：

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

### 3.1 ActivityBar

平台一级导航。

只负责切换 Activity，不直接执行业务逻辑。

### 3.2 SidebarSlot

Shell 级 Sidebar 容器。插件只贡献内容，不重复实现容器。

```text
Activity selected
-> SidebarRegistry resolves SidebarView
-> SidebarSlot renders SidebarView
```

### 3.3 AppSpace

AppSpace 固定包含 AgentPane 和 ArtifactPane。不同 Activity 可以影响默认 Artifact、Sidebar 内容、可用 Skill 和 Tool，但不替换 Shell 结构。

### 3.4 AgentPane

AgentPane 是自然语言交互核心，默认承载 Conversation。

AgentPane 只消费：

- SessionEvent
- AgentTask status
- PermissionRequest
- Artifact refs

AgentPane 不直接执行 Agent 或 Tool。

### 3.5 ArtifactPane

ArtifactPane 是完整产物与人工编辑区。

```text
Artifact
-> ArtifactRendererRegistry
-> ArtifactRendererHost
-> Renderer Component
```

Artifact 上的"继续修改"应创建新的 AgentTask，而不是直接调用具体业务逻辑。

---

## 4. Agent Runtime

Agent Runtime 位于 Main Process。

核心职责：

```text
User Intent
-> create AgentTask
-> build context
-> select skills
-> plan
-> permission precheck
-> execute tools
-> create/update artifacts
-> verify
-> write memory
-> write audit
-> emit events
```

### 4.1 AgentTask 状态机

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

### 4.2 AgentEventBus

Main Process 维护任务事件流，Renderer 订阅。

事件用于驱动 Conversation，而不是让 Renderer 轮询任务状态。

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

---

## 5. Skill 架构

Skill 是可组合 Agent 能力，不是简单 Prompt。

```text
Skill
- id
- name
- description
- inputSchema
- outputSchema
- requiredTools
- riskLevel
- defaultPlan
- verificationRules
```

Skill Registry 位于 Main Process。

Skill Pack 通过插件注册：

```text
enterprise-productivity-skill-pack
trading-workbench-skill-pack
coding-workflow-skill-pack
```

Renderer 只展示 Skill 信息和选择状态，不执行 Skill。

---

## 6. Tool 架构

Tool 是 Agent 访问外部能力和数据源的边界。

```text
Tool
- id
- pluginId
- name
- description
- inputSchema
- outputSchema
- riskLevel
- permissionPolicy
```

Tool 分类：

| 类型 | 示例 |
|---|---|
| Read | 读文件、搜索知识库、查询行情、读取邮件、查询持仓 |
| Write | 创建文档、更新 Artifact、写日志、创建任务、创建模拟订单 |
| Risky | 发送邮件、删除文件、真实下单、推送代码、修改外部系统 |

### 6.1 ToolRegistry

记录所有可用工具、schema、风险等级和所属插件。

### 6.2 ToolRouter

根据 AgentTask 选择相关工具，避免把所有工具 schema 注入 LLM 上下文。

### 6.3 ToolExecutor

统一执行工具，并接入：

- PermissionService
- AuditService
- ArtifactService
- Error handling

---

## 7. Artifact 架构

Artifact 是 Agent 输出的可操作产物。

```text
Artifact
- id
- sessionId
- taskId
- type
- title
- contentRef
- content
- version
- rendererHint
- editable
- createdAt
- updatedAt
```

### 7.1 ArtifactService

位于 Main Process。

负责：

- 创建 Artifact
- 更新 Artifact
- 版本记录
- 持久化
- 发出 ArtifactCreated / ArtifactUpdated 事件

### 7.2 ArtifactRendererRegistry

位于 Renderer。

负责根据 `type` / `rendererHint` 选择渲染组件。

最小 MVP Renderer：

```text
markdown
html
svg
json
table
```

后续扩展：

```text
chart
code
diff
document
dashboard
plugin-custom
```

---

## 8. Memory 架构

MemoryService 位于 Main Process。

分两层：

```text
L1 Session Scratchpad
- 当前任务临时上下文
- 中间结果
- 工具调用结果摘要

L2 Persistent Memory
- 用户偏好
- 项目记忆
- 场景知识
- 长期任务状态
```

Renderer 可查看、编辑、删除记忆，但所有操作通过 IPC。

长期记忆写入应由 Agent Runtime 调用 MemoryService，并遵守策略：

- 用户明确要求记住
- 稳定事实
- 已确认项目决策
- 非敏感或已确认敏感写入

---

## 9. Permission 与 Audit

### 9.1 PermissionService

位于 Main Process。

权限三态：

```text
allow
ask
deny
```

权限维度：

- tool
- plugin
- project
- session
- risk level

高风险动作必须生成 `PermissionRequest`，由 AgentPane 展示确认 UI。

### 9.2 AuditService

所有 Tool 调用、权限确认、Artifact 生成和高风险动作都要记录。

```text
AuditLog
- id
- taskId
- sessionId
- projectId
- toolId
- riskLevel
- inputSummary
- outputSummary
- permissionResult
- artifactRefs
- createdAt
```

---

## 10. IPC Contract

### 10.1 Agent

| Channel | 方向 | 请求 | 响应 / 事件 |
|---|---|---|---|
| `agent:create-task` | renderer -> main | `CreateAgentTaskRequest` | `AgentTask` |
| `agent:cancel-task` | renderer -> main | `{ taskId }` | `{ success }` |
| `agent:get-task` | renderer -> main | `{ taskId }` | `AgentTask` |
| `agent:list-events` | renderer -> main | `{ sessionId }` | `SessionEvent[]` |
| `agent:event` | main -> renderer | `SessionEvent` | event |

### 10.2 Artifact

| Channel | 方向 | 请求 | 响应 / 事件 |
|---|---|---|---|
| `artifact:list` | renderer -> main | `{ sessionId }` | `Artifact[]` |
| `artifact:get` | renderer -> main | `{ artifactId }` | `Artifact` |
| `artifact:update` | renderer -> main | `UpdateArtifactRequest` | `Artifact` |
| `artifact:created` | main -> renderer | `Artifact` | event |
| `artifact:updated` | main -> renderer | `Artifact` | event |

### 10.3 Permission

| Channel | 方向 | 请求 | 响应 / 事件 |
|---|---|---|---|
| `permission:respond` | renderer -> main | `{ requestId, decision }` | `{ success }` |
| `permission:request` | main -> renderer | `PermissionRequest` | event |
| `permission:list-policies` | renderer -> main | `{}` | `PermissionPolicy[]` |
| `permission:update-policy` | renderer -> main | `PermissionPolicy` | `{ success }` |

### 10.4 Registry / Settings

| Channel | 方向 | 请求 | 响应 |
|---|---|---|---|
| `skill:list` | renderer -> main | `{}` | `SkillManifest[]` |
| `tool:list` | renderer -> main | `{}` | `ToolManifest[]` |
| `plugin:list` | renderer -> main | `{}` | `PluginManifest[]` |
| `memory:list` | renderer -> main | filters | `MemoryEntry[]` |
| `audit:list` | renderer -> main | filters | `AuditLog[]` |

---

## 11. Renderer State

Jotai 只保存 UI 状态和 main process 数据的前端投影。

建议 atoms：

| Atom | 作用 | 持久化 |
|---|---|---|
| `activeActivityAtom` | 当前 Activity | yes |
| `sidebarStateAtom` | Sidebar 展开、宽度、筛选 | partial |
| `currentSessionAtom` | 当前 session | no |
| `agentTasksAtom` | 当前 session 的任务投影 | no |
| `sessionEventsAtom` | Conversation 事件流 | no |
| `artifactsAtom` | 当前 session Artifact 列表 | no |
| `activeArtifactAtom` | 当前打开 Artifact | no |
| `permissionRequestsAtom` | 待确认权限请求 | no |
| `registeredRenderersAtom` | Renderer 注册信息 | no |

持久化数据以 main process / SQLite 为准，Renderer 状态只做展示和交互。

---

## 12. 数据模型

MVP 最小数据模型：

```text
Session
- id
- title
- activity
- projectId
- createdAt
- updatedAt

AgentTask
- id
- sessionId
- projectId
- goal
- domain
- status
- constraints
- selectedSkills
- plan
- createdAt
- updatedAt

SessionEvent
- id
- sessionId
- taskId
- type
- payload
- createdAt

Artifact
- id
- sessionId
- taskId
- type
- title
- content
- contentRef
- rendererHint
- version
- editable
- createdAt
- updatedAt

ToolCall
- id
- taskId
- toolId
- status
- inputSummary
- outputSummary
- riskLevel
- createdAt
- completedAt

PermissionRequest
- id
- taskId
- toolCallId
- toolId
- riskLevel
- action
- preview
- status
- createdAt
- resolvedAt

MemoryEntry
- id
- scope
- scopeId
- type
- content
- source
- createdAt
- updatedAt

AuditLog
- id
- taskId
- sessionId
- projectId
- eventType
- summary
- metadata
- createdAt
```

---

## 13. Plugin System

插件不替换 Shell，只贡献扩展点。

```text
PluginManifest
- id
- name
- version
- activityEntries
- sidebarViews
- skills
- tools
- inlineRenderers
- artifactTypes
- artifactRenderers
- settingsPages
- permissionDefaults
```

MVP 阶段插件可以先是本地 TypeScript manifest，不急于做完整 marketplace 或独立子进程。

长期插件执行建议：

```text
Renderer UI Extension
- sidebar view
- inline renderer
- artifact renderer

Main Capability Extension
- skill manifest
- tool manifest
- tool executor

Process Boundary
- 高风险或第三方工具运行在独立子进程 / MCP server
```

---

## 14. MVP 实现顺序

### Phase 1: Shell 与事件流

- 建立 `ActivityBar + Sidebar + AppSpace { AgentPane + ArtifactPane }`
- Sidebar 容器上移到 Shell
- AgentPane 承载 Conversation
- ArtifactPane 承载 Artifact Tabs
- 建立 `SessionEvent` 前端模型

### Phase 2: Mock Agent Runtime

- Main Process 实现 `agent:create-task`
- Mock AgentTask 状态机
- 通过 `agent:event` 推送事件
- 生成 mock Artifact
- Renderer 根据事件更新 Conversation 和 ArtifactPane

### Phase 3: Artifact System

- ArtifactService
- Artifact list/get/update IPC
- Renderer Registry
- Markdown / HTML / SVG / JSON Renderer
- Artifact 点击打开、Tab 切换、基础编辑

### Phase 4: Skill / Tool Registry

- SkillRegistry
- ToolRegistry
- ToolRouter 最小实现
- Demo skill pack
- Demo read/write tools

### Phase 5: Permission / Audit / Memory

- PermissionRequest 事件
- PermissionInline 响应
- AuditLog 落库
- MemoryEntry 基础 CRUD
- Settings 中展示权限和记忆

### Phase 6: Demo 垂直插件

选择一个轻量 demo：

- 企业文档 demo：生成 Markdown 报告
- 或交易员 demo：生成 ResearchReport + TradePlan

目标是验证插件式扩展，不追求完整产品。

---

## 15. 现有架构演进 / 重构

现有实现已经有：

- `ActivityBar`
- `WorkspaceRouter`
- 多个 workspace
- `Conversation`
- `OutputArea`
- `Settings`
- Jotai atoms
- 基础 preload API

但当前布局更接近：

```text
ActivityBar + WorkspaceRouter
```

每个 workspace 自己决定 Sidebar、主区和右侧区域。这与长期目标不同。

### 15.1 迁移目标

从：

```text
Shell
  ActivityBar
  WorkspaceRouter
    Workspace owns Sidebar/Main/Right
```

迁移到：

```text
Shell
  ActivityBar
  SidebarSlot
  AppSpace
    AgentPane
    ArtifactPane
```

### 15.2 渐进重构步骤

1. 保留现有 `ActivityBar`。
2. 将现有 workspace sidebar 逻辑抽成 `SidebarView`。
3. 新增 `SidebarSlot`，由 active activity 选择 SidebarView。
4. 将 `Conversation` 包装为 `AgentPane`。
5. 将 `OutputArea` 演进为 `ArtifactPane`，保留现有 Browser / Files / Terminal / Review 作为早期 Renderer/Panel。
6. 将 `WorkspaceRouter` 降级为 activity registry，不再让 workspace 控制整个布局。
7. 将 mock 消息数据改为 `SessionEvent`。
8. 将现有 tool card / permission inline 接入 `agent:event`。
9. 新增 main process `agent` IPC，先用 mock runtime 驱动 UI。

### 15.3 不建议做的事

- 不要继续让每个 workspace 自己实现完整三栏布局。
- 不要让 Conversation 直接生成 Artifact。
- 不要让 Renderer 直接执行工具。
- 不要把插件业务逻辑写死在 `WorkspaceRouter`。
- 不要先做完整真实 Agent，再补事件流和权限。

---

## 16. 技术决策

| 决策 | 方案 | 理由 |
|---|---|---|
| Agent Runtime 位置 | Main Process | 需要可信系统能力、工具调用、权限、审计 |
| UI 架构 | Shell Slots | 长期支持多垂直插件，避免 workspace 重复布局 |
| Conversation | AgentPane 默认实现 | 自然语言交互是产品核心 |
| Artifact | 独立 ArtifactPane + Renderer Registry | 产物类型多，必须可扩展 |
| Tool 调用 | ToolRegistry + ToolRouter + ToolExecutor | 降低 Agent 与工具耦合 |
| 权限 | Main Process PermissionService | Renderer 不可信，权限必须统一拦截 |
| 数据状态 | SQLite 为准，Jotai 做投影 | 避免 UI 状态成为事实来源 |
| 插件 MVP | 本地 manifest | 快速验证扩展点，后续再做子进程和 marketplace |

---

## 17. 最终结论

Electron 架构应以长期 Agent Workbench 基座为目标：

```text
Renderer:
  Shell / AgentPane / ArtifactPane

Preload:
  typed secure IPC bridge

Main:
  Agent Runtime / Skills / Tools / Memory / Permission / Audit / Plugins
```

现有实现可以保留作为过渡，但应逐步从 workspace-owned layout 迁移到 Shell-owned slots。这样既能继续利用当前已有 UI 组件，又不会把长期架构锁死在现有 workspace 结构里。

---

## 附录：v0.2.0 实施状态

| 模块 | 状态 | 备注 |
|------|------|------|
| Shell Slot 架构 | ✅ | ActivityBar + SidebarSlot + AppSpace { AgentPane + ArtifactPane } |
| AgentRuntime 状态机 | ✅ | 转换表驱动，11 状态全部实现 |
| AgentEventBus | ✅ | 12 种事件类型，IPC 推送至 renderer |
| ToolRegistry + ToolRouter | ✅ | 关键词 Jaccard 匹配 (Stage A)，sqlite-vec 延后 |
| ArtifactService + Renderer Registry | ✅ | 6 Renderer，版本管理，内存存储 |
| MemoryService L1+L2 | ✅ | Scratchpad + Persistent，内存存储 |
| PermissionService + AuditService | ✅ | 三态判断 + 策略持久化 + 审计日志 |
| PluginRegistry + PluginLoader | ✅ | 生命周期管理 (boot/activate/deactivate/reload/onError) |
| WorkspaceRouter → registry | ✅ | 优先从 activityRegistry 读取，fallback 硬编码 |
| IPC 全通道 | ✅ | 9 个 handler 文件，全部 try/catch 包裹 |
| 事件驱动 Conversation | ✅ | 8 个 event renderer + PermissionRequestedEvent |
| Settings: Permissions/Memory/Audit | ✅ | 3 个新页面 |
| 集成测试 | ✅ | PermissionService + MemoryService + ArtifactService (24 tests) |
| ContextBuilder | 🔵 | 已删除；接入真实 LLM 时重建 |
| ToolExecutor | 🔵 | 已删除；接入真实 tool 执行时重建 |
| SkillLoader | 🔵 | 已删除；当前 skill 由 boot.ts 直接注册 |
| SQLite 持久化 (Memory/Audit/Artifact) | 🔵 | MVP 内存存储，未来迁移 |
| 会话恢复 (Gap G5) | 🔵 | 依赖 SQLite + Session 管理 |
| 性能基准 (Gap G8) | 🔵 | 需真实 LLM 集成后设置 |
| IPC 版本兼容 (Gap G9) | 🔵 | 接口仍在迭代中 |
