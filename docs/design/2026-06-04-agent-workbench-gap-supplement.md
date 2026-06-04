# Agent Workbench 架构三文档缺失项补充

> **日期：** 2026-06-04
> **补充对象：**
> - `docs/requirements/2026-06-04-agent-workbench-foundation-spec.md`
> - `docs/design/2026-06-04-agent-workbench-ui-foundation.md`
> - `docs/design/2026-06-04-agent-workbench-electron-architecture.md`
>
> **状态：** 草稿，待合并入正式文档

---

## 缺失项总览

| # | 缺失项 | 严重程度 | 阻塞 Phase |
|---|---|---|---|
| G1 | ContextBuilder 设计 | 高 | Phase 2-4 |
| G2 | ToolRouter 实现细节（embedding 模型、sqlite-vec） | 高 | Phase 4 |
| G3 | 插件生命周期管理 | 高 | Phase 6 |
| G4 | 错误处理策略（跨层） | 中 | Phase 2+ |
| G5 | 会话恢复 / 跨启动状态保存 | 中 | Phase 2+ |
| G6 | Artifact 版本管理语义 | 中 | Phase 3 |
| G7 | 测试策略 | 中 | 全 Phase |
| G8 | 性能约束与目标 | 低 | Phase 3+ |
| G9 | IPC 版本兼容与废弃策略 | 低 | Phase 2+ |
| G10 | CSS/样式迁移方案 | 低 | Phase 1 |

---

## G1：ContextBuilder 设计

### 问题

Electron 架构文档 Section 2.1 中列出了 `agent/ContextBuilder.ts`，但没有定义它组装什么、优先级如何、大小上限。

### 补充设计

```ts
// src/main/agent/ContextBuilder.ts

interface ContextAssemblyParams {
  goal: string
  sessionId: string
  projectId?: string
  memoryScope: MemoryScope
}

interface ContextAssembly {
  systemPrompt: string         // system prompt（base + skills + memory）
  messages: Message[]          // 历史消息（L1 scratchpad）
  tools: ToolManifest[]        // ToolRouter 选出的 Top-K tools
  memory: MemoryEntry[]        // L2 回忆的相关记忆
  artifacts: ArtifactSummary[] // 当前 session 已有 Artifact 引用
  constraints: string[]        // 项目/场景约束
}

class ContextBuilder {
  async build(params: ContextAssemblyParams): Promise<ContextAssembly> {
    // 1. 组装 system prompt
    const basePrompt = this.getBaseSystemPrompt()
    const skillPrompts = this.getRelevantSkillPrompts(params.goal)
    const memoryContext = this.getMemoryContext(params.memoryScope)

    // 2. 获取历史消息（L1 scratchpad, 最近 N 轮）
    const recentMessages = this.getRecentMessages(params.sessionId, 20)

    // 3. ToolRouter 选出 Top-K tools
    const tools = await this.toolRouter.selectTools(params.goal, 5)

    // 4. MemoryService 回忆相关记忆
    const memories = await this.memoryService.recall(params.memoryScope, params.goal)

    // 5. 当前 session 已有 artifacts
    const artifacts = this.getSessionArtifactSummaries(params.sessionId)

    // 6. 项目约束
    const constraints = this.getProjectConstraints(params.projectId)

    return {
      systemPrompt: [basePrompt, ...skillPrompts, memoryContext].join('\n\n'),
      messages: recentMessages,
      tools,
      memory: memories,
      artifacts,
      constraints
    }
  }
}
```

### 上下文预算

```
总预算：~100K tokens (模型上下文窗口的 50% 以下)
分配：
  system prompt:    ~8K   (base 2K + skills 4K + memory 2K)
  tool definitions: ~12K  (5 tools × ~2.4K each; 报告数据: 12 tools = 4,200 tokens)
  memory context:  ~4K   (L2 回忆条目)
  messages:         ~60K  (最近 20 轮)
  constraints:      ~1K
  artifacts:        ~2K
  reserve:          ~13K  (LLM 输出空间)
```

---

## G2：ToolRouter 实现细节

### 问题

