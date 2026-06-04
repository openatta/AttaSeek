# Agent Workbench 底座重构执行计划

> **日期：** 2026-06-04
> **基于：**
> - `docs/requirements/2026-06-04-agent-workbench-foundation-spec.md`（需求）
> - `docs/design/2026-06-04-agent-workbench-ui-foundation.md`（UI 设计）
> - `docs/design/2026-06-04-agent-workbench-electron-architecture.md`（Electron 架构）
> - [Gap Supplement] `docs/design/2026-06-04-agent-workbench-gap-supplement.md`
>
> **状态：** 草稿，待评审

---

## 1. 总览

### 1.1 重构目标

将 AttaSeek 从 **workspace-owned layout**（每个 workspace 自行决定 Sidebar/Main/Right 三栏布局）迁移到 **Shell-owned slot layout**（Shell 统一管理 ActivityBar + SidebarSlot + AppSpace { AgentPane + ArtifactPane }）。

### 1.2 核心改变

```
Before (当前):
  Shell → ActivityBar + WorkspaceRouter
          每个 Workspace 自己实现 3 栏布局
          Conversation 直接嵌入 ChatWorkspace
          OutputArea 由 ChatWorkspace 控制显隐

After (目标):
  Shell → ActivityBar + SidebarSlot + AppSpace { AgentPane + ArtifactPane }
          Workspace 退化为 activity registry，贡献 SidebarView + 默认 Artifact
          Conversation 是 AgentPane 的默认实现
          OutputArea 演进为 ArtifactPane（Renderer Registry）
```

### 1.3 总工期与风险

| 指标 | 估值 |
|---|---|
| 总 Phase | 6 |
| 每个 Phase | 1-3 天 |
| 总文件变更 | ~40 文件（新建 ~25，修改 ~15，删除 0，第一阶段不删） |
| 核心风险 | Shell 布局迁移期间 UI 可能短期退步（见 Phase 1 回滚策略） |

---

## 2. 当前代码 → 目标代码映射表

### 2.1 文件级映射

| 当前文件 | 操作 | 目标文件 / 说明 |
|---|---|---|
| `layouts/Shell.tsx` | **重写** | 引入 SidebarSlot + AppSpace 结构 |
| `layouts/WorkspaceRouter.tsx` | **降级** | 改为 `registries/activityRegistry.ts`，不再控制布局 |
| `layouts/WorkspaceLayout.tsx` | **删除**（最终） | 拆分到 SidebarSlot + AppSpace |
| `workspaces/ChatWorkspace.tsx` | **降级** | Chat 场景只贡献 SidebarView + 默认 Artifact tabs |
| `workspaces/ChatsSidebar.tsx` | **改造** | 注册为 Chat Activity 的 SidebarView |
| `components/Conversation/*` | **保留 + 事件化** | 包装为 AgentPane，消费 SessionEvent 而非 mock 数据 |
| `components/OutputArea/OutputArea.tsx` | **演进** | 改为 `components/Artifact/ArtifactPane.tsx` |
| `components/OutputArea/*Panel.tsx` | **改造** | 注册为 Artifact Renderer |
| `workspaces/AutomationWorkspace.tsx` | **改造** | 贡献 Automation SidebarView，主区用 AgentPane |
| `workspaces/PluginWorkspace.tsx` | **改造** | 贡献 Plugin SidebarView，主区用 AgentPane |
| `workspaces/ProjectsWorkspace.tsx` | **改造** | 贡献 Projects SidebarView，主区用 AgentPane + ArtifactPane |
| `workspaces/DashboardWorkspace.tsx` | **改造** | 贡献 Dashboard SidebarView（可为空），主区用 AgentPane |
| `workspaces/SearchWorkspace.tsx` | **保留** | 搜索可能是全局浮层而非 workspace |
| `workspaces/SettingsWorkspace.tsx` | **改造** | 贡献 Settings SidebarView |
| `atoms/activityAtom.ts` | **扩展** | Activity type 保持，新增 activity registry 概念 |
| `atoms/outputTabsAtom.ts` | **演进** | 重命名为 `atoms/artifactAtom.ts`，概念从 Tab 升级为 Artifact |
| `atoms/composerAtom.ts` | **保留** | 局部状态，不变 |
| `atoms/themeAtom.ts` | **保留** | 不变 |
| `main/index.ts` | **扩展** | 新增 IPC handler 注册 |
| `main/ipc/theme.ts` | **保留** | 不变 |
| `preload/index.ts` | **扩展** | 新增 agent/artifact/permission/tool/skill/memory IPC 桥 |

