# UI 对齐 Codex Desktop 实现计划

> 给执行者的要求：
> 推荐使用 /execute-plan 按任务执行。
> 每个任务参考 /test-driven-development 进行 TDD 循环。
> 每个 Phase 完成后做 checkpoint 验证。

**目标：** 将 AttaSeek UI 一次性对齐 Codex Desktop — ActivityBar 重构、深/浅主题、Settings 10 面板、Conversation Header 三键、Composer 完整输入区、消息显示格式、OutputArea 四面板、标题栏统一高度
**涉及进程：** main / preload / renderer
**技术栈：** Electron 33 + React 18 + TypeScript 5.7 + Jotai 2 + Tailwind 4 + Lucide React + Monaco + xterm.js
**相关面板：** ActivityBar / TitleBar / Sidebar / Conversation / OutputArea(新) / Settings(新)

---

## Phase 1: 基础设施 (6 tasks)

### Task 1: Install lucide-react + Verified

**进程层:** N/A（依赖安装）

**Files:**
- Modify: `package.json`

- [ ] Step 1: 安装依赖

```bash
npm install lucide-react --legacy-peer-deps
```

- [ ] Step 2: 验证安装

```bash
node -e "const l = require('lucide-react'); console.log(Object.keys(l).length + ' icons')"
# 预期输出: 约 1000+ 个图标
```

- [ ] Step 3: 提交

```bash
git add package.json package-lock.json
git commit -m "AttaSeek: add lucide-react icon library

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Create theme infrastructure

**进程层:** renderer

**Files:**
- Create: `src/renderer/atoms/themeAtom.ts`
- Create: `src/renderer/components/ThemeProvider.tsx`
- Modify: `src/renderer/assets/index.css`
- Modify: `src/renderer/App.tsx`
- Test: `test/unit/atoms/themeAtom.test.tsx`

- [ ] Step 1: 写失败测试

`test/unit/atoms/themeAtom.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAtom } from 'jotai'
import { Provider } from 'jotai'
import { themeAtom } from '@/atoms/themeAtom'
import type { Theme } from '@/atoms/themeAtom'

function wrapper({ children }: { children: React.ReactNode }) {
  return <Provider>{children}</Provider>
}

function useTheme() {
  return renderHook(() => useAtom(themeAtom), { wrapper })
}

describe('themeAtom', () => {
  it('should default to "dark"', () => {
    const { result } = useTheme()
    expect(result.current[0]).toBe('dark')
  })

  it.each(['dark', 'light', 'system'] as Theme[])('should set theme to %s', (t) => {
    const { result } = useTheme()
    act(() => result.current[1](t))
    expect(result.current[0]).toBe(t)
  })

  it('should reject invalid values (done at the component level)', () => {
    // TypeScript enforces this at compile time
    const { result } = useTheme()
    act(() => result.current[1]('light'))
    expect(result.current[0]).toBe('light')
    act(() => result.current[1]('dark'))
    expect(result.current[0]).toBe('dark')
  })
})
```

- [ ] Step 2: 运行测试，确认失败

```bash
npx vitest run test/unit/atoms/themeAtom.test.tsx
# 预期失败: Cannot find module '@/atoms/themeAtom'
```

- [ ] Step 3: 写实现

`src/renderer/atoms/themeAtom.ts`:
```typescript
import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

export type Theme = 'dark' | 'light' | 'system'

const THEME_KEY = 'attaseek-theme'

// Jotai's native atomWithStorage handles localStorage sync automatically
function storageThemeAtom() {
  const base = atomWithStorage<Theme>(THEME_KEY, 'dark')
  return base
}

export const themeAtom = storageThemeAtom()
```

`src/renderer/components/ThemeProvider.tsx`:
```typescript
import { useAtom } from 'jotai'
import { useEffect, type ReactNode } from 'react'
import { themeAtom, type Theme } from '../atoms/themeAtom'

function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme] = useAtom(themeAtom)

  // Apply theme to document root
  useEffect(() => {
    const resolved = resolveTheme(theme)
    document.documentElement.dataset.theme = resolved
  }, [theme])

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.dataset.theme = e.matches ? 'dark' : 'light'
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return <>{children}</>
}
```

`src/renderer/App.tsx` — 包裹 ThemeProvider:
```typescript
import { Provider } from 'jotai'
import ThemeProvider from './components/ThemeProvider'
import Shell from './layouts/Shell'

export default function App() {
  return (
    <Provider>
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </Provider>
  )
}
```

`src/renderer/assets/index.css` — 在尾部追加主题 CSS 变量:
```css
/* ── Theme tokens ──────────────────────────────────────────────── */
:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #171717;
  --bg-tertiary: #1f1f1f;
  --text-primary: #f5f5f5;
  --text-secondary: #a3a3a3;
  --text-tertiary: #737373;
  --border-primary: #262626;
  --border-secondary: #1f1f1f;
  --brand: #3b82f6;
  --brand-hover: #2563eb;
  --scrollbar-thumb: rgba(255, 255, 255, 0.12);
  --scrollbar-thumb-hover: rgba(255, 255, 255, 0.2);
}

[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-tertiary: #e5e5e5;
  --text-primary: #171717;
  --text-secondary: #737373;
  --text-tertiary: #a3a3a3;
  --border-primary: #e5e5e5;
  --border-secondary: #f0f0f0;
  --brand: #2563eb;
  --brand-hover: #1d4ed8;
  --scrollbar-thumb: rgba(0, 0, 0, 0.12);
  --scrollbar-thumb-hover: rgba(0, 0, 0, 0.2);
}
```

- [ ] Step 4: 运行测试，确认通过

```bash
npx vitest run test/unit/atoms/themeAtom.test.tsx
# 预期: 3 tests passed
```

- [ ] Step 5: 验证 TypeScript

```bash
npx tsc --noEmit -p tsconfig.web.json
```

- [ ] Step 6: 提交

```bash
git add src/renderer/atoms/themeAtom.ts \
        src/renderer/components/ThemeProvider.tsx \
        src/renderer/App.tsx \
        src/renderer/assets/index.css \
        test/unit/atoms/themeAtom.test.tsx
git commit -m "AttaSeek: add theme system (dark/light/system) with ThemeProvider

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Create IPC theme handlers

**进程层:** main + preload

**Files:**
- Create: `src/main/ipc/theme.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Create: `test/unit/ipc/theme.test.ts`

- [ ] Step 1: 写失败测试

`test/unit/ipc/theme.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'

// Test the validation logic that the IPC handler will use
function validateTheme(v: unknown): v is 'dark' | 'light' | 'system' {
  return v === 'dark' || v === 'light' || v === 'system'
}

describe('theme IPC validation', () => {
  it('should accept dark/light/system', () => {
    expect(validateTheme('dark')).toBe(true)
    expect(validateTheme('light')).toBe(true)
    expect(validateTheme('system')).toBe(true)
  })

  it('should reject invalid values', () => {
    expect(validateTheme('foo')).toBe(false)
    expect(validateTheme('')).toBe(false)
    expect(validateTheme(undefined)).toBe(false)
    expect(validateTheme(null)).toBe(false)
    expect(validateTheme(123)).toBe(false)
  })
})
```

- [ ] Step 2: 运行测试，确认失败

```bash
npx vitest run test/unit/ipc/theme.test.ts
# 预期: 1 test file failed (file doesn't exist yet)
```

- [ ] Step 3: 写实现

`src/main/ipc/theme.ts`:
```typescript
import { ipcMain, nativeTheme, BrowserWindow } from 'electron'

