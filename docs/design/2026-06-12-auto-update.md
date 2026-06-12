# 软件自动升级 架构设计

**日期：** 2026-06-12
**基于需求：** [docs/reqs/2026-06-12-auto-update.md](../reqs/2026-06-12-auto-update.md)

## 组件结构

| 组件 | 操作 | 位置 | 职责 |
|------|------|------|------|
| `UpdateManager` | **新建** | `src/main/update/UpdateManager.ts` | 升级生命周期状态机：idle → checking → available → downloading → ready → installing。协调 source/verifier/installer，向 renderer 推送事件 |
| `UpdateSource` | **新建** | `src/main/update/UpdateSource.ts` | 双源策略抽象：`GitHubReleaseSource`（主）+ `AttaCloudSource`（回退），统一返回 `UpdateManifest` |
| `UpdateVerifier` | **新建** | `src/main/update/UpdateVerifier.ts` | 下载文件校验：SHA256 哈希 + 代码签名验证位（预留，当前 skip） |
| `UpdateInstaller` | **新建** | `src/main/update/UpdateInstaller.ts` | 平台自适应安装：macOS DMG 挂载+拷贝 / Windows NSIS 静默执行 / Linux AppImage 替换 |
| `updateIpc` | **新建** | `src/main/ipc/update.ts` | IPC handler 注册：`update:check` / `update:download` / `update:install` / `update:get-status` / `update:get-settings` / `update:set-settings` |
| `UpdateNotification` | **新建** | `src/renderer/components/UpdateNotification.tsx` | 升级状态横幅组件：通知新版本、下载进度条、安装倒计时、错误提示 |
| `UpdateSettings` | **新建** | `src/renderer/components/Settings/pages/UpdateSettings.tsx` | 设置页：渠道选择、自动下载开关、手动检查按钮、当前版本展示 |
| `UpdateSettings IPC` | **修改** | `src/preload/index.ts` | 暴露 `window.api.update.*` 类型化 API |
| `Settings router` | **修改** | `src/renderer/atoms/settingsAtom.ts` + `src/renderer/components/Settings/Settings.tsx` + `SettingsSidebar.tsx` | 注册 "Updates" 设置分区 |
| `Config types` | **修改** | `src/main/config/types.ts` + `src/main/config/defaults.ts` | 扩展 `UpdateConfig`（新增 `autoDownload`、`lastChecked`、`skippedVersion`） |
| `Shared types` | **新建** | `src/shared/types/update.ts` | `UpdateManifest`、`UpdateStatus`、`UpdateProgress`、`UpdateEvent` 共享类型 |
| `Bootstrap` | **修改** | `src/main/index.ts` | 注册 update IPC handlers，启动时触发首次静默检查 |

## 升级状态机

```
             check()
  ┌───┐    ───────►   ┌──────────┐
  │idle│              │checking  │
  └───┘    ◄───────   └──────────┘
   ▲       no_update       │
   │                       │update_available
   │                 ┌─────▼──────┐
   │     download()  │ available  │  skipVersion()
   │    ┌───────────►│            │────────────►  ┌───┐
   │    │            └────────────┘                │idle│
   │    │                  │ download()            └───┘
   │    │            ┌─────▼──────┐
   │    │            │downloading │◄──── resume()
   │    │            └─────┬──────┘
   │    │                  │ download_complete
   │    │            ┌─────▼──────┐
   │    │            │   ready    │
   │    │            └─────┬──────┘
   │    │                  │ install()
   │    │            ┌─────▼──────┐     ┌──────────┐
   │    └─error──────│installing  │────►│  error   │──► idle
   │                 └────────────┘     └──────────┘
   │                       │ success
   │                       ▼
   │                 (app restarts with new version)
   └────────────────────── (rollback on crash loop)
```

**所有状态转换**经 `UpdateManager.transition(from, to, data)` 统一入口，记录审计日志并推事件到 renderer。

## 数据流

### 主路径：后台静默检查 + 用户确认安装

