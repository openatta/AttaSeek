/**
 * ToolRouter — selects relevant tools for a task goal to avoid context overflow.
 *
 * MVP (Phase 4): keyword-based Jaccard similarity matching.
 * Phase 5+: sqlite-vec semantic embedding routing (see gap supplement G2).
 */

import type { ToolManifest } from '../../renderer/core/types/Tool'

export interface ToolMatch {
  tool: ToolManifest
  score: number
}

export class ToolRouter {
  private topK: number

  constructor(topK = 5) {
    this.topK = topK
  }

  /** Select Top-K tools most relevant to the goal */
  selectTools(goal: string, tools: ToolManifest[]): ToolManifest[] {
    if (tools.length <= this.topK) return tools

    const goalTokens = this.tokenize(goal.toLowerCase())
    if (goalTokens.size === 0) return tools.slice(0, this.topK)

    const scored: ToolMatch[] = tools.map((tool) => {
      const toolText = `${tool.name} ${tool.description}`.toLowerCase()
      const toolTokens = this.tokenize(toolText)
      const score = this.jaccardSimilarity(goalTokens, toolTokens)
      return { tool, score }
    })

    return scored
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.topK)
      .map((m) => m.tool)
  }

  /** Set the Top-K value */
  setTopK(k: number): void {
    this.topK = k
  }

  // --- private helpers ---

  private tokenize(text: string): Set<string> {
    return new Set(text.split(/[\s,.;:!?()[\]{}<>/\\|@#$%^&*+=~`'"-]+/).filter((t) => t.length > 1))
  }

  private jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    const intersection = new Set([...a].filter((x) => b.has(x)))
    const union = new Set([...a, ...b])
    if (union.size === 0) return 0
    return intersection.size / union.size
  }
}
