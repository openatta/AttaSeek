# 配置系统对齐 — Codex + Claude Code 架构设计

**日期：** 2026-06-06
**基于需求：** `docs/reqs/2026-06-06-config-system-alignment.md`

---

## 澄清结论

| 问题 | 结论 |
|------|------|
| 沙箱默认范围 | 项目目录 + `~/Documents` + `~/Desktop` 可读写；其他非隐私数据（`/usr/`、`/opt/`）只读；隐私目录（`~/.ssh/`、`~/.gnupg/`）不可访问 |
| 模型白名单为空 | 显示全部已配置模型（与 Codex 一致） |
| 配置格式 | **仅 JSON**，不使用 TOML。JSON 在 JS 生态中零依赖解析，与 Claude Code 兼容 |
| 快捷键格式 | 对齐 VS Code `keybindings.json` 规范 |

---

## 组件结构

### 主进程

```
src/main/store/
├── settings.ts                       [重写] 从 6 key → 30+ key 的 JSON 配置读写
├── FileStore.ts                      [已有] MarkdownStore/JSONStore/JSONLStore
├── ConfigSchema.ts                   [新建] JSON Schema 验证 + 默认值回退 + passthrough
├── ConfigHotReload.ts                [新建] fs.watch 监听 settings.json 变更 → IPC 通知 renderer
├── SandboxManager.ts                 [新建] 沙箱策略执行（路径拦截 + 命令过滤）
├── db.ts                             [修改] 仅保留 audit_logs/token_usage/permission_policies
├── schema.ts                         [修改] 删除 11 张迁移表的 DDL
├── DataMigrator.ts                   [新建] SQLite → 明文文件一次性数据迁移
├── KeybindingLoader.ts               [新建] keybindings.json 加载 + VS Code 格式解析
└── ModelWhitelist.ts                 [新建] 模型白名单过滤逻辑

src/main/config/                       [新建]
├── ConfigManager.ts                  # 统一配置入口（读/写/验证/合并/热加载）
├── defaults.ts                       # 内置默认值（完整 30+ key 的默认值表）
├── mapping.ts                        # Claude Code / Codex key → AttaSeek key 映射表
└── types.ts                          # 配置类型定义
```

### 渲染进程

```
src/renderer/atoms/
├── settingsAtom.ts                   [重写] 从主进程加载完整配置，拆分为子 atom
├── sandboxAtom.ts                    [新建] 沙箱配置状态
├── keybindingsAtom.ts                [新建] 快捷键配置状态
└── notificationsAtom.ts              [新建] 通知配置状态

src/renderer/components/Settings/pages/
├── GeneralSettings.tsx               [修改] 连线到 settingsAtom
├── AppearanceSettings.tsx            [修改] 连线 theme/font/reduceMotion
├── ModelSettings.tsx                 [已有] 功能完整
├── AgentSettings.tsx                 [重写] 从占位 → 连线 personality/instructions/thinking/fastMode
├── SandboxSettings.tsx               [新建] 沙箱安全设置页面
├── PermissionsSettings.tsx           [已有] 功能完整
├── MemorySettings.tsx                [已有] 功能完整
├── KeybindingsSettings.tsx           [重写] 从占位 → 连线 keybindingsAtom
├── NotificationsSettings.tsx         [重写] 从占位 → 连线 notificationsAtom
├── UpdatesSettings.tsx               [新建] 更新通道 + 版本信息
└── AdvancedSettings.tsx              [新建] 管理配置（会话清理/MCP/Shell/代理/模型白名单）
```

---

## 配置项完整定义（`settings.json` 结构）

