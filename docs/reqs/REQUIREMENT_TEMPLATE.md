# [功能名称] 需求说明

> **模板版本：** v1.0
> **创建日期：** YYYY-MM-DD
> **作者：** [姓名]
> **状态：** 草稿 / 评审中 / 已确认 / 已实现
>
> 使用方式：复制此文件到 `docs/requirements/YYYY-MM-DD-[feature-name].md`，按模板填写后提交。

---

## 1. 概述

### 1.1 目标

一句话说明要做成什么。

### 1.2 背景

为什么需要这个功能？解决什么问题？谁会用？

### 1.3 用户角色

| 角色 | 说明 |
|------|------|
| 普通用户 | 日常使用 AttaSeek 进行 AI 辅助开发的开发者 |
| 高级用户 | 需要自定义面板布局、插件配置的深度用户 |
| 管理员 | （如涉及）管理 MCP 插件、Bridge 连接的系统管理员 |

---

## 2. 功能范围

### 2.1 In Scope（本次做）

- [ ] 功能点 1
- [ ] 功能点 2

### 2.2 Out of Scope（本次不做）

- 功能点 A（原因）
- 功能点 B（原因）

### 2.3 依赖

| 依赖项 | 类型 | 状态 |
|--------|------|------|
| 某已有组件/面板 | 内部 | 已就绪 |
| 某外部服务 | 外部 | 待确认 |

---

## 3. 用户场景

### 3.1 正常流程

```
1. 用户在 [哪个面板] 看到 [什么入口]
2. 用户执行 [什么操作]
3. 系统响应 [什么结果]
4. 用户在 [哪个面板] 看到 [什么反馈]
```

### 3.2 异常流程

| 异常 | 触发条件 | 预期行为 |
|------|---------|---------|
| IPC 超时 | 主进程未响应 | 显示超时提示 + 重试按钮 |
| 数据为空 | 首次使用 | 显示空状态引导 |
| 权限不足 | 某操作被权限策略拒绝 | 显示权限确认内联 |

### 3.3 边界条件

- 极大值：[如 10,000 条消息]
- 极小值：[如空会话]
- 网络断开：
- 并发操作：

---

## 4. 涉及范围（Electron 三层）

### 4.1 主进程 (`src/main/`)

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/main/ipc/xxx.ts` | 新增 | 注册 xxx IPC handler |
| `src/main/store/db.ts` | 修改 | 新增 xxx 表 |

### 4.2 预加载 (`src/preload/`)

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/preload/index.ts` | 修改 | 暴露 xxx API |

### 4.3 渲染进程 (`src/renderer/`)

| 文件/组件 | 变更类型 | 说明 |
|-----------|---------|------|
| `src/renderer/components/Xxx/Xxx.tsx` | 新增 | xxx 面板组件 |
| `src/renderer/atoms/xxxAtom.ts` | 新增 | xxx 状态管理 |

---

## 5. 涉及面板

勾选涉及的 AttaSeek 面板，并说明影响：

- [ ] **Activity Bar** — [说明]
- [ ] **Sidebar** — [说明]
- [ ] **Conversation** — [说明]
  - [ ] SessionHeader
  - [ ] MessageFlow
  - [ ] ToolCallCard
  - [ ] PermissionInline
  - [ ] AgentStatusBar
  - [ ] Composer
- [ ] **Artifact** — [说明]
  - [ ] Code Tab
  - [ ] Diff Tab
  - [ ] Preview Tab
  - [ ] Terminal Tab
  - [ ] Browser Tab
- [ ] **Terminal** — [说明]
- [ ] **Diff** — [说明]
- [ ] **命令面板** — [说明]
- [ ] **通知系统** — [说明]
- [ ] **设置** — [说明]

---

## 6. 交互设计

### 6.1 入口

用户从哪里触发这个功能？（Activity Bar 图标 / 命令面板 / 快捷键 / 右键菜单 / 工具栏按键）

### 6.2 操作流程

```
[描述关键交互步骤，可用 ASCII 线框图辅助]

示例：
┌─ Conversation ──────────────────────────┐
│ 用户输入 /xxx 命令                        │
│                                          │
│ Agent 回应：触发 xxx 工具调用             │
│ ┌─ 🔧 xxx 工具 ──── [展开 ▸] [↩] ────┐  │
│ │ 执行结果 ...                         │  │
│ └─────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### 6.3 状态

| 状态 | 视觉表现 |
|------|---------|
| 空闲 | 默认展示 |
| 加载中 | Skeleton / Shimmer / Spinner |
| 执行中 | 状态指示器 + 当前操作描述 |
| 成功 | 结果展示 |
| 错误 | 错误提示 + 重试 / 跳过 |
| 空数据 | 空状态引导插图 + 操作入口 |

### 6.4 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Cmd+?` | xxx 操作 |

---

## 7. 数据 & 状态

### 7.1 Jotai Atoms

| Atom 名 | 类型 | 作用范围 | 持久化 |
|---------|------|---------|--------|
| `xxxAtom` | `XxxType` | 单面板 | 否 |
| `xxxGlobalAtom` | `XxxType` | 全局 | 是（SQLite） |

### 7.2 持久化（如涉及）

```sql
-- 新增表
CREATE TABLE IF NOT EXISTS xxx (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### 7.3 IPC Channels（如涉及）

| Channel | 方向 | 请求 | 响应 | 错误 |
|---------|------|------|------|------|
| `feature:action` | renderer→main | `ParamsType` | `ResultType` | `ErrorType` |
| `feature:event` | main→renderer | — | `EventDataType` | — |

---

## 8. 安全考量

- [ ] IPC 输入校验（主进程不信任渲染进程输入）
- [ ] 文件系统操作限制在项目目录内
- [ ] 外部内容（Agent 输出）视为不可信数据
- [ ] secret / token 不出现在日志或代码
- [ ] contextBridge 暴露面最小化

---

## 9. 平台差异

| 平台 | 差异点 |
|------|--------|
| macOS | traffic lights 嵌入 Sidebar（`titleBarStyle: hiddenInset`） |
| Windows | 窗口控制按钮叠加（`titleBarOverlay: true`） |
| Linux | 同 Windows |

---

## 10. 验收标准

- [ ] 验收条件 1（明确、可测试）
- [ ] 验收条件 2
- [ ] 验收条件 3
- [ ] 跨平台验证：macOS / Windows / Linux 均正常
- [ ] 测试覆盖：单元测试 + 集成测试 + E2E 测试
- [ ] TypeScript 编译无错误
- [ ] 构建成功
