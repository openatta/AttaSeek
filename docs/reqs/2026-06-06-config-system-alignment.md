# 配置系统对齐 — Codex + Claude Code 需求规格

**目标：** 将 AttaSeek 配置体系对齐 Codex Desktop 和 Claude Code 的配置模型，覆盖 P0-P3 全部缺口项。所有配置数据使用明文文本格式（JSON + TOML），不使用 SQLite 存储配置。

**背景：** 当前 AttaSeek 配置覆盖率 ~43%（20/47 项对齐）。settings.json 仅 6 个 key。剩余 27 个配置项需要从零设计并集成到 Settings UI 和运行时行为中。

---

## 范围

### In scope（27 项，全部补全）

**P0 — 安全基础（3 项）：**

1. **沙箱模式** — 三种安全级别：
   - `read-only`：Agent 只能读取文件，不可写入
   - `workspace-write`：Agent 只能在项目目录（和配置的白名单路径）内写入
   - `danger-full-access`：Agent 拥有完整文件系统访问权限（默认关闭，需显式确认）
   - 对齐 Codex 的 `sandbox_mode` 和 Claude Code 的 `sandbox.enabled`

2. **Shell 环境变量控制** — Agent 执行 Bash 时的环境变量策略：
   - 包含列表（`env.include`）：允许传递给 shell 的环境变量
   - 排除列表（`env.exclude`）：禁止传递的环境变量
   - 登录 shell 设置（`env.loginShell`）：是否使用登录 shell
   - 对齐 Claude Code 的 `env` record 和 Codex 的 shell 环境策略

3. **Bash 命令白名单/黑名单** — 可配置的命令控制：
   - 黑名单模式（默认）：禁止特定模式（rm、sudo、chmod 等）
   - 白名单模式：仅允许列表中的命令
   - 不安全命令警告：执行高风险命令前弹出确认对话框
   - 对齐 Claude Code 的 `permissions.allow/deny` Bash 规则

**P1 — Agent 行为（4 项）：**

4. **人格/个性预设** — Agent 的默认行为风格：
   - `pragmatic`（实用主义，默认）
   - `verbose`（详细解释）
   - `concise`（简洁直接）
   - 自定义：用户自由文本描述
   - 对齐 Codex 的 `personality` 和 Claude Code 的 CLAUDE.md 风格注入

5. **自定义指令** — 用户对 Agent 的全局指令（注入系统提示词）：
   - 对标 Codex 的 `developer_instructions` 和 Claude Code 的 CLAUDE.md
   - 支持项目级覆盖（项目 `.atta/seek/CLAUDE.md` 优先于全局）

6. **思考模式** — 控制 Anthropic extended thinking：
   - `auto`（默认）：Opus 模型自动启用
   - `enabled`：所有支持的模型启用
   - `disabled`：禁用 extended thinking
   - 对齐 Claude Code 的 `alwaysThinkingEnabled`

7. **快速模式** — 使用更快/更便宜的模型进行简单问答：
   - `off`（默认）：使用当前选择的模型
   - `on`：使用 Haiku 级别的快速模型
   - `auto`：Agent 根据任务复杂度自动选择
   - 对齐 Codex 的 `fast_mode` 和 Claude Code 的 `fastMode`

**P1 — MCP 完善（1 项）：**

8. **MCP 服务器管理** — 补齐现有结构：
   - 服务器列表管理（添加/移除/编辑）
   - 工具审批策略（全部自动批准 / 按工具确认 / 全部确认）
   - 服务器健康状态显示（healthy / unhealthy / stopped）
   - 对齐 Codex 的 `[mcp_servers]` 和 Claude Code 的 MCP 管理

**P2 — 会话与项目（3 项）：**

9. **会话清理策略** — 自动清理旧会话数据：
   - 保留天数（默认 30 天，0 = 永不清理）
   - 最大会话数（默认 100）
   - 归档策略（手动 / 自动 / 不归档）
   - 对齐 Claude Code 的 `cleanupPeriodDays`

10. **项目信任级别** — 控制打开项目时的权限：
    - `untrusted`：所有写入/网络操作需要确认
    - `trusted`：跳过确认（用户手动标记）
    - 信任状态持久化在项目 `.atta/seek/` 中
    - 对齐 Codex 的 `[projects].trust_level`

