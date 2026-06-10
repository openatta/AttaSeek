# 项目系统 架构设计

**日期：** 2026-06-10
**基于需求：** `docs/reqs/2026-06-10-project-system.md`

---

## 1. 组件结构

| 组件 | 新建/修改 | 职责 |
|------|----------|------|
| `src/main/store/ProjectStore.ts` | 新建 | 项目元数据持久化（全局 `projects.json`），CRUD |
| `src/main/ipc/project.ts` | 新建 | `project:*` IPC 处理器：create/list/remove/validate |
| `src/renderer/components/Project/ProjectCreateDialog.tsx` | 新建 | 创建项目弹窗（名称输入 + 目录选择器 + 验证） |
| `src/renderer/components/Project/ProjectContextBadge.tsx` | 新建 | 当前活跃项目名的面包屑指示器（可选：置于 header 或 composer 上方） |
| `src/shared/types/ipc.ts` | 修改 | 新增 `ProjectInfo` 类型 |
| `src/shared/types/AgentTask.ts` | 修改 | `SessionInfo` 新增 `projectId?: string` |
| `src/shared/types/Memory.ts` | 修改 | `MemoryQuery` 新增 `projectId?: string` |
| `src/main/ipc/session.ts` | 修改 | `session:list` 支持 `projectId` 过滤 |
| `src/main/ipc/agent.ts` | 修改 | 新增 `agent:cancel-by-project` 通道（或扩展现有 cancel 逻辑） |
| `src/main/ipc/memory.ts` | 修改 | `memory:list` 支持 `projectId` 过滤 |
| `src/preload/index.ts` | 修改 | 新增 `api.project` 命名空间 |
| `src/main/index.ts` | 修改 | 注册 `registerProjectHandlers()` |
| `src/renderer/workspaces/ProjectsSidebar.tsx` | 修改 | 替换 mock 数据为真实 IPC 调用；新增移除项目右键菜单 |
| `src/renderer/workspaces/SidebarWrappers.tsx` | 修改 | `ProjectsSidebarConnected` 集成 CRUD 回调、项目上下文同步 |
| `src/renderer/atoms/sessionAtom.ts` | 修改 | 新增 `projectsAtom`；`selectedProjectIdAtom` 已有 |
| `src/renderer/registries/init.ts` | 不变 | projects activity + sidebar 已注册 |

---

## 2. 目录结构（新增部分）

```
src/
├── main/
│   ├── ipc/
│   │   └── project.ts              ← 新建
│   └── store/
│       └── ProjectStore.ts         ← 新建
├── renderer/
│   ├── components/
│   │   └── Project/
│   │       ├── ProjectCreateDialog.tsx  ← 新建
│   │       └── ProjectContextBadge.tsx  ← 新建
│   └── workspaces/
│       ├── ProjectsSidebar.tsx      ← 修改（替换 mock）
│       └── SidebarWrappers.tsx      ← 修改（集成回调）
└── shared/types/
    ├── AgentTask.ts                ← 修改（SessionInfo.projectId）
    ├── Memory.ts                   ← 修改（MemoryQuery.projectId）
    └── ipc.ts                      ← 修改（ProjectInfo）
```

---

## 3. 数据模型

### 3.1 类型定义

```typescript
// shared/types/ipc.ts — 新增
export interface ProjectInfo {
  id: string           // BASE58(UUID)
  name: string         // 用户输入的项目名称
  rootPath: string     // 项目根目录（绝对路径）
  createdAt: number    // 时间戳
}

// shared/types/AgentTask.ts — 修改 SessionInfo
export interface SessionInfo {
  id: string
  title: string
  activity: string
  projectId: string | null   // ← 新增：null=CHATS，非空=项目会话
  createdAt: number
  updatedAt: number
}

// shared/types/Memory.ts — 修改 MemoryQuery
export interface MemoryQuery {
  scope?: MemoryScope
  scopeId?: string
  projectId?: string          // ← 新增
  type?: MemoryType
  layer?: MemoryLayer
  query?: string
  limit?: number
}
```

### 3.2 全局存储结构

```
~/.atta/seek/
├── projects.json              ← 新建：ProjectInfo[]
├── sessions/
│   ├── _index.json            ← 已有：SessionInfo[]（每项含 projectId）
│   ├── {id}.json
│   └── {id}.jsonl
├── memory/                    ← 已有
└── audit/                     ← 已有
```

