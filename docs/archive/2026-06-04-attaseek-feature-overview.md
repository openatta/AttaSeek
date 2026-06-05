# AttaSeek 功能特性

> **日期：** 2026-06-04
> **版本：** v0.3.0
> **代码规模：** 142 源文件 / 8,130 行 / 84 单元测试

---

## 1. Shell 架构

```
ActivityBar (48px, 7 入口: Home/Chat/Projects/Search/Automation/Plugins/Settings)
└─ SidebarSlot (可拖拽, 160–500px, 内容随 Activity 切换)
└─ AppSpace
   ├─ AgentPane → Conversation (自然语言交互核心)
   └─ ArtifactPane → 多 Tab, ArtifactType 驱动 Renderer
```

---

## 2. AI Agent

### 2.1 Agent 运行时

| 功能 | 说明 |
|---|---|
| LLM Provider | Anthropic Claude (Sonnet/Haiku/Opus)，接口预留 OpenAI |
| API Key | Electron safeStorage 加密存储，renderer 不可见 |
| Agent Loop | LLM 驱动循环: ContextBuilder → chatStream → ToolExecutor → loop |
| Streaming | 逐 token 输出，50ms throttle，光标动画 |
| Context Builder | system prompt + history + ToolRouter Top-5 + Memory recall, ~100K token budget |
| Token 管理 | 4 chars/token 估算，消息截断，budget 超限 warn |
| 状态机 | 11 正常态 (idle→intake→context_assembling→…→completed) + 5 异常态 |
| 任务控制 | AbortController 取消 + PermissionBridge 超时默认 deny(120s) |

### 2.2 事件流（12 种事件类型，IPC 推送 UI）

```
UserMessage → AgentMessage/AgentMessageChunk → PlanCreated →
ToolCallStarted → ToolCallFinished → PermissionRequested →
ArtifactCreated → ArtifactUpdated → TaskPaused/TaskCompleted/TaskFailed
```

### 2.3 完整链路

```
Composer 输入 → IPC agent:create-task → AgentRuntime
→ ContextBuilder (system+history+tools+memory)
→ LLM chatStream (streaming token → AgentMessageChunk → UI)
→ LLM 返回 tool_use → ToolExecutor:
   PermissionService.check() → [ask?] PermissionBridge(await user)
   → AuditService.log() → ToolCallFinished
→ tool_result 回传 LLM → 循环至 end_turn
→ ArtifactService.create() + MemoryService.store() + AuditService.log()
→ TaskCompleted
```

---

## 3. Tool 系统

| 功能 | 说明 |
|---|---|
| Registry | 5 tools: read_file / search_code / create_document / send_email / git_commit |
| Router | Jaccard 关键词匹配 Top-K，减少 context |
| Executor | Permission→Execute→Audit 全链路 |
| 真实实现 | read_file (fs 读取) / search_code (grep) / create_document (Artifact 创建) |
| Mock 实现 | send_email / git_commit (预览模式) |
| 文件沙箱 | 白名单目录限制 (cwd + home + documents + desktop) |
| 错误恢复 | 按 error.code 判断 recoverable |

---

## 4. Permission 权限

| 功能 | 说明 |
|---|---|
| 三态 | allow / ask / deny |
| 优先级 | tool > plugin > project > session，逐级查找 |
| 策略持久化 | SQLite permission_policies 表 |
| 权限桥 | PermissionBridge: Promise 等待 renderer 确认，超时 deny |
| UI | PermissionRequestedEvent 卡片（tool/action/preview/impact/rollbackable） |

---

## 5. Memory 记忆

| 功能 | 说明 |
|---|---|
| L1 Scratchpad | Session 级临时上下文，in-memory |
| L2 Persistent | SQLite 持久化，支持 scope+query 检索 |
| UI | Settings → Memory 页面，查看/删除 |

---

## 6. Audit 审计

| 功能 | 说明 |
|---|---|
| 不可变日志 | SQLite audit_logs 表，13 种事件类型 |
| 自动记录 | Tool 调用 / Permission 决定 / Agent Task 生命周期 |
| UI | Settings → Audit 页面，按 session/task/event/risk 筛选 |

---

## 7. Artifact 产物

| 功能 | 说明 |
|---|---|
| CRUD | SQLite 双表 (artifacts + artifact_versions) |
| 版本管理 | 递增版本，保留最近 10 版本，可恢复历史 |
| Renderer | 6 种: Markdown / HTML / SVG / Table / Code / Diff |
| ArtifactPane | 多 Tab，ArtifactType 路由 |
| Inline Preview | Conversation 内嵌轻量预览卡片 |

---

## 8. Plugin 插件

| 功能 | 说明 |
|---|---|
| Registry | 注册/激活/停用/重载/卸载 |
| Loader | Boot sequence: 内置优先，失败不阻塞后续 |
| 容错 | maxErrors=3 自动停用 |
| 扩展点 | Activity / Sidebar / Skills / Tools / Renderers / Settings |
| Demo 插件 | Enterprise Document Plugin |

---

## 9. Session 会话

| 功能 | 说明 |
|---|---|
| CRUD | 创建/列表/查询/更新/删除 IPC |
| 持久化 | session_events 表，FK ON DELETE CASCADE |
| 退出保存 | before-quit 取消 pending → will-quit 写 events |

---

## 10. IPC (14 组 / 33 channel)

agent / artifact / session / permission / memory / audit / skill / tool / plugin / theme / app

全部 `feature:action` 命名，版本注册表 `ipc/versions.ts`

---

## 11. Settings (13 页)

General / Profile / Appearance / Configuration / Personalization / Keyboard / Notifications / **Agent** / **Permissions** / **Memory** / **Audit** / Git / Integrations

---

## 12. 安全

| 控制 | 实现 |
|---|---|
| contextIsolation + nodeIntegration:false | renderer 隔离 |
| Preload 最小暴露 | contextBridge 14 namespace |
| API key | safeStorage 加密 |
| Tool 沙箱 | 白名单路径 |
| SVG 净化 | 剥离 script/on*/javascript: |
| HTML sandbox | iframe sandbox="" |
| 全审计 | Tool + Permission 不可变日志 |