```
[App 启动 / 定时器]
       │
       ▼
UpdateManager.check()
       │
       ├──► GitHubReleaseSource.fetch()
       │       ├─ 成功 → UpdateManifest
       │       └─ 失败 → AttaCloudSource.fetch()
       │                    ├─ 成功 → UpdateManifest
       │                    └─ 失败 → 状态回 idle（静默失败，不打扰用户）
       │
       ▼
semver 比较：manifest.version > currentVersion?
       ├─ 否 → idle（不通知）
       └─ 是 → 状态→available，推送事件到 renderer
                    │
                    ▼
              UpdateNotification  展示横幅
              (版本号 + changelog + [下载] [忽略此版本])
                    │
              [用户点击下载]
                    │
                    ▼
              UpdateManager.download()
                    │
              [stream download with progress]
                    │
                    ▼
              UpdateVerifier.verify()
                    ├─ 失败 → 重试(最多2次) → error
                    └─ 成功 → 状态→ready
                              │
                              ▼
                        UpdateNotification "就绪——重启以完成更新"
                              │
                        [用户点击重启]
                              │
                              ▼
                        UpdateInstaller.install()
                              │
                        app.quit() + 安装脚本 + app.relaunch()
```

### 并行路径：强制升级（critical urgency）

```
UpdateManager.check() → manifest.urgency === 'critical'
       │
       ▼
状态→downloading（自动开始，不可取消）
       │
       ▼
UpdateNotification "安全更新，X 分钟后自动安装" [推迟] [立即重启]
       │
       ├─ 超时 → install()
       └─ 推迟(最多3次) → 重新倒计时
```

### 错误路径

```
任意状态 ──(网络/校验/安装失败)──► error
                                    │
                          记录错误日志
                          推送错误事件到 renderer
                          UpdateNotification 显示错误 + [重试]
                          保留部分下载文件用于续传
                                    │
                          [重试] → 回到前一状态重试
                          [忽略] → idle
```

## IPC Contract

| Channel | 方向 | 请求类型 | 响应类型 | 说明 |
|---------|------|---------|---------|------|
| `update:check` | renderer→main | `void` | `{ success: boolean; manifest?: UpdateManifest; error?: string }` | 手动触发检查（设置页按钮） |
| `update:download` | renderer→main | `void` | `{ success: boolean; error?: string }` | 手动触发下载 |
| `update:install` | renderer→main | `void` | `{ success: boolean; error?: string }` | 触发安装并重启 |
| `update:skip-version` | renderer→main | `{ version: string }` | `{ success: boolean }` | 跳过此版本 |
| `update:get-status` | renderer→main | `void` | `{ status: UpdateStatus; progress?: UpdateProgress; manifest?: UpdateManifest; lastChecked?: number; error?: string }` | 查询当前升级状态 |
| `update:get-settings` | renderer→main | `void` | `{ channel: UpdateChannel; autoDownload: boolean; checkOnStartup: boolean }` | 查询升级设置 |
| `update:set-settings` | renderer→main | `{ channel?: UpdateChannel; autoDownload?: boolean; checkOnStartup?: boolean }` | `{ success: boolean }` | 修改升级设置 |
| `update:event` | main→renderer | (push) | `UpdateEvent` | 升级状态变更推送（renderer 通过 `ipcRenderer.on` 订阅） |

**类型定义**（`src/shared/types/update.ts`）：

```typescript
type UpdateChannel = 'stable' | 'beta' | 'nightly'
type UpdateUrgency = 'latest' | 'recommended' | 'critical'

interface UpdateManifest {
  version: string           // semver, e.g. "1.3.0"
  platform: string          // "darwin-arm64" | "win32-x64" | ...
  url: string               // download URL
  size: number              // bytes
  sha256: string            // hex-encoded SHA256
  signature?: string        // reserved, not yet enforced
  changelogUrl: string      // link to release notes
  publishedAt: number       // Unix ms
  urgency: UpdateUrgency
  minUpgradableVersion?: string  // null = any version can upgrade directly
}

interface UpdateStatus {
  state: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'installing' | 'error'
  manifest?: UpdateManifest
  progress?: UpdateProgress
  lastChecked?: number
  error?: string
  errorCode?: 'NETWORK' | 'VERIFY_FAILED' | 'INSTALL_FAILED' | 'UNKNOWN'
  canRetry: boolean
  retryCount: number
}

interface UpdateProgress {
  downloadedBytes: number
  totalBytes: number
  percent: number           // 0-100
  bytesPerSecond: number
  etaSeconds: number
}

type UpdateEvent =
  | { type: 'check-started' }
  | { type: 'update-available'; manifest: UpdateManifest }
  | { type: 'no-update' }
  | { type: 'download-started'; size: number }
  | { type: 'download-progress'; progress: UpdateProgress }
  | { type: 'download-complete' }
  | { type: 'ready-to-install'; manifest: UpdateManifest }
  | { type: 'install-started' }
  | { type: 'error'; message: string; code: string; canRetry: boolean }
```