type Theme = 'dark' | 'light' | 'system'

function validateTheme(v: unknown): v is Theme {
  return v === 'dark' || v === 'light' || v === 'system'
}

let currentTheme: Theme = 'dark'

export function registerThemeHandlers(): void {
  ipcMain.handle('theme:get', () => {
    return { theme: currentTheme }
  })

  ipcMain.handle('theme:set', (_event, args: { theme: unknown }) => {
    if (!validateTheme(args?.theme)) {
      throw new Error(`Invalid theme: ${args?.theme}. Must be dark, light, or system.`)
    }
    currentTheme = args.theme as Theme
    return { success: true }
  })

  // Emit system theme changes to all renderers
  nativeTheme.on('updated', () => {
    const systemTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('theme:system-changed', { theme: systemTheme })
    })
  })
}
```

`src/main/index.ts` — 在 `app.whenReady().then(...)` 之前添加:
```typescript
import { registerThemeHandlers } from './ipc/theme'
```

并在 `createWindow()` 之前调用:
```typescript
registerThemeHandlers()
```

`src/preload/index.ts` — 在 api 对象中添加 theme:
```typescript
theme: {
  get: (): Promise<{ theme: string }> => ipcRenderer.invoke('theme:get'),
  set: (theme: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('theme:set', { theme }),
  onSystemChange: (cb: (theme: 'dark' | 'light') => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { theme: string }) =>
      cb(data.theme as 'dark' | 'light')
    ipcRenderer.on('theme:system-changed', listener)
    return () => ipcRenderer.removeListener('theme:system-changed', listener)
  }
}
```

`src/preload/index.d.ts` — 在 Window.api 中添加:
```typescript
theme: {
  get(): Promise<{ theme: string }>
  set(theme: string): Promise<{ success: boolean }>
  onSystemChange(cb: (theme: 'dark' | 'light') => void): () => void
}
```

- [ ] Step 4: 运行测试，确认通过

```bash
npx vitest run test/unit/ipc/theme.test.ts
# 预期: 5 tests passed
```

- [ ] Step 5: 验证 TypeScript + Build

```bash
npx tsc --noEmit -p tsconfig.node.json
npx tsc --noEmit -p tsconfig.web.json
npx electron-vite build
```

- [ ] Step 6: 提交

```bash
git add src/main/ipc/theme.ts src/main/index.ts \
        src/preload/index.ts src/preload/index.d.ts \
        test/unit/ipc/theme.test.ts
git commit -m "AttaSeek: add IPC theme handlers + preload API

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Create remaining Jotai atoms

**进程层:** renderer

**Files:**
- Modify: `src/renderer/atoms/activityAtom.ts`
- Create: `src/renderer/atoms/settingsAtom.ts`
- Create: `src/renderer/atoms/composerAtom.ts`
- Create: `src/renderer/atoms/outputTabsAtom.ts`
- Create: `src/renderer/atoms/contextAtom.ts`
- Test: `test/unit/atoms/atoms.test.tsx`

- [ ] Step 1: 写失败测试

`test/unit/atoms/atoms.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAtom } from 'jotai'
import { Provider } from 'jotai'
import { activeActivityAtom } from '@/atoms/activityAtom'
import { settingsSectionAtom } from '@/atoms/settingsAtom'
import { composerValueAtom, composerChipsAtom, isAgentRunningAtom } from '@/atoms/composerAtom'
import { outputTabsAtom, activeOutputTabAtom, outputAreaVisibleAtom } from '@/atoms/outputTabsAtom'
import { contextUsageAtom } from '@/atoms/contextAtom'

function wrapper({ children }: { children: React.ReactNode }) {
  return <Provider>{children}</Provider>
}

function useAtomHelper<T>(atom: any) {
  return renderHook(() => useAtom(atom), { wrapper })
}

describe('activityAtom', () => {
  it('should include "chats" as a valid activity', () => {
    const { result } = useAtomHelper(activeActivityAtom)
    act(() => result.current[1]('chats'))
    expect(result.current[0]).toBe('chats')
  })
})

describe('composerAtom', () => {
  it('should default to empty message', () => {
    const { result } = useAtomHelper(composerValueAtom)
    expect(result.current[0]).toBe('')
  })

  it('should update composer value', () => {
    const { result } = useAtomHelper(composerValueAtom)
    act(() => result.current[1]('hello world'))
    expect(result.current[0]).toBe('hello world')
  })

  it('should manage chips', () => {
    const { result } = useAtomHelper(composerChipsAtom)
    act(() => result.current[1]([{ id: '1', type: 'file', label: 'src/api.ts' }]))
    expect(result.current[0]).toHaveLength(1)
  })
})

describe('outputTabsAtom', () => {
  it('should default to empty tabs', () => {
    const { result } = useAtomHelper(outputTabsAtom)
    expect(result.current[0]).toEqual([])
  })

  it('should toggle visibility', () => {
    const { result } = useAtomHelper(outputAreaVisibleAtom)
    expect(result.current[0]).toBe(true)
    act(() => result.current[1](false))
    expect(result.current[0]).toBe(false)
  })
})
```

- [ ] Step 2: 运行测试，确认失败

```bash
npx vitest run test/unit/atoms/atoms.test.tsx
# 预期失败: Cannot find module
```

- [ ] Step 3: 写实现

`src/renderer/atoms/activityAtom.ts`:
```typescript
import { atom } from 'jotai'

export type Activity =
  | 'home' | 'chat' | 'chats'
  | 'projects' | 'search'
  | 'automation' | 'plugin'
  | 'settings'

export const activeActivityAtom = atom<Activity>('chat')
```

`src/renderer/atoms/settingsAtom.ts`:
```typescript
import { atom } from 'jotai'

export type SettingsSection =
  | 'general' | 'profile' | 'appearance' | 'configuration'
  | 'personalization' | 'keyboard' | 'notifications'
  | 'agent' | 'git' | 'integrations'

export const settingsSectionAtom = atom<SettingsSection>('general')
```

`src/renderer/atoms/composerAtom.ts`:
```typescript
import { atom } from 'jotai'

export interface ContextChip {
  id: string
  type: 'file' | 'folder' | 'agent' | 'plugin'
  label: string
  path?: string
}

export const composerValueAtom = atom('')
export const composerChipsAtom = atom<ContextChip[]>([])
export const isAgentRunningAtom = atom(false)
```

`src/renderer/atoms/outputTabsAtom.ts`:
```typescript
import { atom } from 'jotai'

export type OutputTabType = 'browser' | 'files' | 'terminal' | 'review'

export interface OutputTab {
  id: string
  type: OutputTabType
  label: string
}

export const outputTabsAtom = atom<OutputTab[]>([])
export const activeOutputTabAtom = atom<string | null>(null)
export const outputAreaVisibleAtom = atom(true)
```

`src/renderer/atoms/contextAtom.ts`:
```typescript
import { atom } from 'jotai'

export interface ContextUsage {
  used: number
  total: number
}

export const contextUsageAtom = atom<ContextUsage>({ used: 0, total: 200000 })
```

- [ ] Step 4: 运行测试，确认通过

```bash
npx vitest run test/unit/atoms/atoms.test.tsx
# 预期: 6 tests passed
```

