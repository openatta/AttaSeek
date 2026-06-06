# 对话系统对齐 — Claude Code / Codex Desktop 需求规格

**目标：** 将对话（Chat）系统的存储、展示和交互对齐 Claude Code 和 Codex Desktop 的模式。会话和会话事件使用明文 JSONL 文件存储（不使用 SQLite），会话列表支持完整的生命周期管理（查看、搜索、重命名、删除），Agent 交互区与控制区配置保持同步。

**背景：** Claude Code 和 Codex Desktop 的会话存储均使用明文 JSONL 文件（`history.jsonl` + `sessions/` 目录），不使用 SQLite。AttaSeek 当前使用 SQLite `sessions` 表 + `session_events` 表存储会话数据，与存储层 V3 的"明文优先"原则不一致。同时 Chat 侧边栏和 Agent 交互区存在多项未连线或不同步的问题。

---

## 范围

### In scope

**1. 会话存储格式对齐**

- 会话元数据存储在 `sessions/*.json`（每个会话一个文件）：`{ id, title, activity, createdAt, updatedAt }`
- 会话事件存储在 `sessions/{session-id}.jsonl`（JSONL 格式，每行一个 SessionEvent JSON）：流式追加写入，逐行读取
- 全局会话索引存储在 `sessions/_index.json`：`[{ id, title, activity, createdAt, updatedAt }]`，加速列表查询
- 不再使用 SQLite `sessions` 表和 `session_events` 表存储新数据
- 对齐 Claude Code 的 `history.jsonl` 和 Codex Desktop 的 `history.jsonl` + `sessions/` 模式

**2. 会话生命周期管理**

- **创建：** 用户首次在某个 Activity 中输入消息时自动创建会话（当前行为保留），标题初始为 "New Session"
- **自动标题：** Agent 完成任务后，调用 LLM 生成 3-5 个单词的会话标题（已有 `autoTitle()` 逻辑），标题更新后存储到会话 JSON 文件 + 通知渲染进程刷新
- **重命名：** 用户在侧边栏双击会话标题或右键菜单选择"重命名"，直接编辑标题
- **删除：** 用户在侧边栏右键菜单选择"删除"，删除会话 JSON 文件 + JSONL 事件文件 + 从索引中移除
- **搜索：** 侧边栏搜索框输入文字后，实时过滤会话列表（按标题模糊匹配），本地过滤无需 IPC
- **列表排序：** 按 `updatedAt` 降序排列，最近活跃的会话在顶部
- **活动分组：** 会话按 Activity 分组显示（Chat / Projects / Search 等），或使用标签标识活动类型

**3. Agent 交互配置同步**

- Composer 中的权限模式和推理力度设置与 Settings 页面中的配置使用同一个数据源（`settings.json` → IPC → 单一 atom）
- 用户在 Settings 中修改权限/推理配置后，Composer 中实时生效（反之亦然）
- 移除 `composerSettingsAtom` 中与 `settingsAtom` 重复的 atom，统一到 `settingsAtom`

**4. 会话标题实时更新**

- Agent 完成后发送 `SessionTitleGenerated` 事件 → 主进程更新会话 JSON 文件 → IPC 通知渲染进程 → `_sessionTitleAtom` 更新 → SessionHeader 显示新标题 → ChatsList 重新加载显示新标题
- 当前 `ChatsList` 的 5 秒轮询改为事件驱动更新（仅在收到 `SessionTitleGenerated` 或 `session:created` / `session:deleted` 时刷新）

**5. 会话右键菜单**

- 右键点击会话项弹出上下文菜单：重命名、删除、复制会话 ID
- 快捷键支持：Delete 键删除选中会话，Enter 键重命名

### Out of scope

- 会话云端同步
- 会话导出为 Markdown/PDF
- 会话归档（`archived_sessions/` — Codex 有，AttaSeek 可后续实现）
- 会话间消息复制/移动

### 前置依赖

- 存储层 V3 的 `FileStore`（JSONStore、JSONLStore）已就绪
- `AgentEventBus` 事件系统已就绪
- `ThirdPartyImporter` 已有 Claude Code 导入逻辑
- Settings 页面已重构为 8 个功能页面

