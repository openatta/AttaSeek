# 插件市场云端接口 架构设计

**日期：** 2026-06-12
**基于需求：** `docs/reqs/2026-06-12-plugin-marketplace.md`

## 架构概览

```
┌──────────────────────────────────────────────────────┐
│                   AttaSeek Desktop                    │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │PluginMarket │  │ PluginLoader │  │PluginRegistr│ │
│  │ placeClient │──│  (existing)  │──│     y       │ │
│  │   (NEW)     │  └──────────────┘  └─────────────┘ │
│  └──────┬──────┘                                      │
│         │ HTTP/HTTPS                                  │
│         │ (fetch)                                     │
│         │ + SQLite cache                              │
└─────────┼────────────────────────────────────────────┘
          │
    ┌─────▼──────────────────────────────┐
    │     Plugin Marketplace Cloud        │
    │  ┌──────────────────────────────┐   │
    │  │  REST API Server             │   │
    │  │  (any backend stack)         │   │
    │  └──────────┬───────────────────┘   │
    │             │                       │
    │  ┌──────────▼──────────┐            │
    │  │  PostgreSQL / MySQL │            │
    │  │  (plugin metadata)  │            │
    │  └─────────────────────┘            │
    │  ┌──────────────────────┐           │
    │  │  S3 / R2 / OSS       │           │
    │  │  (plugin packages)   │           │
    │  └──────────────────────┘           │
    └─────────────────────────────────────┘
```

## 组件结构

```
src/main/
├── plugins/
│   ├── PluginMarketplaceClient.ts    # 新建 — HTTP 客户端，对接云端 API
│   ├── PluginCacheStore.ts           # 新建 — SQLite 缓存层（列表缓存 TTL 15min）
│   ├── PluginPackageInstaller.ts     # 新建 — 包下载、验证 (SHA256)、解压、安装
│   ├── PluginUpdateChecker.ts        # 新建 — 批量更新检查 + 增量更新逻辑
│   ├── PluginLoader.ts               # 修改 — 集成 marketplace 安装路径
│   └── PluginRegistry.ts             # 修改 — 区分 local/marketplace 来源
├── ipc/
│   └── plugin-marketplace.ts         # 新建 — plugin-marketplace:* IPC handler
└── store/
    └── schema.ts                     # 修改 — 新增 plugin_cache 表

src/shared/types/
└── Plugin.ts                         # 修改 — 补充 CloudPluginListing 等类型

src/preload/
└── index.ts                          # 修改 — 暴露 pluginMarketplace API

src/renderer/
├── components/Plugin/
│   ├── MarketplaceBrowser.tsx        # 新建 — 市场浏览视图
│   ├── PluginCard.tsx                # 新建 — 插件卡片组件
│   ├── PluginDetail.tsx              # 新建 — 插件详情面板
│   ├── InstalledPlugins.tsx          # 修改 — 现有已安装列表，加入更新徽标
│   └── MarketplaceOfflineBanner.tsx  # 新建 — 离线/降级提示
└── workspaces/
    └── PluginWorkspace.tsx           # 修改 — 集成 MarketplaceBrowser + InstalledPlugins 双标签
```

## 核心类型

```typescript
// ——— shared/types/Plugin.ts 新增 ———

/** 云端返回的插件列表项 */
export interface CloudPluginSummary {
  id: string
  name: string
  description: string
  author: { id: string; name: string; verified: boolean }
  tags: string[]
  category: PluginCategory
  latestVersion: string
  downloads: number
  avgRating: number
  updatedAt: string       // ISO 8601
  iconUrl?: string
  engines: { attaseek: string }
}

/** 插件详情（含所有版本） */
export interface CloudPluginDetail extends CloudPluginSummary {
  versions: CloudPluginVersion[]
  longDescription: string   // markdown
  changelog?: string
  repositoryUrl?: string
  license?: string
  createdAt: string
}

export interface CloudPluginVersion {
  version: string           // semver
  attaseekMinVersion: string
  downloadUrl: string       // 预签名 URL
  sha256: string
  size: number              // bytes
  releaseNotes: string      // markdown
  publishedAt: string
}

export type PluginCategory = 'tools' | 'skills' | 'agents' | 'renderers' | 'activities' | 'sidebars' | 'themes' | 'other'

export interface PluginSearchParams {
  query?: string
  category?: PluginCategory
  tags?: string[]
  sort?: 'downloads' | 'rating' | 'updated' | 'name'
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface PluginListResponse {
  plugins: CloudPluginSummary[]
  total: number
  page: number
  pageSize: number
}

export interface CheckUpdatesRequest {
  plugins: Array<{ id: string; version: string }>
}

export interface CheckUpdatesResponse {
  updates: Array<{
    id: string
    currentVersion: string
    latestVersion: string
    downloadUrl: string
    sha256: string
    size: number
  }>
}

/** 扩展 PluginManifest，增加安装来源标记 */
export interface PluginManifest {
  // ...existing fields...
  installSource?: 'local' | 'marketplace'  // NEW
  marketplaceId?: string                    // NEW — 云端插件 ID
  installedVersion?: string                  // NEW
}
```

