/**
 * SkillTool — invoke a registered skill by ID.
 *
 * Skills are prompt/instruction-based, not self-executing functions.
 * This tool returns the skill's plan and verification rules as structured
 * instructions for the LLM to follow.
 */

import { skillRegistry } from '../../../skills/SkillRegistry'

export const invokeSkillImpl = {
  toolId: 'invoke_skill',
  execute: async (input: Record<string, unknown>) => {
    const skillId = String(input.skill_id || '')
    if (!skillId) throw new Error('skill_id is required')

    const skill = skillRegistry.get(skillId)
    if (!skill) {
      const available = skillRegistry.list().map(s => s.id).join(', ')
      throw new Error(`Skill "${skillId}" not found. Available skills: ${available || '(none registered)'}`)
    }

    const lines: string[] = [
      `## Skill: ${skill.name}`,
      `**ID:** ${skill.id}`,
      `**Layer:** ${skill.layer}`,
      `**Description:** ${skill.description}`,
      `**Risk Level:** ${skill.riskLevel}`,
    ]

    if (skill.defaultPlan) {
      lines.push('', '### Execution Plan')
      lines.push(skill.defaultPlan)
    }

    if (skill.verificationRules && skill.verificationRules.length > 0) {
      lines.push('', '### Verification Rules')
      for (const rule of skill.verificationRules) {
        lines.push(`- ${rule}`)
      }
    }

    if (skill.requiredTools && skill.requiredTools.length > 0) {
      lines.push('', '### Required Tools')
      lines.push(skill.requiredTools.join(', '))
    }

    return lines.join('\n')
  },
}
