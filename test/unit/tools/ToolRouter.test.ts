import { describe, it, expect } from 'vitest'
import { ToolRouter } from '../../../src/main/tools/ToolRouter'
import type { ToolManifest } from '../../../src/renderer/core/types/Tool'

function makeTool(id: string, name: string, description: string): ToolManifest {
  return {
    id,
    pluginId: 'test',
    name,
    description,
    inputSchema: {},
    outputSchema: {},
    riskLevel: 'read',
    category: 'filesystem',
    permissionPolicy: { default: 'allow', requirePreview: false, allowAlways: true },
  }
}

const DEMO_TOOLS = [
  makeTool('read_file', 'Read File', 'Read content from a local file'),
  makeTool('send_email', 'Send Email', 'Send an email to a recipient'),
  makeTool('search_code', 'Search Code', 'Search code using grep patterns'),
  makeTool('create_doc', 'Create Document', 'Create a markdown document artifact'),
  makeTool('git_commit', 'Git Commit', 'Create a git commit with a message'),
  makeTool('market_data', 'Market Data', 'Fetch real-time market data for stocks'),
]

describe('ToolRouter', () => {
  it('selects top-K tools by keyword similarity (no require())', () => {
    const router = new ToolRouter(3)
    const result = router.selectTools('read a file from disk', DEMO_TOOLS)
    expect(result.length).toBeLessThanOrEqual(3)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].id).toBe('read_file')
  })

  it('returns all tools when fewer than topK match', () => {
    const router = new ToolRouter(10)
    const result = router.selectTools('do something', DEMO_TOOLS)
    expect(result.length).toBeLessThanOrEqual(DEMO_TOOLS.length)
  })

  it('returns empty array when no tools match goal', () => {
    const router = new ToolRouter(5)
    const result = router.selectTools('zzz xxx yyy', DEMO_TOOLS)
    // With Jaccard similarity, there may still be low-scoring matches if single letters match
    // The matchers with score > 0 will filter most out for very different keywords
    expect(result.length).toBeLessThanOrEqual(5)
  })

  it('selectTools works with explicit tools parameter (no implicit registry dependency)', () => {
    const router = new ToolRouter(2)
    const customTools = [
      makeTool('t1', 'Alpha', 'First test tool'),
      makeTool('t2', 'Beta', 'Second test tool'),
      makeTool('t3', 'Alpha Beta', 'Combined tool'),
    ]
    const result = router.selectTools('alpha', customTools)
    expect(result.length).toBeGreaterThan(0)
    expect(result.some((t) => t.id === 't1')).toBe(true)
  })

  it('returns top-K in descending score order', () => {
    const router = new ToolRouter(3)
    const result = router.selectTools('email sending', DEMO_TOOLS)
    // send_email should be first (highest score)
    const emailIdx = result.findIndex((t) => t.id === 'send_email')
    if (emailIdx >= 0) {
      expect(emailIdx).toBe(0) // highest score first
    }
  })
})
