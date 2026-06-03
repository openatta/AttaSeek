# Color & Architecture Audit Report

**Date:** 2025-06-03

---

## Part 1: Color Inconsistency

### Root cause

Every component hardcodes Tailwind `neutral-*` classes on the **dark side** of the scale. The theme atom defaults to `'light'` and sets `data-theme="light"` on `<html>`, and `index.css` defines light-mode CSS variables at `:root` — but **no component reads those variables**. Tailwind's fixed palette classes (`neutral-700`, `neutral-800`, etc.) resolve to literal hex values that don't respond to `data-theme`.

| File | Line | Hardcoded dark class | Light-mode expected |
|------|------|---------------------|---------------------|
| Shell.tsx | 21 | `border-neutral-800` | `var(--border-primary)` = `#e5e5e5` |
| ActivityBar.tsx | 35 | `border-neutral-800` | light border |
| ActivityBar.tsx | 53-54 | `text-neutral-500`, `text-neutral-300`, `bg-neutral-800/60` | light text/bg |
| ActivityBar.tsx | 66 | `bg-neutral-700` | **separator: nearly black bar** |
| TitleBar.tsx | 19 | `text-neutral-600` | light text |
| Sidebar.tsx | 38,39 | `text-neutral-400`, `text-neutral-600` | light text |
| ChatsList.tsx | 10,23 | `bg-neutral-900`, `border-neutral-700`, `text-neutral-300` | light surface |
| SettingsSidebar.tsx | 16-17 | `bg-neutral-800`, `text-neutral-200`, `text-neutral-500` | light surface |
| SessionHeader.tsx | 6 | `bg-neutral-950/80`, `border-neutral-800`, `text-neutral-300` | light header |
| MessageFlow.tsx | 15 | `bg-neutral-800/60`, `text-neutral-500`, `text-neutral-600` | light surface |
| Composer.tsx | 35,58,61 | `bg-neutral-950`, `bg-neutral-900`, `border-neutral-800`, `text-neutral-200` | light surface |
| OutputArea.tsx | 51,55,63,67 | `bg-neutral-950`, `border-neutral-800`, `bg-neutral-900`, `text-neutral-200` | light surface |
| ContextRing.tsx | 17 | `stroke="#333"` (hardcoded hex) | light ring base |
| ModelSelector.tsx | 5 | `border-neutral-700`, `text-neutral-400` | light borders |
| BrowserPanel.tsx | 9,13 | `bg-neutral-900`, `border-neutral-800`, `text-neutral-300` | light surface |
| TerminalPanel.tsx | 3 | `bg-neutral-950` | light surface |
| ReviewPanel.tsx | 5,10 | `border-neutral-800`, `text-neutral-400`, `text-neutral-600` | light surface |
| FilesPanel.tsx | 5,10 | `border-neutral-800`, `text-neutral-600` | light surface |
| Settings.tsx | 32 | inherits dark text from missing token | light text |
| AppearanceSettings.tsx | 20,33-34 | `text-neutral-200`, `border-neutral-700`, `text-neutral-500` | light text |

**Every file** in `components/` has this issue — 20 files total, ~80+ dark-only class occurrences.

### What already works

- `index.css` defines complete `:root` (light) + `[data-theme="dark"]` token sets:
  - `--bg-primary`, `--bg-secondary`, `--bg-tertiary`
  - `--text-primary`, `--text-secondary`, `--text-tertiary`
  - `--border-primary`, `--border-secondary`
  - `--scrollbar-thumb`, `--scrollbar-thumb-hover`
- `ThemeProvider.tsx` correctly sets `data-theme` attribute on `<html>`
- `themeAtom.ts` has `dark | light | system` type

### Fix strategy

Two approaches:

**A. Use CSS variables everywhere (recommended).** Replace every `neutral-*` Tailwind class with a CSS variable via `style` or `className` that references `var(--token)`. This is the most correct approach — one source of truth for both themes.

**B. Use Tailwind dark: prefix.** Replace with `bg-white dark:bg-neutral-950` etc. Requires duplicating every color class pair.

