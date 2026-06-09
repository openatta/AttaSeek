/**
 * bundled-skills — Built-in skill definitions registered at compile time.
 *
 * Mirrors Claude Code's bundledSkills.ts. These skills are always available
 * and don't require filesystem loading. They serve as the 'bundled' source
 * in SkillSourceLoader's priority chain (managed > user > project > bundled).
 *
 * Each bundled skill has:
 *   - name, description: for LLM tool-use selection
 *   - body: markdown content (can reference ${CLAUDE_SKILL_DIR}, ${1}, etc.)
 *   - allowedTools: whitelist of tools this skill can use
 *   - context: 'inline' (default) or 'fork' (isolated sub-agent)
 *   - shell: whether inline shell execution is enabled
 *
 * AttaSeek's 12 built-in skills (atta-*) are registered here and no longer
 * hardcoded in the system prompt.
 */

import type { SkillManifest } from '../../../shared/types/Skill'

// ── Built-in skill definitions ──

interface BundledSkillDef {
  name: string
  description: string
  /** Markdown body — the skill's prompt template. */
  body: string
  /** Tools this skill is allowed to use (['*'] = all). */
  allowedTools?: string[]
  /** Run inline or in a forked sub-agent. */
  context?: 'inline' | 'fork'
  /** Whether inline shell execution is enabled. */
  shell?: boolean
  /** User-invocable via /name. Set false for internal-only skills. */
  userInvocable?: boolean
  /** Aliases (e.g., 'status' for 'atta-status'). */
  aliases?: string[]
  /** Risk level for permission decisions. */
  riskLevel?: 'read' | 'write' | 'risky'
}