11. **自动审查策略** — 自动化权限审查：
    - `off`（默认）：不启用自动审查
    - `read_only`：自动批准只读操作
    - `full`：自动批准所有不修改关键文件的操作
    - 对齐 Codex 的 `auto_review.policy`

**P2 — 配置增强（3 项）：**

12. **模型目录/白名单** — 企业级模型管理：
    - `availableModels`：允许使用的模型 ID 列表
    - 未在列表中的模型不在 UI 中显示
    - 对齐 Claude Code 的 `availableModels` 和 Codex 的 `model_catalog_json`

13. **上下文窗口配置** — 可配置的 token 预算：
    - 全局默认值（覆盖 profile 默认值）
    - 每 Provider 可单独配置
    - 对齐 Codex 的 `model_context_window`

14. **输出样式** — Agent 回复风格：
    - `default`（默认）
    - `concise`：精简输出
    - `detailed`：详细解释
    - 对齐 Claude Code 的 `outputStyle` 和 Codex 的 `model_verbosity`

**P3 — 体验增强（4 项）：**

15. **编辑器模式** — 输入区域的行为：
    - `normal`（默认）：标准文本输入
    - `vim`：Vim 键位绑定
    - 对齐 Claude Code 的 `editorMode`

16. **快捷键系统** — 用户自定义快捷键：
    - 全局快捷键配置文件（`keybindings.json`）
    - 基于操作的键位绑定（操作→组合键映射）
    - 对齐 Claude Code 的 `keybindings.json` 模式

17. **更新通道** — 控制应用更新：
    - `stable`（默认）：稳定版
    - `latest`：最新版
    - `none`：禁用自动更新
    - 对齐 Claude Code 的 `autoUpdatesChannel` 和 Codex 的 `check_for_update_on_startup`

18. **任务完成通知** — Agent 任务完成时的行为：
    - 桌面通知
    - 声音提示
    - 不通知
    - 对齐 Claude Code 的 `taskCompleteNotifEnabled`

**P3 — 存储对齐（4 项）：**

19. **SQLite 仅保留审计+Token+权限** — 当前 14 表中，仅保留 3 个高频结构化表（audit_logs、token_usage、permission_policies）。其余全部迁移到明文文件：
    - `sessions` → `sessions/*.jsonl`
    - `session_events` → `sessions/*.jsonl`
    - `memory_entries` → `memories/*.md`
    - `model_configs` → `model-configs.json`
    - `app_state` → `app-state.json`
    - `artifacts` → `artifacts/*.json`
    - `artifact_versions` → 合并到 artifacts
    - `skill_*` → `skills/*/SKILL.md`

20. **TOML 格式支持** — 配置文件的格式选择：
    - `settings.json` 保留 JSON（与 Claude Code 兼容）
    - 新增 `.toml` 格式读取支持（与 Codex 兼容）
    - 首次启动时检测格式并加载
    - 写入时统一用 JSON（简化实现）

21. **配置 Schema 验证** — 加载配置时进行验证：
    - JSON/TOML 解析失败 → 回退到默认值 + 日志警告
    - 类型不匹配 → 使用默认值 + 日志警告
    - 未知 key → 保留不丢弃（passthrough）
    - 对齐 Claude Code 的 Zod schema 验证

22. **配置热加载** — 文件变更时自动生效：
    - 使用 fs.watch 监听 settings.json 变更
    - 检测到变更 → 重新加载 → 通知渲染进程
    - 外部编辑器修改后无需重启应用
    - 对齐 Claude Code 的 Chokidar 文件监听

### Out of scope

- MCP 服务器的完整 OAuth 认证流程
- Network proxy 的完整实现（仅定义配置项）
- git worktree 撤销功能的完整实现（仅定义配置项）
- Slack/Discord 等第三方通知渠道

### 前置依赖

- `store/FileStore.ts`（MarkdownStore, JSONStore, JSONLStore）已就绪
- `store/settings.ts`（现有 6 个 key 的 JSON 读写）已就绪
- `store/ThirdPartyImporter.ts`（Claude Code + Codex 导入）已就绪
- Settings UI 14 个页面组件已就绪（其中 8 个占位待连线）
- `AgentProfile` 类型系统已就绪

---

## 用户场景

### 场景 1: 配置沙箱模式并生效

