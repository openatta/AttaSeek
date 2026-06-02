---
name: test-driven-development
description: TDD: write failing test first, then minimal implementation, then refactor
---

# 测试驱动开发

开始声明："正在使用 test-driven-development。"

## 铁律

生产代码前必须有失败的测试。**没看到测试失败 = 不确定测试验证了什么。**

## 循环

```
RED    → 写最小测试，描述期望行为（测试名 = 规格说明）
       运行 → 确认以正确原因失败（不是拼写/导入错误）
GREEN  → 只写让测试通过的最少代码（不顺手加功能/重构）
       运行 → 确认新测试+旧测试全通过
REFACTOR → 去重/改名/抽 helper（行为不变）
```

## 测试分层

| 层 | 工具 | 目标占比 |
|----|------|---------|
| 单元 | Vitest | 60% — 组件行为、纯逻辑 |
| 集成 | Vitest | 25% — API、跨组件 |
| E2E | Playwright | 15% — 关键路径 |

## Bug 修复

先写能复现 bug 的测试 → 确认失败 → 修复 → 确认通过。

## 反模式

- 写完代码再补测试
- 测试第一次就通过（说明没测到新行为）
- mock 一切
- 测框架不测自己代码

## 浏览器场景

仅单元测试不够时：打开页面 → 复现 → 检查 console/DOM/network → 修复 → 重新验证