### 2.2 组件级映射

| 当前组件 | 操作 | 目标组件 |
|---|---|---|
| `Shell` | 重写 | `Shell { ActivityBar, SidebarSlot, AppSpace }` |
| `WorkspaceRouter` | 降级 | `activityRegistry` — 纯映射，不做布局 |
| `ChatWorkspace` | 拆分 | `ChatSidebarView` + 默认 AgentPane 启动参数 |
| `Conversation` | 包装 | `AgentPane > Conversation` |
| `MessageFlow` | 事件化 | 消费 `sessionEventsAtom`（事件流），不再消费 mock 数组 |
| `ToolCallCard` | 事件化 | 消费 `ToolCallStarted/Finished` 事件 |
| `PermissionInline` | 接入 IPC | 消费 `permission:request` 事件，通过 `permission:respond` 回传 |
| `Composer` | 接入 IPC | 通过 `agent:create-task` 发送用户意图 |
| `SessionHeader` | 保留 | AgentPane 顶部 |
| `AgentStatusBar` | 事件化 | 消费 `AgentTask` 状态 |
| `OutputArea` | 演进 | `ArtifactPane > ArtifactTabs + ArtifactRendererHost` |
| `OutputArea.FilesPanel` | 改造 | Artifact Renderer: `renderers/files/FilesRenderer.tsx` |
| `OutputArea.TerminalPanel` | 改造 | Artifact Renderer: `renderers/terminal/TerminalRenderer.tsx` |
| `OutputArea.BrowserPanel` | 改造 | Artifact Renderer: `renderers/browser/BrowserRenderer.tsx` |
| `OutputArea.ReviewPanel` | 改造 | Artifact Renderer: `renderers/diff/DiffRenderer.tsx` |
| `ActivityBar` | 保留 | 几乎不变，只需支持 activity registry 动态条目 |
| `ChatsList` | 改造 | 注册为 Chat Activity 的 SidebarView 实现 |
| `AutomationSidebar` | 改造 | 注册为 Automation Activity 的 SidebarView |
| `Plugin*` | 改造 | 注册为 Plugin Activity 的 SidebarView |
| `ProjectsSidebar` | 改造 | 注册为 Projects Activity 的 SidebarView |
| `Settings.SettingsSidebar` | 改造 | 注册为 Settings Activity 的 SidebarView |

---

## 3. Phase 0：基础搭建（1-2 天，零破坏性变更）

**目标：** 建立新目录结构和抽象接口，不改变任何现有 UI 行为。所有新代码与现有代码并行存在。

### 3.1 新建目录结构

