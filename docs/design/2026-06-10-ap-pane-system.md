# AP 多 Pane Tab 系统 架构设计

**日期：** 2026-06-10
**基于需求：** `docs/reqs/2026-06-10-artifact-pane-modes.md`

---

## 1. 新增依赖

| 包 | 用途 | 许可证 |
|---|------|--------|
| `monaco-editor` + `@monaco-editor/react` | 文件预览语法高亮、审查 Pane diff 编辑器 | MIT |
| `@xterm/xterm` + `@xterm/addon-fit` + `@xterm/addon-webgl` | 终端 Pane 渲染 | MIT |
| `node-pty` | 主进程伪终端（spawn shell） | MIT |
| `file-icons-js`（可选） | File Explorer 文件类型图标 | MIT |

> **Monaco diff 决策**：Monaco Editor 内置 `createDiffEditor()` 是 VS Code 自身使用的 diff 引擎，支持 side-by-side / inline、语法高亮、逐行对比。无需额外 diff 库。

---

## 2. 组件结构

```
src/renderer/components/Artifact/
├── ApContainer.tsx             重写（替换 ArtifactPane.tsx）
├── ApTabBar.tsx                新建 — AP 标题栏 Tab 系统
├── ApEmptyState.tsx            新建 — 空闲大按钮视图
├── ApPaneHost.tsx              新建 — 按 paneType 路由到具体 Pane
├── ApAtoms.ts                  新建 — AP 级 Jotai atoms
├── PaneRegistry.ts             新建 — Pane 类型注册表（Registry<PaneRegistration>）
├── panes/                      新建 — 4 个独立 Pane
│   ├── BrowserPane/
│   │   ├── BrowserPane.tsx
│   │   ├── BrowserNavBar.tsx
│   │   ├── BrowserMenu.tsx
│   │   └── DeviceToolbar.tsx
│   ├── TerminalPane/
│   │   ├── TerminalPane.tsx
│   │   └── useTerminal.ts
│   ├── FilePane/
│   │   ├── FilePane.tsx
│   │   ├── FileExplorer.tsx
│   │   ├── FileSubHeader.tsx
│   │   ├── FilePreviewArea.tsx
│   │   └── filePaneAtoms.ts
│   └── ReviewPane/
│       ├── ReviewPane.tsx
│       ├── ReviewSubHeader.tsx
│       ├── DiffView.tsx
│       ├── CommitHistory.tsx
│       └── reviewPaneAtoms.ts
```

### 组件职责

| 组件 | 职责 | 新建/修改 |
|------|------|----------|
| `ApContainer` | AP 根组件：管理 Tab 列表、渲染 TabBar + 内容区或 EmptyState | 重写（替换 ArtifactPane） |
| `ApTabBar` | 渲染 `[Tab]…[+] [<] [>]`、Tab hover 关闭、激活切换、溢出滚动 | 新建 |
| `ApEmptyState` | 空闲状态大按钮（64×64 图标+文字），上下文决定显示 2 或 4 个 | 新建 |
| `ApPaneHost` | 查 `PaneRegistry` 获取组件，渲染激活 Tab 对应 Pane | 新建 |
| `PaneRegistry` | `Registry<PaneRegistration>`，映射 `paneType → { component, label, icon, constraints }` | 新建 |
| `BrowserPane` | Electron `<webview>` + 导航栏 + 设置菜单 + 设备工具栏 | 新建 |
| `BrowserNavBar` | 后退/前进/刷新 + URL 输入 | 新建 |
| `BrowserMenu` | ⋮ 下拉菜单 7 项 | 新建 |
| `DeviceToolbar` | Chrome DevTools 设备模拟 | 新建 |
| `TerminalPane` | xterm.js 终端实例，通过 IPC 与主进程 pty 通信 | 新建 |
| `useTerminal` | 终端生命周期 hook：创建 pty、attach xterm、resize、dispose | 新建 |
| `FilePane` | 文件 Pane 主组件：管理预览区 Tab + Explorer 状态 | 新建 |
| `FileSubHeader` | 副标题栏：根目录路径（文本）+ Explorer toggle | 新建 |
| `FileExplorer` | 树形目录导航（递归组件），VS Code 对齐 | 新建 |
| `FilePreviewArea` | Monaco Editor 为主的预览区 + 内部 Tab 系统 + MD/PDF/图片 fallback | 新建 |
| `ReviewPane` | 审查 Pane 主组件：管理分支/范围/文件/diff 状态 | 新建 |
| `ReviewSubHeader` | 分支选择器 + 范围选择器 + Staged/Unstaged + StageAll/RevertAll | 新建 |
| `DiffView` | Monaco `createDiffEditor()` 封装，支持 side-by-side/inline 切换 | 新建 |
| `CommitHistory` | Commit 列表 + 展开 diff | 新建 |

