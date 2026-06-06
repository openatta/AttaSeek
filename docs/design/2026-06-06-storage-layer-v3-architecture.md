# 存储层 V3 — 明文优先 + 项目隔离 + 三方导入 架构设计

**日期：** 2026-06-06
**基于需求：** `docs/reqs/2026-06-06-storage-layer-v3.md`

---

## 组件结构

```
src/main/store/
├── db.ts                            [修改] DB 路径 → ~/.atta/seek/attaseek.db，仅保留 3 表
├── schema.ts                        [修改] 删除 memories/sessions/skills 表 DDL
├── settings.ts                       [新建] settings.json 读写 + mtime 缓存
├── credentials.ts                    [新建] ~/.atta/seek/credentials 加密存储
├── DataStore.ts                      [新建] 统一数据访问层（明文优先，SQLite 辅助）
├── FileStore.ts                      [新建] 泛型文件存储基类（Markdown/JSON/JSONL）
├── ProjectManager.ts                 [新建] 项目 .atta/seek/ 生命周期
└── ThirdPartyImporter.ts             [新建] Claude Code/Codex 配置导入

src/main/agent/memory/
└── FileMemory.ts                     [修改] 适配新路径 ~/.atta/seek/memories/ + 项目 memories/

src/main/agent/skills/
└── SkillLoader.ts                    [修改] 适配新路径 + 两级加载（全局→项目覆盖）
```

### 模块职责

| 模块 | 状态 | 职责 |
|------|------|------|
| `store/settings` | 新建 | `~/.atta/seek/settings.json` 读写。mtime 缓存 + 变更检测重载。提供 `get(key)` / `set(key, value)` / `getAll()`。 |
| `store/credentials` | 新建 | `~/.atta/seek/credentials` 加密存储。复用现有 `secrets.ts` 的 safeStorage 逻辑，改为写入文件而非 Keychain。 |
| `store/FileStore` | 新建 | 泛型文件存储基类。支持三种格式：`MarkdownStore`（.md + frontmatter）、`JSONStore`（.json）、`JSONLStore`（.jsonl 流式追加）。 |
| `store/DataStore` | 新建 | 统一数据访问层。根据数据类型路由到正确的存储：memories→MarkdownStore、sessions→JSONLStore、settings→JSONStore、audit/token/permission→SQLite。 |
| `store/ProjectManager` | 新建 | 项目生命周期：`open(path)` 创建/打开 `.atta/seek/`、`close()` 清理、`listRecent()` 最近项目列表（存 ~/.atta/seek/projects.json）。 |
| `store/ThirdPartyImporter` | 新建 | 三方配置导入。`importFromClaudeCode()` / `importFromCodexDesktop()`。mtime 比较 + 去冗 + 映射规则。开关由 settings.json 的 `importFromClaudeCode` / `importFromCodexDesktop` 控制。 |
| `store/db` | 修改 | 仅保留 3 表 DDL（audit_logs, token_usage, permission_policies）。路径改为 `~/.atta/seek/attaseek.db`。 |
| `store/schema` | 修改 | 删除 session_events、memory_entries、sessions、model_configs 表的 DDL。 |
| `memory/FileMemory` | 修改 | 写入路径从 DB → `.atta/seek/memories/*.md`。读取优先加载项目 memories → 回退全局 memories → 回退 SQLite 历史迁移。 |
| `skills/SkillLoader` | 修改 | 加载路径：项目 `.atta/seek/skills/` → 全局 `~/.atta/seek/skills/`。同名 skill 项目覆盖全局。 |

---

## 数据流

### 写入路径

```
Agent 完成 → 数据写入
    │
    ├─ 记忆:  DataStore.writeMemory(entry)
    │          → FileStore.MarkdownStore.write('~/.atta/seek/memories/{name}.md', content)
    │          → 不写 SQLite（明文与 DB 不交叉）
    │
    ├─ 会话:  DataStore.appendSessionEvent(event)
    │          → FileStore.JSONLStore.append('~/.atta/seek/sessions/{id}.jsonl', event)
    │          → 不写 SQLite
    │
    ├─ 设置:  DataStore.setSetting(key, value)
    │          → FileStore.JSONStore.write('~/.atta/seek/settings.json', data)
    │          → 不写 SQLite
    │
    ├─ 审计:  DataStore.writeAudit(log)
    │          → SQLite INSERT INTO audit_logs
    │          → 不写明文
    │
    └─ Token: DataStore.recordUsage(usage)
               → SQLite INSERT INTO token_usage
               → 不写明文
```

### 读取路径

```
Agent 上下文组装 → 数据读取
    │
    ├─ 记忆:  DataStore.readMemories(scope, query)
    │          → 优先: FileStore 遍历 ~/.atta/seek/memories/ + 项目 .atta/seek/memories/
    │          → 回退: SQLite SELECT（历史迁移数据，只读）
    │
    ├─ 设置:  DataStore.getSetting(key)
    │          → FileStore 读取 settings.json（带 mtime 缓存）
    │          → 项目 settings 覆盖全局 settings
    │
    └─ 会话:  DataStore.readSessionEvents(sessionId)
               → FileStore 流式读取 JSONL
```