Electron 架构文档提到 ToolRouter 要做语义匹配 Top-K，但没有指定实现方案。

### 补充设计

#### 两阶段路线

```
阶段 A：关键词匹配（MVP，Phase 4）
  - 对 tool.name + tool.description 做 TF-IDF
  - 与 goal 做余弦相似度
  - 返回 Top-K

阶段 B：向量语义路由（Phase 5+）
  - 对 tool description 生成本地 embedding
  - 存储到 sqlite-vec
  - goal → embedding → ANN 搜索 → Top-K
```

#### 阶段 A 实现（MVP）

```ts
// src/main/tools/ToolRouter.ts
interface ToolMatch {
  tool: ToolManifest
  score: number
}

class ToolRouter {
  // MVP: simple keyword matching
  selectTools(goal: string, tools: ToolManifest[], topK: number = 5): ToolManifest[] {
    const goalTokens = this.tokenize(goal.toLowerCase())

    const scored: ToolMatch[] = tools.map(tool => {
      const toolText = `${tool.name} ${tool.description}`.toLowerCase()
      const toolTokens = this.tokenize(toolText)
      const score = this.jaccardSimilarity(goalTokens, toolTokens)
      return { tool, score }
    })

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(m => m.tool)
  }

  private tokenize(text: string): Set<string> {
    return new Set(
      text.split(/[\s,.;:!?()\[\]{}]+/).filter(t => t.length > 1)
    )
  }

  private jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    const intersection = new Set([...a].filter(x => b.has(x)))
    const union = new Set([...a, ...b])
    return intersection.size / union.size
  }
}
```

#### 阶段 B 设计（后续，不阻塞 MVP）

```text
依赖：sqlite-vec（better-sqlite3 扩展）
模型：all-MiniLM-L6-v2（本地 ONNX，~80MB）
流程：
  1. 启动时对所有 tool description 生成 embedding
  2. 存储到 sqlite-vec 虚拟表
  3. 查询时 goal → embedding → vec_search(goal_vec, topK)
  4. 返回匹配的 tools + raw score

回退：sqlite-vec 不可用时自动降级为关键词匹配
```

---

## G3：插件生命周期管理

### 问题

三个文档都定义了 PluginManifest，但没有说明插件的加载/卸载/重载/崩溃恢复生命周期。

### 补充设计

```ts
// src/main/plugins/PluginLoader.ts

enum PluginStatus {
  Registered   // manifest 已注册，未加载
  Loading      // 正在加载代码
  Active       // 已激活，所有扩展点生效
  Error        // 加载/运行错误
  Inactive     // 已停用
  Unloaded     // 已卸载
}

interface PluginInstance {
  manifest: PluginManifest
  status: PluginStatus
  activatedAt?: number
  error?: string
  errorCount: number
  maxErrors: number       // 默认 3，达到后自动停用
}

class PluginLoader {
  // 生命周期
  async load(manifestPath: string): Promise<PluginInstance>
  async activate(pluginId: string): Promise<void>
  async deactivate(pluginId: string): Promise<void>
  async reload(pluginId: string): Promise<void>
  async unload(pluginId: string): Promise<void>

  // 崩溃恢复
  onPluginError(pluginId: string, error: Error): void {
    // errorCount++
    // if errorCount >= maxErrors → deactivate + notify renderer
    // emit 'plugin:error' IPC event
  }

  // 启动顺序
  async bootSequence(): Promise<void> {
    // 1. 加载内置插件（core skills, core tools）
    // 2. 等待内置插件激活
    // 3. 加载用户安装的第三方插件
    // 4. 出错的第三方插件不阻塞后续插件
    // 5. 全部加载完后 emit 'plugin:boot-complete'
  }
}
```

### 插件加载边界（MVP）

```
MVP 阶段：本地 TypeScript manifest
  插件 = src/main/plugins/packs/*.ts 中的 manifest 导出
  不需要独立子进程，不需要动态加载 .js 文件

后续（企业版阶段）：
  第三方插件运行在独立子进程 / MCP server
  与主进程通过 stdio/HTTP IPC 通信
  崩溃不影响主进程
```