### 删除/废弃

| 文件 | 处理 |
|------|------|
| `src/renderer/components/Artifact/ArtifactPane.tsx` | 完全重写为 ApContainer + 子组件 |
| `src/renderer/atoms/outputTabsAtom.ts` | 替换为 `ApAtoms.ts` 中的新 atoms |

### 保留不变

| 文件 | 说明 |
|------|------|
| `src/renderer/renderers/*/*.tsx` | 6 个现有渲染器保留，未来被 Monaco 替代前仍可用 |
| `src/renderer/registries/artifactRendererRegistry.ts` | 保留，FilePane 的预览区可兼用 |
| `src/renderer/layouts/Shell.tsx` | 仅更新 import 路径（ArtifactPane → ApContainer） |
| `src/renderer/layouts/AppSpace.tsx` | 不变 |

---

## 3. Pane 注册表（PaneRegistry）

```typescript
// PaneRegistry.ts
import { Registry } from '../../registries/Registry'
import type { ComponentType } from 'react'

export type PaneType = 'browser' | 'terminal' | 'file' | 'review'

export interface PaneConstraints {
  singleInstance: boolean          // 是否单实例
  requireProject: boolean          // 是否需要项目上下文
}

export interface PaneRegistration {
  type: PaneType
  component: ComponentType<PaneProps>
  label: string                    // 中文：浏览器/终端/文件/审查
  icon: string                     // 大按钮用图标
  constraints: PaneConstraints
}

export interface PaneProps {
  apTabId: string                  // AP 级 Tab ID（用于关闭、切换）
  // 每个 Pane 自行管理内部状态
}

const paneRegistry = new Registry<PaneRegistration>()

export function registerPane(config: PaneRegistration): void { ... }
export function getPane(type: PaneType): PaneRegistration | undefined { ... }
export function listPanes(): PaneRegistration[] { ... }
export { paneRegistry }
```

---

## 4. 数据流

### 4.1 AP 级状态（Jotai Atoms）

```
ApAtoms.ts
├── apTabsAtom           : ApTab[]              — Tab 列表
├── activeApTabAtom      : string | null        — 活跃 Tab ID
├── apVisibleAtom        : boolean              — AP 面板可见性（已有）
├── apFullscreenAtom     : boolean              — AP 最大化（已有）
├── apContextAtom        : 'chats' | 'project'  — 当前上下文
├── browserInstanceAtom  : boolean              — 浏览器实例是否存在
└── projectRootAtom      : string | null        — 项目根路径
```

```typescript
// ApAtoms.ts 核心类型
export interface ApTab {
  id: string              // 唯一 Tab ID
  paneType: PaneType      // Pane 类型
  label: string           // Tab 显示标签
}
```

### 4.2 数据流路径

```
用户点击大按钮 "终端"
  → ApEmptyState.onClick('terminal')
  → apTabsAtom 新增 { id, paneType:'terminal', label:'Terminal' }
  → activeApTabAtom 设为新 id
  → ApPaneHost 根据 paneType 渲染 TerminalPane
  → TerminalPane 通过 IPC 请求主进程创建 pty

用户点击 Tab 关闭 ×
  → ApTabBar.onClose(tabId)
  → apTabsAtom 移除对应 Tab
  → 如果是活跃 Tab：切换到相邻 Tab 或清空
  → 对应的 Pane 组件被卸载
  → (TerminalPane 情况：IPC 通知主进程 kill pty)

用户点击 [+]
  → ApTabBar.onAddClick()
  → 计算可用 Pane 列表（过滤上下文 + 单实例约束）
  → 渲染下拉菜单
  → 用户选择 → 同 "点击大按钮"

用户在 FilePane 展开/点击文件
  → FileExplorer 通过 IPC ('fs:read-dir') 获取子节点
  → 点击文件 → IPC ('fs:read-file') 获取内容
  → FilePane 内部 state 更新 openFiles
  → FilePreviewArea 渲染 Monaco 或对应预览器

用户在 ReviewPane 切换范围
  → ReviewSubHeader 更新 scope 状态
  → IPC ('git:diff') 获取新范围 diff
  → DiffView 更新 Monaco diff editor 内容
```

