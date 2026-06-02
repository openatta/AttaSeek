---
name: design-architecture
description: 架构设计：在需求明确后，设计 Electron 三进程结构、React 组件树、Jotai 原子、IPC contract
---

# 架构设计

## 概述

在需求明确后、写代码前，先做架构设计。针对 AttaSeek 的 Electron + React + TypeScript 技术栈，设计覆盖**主进程、预加载、渲染进程**三个层级。

目标是做出有意识的技术决策，而不是边写边想。

开始时声明：

"我正在使用 design-architecture skill 进行架构设计。"

## 什么时候使用

使用场景：

- 涉及多个面板或组件的新功能
- 需要新增 IPC channel 或扩展 contextBridge API
- 需要新增数据库表或持久化逻辑
- 需要引入新的第三方依赖
- 多个实现方案需要比较

不适合：

- 单面板、单组件的简单修改（直接进入 `/write-plan`）
- 纯 CSS/Tailwind 调整

## Step 1: 收集设计输入

确认以下信息已就绪：

- 需求分析结论（来自 `/analyze-requirements` 或 spec）
- 现有架构约束（参考 `CLAUDE.md` 和 `docs/ui.md`）
- 技术栈限制（Electron / React 18 / TypeScript / Jotai / Tailwind / SQLite / Monaco / xterm.js）

## Step 2: Electron 三进程设计

按 AttaSeek 架构分层设计：

### 主进程 (`src/main/`)

- BrowserWindow 配置变更
- 新 IPC handler 注册
- SQLite 表结构或查询变更
- 文件系统操作
- MCP 子进程管理

### 预加载 (`src/preload/`)

- contextBridge 暴露的新 API 签名
- 类型定义同步（主进程 ↔ 渲染进程）

### 渲染进程 (`src/renderer/`)

- React 组件树结构
- Jotai atoms 设计
- 面板间数据流

## Step 3: React 组件树设计

按 AttaSeek 的组件层级设计：

```
App
├── Shell.tsx                    # 整体布局
│   ├── TitleBar                 # Sidebar 区域标题栏（traffic lights）
│   ├── ActivityBar              # 48px 左轨导航
│   ├── Sidebar                  # 260px 上下文面板
│   │   └── 内容随 Activity 切换
│   └── MainCanvas               # 可拖拽面板区
│       ├── Conversation         # Agent 对话面板
│       │   ├── SessionHeader    # 会话标题栏（内联固定）
│       │   ├── MessageFlow      # 消息流
│       │   │   ├── ToolCallCard # 工具调用卡片
│       │   │   └── PermissionInline # 权限确认内联
│       │   ├── AgentStatusBar   # 状态指示器
│       │   └── Composer         # 输入区
│       ├── Artifact             # 产物面板（Tab: Code/Diff/Preview/Terminal/Browser）
│       ├── Terminal             # 集成终端（xterm.js）
│       └── Diff                 # Diff 查看器（Monaco）
```

设计原则：

- 每个组件承担清晰、单一的职责
- 组件边界明确，props 接口清楚
- 遵循项目已有模式（函数组件 + Hooks + Jotai）
- 面板组件可独立拖拽、折叠、分栏

## Step 4: 状态管理设计 (Jotai)

定义 Jotai atoms：

```typescript
// 示例：新增功能的 atom 设计
// 每个 atom 标注：读写权限、持久化策略、作用范围

// src/renderer/atoms/featureName.ts

// 会话级状态（不持久化）
const featureDataAtom = atom<FeatureData | null>(null);

// 派生 atom（只读）
const featureDerivedAtom = atom((get) => {
  const data = get(featureDataAtom);
  return data ? transform(data) : defaultValue;
});

// 跨面板共享状态
const featureGlobalAtom = atomWithStorage('feature-key', defaultValue);
```

设计原则：

- 优先本地 atom，跨面板才提升
- 区分会话级状态与持久化状态
- 标注每个 atom 的作用范围（单面板 / 跨面板 / 全局）

## Step 5: IPC Contract 设计

如果涉及主进程 ↔ 渲染进程通信，先定义 IPC contract：

```typescript
// src/preload/index.ts 暴露的 API 签名

// 渲染进程 → 主进程（invoke）
const result = await window.api.feature.someMethod(params);
//  返回值: Promise<ResultType>

// 主进程 → 渲染进程（on）
window.api.feature.onSomeEvent((data: EventData) => {
  // 回调处理
});
//  返回: unsubscribe 函数

// 类型定义
interface FeatureAPI {
  someMethod(params: ParamsType): Promise<ResultType>;
  onSomeEvent(callback: (data: EventData) => void): () => void;
}
```

IPC 设计原则：

- 所有 IPC 经 contextBridge 暴露，渲染进程不直接访问 Node.js
- 每个 IPC channel 有明确的值类型和错误类型
- 考虑超时和连接断开场景
- 主进程 handler 不信任渲染进程的输入

## Step 6: 数据库设计（如涉及）

如果涉及 SQLite 持久化：

```sql
-- 新表或修改现有表
CREATE TABLE IF NOT EXISTS feature_name (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  data TEXT NOT NULL,          -- JSON 序列化
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_feature_session ON feature_name(session_id);
```

设计原则：

- 主键使用项目的 ID 格式
- JSON 字段存序列化数据，结构化字段用于查询
- 创建必要的索引
- 定义清晰的外键和级联规则

## Step 7: 技术决策

对每个关键技术选择给出理由：

| 决策 | 方案 | 理由 | 替代方案（为何不选） |
|------|------|------|---------------------|
| 状态管理 | Jotai atom | 项目已有，原子化适合面板隔离 | Redux（过重） |
| 编辑器 | Monaco | 项目已有 | CodeMirror（功能少） |
| 终端 | xterm.js | Electron 标准方案 | 原生终端（跨平台差） |

引入新依赖前检查：

- 是否与现有依赖冲突
- 包体积是否可接受（影响 Electron 打包大小）
- 许可证是否兼容
- 维护活跃度
- 对 Node.js / Chromium 版本要求

## 输出：设计文档

```markdown
# [功能名] 架构设计

**日期：** YYYY-MM-DD
**基于需求：** [链接]

## 三进程结构

- 主进程：...
- 预加载：...
- 渲染进程：...

## 组件结构

[组件树，标注新组件和修改的组件]

## 状态管理 (Jotai Atoms)

[atoms 列表，标注作用范围和持久化策略]

## IPC Contract

[channel 定义和类型签名]

## 数据库变更

[DDL 或表结构说明]

## 技术决策

[决策表]

## 风险与权衡

- 风险：...
- 权衡：...
```

## 完成检查

- Electron 三进程职责已分配
- React 组件树已定义
- Jotai atoms 已设计（范围 + 持久化策略）
- IPC contract 已定义（如涉及）
- 数据库变更已设计（如涉及）
- 技术决策有记录和理由
- 可以进入 `/write-plan` 编写实现计划

## 交接

设计完成后 → `/write-plan` 编写实现计划。