---

## G4：错误处理策略（跨层）

### 问题

Agent Runtime 状态机有 `failed`、`cancelled`、`denied` 等异常状态，但没有定义各层如何处理错误、如何传播、如何恢复。

### 补充设计

```
层级错误策略：
  IPC 层:
    超时 (10s) → 返回 { error: 'timeout', message: '...' }
    主进程异常 → 返回 { error: 'internal', message: '...' }
    (不把主进程错误详情泄露给 renderer)

  Tool 层:
    执行失败 → ToolResult { status: 'error', error: { code, message, recoverable } }
    recoverable=true → Agent 可重试
    recoverable=false → Agent → failed 状态

  Agent Runtime 层:
    tool 失败 → 最多重试 2 次 → 仍失败 → TaskFailed 事件
    LLM 调用失败 → 重试 1 次 → 仍失败 → TaskFailed
    权限 denied → TaskDenied 事件（不算失败，算用户决策）

  Renderer 层:
    IPC 超时 → toast 通知 + 重试按钮
    TaskFailed → AgentPane 显示错误卡片 + "重新开始"按键
    TaskCancelled → AgentPane 显示已取消提示
    TaskDenied → AgentPane 显示权限被拒绝提示
    Artifact render 失败 → 显示 "渲染错误" fallback + 原数据文本

  不处理的情况（让用户知道）:
    网络断开
    模型 API key 无效
    磁盘空间不足
```

---

## G5：会话恢复 / 跨启动状态保存

### 问题

Electron 架构文档 Section 12 有 Session 数据模型，但没有说明应用关闭后再打开时如何恢复会话状态——特别是 AgentTask 处于 `executing` 或 `waiting_user_input` 等中间状态时。

### 补充设计

```text
关闭时：
  1. 所有 running AgentTask 标记为 paused
  2. SessionEvent 流序列化到 SQLite
  3. L1 scratchpad 写入 SQLite（临时标记）
  4. Artifact 持久化到文件系统
  5. Memory L2 已在 SQLite 中（无需额外操作）

启动时：
  1. 恢复上次打开的 session
  2. 从 SQLite 重放 SessionEvent 到 AgentPane
  3. L1 scratchpad 从 SQLite 恢复到内存
  4. paused 的 AgentTask 展示 "上次未完成，是否继续？"
  5. 用户确认 → AgentTask 从 paused → 重新进入 executing
  6. 用户取消 → AgentTask → cancelled 并展示部分生成的 Artifact

数据约定：
  - Session.id 持久化到 SQLite
  - SessionEvent 每收到一个就写 SQLite（流式持久化）
  - AgentTask 状态变更时更新 SQLite
  - Artifact 内容 > 1KB 时存文件系统，SQLite 只存 contentRef
```

---

## G6：Artifact 版本管理语义

### 问题

Artifact 有 `version` 字段，但没有定义版本的创建/递增规则、存储方式、对比方式。

### 补充设计

```text
版本规则：
  - 初始版本：version = 1
  - 每次 update（非 patch）→ version++
  - patch（局部修改）→ version 不变，内部记录 patch log
  - 旧版本不删除（保留全量历史）

存储方式：
  SQLite 表 artifact_versions:
    artifact_id, version, content, created_at, created_by

对比：
  - 同 Artifact 不同 version → DiffRenderer
  - 用户可恢复到任意历史版本
  - 恢复操作创建一个新版本（不覆盖）

MVP 简化：
  - 仅保留最近 10 个版本
  - 每个版本存全量 content（不做 delta）
  - 版本对比用 Monaco Diff Editor
```

---

## G7：测试策略

### 问题

三个文档都没有涉及测试策略。

### 补充建议