### 4.3 错误路径

```
IPC ('fs:read-dir') 失败
  → FileExplorer 节点显示错误图标 + tooltip
  → 不展开子节点

IPC ('fs:read-file') 文件过大
  → FilePreviewArea 显示 "文件过大，无法预览"
  → 不创建 Monaco 模型

IPC ('git:diff') 失败 (非 git 目录)
  → ReviewPane 显示引导提示
  → CommitHistory 不可用

pty spawn 失败
  → TerminalPane 显示错误信息 "终端创建失败"
  → 可重试
```

---

## 5. IPC Contract

### 5.1 文件系统通道

> 遵循现有 `feature:action` 约定

| Channel | 方向 | 请求 | 响应 | 错误 |
|---------|------|------|------|------|
| `fs:read-dir` | renderer→main | `{ path: string }` | `{ entries: DirEntry[] }` | `{ error: string }` |
| `fs:read-file` | renderer→main | `{ path: string, maxSize?: number }` | `{ content: string, size: number, mime: string }` | `{ error: string }` |
| `fs:file-info` | renderer→main | `{ path: string }` | `{ exists: boolean, size: number, mime: string, isDir: boolean }` | `{ error: string }` |
| `fs:create-file` | renderer→main | `{ path: string, content?: string }` | `{ success: boolean }` | `{ error: string }` |
| `fs:create-dir` | renderer→main | `{ path: string }` | `{ success: boolean }` | `{ error: string }` |
| `fs:delete` | renderer→main | `{ path: string, recursive?: boolean }` | `{ success: boolean }` | `{ error: string }` |
| `fs:rename` | renderer→main | `{ oldPath: string, newPath: string }` | `{ success: boolean }` | `{ error: string }` |

```typescript
// 共享类型
export interface DirEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  mime?: string
}
```

### 5.2 Git 通道

| Channel | 方向 | 请求 | 响应 |
|---------|------|------|------|
| `git:status` | renderer→main | `{ repoPath: string }` | `{ branch: string, changedFiles: GitFileStatus[] }` |
| `git:branches` | renderer→main | `{ repoPath: string }` | `{ branches: string[], current: string }` |
| `git:diff` | renderer→main | `{ repoPath: string, scope: 'uncommitted'\|'branch'\|'lastTurn', staged?: boolean }` | `{ files: GitDiffFile[] }` |
| `git:stage` | renderer→main | `{ repoPath: string, files?: string[], hunks?: string[] }` | `{ success: boolean }` |
| `git:unstage` | renderer→main | `{ repoPath: string, files?: string[] }` | `{ success: boolean }` |
| `git:revert` | renderer→main | `{ repoPath: string, files?: string[], hunks?: string[] }` | `{ success: boolean }` |
| `git:commit` | renderer→main | `{ repoPath: string, message: string }` | `{ success: boolean, commitHash?: string }` |
| `git:log` | renderer→main | `{ repoPath: string, maxCount?: number }` | `{ commits: GitCommit[] }` |
| `git:show` | renderer→main | `{ repoPath: string, ref: string }` | `{ diff: string }` |

```typescript
export interface GitFileStatus {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
  staged: boolean
  additions: number
  deletions: number
}

export interface GitDiffFile {
  path: string
  status: string
  additions: number
  deletions: number
  hunks: GitHunk[]
  oldContent: string
  newContent: string
}

export interface GitHunk {
  header: string
  lines: string[]
}

export interface GitCommit {
  hash: string
  shortHash: string
  message: string
  author: string
  date: number
}
```

### 5.3 终端通道

| Channel | 方向 | 请求 | 响应 |
|---------|------|------|------|
| `terminal:create` | renderer→main | `{ cwd: string, cols: number, rows: number }` | `{ terminalId: string }` |
| `terminal:write` | renderer→main | `{ terminalId: string, data: string }` | — |
| `terminal:resize` | renderer→main | `{ terminalId: string, cols: number, rows: number }` | — |
| `terminal:destroy` | renderer→main | `{ terminalId: string }` | `{ success: boolean }` |
| `terminal:output` | main→renderer | — (push event) | `{ terminalId: string, data: string }` |