---

## 4. IPC Contract

| Channel | 方向 | 请求 | 响应 | 错误 | 备注 |
|---------|------|------|------|------|------|
| `project:create` | renderer→main | `{ name: string, rootPath: string }` | `{ project: ProjectInfo }` | `{ error: string }` | 新建；重名校验 |
| `project:list` | renderer→main | `{}` | `{ projects: ProjectInfo[] }` | — | 列出所有项目 |
| `project:remove` | renderer→main | `{ projectId: string }` | `{ success: boolean, deletedSessions: number }` | `{ error: string }` | 停止 agent → 删 session → 删元数据 → 清 .atta/seek/ |
| `project:validate` | renderer→main | `{ rootPath: string }` | `{ valid: boolean, exists: boolean, writable: boolean }` | `{ error: string }` | 创建前校验目录 |

**已有通道扩展：**

| Channel | 修改 |
|---------|------|
| `session:create` | 请求新增可选 `projectId?: string`，响应 session 含 projectId |
| `session:list` | 请求新增可选 `projectId?: string`，按 projectId 过滤 |
| `memory:list` | 请求新增可选 `projectId?: string`，映射为 `scope=project, scopeId=projectId` |
| `agent:cancel-by-project` | 新建通道：`{ projectId: string }` → `{ cancelled: number }` |

---

## 5. 主进程设计

### 5.1 ProjectStore

```
职责：管理 projects.json 的读写
方法：
  create(name, rootPath): ProjectInfo    — 写入，重名抛错
  list(): ProjectInfo[]                  — 读取全部
  remove(projectId): void                — 删除单条
  get(projectId): ProjectInfo | null     — 单条查找
存储：全局数据目录 ~/.atta/seek/projects.json
格式：JSON 数组 [{ id, name, rootPath, createdAt }]
并发：单 Electron 主进程，无需锁
```

### 5.2 project:remove 流程

```
1. 校验 projectId 存在
2. 查找所有 projectId 匹配的 session
3. 逐个取消 session 关联的活跃 agent 任务
   (调用 AgentRuntime.cancelTask / QueryEngine.interrupt)
4. 从 session _index.json 中删除匹配的 session 记录
5. 删除每个 session 的 {id}.json 和 {id}.jsonl
6. 从 projects.json 删除项目元数据
7. [文件系统] 若 rootPath 存在且有 .atta/seek/ → 递归删除
8. [文件系统] 若 rootPath/.atta/ 为空 → 删除 .atta/
9. 返回 { success, deletedSessions }
```

---

## 6. Jotai Atoms

| Atom | 类型 | 作用 | 位置 |
|------|------|------|------|
| `projectsAtom` | `ProjectInfo[]` | 所有项目列表（启动时加载） | `atoms/sessionAtom.ts`（新增） |
| `selectedProjectIdAtom` | `string \| null` | 当前选中的项目 ID | `atoms/sessionAtom.ts`（已有） |
| `projectRootAtom` | `string \| null` | 当前项目根路径 | `components/Artifact/ApAtoms.ts`（已有） |
| `apContextAtom` | `'chats' \| 'project'` | AP 面板上下文模式 | `components/Artifact/ApAtoms.ts`（已有） |

**派生关系：**
```
selectedProjectIdAtom 变化时
  → projectRootAtom = projectsAtom.find(p => p.id === id)?.rootPath || null
  → apContextAtom = rootPath ? 'project' : 'chats'
```

---

## 7. 数据流

### 7.1 创建项目

```
ProjectCreateDialog.onSubmit(name, rootPath)
  → getApi().project.create({ name, rootPath })
  → ipcRenderer.invoke('project:create', { name, rootPath })
  → main: project:create handler
    → ProjectStore.create(name, rootPath)
    → 返回 { project }
  → renderer: 收到响应
    → setProjectsAtom(prev => [...prev, project])
    → setSelectedProjectId(project.id)
    → projectRootAtom = rootPath
```

### 7.2 选中项目激活上下文

```
ProjectsSidebar.onSelectProject(project)
  → selectedProjectIdAtom = project.id
  → 派生: projectRootAtom = project.rootPath
  → 派生: apContextAtom = 'project'
  → AP 面板 FilePane/ReviewPane 门控满足 → 可用
```