const BUNDLED_DEFS: BundledSkillDef[] = [
  {
    name: 'atta-analyze-requirements',
    description: '需求分析 — 明确做什么、为什么做、划定范围边界。产出需求规格文档，为架构设计提供输入。',
    body: `# 需求分析\n\n分析用户需求，明确范围边界，产出需求规格文档。\n\n## 流程\n1. 理解用户意图\n2. 梳理功能边界（In/Out）\n3. 识别非功能需求\n4. 产出需求规格文档到 docs/reqs/`,
    allowedTools: ['*'],
    context: 'inline',
    userInvocable: true,
    riskLevel: 'read',
  },
  {
    name: 'atta-design-architecture',
    description: '架构设计 — 组件划分、数据流、IPC 契约、状态原子、技术决策。产出设计文档，为实现提供蓝图。',
    body: `# 架构设计\n\n基于需求规格文档，设计技术方案。\n\n## 流程\n1. 组件划分与职责\n2. 数据流设计\n3. IPC 契约定义\n4. 状态原子设计\n5. 关键决策记录\n6. 产出设计文档到 docs/design/`,
    allowedTools: ['*'],
    context: 'inline',
    userInvocable: true,
    riskLevel: 'read',
  },
  {
    name: 'atta-plan-and-execute',
    description: '计划与实施 — 将需求/设计/方案分解为可执行任务，逐任务实施验证。',
    body: `# 计划与实施\n\n将设计方案分解为可执行的任务列表，逐个实施并验证。\n\n## 流程\n1. 分解任务（TaskCreate）\n2. 逐任务实施\n3. 每个 task 后 typecheck + build\n4. 完成后全量验证`,
    allowedTools: ['*'],
    context: 'inline',
    userInvocable: true,
    riskLevel: 'write',
  },
  {
    name: 'atta-review-and-fix',
    description: '检视与修复 — 审查变更的正确性/可读性/架构/安全/性能，修复发现的问题，产出变更总结。',
    body: `# 检视与修复\n\n审查本次代码变更，修复发现的问题。\n\n## 流程\n1. 正确性检查（逻辑/类型/边界）\n2. 可读性检查（命名/注释/结构）\n3. 架构检查（耦合/抽象/SRP）\n4. 安全检查（注入/泄露/权限）\n5. 性能检查（N+1查询/不必要的IO）\n6. 修复问题\n7. 产出变更总结`,
    allowedTools: ['*'],
    context: 'inline',
    userInvocable: true,
    riskLevel: 'read',
  },
  {
    name: 'atta-implement',
    description: '实施（快捷） — 合并计划与实施 + 检视与修复最后两步。适用于已有清晰设计/方案、改动范围可控的场景。',
    body: `# 实施（快捷路径）\n\n合并 plan-and-execute + review-and-fix。\n\n## 前置条件\n- 已有清晰的设计文档或修复方案\n- 改动范围可控\n\n## 流程\n1. 按设计/方案实施\n2. 自检变更\n3. 验证 + 审查\n4. 产出变更总结`,
    allowedTools: ['*'],
    context: 'inline',
    userInvocable: true,
    riskLevel: 'write',
  },
  {
    name: 'atta-feature-dev',
    description: '特性开发（简化全流程） — 端到端完成特性：需求分析→架构设计→实施→检视。实施前输出简报让用户决策。',
    body: `# 特性开发（简化全流程）\n\n端到端完成一个特性的开发。\n\n## 阶段1: 分析与设计（只读）\n- 定义范围、设计结构、关键决策\n- 产出实施路径（task列表）\n\n## 阶段2: 决策门\n- 输出简报，等待用户确认\n\n## 阶段3: 实施与收尾\n- TDD编码 → 自检 → 验证 → 全量验证 → 变更总结`,
    allowedTools: ['*'],
    context: 'inline',
    userInvocable: true,
    riskLevel: 'write',
  },
  {
    name: 'atta-bug-fix',
    description: 'BUG修复（简化全流程） — 端到端完成修复：问题诊断→修改方案→实施→检视。实施前输出简报让用户决策。',
    body: `# BUG修复（简化全流程）\n\n端到端完成一个bug的修复。\n\n## 阶段1: 诊断与分析（只读）\n- 问题描述、复现步骤、影响范围\n\n## 阶段2: 决策门\n- 输出简报，等待用户确认\n\n## 阶段3: 修复与收尾\n- 实施修复 → 验证 → 回归检查 → 变更总结`,
    allowedTools: ['*'],
    context: 'inline',
    userInvocable: true,
    riskLevel: 'write',
  },
  {
    name: 'atta-describe-problem',
    description: '问题说明 — 精确描述缺陷的症状、复现步骤、影响范围。不分析根因，不提出修复方案。',
    body: `# 问题说明\n\n精确描述问题，不分析根因，不提出方案。\n\n## 产出\n- 症状描述\n- 复现步骤\n- 影响范围\n- 出现频率`,
    allowedTools: ['read_file', 'search_code', 'grep', 'glob'],
    context: 'inline',
    userInvocable: true,
    riskLevel: 'read',
  },
  {
    name: 'atta-design-fix',
    description: '修改方案 — 定位根因、设计修复路径、评估风险。不实施修复代码。',
    body: `# 修改方案\n\n定位根因，设计修复路径。只读代码，不改代码。\n\n## 产出\n- 根因分析\n- 修复路径\n- 风险评估\n- 涉及文件列表`,
    allowedTools: ['read_file', 'search_code', 'grep', 'glob'],
    context: 'inline',
    userInvocable: true,
    riskLevel: 'read',
  },
  {
    name: 'atta-status',
    description: '项目状态评估 — 全面审计代码库与文档的一致性，发现差异、缺失、冗余。只读不写。',
    body: `# 项目状态评估\n\n审计代码库与文档的一致性。\n\n## 流程\n1. 审计代码结构\n2. 检查文档覆盖\n3. 发现差异/缺失/冗余\n4. 产出状态报告`,
    allowedTools: ['read_file', 'search_code', 'grep', 'glob', 'lsp_definition', 'lsp_references'],
    context: 'inline',
    userInvocable: true,
    riskLevel: 'read',
  },
  {
    name: 'atta-refactor',
    description: '重构优化 — 分析代码质量并实施重构。不添加特性、不修复BUG。',
    body: `# 重构优化\n\n分析代码质量并实施重构，保持行为不变。\n\n## 流程\n1. 七维分析（结构/耦合/命名/重复/错误处理/测试/性能）\n2. 输出重构计划\n3. 用户确认\n4. 逐项重构\n5. 回归验证`,
    allowedTools: ['*'],
    context: 'inline',
    userInvocable: true,
    riskLevel: 'write',
  },
  {
    name: 'atta-help',
    description: 'AttaSeek 开发工作流帮助 — 展示 skill 体系全景、选径指南、各 skill 速查。',
    body: `# 开发工作流帮助\n\n展示 AttaSeek 的12个 skill 和选径指南。\n\n## Skill 体系\n\n### 完整流程（分步执行）\n- /atta-analyze-requirements → /atta-design-architecture → /atta-plan-and-execute → /atta-review-and-fix\n- /atta-describe-problem → /atta-design-fix → /atta-plan-and-execute → /atta-review-and-fix\n\n### 快捷路径\n- /atta-implement（合并最后两步）\n\n### 简化全流程\n- /atta-feature-dev（特性开发端到端）\n- /atta-bug-fix（BUG修复端到端）\n\n### 辅助\n- /atta-status（项目状态评估）\n- /atta-refactor（重构优化）\n- /atta-help（本帮助）`,
    allowedTools: ['read_file'],
    context: 'inline',
    userInvocable: true,
    riskLevel: 'read',
  },
]

// ── Conversion ──

/**
 * Convert bundled skill definitions to SkillManifest format
 * suitable for registration in the skill system.
 */
export function getBundledSkills(): SkillManifest[] {
  return BUNDLED_DEFS.map(def => ({
    id: `bundled:${def.name}`,
    name: def.name,
    description: def.description,
    layer: (def.context === 'fork' ? 'workflow' : 'scenario') as SkillManifest['layer'],
    requiredTools: def.allowedTools || ['*'],
    riskLevel: def.riskLevel || 'read',
    // Extension fields for runtime
    body: def.body,
    shell: def.shell || false,
    context: def.context || 'inline',
    userInvocable: def.userInvocable ?? true,
    aliases: def.aliases || [],
  } as unknown as SkillManifest))
}

/** Look up a bundled skill by name or alias. */
export function findBundledSkill(name: string): BundledSkillDef | undefined {
  return BUNDLED_DEFS.find(
    d => d.name === name || d.aliases?.includes(name),
  )
}

export { BUNDLED_DEFS }