### 5.4 主进程新增模块

```
src/main/ipc/
├── filesystem.ts    新建 — 注册 fs:* handlers
├── git.ts           新建 — 注册 git:* handlers
├── terminal.ts      新建 — 注册 terminal:* handlers + pty 管理
```

---

## 6. 主进程设计

### 6.1 文件系统 IPC 安全

```typescript
// 安全规则
// 1. 所有路径操作验证是否在允许范围内
// 2. 允许的根目录：项目根路径（projectRootAtom）或 ~/Documents
// 3. 拒绝包含 '..' 的路径
// 4. 拒绝符号链接跟踪到允许范围外
```

### 6.2 Git IPC 实现

```typescript
// 使用 child_process.execFile 调用 git CLI
// 命令：git status --porcelain, git diff, git log, etc.
// 安全：限制在 repoPath 目录内执行
// 错误处理：git 未安装 → 返回明确错误码
```

### 6.3 终端 IPC 实现

```typescript
// 使用 node-pty 创建伪终端
// 每个 terminalId 对应一个 pty 实例
// 主进程维护 Map<terminalId, IPty>
// pty.onData → 推送 terminal:output 事件到渲染进程
// 渲染进程 dispose → 主进程 kill pty + 清理 Map
```

---

## 7. 4 个 Pane 详细设计

### 7.1 BrowserPane

```
BrowserPane
├── 状态：url, canGoBack, canGoForward, deviceToolbarVisible, zoom
├── 全部组件本地 useState，不涉及 Jotai
├── 标签：<webview> + 导航栏 + 菜单
└── 设备工具栏：Electron webContents.setUserAgent() + CSS viewport
```

**webview 配置：**
```typescript
<webview
  src={url}
  style={{ width: '100%', height: '100%' }}
  nodeintegration="false"
  webpreferences="sandbox=yes"
/>
```

### 7.2 TerminalPane

```
TerminalPane
├── 状态：terminalId（主进程 pty ID）
├── 生命周期：mount → IPC terminal:create → attach xterm → unmount → IPC terminal:destroy
├── useTerminal hook 封装全部逻辑
└── 多实例：每个 ApTab 对应一个独立的 TerminalPane 实例
```

**useTerminal hook：**
```typescript
function useTerminal(containerRef: RefObject<HTMLDivElement>, cwd: string) {
  // 1. mount 时 IPC terminal:create → 获取 terminalId
  // 2. 创建 xterm.Terminal 实例，attach 到 containerRef
  // 3. 监听 xterm.onData → IPC terminal:write
  // 4. 监听 IPC terminal:output → xterm.write
  // 5. 监听 resize → IPC terminal:resize
  // 6. unmount 时 IPC terminal:destroy → xterm.dispose
}
```

### 7.3 FilePane

```
FilePane
├── 状态（filePaneAtoms）：
│   ├── rootPath: string                            — 根目录路径
│   ├── explorerVisible: boolean                    — Explorer 显隐
│   ├── explorerNodes: Map<string, TreeNode>        — 树展开状态
│   ├── openFiles: FileTab[]                        — 预览区内部 Tab 列表
│   ├── activeFileId: string | null                 — 活跃文件 Tab
│   └── selectedExplorerPath: string | null         — Explorer 当前选中
├── FileSubHeader：path 文本 + toggle 按钮
├── FileExplorer：递归树组件
│   ├── 每个节点：展开/折叠 + 图标 + 文件名
│   ├── 右键菜单：新建文件/文件夹、删除、重命名、复制路径
│   └── 当前打开文件自动高亮（activeFileId → 滚动到可见）
└── FilePreviewArea：
    ├── 内部 Tab 栏（与 AP TabBar 不同——这是 FilePane 内二级 Tab）
    ├── Monaco Editor 渲染代码文件
    ├── 图片：<img> + 缩放控制
    ├── PDF：<iframe> 或 <embed>
    └── MD：react-markdown 渲染 / Monaco 源码切换
```