```
src/renderer/
  registries/
    activityRegistry.ts          # Activity → { sidebarView, defaultArtifactTabs } 映射
    sidebarRegistry.ts           # SidebarView 注册表
    artifactRendererRegistry.ts  # Artifact type → Renderer 组件映射
    inlineRendererRegistry.ts    # Conversation inline renderer 注册表

  renderers/                     # Artifact Renderer 组件
    markdown/MarkdownRenderer.tsx
    html/HtmlRenderer.tsx
    svg/SvgRenderer.tsx
    table/TableRenderer.tsx
    code/CodeRenderer.tsx
    diff/DiffRenderer.tsx

  core/                          # UI 无关纯逻辑（状态机、类型、工具函数）
    types/
      AgentTask.ts
      SessionEvent.ts
      Artifact.ts
      Tool.ts
      Skill.ts
      Permission.ts
      Memory.ts
      Audit.ts
      Plugin.ts

src/main/
  ipc/
    agent.ts                     # agent:* IPC handlers (先 mock)
    artifact.ts                  # artifact:* IPC handlers
    tool.ts                      # tool:list IPC handler (先空)
    skill.ts                     # skill:list IPC handler (先空)
    memory.ts                    # memory:* IPC handlers (先空)
    permission.ts                # permission:* IPC handlers (先空)
    audit.ts                     # audit:* IPC handlers (先空)
    plugin.ts                    # plugin:list IPC handler (先空)

  agent/
    AgentRuntime.ts              # AgentTask 状态机
    AgentEventBus.ts             # 事件流
    ContextBuilder.ts            # 上下文组装（先 stub）

  skills/SkillRegistry.ts        # 技能注册表（先空壳）
  tools/
    ToolRegistry.ts              # 工具注册表（先空壳）
    ToolRouter.ts                # 工具路由（先 stub — 返回全部）
  artifacts/ArtifactService.ts   # Artifact CRUD（先用内存 Map）
  memory/MemoryService.ts        # 记忆服务（先 stub）
  permission/PermissionService.ts # 权限服务（先默认 allow）
  audit/AuditService.ts          # 审计服务（先 console.log）
  plugins/PluginRegistry.ts      # 插件注册表（先空壳）
```

### 3.2 新建类型定义（`src/renderer/core/types/`）

```
AgentTask.ts       — AgentTask, AgentTaskStatus
SessionEvent.ts    — 所有事件类型枚举 + payload types
Artifact.ts        — Artifact, ArtifactType, ArtifactRendererHint
Tool.ts            — ToolManifest, ToolRiskLevel, ToolCategory
Skill.ts           — SkillManifest, SkillLayer
Permission.ts      — PermissionDecision, PermissionPolicy, PermissionRequest
Memory.ts          — MemoryEntry, MemoryScope, MemoryLayer
Audit.ts           — AuditLog, AuditEventType
Plugin.ts          — PluginManifest
```

### 3.3 验证

```bash
npm run build    # TypeScript 编译通过，无旧代码破坏
npm run dev      # UI 行为与重构前完全一致
```

**交付物：** 新目录 + 类型定义 + 空壳服务，对现有 UI 零影响。

---

## 4. Phase 1：Shell 布局迁移（1-2 天）

**目标：** 将 Shell 从 workspace-owned layout 迁移到 Shell-owned slot layout。保留所有现有 workspace 功能，但改为通过新 Slot 架构渲染。

### 4.1 操作步骤

#### Step 1: 创建 SidebarSlot 容器

```tsx
// src/renderer/layouts/SidebarSlot.tsx
// 260px 宽的固定 Sidebar 容器
// 通过 activityRegistry 查找当前 Activity 对应的 SidebarView
// 负责：drag region (40px) + SidebarView 渲染
// 不负责：具体 sidebar 内容
```

#### Step 2: 创建 AppSpace 容器

```tsx
// src/renderer/layouts/AppSpace.tsx
// 包含 AgentPane + ArtifactPane（可拖拽分隔线）
// 支持 4 种 layout mode: Standard / ArtifactFocus / Review / ChatOnly
```

#### Step 3: 创建 AgentPane 包装

```tsx
// src/renderer/layouts/AgentPane.tsx
// 包裹 Conversation 组件
// 消费 sessionEventsAtom
// AgentPane 永远存在，但宽度可随 layout mode 变化
```

#### Step 4: 创建 ArtifactPane 包装

