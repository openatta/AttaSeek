# 自动化 / 插件 / 项目 Workspace 架构设计

**日期：** 2025-06-03
**基于需求：** [docs/requirements/2025-06-03-workspace-content.md](../requirements/2025-06-03-workspace-content.md)

---

## 组件结构

### 文件清单

```
src/renderer/workspaces/          # 已有，修改 3 个 + 新建 6 个
├── ChatWorkspace.tsx              # (不改)
├── ChatsSidebar.tsx               # (不改, 参考模式)
├── AutomationWorkspace.tsx        # 重写: 2 区布局
├── AutomationSidebar.tsx          # 新建: 任务左栏
├── AutomationDetail.tsx           # 新建: 任务详情区
├── PluginWorkspace.tsx            # 重写: 2 区布局
├── PluginSidebar.tsx              # 新建: 分类左栏
├── PluginList.tsx                 # 新建: 网格卡片视图
├── PluginDetail.tsx               # 新建: 详情视图
├── ProjectsWorkspace.tsx          # 重写: 3 区布局
├── ProjectsSidebar.tsx            # 新建: 项目+会话左栏
├── mock/                          # 新建: Mock 数据目录
│   ├── automation.ts
│   ├── plugins.ts
│   └── projects.ts

src/renderer/components/OutputArea/
├── FilesPanel.tsx                 # 重写: 目录树+文件内容
├── ReviewPanel.tsx                # 重写: Git diff mock
```

### 组件树

```
WorkspaceRouter
├── ChatWorkspace
│   ├── ChatsSidebar   (参考模式: 空 40px header + CHATS 标题 + 列表)
│   ├── Conversation
│   └── OutputArea (可选)
│
├── AutomationWorkspace
│   ├── AutomationSidebar (对齐 ChatsSidebar 结构)
│   │   ├── [40px drag header — 空]
│   │   ├── "AUTOMATION" + [+] 标题行
│   │   └── 任务列表 (状态指示器 + 名称)
│   └── AutomationDetail
│       ├── [40px drag header — 空]
│       └── 任务详情卡片 (名称/描述/触发/状态/操作按键)
│
├── PluginWorkspace
│   ├── PluginSidebar (对齐 ChatsSidebar 结构)
│   │   ├── [40px drag header — 空]
│   │   ├── "PLUGINS" 标题
│   │   └── 分类列表 (可折叠)
│   └── 视图区
│       ├── [40px drag header — 空] (列表视图)
│       ├── 列表: tabs [市场/已安装/更新] + 搜索 + 卡片网格
│       └── 详情: ← 返回 + 插件信息 + 操作按键
│
├── ProjectsWorkspace
│   ├── ProjectsSidebar
│   │   ├── [40px drag header — 空]
│   │   ├── "PROJECTS" + [+] 标题行
│   │   └── 项目列表 → 点开展开最近会话
│   ├── 主区
│   │   ├── [40px drag header — 空]
│   │   └── 会话内容 (Conversation 或项目空状态)
│   └── OutputArea
│       ├── [Files tab] → FilesPanel (目录树 + 文件内容)
│       └── [Review tab] → ReviewPanel (changed files + diff)
│
├── SettingsWorkspace (不改)
├── DashboardWorkspace (不改)
├── SearchWorkspace (不改)
└── (其余...)
```

---

## 边栏统一模式

三个 workspace 左边栏对齐 ChatsSidebar 的结构：

```tsx
// 每个 sidebar 组件遵循此模式:
<div className="flex flex-col h-full">
  {/* 空标题栏 — 仅用于拖动窗口 */}
  <div className="flex-shrink-0 h-[40px]" style={{ WebkitAppRegion: 'drag' }} />

  {/* 内容标题行 — 标题在下方，非 drag 区域 */}
  <div className="flex items-center px-4 pb-2">
    <h2 className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">
      TITLE
    </h2>
    <div className="flex-1" />
    {/* 可选 + 按键 */}
    {showAdd && <button ...><Plus /></button>}
  </div>

  {/* 内容区 */}
  <div className="flex-1 min-h-0 overflow-y-auto">
    {children}
  </div>
</div>
```

**共享 LeftSidebar shell?** → 不需要。每个 sidebar 足够简单 (~20 行)，封装成可复用组件反而需要传很多 props (title, showAdd, onAdd, children)。各自手写 20 行更清晰。

---

## 数据流

### 状态管理

