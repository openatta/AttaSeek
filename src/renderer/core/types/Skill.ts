/**
 * Skill — composable agent capability unit.
 * Not a simple prompt template; includes input/output schemas, required tools, plans, and verification rules.
 */

export type SkillLayer = 'atomic' | 'scenario' | 'workflow'

export type SkillRiskLevel = 'low' | 'medium' | 'high'

export interface SkillManifest {
  id: string
  name: string
  description: string
  layer: SkillLayer
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  requiredTools: string[]
  riskLevel: SkillRiskLevel
  defaultPlan: string
  verificationRules: string[]
  pluginId: string
}

export interface SkillPack {
  id: string
  name: string
  description: string
  version: string
  skills: SkillManifest[]
  tools: string[]
  artifactTypes: string[]
  rendererHints: string[]
  defaultWorkflows: string[]
  permissionDefaults: Record<string, 'allow' | 'ask' | 'deny'>
}
