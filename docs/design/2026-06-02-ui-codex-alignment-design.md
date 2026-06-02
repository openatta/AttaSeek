# UI 对齐 Codex Desktop 架构设计

> **日期：** 2026-06-02
> **基于需求：** `docs/requirements/2026-06-02-ui-codex-alignment.md`
> **技术栈：** Electron 33 + React 18 + TypeScript 5.7 + Jotai 2 + Tailwind 4 + Lucide React + Monaco + xterm.js

---

## 1. 设计概述

本次改造是纯**渲染进程**变更，主进程仅新增 2 个 IPC handler（theme get/set 预留），预加载新增对应 API 签名。核心设计决策：

| 决策 | 方案 | 理由 |
|------|------|------|
| 主题方案 | CSS 变量 + `data-theme` attribute + localStorage | 零运行时开销，CSS 切换即时生效，不触发 React re-render |
| 图标方案 | Lucide React | 社区标准，Tree-shakeable，React 组件直接使用不需 CDN |
| 状态管理 | Jotai atom 分层 | 面板级隔离：Setting atoms / Composer atoms / Output atoms 各自独立，不跨模块污染 |
| 消息流 | 虚拟滚动（后续），本次先渲染 | 初版 skelton 阶段不需要虚拟滚动，消息类型正确渲染即可 |
| Tab 系统 | 自定义轻量 Tab 系统 | 不需要 drag-and-drop 库的复杂度，CSS + 简单 JS 即可 |

---

## 2. Electron 三进程变更

### 2.1 主进程 (`src/main/`)

| 文件 | 变更 | 说明 |
|------|------|------|
| `src/main/index.ts` | 极小修改 | 监听 `nativeTheme.on('updated')`，向渲染进程发送 `theme:system-changed` 事件（system 模式专用） |
| `src/main/ipc/theme.ts` | 新建 | `theme:get` / `theme:set` handler。`theme:set` 仅校验值（dark/light/system），写入 app 级持久化 |

### 2.2 预加载 (`src/preload/`)

| 文件 | 变更 | 说明 |
|------|------|------|
| `src/preload/index.ts` | 修改 | 新增 `theme.get()` / `theme.set(v)` / `theme.onChange(cb)` API |
| `src/preload/index.d.ts` | 修改 | 新增 ThemeAPI 类型 |

### 2.3 渲染进程 (`src/renderer/`)

全部变更集中于此，详见下文组件树。

---

## 3. 组件树结构

```
App.tsx
└── JotaiProvider
    └── ThemeProvider (reads themeAtom → sets document.documentElement.dataset.theme)
        └── Shell.tsx
            ├── ActivityBar/ActivityBar.tsx          [R] +Chats, Lucide icons
            │
            ├── TitleBar/TitleBar.tsx                 [M] 40px, no border-bottom
            │
            ├── Sidebar/                              [R] 重构为 switch-based
            │   ├── Sidebar.tsx                       [R] activity → content switch
            │   ├── ChatsList.tsx                     [N] 对话列表
            │   ├── SettingsSidebar.tsx               [N] Settings 分类导航 (移入 Settings/)
            │   └── (各 Activity 对应内容，除 Settings + Chats 外保留 placeholder)
            │
            ├── Conversation/Conversation.tsx          [M] 改为 flex-col: Header + MsgFlow + Composer
            │   ├── SessionHeader.tsx                  [R] 三键 + 上下文环
            │   │   ├── ContextRing.tsx                [N] 上下文用量环形指示器
            │   │   └── ContextDetailPopover.tsx       [N] 悬停详情浮层
            │   │
            │   ├── MessageFlow.tsx                    [R] 消息类型分发
            │   │   ├── UserMessage.tsx                [N]
            │   │   ├── AgentMessage.tsx               [N] (Markdown render)
            │   │   ├── AgentPlanCard.tsx              [N] 可折叠计划卡片
            │   │   ├── ToolCallCard.tsx               [R]
            │   │   ├── InlineDiffCard.tsx             [N]
            │   │   └── PermissionInline.tsx           [R]
            │   │
            │   └── Composer.tsx                       [R] 完整输入区
            │       ├── ContextChips.tsx               [N]
            │       ├── ContextChip.tsx                [N]
            │       ├── MentionPopover.tsx             [N] @ 提及浮层
            │       ├── CommandPopover.tsx             [N] / 命令浮层
            │       └── ModelSelector.tsx              [N] 模型下拉 (内联到 Composer)
            │
            └── OutputArea/                            [N] AI 输出区 (替代原 Artifact)
                ├── OutputArea.tsx                     [N] 容器 + Tab 栏
                ├── BrowserPanel.tsx                   [N]
                ├── FilesPanel.tsx                     [N]
                ├── TerminalPanel.tsx                  [R] (迁移并扩展)
                └── ReviewPanel.tsx                    [N]

Settings/                                           [N] 独立 Settings 模块
    ├── Settings.tsx                                 [N] 主容器
    └── pages/                                       [N] 10 个设置页
        ├── GeneralSettings.tsx
        ├── ProfileSettings.tsx
        ├── AppearanceSettings.tsx
        ├── ConfigurationSettings.tsx
        ├── PersonalizationSettings.tsx
        ├── KeyboardSettings.tsx
        ├── NotificationsSettings.tsx
        ├── AgentSettings.tsx
        ├── GitSettings.tsx
        └── IntegrationsSettings.tsx
```

