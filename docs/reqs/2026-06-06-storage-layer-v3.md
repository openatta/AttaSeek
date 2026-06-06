# 存储层 V3 — 明文优先 + 项目隔离 + 三方导入 需求规格

**目标：** 将存储层从纯 SQLite 重构为"明文文件为主、SQLite 为辅"的混合模式，对齐 Claude Code/Codex Desktop 的配置惯例，支持全局与项目两级隔离，支持从 Claude Code/Codex 自动导入配置。

**背景：** 当前 AttaSeek 全部运行时数据存储在 `~/.atta/seek/attaseek.db` SQLite 中。Claude Code 和 Codex Desktop 均使用明文文件（JSON、Markdown、JSONL）存储配置、记忆和会话。明文文件对 AI Agent 更友好（Agent 可用自身工具读写），对开发者更友好（git diff 可追踪），对用户更友好（编辑器可直接打开）。SQLite 保留用于高频结构化查询（审计日志、token 用量、权限策略）。

---

## 范围

### In scope

**1. 全局运行时目录结构**

统一到 `~/.atta/seek/`，按数据类型分文件：

```
~/.atta/seek/
├── settings.json              # 用户设置（明文 JSON）
├── credentials                # 加密的 API keys（safeStorage）
├── memories/                  # 全局记忆（明文 Markdown，Agent 可直接读写）
│   └── {name}.md              # YAML frontmatter 元数据 + Markdown 内容
├── skills/                    # 全局技能
│   └── {skill-name}/
│       └── SKILL.md           # frontmatter + Markdown 指令
├── sessions/                  # 会话历史（明文 JSONL）
│   └── {session-id}.jsonl     # 每行一个 SessionEvent JSON
├── attaseek.db                # SQLite（高频结构化数据）
│   ├── audit_logs             # 审计日志（仅内部查询）
│   ├── token_usage            # Token 用量（聚合查询）
│   └── permission_policies    # 权限策略（结构化过滤）
└── plugins/                   # 用户安装的插件
```

**2. 项目级运行时目录结构**

用户通过"打开目录"创建/打开项目时，在项目根目录下创建 `.atta/seek/`，结构与全局目录相同但仅包含项目相关数据：

```
<project-root>/.atta/seek/
├── settings.json              # 项目级设置（覆盖全局设置）
├── memories/                  # 项目级记忆（仅在该项目中召回）
│   └── {name}.md
├── skills/                    # 项目级技能（覆盖/追加全局技能）
│   └── {skill-name}/
│       └── SKILL.md
├── sessions/                  # 该项目的会话历史
│   └── {session-id}.jsonl
└── CLAUDE.md                  # 项目指引文件（同 Claude Code 格式，AI Agent 自动加载）
```

**3. Skills 文件系统模式**

对齐 Claude Code 的技能模式：

- 技能是一个包含 `SKILL.md` 的目录
- `SKILL.md` 使用 YAML frontmatter 定义元数据（name, description, layer, tools, riskLevel）
- Markdown 正文是指令内容，注入系统提示词
- 全局技能：`~/.atta/seek/skills/{skill-name}/SKILL.md`
- 项目技能：`<project>/.atta/seek/skills/{skill-name}/SKILL.md`
- 项目技能优先级高于全局同名技能（加载时合并，项目覆盖全局）
- Skills marketplace 安装的技能也放在此目录结构中

**4. 三方配置导入（Claude Code / Codex Desktop）**

AttaSeek 启动时自动检测并导入 Claude Code 和 Codex Desktop 的配置：

- **Claude Code 源：** `~/.claude/settings.json`、`~/.claude/memory/*.md`、`~/.claude/skills/*/SKILL.md`
- **Codex Desktop 源：** `~/.codex/settings.json`、`~/.codex/memory/*.md`
- **导入策略：** 仅当源文件修改时间晚于 AttaSeek 对应文件时才导入（基于 `mtime` 比较）
- **去冗逻辑：** 导入前检查目标位置是否已存在相同内容，存在则跳过；内容不同则合并或新增（不覆盖用户手动修改的）
- **开关控制：** 设置项 `importFromClaudeCode` / `importFromCodexDesktop`，默认 `true`。关闭后不再检测导入
- **导入范围：**
  - settings.json → 映射 key 到 AttaSeek 对应设置项
  - memory/*.md → 复制到 `~/.atta/seek/memories/`
  - skills/*/SKILL.md → 复制到 `~/.atta/seek/skills/`
  - CLAUDE.md（项目级）→ 复制到 `.atta/seek/CLAUDE.md`
- **首次导入提示：** 首次检测到三方配置时，弹出确认对话框询问用户是否导入

**5. 数据读写优先级**

- **读取：** 先查明文文件 → 若不存在或不完整 → 查 SQLite 补充
- **写入：** 明文文件 + SQLite 双写（保持一致性）。明文文件为权威源，SQLite 为查询缓存
- **会话追加：** JSONL 流式追加（每行一个事件），SQLite 批量同步（每 50 个事件或每 30 秒）

### Out of scope

- 云端同步（多设备配置同步）
- 加密的会话历史（明文 JSONL 如包含敏感信息，由用户自行管理）
- 从 Windsurf/Cursor/Copilot 等其他 AI 工具导入
- 旧 `~/Library/Application Support/attaseek/` 数据的自动迁移（首次启动时提示用户手动迁移或丢弃）

### 前置依赖

- `fs/promises` API（已有）
- `better-sqlite3`（已有，保留用于高频查询表）
- YAML frontmatter 解析器（已有 `FileMemory.parseFrontmatter`，可复用）
- 现有的 `AgentEventBus` 事件流（JSONL 追加源）

---

## 用户场景

### 场景 1: 首次启动 — 自动导入 Claude Code 配置