```typescript
interface AttaSeekSettings {
  // ── 外观 ──
  theme: 'dark' | 'light' | 'system'           // 默认 dark
  fontFamily: string                            // 默认 "SF Pro"
  codeFontFamily: string                        // 默认 "JetBrains Mono"
  reduceMotion: boolean                         // 默认 false

  // ── 模型 ──
  modelConfigId: string                         // 默认 ""（使用第一个配置）
  reasoningEffort: 'low' | 'medium' | 'high'   // 默认 medium
  thinkingMode: 'auto' | 'enabled' | 'disabled' // 默认 auto
  fastMode: 'off' | 'on' | 'auto'               // 默认 off
  outputStyle: 'default' | 'concise' | 'detailed' // 默认 default
  contextWindowTokens: number                   // 默认 100000
  availableModels: string[]                     // 默认 []（全部显示）

  // ── Agent 行为 ──
  personality: 'pragmatic' | 'verbose' | 'concise' | string  // 默认 pragmatic
  developerInstructions: string                 // 默认 ""
  permissionMode: 'default' | 'auto' | 'trust'  // 默认 default

  // ── 沙箱 ──
  sandbox:
    mode: 'read-only' | 'workspace-write' | 'danger-full-access'  // 默认 workspace-write
    writableRoots: string[]                      // 默认 ["project", "~/Documents", "~/Desktop"]
    blockedPaths: string[]                       // 默认 ["~/.ssh", "~/.gnupg", "~/.aws"]
    networkAccess: boolean                       // 默认 true
    bash:
      mode: 'blacklist' | 'whitelist'            // 默认 blacklist
      blockedPatterns: string[]                  // 默认 ["rm", "sudo", "chmod", "chown", "dd", "mkfs"]
      allowedCommands: string[]                  // 默认 []（黑名单模式下忽略）

  // ── Shell 环境 ──
  shell:
    loginShell: boolean                          // 默认 false
    includeEnv: string[]                         // 默认 ["PATH", "HOME", "USER", "LANG"]
    excludeEnv: string[]                         // 默认 ["AWS_*", "GCP_*", "NPM_TOKEN"]

  // ── 会话 ──
  session:
    cleanupPeriodDays: number                    // 默认 30（0=永不清理）
    maxSessions: number                          // 默认 100
    archiveMode: 'manual' | 'auto' | 'none'     // 默认 manual

  // ── 项目 ──
  project:
    defaultTrustLevel: 'untrusted' | 'trusted'   // 默认 untrusted

  // ── 权限 ──
  permissions:
    autoReviewMode: 'off' | 'read_only' | 'full' // 默认 off

  // ── 编辑器 ──
  editor:
    mode: 'normal' | 'vim'                       // 默认 normal
    tabSize: number                              // 默认 2
    wordWrap: boolean                            // 默认 true

  // ── 通知 ──
  notifications:
    taskComplete: boolean                        // 默认 true
    inputNeeded: boolean                         // 默认 true
    soundEnabled: boolean                        // 默认 false

  // ── 更新 ──
  update:
    channel: 'stable' | 'latest' | 'none'        // 默认 stable
    checkOnStartup: boolean                      // 默认 true

  // ── 导入 ──
  import:
    fromClaudeCode: boolean                      // 默认 true
    fromCodexDesktop: boolean                    // 默认 true

  // ── MCP ──
  mcp:
    servers: MCPServerConfig[]                   // 默认 []
    autoApproveTools: boolean                    // 默认 false

  // ── 快捷键 ──
  keybindingsPath: string                        // 默认 "~/.atta/seek/keybindings.json"

  // ── Passthrough（未知 key 保留不丢弃）──
  [key: string]: unknown
}
```

---

## 数据流

### 设置读写完整路径

```
Renderer (Settings UI)
  │  用户修改设置
  │  setSetting(key, value)
  ▼
IPC: app:set-state { key, value }
  │
  ▼
Main Process: ConfigManager
  ├─ 1. 读取当前 settings.json → 合并新值
  ├─ 2. ConfigSchema.validate(data) → 类型检查 + 范围校验
  ├─ 3. JSONStore.write(data) → 写入 ~/.atta/seek/settings.json
  ├─ 4. 通知所有订阅者: IPC broadcast 'settings:changed' { key, value }
  │
  ▼
Renderer: settingsAtom
  │  atom 更新 → React re-render
  ▼
Settings UI 实时反映新值
```