---

## 4. Shell 布局变更

当前布局 → 新布局：

```
BEFORE (当前):                    AFTER (新):
┌──┬──────┬──────────┬─────┐     ┌──┬──────┬─────────────────────────┐
│AB│Title │ SessionH │ Art  │     │AB│Title │ SessionHeader (40px+bdr)│
│  │ 40px │ 43px     │ifact │     │  │ 40px │─────────────────────────│
│  ├──────┼──────────┤     │     │  ├──────┤                         │
│  │ Side │ Conv     │     │     │  │ Side │ MessageFlow             │
│  │ bar  │          │     │     │  │ bar  │ (可滚动消息流)            │
│  │      │          │     │     │  │      │                         │
│  │      ├──────────┤     │     │  │      ├─────────────────────────│
│  │      │ Composer │     │     │  │      │ Composer (固定底部)       │
└──┴──────┴──────────┴─────┘     │  │      ├─────────────────────────│
                                  │  │      │ OutputArea TabBar+Panel  │
                                  │  │      │ (可拖拽显示/隐藏)         │
                                  └──┴──────┴─────────────────────────┘
```

关键变化：
- Artifact 移除，由 OutputArea 取代（位于 Conversation 下方）
- Shell.tsx 不再渲染 Artifact 组件
- Conversation 变为纯垂直 layout：fixed Header + scrollable MessageFlow + fixed Composer
- OutputArea 是可选显示/隐藏的面板，通过 Jotai atom `outputAreaVisibleAtom` 控制

---

## 5. 状态管理设计 (Jotai Atoms)

### 5.1 新 atoms

```typescript
// src/renderer/atoms/activityAtom.ts — 扩展
export type Activity =
  | 'home' | 'chat' | 'chats'       // ← 新增 chats
  | 'projects' | 'search'
  | 'automation' | 'plugin'
  | 'settings';
export const activeActivityAtom = atom<Activity>('chat');

// src/renderer/atoms/themeAtom.ts — 新建
export type Theme = 'dark' | 'light' | 'system';
export const themeAtom = atomWithStorage<Theme>('attaseek-theme', 'dark');
// atomWithStorage = atom + localStorage 自动同步

// src/renderer/atoms/settingsAtom.ts — 新建
export type SettingsSection =
  | 'general' | 'profile' | 'appearance' | 'configuration'
  | 'personalization' | 'keyboard' | 'notifications'
  | 'agent' | 'git' | 'integrations';
export const settingsSectionAtom = atom<SettingsSection>('general');

// src/renderer/atoms/composerAtom.ts — 新建
export interface Chip { id: string; type: 'file'|'folder'|'agent'|'plugin'; label: string; }
export const composerValueAtom = atom('');
export const composerChipsAtom = atom<Chip[]>([]);
export const isAgentRunningAtom = atom(false);

// src/renderer/atoms/outputTabsAtom.ts — 新建
export type OutputTabType = 'browser' | 'files' | 'terminal' | 'review';
export interface OutputTab { id: string; type: OutputTabType; label: string; }
export const outputTabsAtom = atom<OutputTab[]>([]);
export const activeOutputTabAtom = atom<string | null>(null);
export const outputAreaVisibleAtom = atom(true);

// src/renderer/atoms/contextAtom.ts — 新建
export interface ContextUsage { used: number; total: number; }
export const contextUsageAtom = atom<ContextUsage>({ used: 0, total: 200000 });
```