## PluginMarketplaceClient（HTTP 客户端）

```typescript
// src/main/plugins/PluginMarketplaceClient.ts

class PluginMarketplaceClient {
  private baseUrl: string      // 从 config 读取，默认 https://marketplace.attaseek.io/api/v1
  private timeoutMs: number    // 5000
  private maxRetries: number   // 2

  /** 浏览插件列表。失败返回 null（降级为空市场）。 */
  async listPlugins(params: PluginSearchParams): Promise<PluginListResponse | null>

  /** 获取插件详情 */
  async getPlugin(id: string): Promise<CloudPluginDetail | null>

  /** 获取最新版本信息 */
  async getLatestVersion(id: string): Promise<CloudPluginVersion | null>

  /** 下载插件包到临时目录，验证 SHA256，返回本地路径 */
  async downloadPlugin(downloadUrl: string, expectedSha256: string, onProgress: (pct: number) => void): Promise<string>

  /** 批量检查更新 */
  async checkUpdates(req: CheckUpdatesRequest): Promise<CheckUpdatesResponse | null>

  /** 健康检查 — 探测云端是否可达 */
  async healthCheck(): Promise<boolean>
}
```

### 降级逻辑（每个方法内部）

```
try {
  const resp = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) })
  if (!resp.ok) {
    if (resp.status >= 500) return null   // 服务端故障 → 降级
    throw new Error(`HTTP ${resp.status}`)
  }
  return await resp.json()
} catch (err) {
  if (isNetworkError(err) || isTimeout(err)) {
    console.warn('[PluginMarketplace] unreachable, degrading to empty')
    return null
  }
  throw err  // 非预期错误（如 JSON 解析失败）仍上抛
}
```

## PluginCacheStore（缓存层）

```sql
-- SQLite 新增表
CREATE TABLE IF NOT EXISTS plugin_cache (
  cache_key   TEXT PRIMARY KEY,   -- e.g., "list:page=1&sort=downloads" or "detail:plugin-id"
  payload     TEXT NOT NULL,       -- JSON
  cached_at   INTEGER NOT NULL,   -- Unix ms
  ttl_ms      INTEGER NOT NULL    -- 默认 900000 (15 min)
);
```

- 列表查询：先读缓存（如果未过期）→ 渲染 → 异步刷新云端
- 详情查询：缓存 TTL 30 分钟（详情变化不频繁）
- 健康检查结果缓存 5 分钟（避免频繁探测）

## PluginPackageInstaller（安装器）

```
downloadPlugin(url, sha256, onProgress)
  → 下载到 <app-data>/plugins/tmp/<id>-<version>.tar.gz
  → 计算 SHA256，与 expectedSha256 比对
  → 不匹配 → 删除临时文件，throw Error
  → 解压到 <app-data>/plugins/installed/<id>/
  → 读取 plugin.json → 校验 manifest 结构
  → 验证 engines.attaseek 兼容性
  → 调用 pluginRegistry.register(manifest)
  → 安装依赖（如 plugin.json 声明了 npm 依赖）
  → 移动临时文件到正式目录
```

### 插件目录布局（本地磁盘）

```
<app-data>/plugins/
├── installed/               # 已安装插件
│   ├── <plugin-id>-<ver>/   # 按 id-version 命名
│   │   ├── plugin.json
│   │   ├── main/
│   │   ├── renderer/
│   │   └── assets/
│   └── ...
├── tmp/                     # 下载临时目录
├── marketplace-cache.db     # SQLite 缓存（或合并到主 DB）
└── manifest.lock            # 锁定已安装的包与版本
```

## PluginUpdateChecker（更新检查）

```typescript
class PluginUpdateChecker {
  /** 检查所有已安装 marketplace 插件的更新 */
  async checkAll(): Promise<CheckUpdatesResponse> {
    const installed = pluginRegistry.listMarketplace()  // 只查来源为 marketplace 的
    if (installed.length === 0) return { updates: [] }

    const req: CheckUpdatesRequest = {
      plugins: installed.map(p => ({ id: p.marketplaceId!, version: p.installedVersion! }))
    }
    return await marketplaceClient.checkUpdates(req) ?? { updates: [] }
  }
}
```

- 启动时自动检查（可配置关闭）
- 定时检查（每 24 小时）
- 手动触发（设置页 "检查更新" 按钮）
- 结果缓存在内存中，UI 展示更新徽标

## IPC 通道