```tsx
// src/renderer/components/Artifact/ArtifactPane.tsx
// 演进自 OutputArea.tsx
// 保留现有 Tab 切换 + 全屏逻辑
// 新增：通过 artifactRendererRegistry 选择 Renderer
// 现有 Browser/Files/Terminal/Review 面板作为首批 Renderer 注册
```

#### Step 5: 重写 Shell

```tsx
// src/renderer/layouts/Shell.tsx (新版)
export default function Shell() {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <ActivityBar />
      <SidebarSlot />
      <AppSpace>
        <AgentPane />
        <ArtifactPane />
      </AppSpace>
    </div>
  )
}
```

#### Step 6: 建立 Activity Registry

```ts
// src/renderer/registries/activityRegistry.ts
interface ActivityRegistration {
  activity: Activity
  sidebarView: ComponentType   // SidebarView 组件
  defaultLayoutMode: LayoutMode
  defaultArtifactTabs: ArtifactTab[]
}

// 注册所有现有 activity
register('chat', {
  sidebarView: ChatSidebarView,
  defaultLayoutMode: 'standard',
  defaultArtifactTabs: []
})

register('projects', {
  sidebarView: ProjectSidebarView,
  defaultLayoutMode: 'standard',
  defaultArtifactTabs: ['files', 'review']
})

register('automation', {
  sidebarView: AutomationSidebarView,
  defaultLayoutMode: 'standard',
  defaultArtifactTabs: []
})

// ... 其余
```

#### Step 7: 各 Workspace 的 Sidebar 抽取为 SidebarView

每个现有 workspace sidebar 组件（`ChatsSidebar`, `AutomationSidebar`, `ProjectsSidebar` 等）保持逻辑不变，但通过 registry 注册为 `SidebarView`，由 `SidebarSlot` 渲染。

#### Step 8: WorkspaceRouter 降级

```tsx
// 删除旧的 WorkspaceRouter.tsx（不再让 workspace 控制布局）
// 改为从 activityRegistry 读取配置
```

### 4.2 回滚策略

- Shell.tsx 旧版备份为 `Shell.old.tsx`
- 出问题时删除新 Shell，恢复旧版，`npm run build` 验证通过
- Phase 1 的所有新组件都是纯新增，不影响旧代码路径

### 4.3 验证

```bash
npm run build         # 编译通过
npm run dev           # 所有 Activity 切换正常
                      #   Chat: 左边会话列表，中间 Conversation，右边 OutputArea（可选）
                      #   Projects: 左边项目列表，中间会话内容，右边 Files/Review
                      #   Automation: 左边任务列表，中间任务详情
                      #   Plugin: 左边分类，中间卡片网格/详情
                      #   Settings: 左边设置分类，中间设置页面
                      #   Dashboard: 左栏为空，中间 Dashboard 内容
```

**交付物：** Shell 布局迁移完成，activity registry 运作，所有现有 workspace 通过新 Slot 架构渲染。

---

## 5. Phase 2：事件流 + Mock Agent Runtime（1-2 天）

**目标：** 将 Conversation 的数据源从直接 mock 数组迁移到事件流。Main process 实现 mock AgentRuntime，通过 `agent:event` 推送 SessionEvent。

### 5.1 操作步骤

#### Step 1: Main Process — AgentEventBus

```ts
// src/main/agent/AgentEventBus.ts
// EventEmitter 包装
// 方法：emit(event), subscribe(listener), history(sessionId)
// 事件存储：内存 Map<sessionId, SessionEvent[]>
```

#### Step 2: Main Process — AgentRuntime (Mock)

```ts
// src/main/agent/AgentRuntime.ts
// createTask(sessionId, goal) → AgentTask
// 模拟状态机推进：
//   idle → intake → context_assembling → skill_selecting →
//   planning → executing → generating_artifact → completed
// 每个状态转换时 emit 对应 SessionEvent
// 使用 setTimeout 模拟延迟（300-2000ms 随机）
```