**FileExplorer 递归树组件接口：**
```typescript
interface FileTreeNode {
  name: string
  path: string
  isDir: boolean
  children?: FileTreeNode[]
}

interface FileExplorerProps {
  rootPath: string
  onFileClick: (path: string) => void
  onContextMenu: (path: string, x: number, y: number) => void
  activeFilePath: string | null
}
```

### 7.4 ReviewPane

```
ReviewPane
├── 状态（reviewPaneAtoms）：
│   ├── branch: string                               — 当前分支
│   ├── branches: string[]                           — 分支列表
│   ├── scope: 'uncommitted' | 'branch' | 'lastTurn'
│   ├── showStaged: boolean
│   ├── changedFiles: GitDiffFile[]
│   ├── selectedFilePath: string | null
│   ├── diffMode: 'side-by-side' | 'inline'
│   ├── commits: GitCommit[]
│   └── commitMessage: string
├── ReviewSubHeader（Codex 对齐）：
│   ├── 分支选择器 <select>
│   ├── 范围选择器 <select>（3 项）
│   ├── Staged(N) / Unstaged(M) 计数
│   └── [Stage All] [Revert All] 按钮
├── 内容区：
│   ├── Commit 消息输入框 + [Commit] 按钮
│   ├── 变更文件列表 → 点击展开 diff
│   ├── DiffView（Monaco createDiffEditor）← 核心
│   └── CommitHistory → 点击展开历史 diff
└── 逐块操作：每个 hunk 下方 [Stage hunk] [Revert hunk]
```

**DiffView 接口：**
```typescript
interface DiffViewProps {
  original: string          // 原始内容
  modified: string          // 修改后内容
  language: string          // 语言标识符
  mode: 'side-by-side' | 'inline'
  onStageHunk?: (hunkIndex: number) => void
  onRevertHunk?: (hunkIndex: number) => void
}
```

---

## 8. 上下文门控

```typescript
// ApEmptyState.tsx / ApTabBar.tsx [+] 菜单中的可用 Pane 计算

function useAvailablePanes(): PaneRegistration[] {
  const context = useAtomValue(apContextAtom)
  const hasProject = useAtomValue(projectRootAtom) !== null
  const hasBrowser = useAtomValue(browserInstanceAtom)
  const tabs = useAtomValue(apTabsAtom)

  return listPanes().filter((p) => {
    // 上下文过滤
    if (p.constraints.requireProject && !(context === 'project' && hasProject)) return false
    // 单实例过滤
    if (p.constraints.singleInstance && hasBrowser && p.type === 'browser') return false
    return true
  })
}
```

---

## 9. 注册初始化

```typescript
// 在 registries/init.ts 中新增 Pane 注册

import { registerPane } from '../../components/Artifact/PaneRegistry'
import BrowserPane from '../../components/Artifact/panes/BrowserPane/BrowserPane'
import TerminalPane from '../../components/Artifact/panes/TerminalPane/TerminalPane'
import FilePane from '../../components/Artifact/panes/FilePane/FilePane'
import ReviewPane from '../../components/Artifact/panes/ReviewPane/ReviewPane'

// ── Pane 注册 ──────────────────────────────────────
registerPane({ type: 'browser',  component: BrowserPane,  label: '浏览器', icon: '🖥', constraints: { singleInstance: true,  requireProject: false } })
registerPane({ type: 'terminal', component: TerminalPane, label: '终端',   icon: '>_', constraints: { singleInstance: false, requireProject: false } })
registerPane({ type: 'file',     component: FilePane,     label: '文件',   icon: '📂', constraints: { singleInstance: false, requireProject: true  } })
registerPane({ type: 'review',   component: ReviewPane,   label: '审查',   icon: '📊', constraints: { singleInstance: false, requireProject: true  } })
```

---

## 10. 技术决策