- **给定:** 用户在设置中查看安全配置
- **当:** 用户将沙箱模式从 `danger-full-access`（当前默认）改为 `workspace-write`
- **则:**
  1. 设置保存到 `~/.atta/seek/settings.json`
  2. 下一次 Agent 执行 bash 命令时，路径被限制在项目目录内
  3. Agent 尝试访问 `/etc/passwd` → 被沙箱拦截 → 返回错误
  4. 用户可以随时改回 `danger-full-access`

### 场景 2: 导入 Claude Code 配置后融合

- **给定:** 用户从 Claude Code 导入了 `settings.json`（包含 `permissions.defaultMode: 'acceptEdits'`）
- **当:** AttaSeek 首次启动并完成导入
- **则:**
  1. `importFromClaudeCode=true` 触发导入流程
  2. Claude Code 的 `permissions.defaultMode` 映射为 AttaSeek 的 `permissionMode`
  3. 已知 key 自动映射，未知 key 保留在 `settings.json` 的 passthrough 中
  4. 用户在 AttaSeek 中修改设置后，不再被 Claude Code 覆盖（mtime 保护）

### 场景 3: 项目级配置覆盖全局

- **给定:** 全局设置沙箱为 `read-only`，用户正在开发自己的项目
- **当:** 用户在项目中打开 Settings，将沙箱改为 `workspace-write`
- **则:**
  1. 项目级设置保存到 `<project>/.atta/seek/settings.json`
  2. 仅在该项目中生效 `workspace-write`
  3. 切换到其他项目时，恢复全局设置 `read-only`
  4. 项目设置优先级高于全局设置

### 场景 4: 外部编辑器修改配置热加载

- **给定:** AttaSeek 正在运行
- **当:** 用户用 VS Code 打开 `~/.atta/seek/settings.json`，修改 `theme: "light"`
- **则:**
  1. fs.watch 检测到文件变更
  2. 重新读取并验证 JSON
  3. 通知渲染进程更新主题
  4. 用户无需重启应用即可看到主题变化

### 场景 5: 模型白名单限制

- **给定:** 管理员设置了 `availableModels: ["claude-sonnet-4-6", "claude-haiku-4-5"]`
- **当:** 用户尝试添加一个包含 `claude-opus-4-8` 的 Model Config
- **则:**
  1. UI 中仅显示白名单内的模型
  2. 用户手动输入不在白名单内的模型 ID → 保存时提示 "此模型不在允许列表中"
  3. 管理员可通过 managed-settings 强制此限制

### 场景 6: 异常 — 配置文件损坏

- **给定:** 用户手动编辑 settings.json 时引入了 JSON 语法错误
- **当:** AttaSeek 启动或热加载配置文件
- **则:**
  1. JSON 解析失败 → 日志警告：`[settings] parse error at line X: ...`
  2. 回退到上次有效缓存
  3. 如果缓存不存在，使用内置默认值启动
  4. 通知渲染进程显示 "配置文件格式错误" 提示

---

## 待澄清

- [ ] 沙箱 `workspace-write` 模式的白名单路径范围：仅项目根目录？还是包括 `~/Documents`、`~/Desktop`？默认值是什么？
- [ ] 模型白名单 `availableModels` 为空时（默认），是显示全部模型还是不显示任何模型？
- [ ] 配置文件的写入时统一用 JSON（当前策略），但 `config.toml` 格式是否仅在导入时读取、不主动写入？
- [ ] 快捷键配置 `keybindings.json` 的格式是否对齐 VS Code 的 keybindings 规范？

---

## 风险

- **配置项过多导致 UI 复杂** — 从 6 个 key 扩展到 ~30 个，Settings 页面需要重新组织分类。现有 14 个 Section 中 8 个为占位，需要在设计阶段确定分组逻辑。
- **TOML/JSON 双格式兼容** — TOML 支持嵌套表格等 JSON 不支持的结构。导入时可能存在无法映射的 TOML 结构，需要明确定义"可转换"的边界。
- **热加载与并发修改** — 用户在外部编辑器的保存可能与 AttaSeek 内部的写入产生竞争条件。需要文件锁或版本号机制。
- **沙箱模式兼容性** — macOS/Linux 的沙箱机制不同（macOS sandbox-exec、Linux seccomp/namespaces）。首次实现可能仅支持路径拦截（软沙箱），非系统级隔离（硬沙箱）。
- **迁移兼容性** — 现有 SQLite 中的 model_configs、sessions、memories 数据需要迁移到明文文件。迁移脚本需要处理数据量较大的场景（数百会话、数千记忆）。