#### Step 3: Main Process — IPC handlers

```ts
// src/main/ipc/agent.ts
ipcMain.handle('agent:create-task', async (event, req) => {
  const task = agentRuntime.createTask(req.sessionId, req.goal)
  return task
})

ipcMain.handle('agent:cancel-task', async (event, { taskId }) => {
  agentRuntime.cancelTask(taskId)
  return { success: true }
})

// agent:event 通过 webContents.send 推送到 renderer
// 在主进程 createWindow 中:
agentEventBus.subscribe((event) => {
  mainWindow.webContents.send('agent:event', event)
})
```

#### Step 4: Preload — 暴露 agent API

```ts
// 在 preload/index.ts 的 api 对象中新增:
agent: {
  createTask: (goal: string, sessionId: string) =>
    ipcRenderer.invoke('agent:create-task', { goal, sessionId }),
  cancelTask: (taskId: string) =>
    ipcRenderer.invoke('agent:cancel-task', { taskId }),
  onEvent: (cb: (event: SessionEvent) => void) => {
    const listener = (_e: any, data: SessionEvent) => cb(data)
    ipcRenderer.on('agent:event', listener)
    return () => ipcRenderer.removeListener('agent:event', listener)
  }
}
```

#### Step 5: Renderer — Jotai atoms 事件化

```ts
// 新增 atoms
sessionEventsAtom   — atom<SessionEvent[]>([])   // 当前 session 的事件流
agentTasksAtom      — atom<AgentTask[]>([])       // 当前 session 的任务状态投影
```

#### Step 6: Renderer — Conversation 事件化

- `MessageFlow` 从消费 mock 消息数组改为消费 `sessionEventsAtom`
- `ToolCallCard` 由 `ToolCallStarted` / `ToolCallFinished` 事件驱动
- `AgentStatusBar` 由 `AgentTask.status` 驱动
- `AgentPlanCard` 由 `PlanCreated` / `PlanUpdated` 事件驱动

#### Step 7: Renderer — Composer 接入

- `Composer` 提交时调用 `window.api.agent.createTask(goal, sessionId)`
- 不再直接往本地消息数组 push

### 5.2 验证

```bash
npm run build
npm run dev
# 在 Conversation 输入 "生成一份项目日报"
# → AgentStatus 显示状态流转（idle → ... → completed）
# → MessageFlow 显示 PlanCreated、ToolCallStarted/Finished、ArtifactCreated 事件卡片
# → 最终 ArtifactPane 中出现生成的文档
```

**交付物：** 事件流管道打通，Conversation 由事件驱动，Mock Agent Runtime 可跑通完整任务状态机。

---

## 6. Phase 3：Artifact 系统（1-2 天）

**目标：** ArtifactService 在 main process 运行，ArtifactPane 通过 Renderer Registry 选择渲染器。

### 6.1 操作步骤

#### Step 1: Main Process — ArtifactService

```ts
// src/main/artifacts/ArtifactService.ts
// 内存 Map<artifactId, Artifact>
// create(params) → Artifact
// update(id, patch) → Artifact
// get(id) → Artifact
// list(sessionId) → Artifact[]
// 每个操作 emit ArtifactCreated/Updated 事件到 EventBus
```

#### Step 2: Main Process — Artifact IPC

```ts
// src/main/ipc/artifact.ts
ipcMain.handle('artifact:list', ...)
ipcMain.handle('artifact:get', ...)
ipcMain.handle('artifact:update', ...)
// artifact:created / artifact:updated 通过 agent:event 推送
```

#### Step 3: Renderer — Renderer Registry

```ts
// src/renderer/registries/artifactRendererRegistry.ts
registerRenderer('markdown', MarkdownRenderer)
registerRenderer('html', HtmlRenderer)
registerRenderer('svg', SvgRenderer)
registerRenderer('table', TableRenderer)
registerRenderer('code', CodeRenderer)
registerRenderer('diff', DiffRenderer)
registerRenderer('files', FilesRenderer)     // 现有 FilesPanel
registerRenderer('terminal', TerminalRenderer) // 现有 TerminalPanel
registerRenderer('browser', BrowserRenderer)   // 现有 BrowserPanel
```