```typescript
// src/main/ipc/plugin-marketplace.ts

handle('plugin-marketplace:list', async (_, params: PluginSearchParams) => ...)
handle('plugin-marketplace:get', async (_, id: string) => ...)
handle('plugin-marketplace:install', async (_, id: string, version?: string) => ...)
handle('plugin-marketplace:uninstall', async (_, id: string) => ...)
handle('plugin-marketplace:check-updates', async () => ...)
handle('plugin-marketplace:health', async () => ...)
handle('plugin-marketplace:download-progress', (event) => ...)  // 主→渲染进度推送
```

## 前端组件设计

### MarketplaceBrowser

```
┌─────────────────────────────────────────────┐
│ [搜索框]  [分类▼]  [排序▼]   [刷新]         │
├─────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ │ Plugin A │ │ Plugin B │ │ Plugin C │     │
│ │ desc...  │ │ desc...  │ │ desc...  │     │
│ │ ★4.5 1K │ │ ★4.2 500│ │ ★4.8 2K │     │
│ │ [安装]   │ │ [已安装] │ │ [安装]   │     │
│ └──────────┘ └──────────┘ └──────────┘     │
│                                              │
│              < 1 2 3 ... 10 >               │
└─────────────────────────────────────────────┘
```

降级状态：整个网格替换为居中空状态：
```
┌──────────────────────────────────┐
│        [离线图标]                 │
│   插件市场暂不可用                │
│   请检查网络连接后重试            │
│        [重试]                    │
└──────────────────────────────────┘
```

### InstalledPlugins（修改现有）

在现有已安装列表基础上增加：
- 来源徽标（`local` / `marketplace`）
- 更新可用提示：`[更新到 v1.2.0]` 按钮
- "全部更新"操作

## 云端 API 详细设计

### GET /api/v1/plugins

```
Query params:
  search?    string   关键词搜索（名称 + 描述）
  category?  string   分类筛选
  tags?      string   逗号分隔的标签筛选
  sort?      string   downloads | rating | updated | name (default: downloads)
  order?     string   asc | desc (default: desc)
  page?      number   default 1
  pageSize?  number   default 20, max 100

Response 200:
{
  "plugins": [CloudPluginSummary, ...],
  "total": 156,
  "page": 1,
  "pageSize": 20
}
```

### GET /api/v1/plugins/:id

```
Response 200: CloudPluginDetail
Response 404: { "error": "plugin_not_found" }
```

### GET /api/v1/plugins/:id/versions/latest

```
Response 200: CloudPluginVersion
Response 404: { "error": "no_versions" }
```

### GET /api/v1/plugins/:id/download/:version

```
Response 200: binary/octet-stream (tar.gz)
Headers:
  Content-Disposition: attachment; filename="plugin-id-1.0.0.attaseek-plugin"
  Content-Length: <bytes>
  Content-Type: application/gzip
  X-Checksum-SHA256: <sha256>
Response 302: redirect to S3 pre-signed URL
```

### POST /api/v1/plugins/check-updates

```
Body: { "plugins": [{ "id": "...", "version": "1.0.0" }, ...] }
Response 200: { "updates": [{ "id": "...", "currentVersion": "1.0.0", "latestVersion": "1.1.0", ... }] }
```

### 认证相关（v2 — 插件发布）

```
POST   /api/v1/developers/register    注册开发者
POST   /api/v1/developers/login       获取 API Key
POST   /api/v1/plugins (需要 Authorization: Bearer <token>)
PUT    /api/v1/plugins/:id (需要认证 + 所有权)
POST   /api/v1/plugins/:id/versions (需要认证)
```

## 启动序列集成

```
App 启动
  → PluginLoader.boot()       # 加载本地内置 + 已安装插件（同步，不阻塞）
  → PluginMarketplaceClient.healthCheck()    # 异步，不阻塞
    → 可达 → PluginCacheStore 预热缓存
    → 不可达 → 设置 marketAvailable = false
  → PluginUpdateChecker.checkAll()           # 异步，不阻塞
    → 有更新 → 渲染进程收到通知
```

## 配置

```typescript
// src/main/config/types.ts 新增
export interface PluginMarketplaceConfig {
  enabled: boolean                      // 是否启用市场（默认 true）
  apiBaseUrl: string                    // 默认 https://marketplace.attaseek.io/api/v1
  cacheListTtlMs: number                // 列表缓存 TTL，默认 900000 (15min)
  cacheDetailTtlMs: number             // 详情缓存 TTL，默认 1800000 (30min)
  autoCheckUpdates: boolean            // 自动检查更新，默认 true
  checkUpdatesIntervalMs: number       // 更新检查间隔，默认 86400000 (24h)
  downloadTimeoutMs: number            // 下载超时，默认 300000 (5min)
  maxConcurrentDownloads: number       // 最大并发下载，默认 2
}
```