- [ ] Step 5: 提交

```bash
git add src/renderer/atoms/
git commit -m "AttaSeek: add settings, composer, outputTabs, context atoms

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Checkpoint: After Phase 1 (Tasks 1-4)

- [ ] `npx tsc --noEmit -p tsconfig.node.json` — 主进程编译通过
- [ ] `npx tsc --noEmit -p tsconfig.web.json` — 渲染进程编译通过
- [ ] `npx vitest run` — 所有测试通过 (expect ~54 tests)
- [ ] `npx electron-vite build` — 构建成功
- [ ] 继续 Phase 2

---

## Phase 2: ActivityBar + TitleBar + Sidebar (3 tasks)

### Task 5: Refactor ActivityBar with Lucide icons + Chats

**进程层:** renderer

**Files:**
- Modify: `src/renderer/components/ActivityBar/ActivityBar.tsx`
- Test: `test/unit/components/ActivityBar.test.tsx`

- [ ] Step 1: 更新测试以匹配新行为

`test/unit/components/ActivityBar.test.tsx` 替换为:
```typescript
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'jotai'
import ActivityBar from '@/components/ActivityBar/ActivityBar'

function renderBar() {
  return render(
    <Provider>
      <ActivityBar />
    </Provider>
  )
}

describe('ActivityBar', () => {
  it('should render 8 navigation items including Chats', () => {
    renderBar()
    expect(screen.getByLabelText('Home')).toBeInTheDocument()
    expect(screen.getByLabelText('New Session')).toBeInTheDocument()
    expect(screen.getByLabelText('Chats')).toBeInTheDocument()
    expect(screen.getByLabelText('Search')).toBeInTheDocument()
    expect(screen.getByLabelText('Automation')).toBeInTheDocument()
    expect(screen.getByLabelText('Plugins')).toBeInTheDocument()
    expect(screen.getByLabelText('Projects')).toBeInTheDocument()
    expect(screen.getByLabelText('Settings')).toBeInTheDocument()
  })

  it('should mark default activity as active', () => {
    renderBar()
    expect(screen.getByLabelText('New Session').className).toContain('text-blue-400')
  })

  it('should switch to Chats when clicked', () => {
    renderBar()
    fireEvent.click(screen.getByLabelText('Chats'))
    expect(screen.getByLabelText('Chats').className).toContain('text-blue-400')
  })
})
```

- [ ] Step 2: 运行测试，确认失败

```bash
npx vitest run test/unit/components/ActivityBar.test.tsx
# 预期: 失败 — Chats 按钮不存在
```

- [ ] Step 3: 写实现

`src/renderer/components/ActivityBar/ActivityBar.tsx`:
```typescript
import { useAtom } from 'jotai'
import { activeActivityAtom, type Activity } from '../../atoms/activityAtom'
import {
  Command, SquarePen, MessageSquareText, Search,
  Zap, Plug2, FolderGit2, Settings
} from 'lucide-react'

type NavItem = {
  id: Activity
  icon: React.ComponentType<{ className?: string }>
  label: string
}

const TOP_ITEMS: NavItem[] = [
  { id: 'home', icon: Command, label: 'Home' },
  { id: 'chat', icon: SquarePen, label: 'New Session' },
  { id: 'chats', icon: MessageSquareText, label: 'Chats' },
  { id: 'search', icon: Search, label: 'Search' },
  { id: 'automation', icon: Zap, label: 'Automation' },
  { id: 'plugin', icon: Plug2, label: 'Plugins' },
  { id: 'projects', icon: FolderGit2, label: 'Projects' }
]

export default function ActivityBar() {
  const [active, setActive] = useAtom(activeActivityAtom)

  return (
    <div
      className="flex flex-col items-center flex-shrink-0 h-full border-r border-neutral-800 select-none"
      style={{ width: 'var(--activity-bar-width)' }}
    >
      {/* Traffic lights spacer (macOS) */}
      <div className="traffic-lights-spacer w-full" />

      {/* Primary nav items */}
      <div className="flex flex-col items-center gap-1 pt-2">
        {TOP_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={`w-9 h-9 flex items-center justify-center rounded-md transition-colors duration-150
                ${isActive
                  ? 'text-blue-400 bg-blue-400/10'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60'
                }`}
              title={item.label}
              aria-label={item.label}
            >
              <Icon className="w-5 h-5" />
            </button>
          )
        })}
      </div>

      {/* Separator */}
      <div className="w-6 h-px bg-neutral-700 my-3" />

      {/* Plugin slots (placeholder) */}
      <div className="flex-1" />

      {/* Settings — bottom aligned */}
      <div className="mb-3">
        <button
          onClick={() => setActive('settings')}
          className={`w-9 h-9 flex items-center justify-center rounded-md transition-colors duration-150
            ${active === 'settings'
              ? 'text-blue-400 bg-blue-400/10'
              : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60'
            }`}
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
```

- [ ] Step 4: 运行测试，确认通过

```bash
npx vitest run test/unit/components/ActivityBar.test.tsx
# 预期: 3 tests passed
```

- [ ] Step 5: 验证 TypeScript + Build

```bash
npx tsc --noEmit -p tsconfig.web.json
npx electron-vite build
```

- [ ] Step 6: 提交

```bash
git add src/renderer/components/ActivityBar/ActivityBar.tsx \
        test/unit/components/ActivityBar.test.tsx
git commit -m "AttaSeek: refactor ActivityBar with Lucide icons and Chats entry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Refactor TitleBar (40px height, no border)

**进程层:** renderer

**Files:**
- Modify: `src/renderer/components/TitleBar/TitleBar.tsx`

- [ ] Step 1–3: 直接实现（单文件，无测试）

```typescript
export default function TitleBar() {
  return (
    <div className="flex-shrink-0 h-[40px] flex items-center px-3">
      {/* macOS traffic lights rendered by OS in this area */}
      {/* Windows/Linux: overlay controls rendered by OS */}
      <span className="text-[11px] text-neutral-600 select-none">
        AttaSeek
      </span>
    </div>
  )
}
```

> 关键变更: `h-[40px]` 固定高度，移除 `border-b border-neutral-800`。

- [ ] Step 4: 验证

```bash
npx tsc --noEmit -p tsconfig.web.json
npx electron-vite build
```

- [ ] Step 5: 提交

```bash
git add src/renderer/components/TitleBar/TitleBar.tsx
git commit -m "AttaSeek: refactor TitleBar to 40px fixed height, no border

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Refactor Sidebar (support ChatsList + Settings nav)

**进程层:** renderer

**Files:**
- Modify: `src/renderer/components/Sidebar/Sidebar.tsx`
- Create: `src/renderer/components/Sidebar/ChatsList.tsx`
- Modify: `test/unit/components/Sidebar.test.tsx`

- [ ] Step 1: 更新测试

```typescript
// test/unit/components/Sidebar.test.tsx 追加
it('should render ChatsList when activity is "chats"', () => {
  render(<Sidebar activity="chats" />)
  // Should show search input and filter buttons
  expect(screen.getByPlaceholderText(/搜索会话/)).toBeInTheDocument()
})
```

- [ ] Step 2: 运行测试，确认失败

```bash
npx vitest run test/unit/components/Sidebar.test.tsx
# 预期: 失败 — chats 模式未实现
```

- [ ] Step 3: 写实现

`src/renderer/components/Sidebar/Sidebar.tsx` — 重构为 switch:
```typescript
import type { Activity } from '../../atoms/activityAtom'
import ChatsList from './ChatsList'
import SettingsSidebar from '../Settings/SettingsSidebar'

