/**
 * ModelResolver — configuration-layer model selection per usage scenario.
 *
 * Wraps a ResolvedProvider and provides semantic methods that resolve
 * which concrete model name to use for each scenario (main loop, compaction,
 * sub-agent, classifier, etc.). Every method returns a concrete model name
 * — never undefined (ultimate fallback is always the 'model' slot).
 *
 * This is the **configuration layer** — it resolves names, it does not
 * make API calls. The API communication layer is ModelProvider.
 *
 * @remarks
 * Design doc LLM_CONFIG.md §7 refers to this concept as `ModelProvider`
 * (the single entry point for model selection). In code, "ModelProvider"
 * is the API backend interface; this class is the slot resolver.
 *
 * Usage:
 *   const resolver = new ModelResolver(resolvedProvider)
 *   resolver.main()        // → sonnet → model
 *   resolver.compact()     // → compact → haiku → model
 *   resolver.subagent()    // → subagent → sonnet → model
 */

import type { ResolvedProvider, SlotName } from './ProviderDef'

/** Maps SlotName (snake_case) to ResolvedProvider property (camelCase) */
const SLOT_TO_PROP: Record<SlotName, keyof ResolvedProvider> = {
  model: 'model',
  opus: 'opus',
  sonnet: 'sonnet',
  haiku: 'haiku',
  subagent: 'subagent',
  small_fast: 'smallFast',
  strong: 'strong',
  fallback: 'fallback',
  classifier: 'classifier',
  compact: 'compact',
}

export class ModelResolver {
  private provider: ResolvedProvider

  constructor(provider: ResolvedProvider) {
    this.provider = provider
  }

  /** Reload with a new provider (e.g., after config change / env var refresh) */
  reload(provider: ResolvedProvider): void {
    this.provider = provider
  }

  /** Get the raw resolved value for any slot */
  get(slot: SlotName): string {
    return this.provider[SLOT_TO_PROP[slot]] as string
  }

  // ── Semantic accessors (matching LLM_CONFIG.md §7) ──

  /** Main turn loop — uses sonnet slot (coding primary) */
  main(): string {
    return this.get('sonnet')
  }

  /** Deep thinking / auto-routing upgrade target
   *  @reserved — auto-routing not yet implemented */
  opus(): string {
    return this.get('opus')
  }

  /** Coding primary model (same as main()) */
  sonnet(): string {
    return this.get('sonnet')
  }

  /** Lightweight / fast model (classifier, compact, secondary calls)
   *  @reserved — classifier + WebFetch/WebSearch LLM not yet connected */
  haiku(): string {
    return this.get('haiku')
  }

  /** Sub-agent default model */
  subagent(): string {
    return this.get('subagent')
  }

  /** Quick tool call model
   *  @reserved — quick tool calls not yet differentiated */
  smallFast(): string {
    return this.get('small_fast')
  }

  /** Auto-routing upgrade target (tries stronger model)
   *  @reserved — auto-routing not yet implemented */
  strong(): string {
    return this.get('strong')
  }

  /** Overload fallback model (503/529 recovery)
   *  @reserved — overload detection not yet implemented */
  fallback(): string {
    return this.get('fallback')
  }

  /** Permission auto-classifier model
   *  @reserved — permission classifier not yet implemented */
  classifier(): string {
    return this.get('classifier')
  }

  /** Context compaction summary model */
  compact(): string {
    return this.get('compact')
  }

  // ── Metadata ──

  /** The ultimate fallback model name */
  ultimateModel(): string {
    return this.provider.model
  }

  /** API type of the resolved provider */
  get apiType(): 'anthropic' | 'openai_compatible' {
    return this.provider.apiType
  }

  /** Base URL */
  get baseUrl(): string {
    return this.provider.baseUrl
  }

  /** Auth token */
  get authToken(): string {
    return this.provider.authToken
  }

  /** Effort level (if configured) */
  get effortLevel(): string | undefined {
    return this.provider.effortLevel
  }

  /** Max output tokens (if configured) */
  get maxTokens(): number | undefined {
    return this.provider.maxTokens
  }

  /** Compact trigger threshold (if configured) */
  get compactThreshold(): number | undefined {
    return this.provider.compactThreshold
  }
}