Recommend **A** — use the token system already designed in `index.css`. Each component gets theme-aware without needing `dark:` prefixes everywhere.

### Specific "black divider" bug

- **ActivityBar.tsx:66**: `<div className="w-6 h-px bg-neutral-700 my-3" />` — this renders a `#404040` bar (nearly black) in light mode. Should use `var(--border-primary)` → `#e5e5e5`.
- **Shell.tsx:21**: Sidebar right border is `border-neutral-800` → `#262626` in both modes. Same root cause.

---

## Part 2: Architecture — Activity ↔ Workspace Pairing

### Current architecture

```
Shell.tsx (flat layout)
  ├── ActivityBar        ← picks activeActivity from atom
  ├── Sidebar Region     ← TitleBar + Sidebar(activity prop)
  ├── Main Content       ← Conversation OR Settings (hardcoded switch)
  └── OutputArea         ← always present, right panel
```

Problems:
1. **`Shell.tsx` owns all layout decisions** — it knows which Activity maps to which workspace. Adding a new Activity requires changing Shell.
2. **Sidebar gets `activity` as prop** and uses a switch/case to pick content. The mapping is scattered between Shell and Sidebar.
3. **OutputArea is always rendered** regardless of Activity. Settings page shows OutputArea alongside it (waste of space).
4. **Activity icons and workspace are not paired** — the ActivityBar just sets an atom, and Shell "guesses" what to render.
5. **No shared abstraction** for the 3-zone workspace pattern: Left Sidebar / Conversation / AI Output.

### Target architecture

```
ActivityBar
  └── click icon → activeActivityAtom → WorkspaceRouter

WorkspaceRouter  (replaces Shell's inline switch)
  └── picks the correct Workspace component for the current Activity

Each Activity has its own Workspace:
  ChatWorkspace      → [Sidebar: chat list]  [Conversation]                [OutputArea]
  ProjectsWorkspace  → [Sidebar: file tree]  [Conversation]                [OutputArea]
  SettingsWorkspace  → [Sidebar: settings nav] [SettingsContent]            (hidden)
  DashboardWorkspace → [Sidebar: summary]    [QuickAsk + RecentSessions]   [SystemStatus]
  SearchWorkspace    → [Sidebar: facets]     [SearchResults]               (hidden)
  AutomationWorkspace→ [Sidebar: task list]  [Conversation]                [OutputArea]
  PluginWorkspace    → [Sidebar: plugins]    [PluginDetail]                (hidden)
```

### New shared abstractions

**No rigid zone container.** Each workspace defines its own layout freely — there is no shared `WorkspaceShell` enforcing a fixed slot count. The workspace component receives the full main-canvas flex area and arranges children however it needs.

Some workspaces use 3 zones (e.g., Chat = sidebar + conversation + output), some use 2 (Settings = nav + content), some may use 1 (Dashboard = single scrollable view). The layout is the workspace's own decision.

**1. Shared slot primitives (optional, not mandatory).** A workspace that wants the common 3-zone pattern can compose from shared building blocks:

```tsx
// These are convenience wrappers, not a required container.
// A workspace may use 0, 1, 2, or all 3 — or none at all.
<WorkspaceLayout.Left>{...}</WorkspaceLayout.Left>
<WorkspaceLayout.Main>{...}</WorkspaceLayout.Main>
<WorkspaceLayout.Right>{...}</WorkspaceLayout.Right>
```

Each slot is just a flex child with sensible min/max width defaults. Workspaces can wrap them in any container structure — horizontal split, vertical stack, grid, or completely custom.

**2. Workspace** — a component that freely composes the canvas area for one Activity:

```tsx
// Chat — classic 3-zone: left panel + conversation + output
function ChatWorkspace() {
  return (
    <div className="flex flex-1 min-w-0">
      <WorkspaceLayout.Left><ChatsList /></WorkspaceLayout.Left>
      <WorkspaceLayout.Main><Conversation /></WorkspaceLayout.Main>
      <WorkspaceLayout.Right><OutputArea /></WorkspaceLayout.Right>
    </div>
  )
}

// Settings — 2-zone: nav sidebar + content (no output area)
function SettingsWorkspace() {
  return (
    <div className="flex flex-1 min-w-0">
      <SettingsSidebar />
      <Settings />
    </div>
  )
}

// Dashboard — single scrollable area, no zones
function DashboardWorkspace() {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <DashboardContent />
    </div>
  )
}
```