#### Step 4: Renderer — ArtifactPane 演进

- 保留现有 OutputArea 的 Tab 切换和全屏逻辑
- Tab 数据源从 `outputTabsAtom` 改为 `artifactsAtom`
- Tab 内容通过 `artifactRendererRegistry` 选择渲染器
- 现有 `FilesPanel`, `TerminalPanel`, `BrowserPanel`, `ReviewPanel` 注册为首批 Renderer

#### Step 5: 新建基础 Renderer 组件

```
src/renderer/renderers/
  markdown/MarkdownRenderer.tsx   — 渲染 Markdown 文本
  html/HtmlRenderer.tsx           — iframe 渲染 HTML
  svg/SvgRenderer.tsx             — 渲染 SVG
  table/TableRenderer.tsx         — 渲染表格数据
  code/CodeRenderer.tsx           — Monaco Editor 嵌入
  diff/DiffRenderer.tsx           — 现有 ReviewPanel 逻辑迁移
```

### 6.2 验证

```bash
npm run build && npm run dev
# Mock Agent 任务完成后
# → ArtifactPane 中出现生成的 Artifact tab
# → 点击 tab 切换 Renderer
# → Markdown/SVG/Table 渲染正确
# → 现有 Browser/Files/Terminal 行为不变
```

**交付物：** Artifact 系统运作，Renderer Registry 可用，基础 Renderer 就绪。

---

## 7. Phase 4：Skill / Tool Registry（1 天）

**目标：** SkillRegistry 和 ToolRegistry 运作，ToolRouter 最小实现。Demo skill pack 可用。

### 7.1 操作步骤

#### Step 1: SkillRegistry

```ts
// src/main/skills/SkillRegistry.ts
class SkillRegistry {
  register(manifest: SkillManifest): void
  list(): SkillManifest[]
  get(id: string): SkillManifest | undefined
  findByActivity(activity: Activity): SkillManifest[]
  findByRiskLevel(level: ToolRiskLevel): SkillManifest[]
}
```

#### Step 2: ToolRegistry + ToolRouter

```ts
// src/main/tools/ToolRegistry.ts
class ToolRegistry {
  register(manifest: ToolManifest): void
  list(): ToolManifest[]
  get(id: string): ToolManifest | undefined
  listByRisk(risk: ToolRiskLevel): ToolManifest[]
}

// src/main/tools/ToolRouter.ts
class ToolRouter {
  // 当前最小实现：根据任务 goal 做简单关键词匹配
  // 后续升级为 sqlite-vec 语义路由（见 gap supplement）
  selectTools(goal: string, availableTools: ToolManifest[], topK: number): ToolManifest[]
}
```

#### Step 3: Demo Skill Pack

```ts
// src/main/skills/packs/demo-pack.ts
// 注册 3-5 个 demo skills:
//   - summarize (atomic, read-only)
//   - generate_doc (atomic, write, risk=low)
//   - review_code (atomic, read-only)
//   - project_report (scenario, 组合 summarize + generate_doc)
```

#### Step 4: Demo Tools

```ts
// src/main/tools/packs/demo-tools.ts
// 注册 5 个 demo tools:
//   - read_file (read)
//   - search_code (read)
//   - create_document (write)
//   - send_email (risky) — 只做 mock，输出预览
//   - git_commit (risky) — 只做 mock，输出 diff 预览
```

#### Step 5: IPC 暴露

```ts
// skill:list, tool:list IPC channels
// Preload 暴露 window.api.skill.list(), window.api.tool.list()
```

### 7.2 验证

