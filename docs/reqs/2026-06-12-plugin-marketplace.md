# 插件市场云端接口 需求规格

**目标：** 为 AttaSeek 提供云端插件市场，支持浏览、搜索、安装、发布插件。连接不到云端时插件市场显示为空，不阻塞应用。
**背景：** 当前插件系统仅支持本地 TypeScript manifest 包（MVP 阶段），PluginLoader 同步加载内置 pack。PluginManifest 和 PluginMarketplace 接口已在 `shared/types/Plugin.ts` 预留，需要定义云端 API 契约并实现前端对接。

## 范围

- In scope:
  - **插件浏览**：分页列表、按分类/标签筛选、关键词搜索、按下载量/评分/更新时间排序
  - **插件详情**：名称、描述、版本、作者、下载量、评分、兼容性（engines.attaseek 版本约束）、依赖
  - **插件下载**：下载 `.attaseek-plugin` 包文件（tar.gz），支持断点续传
  - **插件安装**：验证包完整性（SHA256）→ 解压到本地插件目录 → 注册到 PluginRegistry
  - **插件更新**：检测已安装插件的新版本，一键升级
  - **插件发布**（v2）：开发者认证 → 上传包 → 审核流程
  - **匿名访问**：浏览和搜索无需登录；安装也无需登录
  - **降级策略**：云端不可达（网络错误 / 超时 / 5xx）→ 市场页面显示"插件市场暂不可用"，本地已安装插件正常工作
  - **缓存策略**：列表缓存 15 分钟（本地 SQLite），减少网络请求
- Out of scope:
  - 付费插件 / 许可管理
  - 插件评分/评论系统（v3）
  - 插件依赖自动解析安装
  - 私有/企业插件仓库
  - 插件市场网页版管理后台
- 前置依赖:
  - 云端服务部署（REST API + 包存储）
  - 包存储方案（S3 / Cloudflare R2）
  - 开发者认证体系（API Key / OAuth）

## 用户场景

### 场景 1：浏览并安装插件
1. 用户打开插件工作区（PluginWorkspace）
2. 系统尝试 `GET /api/v1/plugins?page=1&pageSize=20&sort=downloads`
3. 成功：展示市场插件列表（名称、描述、下载量、评分）；失败：静默降级，显示"市场暂不可用"
4. 用户搜索"terminal" → `GET /api/v1/plugins?search=terminal`
5. 用户点击某插件 → `GET /api/v1/plugins/:id` 查看详情
6. 用户点击"安装" → `GET /api/v1/plugins/:id/versions/latest` 获取下载 URL → 下载 → SHA256 验证 → 解压 → 注册
7. 安装完成后该插件出现在"已安装"列表，立即可用

### 场景 2：更新已安装插件
1. 系统在"已安装"列表对每个插件调 `GET /api/v1/plugins/:id/versions/latest`
2. 有新版本时显示"更新可用"徽标
3. 用户点击"全部更新"或逐个更新
4. 下载新版本包 → 停用旧版 → 安装新版 → 激活

### 场景 3：离线/断网
1. 网络不可用或 API 返回超时
2. 市场页面顶部显示 banner："无法连接插件市场，请检查网络连接"
3. "已安装"标签页正常工作（数据来自本地 PluginRegistry）
4. "浏览"标签页显示空状态插图 + 重试按钮

## API 契约（高层）

| 端点 | 方法 | 认证 | 用途 |
|------|------|------|------|
| `/plugins` | GET | 否 | 分页浏览/搜索插件 |
| `/plugins/:id` | GET | 否 | 获取插件详情 |
| `/plugins/:id/versions` | GET | 否 | 获取版本列表 |
| `/plugins/:id/versions/latest` | GET | 否 | 获取最新版本信息和下载 URL |
| `/plugins/:id/download/:version` | GET | 否 | 下载插件包（二进制流） |
| `/plugins/check-updates` | POST | 否 | 批量检查更新（body: `[{id, version}]`） |
| `/plugins` | POST | 是 | 发布插件 |
| `/plugins/:id` | PUT | 是 | 更新插件元信息 |
| `/plugins/:id/versions` | POST | 是 | 上传新版本 |

### 降级策略

```
Client → GET /plugins
    ├─ 200 OK → 渲染列表，缓存到本地 SQLite (TTL 15min)
    ├─ 网络错误 → 显示空状态 "插件市场暂不可用" + [重试]
    ├─ 超时 (5s) → 同上
    └─ 5xx → 同上
```

- 本地缓存作为快速展示层：先展示缓存（如有），再异步刷新
- 安装流程中下载失败 → 报错但不影响已安装插件
- 所有云端操作均为**非阻塞**，UI 不卡在 loading

## 插件包格式

```
plugin-name.attaseek-plugin (tar.gz)
├── plugin.json          # PluginManifest（与 shared/types/Plugin.ts 一致）
├── package.json         # 可选，npm 依赖声明
├── main/                # 主进程代码
│   ├── index.ts         # 入口
│   ├── tools.ts         # 工具实现
│   ├── skills.ts        # 技能实现
│   └── hooks.ts         # 钩子实现
├── renderer/            # 渲染进程代码
│   ├── index.tsx        # 入口
│   ├── views.tsx        # UI 视图
│   └── settings.tsx     # 设置页面
├── assets/              # 图标等静态资源
└── checksum.txt         # SHA256 校验和
```

## 数据模型（云端视角）

```typescript
interface CloudPlugin {
  id: string              // 与 manifest.id 一致
  name: string
  description: string
  author: {
    id: string
    name: string
    verified: boolean
  }
  tags: string[]          // ["terminal", "git", "productivity"]
  category: PluginCategory
  latestVersion: string
  downloads: number
  avgRating: number
  ratingCount: number
  updatedAt: string       // ISO 8601
  createdAt: string
  iconUrl?: string
  repositoryUrl?: string
  license?: string
  engines: {              // 兼容性矩阵
    attaseek: string      // semver 范围，如 ">=1.0.0"
  }
}

type PluginCategory = 'tools' | 'skills' | 'agents' | 'renderers' | 'activities' | 'sidebars' | 'themes' | 'other'
```

## 非功能需求

- 响应时间：列表接口 P95 < 500ms，搜索接口 P95 < 800ms
- 下载带宽：单文件最大 50MB，支持 Range 断点续传
- 可用性：99.5% uptime（非关键路径，降级策略兜底）
- 安全：上传包需通过病毒扫描（如 ClamAV）+ 内容审查；SHA256 校验和必须与服务器记录一致
- 速率限制：未认证用户 60 req/min，已认证发布者 300 req/min