- **给定:** 用户已使用 Claude Code，`~/.claude/settings.json` 存在且包含 theme、model 等设置
- **当:** 用户首次启动 AttaSeek
- **则:**
  1. AttaSeek 检测到 `~/.claude/settings.json` 的 mtime 比 `~/.atta/seek/settings.json` 更新
  2. 弹出提示："检测到 Claude Code 配置，是否导入？"（默认选中"导入"，用户可取消）
  3. 用户确认后，将 Claude Code 的设置项映射到 AttaSeek 对应 key 写入 `~/.atta/seek/settings.json`
  4. `~/.claude/memory/*.md` 复制到 `~/.atta/seek/memories/`
  5. `~/.claude/skills/*/SKILL.md` 复制到 `~/.atta/seek/skills/`
  6. 后续启动不再提示（除非源文件有更新）

### 场景 2: 创建/打开项目

- **给定:** 用户通过"打开目录"功能选择了一个项目文件夹
- **当:** AttaSeek 加载该项目
- **则:**
  1. 检查项目根目录是否存在 `.atta/seek/`
  2. 若不存在，自动创建完整目录结构（settings.json + memories/ + skills/ + sessions/）
  3. 若存在且项目中有 `CLAUDE.md`，加载为项目指引上下文
  4. 若存在项目级 `skills/`，优先使用项目技能覆盖全局同名技能
  5. 项目级 `memories/` 在 Agent 执行时优先召回
  6. 项目会话自动存储在 `.atta/seek/sessions/` 中

### 场景 3: Agent 自主管理记忆

- **给定:** Agent 完成了一个编码任务，需要记住用户的偏好
- **当:** Agent 调用 `write_file` 工具
- **则:**
  1. Agent 写入 `.atta/seek/memories/coding-prefs.md`（而非 SQL INSERT）
  2. 文件内容包含 YAML frontmatter（type: user_preference, scope: project）
  3. 下次任务时，ContextBuilder 从 `.atta/seek/memories/` 加载该文件
  4. Agent 也可以用 `read_file` 直接读取记忆内容
  5. 用户可以用编辑器直接修改记忆文件

### 场景 4: 关闭三方导入

- **给定:** 用户不希望 AttaSeek 自动读取 Claude Code 的配置
- **当:** 用户在设置中将"从 Claude Code 导入"开关设为关闭
- **则:**
  1. 下次启动时不再检测 `~/.claude/` 目录
  2. 已导入的配置和记忆保留不变
  3. 用户可以随时重新打开开关，恢复导入检测

### 场景 5: 项目技能覆盖全局技能

- **给定:** 全局有 `code-review` 技能（`~/.atta/seek/skills/code-review/SKILL.md`），项目有自己的 `code-review` 技能（`.atta/seek/skills/code-review/SKILL.md`）
- **当:** Agent 在当前项目中执行
- **则:**
  1. skillRegistry 加载时检测到同名技能
  2. 项目级版本覆盖全局版本（项目级优先）
  3. Agent 收到的系统提示词中使用项目级技能的指令
  4. 全局技能在其他项目中仍然可用

### 场景 6: 异常 — 明文文件被外部修改

- **给定:** 用户在 AttaSeek 运行期间用编辑器修改了 `~/.atta/seek/settings.json`
- **当:** AttaSeek 需要读取设置
- **则:**
  1. 每次读取时检查文件 mtime，如果比内存缓存更新则重新加载
  2. 如果 JSON 解析失败（格式错误），回退到上次有效缓存 + 日志警告
  3. 不会因外部修改而崩溃

### 场景 7: 边界 — 首次使用无任何三方配置

- **给定:** 用户从未使用过 Claude Code 或 Codex Desktop
- **当:** AttaSeek 首次启动
- **则:**
  1. 创建 `~/.atta/seek/` 目录及所有子目录
  2. 生成默认 `settings.json`（含 importFromClaudeCode=true 等默认值）
  3. 不弹出导入提示（无可导入内容）
  4. 正常启动

---

## 待澄清

- [ ] 导入的三方 settings 映射规则：哪些 Claude Code 设置项可以直接映射到 AttaSeek？哪些无法映射（如 MCP server 配置）需要丢弃或提示？ 
    - 丢弃，如果我们没有同名的MCP SERVER的话，导入也没有用；有同名同功能的可以导入；
- [ ] 明文文件与 SQLite 双写的一致性：如果写入明文成功但 SQLite 失败（或反之），回滚策略是什么？
    - 两者不交叉；SQLITE写的那几种是不写明文的；写明文的不写SQLITE；先写明文，如果SQLITE失败，什么动作也不动，因为程序会检索明文；
- [ ] 项目 `.atta/seek/` 是否需要 `.gitignore` 建议？哪些文件适合提交到 Git（如 CLAUDE.md、skills/），哪些不适合（如 sessions/）？
    - 类似与.claude一样的方案，你分析一下；

---

## 风险

- **双写一致性风险** — 明文文件 + SQLite 双写可能产生不一致。需要明确的"明文为权威源"策略和修复不一致的机制。
- **导入覆盖风险** — 从 Claude Code 导入时可能覆盖用户已在 AttaSeek 中手动修改的配置。需要 mtime 比较 + 去冗逻辑防止误覆盖。
- **文件系统性能** — 大量记忆/会话文件可能导致目录遍历变慢。需要索引文件（如 `_index.json`）加速查找。
- **安全风险** — 明文 `credentials` 文件（即使加密）比 macOS Keychain 更容易被误操作。需要确保 safeStorage 加密不退化。
- **项目目录污染** — `.atta/seek/` 在项目根目录可能让用户觉得"污染"。需要文档说明其用途，并提供 `.gitignore` 建议。
