# 对话系统 架构设计

**日期：** 2026-06-07
**基于需求：** `docs/reqs/2026-06-07-chat-system-alignment.md`

---

## 澄清结论

| 问题 | 结论 |
|------|------|
| 会话分组 | 按 Activity 分组（Chat / Projects / Search），每次新对话创建新 Session |
| 项目会话存储 | 项目级会话存 `<project>/.atta/seek/sessions/`，非项目会话（home/settings/search）存全局 |
| 归档策略 | 闲置超过 30 天自动归档到 `sessions/archive/`，保留 JSON 但移出索引 |
| 加密 | 不加密，明文 JSONL |

---

## 组件结构

```
src/main/store/
└── SessionStore.ts                  [新建] 会话 JSON + JSONL + 索引管理（替代 SQLite sessions 表）

src/main/ipc/
└── session.ts                       [修改] IPC handler 改为调用 SessionStore

src/renderer/components/Sidebar/
├── ChatsList.tsx                    [重写] 分组显示 + 搜索 + 右键菜单 + 重命名
└── SessionContextMenu.tsx           [新建] 右键菜单组件

src/renderer/atoms/
├── sessionAtom.ts                   [修改] 统一配置 atom 源，移除与 settingsAtom 重复的 atom
├── settingsAtom.ts                  [不变] 已有 permissionMode 等
└── composerSettingsAtom.ts          [删除] 合并到 settingsAtom

src/renderer/components/Conversation/
└── Composer.tsx                     [修改] 从 settingsAtom 读取权限/推理配置

~/.atta/seek/sessions/              会话数据目录
├── _index.json                     全局索引
├── _index.project.json             项目索引（每个项目一个）
├── {session-id}.json               会话元数据
├── {session-id}.jsonl              会话事件流
└── archive/                        归档目录
    └── {session-id}.json           归档的会话元数据
```

---

## 数据流

### 会话创建与事件追加

```
用户在 Composer 输入消息 → 发送
  │
  ├─ sessionAtom.ensureSession(activity)
  │     ├─ 生成 sessionId = BASE58 短 ID
  │     ├─ 写入 sessions/{id}.json: { id, title:"New Session", activity, createdAt, updatedAt }
  │     └─ 更新 _index.json: 追加条目
  │
  ├─ Agent 执行 → AgentEventBus.emit(event)
  │     └─ IPC session handler 监听 → 追加到 sessions/{id}.jsonl
  │
  └─ Agent 完成 → autoTitle() → SessionTitleGenerated
        ├─ 更新 sessions/{id}.json: title = newTitle
        ├─ 更新 _index.json: 更新 title
        └─ IPC → renderer: session:updated
```

### 会话加载（ChatsList）

```
ChatsList mount:
  │
  ├─ IPC: session:list { activity?: string }
  │     └─ SessionStore.list(activity?):
  │           ├─ 读取 _index.json → 过滤 activity → 按 updatedAt 降序
  │           └─ 返回 SessionInfo[]
  │
  ├─ 按 activity 分组:
  │     Chat Sessions:
  │       ├─ "Project Architecture Review"   2h ago
  │       └─ "Bug Fix: Login Flow"           yesterday
  │     Search Sessions:
  │       └─ "Find all TypeScript files"     3d ago
  │
  └─ 搜索过滤: 本地 string.includes (不区分大小写)
```

### 项目会话存储

```
用户"打开目录" → ProjectManager.open(path)
  │
  ├─ 项目 session 路径: <project>/.atta/seek/sessions/
  │     ├─ _index.json       (仅该项目)
  │     ├─ {id}.json
  │     └─ {id}.jsonl
  │
  └─ sessionAtom 检测 projectId:
        有 → 写入项目 sessions/
        无 → 写入全局 ~/.atta/seek/sessions/
```

### 归档流程

```
SessionStore.cleanup():  // 启动时调用 + 每 24h 定时
  │
  ├─ 遍历 _index.json 中所有会话
  ├─ 检查 updatedAt < Date.now() - 30天
  │     ├─ 移动 {id}.json → sessions/archive/{id}.json
  │     ├─ 保留 {id}.jsonl（事件不归档，节省空间）
  │     └─ 从 _index.json 移除此条目
  │
  └─ 归档后的会话不在 ChatsList 中显示
      可通过 "Show Archived" 开关查看（仅查看标题，不可恢复交互）
```

---

## IPC Contract

| Channel | 方向 | 请求 | 响应 | 说明 |
|---------|------|------|------|------|
| `session:list` | renderer→main | `{ activity?: string }` | `{ sessions: SessionInfo[] }` | 已有，改为读 JSON |
| `session:create` | renderer→main | `{ title, activity, id }` | `{ session: SessionInfo }` | 已有 |
| `session:get` | renderer→main | `{ id }` | `{ session: SessionInfo \| null }` | 已有 |
| `session:update` | renderer→main | `{ id, title }` | `{ session: SessionInfo }` | [修改] 新增 title 更新 |
| `session:delete` | renderer→main | `{ id }` | `{ success }` | 已有，改为删 JSON+JSONL |
| `session:updated` | main→renderer | — | `{ id, title? }` | [新建] 标题更新推送 |

---

## Jotai Atoms

| Atom | 变更 | 说明 |
|------|------|------|
| `composerSettingsAtom` (permissionModeAtom, reasoningEffortAtom) | **删除** | 合并到 settingsAtom |
| `permissionModeAtom` (settingsAtom) | 已有 | Composer 和 Settings 共用 |
| `reasoningEffortAtom` (settingsAtom) | 已有 | Composer 和 Settings 共用 |
| `sessionTitleAtom` | 不变 | 已有 |
| `_sessionTitleAtom` | 不变 | 已有 |
| `currentSessionIdAtom` | 不变 | 已有 |

---

## 技术决策

| 决策 | 选择 | 理由 | 替代方案 |
|------|------|------|---------|
| 会话存储格式 | JSON 元数据 + JSONL 事件流 | Claude Code + Codex 同模式。JSONL 流式追加高效，逐行解析内存友好 | SQLite（违背明文优先）；单 JSON 数组（大文件解析需全量加载） |
| 项目会话隔离 | 项目会话存 `.atta/seek/sessions/`，全局会话存 `~/.atta/seek/sessions/` | 项目数据跟随项目目录，便于 Git 管理或整体迁移 | 全部存全局（项目切换后找不到历史）；全部存项目（home/settings 无归属） |
| 归档策略 | 闲置 30 天 → 移入 `archive/`，保留 JSON 丢弃 JSONL | JSON 仅几十字节，JSONL 可能数 MB。归档会话不可恢复交互 | 永久保留（磁盘膨胀）；直接删除（用户可能想查看历史标题） |
| 索引文件 | `_index.json`（数组，启动时全量加载） | 会话数量通常 <1000，全量加载 <100KB。启动时一次读取，后续内存操作 | 无索引文件（每次遍历目录，O(n) readdir） |
| 搜索 | 本地过滤，不发起 IPC | 会话列表已全量加载到 renderer。搜索只是数组 filter，无需额外请求 | IPC 搜索（每次按键触发往返，延迟明显） |
| 配置统一 | 删除 `composerSettingsAtom`，Composer 直接读 `settingsAtom` | 避免两个 atom 存储同一配置项导致不同步 | 保留两套（当前问题 — 设置页改了，Composer 不生效） |