### 项目生命周期

```
用户"打开目录" → ProjectManager.open(path)
    │
    ├─ 检查 path/.atta/seek/ 是否存在
    │     ├─ 不存在: mkdir 创建完整结构
    │     │    ├─ settings.json (from template)
    │     │    ├─ memories/
    │     │    ├─ skills/
    │     │    └─ sessions/
    │     └─ 存在: 加载已有数据
    │
    ├─ 加载项目 CLAUDE.md（如存在）
    ├─ 加载项目 skills/（覆盖全局同名）
    ├─ 加载项目 memories/（优先召回）
    └─ 注册项目到 ~/.atta/seek/projects.json（最近项目列表）
```

### 三方导入流程

```
AttaSeek 启动 → ThirdPartyImporter.check()
    │
    ├─ 读取 settings.json 的 importFromClaudeCode
    │     ├─ false → 跳过
    │     └─ true → 检测 ~/.claude/
    │           ├─ settings.json: mtime 新于 ~/.atta/seek/settings.json?
    │           │     → 是: 映射可识别的 key 写入 AttaSeek settings
    │           │     → 否: 跳过
    │           ├─ memory/*.md: 逐个检查 mtime → 去冗 → 复制到 ~/.atta/seek/memories/
    │           └─ skills/*/SKILL.md: 逐个检查 mtime → 去冗 → 复制到 ~/.atta/seek/skills/
    │
    ├─ 读取 settings.json 的 importFromCodexDesktop
    │     ├─ false → 跳过
    │     └─ true → 检测 ~/.codex/
    │           └─ (同 Claude Code 逻辑)
    │
    └─ 首次导入: 弹出确认对话框
```

---

## 技术决策

| 决策 | 选择 | 理由 | 替代方案 |
|------|------|------|---------|
| 明文与 SQLite 不交叉 | 每种数据类型只存一份，不同时写明文+DB | 避免双写一致性问题。memories/sessions/settings 只写明文；audit/token/permission 只写 SQLite | 双写（一致性复杂、收益低） |
| 写入失败回滚 | 明文写入失败 → 抛异常，不写 SQLite。SQLite 失败 → 只 log，不补救（明文已有） | 澄清项已明确：明文为权威源，SQLite 失败不影响读取 | 事务性双写（过度工程） |
| 设置文件格式 | 单一 `settings.json`，平铺 key-value | Claude Code 同格式。简单、人类可读、JSON 解析零依赖 | 多文件分散（查找困难）；INI/YAML（需额外解析器） |
| 记忆文件格式 | Markdown + YAML frontmatter | Claude Code `memdir/` 验证过的格式。Agent 用 `write_file` 直接写，Git diff 友好 | 纯 JSON（Agent 不易写）；SQLite（Agent 不可读） |
| 会话文件格式 | JSONL（每行一个 JSON 事件） | Claude Code `history.jsonl` 同格式。流式追加高效，逐行解析内存友好 | 单文件 JSON 数组（解析需全量加载）；SQLite（Agent 不可读） |
| Skills 加载优先级 | 项目 skill 覆盖全局同名 | 项目特定需求优先。Claude Code 同样模式（项目 `.claude/skills/` 优先于内置） | 合并（可能冲突）；全局优先（项目无法定制） |
| 三方导入 mtime 比较 | 源文件 mtime > 目标文件 mtime 才导入 | 避免覆盖用户手动修改。只导入新增或更新的内容 | 每次启动全量覆盖（丢失用户修改）；hash 比较（需两次读取） |
| MCP 配置导入 | 仅导入同名 MCP server 的配置 | 澄清项已明确：不同名 MCP server 导入无用，丢弃 | 全部导入（引入无用配置）；全部丢弃（遗漏有用配置） |

---

## 目录结构对比

```
重构前 (纯 SQLite):                    重构后 (明文优先):
─────────────────────                  ──────────────────
~/.atta/seek/                          ~/.atta/seek/
└── attaseek.db (14 表)                ├── settings.json           # 用户设置
                                       ├── credentials             # 加密 API keys
                                       ├── memories/              # 全局记忆 (.md)
                                       │   └── {name}.md
                                       ├── skills/                # 全局技能
                                       │   └── {name}/SKILL.md
                                       ├── sessions/              # 会话历史 (.jsonl)
                                       │   └── {id}.jsonl
                                       ├── projects.json          # 最近项目列表
                                       ├── plugins/               # 用户插件
                                       └── attaseek.db            # SQLite (3 表)

项目目录:                              <project>/.atta/seek/
  (无)                                 ├── settings.json
                                       ├── CLAUDE.md
                                       ├── memories/
                                       ├── skills/
                                       └── sessions/
```

---

## IPC Contract

无新增 IPC 通道。现有 `app:get-state` / `app:set-state` 适配 `DataStore`。

| Channel | 方向 | 变更 |
|---------|------|------|
| `app:get-state` | renderer→main | 从 SQLite `app_state` 表 → `settings.json` 读取 |
| `app:set-state` | renderer→main | 从 SQLite INSERT → `settings.json` 写入 |

---

## Jotai Atoms

无变更。现有 atoms 继续通过 IPC 读取设置，底层存储透明切换。