### 5.2 Atom 作用范围

| Atom | 面板 | 持久化 | 理由 |
|------|------|--------|------|
| `themeAtom` | 全局 | localStorage | 跨会话保持 |
| `activeActivityAtom` | 全局 | 否 | 每次启动回默认 |
| `settingsSectionAtom` | Settings | 否 | Settings 关闭即重置 |
| `composerValueAtom` | Conversation | 否 | 临时输入状态 |
| `composerChipsAtom` | Conversation | 否 | 临时输入状态 |
| `isAgentRunningAtom` | Conversation | 否 | Agent 运行时状态 |
| `outputTabsAtom` | OutputArea | localStorage | Tab 布局保持 |
| `activeOutputTabAtom` | OutputArea | 否 | 当前选中 Tab |
| `outputAreaVisibleAtom` | 全局 | 否 | 显示/隐藏 |
| `contextUsageAtom` | Conversation | 否 | Agent 实时更新 |

---

## 6. 主题系统设计

### 6.1 架构

```
ThemeProvider (React)
  └── reads themeAtom (dark/light/system)
  └── computes resolvedTheme = (system ? matchMedia : theme)
  └── sets document.documentElement.dataset.theme = resolvedTheme
  └── listens to window.matchMedia('(prefers-color-scheme: dark)') changes (system mode)
  └── re-renders on atom change

index.css
  └── :root { ... } ← dark (default)
  └── [data-theme="light"] { ... } ← light overrides
```

### 6.2 CSS 变量方案

```css
:root {
  /* Dark (default) */
  --bg-primary: #0a0a0a;
  --bg-secondary: #171717;
  --text-primary: #f5f5f5;
  --text-secondary: #a3a3a3;
  --text-tertiary: #737373;
  --border-primary: #262626;
  --border-secondary: #1f1f1f;
  --brand: #3b82f6;
  --brand-hover: #2563eb;
}

[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #171717;
  --text-secondary: #737373;
  --text-tertiary: #a3a3a3;
  --border-primary: #e5e5e5;
  --border-secondary: #f0f0f0;
  --brand: #2563eb;
  --brand-hover: #1d4ed8;
}
```

### 6.3 Tailwind 4 集成

Tailwind 4 原生支持 CSS 变量。配置方式：

```css
@import "tailwindcss";

@theme {
  --color-bg-primary: var(--bg-primary);
  --color-bg-secondary: var(--bg-secondary);
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-border-primary: var(--border-primary);
  /* ... etc */
}
```

然后类名使用：`bg-bg-primary` / `text-text-primary` / `border-border-primary`。

### 6.4 滚动条主题

```css
::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
}
:root { --scrollbar-thumb: rgba(255,255,255,0.12); }
[data-theme="light"] { --scrollbar-thumb: rgba(0,0,0,0.12); }
```

---

## 7. IPC Contract 设计

### 7.1 新增 IPC Channels

```typescript
// theme:get
// Direction: renderer → main
// Request: (none)
// Response: { theme: 'dark' | 'light' | 'system' }

// theme:set
// Direction: renderer → main
// Request: { theme: 'dark' | 'light' | 'system' }
// Response: { success: true }
// Validation: main process rejects non-[dark|light|system] values

// theme:system-changed (push)
// Direction: main → renderer
// Data: { theme: 'dark' | 'light' }
// Trigger: nativeTheme.on('updated') when user is in 'system' mode
```

### 7.2 Preload API 签名