---

## 用户场景

### 场景 1: 正常对话 — 从创建到自动标题

- **给定:** 用户切换到 Chat Activity
- **当:** 用户在 Composer 中输入 "帮我分析这个项目的架构" 并发送
- **则:**
  1. 系统自动创建会话（如当前没有会话），标题初始为 "New Session"
  2. 会话 JSON 文件写入 `~/.atta/seek/sessions/{session-id}.json`
  3. 会话事件流式追加到 `sessions/{session-id}.jsonl`
  4. Agent 完成任务后，自动生成标题 "Project Architecture Analysis"
  5. 会话 JSON 文件更新 `title` 字段
  6. IPC 通知渲染进程：`session:updated` { id, title }
  7. SessionHeader 实时显示新标题
  8. ChatsList 更新列表显示新标题

### 场景 2: 侧边栏管理 — 重命名和删除

- **给定:** ChatsList 显示 3 个历史会话
- **当:** 用户右键点击第二个会话，选择"重命名"
- **则:**
  1. 会话标题变为可编辑输入框，预填当前标题
  2. 用户输入新标题 "Q3 Performance Review Notes"
  3. 按 Enter 确认 → 会话 JSON 文件更新 → 列表刷新
  4. 按 Escape 取消 → 恢复原标题

- **当:** 用户右键点击第三个会话，选择"删除"
- **则:**
  1. 弹出确认对话框："确定删除此会话？会话事件将永久丢失。"
  2. 用户确认 → 删除 `sessions/{id}.json` + `sessions/{id}.jsonl` → 从索引移除 → 列表刷新

### 场景 3: 搜索会话

- **给定:** ChatsList 显示 15 个历史会话
- **当:** 用户在搜索框中输入 "architecture"
- **则:**
  1. 实时过滤：仅显示标题包含 "architecture" 的会话（本地过滤，无需 IPC）
  2. 输入框清空后恢复显示全部会话
  3. 搜索不区分大小写

### 场景 4: 配置同步

- **给定:** 用户在 Settings → Agent 中将 Permission Mode 从 "Default Review" 改为 "Full Trust"
- **当:** 用户返回 Chat Activity
- **则:**
  1. Composer 底部的权限模式指示器显示 "Full Trust"（不再是 "Default Review"）
  2. 下一次 Agent 执行时使用 "trust" 权限模式

### 场景 5: 异常 — 会话文件被外部删除

- **给定:** 用户用文件管理器删除了 `sessions/{id}.json`
- **当:** ChatsList 加载会话列表
- **则:**
  1. 索引文件 `_index.json` 中仍存在该条目
  2. 尝试读取 JSON 文件 → 文件不存在 → 从索引中自动移除 → 列表不显示已删除会话
  3. JSONL 事件文件如仍存在，保留（用户可手动恢复）

---

## 待澄清

- [ ] 会话分组策略：按 Activity 分组（Chat/Projects/Search）还是仅用标签？Claude Code 不分组，Codex 按项目分组
- [ ] 会话自动清理：闲置超过 N 天的会话是否自动归档或删除？
- [ ] 会话数据是否需要加密？（当前会话事件可能包含敏感代码和对话内容）

---

## 风险

- **JSONL 大文件性能** — 长会话（数千事件）的 JSONL 文件可能达到数 MB。逐行读取需要分页或流式读取策略，避免一次性加载全文件到内存
- **索引文件与磁盘不一致** — `_index.json` 可能与实际文件系统状态不同步（并发写入、外部删除）。需要定期自愈：扫描 `sessions/` 目录重建索引
- **会话迁移** — 现有 SQLite 中的 13 条会话数据（和 session_events 历史数据）需要迁移到 JSONL 格式。`DataMigrator` 已有框架，需要添加会话迁移逻辑
- **标题生成 LLM 成本** — 每次任务完成调用 LLM 生成标题，增加 token 消耗。可考虑仅在前 N 次任务中启用（如首次 50 个会话），之后手动设置