## UpdateManager 核心接口

```typescript
// UpdateManager.ts — 单例，管理完整升级生命周期
interface IUpdateManager {
  getStatus(): UpdateStatus
  check(): Promise<void>              // 隐式：启动时静默调用
  download(): Promise<void>
  install(): Promise<void>
  skipVersion(version: string): void
  getSettings(): UpdateConfig
  updateSettings(patch: Partial<UpdateConfig>): Promise<void>
  onEvent(cb: (event: UpdateEvent) => void): () => void   // 返回 unsubscribe
  startPeriodicCheck(): void          // 启动定时检查（默认 4h）
  stopPeriodicCheck(): void
}
```

## UpdateSource 双源策略

```typescript
// UpdateSource.ts
interface IUpdateSource {
  fetch(currentVersion: string, platform: string, arch: string, channel: UpdateChannel): Promise<UpdateManifest | null>
}

class GitHubReleaseSource implements IUpdateSource {
  // GET https://api.github.com/repos/<owner>/<repo>/releases/latest
  // 或 GET https://api.github.com/repos/<owner>/<repo>/releases/tags/v{version}
  // 从 assets 中匹配 platform + arch 的安装包
  // 从 release body 或 asset label 提取 sha256
}

class AttaCloudSource implements IUpdateSource {
  // GET https://<cloud-host>/api/v1/update/check?version=X&platform=Y&arch=Z&channel=C
  // 返回 UpdateManifest JSON
  // 可选：带上已跳过的版本列表 (skippedVersions) 让服务端过滤
}
```

**回退逻辑**：`GitHubReleaseSource.fetch()` 失败（网络错误 / 404 / rate limit）→ 自动切换到 `AttaCloudSource.fetch()`。两者均失败 → 静默 `idle`（不通知用户，除非是手动触发检查）。

## AttaCloud 升级接口设计

```
GET /api/v1/update/check
  Query:
    version    string  当前版本号 semver
    platform   string  "darwin" | "win32" | "linux"
    arch       string  "x64" | "arm64"
    channel    string  "stable" | "beta" | "nightly"
  Response 200:
    {
      "version": "1.3.0",
      "url": "https://cdn.atta.example/releases/1.3.0/AttaSeek-1.3.0-arm64.dmg",
      "size": 157286400,
      "sha256": "a1b2c3...",
      "changelog_url": "https://atta.example/releases/1.3.0",
      "published_at": "2026-06-10T12:00:00Z",
      "urgency": "recommended",
      "min_upgradable_version": null
    }
  Response 204:
    (no update available)
  Response 503:
    { "error": "service unavailable" }
```

## 平台安装策略

| 平台 | 下载格式 | 安装方式 |
|------|---------|---------|
| macOS | `.dmg` | `hdiutil attach` 挂载 → 拷贝 `.app` 到 `/Applications` → `hdiutil detach` → `app.relaunch()` |
| macOS (备选) | `.zip` | 解压 `.app` → 替换 → relaunch |
| Windows | `.exe` (NSIS) | `spawn(installer, ['/S', '/D=...'])` 静默安装 → relaunch |
| Linux | `.AppImage` | 直接替换文件 → `chmod +x` → relaunch |
| Linux (备选) | `.deb` | `dpkg -i` 或提示用户手动安装 |

**macOS 关键细节**：
- 替换前检查 `/Applications/AttaSeek.app` 是否正在运行 → 是则等待 quit
- 挂载后验证 `.app` bundle 结构完整性
- 签名验证位：`codesign --verify --deep` (当前 skip，留 hook)

**Windows 关键细节**：
- NSIS 安装器以 `/S` 静默模式运行，覆盖安装
- 安装路径从当前进程路径推断
- 签名验证位：`Get-AuthenticodeSignature` (当前 skip，留 hook)

## 回滚机制