### 7.3 创建项目会话

```
ProjectsSidebar.onAddSession()
  → getApi().session.create({ title, activity: 'projects', projectId })
  → ipcRenderer.invoke('session:create', { title, activity: 'projects', projectId })
  → main: session:create handler
    → SessionStore.createSession({ ..., projectId })
    → 返回 { session }
  → sessionListAtom 刷新
  → 左边栏对应项目下出现新会话
```

### 7.4 移除项目

```
ProjectsSidebar.onRemoveProject(projectId)
  → confirmDialog("确定移除？N 个会话将被删除。")
  → getApi().project.remove({ projectId })
  → ipcRenderer.invoke('project:remove', { projectId })
  → main: project:remove handler
    → ProjectStore.findSessions(projectId)
    → AgentRuntime.cancelTasksForSessions(sessionIds)
    → SessionStore.deleteSessions(sessionIds)
    → ProjectStore.remove(projectId)
    → fs.rm(<rootPath>/.atta/seek/) [如果目录存在]
    → fs.rmdir(<rootPath>/.atta/) [如果为空]
    → 返回 { success, deletedSessions }
  → renderer: projectsAtom 更新
  → selectedProjectIdAtom = null（若删除的是当前项目）
```

### 7.5 错误路径

```
project:create → rootPath 已绑定到另一个项目
  → 返回 { error: "目录已被项目 'xxx' 使用" }
  → 对话框显示红色提示

project:create → rootPath 不可写
  → 返回 { error: "目录无写入权限" }
  → 对话框显示红色提示

project:create → rootPath 不存在
  → 返回 { error: "DIR_NOT_FOUND", path }
  → 前端提示 "是否创建此目录？"

project:remove → projectId 不存在
  → 返回 { error: "项目不存在" }
  → 静默处理（可能已被其他窗口删除）

project:remove → 部分 session 有活跃 agent 任务
  → 先强制取消所有任务
  → 继续删除流程
  → 返回 { success, cancelledTasks: N }
```

---

## 8. 技术决策

| 决策 | 选择 | 理由 | 替代方案 |
|------|------|------|---------|
| 项目存储格式 | 全局 `projects.json` 数组 | 遵循 SessionStore 现有 JSON 模式；项目数量少（通常 < 20），无需数据库 | SQLite 表（当前无 ORM，新增复杂度） |
| 会话归属 | `SessionInfo.projectId` 字段 | 所有 session 共用一个 store，CHATS/project 靠 projectId 区分；避免双存储 | 独立 project-sessions 索引（查询复杂、重复代码） |
| 项目记忆隔离 | 复用 `MemoryEntry.scope='project'` + `scopeId=projectId` | Memory 类型已经建模了 project scope，只需正确设置值 | 新增 projectId 字段（冗余，scope+scopeId 已覆盖） |
| 移除项目清理范围 | 删 session 记录 + 项目元数据 + `.atta/seek/` 目录 | 需求明确要求完整清理 | 仅删元数据保留 session（session 属于项目，项目没了 session 无意义） |
| IPC 模式 | 遵循 `session.ts` 的 `ipcWrapAsync` + `validateRequiredString` 模式 | 项目内一致的错误处理风格 | agent.ts 的内联 try/catch 风格（不如 wrapper 一致） |
| 左边栏实现 | 重写 ProjectsSidebar 而非增量修改 | 当前实现是纯 mock，结构需要大改（添加移除菜单、IPC loading、空状态） | 增量修改 mock 代码（mock 结构不匹配真实数据流） |

---

## 9. 预加载 API

```typescript
// preload/index.ts — 新增 project 命名空间
project: {
  create: (name: string, rootPath: string): Promise<{ project?: ProjectInfo; error?: string }> =>
    ipcRenderer.invoke('project:create', { name, rootPath }),
  list: (): Promise<{ projects: ProjectInfo[] }> =>
    ipcRenderer.invoke('project:list'),
  remove: (projectId: string): Promise<{ success: boolean; deletedSessions?: number; error?: string }> =>
    ipcRenderer.invoke('project:remove', { projectId }),
  validate: (rootPath: string): Promise<{ valid: boolean; exists: boolean; writable: boolean }> =>
    ipcRenderer.invoke('project:validate', { rootPath }),
}
```