```typescript
// src/preload/index.ts 新增
const theme = {
  get: (): Promise<{ theme: string }> => ipcRenderer.invoke('theme:get'),
  set: (theme: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('theme:set', { theme }),
  onSystemChange: (cb: (theme: 'dark' | 'light') => void) => {
    const listener = (_e: any, data: { theme: string }) => cb(data.theme)
    ipcRenderer.on('theme:system-changed', listener)
    return () => ipcRenderer.removeListener('theme:system-changed', listener)
  }
}

// window.api 扩展
const api = {
  ...existing,
  theme
}
```

---

## 8. 关键组件 Contract

### 8.1 ActivityBar → Sidebar

```
ActivityBar.onClick(activity: Activity)
  → activeActivityAtom.set(activity)
  → Sidebar reads activeActivityAtom → renders content
```

### 8.2 SessionHeader → OutputArea

```
SessionHeader 三键:
  [Monitor]     → outputAreaVisibleAtom.toggle()
                  + 选中 Browser/Files/Terminal/Review Tab
  [Info]        → contextDetailVisibleAtom.toggle()
  [PanelBottom]  → outputAreaVisibleAtom.toggle()
```

### 8.3 Composer → MessageFlow

```
Composer.onSend(value, chips)
  → 构造 Message 对象 (UserMessage)
  → messageListAtom.append(message)
  → MessageFlow 自动滚动到底部
```

### 8.4 OutputArea Tab 管理

```typescript
// OutputArea atom operations
function openTab(type: OutputTabType, label: string) {
  const tab: OutputTab = { id: nanoid(), type, label };
  outputTabsAtom.set(prev => [...prev, tab]);
  activeOutputTabAtom.set(tab.id);
}

function closeTab(id: string) {
  outputTabsAtom.set(prev => prev.filter(t => t.id !== id));
  // If closed tab was active, switch to neighbor
}

function reorderTabs(from: number, to: number) {
  // Move tab in array
}
```

---

## 9. 文件变更清单

### 新建文件 (~35)

```
src/main/ipc/theme.ts
src/renderer/atoms/themeAtom.ts
src/renderer/atoms/settingsAtom.ts
src/renderer/atoms/composerAtom.ts
src/renderer/atoms/outputTabsAtom.ts
src/renderer/atoms/contextAtom.ts
src/renderer/components/ThemeProvider.tsx
src/renderer/components/Conversation/ContextRing.tsx
src/renderer/components/Conversation/ContextDetailPopover.tsx
src/renderer/components/Conversation/UserMessage.tsx
src/renderer/components/Conversation/AgentMessage.tsx
src/renderer/components/Conversation/AgentPlanCard.tsx
src/renderer/components/Conversation/InlineDiffCard.tsx
src/renderer/components/Conversation/ContextChip.tsx
src/renderer/components/Conversation/ContextChips.tsx
src/renderer/components/Conversation/MentionPopover.tsx
src/renderer/components/Conversation/CommandPopover.tsx
src/renderer/components/Conversation/ModelSelector.tsx
src/renderer/components/OutputArea/OutputArea.tsx
src/renderer/components/OutputArea/BrowserPanel.tsx
src/renderer/components/OutputArea/FilesPanel.tsx
src/renderer/components/OutputArea/TerminalPanel.tsx
src/renderer/components/OutputArea/ReviewPanel.tsx
src/renderer/components/Settings/Settings.tsx
src/renderer/components/Settings/SettingsSidebar.tsx
src/renderer/components/Settings/pages/GeneralSettings.tsx
src/renderer/components/Settings/pages/ProfileSettings.tsx
src/renderer/components/Settings/pages/AppearanceSettings.tsx
src/renderer/components/Settings/pages/ConfigurationSettings.tsx
src/renderer/components/Settings/pages/PersonalizationSettings.tsx
src/renderer/components/Settings/pages/KeyboardSettings.tsx
src/renderer/components/Settings/pages/NotificationsSettings.tsx
src/renderer/components/Settings/pages/AgentSettings.tsx
src/renderer/components/Settings/pages/GitSettings.tsx
src/renderer/components/Settings/pages/IntegrationsSettings.tsx
src/renderer/components/Sidebar/ChatsList.tsx
```