升级后启动崩溃检测：
- 记录每次启动时间戳到 `~/.atta/seek/boot_log.jsonl`
- 若 5 分钟内连续崩溃 ≥3 次 → 触发回滚
- 回滚逻辑：在 `versions/` 目录下保留上一个版本的备份（安装前备份）
- 回滚后将问题版本加入 `skippedVersions` 列表

```
安装前:
  cp -r /Applications/AttaSeek.app ~/.atta/seek/versions/v1.2.0/AttaSeek.app

启动崩溃检测:
  boot_log.jsonl 最近 3 条记录的 exit_code !== 0 且间隔 < 5min
  → cp -rf ~/.atta/seek/versions/v1.2.0/AttaSeek.app /Applications/AttaSeek.app
  → 通知用户
  → 标记 v1.3.0 为跳过
```

## Jotai Atoms

| Atom | 类型 | 作用范围 | 持久化 |
|------|------|---------|--------|
| `updateStatusAtom` | `UpdateStatus` | 全局 | 否（从 main 进程同步） |
| `updateChannelAtom` | `UpdateChannel` | 全局 | 是 (`attaseek-update-channel`) |
| `autoDownloadAtom` | `boolean` | 全局 | 是 (`attaseek-auto-download`) |
| `checkOnStartupAtom` | `boolean` | 全局 | 是 (`attaseek-check-startup`) |

## 文件布局（运行时）

```
~/.atta/seek/
├── settings.json             # 现有：全局设置（含 update 配置）
├── update_state.json         # 新增：升级状态持久化
├── downloads/                # 新增：下载缓存
│   └── AttaSeek-1.3.0-arm64.dmg.part   # 部分下载（支持续传）
├── versions/                 # 新增：历史版本备份（回滚用）
│   └── v1.2.0/
│       └── AttaSeek.app      # (macOS) 或 .exe (Windows) 或 .AppImage (Linux)
├── boot_log.jsonl            # 新增：启动记录（崩溃检测用）
└── telemetry.jsonl           # 现有：遥测（追加升级事件）
```

## 技术决策

| 决策 | 选择 | 理由 | 替代方案 |
|------|------|------|---------|
| 升级实现方式 | **自建 UpdateManager** | 需要双源策略（GitHub + Cloud）和自定义安装流程；`electron-updater` 绑定单 provider 且不支持双源回退 | `electron-updater`：成熟但不可扩展；`electron-builder autoUpdater`：仅支持 Squirrel |
| 下载方式 | **Node.js `https` 流式下载 + Range 续传** | 无需额外依赖，可精确控制进度事件和暂停/续传；Electron `net` 模块无 Range 支持 | Electron `downloadURL`：高层 API 但续传控制不足；`node-fetch`：额外依赖 |
| 状态管理 | **主进程状态机 + push 事件到 renderer** | 升级是进程级操作，状态必须在主进程集中管理；renderer 通过 atom 镜像只读 | 主进程 atom：Jotai 仅在 renderer 可用；renderer 驱动：安装阶段 renderer 可能已关闭 |
| 设置存储 | **扩展 `settings.json`（主进程 ConfigManager）** | 复用现有配置系统，避免分散存储；渠道选择等应在主进程侧生效 | 独立 `update.json`：附加复杂度无收益；仅 atomWithStorage：主进程无法读取 |
| 周期检查 | **`setInterval` 在主进程，对齐应用启动时刻** | 简单可靠；4 小时间隔 + 启动时立即检查。无需引入 `node-cron` | `node-cron`：对单一定时器过重；Chromium `alarms`：仅 ChromeOS |
| 平台安装 | **原生命令（hdiutil / NSIS / cp）** | 避免引入 Squirrel 框架的复杂度（需额外 server 端点、.nupkg 格式）。对标 VS Code 的全量替换策略 | Squirrel：需 Delta 更新 server 端点 + 自定义 .nupkg 打包；自建方案对全量下载更直接 |
| 崩溃检测 | **boot_log.jsonl 启动/退出打点** | 无外部依赖，进程级启停是最可靠的生命周期信号 | Crashpad/Sentry：需要网络上报，本地方案更可控；内部计数器：进程重启时丢失 |

## 下一步

→ `/atta-plan-and-execute`（标准：分步实施 + 独立检视） 或 `/atta-implement`（快捷：合并最后两步）
