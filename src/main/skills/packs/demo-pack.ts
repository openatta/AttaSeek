/**
 * Demo Skill Pack — built-in skills for MVP validation.
 * Registered at startup via SkillRegistry.
 */

import type { SkillManifest } from '../../../shared/types/Skill'

export const DEMO_SKILLS: SkillManifest[] = [
  {
    id: 'summarize',
    name: 'Summarize',
    description: 'Summarize content into concise key points',
    layer: 'atomic',
    inputSchema: { content: 'string' },
    outputSchema: { summary: 'string' },
    requiredTools: [],
    riskLevel: 'low',
    defaultPlan: 'Read content → Extract key points → Generate summary',
    verificationRules: ['Summary must be shorter than original', 'Must include main topics'],
    pluginId: 'builtin-core',
  },
  {
    id: 'generate_doc',
    name: 'Generate Document',
    description: 'Generate a structured Markdown document from requirements',
    layer: 'atomic',
    inputSchema: { topic: 'string', format: 'string' },
    outputSchema: { document: 'string' },
    requiredTools: ['create_document', 'read_file'],
    riskLevel: 'low',
    defaultPlan: 'Gather context → Generate outline → Write document → Verify',
    verificationRules: ['Document must be well-structured', 'Must include all requested sections'],
    pluginId: 'builtin-core',
  },
  {
    id: 'review_code',
    name: 'Review Code',
    description: 'Review code for correctness, readability, and potential issues',
    layer: 'atomic',
    inputSchema: { code: 'string', language: 'string' },
    outputSchema: { review: 'string', issues: 'array' },
    requiredTools: ['read_file'],
    riskLevel: 'low',
    defaultPlan: 'Read code → Analyze patterns → Identify issues → Generate review',
    verificationRules: ['Must cover correctness', 'Must cover readability'],
    pluginId: 'builtin-core',
  },
  {
    id: 'project_report',
    name: 'Project Report',
    description: 'Generate a project status report combining summarize + generate_doc',
    layer: 'scenario',
    inputSchema: { projectId: 'string', timeframe: 'string' },
    outputSchema: { report: 'string' },
    requiredTools: ['read_file', 'create_document'],
    riskLevel: 'low',
    defaultPlan: 'Collect project data → Summarize changes → Generate report → Verify',
    verificationRules: ['Must include key metrics', 'Must list open issues', 'Must include timeline'],
    pluginId: 'builtin-core',
  },
]

export const DEMO_PACK = {
  id: 'builtin-core',
  name: 'Built-in Core Skills',
  description: 'Default skill pack for all AttaSeek installations',
  version: '1.0.0',
  skills: DEMO_SKILLS,
  tools: ['read_file', 'create_document', 'search_code'],
  artifactTypes: ['markdown', 'code', 'diff', 'table'],
  rendererHints: ['markdown', 'code', 'diff'],
  defaultWorkflows: ['project_report', 'generate_doc'],
  permissionDefaults: {
    read_file: 'allow',
    create_document: 'ask',
    search_code: 'allow',
  },
}