**3. WorkspaceRouter** — maps Activity → Workspace:
```tsx
const WORKSPACES: Record<Activity, ComponentType> = {
  home: DashboardWorkspace,
  chat: ChatWorkspace,
  chats: ChatWorkspace,       // same as chat for now
  projects: ProjectsWorkspace,
  search: SearchWorkspace,
  automation: AutomationWorkspace,
  plugin: PluginWorkspace,
  settings: SettingsWorkspace,
}
```

### OutputArea as a shared component

Contents driven by `outputTabsAtom` (already exists). Different activities can add different default tabs:
- Chat → terminal, files, browser, review
- Projects → terminal, files, git review
- Settings → (hidden entirely)
- Dashboard → system status, terminal

### What changes in Shell.tsx

**Before (20 lines of hardcoded layout):**
```tsx
<div className="flex h-screen w-screen overflow-hidden">
  <ActivityBar />
  <div className="..." style={{ width: 'var(--sidebar-width)' }}>
    <TitleBar />
    <Sidebar activity={activeActivity} />
  </div>
  <div className="flex flex-1 min-w-0">
    <div className="flex flex-col flex-1 min-w-0 min-h-0">
      {activeActivity === 'settings' ? <Settings /> : <Conversation />}
    </div>
    <OutputArea />
  </div>
</div>
```

**After (~10 lines, declarative):**
```tsx
<div className="flex h-screen w-screen overflow-hidden">
  <ActivityBar />
  <div className="..." style={{ width: 'var(--sidebar-width)' }}>
    <TitleBar />
    <Sidebar activity={activeActivity} />
  </div>
  <WorkspaceRouter activity={activeActivity} />
</div>
```

### Sidebar decomposition

The current `Sidebar.tsx` switch/case moves into individual workspace components — each workspace owns its sidebar content. The shared Sidebar wrapper (header + container chrome) stays, but content selection is the workspace's responsibility.

### Files to create

| New file | Purpose |
|----------|---------|
| `layouts/WorkspaceLayout.tsx` | Optional shared slot primitives (`Left`/`Main`/`Right` width-constrained wrappers) |
| `layouts/WorkspaceRouter.tsx` | Activity → Workspace dispatch |
| `workspaces/ChatWorkspace.tsx` | 3-zone: chat list + conversation + output area |
| `workspaces/ProjectsWorkspace.tsx` | 3-zone: file tree + conversation + output area |
| `workspaces/SettingsWorkspace.tsx` | 2-zone: settings nav + settings content |
| `workspaces/DashboardWorkspace.tsx` | Single scrollable view (no zone split) |
| `workspaces/SearchWorkspace.tsx` | 2-zone: facets + results |
| `workspaces/AutomationWorkspace.tsx` | 2-zone: task list + conversation |
| `workspaces/PluginWorkspace.tsx` | 2-zone: plugin list + detail |

### Files to modify

| File | Change |
|------|--------|
| `layouts/Shell.tsx` | Replace hardcoded layout with `<WorkspaceRouter activity={activeActivity} />` |
| `components/Sidebar/Sidebar.tsx` | Remove switch/case — each workspace calls sidebar components directly |
| `components/OutputArea/OutputArea.tsx` | No longer unconditionally rendered by Shell; each workspace decides whether to include it |

### Sidebar abstract panel types

Per the user's design spec, different activities use different sidebar content:

| Activity | Sidebar content |
|----------|----------------|
| Chat / Chats | Conversation list (grouped by project, filtered by status) |
| Projects | File tree + Git changed files + project tasks |
| Dashboard | Today's summary + quick actions + recent projects |
| Search | Search results + history + knowledge base |
| Automation | Task list (running/scheduled/failed) + new task |
| Plugin | Installed plugins + marketplace |
| Settings | Settings nav sections |