### 修改文件 (~10)

```
src/main/index.ts                [M] nativeTheme listener
src/main/ipc/index.ts            [M] 注册 theme handlers
src/preload/index.ts             [M] theme API
src/preload/index.d.ts           [M] ThemeAPI type
src/renderer/App.tsx             [M] ThemeProvider wrapper
src/renderer/layouts/Shell.tsx   [M] 新布局 + OutputArea
src/renderer/atoms/activityAtom.ts [M] 增加 chats Activity
src/renderer/assets/index.css    [M] 主题变量 + 消息样式
src/renderer/components/ActivityBar/ActivityBar.tsx [R]
src/renderer/components/Conversation/Conversation.tsx [M]
src/renderer/components/Conversation/SessionHeader.tsx [R]
src/renderer/components/Conversation/MessageFlow.tsx [R]
src/renderer/components/Conversation/Composer.tsx [R]
src/renderer/components/Conversation/ToolCallCard.tsx [R]
src/renderer/components/Conversation/PermissionInline.tsx [R]
src/renderer/components/TitleBar/TitleBar.tsx [M]
src/renderer/components/Sidebar/Sidebar.tsx [R]
```

### 删除文件

```
src/renderer/components/Artifact/Artifact.tsx    [D] → 被 OutputArea 取代
src/renderer/components/Terminal/Terminal.tsx    [D] → 迁移到 OutputArea/TerminalPanel.tsx
src/renderer/components/Diff/Diff.tsx            [D] → 迁移到 OutputArea/ReviewPanel.tsx
```

---

## 10. 构建依赖变更

```bash
npm install lucide-react
# 不需要其他新依赖。Monaco、xterm、Jotai、Tailwind 4 均已安装。
```

---

## 11. 实现顺序（按依赖关系）

```
Phase 1: 基础设施
  ├── 安装 lucide-react
  ├── 新建 atoms (themeAtom, settingsAtom, composerAtom, outputTabsAtom, contextAtom)
  ├── 扩展 activityAtom (增加 chats)
  ├── 修改 index.css (主题 CSS 变量)
  └── 新建 ThemeProvider

Phase 2: ActivityBar + TitleBar + Sidebar 重构
  ├── ActivityBar (Lucide 图标 + Chats)
  ├── TitleBar (40px 无线条)
  └── Sidebar (ChatsList 骨架 + Settings 导航)

Phase 3: Conversation 重构
  ├── SessionHeader (三键 + ContextRing)
  ├── MessageFlow + 6 种消息组件
  └── Composer (chips + mentions + commands + toolbar)

Phase 4: Settings 面板
  ├── Settings 容器 + SettingsSidebar
  └── 5 个核心 Settings pages (其他 5 个简化占位)

Phase 5: OutputArea 四面板
  ├── OutputArea 容器 + Tab 系统
  ├── BrowserPanel
  ├── FilesPanel
  ├── TerminalPanel (迁移+扩展)
  └── ReviewPanel

Phase 6: Shell 集成
  ├── 更新 Shell.tsx 布局
  └── 端到端验证
```

---

## 12. 技术决策

| 决策 | 选择 | 理由 | 替代方案 |
|------|------|------|---------|
| 主题方案 | CSS 变量 + data-theme | 零运行时切换，Tailwind 4 原生支持 | React context + CSS-in-JS（重） |
| 图标 | Lucide React | Tree-shakeable，社区标准 | Phosphor（同样优秀，Lucide 更主流） |
| @mentions 浮层 | 条件渲染 Portal | 不撑高 Composer | dropdown position absolute（z-index 问题） |
| Tab 拖拽 | CSS order + onDrag | 简单，无需依赖 | react-beautiful-dnd（对 Tab 场景过重） |
| Markdown 渲染 | 轻量 marked + 自定义组件 | 可控，体积小 | react-markdown（更大但也更全） |
| 上下文环形指示器 | SVG circle + stroke-dashoffset | 精确控制，无额外依赖 | Canvas（不必要） |
| Settings 表单 | 纯受控组件 | 无需 form 库 | react-hook-form（对初始骨架过重） |