| 状态 | 类型 | 范围 | 说明 |
|------|------|------|------|
| 自动化选中任务 | `useState<string \| null>` | AutomationWorkspace 本地 | 当前选中的任务 ID |
| 插件视图 | `useState<'list' \| 'detail'>` | PluginWorkspace 本地 | 列表 / 详情 |
| 选中插件 | `useState<string \| null>` | PluginWorkspace 本地 | 当前查看的插件 ID |
| 项目导航栈 | `useState<{project: string, session?: string} \| null>` | ProjectsWorkspace 本地 | 当前展开的项目 + 选中会话 |
| 左边栏宽度 (3 个 ws) | `useState<number>` | 各 Workspace 本地 | 默认 260px |
| 输出区可见 (项目) | outputAreaVisibleAtom | 全局 | 默认 true (项目场景下) |
| 输出区 tabs (项目) | outputTabsAtom | 全局 | 进入时填充 [{files}, {review}] |
| Mock 数据 | `const` 常量 | 模块级 | 独立 mock/*.ts 文件 |

### 数据流向

**自动化:**
```
AutomationWorkspace local: selectedTaskId
  ↓
AutomationSidebar ← 任务列表 (mock data) + 选中高亮
AutomationDetail  ← 读取 selectedTaskId, 匹配 mock data 显示详情
  ↑
用户点击任务 → setSelectedTaskId(taskId)
```

**插件:**
```
PluginWorkspace local: view ('list' | 'detail') + selectedPluginId
  ↓
PluginSidebar   ← 分类列表 (折叠状态 local useState)
PluginList      ← 卡片网格 (mock data, 过滤 selectedCategory)
PluginDetail    ← 读取 selectedPluginId, 匹配 mock data
  ↑
用户点击插件 → setView('detail') + setSelectedPluginId(id)
用户点返回   → setView('list') + setSelectedPluginId(null)
```

**项目:**
```
ProjectsWorkspace local: nav {project, session?}
  ↓
ProjectsSidebar ← 项目列表 (可展开/折叠) + 选中高亮
Main area      ← 会话内容 (Conversation 或空状态)
OutputArea     ← outputVisibleAtom.start(true)
              ← outputTabsAtom.start([{files}, {review}])
              ← FilesPanel → 目录树 + 文件内容
              ← ReviewPanel → changed files
  ↑
用户点项目    → setNav({project: id}) — 左边栏展开最近会话
用户点会话    → setNav({project: id, session: id}) — 主区显示会话
用户点文件    → FilesPanel 本地 setSelectedFile(path)
```

### Activity 切换副作用

`ProjectsWorkspace` 进入时需初始化：
- `useEffect(() => { setOutputTabs([...]) })` 填充 Files + Review tabs
- 不需要在退出时清理（全局 tabs 被下一个 workspace 覆盖）

`AutomationWorkspace` / `PluginWorkspace` 不需要操作 outputTabsAtom——它们不需要右边栏。

---

## Jotai Atoms

**不需要新增 atom。** 所有导航状态是 workspace 本地 `useState`——不同 workspace 之间不共享。OutputArea tabs 沿用现有的 `outputTabsAtom`。

---

## IPC Contract

**不涉及 IPC。** 数据全部 mock。

---

## Mock 数据结构

### automation.ts
```ts
export interface AutomationTask {
  id: string
  name: string
  description: string
  trigger: string
  triggerType: 'cron' | 'hook' | 'manual'
  status: 'running' | 'idle' | 'scheduled' | 'stopped'
  lastRun?: string  // e.g. "3m ago"
}
export const MOCK_TASKS: AutomationTask[]  // 5 entries
```

### plugins.ts
```ts
export interface PluginCategory {
  id: string
  label: string
  plugins: PluginItem[]
}
export interface PluginItem {
  id: string
  name: string
  icon: string       // emoji
  version: string
  description: string
  installed: boolean
}
export const MOCK_CATEGORIES: PluginCategory[]  // 5 categories, 17 plugins
```

### projects.ts
```ts
export interface ProjectItem {
  id: string
  name: string
  sessions: { id: string; name: string; summary: string }[]
}
export const MOCK_PROJECTS: ProjectItem[]  // 4 projects
export const MOCK_FILE_TREE: TreeNode[]    // directory tree
export const MOCK_DIFF_FILES: DiffFile[]   // changed files
```

---

## 技术决策

| # | 决策 | 方案 | 理由 |
|---|------|------|------|
| D1 | Sidebar 不复用成通用组件 | 每个 workspace 各自写 ~20 行 sidebar | 模式简单，复用反而需要过多 props 配置 |
| D2 | 导航状态用 `useState` 非 atom | 各 workspace 独立本地状态 | 不需要跨 workspace 持久化；切换 activity 时自然重置 |
| D3 | Plugin 详情用条件渲染非路由 | `view === 'detail' ? <PluginDetail> : <PluginList>` | 无 URL 路由需求，条件渲染足够 |
| D4 | 项目右边栏复用 OutputArea | 进入 ProjectsWorkspace 时 `useEffect` 填充 tabs | 不重复造 OutputArea 的标题栏/拖拽/全屏逻辑 |
| D5 | FilesPanel 内部分左右 | 左半区目录树 (240px) + 右半区文件内容 (flex-1) | 保持 OutputArea 内一致的两栏专家模式 |
| D6 | Mock 数据放独立文件 | `src/renderer/workspaces/mock/*.ts` | 与组件逻辑分离，后续可替换为真实数据源 |
| D7 | 项目右侧 tabs 默认 files + review | ProjectsWorkspace 进入时 `setOutputTabs(...)` 覆盖 | Chat 场景的 terminal/browser tabs 与 Project 场景无关 |
| D8 | 文件点击 → FilesPanel 本地状态 | `useState<string \| null> selectedFile` 在 FilesPanel 内 | 不需要全局知道哪个文件被打开了 |

---

## 实现顺序

```
Phase 1: Mock 数据 + 共享模式
  T1: 创建 mock/automation.ts, mock/plugins.ts, mock/projects.ts (3 个 mock 文件)
  T2: 修改 ProjectsWorkspace: 重写侧栏 + OutputArea tabs 初始化

Phase 2: 自动化
  T3: AutomotiveSidebar (任务列表 + 状态指示器)
  T4: AutomotiveWorkspace + AutomotiveDetail (选中高亮 + 详情卡片)

Phase 3: 插件
  T5: PluginSidebar (分类折叠)
  T6: PluginList (网格卡片 + 搜索/过滤 tab)
  T7: PluginDetail (返回按键 + 信息 + 操作)
  T8: PluginWorkspace (组装)

Phase 4: 项目
  T9: ProjectsSidebar (项目列表 + 展开会话 + 多层导航)
  T10: FilesPanel 重写 (目录树 + 文件内容)
  T11: ReviewPanel 重写 (diff 文件列表)
  T12: ProjectsWorkspace 主区会话内容

Phase 5: 测试
  T13: 更新/新增测试
```

---

## 交接

架构设计完成。交接至 → `/implement`。