```bash
# 在 DevTools console:
await window.api.skill.list()  // 返回 demo skills
await window.api.tool.list()   // 返回 demo tools

# Plugin workspace 可展示 Skill/Tool 列表
```

**交付物：** Skill/Tool Registry 运作，Demo pack 可用，ToolRouter 最小实现。

---

## 8. Phase 5：Permission / Audit / Memory（1-2 天）

**目标：** PermissionService 三态拦截、AuditService 落盘、MemoryService L1/L2。

### 8.1 操作步骤

#### Step 1: PermissionService

```ts
// src/main/permission/PermissionService.ts
class PermissionService {
  // 三态判断：allow / ask / deny
  check(tool: ToolManifest, context: PermissionContext): PermissionDecision
  // 持久化策略到 SQLite
  savePolicy(policy: PermissionPolicy): void
  // 生成 PermissionRequest 事件
  requestPermission(toolCall: ToolCall): PermissionRequest
}
```

#### Step 2: AuditService

```ts
// src/main/audit/AuditService.ts
class AuditService {
  // 所有 tool 调用记录
  log(event: AuditEvent): void
  // 持久化到 SQLite
  query(filters: AuditFilters): AuditLog[]
}
```

#### Step 3: MemoryService

```ts
// src/main/memory/MemoryService.ts
class MemoryService {
  // L1: Session Scratchpad (内存, per-session)
  getScratchpad(sessionId: string): Record<string, any>
  setScratchpad(sessionId: string, key: string, value: any): void

  // L2: Persistent Memory (SQLite + 将来向量检索)
  store(entry: MemoryEntry): void
  recall(scope: MemoryScope, query: string): MemoryEntry[]
  delete(id: string): void
  update(id: string, patch: Partial<MemoryEntry>): void
}
```

#### Step 4: ToolExecutor 接入权限+审计

```ts
// src/main/tools/ToolExecutor.ts
class ToolExecutor {
  async execute(toolCall: ToolCall): Promise<ToolResult> {
    // 1. PermissionService.check()
    // 2. 若 ask → emit PermissionRequest, 等待 renderer 回复
    // 3. 若 deny → 返回 denied 结果
    // 4. 执行工具
    // 5. AuditService.log()
    // 6. 返回结果
  }
}
```

#### Step 5: PermissionInline 接入 IPC

- `PermissionInline` 消费 `permission:request` 事件
- 用户选择 allow/deny → 调用 `permission:respond`
- 权限策略可持久化（"Always allow this tool"）

#### Step 6: Settings 扩展

- Settings 中新增 Permissions 页面（展示/编辑策略）
- Settings 中新增 Memory 页面（查看/编辑/删除记忆）
- Settings 中新增 Audit Log 页面（查看审计日志）

### 8.2 验证

```bash
# Mock Agent 执行 risky tool（如 send_email）
# → PermissionInline 弹出确认卡片
# → 用户点击 Allow → 工具继续执行
# → Audit log 中有记录
# → Settings → Audit Log 可查看到

# Memory: 用户说 "记住我喜欢用中文回复"
# → MemoryService 写入 preference
# → Settings → Memory 可查看/编辑/删除
```

**交付物：** 权限三态 + 审计日志 + 双层记忆全部运作。

---

## 9. Phase 6：插件声明机制 + Demo 垂直插件（1 天）

**目标：** Plugin manifest 系统运作，用一个 demo 垂直插件验证扩展点。

### 9.1 操作步骤

#### Step 1: PluginRegistry

```ts
// src/main/plugins/PluginRegistry.ts
class PluginRegistry {
  register(manifest: PluginManifest): void
  activate(pluginId: string): void
  deactivate(pluginId: string): void
  list(): PluginManifest[]
}
```

#### Step 2: Demo 企业文档插件

