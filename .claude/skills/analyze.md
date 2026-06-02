---
name: analyze-requirements
description: 需求分析：拿到需求后先理解上下文、探索 Electron 三层代码、明确边界与未知项
---

# 需求分析

## 概述

在写任何设计文档或代码之前，先完整理解需求。针对 AttaSeek 的 Electron + React 架构，需要从**三个进程层**理解需求影响。

目标是产出清晰、无歧义的需求说明，让后续设计和计划有据可依。

开始时声明：

"我正在使用 analyze-requirements skill 进行需求分析。"

## 什么时候使用

使用场景：

- 拿到新功能需求
- 接手一个不熟悉的模块
- 需求描述模糊，需要澄清
- 需要评估工作量和影响范围
- 多个需求之间存在依赖或冲突

不适合：

- 需求已经非常明确、范围很小（直接进入 `/write-plan`）
- 纯 bug fix（直接用 `/test-driven-development` 复现）

## Step 1: 收集输入

先明确：

- 需求从哪里来（用户反馈 / spec 文档 / issue / 需求模板）
- 涉及哪些子系统或面板（ActivityBar / Sidebar / Conversation / Artifact / Terminal / Diff）
- 是否有现有功能作为参考
- 是否有时间或资源约束

如果需求不完整，列出问题清单向用户确认，不要猜测。

## Step 2: 按 Electron 三层探索代码

以只读方式探索代码库。**AttaSeek 的代码分布在三个进程**，需要逐层理解影响：

### 主进程 (`src/main/`)

- `src/main/index.ts`：BrowserWindow 创建、窗口管理
- `src/main/ipc/`：IPC handler 注册
- `src/main/store/`：SQLite 持久化逻辑

### 预加载 (`src/preload/`)

- `src/preload/index.ts`：contextBridge 暴露的 API 签名

### 渲染进程 (`src/renderer/`)

- `src/renderer/App.tsx`：根组件布局
- `src/renderer/layouts/Shell.tsx`：整体 Shell
- `src/renderer/components/`：各面板组件
- 相关 Jotai atoms 和 hooks

**这一阶段禁止写代码。**

## Step 3: 明确 Electron 特定边界

定义本次需求的明确边界：

**In scope（本次做）：**
- 列出明确要做的事情
- 标注属于哪个进程（main / preload / renderer）

**Out of scope（本次不做）：**
- 列出明确不做的事情
- 把模糊需求挡在边界外

**IPC 影响：**
- 是否需要新增 IPC channel
- 是否需要扩展 contextBridge API
- 是否需要修改 preload 签名

**Dependencies（依赖）：**
- 依赖哪些已有组件/面板
- 依赖哪些外部系统（Bridge / Cloud / MCP）
- 是否有阻塞项

**Risks（风险）：**
- 跨进程通信复杂度
- 性能风险（主进程阻塞、渲染进程重渲染）
- 平台兼容性（macOS / Windows / Linux）
- 安全风险（nodeIntegration 暴露面）

## Step 4: 澄清歧义

如果需求中以下内容不明确，必须澄清后再继续：

- 用户交互流程（在哪个面板操作、如何触发）
- 错误状态处理
- 边界条件（空数据、大量消息、网络异常）
- 权限和访问控制
- 与现有面板的交互方式

## Step 5: 输出需求说明

分析完成后输出结构化需求说明：

```markdown
# [功能名] 需求分析

**目标：** 一句话说明要达成什么
**背景：** 为什么要做这个功能
**用户：** 谁会使用这个功能

## 功能范围

- In scope: ...
- Out of scope: ...
- Dependencies: ...
- 涉及进程：main / preload / renderer

## 关键场景

1. 正常流程：...
2. 异常流程：...
3. 边界条件：...

## 影响范围

### 主进程
- 新文件：...
- 修改文件：...

### 预加载
- IPC channel 变化：...

### 渲染进程
- 新组件：...
- 修改面板：...
- 新增/修改 Jotai atoms：...

## 风险与未知

- ...
```

## 完成检查

- 需求边界已明确（in/out of scope）
- 关键用户场景已列出
- Electron 三层影响范围已评估
- 风险已记录（IPC 复杂度、平台兼容性、安全）
- 歧义已澄清或已标记
- 可以进入 `/design-architecture` 或 `/write-plan`

## 交接

需求分析完成后：

1. 如果涉及跨面板或多进程设计 → `/design-architecture` 做架构设计
2. 如果范围明确、实现直接 → `/write-plan` 直接编写实现计划