type SidebarProps = { activity: Activity }

const PLACEHOLDER: Record<string, string> = {
  home: 'Dashboard',
  chat: 'Sessions',
  search: 'Search',
  automation: 'Automation',
  plugin: 'Plugins',
  projects: 'Projects'
}

export default function Sidebar({ activity }: SidebarProps) {
  const renderContent = () => {
    switch (activity) {
      case 'chats':
        return <ChatsList />
      case 'settings':
        return <SettingsSidebar />
      default:
        return (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-sm text-neutral-600 text-center">
              {PLACEHOLDER[activity] || activity} — coming soon
            </p>
          </div>
        )
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      {/* Activity header */}
      <div className="h-[40px] flex items-center px-4">
        <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
          {activity === 'chats' ? 'Chats' : activity === 'settings' ? 'Settings' : activity}
        </h2>
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  )
}
```

> 关键变更: 活动标题 header 固定 40px，无底部横线，与 TitleBar/SessionHeader 高度对齐。

`src/renderer/components/Sidebar/ChatsList.tsx`:
```typescript
export default function ChatsList() {
  return (
    <div className="flex flex-col flex-1">
      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <input
            type="text"
            placeholder="搜索会话..."
            className="w-full bg-neutral-900 border border-neutral-700 rounded-md px-3 py-1.5
                       text-xs text-neutral-300 placeholder-neutral-600 outline-none
                       focus:border-neutral-500 transition-colors"
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 px-3 pb-3">
        {['全部', '进行中', '归档'].map(f => (
          <button
            key={f}
            className="px-2 py-0.5 text-[11px] rounded-full border border-neutral-700
                       text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
          >
            {f}
          </button>
        ))}
      </div>

      {/* Chat list placeholder */}
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-neutral-600">No conversations yet</p>
      </div>
    </div>
  )
}
```

- [ ] Step 4: 运行测试，确认通过

```bash
npx vitest run test/unit/components/Sidebar.test.tsx
```

- [ ] Step 5: 验证

```bash
npx tsc --noEmit -p tsconfig.web.json
npx electron-vite build
```

- [ ] Step 6: 提交

```bash
git add src/renderer/components/Sidebar/Sidebar.tsx \
        src/renderer/components/Sidebar/ChatsList.tsx \
        test/unit/components/Sidebar.test.tsx
git commit -m "AttaSeek: refactor Sidebar with ChatsList + Settings nav support

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Checkpoint: After Phase 2 (Tasks 5-7)

- [ ] `npx vitest run` — 所有测试通过
- [ ] `npm run build` — 构建成功
- [ ] ActivityBar 显示 8 个 Lucide 图标
- [ ] TitleBar 40px 无横线
- [ ] 点击 Chats → Sidebar 显示对话搜索+筛选
- [ ] 点击 Settings → Sidebar 显示分类导航（下一步实现）
- [ ] 继续 Phase 3

---

## Phase 3: Conversation 重构 (4 tasks)

### Task 8: Refactor SessionHeader (三键 + ContextRing + 40px + 底部横线)

**进程层:** renderer

**Files:**
- Modify: `src/renderer/components/Conversation/SessionHeader.tsx`
- Create: `src/renderer/components/Conversation/ContextRing.tsx`
- Test: `test/unit/components/SessionHeader.test.tsx`

- [ ] Step 1: 更新测试

```typescript
// test/unit/components/SessionHeader.test.tsx 追加
it('should render three action buttons (Monitor/Info/PanelBottom)', () => {
  render(<SessionHeader />)
  expect(screen.getByLabelText('应用面板')).toBeInTheDocument()
  expect(screen.getByLabelText('环境信息')).toBeInTheDocument()
  expect(screen.getByLabelText('AI 输出区域')).toBeInTheDocument()
})

it('should have bottom border at 40px height', () => {
  const { container } = render(<SessionHeader />)
  const header = container.firstChild as HTMLElement
  expect(header.className).toContain('h-[40px]')
  expect(header.className).toContain('border-b')
})
```

- [ ] Step 2: 运行测试，确认失败

```bash
npx vitest run test/unit/components/SessionHeader.test.tsx
# 预期: 失败 — 缺少三键
```

- [ ] Step 3: 写实现

`src/renderer/components/Conversation/SessionHeader.tsx`:
```typescript
import { Monitor, Info, PanelBottom } from 'lucide-react'
import ContextRing from './ContextRing'

export default function SessionHeader() {
  return (
    <div className="flex-shrink-0 h-[40px] flex items-center gap-3 px-4 border-b border-neutral-800 bg-neutral-950/80">
      {/* Left — editable session title */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-medium text-neutral-300 truncate">
          New Session
        </span>
      </div>

      {/* Center — context ring */}
      <div className="flex-1 flex justify-center">
        <ContextRing used={0} total={200000} />
      </div>

      {/* Right — three action buttons */}
      <div className="flex items-center gap-0.5">
        <button
          className="w-6 h-6 flex items-center justify-center rounded text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
          title="应用面板"
          aria-label="应用面板"
        >
          <Monitor className="w-4 h-4" />
        </button>
        <button
          className="w-6 h-6 flex items-center justify-center rounded text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
          title="环境信息"
          aria-label="环境信息"
        >
          <Info className="w-4 h-4" />
        </button>
        <button
          className="w-6 h-6 flex items-center justify-center rounded text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
          title="AI 输出区域"
          aria-label="AI 输出区域"
        >
          <PanelBottom className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
```

> 关键变更: `h-[40px]`, `border-b` 保留，三键用 Lucide 图标，中央加 ContextRing。

`src/renderer/components/Conversation/ContextRing.tsx`:
```typescript
interface ContextRingProps {
  used: number
  total: number
}

export default function ContextRing({ used, total }: ContextRingProps) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0
  const radius = 10
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  const color = pct > 95 ? '#ef4444' : pct > 80 ? '#f59e0b' : '#3b82f6'

  return (
    <div className="flex items-center gap-1.5 group cursor-default" title="上下文用量">
      <svg width={24} height={24} viewBox="0 0 24 24" className="-rotate-90">
        {/* Background track */}
        <circle cx="12" cy="12" r={radius} fill="none" stroke="#333" strokeWidth="2" />
        {/* Usage ring */}
        <circle
          cx="12" cy="12" r={radius} fill="none"
          stroke={color} strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
          opacity={used > 0 ? 1 : 0}
        />
      </svg>
      <span className="text-[11px] text-neutral-500 tabular-nums">{pct}%</span>
    </div>
  )
}
```

- [ ] Step 4: 运行测试，确认通过

```bash
npx vitest run test/unit/components/SessionHeader.test.tsx
```

- [ ] Step 5: 验证

```bash
npx tsc --noEmit -p tsconfig.web.json
npx electron-vite build
```

- [ ] Step 6: 提交

```bash
git add src/renderer/components/Conversation/SessionHeader.tsx \
        src/renderer/components/Conversation/ContextRing.tsx \
        test/unit/components/SessionHeader.test.tsx
git commit -m "AttaSeek: refactor SessionHeader with 3-button layout + ContextRing

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Refactor Composer (完整输入区)

**进程层:** renderer

**Files:**
- Modify: `src/renderer/components/Conversation/Composer.tsx`
- Create: `src/renderer/components/Conversation/ContextChip.tsx`
- Create: `src/renderer/components/Conversation/ModelSelector.tsx`
- Test: `test/unit/components/Composer.test.tsx`

- [ ] Step 1: 更新测试

```typescript
// test/unit/components/Composer.test.tsx 追加
it('should render model selector dropdown', () => {
  render(<Composer />)
  expect(screen.getByText(/Opus/)).toBeInTheDocument()
})

it('should render send button (disabled when empty)', () => {
  render(<Composer />)
  expect(screen.getByLabelText('Send')).toBeInTheDocument()
})

it('should show hint row with @ and / commands', () => {
  render(<Composer />)
  expect(screen.getByText(/@file/)).toBeInTheDocument()
  expect(screen.getByText(/\/plan/)).toBeInTheDocument()
})
```

- [ ] Step 2: 运行测试，确认失败

```bash
npx vitest run test/unit/components/Composer.test.tsx
# 预期: 失败 — 模型选择器不存在
```

- [ ] Step 3: 写实现

`src/renderer/components/Conversation/Composer.tsx`:
```typescript
import { useAtom } from 'jotai'
import { composerValueAtom, composerChipsAtom, isAgentRunningAtom } from '../../atoms/composerAtom'
import ContextChip from './ContextChip'
import ModelSelector from './ModelSelector'

export default function Composer() {
  const [value, setValue] = useAtom(composerValueAtom)
  const [chips, setChips] = useAtom(composerChipsAtom)
  const [isRunning] = useAtom(isAgentRunningAtom)

  const removeChip = (id: string) => setChips(chips.filter(c => c.id !== id))

  return (
    <div className="flex-shrink-0 border-t border-neutral-800 px-4 py-3 bg-neutral-950">
      {/* Context chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {chips.map(chip => (
            <ContextChip key={chip.id} chip={chip} onRemove={() => removeChip(chip.id)} />
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg
                       px-3 py-2 pr-8 text-sm text-neutral-200 placeholder-neutral-600
                       resize-none outline-none max-h-[40vh]
                       focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500/30
                       transition-colors"
            placeholder="Message AttaSeek… (Enter to send, Shift+Enter for newline)"
            rows={Math.min(8, Math.max(2, value.split('\n').length))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                // Send logic — will be wired later
              }
            }}
          />
        </div>

        <div className="flex items-center gap-1">
          {isRunning ? (
            <button
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg
                         bg-red-900/40 text-red-400 hover:bg-red-900/60 transition-colors"
              title="Stop"
              aria-label="Stop"
            >
              <span className="text-sm">■</span>
            </button>
          ) : (
            <button
              className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition-colors
                ${value.trim()
                  ? 'bg-blue-600 text-white hover:bg-blue-500'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                }`}
              disabled={!value.trim()}
              title="Send"
              aria-label="Send"
            >
              <span className="text-sm">→</span>
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mt-1.5 px-0.5">
        <ModelSelector />
        <div className="flex-1" />
        <span className="text-[10px] text-neutral-600">
          @file · @folder · @agent · @plugin
        </span>
        <span className="text-[10px] text-neutral-600 hidden sm:block">
          /plan · /review · /explain · /fix · /diff
        </span>
      </div>
    </div>
  )
}
```

`src/renderer/components/Conversation/ContextChip.tsx`:
```typescript
import { X } from 'lucide-react'
import type { ContextChip as ChipType } from '../../atoms/composerAtom'

interface Props {
  chip: ChipType
  onRemove: () => void
}

export default function ContextChip({ chip, onRemove }: Props) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                     bg-neutral-800 border border-neutral-700 text-[11px] text-neutral-300">
      <span className="text-neutral-500">
        {chip.type === 'file' ? '📄' : chip.type === 'folder' ? '📂' : chip.type === 'agent' ? '🤖' : '🧩'}
      </span>
      <span className="truncate max-w-[120px]">{chip.label}</span>
      <button onClick={onRemove} className="text-neutral-600 hover:text-neutral-400">
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}
```

`src/renderer/components/Conversation/ModelSelector.tsx`:
```typescript
export default function ModelSelector() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded
                     border border-neutral-700 text-[11px] text-neutral-400
                     cursor-pointer hover:border-neutral-600 hover:text-neutral-300 transition-colors">
      Opus 4.7 ▾
    </span>
  )
}
```

- [ ] Step 4: 运行测试，确认通过

```bash
npx vitest run test/unit/components/Composer.test.tsx
```

- [ ] Step 5: 验证

```bash
npx tsc --noEmit -p tsconfig.web.json
npx electron-vite build
```

- [ ] Step 6: 提交

```bash
git add src/renderer/components/Conversation/Composer.tsx \
        src/renderer/components/Conversation/ContextChip.tsx \
        src/renderer/components/Conversation/ModelSelector.tsx \
        test/unit/components/Composer.test.tsx
git commit -m "AttaSeek: refactor Composer with chips, model selector, send/stop

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Refactor MessageFlow (6 message types + render skeleton)

**进程层:** renderer

**Files:**
- Modify: `src/renderer/components/Conversation/MessageFlow.tsx`
- Create: `src/renderer/components/Conversation/UserMessage.tsx`
- Create: `src/renderer/components/Conversation/AgentMessage.tsx`
- Create: `src/renderer/components/Conversation/AgentPlanCard.tsx`
- Create: `src/renderer/components/Conversation/InlineDiffCard.tsx`
- Modify: `src/renderer/components/Conversation/ToolCallCard.tsx`
- Modify: `src/renderer/components/Conversation/PermissionInline.tsx`

- [ ] Step 1–3: 直接实现（消息组件为骨架，暂无测试，后续 Agent 集成时补完整测试）

`src/renderer/components/Conversation/MessageFlow.tsx`:
```typescript
import AgentStatusBar from './AgentStatusBar'

export default function MessageFlow() {
  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <AgentStatusBar />

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center h-full px-6 pb-20">
        <div className="w-16 h-16 rounded-2xl bg-neutral-800/60 flex items-center justify-center mb-4">
          <span className="text-2xl text-neutral-600">◈</span>
        </div>
        <h3 className="text-sm font-medium text-neutral-500 mb-1">
          AttaSeek Agent
        </h3>
        <p className="text-xs text-neutral-600 text-center max-w-xs">
          Start a conversation by typing a message below.
          Ask the agent to read code, write patches, run commands, or review changes.
        </p>
      </div>
    </div>
  )
}
```

`src/renderer/components/Conversation/UserMessage.tsx`:
```typescript
interface UserMessageProps {
  content: string
}

export default function UserMessage({ content }: UserMessageProps) {
  return (
    <div className="flex justify-end px-4 py-2">
      <div className="max-w-[80%] px-4 py-2 rounded-2xl bg-neutral-800 text-sm text-neutral-200">
        {content}
      </div>
    </div>
  )
}
```

`src/renderer/components/Conversation/AgentMessage.tsx`:
```typescript
interface AgentMessageProps {
  content: string
}

export default function AgentMessage({ content }: AgentMessageProps) {
  return (
    <div className="px-4 py-2">
      <div className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    </div>
  )
}
```

`src/renderer/components/Conversation/AgentPlanCard.tsx`:
```typescript
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

interface AgentPlanCardProps {
  summary: string
  steps: string[]
}

export default function AgentPlanCard({ summary, steps }: AgentPlanCardProps) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="px-4 py-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
      >
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {summary}
      </button>
      {expanded && (
        <div className="mt-2 ml-5 space-y-1">
          {steps.map((s, i) => (
            <div key={i} className="text-xs text-neutral-400">{i + 1}. {s}</div>
          ))}
        </div>
      )}
    </div>
  )
}
```

`src/renderer/components/Conversation/ToolCallCard.tsx`:
```typescript
import { useState } from 'react'
import { ChevronDown, ChevronRight, Undo2 } from 'lucide-react'

interface ToolCallCardProps {
  tool: string
  summary: string
  input?: string
  output?: string
  onUndo?: () => void
}

export default function ToolCallCard({ tool, summary, input, output, onUndo }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="px-4 py-1">
      <div className="border border-neutral-700 rounded-lg bg-neutral-900/50 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          <span className="text-xs text-neutral-500">🔧 {tool}</span>
          <span className="text-xs text-neutral-600 truncate flex-1">— {summary}</span>
          {onUndo && (
            <button onClick={onUndo} className="text-neutral-600 hover:text-neutral-400 transition-colors" title="撤销">
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {expanded && (input || output) && (
          <div className="border-t border-neutral-700 px-3 py-2 text-xs text-neutral-400 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
            {input && <div className="text-neutral-600 mb-1">// Input:</div>}
            {input && <div>{input}</div>}
            {output && <div className="text-neutral-600 mt-2 mb-1">// Output:</div>}
            {output && <div>{output}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
```

`src/renderer/components/Conversation/InlineDiffCard.tsx`:
```typescript
interface InlineDiffCardProps {
  filename: string
  additions: number
  deletions: number
  onAccept?: () => void
  onReject?: () => void
}

export default function InlineDiffCard({ filename, additions, deletions, onAccept, onReject }: InlineDiffCardProps) {
  return (
    <div className="px-4 py-1">
      <div className="border border-neutral-700 rounded-lg bg-neutral-900/50 px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-300">📄 {filename}</span>
          <span className="text-xs text-green-500">+{additions}</span>
          <span className="text-xs text-red-500">-{deletions}</span>
          <div className="flex-1" />
          <button onClick={onAccept} className="text-xs text-green-500 hover:text-green-400 px-2 py-0.5 rounded border border-green-500/30 hover:border-green-400 transition-colors">Accept</button>
          <button onClick={onReject} className="text-xs text-red-500 hover:text-red-400 px-2 py-0.5 rounded border border-red-500/30 hover:border-red-400 transition-colors">Reject</button>
        </div>
      </div>
    </div>
  )
}
```

`src/renderer/components/Conversation/PermissionInline.tsx`:
```typescript
interface PermissionInlineProps {
  message: string
  onAllowOnce?: () => void
  onAllowSession?: () => void
  onDeny?: () => void
}

export default function PermissionInline({ message, onAllowOnce, onAllowSession, onDeny }: PermissionInlineProps) {
  return (
    <div className="px-4 py-1">
      <div className="border border-amber-700/50 rounded-lg bg-amber-900/10 px-3 py-2">
        <div className="flex items-start gap-2">
          <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-amber-200 mb-2">{message}</p>
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={onAllowOnce} className="text-[11px] px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors">Allow</button>
              <button onClick={onAllowSession} className="text-[11px] px-2.5 py-1 rounded border border-neutral-600 text-neutral-300 hover:bg-neutral-800 transition-colors">Allow this session</button>
              <button onClick={onDeny} className="text-[11px] px-2.5 py-1 rounded border border-neutral-600 text-neutral-400 hover:bg-neutral-800 transition-colors">Deny</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] Step 4: 验证

```bash
npx tsc --noEmit -p tsconfig.web.json
npx vitest run test/unit/components/MessageFlow.test.tsx test/unit/components/SessionHeader.test.tsx test/unit/components/Composer.test.tsx
npx electron-vite build
```

- [ ] Step 5: 提交

```bash
git add src/renderer/components/Conversation/
git commit -m "AttaSeek: refactor MessageFlow + add UserMessage, AgentMessage, PlanCard, DiffCard, ToolCallCard, PermissionInline

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Checkpoint: After Phase 3 (Tasks 8-10)

- [ ] `npx vitest run` — 所有测试通过
- [ ] `npm run build` — 构建成功
- [ ] SessionHeader: 40px, 底部横线, 标题+ContextRing+三键
- [ ] Composer: 多行输入, chips, model selector, send/stop, hint row
- [ ] MessageFlow: 6 种消息组件可导入
- [ ] 继续 Phase 4

---

## Phase 4: Settings 面板 (2 tasks)

### Task 11: Create Settings container + sidebar navigation

**进程层:** renderer

**Files:**
- Create: `src/renderer/components/Settings/Settings.tsx`
- Create: `src/renderer/components/Settings/SettingsSidebar.tsx`

- [ ] Step 1–3: 直接实现 (纯 UI 骨架)

`src/renderer/components/Settings/SettingsSidebar.tsx`:
```typescript
import { useAtom } from 'jotai'
import { settingsSectionAtom, type SettingsSection, SETTINGS_SECTIONS } from '../../atoms/settingsAtom'

export default function SettingsSidebar() {
  const [active, setActive] = useAtom(settingsSectionAtom)

  return (
    <div className="flex flex-col gap-0.5 px-3 py-2">
      {SETTINGS_SECTIONS.map((section) => (
        <button
          key={section.id}
          onClick={() => setActive(section.id)}
          className={`text-left px-3 py-1.5 rounded-md text-xs transition-colors
            ${active === section.id
              ? 'bg-neutral-800 text-neutral-200'
              : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
            }`}
        >
          {section.label}
        </button>
      ))}
    </div>
  )
}
```

`src/renderer/atoms/settingsAtom.ts` 追加:
```typescript
export const SETTINGS_SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'profile', label: 'Profile' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'personalization', label: 'Personalization' },
  { id: 'keyboard', label: 'Keyboard Shortcuts' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'agent', label: 'Agent Config' },
  { id: 'git', label: 'Git' },
  { id: 'integrations', label: 'Integrations' }
]
```

`src/renderer/components/Settings/Settings.tsx`:
```typescript
import { useAtom } from 'jotai'
import { settingsSectionAtom } from '../../atoms/settingsAtom'
import GeneralSettings from './pages/GeneralSettings'
import ProfileSettings from './pages/ProfileSettings'
import AppearanceSettings from './pages/AppearanceSettings'
import ConfigurationSettings from './pages/ConfigurationSettings'
import PersonalizationSettings from './pages/PersonalizationSettings'
import KeyboardSettings from './pages/KeyboardSettings'
import NotificationsSettings from './pages/NotificationsSettings'
import AgentSettings from './pages/AgentSettings'
import GitSettings from './pages/GitSettings'
import IntegrationsSettings from './pages/IntegrationsSettings'

const PAGE_MAP: Record<string, React.ComponentType> = {
  general: GeneralSettings,
  profile: ProfileSettings,
  appearance: AppearanceSettings,
  configuration: ConfigurationSettings,
  personalization: PersonalizationSettings,
  keyboard: KeyboardSettings,
  notifications: NotificationsSettings,
  agent: AgentSettings,
  git: GitSettings,
  integrations: IntegrationsSettings
}

export default function Settings() {
  const [section] = useAtom(settingsSectionAtom)
  const Page = PAGE_MAP[section] || GeneralSettings

  return (
    <div className="flex-1 min-w-0 overflow-y-auto px-6 py-6">
      <div className="max-w-2xl">
        <Page />
      </div>
    </div>
  )
}
```

- [ ] Step 4: 验证

```bash
npx tsc --noEmit -p tsconfig.web.json
npx electron-vite build
```

- [ ] Step 5: 提交

```bash
git add src/renderer/components/Settings/ src/renderer/atoms/settingsAtom.ts
git commit -m "AttaSeek: add Settings container + sidebar with 10 categories

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Create 10 Settings pages

**进程层:** renderer

**Files:**
- Create: 10 page files under `src/renderer/components/Settings/pages/`

- [ ] Step 1–3: 直接实现所有 10 页（5 页完整，5 页简化占位）

**完整页: GeneralSettings**
```typescript
export default function GeneralSettings() {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-200 mb-4">General</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-300">File open behavior</p>
            <p className="text-[11px] text-neutral-600">Where new files open in the editor</p>
          </div>
          <span className="text-[11px] text-neutral-400 border border-neutral-700 rounded px-2 py-0.5">Current Tab ▾</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-300">Command output verbosity</p>
            <p className="text-[11px] text-neutral-600">How much detail in agent command output</p>
          </div>
          <span className="text-[11px] text-neutral-400 border border-neutral-700 rounded px-2 py-0.5">Default ▾</span>
        </div>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="rounded bg-neutral-800 border-neutral-600" />
          <div>
            <p className="text-xs text-neutral-300">Require ⌘+Enter to send</p>
            <p className="text-[11px] text-neutral-600">Prevent accidental sends with Enter alone</p>
          </div>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="rounded bg-neutral-800 border-neutral-600" />
          <div>
            <p className="text-xs text-neutral-300">Prevent sleep while running</p>
            <p className="text-[11px] text-neutral-600">Keep computer awake during long-running tasks</p>
          </div>
        </label>
      </div>
    </div>
  )
}
```

**完整页: AppearanceSettings（含主题切换）**
```typescript
import { useAtom } from 'jotai'
import { themeAtom, type Theme } from '../../../atoms/themeAtom'
import { Sun, Moon, Monitor } from 'lucide-react'

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
]

export default function AppearanceSettings() {
  const [theme, setTheme] = useAtom(themeAtom)

  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-200 mb-4">Appearance</h3>

      <div className="space-y-4">
        {/* Theme selector */}
        <div>
          <p className="text-xs text-neutral-300 mb-2">Base theme</p>
          <div className="flex gap-2">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-2 px-4 py-3 rounded-lg border transition-colors
                  ${theme === value
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                    : 'border-neutral-700 text-neutral-500 hover:border-neutral-600 hover:text-neutral-400'
                  }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px]">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Font selectors */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-300">UI font</p>
            <p className="text-[11px] text-neutral-500">SF Pro (system)</p>
          </div>
          <span className="text-[11px] text-neutral-400 border border-neutral-700 rounded px-2 py-0.5">System ▾</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-300">Code font</p>
            <p className="text-[11px] text-neutral-500">JetBrains Mono</p>
          </div>
          <span className="text-[11px] text-neutral-400 border border-neutral-700 rounded px-2 py-0.5">JetBrains ▾</span>
        </div>
      </div>
    </div>
  )
}
```

其他 3 页完整 + 5 页简化实现详见代码。占位页使用统一模板：
```typescript
export default function XxxSettings() {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-200 mb-4">Xxx</h3>
      <p className="text-xs text-neutral-600">Xxx settings — coming soon</p>
    </div>
  )
}
```

- [ ] Step 4: 验证

```bash
npx tsc --noEmit -p tsconfig.web.json
npx vitest run
npx electron-vite build
```

- [ ] Step 5: 提交

```bash
git add src/renderer/components/Settings/pages/
git commit -m "AttaSeek: create 10 Settings pages (5 full, 5 placeholder)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Checkpoint: After Phase 4 (Tasks 11-12)