```text
测试分层：

  单元测试 (Vitest):
    - src/renderer/core/types/* 类型校验
    - src/main/agent/AgentTask 状态机
    - src/main/tools/ToolRouter 匹配逻辑
    - src/main/permission/PermissionService 三态判断
    - Jotai atoms 派生逻辑

  集成测试:
    - IPC channel 的 request/response 契约
    - ArtifactService CRUD 流程
    - MemoryService L1/L2 读写
    - AuditService 日志写入/查询

  E2E 测试 (Playwright + Electron):
    - ActivityBar 切换 → Sidebar 正确渲染
    - AgentPane 输入 → 事件流驱动 Conversation
    - PermissionInline 弹出 → 用户选择 → 工具继续/停止
    - Artifact 生成 → ArtifactPane Tab 展示

  Phase 0 开始就必须有：
    - npm run build 成功（TypeScript + Vite）
    - npm run test 有基础用例

  每个 Phase 结束时追加：
    - 对应模块的单元测试
    - 一条端到端场景的 E2E（Phase 2 开始）
```

---

## G8：性能约束与目标

### 补充

| 指标 | 目标 | 测量方式 |
|---|---|---|
| 应用冷启动 | < 3s | `app.on('ready')` 到 `ready-to-show` |
| Activity 切换 | < 100ms 可视延迟 | React Profiler |
| IPC invoke 延迟 | < 50ms (P95) | `ipcMain.handle` 内计时 |
| AgentEvent 推送延迟 | < 200ms 从 emit 到 renderer 渲染 | EventBus timestamp vs renderer setState |
| Artifact 渲染 ≤100KB | < 500ms | 大 Markdown/HTML 渲染 |
| Conversation 消息 < 500 条 | < 16ms 滚动帧率 | React Profiler |
| SQLite 写入 | < 10ms (P95) | better-sqlite3 同步写入 |

---

## G9：IPC 版本兼容与废弃策略

### 补充

```text
IPC channel 命名规则：
  feature:action 格式，如 agent:create-task

新增 channel：
  - 直接新增，旧 channel 保留一个 Phase 周期
  - 例如 agent:create-task 替代旧的直接数据操作

废弃 channel：
  - Phase N 标记为 deprecated
  - Phase N+1 移除（确认无 renderer 调用方）
  - preload 中标记 @deprecated 注释

不兼容变更：
  - 不改变已有 channel 的 request/response 结构
  - 如需要新字段 → 新建 channel，旧 channel 保留
```

---

## G10：CSS / 样式迁移方案

### 补充

```text
Phase 1 Shell 迁移时的样式原则：

  1. 新增 CSS 类遵循现有 Tailwind 原子类约定
  2. SidebarSlot 的宽度 `w-[260px]` 保持与现有 ChatsSidebar 一致
  3. 拖拽分隔线复用现有 resize handle 样式
  4. 空标题栏 40px + drag region 样式从现有 sidebar 组件抽取为 Tailwind 组合
  5. AgentPane/ArtifactPane 的容器样式直接复用现有 Conversation/OutputArea 容器

避免：
  - 不要在迁移过程中引入新的 CSS 文件或 CSS-in-JS 方案
  - 不要改变全局 CSS 变量（--app-*）
  - 不要新增 Tailwind 自定义类除非绝对必要
```

---

## 建议处理方式

| 缺失项 | 建议 |
|---|---|
| G1 ContextBuilder | 合并入 `electron-architecture.md` Section 4 |
| G2 ToolRouter 实现 | 合并入 `electron-architecture.md` Section 6 或单独 `docs/design/2026-06-04-tool-router-design.md` |
| G3 插件生命周期 | 合并入 `electron-architecture.md` Section 13 |
| G4 错误处理策略 | 合并入 `electron-architecture.md` 新增 Section |
| G5 会话恢复 | 合并入 `electron-architecture.md` Section 4 (Agent Runtime) |
| G6 Artifact 版本 | 合并入 `electron-architecture.md` Section 7 (Artifact) |
| G7 测试策略 | 合并入 `electron-architecture.md` 新增 Section 或独立 `docs/TESTING.md` |
| G8 性能约束 | 合并入需求文档 `foundation-spec.md` 新增 Section |
| G9 IPC 版本 | 合并入 `electron-architecture.md` Section 10 |
| G10 CSS 迁移 | 合并入执行计划 `refactoring-plan.md` Phase 1 |
