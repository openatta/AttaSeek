---
name: code-review
description: "Code review across 5 dimensions: correctness, readability, architecture, security, performance"
---

# 代码审查

开始声明："正在使用 code-review。"

## 审查流程

1. 理解上下文 — 这个变更要解决什么？对应哪个 spec？
2. 先审测试 — 测试是否覆盖关键行为？有没有边界？
3. 审实现 — 按五维逐文件检查
4. 给反馈 — 分级
5. 审查架构设计是否合理，是否有已知的缺陷与不足

## 五维检查

**正确性：** null/空值处理、错误路径、竞态条件、边界值

**可读性：** 命名清楚？嵌套深？抽象必要？100 行能完成别写 1000 行

**架构：** 符合项目分层（主进程/预加载/渲染进程）？模块边界清？循环依赖？

**安全：** contextBridge 暴露最小化？`nodeIntegration: false`？IPC 有输入校验？secret 不出现在日志？

**性能：** 不必要 re-render？N+1 查询？同步阻塞？

## 反馈分级

- **Critical** — 阻塞合并（安全漏洞、`nodeIntegration: true`、secret 泄露）
- **Important** — 必须修（缺测试、无输入校验）
- **Nit** — 可选小问题
- **Suggestion** — 建议

## 审查结论

- **Approve** / **Request changes** / **Needs clarification**

## 死代码

主动发现但不要擅自删除——列出询问用户。