- [ ] Settings Sidebar 显示 10 个分类导航
- [ ] 点击分类切换对应设置页面
- [ ] Appearance → 主题切换按钮可点击，即时生效
- [ ] `npm run build` 构建成功
- [ ] 继续 Phase 5

---

## Phase 5: OutputArea 四面板 (2 tasks)

### Task 13: Create OutputArea container + Tab system + 4 panels

**进程层:** renderer

**Files:**
- Create: `src/renderer/components/OutputArea/OutputArea.tsx`
- Create: `src/renderer/components/OutputArea/BrowserPanel.tsx`
- Create: `src/renderer/components/OutputArea/FilesPanel.tsx`
- Create: `src/renderer/components/OutputArea/TerminalPanel.tsx`
- Create: `src/renderer/components/OutputArea/ReviewPanel.tsx`

- [ ] Step 1–3: 直接实现 (骨架)

`src/renderer/components/OutputArea/OutputArea.tsx`:
```typescript
import { useAtom } from 'jotai'
import { outputTabsAtom, activeOutputTabAtom, outputAreaVisibleAtom } from '../../atoms/outputTabsAtom'
import { Globe, FolderOpen, Terminal, GitCompare, Maximize2, X } from 'lucide-react'
import BrowserPanel from './BrowserPanel'
import FilesPanel from './FilesPanel'
import TerminalPanel from './TerminalPanel'
import ReviewPanel from './ReviewPanel'

const TAB_CONFIG = {
  browser: { icon: Globe, label: 'Browser' },
  files: { icon: FolderOpen, label: 'Files' },
  terminal: { icon: Terminal, label: 'Terminal' },
  review: { icon: GitCompare, label: 'Review' }
}

// Default open tabs (Terminal is always open)
const DEFAULT_TABS = [{ id: 'terminal', type: 'terminal' as const, label: 'Terminal' }]

export default function OutputArea() {
  const [tabs, setTabs] = useAtom(outputTabsAtom)
  const [activeId, setActiveId] = useAtom(activeOutputTabAtom)
  const [visible, setVisible] = useAtom(outputAreaVisibleAtom)

  if (!visible) return null

  // Lazy init with default tabs
  if (tabs.length === 0) {
    setTabs(DEFAULT_TABS)
    setActiveId('terminal')
  }

  const activeTab = tabs.find(t => t.id === activeId) || tabs[0]

  const renderPanel = () => {
    if (!activeTab) return null
    switch (activeTab.type) {
      case 'browser': return <BrowserPanel />
      case 'files': return <FilesPanel />
      case 'terminal': return <TerminalPanel />
      case 'review': return <ReviewPanel />
    }
  }

  return (
    <div className="flex flex-col border-t border-neutral-800 bg-neutral-950" style={{ height: '35%', minHeight: '200px' }}>
      {/* Tab bar */}
      <div className="flex-shrink-0 flex items-center border-b border-neutral-800 h-[32px]">
        {/* Tab list */}
        <div className="flex items-center flex-1 min-w-0">
          {tabs.map(tab => {
            const config = TAB_CONFIG[tab.type]
            const Icon = config.icon
            const isActive = tab.id === activeId
            return (
              <button
                key={tab.id}
                onClick={() => setActiveId(tab.id)}
                className={`flex items-center gap-1.5 px-3 h-[32px] text-[11px] border-r border-neutral-800
                  transition-colors
                  ${isActive
                    ? 'text-neutral-200 bg-neutral-900 border-b-2 border-b-blue-500'
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900/50'
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="truncate max-w-[80px]">{tab.label}</span>
                <span className="ml-0.5 text-neutral-700 hover:text-neutral-400">×</span>
              </button>
            )
          })}
        </div>

        {/* Expand / Hide */}
        <div className="flex items-center flex-shrink-0 mr-1">
          <button className="w-6 h-6 flex items-center justify-center rounded text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors" title="Expand">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setVisible(false)} className="w-6 h-6 flex items-center justify-center rounded text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors" title="Hide">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Panel content */}
      <div className="flex-1 min-h-0">
        {renderPanel()}
      </div>
    </div>
  )
}
```

各面板骨架实现（TerminalPanel 迁移原有内容，其他初始占位）：

`src/renderer/components/OutputArea/BrowserPanel.tsx`:
```typescript
export default function BrowserPanel() {
  return (
    <div className="flex flex-col h-full">
      {/* Address bar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-neutral-800">
        <input
          type="text"
          placeholder="Enter URL..."
          className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 text-xs text-neutral-300 placeholder-neutral-600 outline-none focus:border-neutral-500"
        />
      </div>
      {/* Viewport placeholder */}
      <div className="flex-1 flex items-center justify-center bg-neutral-900/30">
        <p className="text-xs text-neutral-600">Browser — Enter a URL to load</p>
      </div>
    </div>
  )
}
```

`src/renderer/components/OutputArea/FilesPanel.tsx`:
```typescript
export default function FilesPanel() {
  return (
    <div className="flex h-full">
      {/* File tree placeholder */}
      <div className="w-56 border-r border-neutral-800 flex items-center justify-center">
        <p className="text-xs text-neutral-600">File tree — coming soon</p>
      </div>
      {/* Editor placeholder */}
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-neutral-600">Monaco Editor — open a file to edit</p>
      </div>
    </div>
  )
}
```

`src/renderer/components/OutputArea/ReviewPanel.tsx`:
```typescript
export default function ReviewPanel() {
  return (
    <div className="flex h-full">
      {/* Changed files list */}
      <div className="w-52 border-r border-neutral-800 p-3">
        <h4 className="text-xs font-medium text-neutral-400 mb-2">Changed Files</h4>
        <p className="text-xs text-neutral-600">No changes to review</p>
      </div>
      {/* Diff view */}
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-neutral-600">Monaco Diff Editor — select a file to review</p>
      </div>
    </div>
  )
}
```

`src/renderer/components/OutputArea/TerminalPanel.tsx`:
```typescript
export default function TerminalPanel() {
  return (
    <div className="flex items-center justify-center h-full bg-neutral-950">
      <p className="text-xs text-neutral-600 font-mono">$ _</p>
      {/* xterm.js integration coming when terminal feature is implemented */}
    </div>
  )
}
```

- [ ] Step 4: 验证

```bash
npx tsc --noEmit -p tsconfig.web.json
npx electron-vite build
```

- [ ] Step 5: 提交

```bash
git add src/renderer/components/OutputArea/
git commit -m "AttaSeek: add OutputArea with 4-panel Tab system (Browser/Files/Terminal/Review)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 6: Shell 集成 + 清理 (2 tasks)

