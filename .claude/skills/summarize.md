---
name: summarize-changes
description: 变更总结：每次修改后输出结构化总结——改了什么、没改什么、风险、验证、下一步
---

# 变更总结

## 概述

每次修改后，给出结构化变更总结。

目的：

- 让 review 更容易
- 记录变更范围
- 暴露潜在风险
- 证明没有越界修改
- 帮助后续 agent 或人类理解上下文

开始时声明：

"我正在使用 summarize-changes skill 总结变更。"

## 什么时候使用

使用场景：

- 完成一个任务后
- 完成一个 slice 后
- commit 前
- PR 前
- bug fix 后
- code review 前
- 用户问"你改了什么"时

## 总结格式

```markdown
## CHANGES MADE

### 主进程
- `src/main/ipc/some-handler.ts`：说明改了什么
- `src/main/store/db.ts`：说明改了什么

### 预加载
- `src/preload/index.ts`：新增了什么 API 暴露

### 渲染进程
- `src/renderer/components/Feature/NewPanel.tsx`：说明改了什么
- `src/renderer/atoms/someAtom.ts`：说明改了什么

### 测试
- `test/unit/main/some-handler.test.ts`：新增了什么测试
- `test/e2e/feature.spec.ts`：新增了什么 E2E 测试

### 依赖
- 新增：`package-name@version` — 用途
- 移除：`package-name` — 原因

## THINGS I DIDN'T TOUCH INTENTIONALLY

- `src/renderer/components/Sidebar.tsx`：发现相关问题，但不属于本任务范围
- `src/main/ipc/legacy-handler.ts`：看起来可以清理，但未确认安全

## POTENTIAL CONCERNS

- 新增 IPC channel 需要确认不影响现有 channel 的性能
- 新增依赖增加打包体积约 XX KB，需要确认是否可接受
- 某组件行为与旧版本略有差异，需要用户确认

## VERIFICATION

- 已运行：`npx vitest run` — 结果：通过
- 已运行：`npx tsc --noEmit` — 结果：通过
- 已运行：`npm run build` — 结果：通过
- 手工验证：启动 Electron，在 Conversation 面板中验证新功能正常
- Electron 特定验证：主进程重启后 IPC 通信正常 ✓

## NEXT STEPS

- 建议进入 `/code-review`
- 建议运行 E2E 测试
- 建议在 Windows/Linux 上验证
```

## 总结原则

- 不夸大完成情况
- 明确说哪些没做
- 明确说哪些有风险
- 不把测试没跑说成已验证
- 不隐藏失败项
- 不把无关修改混进总结
- **按进程层分组**：主进程 / 预加载 / 渲染进程

## 完成检查

- 每个变更文件都已列出（按进程层分组）
- 故意没改的内容已说明
- 依赖变更已记录
- 风险和关注点已标记
- 验证步骤和结果已记录
- Electron 特定验证已执行
- 下一步建议已给出