### 沙箱执行路径

```
Agent 调用 Bash 工具
  │
  ▼
ToolExecutor.execute('bash', input)
  │
  ▼
SandboxManager.check(input)
  ├─ 读取 settings.json 的 sandbox 配置
  ├─ 路径检查: input.cwd 是否在 writableRoots 内？
  │     ├─ 写操作 + 不在 → 拒绝: "Sandbox: write to {path} not allowed"
  │     └─ 读操作 + 在 blockedPaths → 拒绝: "Sandbox: read from {path} blocked"
  ├─ 命令检查: bash.mode === 'whitelist'?
  │     ├─ 是 + 不在 allowedCommands → 拒绝
  │     └─ 否 + 匹配 blockedPatterns → 拒绝
  ├─ 网络检查: input 需要网络 + !sandbox.networkAccess → 拒绝
  └─ 全部通过 → 允许执行
```

### 热加载路径

```
外部编辑器修改 ~/.atta/seek/settings.json
  │
  ▼
ConfigHotReload (fs.watch)
  │  检测到 change 事件 → debounce 500ms
  ▼
ConfigManager.reload()
  ├─ 读取文件 → ConfigSchema.validate()
  ├─ 对比新旧值 → 生成 diff { key, oldValue, newValue }[]
  └─ 逐个 IPC broadcast 'settings:changed' { key, value }
  │
  ▼
Renderer: 各 atom 按 key 过滤 → 更新 → UI 刷新
```

### 快捷键系统

```
~/.atta/seek/keybindings.json (VS Code 格式)
  [
    { "key": "cmd+enter", "command": "composer.send", "when": "composerFocused" },
    { "key": "escape",     "command": "composer.clear", "when": "composerFocused" }
  ]
  │
  ▼
KeybindingLoader.load()
  ├─ 解析 JSON → Keybinding[]
  ├─ 验证格式: key 合法？command 存在？
  └─ 注册到 Electron globalShortcut / Menu accelerators
  │
  ▼
Renderer: keybindingsAtom
  ├─ 显示当前快捷键列表
  └─ 用户可编辑 → IPC → KeybindingLoader.reload()
```

---

## IPC Contract

| Channel | 方向 | 请求 | 响应 | 说明 |
|---------|------|------|------|------|
| `app:get-state` | renderer→main | `key: string` | `{ value: unknown }` | 已有，扩展到 30+ key |
| `app:set-state` | renderer→main | `{ key, value }` | `{ success: boolean }` | 已有 |
| `app:get-all-settings` | renderer→main | — | `AttaSeekSettings` | [新建] 批量获取所有设置 |
| `settings:changed` | main→renderer | — | `{ key, value }` | [新建] 热加载广播 |
| `keybindings:load` | renderer→main | — | `Keybinding[]` | [新建] 加载快捷键 |
| `keybindings:save` | renderer→main | `Keybinding[]` | `{ success }` | [新建] 保存快捷键 |
| `sandbox:validate` | renderer→main | `{ path, operation }` | `{ allowed, reason? }` | [新建] 沙箱路径预检 |

---

## Jotai Atoms

| Atom | 类型 | 作用范围 | 持久化 | 说明 |
|------|------|---------|--------|------|
| `settingsAtom` | `AttaSeekSettings` | 全局 | JSON（主进程） | 完整配置对象，IPC 同步 |
| `themeAtom` | `'dark'\|'light'\|'system'` | 全局 | localStorage + JSON | 已有，保留双写 |
| `sandboxAtom` | `SandboxConfig` | 全局 | JSON | 派生自 settingsAtom.sandbox |
| `keybindingsAtom` | `Keybinding[]` | 全局 | JSON 文件 | 快捷键列表 |
| `notificationsAtom` | `NotificationsConfig` | 全局 | JSON | 派生自 settingsAtom.notifications |
| `editorSettingsAtom` | `EditorConfig` | 全局 | JSON | 派生自 settingsAtom.editor |
| `agentSettingsAtom` | `AgentConfig` | 全局 | JSON | 派生自 settingsAtom 的 agent 相关字段 |