| 决策 | 选择 | 理由 | 替代方案 |
|------|------|------|---------|
| 代码预览编辑器 | Monaco Editor (`@monaco-editor/react`) | VS Code 同源，语法高亮覆盖 60+ 语言，内置 diff editor；项目技术栈已规划 | CodeMirror 6（更轻量但语言支持少） |
| Git diff 渲染 | Monaco `createDiffEditor()` | VS Code 自身使用的 diff 实现，支持 side-by-side/inline，无需额外依赖 | `@git-diff-view/react`、`diff2html` |
| 终端实现 | xterm.js + node-pty | 行业标准，VS Code/Hyper 使用；Electron 兼容良好 | `electron-terminal`（不成熟） |
| File Explorer 树 | 自定义 React 递归组件 | VS Code tree 是内部实现无法复用；递归组件够用且可控；未来可升级虚拟滚动 | `react-vtree`（引入额外抽象层） |
| Pane 组合方式 | Registry 模式（与现有 artifactRendererRegistry 一致） | 遵循项目已有模式；插件可扩展；每个 Pane 零耦合 | 硬编码 switch-case |
| Pane 状态管理 | 每个 Pane 独立管理内部状态 | 遵循"独立 Pane"设计原则；AP 级只管理 Tab 列表；Pane 内部用 Jotai atom 或 useState | 统一 store（导致 Pane 耦合） |
| IPC 模式 | `feature:action` + 共享类型 | 遵循项目已建立的约定；preload 层类型安全 | 自定义协议、WebSocket |
| Electron webview | `<webview>` 标签 | Electron 原生支持，沙盒隔离，独立 session | `<iframe>`（限制多） |
| Git 操作 | 调用 git CLI (`child_process.execFile`) | VS Code 同样使用 git CLI；无需编译 libgit2；所有平台兼容 | `simple-git`（Node.js 包装，但 VS Code 用 CLI） |

---

## 11. 布局组件关系

```
Shell
├── ActivityBar
├── SidebarSlot
├── AppSpace
│   ├── AgentPane (左侧会话区)
│   └── ApContainer (右侧 AP 区，替换原 ArtifactPane)
│       ├── ApTabBar（AP 标题栏：Tab + [+] + [<][>] + 放大/缩小 toggle + 显示/隐藏 toggle）
│       ├── ApEmptyState（无 Tab 时居中大按钮）
│       └── ApPaneHost（有 Tab 时渲染对应 Pane）
│           ├── BrowserPane
│           │   ├── BrowserNavBar
│           │   ├── <webview>
│           │   └── DeviceToolbar（toggle）
│           ├── TerminalPane
│           │   └── xterm.js instance
│           ├── FilePane
│           │   ├── FileSubHeader
│           │   ├── FilePreviewArea（左）
│           │   │   ├── 内部 Tab 栏
│           │   │   └── Monaco / MD / PDF / Image 渲染
│           │   └── FileExplorer（右，可 toggle）
│           └── ReviewPane
│               ├── ReviewSubHeader
│               ├── Commit 输入框
│               ├── 变更文件列表
│               ├── DiffView（Monaco diff editor）
│               └── CommitHistory
```

---

## 12. 实施偏差说明

以下设计决策在实施中调整：

| 设计计划 | 实际实施 | 原因 |
|---------|---------|------|
| `filePaneAtoms.ts` (Jotai atoms) | FilePane 状态全部在组件内 `useState` | 多实例场景下 Jotai atoms 需动态 key 管理，useState 更简单且隔离天然正确 |
| `reviewPaneAtoms.ts` (Jotai atoms) | ReviewPane 状态全部在组件内 `useState` | 同上 |
| `languageFromPath` 内联在两处 | 提取到 `src/renderer/utils/languageMap.ts` | 消除重复，统一 Monaco 语言映射 |
| MIME 映射两处各维护 | 提取到 `src/shared/types/mime.ts` | 主进程+渲染进程共享单一来源 |
| `window.api` 类型转换 | `getApi()` helper + `AttaSeekAPI` 类型 | 类型安全，替换三重 unknown 转换 |
| 无 ErrorBoundary | `ErrorBoundary` 组件包裹每个 Pane | Pane 崩溃不拖垮整个 AP |

已删除文件：
- `ArtifactPane.tsx` — 被 ApContainer 完全替代，无引用

## 13. 迁移路径

1. **ApAtoms 替换 outputTabsAtom**：新 atoms 覆盖旧 Tab 模型，移除 `OutputTabType` 依赖
2. **ApContainer 替换 ArtifactPane**：Shell.tsx import 路径更新
3. **outputTabsAtom.ts 标记 deprecated**：保留一个版本周期后删除
4. **artifactRendererRegistry** 保留：FilePane 的非 Monaco 预览器（MD/图片/PDF）仍可复用
5. **现有 renderers/** 逐步被 Monaco 替代：代码/ diff 渲染器可在 FilePane + ReviewPane 稳定后废弃