```ts
// src/main/plugins/packs/enterprise-doc-plugin.ts
const EnterpriseDocPlugin: PluginManifest = {
  id: 'enterprise-doc',
  name: '企业文档处理',
  version: '0.1.0',
  activityEntries: [{ id: 'documents', label: 'Documents', icon: 'file-text' }],
  sidebarViews: [{ activityId: 'documents', component: 'DocumentSidebar' }],
  skills: ['generate_doc', 'summarize', 'extract_todos'],
  tools: ['read_file', 'create_document'],
  artifactTypes: ['markdown', 'table'],
  artifactRenderers: ['markdown', 'table'],
  permissionDefaults: { 'send_email': 'ask', 'read_file': 'allow' }
}
```

#### Step 3: 验证闭环

- 注册 enterprise-doc 插件 → ActivityBar 出现 Documents 图标
- 点击 Documents → Sidebar 显示文档列表（插件贡献）
- 在 AgentPane 输入 "根据最近项目生成一份周报"
- → Agent Runtime 选择 generate_doc skill
- → ToolRouter 匹配 read_file, create_document tools
- → Agent 执行 → ArtifactPane 展示生成的 Markdown 文档
- → 用户可在 ArtifactPane 编辑 → 导出

### 9.2 验证

```bash
npm run build && npm run dev
# 完整闭环验证：插件注册 → Activity 切换 → Sidebar → Agent → Tool → Artifact
```

**交付物：** 插件声明机制运作，Demo 垂直插件验证全链路。

---

## 10. 风险与对策

| 风险 | 概率 | 对策 |
|---|---|---|
| Phase 1 Shell 布局迁移时现有 workspace UI 退步 | 中 | Phase 0 不碰现有代码；Phase 1 逐步切换，保留旧 Shell 备份 |
| Conversation 事件化后 mock 数据丢失交互细节 | 中 | 保留 mock 消息数组作为 fallback；事件驱动 + mock 双轨运行一阶段 |
| OutputArea → ArtifactPane 演进破坏现有面板 | 中 | 现有 Panel 直接注册为 Renderer，不重写内部逻辑 |
| 主进程新增 IPC 后 preload 类型不同步 | 低 | 每个 IPC channel 在 `preload/index.d.ts` 声明类型 |
| Agent Runtime 状态机复杂度过高 | 低 | 先用 setTimeout mock；真实 LLM 调用是后续迭代 |

---

## 11. 各 Phase 交付物与验证汇总

| Phase | 新建文件 | 修改文件 | 验证命令 |
|---|---|---|---|
| 0 | ~25 | 0 | `npm run build` |
| 1 | ~5 | ~5 | `npm run dev`（手动验证所有 Activity 切换） |
| 2 | ~5 | ~8 | `npm run dev`（手动验证事件流） |
| 3 | ~8 | ~3 | `npm run dev`（手动验证 Artifact 渲染） |
| 4 | ~5 | ~2 | `npm run dev`（手动验证 Skill/Tool 列表） |
| 5 | ~5 | ~5 | `npm run dev`（手动验证权限/审计/记忆） |
| 6 | ~3 | ~2 | `npm run dev`（手动验证插件闭环） |

---

## 12. 最终结论

这个执行计划遵循一个核心原则：**每个 Phase 结束时代码仍然可以构建和运行**。从 Phase 0（纯新建，零破坏）到 Phase 6（全链路闭环），每一步都是增量叠加，不出现"拆掉重建"的阶段。

关键策略：
1. **先建新，再迁移**：新架构组件先与旧代码并行运行，验证无问题再逐步切换
2. **Shell 是唯一重写点**：只有 `Shell.tsx` 需要重写，其他都是改造或新增
3. **事件流是分水岭**：Phase 2 之前 Conversation 靠 mock 数组，Phase 2 之后靠事件流
4. **权限/审计/记忆最后接入**：这些是横切关注点，等主链路跑通后再挂载

**建议从 Phase 0 立即开始**——它不破坏任何现有功能，但为后续所有 Phase 建立目录和类型基础。
