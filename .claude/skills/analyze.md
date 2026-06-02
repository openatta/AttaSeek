---
name: analyze-requirements
description: 需求分析：理解上下文→探索代码→明确边界→产出需求说明
---

# 需求分析

开始声明："正在使用 analyze-requirements。"

## 流程

1. **读输入**：需求来源、涉及面板/模块、约束条件
2. **探索代码**（只读）：查受影响模块、现有模式、可复用组件。项目结构见 CLAUDE.md
3. **定边界**：In scope / Out of scope / 依赖 / 风险
4. **澄清歧义**：不明就向用户确认，不猜测

## 产出格式

```markdown
# [功能名] 需求分析

**目标：** 一句话
**背景：** 为什么做

## 范围
- In scope: ...
- Out of scope: ...
- 依赖: ...
- 涉及面板: ... (ActivityBar/Sidebar/Conversation/Artifact/OutputArea/Settings)

## 用户场景
1. 正常流程: ...
2. 异常流程: ...
3. 边界条件: ...

## 影响范围（按进程层）
- 主进程: ...
- 预加载: ...
- 渲染进程（组件/atoms/样式）: ...

## 风险
- ...
```

## 约束

- 此阶段**禁止写代码**——只产出需求说明
- 禁止写技术实现细节（SQL/API 签名/组件 props）——那是设计阶段的事
- 产出保存到 `docs/requirements/YYYY-MM-DD-[name].md`
- 如需求跨多个独立子系统，建议拆成多个需求文档

## 交接

完成后 → `/design-architecture`（跨模块时）或 `/write-plan`（范围明确时）