---

## 技术决策

| 决策 | 选择 | 理由 | 替代方案 |
|------|------|------|---------|
| 配置格式 | 仅 JSON，不用 TOML | JS 生态零依赖解析（`JSON.parse`），与 Claude Code `settings.json` 直接兼容。TOML 需额外解析器（`@iarna/toml`），增加依赖 | TOML（Codex 格式，需解析器，且嵌套结构 JS 不友好） |
| 沙箱实现 | 软沙箱（路径+命令拦截） | 首次实现简单可靠，不需要 OS 级 sandbox-exec/seccomp。路径拦截覆盖 90% 安全需求 | 硬沙箱（macOS sandbox-exec / Linux seccomp，实现复杂，调试困难） |
| 沙箱默认范围 | 项目目录可读写，隐私数据拒绝 | Codex `workspace-write` 的默认白名单是项目根目录。隐私路径（`.ssh`、`.gnupg`、`.aws`）是行业共识 | 全文件系统可读写（安全隐患）；仅项目目录（过于严格） |
| 快捷键格式 | VS Code `keybindings.json` 格式 | Codex 和 Claude Code 都使用类似格式。业界标准，用户熟悉。`{ key, command, when }` 三字段覆盖所有场景 | 自定义格式（不兼容，用户需要学习新格式） |
| SQLite 迁移 | 一次性迁移脚本 `DataMigrator` | 首次启动时检测旧 SQLite 数据 → 转换为 JSON → 写入明文 → 标记迁移完成。后续启动跳过 | 保留 SQLite 双写（违背"明文优先"原则） |
| 配置热加载 | fs.watch + debounce 500ms | Node.js 内置 API，零依赖。500ms debounce 防止编辑器保存时触发多次重载 | Chokidar（额外依赖，功能更强但当前不需要） |
| 配置合并策略 | 深合并：项目覆盖全局 key，数组替换非追加 | 与 Codex 和 Claude Code 一致。项目级设置完全覆盖全局同名 key，避免合并歧义 | 数组追加（权限规则可能需要追加，但当前所有数组 key 都适合替换语义） |
| 模型白名单为空 | 显示全部已配置模型 | Codex 行为。白名单为可选限制，不设限时不隐藏 | 空=隐藏全部（用户困惑，首次使用看不到任何模型） |

---

## 配置项映射（Claude Code / Codex → AttaSeek）

```typescript
const CLAUDE_TO_ATTASEEK: Record<string, string> = {
  theme: 'theme',
  model: 'modelConfigId',
  'permissions.defaultMode': 'permissionMode',
  alwaysThinkingEnabled: 'thinkingMode',       // boolean → 'enabled'|'disabled'
  fastMode: 'fastMode',                         // boolean → 'on'|'off'
  cleanupPeriodDays: 'session.cleanupPeriodDays',
  outputStyle: 'outputStyle',
  editorMode: 'editor.mode',
  language: '(passthrough)',                    // 保留但无对应 UI
  autoCompactEnabled: '(passthrough)',           // Agent Profile 已处理
}

const CODEX_TO_ATTASEEK: Record<string, string> = {
  model: 'modelConfigId',
  model_reasoning_effort: 'reasoningEffort',
  personality: 'personality',
  'sandbox_mode': 'sandbox.mode',              // read-only→read-only, workspace-write→workspace-write, danger-full-access→danger-full-access
  appearanceTheme: 'theme',
  developer_instructions: 'developerInstructions',
  'features.fast_mode': 'fastMode',
  'features.memories': '(Agent Profile autoExtract)',
  'desktop.conversationDetailMode': '(passthrough)',
  'desktop.ambient-suggestions-enabled': '(passthrough)',
}
```
