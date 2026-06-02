---
name: code-review
description: 代码审查：正确性、可读性、架构、Electron 安全、性能五维审查，合并前必做
---

# 代码审查

## 概述

每个重要变更在合并前都必须审查。

审查目标不是追求完美代码，而是判断该变更是否明确改善了代码库健康度。

如果代码符合项目约定、功能正确、风险可控，即使不是你会写的风格，也可以批准。

开始时声明：

"我正在使用 code-review skill 进行代码审查。"

## 使用场景

必须使用：

- 合并前
- 完成大功能后
- 修复 bug 后
- 重构后
- AI agent 或其他模型生成代码后
- agent 每完成一个任务后

可选但有价值：

- 卡住时寻求新视角
- 重构前做基线检查
- 复杂 bug 修复后

## 五个审查维度

### 1. 正确性

检查：

- 是否满足需求或 spec
- 是否处理边界值：null、空消息、空会话、最大 Tab 数
- 是否处理错误路径：IPC 超时、数据库写入失败、MCP 子进程崩溃
- 是否有竞态条件（IPC 回调顺序、atom 并发更新）
- 状态是否一致（Jotai atoms 之间、主进程与渲染进程之间）
- 测试是否真的覆盖了行为

**Electron 特定检查：**

- contextBridge API 是否在 preload 中正确暴露
- 渲染进程是否通过 `window.api.*` 调用，而非直接引用 Node.js
- `nodeIntegration: false` 是否保持
- IPC handler 是否正确处理了渲染进程发来的不可信数据

### 2. 可读性与简单性

检查：

- React 组件命名是否清楚
- 控制流是否简单（过深嵌套需抽取子组件）
- 是否有聪明但难懂的代码
- 是否有不必要抽象（为假想需求抽取的 custom hook）
- 100 行能完成的事是否写成了 1000 行
- 注释是否解释了非显而易见的意图
- 是否存在死代码、未使用 import、遗留兼容层
- Tailwind 类名组合是否合理，是否需要抽取为 `@apply`

### 3. 架构

检查：

- 是否符合 AttaSeek 三进程分层（main / preload / renderer）
- 组件是否按功能面板组织（ActivityBar / Sidebar / Conversation / Artifact）
- IPC channel 是否定义在 preload 中，类型是否同步
- 是否引入新模式，新模式是否有必要
- 面板间依赖是否合理
- Jotai atoms 作用范围是否恰当（本地 vs 跨面板 vs 全局）
- 是否产生循环依赖

### 4. Electron 安全

**重点审查维度。** 检查：

- contextBridge 暴露的 API 是否最小化（不暴露多余的 Node.js 能力）
- 渲染进程是否**只**通过 `window.api.*` 访问主进程
- 是否禁用了 `nodeIntegration`
- 是否设置了 Content Security Policy
- IPC handler 是否校验了渲染进程的输入
- 文件系统操作是否限制了路径（不访问项目目录外的文件）
- SQL 查询是否参数化（防止注入）
- secret / token 是否出现在代码、日志或版本库
- 外部内容（Agent 输出、工具调用结果）是否当作不可信数据处理
- 依赖是否可信、无已知漏洞、许可证兼容

### 5. 性能

检查：

- 渲染进程：是否有不必要 re-render（Jotai atom 粒度是否合适）
- 渲染进程：长消息列表是否使用虚拟滚动
- 主进程：是否有同步阻塞操作（文件读写应异步）
- 主进程：SQLite 查询是否有 N+1 问题
- IPC：是否有过于频繁的跨进程通信
- Monaco/Terminal：是否按需延迟加载
- 打包：新增依赖体积是否可接受

## 变更大小

目标：

- 约 100 行：很好，容易 review
- 约 300 行：可以接受，但必须是一个逻辑变更
- 约 1000 行：太大，应拆分

原则：

- 一个 PR 只做一件事
- 不要把重构和新功能混在一起
- 不要把格式化和行为变更混在一起
- 大变更按 vertical slice 或进程层（main / preload / renderer）拆分

## 审查流程

### Step 1: 理解上下文

先搞清楚：

- 这个变更要解决什么问题
- 对应哪个 spec 或任务
- 预期行为变化是什么
- 涉及哪些面板和进程层

### Step 2: 先审测试

测试最能说明作者意图。

检查：

- 是否有测试
- 是否测试行为，而不是实现细节
- 是否覆盖边界情况
- 测试名是否清楚
- 测试是否能抓住回归
- 组件测试是否使用 Testing Library（测渲染结果，不测 state/hooks 内部）
- IPC handler 是否有独立的单元测试

### Step 3: 逐层审实现

按 Electron 三层逐文件检查：

1. **主进程**：IPC handler、数据库、文件系统、MCP 子进程管理
2. **预加载**：contextBridge API 签名、类型定义
3. **渲染进程**：React 组件、Jotai atoms、hooks、Tailwind 样式

### Step 4: 给反馈分级

- **Critical**：阻塞合并，必须修
  - contextBridge 暴露了不应暴露的能力
  - nodeIntegration 被设为 true
  - secret 出现在代码中
- **Important**：重要问题，继续前必须修
  - IPC 无输入校验
  - 组件缺少关键错误状态
  - 缺少测试覆盖
- **Nit**：小问题，可选
- **Optional / Consider**：建议
- **FYI**：信息性说明

## 死代码检查

重构或实现后，主动检查是否有未使用代码：

- 未使用的组件
- 未使用的 Jotai atoms
- 未使用的 IPC channels
- 未使用的 custom hooks
- 未使用的 Tailwind 样式

但不要擅自删除不确定的内容。应列出并询问：

"我发现以下元素可能已不再使用，是否删除？"

## 审查结论

每次 review 最后给出：

- **Approve**：可以合并
- **Request changes**：必须修改
- **Needs clarification**：需要更多信息

## 完成检查

- Critical 问题全部解决
- Important 问题解决或有明确延后理由
- Electron 安全检查通过（contextBridge / nodeIntegration / CSP）
- 测试通过
- TypeScript 编译通过
- 构建通过
- 验证过程有记录