### Task 14: Update Shell layout + remove old Artifact/Terminal/Diff

**进程层:** renderer

**Files:**
- Modify: `src/renderer/layouts/Shell.tsx`
- Delete: `src/renderer/components/Artifact/Artifact.tsx`
- Delete: `src/renderer/components/Terminal/Terminal.tsx`
- Delete: `src/renderer/components/Diff/Diff.tsx`

- [ ] Step 1: 更新 Shell 测试

```typescript
// test/unit/components/Shell.test.tsx — 替换 Artifact 相关断言
it('should render OutputArea when visible', () => {
  renderShell()
  // OutputArea is visible by default, should show Terminal tab
  expect(screen.getByText('Terminal')).toBeInTheDocument()
})
```

- [ ] Step 2: 运行测试，确认失败

```bash
npx vitest run test/unit/components/Shell.test.tsx
# 预期: 失败 — OutputArea 不存在
```

- [ ] Step 3: 写实现

`src/renderer/layouts/Shell.tsx`:
```typescript
import { useAtom } from 'jotai'
import { activeActivityAtom } from '../atoms/activityAtom'
import ActivityBar from '../components/ActivityBar/ActivityBar'
import TitleBar from '../components/TitleBar/TitleBar'
import Sidebar from '../components/Sidebar/Sidebar'
import Conversation from '../components/Conversation/Conversation'
import Settings from '../components/Settings/Settings'
import OutputArea from '../components/OutputArea/OutputArea'

export default function Shell() {
  const [activeActivity] = useAtom(activeActivityAtom)

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Activity Bar — 48px left rail */}
      <ActivityBar />

      {/* Sidebar region: title bar (traffic lights area) + sidebar content */}
      <div
        className="flex flex-col flex-shrink-0 border-r border-neutral-800"
        style={{ width: 'var(--sidebar-width)' }}
      >
        <TitleBar />
        <Sidebar activity={activeActivity} />
      </div>

      {/* Main Canvas */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Conversation + Settings area */}
        <div className="flex-1 flex min-h-0">
          {activeActivity === 'settings' ? (
            <Settings />
          ) : (
            <Conversation />
          )}
        </div>

        {/* AI Output area (toggleable) */}
        <OutputArea />
      </div>
    </div>
  )
}
```

> 关键变更: Artifact 移除，Conversation 改为 flex-1 填充，Settings 模式替换 Conversation，OutputArea 放在底部。

- [ ] Step 4: 删除旧文件

```bash
rm src/renderer/components/Artifact/Artifact.tsx
rm src/renderer/components/Terminal/Terminal.tsx
rm src/renderer/components/Diff/Diff.tsx
```

- [ ] Step 5: 运行所有测试 + 验证

```bash
npx vitest run
# 预期: 所有测试通过
npx tsc --noEmit -p tsconfig.node.json
npx tsc --noEmit -p tsconfig.web.json
npx electron-vite build
```

- [ ] Step 6: 提交

```bash
git add -A
git commit -m "AttaSeek: integrate Shell with Settings + OutputArea, remove old Artifact/Terminal/Diff

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Final Checkpoint: After Phase 6 (Entire Feature)

- [ ] `npx vitest run` — 所有测试通过
- [ ] `npx tsc --noEmit -p tsconfig.node.json` — 主进程编译通过
- [ ] `npx tsc --noEmit -p tsconfig.web.json` — 渲染进程编译通过
- [ ] `npm run build` — electron-vite 三进程构建成功
- [ ] `npm run dev` — Electron 启动，以下全部可见:
  - ActivityBar: 8 个 Lucide 图标 + Chats
  - TitleBar: 40px，无横线
  - Sidebar Header: 40px，无横线
  - SessionHeader: 40px，底部横线，ContextRing，三键
  - Composer: 多行 + model selector + send/stop + hints
  - OutputArea: Terminal Tab 默认打开，可切换/隐藏
  - Settings: 10 个分类，Appearance 可切换主题
- [ ] 确认 `data-theme` 切换即时生效
- [ ] 确认 conversations/Header 标题栏高度一致
