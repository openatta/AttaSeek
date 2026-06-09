// Agent engine public API
export { AgentEventBus, agentEventBus } from './AgentEventBus'
export { AgentRuntime, agentRuntime } from './AgentRuntime'
// Phase E: ContextAssembler (unified context assembly with git + attachment + prefetch support)
export { ContextAssembler, contextAssembler } from './context/ContextAssembler'
export type { ContextParams, AssembledContext as AssembledContextV2, SectionTokenUsage, ContextAssemblerConfig } from './context/ContextAssembler'
export { collectGitContext, formatGitContext, clearGitContextCache } from './context/GitContext'
export type { GitState } from './context/GitContext'
export { resolveAttachments } from './context/AttachmentResolver'
export type { Attachment, AttachmentConfig, AttachmentResult, SkippedAttachment } from './context/AttachmentResolver'
export { startMemoryPrefetch, consumeMemoryPrefetch, hasNewMemories } from './context/MemoryPrefetcher'
export type { MemoryPrefetch, MemoryPrefetchResult, MemoryPrefetchConfig } from './context/MemoryPrefetcher'
export type { AgentState, TerminalReason, RecoveryLevel, ContinueReason } from './orchestrator/AgentState'
export { resetPerTurn, withTransition } from './orchestrator/AgentState'

// Phase A: query loop shared types (used by QueryLoopDeps and AgentState)
export type { CallModelParams, CallModelResult, CallModelChunk, CallModelChunkCallback, ToolUseContext, MicrocompactResult, AutocompactResult } from './orchestrator/QueryDeps'
// Note: QueryDeps (the DI interface) is replaced by QueryLoopDeps in query-loop.ts.
// See productionLoopDeps() and QueryLoopDeps for the current DI pattern.
export type { QueryConfig, QuerySource } from './orchestrator/QueryConfig'
export { initQueryConfig, buildQueryConfig } from './orchestrator/QueryConfig'

// Phase A: feature flags
export { isFeatureEnabled, enableFeature, disableFeature, feature, getEnabledFeatures, resetFeatures, FEATURE_FLAGS } from './features/FeatureFlags'
export type { FeatureFlagName } from './features/FeatureFlags'

// Phase A: extended message types
export type { StreamEvent, StreamEventType, TombstoneMessage, ToolUseSummaryMessage, ProgressMessage, LoopMessage, LoopMessageType, RequestStartEvent, ToolProgressCallback } from './messages/MessageTypes'
export type { ToolUseSummaryEntry as MessageToolUseSummaryEntry } from './messages/MessageTypes'
export type { ProgressStage as MessageProgressStage } from './messages/MessageTypes'
export { isTombstoneMessage, isToolUseSummaryMessage, isProgressMessage, isRequestStartEvent, isStreamEvent } from './messages/MessageTypes'

// Phase B: query loop + QueryEngine
export { queryLoop, productionLoopDeps } from './orchestrator/query-loop'
export type { QueryLoopParams, QueryLoopDeps } from './orchestrator/query-loop'
export { QueryEngine, getQueryEngine, removeQueryEngine, hasQueryEngine } from './orchestrator/QueryEngine'
export type { QueryEngineConfig } from './orchestrator/QueryEngine'

export { SubAgentManager, subAgentManager } from './subagent/SubAgentManager'
export type { SubAgentInfo, SubAgentResult } from './subagent/SubAgentManager'
export type { SubAgentContext } from './subagent/SubAgentContext'
export { validateProfile } from './profile/AgentProfile'
export type { AgentProfile } from './profile/AgentProfile'
export { renderPrompt } from './prompt/PromptTemplate'
export type { PromptTemplate, PromptSection, PromptContext } from './prompt/PromptTemplate'
export type { ModelProvider, LLMChatParams, LLMChatResult, LLMChunk, LLMChunkCallback } from './llm/ModelProvider'
export { LLMError, isCredentialExpiredError } from './llm/ModelProvider'

// Phase E: LLM upgrades (retry 10x, fallback, prompt cache)
export { withRetry, classifyError, isRetryable, retryOnRateLimit, retryOnOverload, retryOnServerError, retryOnNetworkError, FallbackTriggeredError } from './llm/withRetry'
export type { RetryOptions, RetryReason } from './llm/withRetry'
export { resolveFallback } from './llm/ProviderFallback'
export type { FallbackResult, FallbackConfig } from './llm/ProviderFallback'
export { preparePromptCache, buildCacheKey, splitSystemPrompt, registerCacheKey, lookupCacheKey, clearCacheRegistry } from './llm/PromptCache'
export type { PromptCacheConfig, CacheInfo, CacheBreakpoint } from './llm/PromptCache'
export { AnthropicProvider } from './llm/AnthropicProvider'
export { ModelProviderRegistry, modelProviderRegistry } from './llm/ModelProviderRegistry'
export { createProvider } from './llm/ProviderFactory'
export { ModelResolver } from './llm/ModelResolver'
export { loadLLMConfig, listProviders, saveProvider, deleteProvider } from './llm/AttaSettingsLoader'
export type { LoadResult } from './llm/AttaSettingsLoader'
export type { ProviderDef, ResolvedProvider, SlotName } from './llm/ProviderDef'
export { SLOT_FALLBACK_CHAINS, SLOT_FIELD_NAMES } from './llm/ProviderDef'
// Tool execution (Phase D enhancements)
export { orchestrateTools, orchestrateToolsWithContext, isConcurrencySafe, isReadOnly, partitionToolCalls } from './tools/ToolOrchestrator'
export type { ToolExecResult, ToolOrchestrationResult } from './tools/ToolOrchestrator'
export { StreamingToolExecutor } from './tools/StreamingToolExecutor'
export { ToolProgressBus } from './tools/ToolProgressBus'
export type { ToolProgressEvent, ProgressStage } from './tools/ToolProgressBus'
export { createToolUseContext, composeModifiers, applyModifiers } from './tools/ToolContextModifier'
export type { ToolUseContext as ToolExecContext, ContextModifier, ToolDef, PermissionMode, QueryTracking, ToolOptions } from './tools/ToolContextModifier'

// Compaction (Phase C — new modules; ContextCompactor kept for backward compat)
export { shouldCompact, compactConversation, isContextLengthError, reactiveCompact, microcompact } from './compact/ContextCompactor'
export type { CompactResult, CompactOptions } from './compact/ContextCompactor'
// Phase C: 5-stage compaction pipeline
export { runCompactionPipeline, runReactiveCompaction } from './compact/CompactionPipeline'
export type { PipelineResult, PipelineConfig } from './compact/CompactionPipeline'
export { snipCompact, aggressiveSnip, findSnipBoundary } from './compact/SnipCompactor'
export type { SnipResult, SnipConfig } from './compact/SnipCompactor'
export { microcompactResults, microcompactMessages, timeMicrocompact } from './compact/Microcompactor'
export type { MicrocompactResult as MicrocompactResultC, CacheEdit } from './compact/Microcompactor'
export { CollapseManager } from './compact/CollapseManager'
export type { CollapseResult } from './compact/CollapseManager'
export { CollapseStore } from './compact/CollapseStore'
export type { CollapseCommit, CollapseState } from './compact/CollapseStore'
export { autoCompact, autoCompactIfNeeded, shouldAutoCompact, createAutoCompactTracking, updateAutoCompactTracking } from './compact/AutoCompactor'
export type { AutoCompactResult, AutoCompactOptions, AutoCompactTracking } from './compact/AutoCompactor'
export { isMediaSizeError } from './compact/ReactiveCompactor'
export type { ReactiveCompactResult, ReactiveStrategy } from './compact/ReactiveCompactor'
export { extractMemories } from './memory/MemoryExtractor'
export { loadFileMemories, toMemoryEntries } from './memory/FileMemory'
export type { FileMemoryEntry } from './memory/FileMemory'
export { initSessionMemory, maybeUpdateSessionMemory, getSessionMemoryContent, clearSessionMemory } from './memory/SessionMemory'
export type { SessionMemoryState } from './memory/SessionMemory'
export { loadMemoryPrompt, findRelevantMemories, findRelevantMemoriesLLM, ensureMemoryDir } from './memory/MemdirManager'
export type { MemoryIndexEntry, MemoryPrompt } from './memory/MemdirManager'

// Profiles
export { codingProfile } from './profile/profiles/coding-profile'
export { researchProfile } from './profile/profiles/research-profile'
export { writingProfile } from './profile/profiles/writing-profile'
export { coordinatorProfile } from './profile/profiles/coordinator-profile'
export { templateProfile } from './profile/profiles/_TEMPLATE'

// Prompt sections (for profile composition)
export { introSection } from './prompt/sections/intro'
export { systemSection } from './prompt/sections/system'
export { doingTasksSection } from './prompt/sections/doing-tasks'
export { actionsSection } from './prompt/sections/actions'
export { usingToolsSection } from './prompt/sections/using-tools'
export { toneAndStyleSection } from './prompt/sections/tone-and-style'
export { outputEfficiencySection } from './prompt/sections/output-efficiency'
export { sessionGuidanceSection } from './prompt/sections/session-guidance'
export { memoryContextSection } from './prompt/sections/memory-context'
export { envInfoSection } from './prompt/sections/env-info'
export { languageSection } from './prompt/sections/language'
export { mcpInstructionsSection } from './prompt/sections/mcp-instructions'
export { scratchpadSection } from './prompt/sections/scratchpad'
export { summarizeResultsSection } from './prompt/sections/summarize-results'

// Built-in sub-agent profiles
export { exploreAgentProfile } from './subagent/built-in/explore-agent'
export { planAgentProfile } from './subagent/built-in/plan-agent'
export { reviewAgentProfile } from './subagent/built-in/review-agent'
export { verifyAgentProfile } from './subagent/built-in/verify-agent'

// Phase C: Unified error recovery router
export { routeError, createRecoveryState, isMediaSizeError as isRecoveryMediaSizeError, escalateMaxOutputTokens, MAX_OUTPUT_RECOVERY_ATTEMPTS } from './orchestrator/recovery-router'
export type { RecoveryState, RecoveryRouteResult } from './orchestrator/recovery-router'

// Phase C: Token budget tracking
export { TokenBudgetTracker } from './orchestrator/token-budget'
export type { TokenBudgetConfig, TokenBudgetState, BudgetSignal } from './orchestrator/token-budget'

// Phase C: Tool use summary
export { generateToolUseSummary, buildToolUseSummaryMessage, generateLLMToolUseSummary } from './orchestrator/tool-summary'
export type { ToolUseSummary, ToolUseSummaryEntry } from './orchestrator/tool-summary'

// Phase C: Cost tracking
export { CostTracker, costTracker } from './llm/cost-tracker'
export type { CostEntry, CostSummary } from './llm/cost-tracker'

// Phase C: Query profiling
export { queryCheckpoint, logQueryProfileReport } from './telemetry/QueryProfiler'

// Phase C: VCR recording/replay
export { wrapWithVCR, VCRRecorder, VCRReplayer, hashRequest, getVCRPath, setVCRDir } from './llm/vcr'
export type { VCREntry } from './llm/vcr'

// Phase C: Cache break detection
export { CacheBreakDetector, cacheBreakDetector } from './llm/cache-break-detector'
export type { CacheState, CacheBreakDiagnostic } from './llm/cache-break-detector'

// Phase C: Per-message cache control
export { applyPerMessageCacheControl, shouldUsePerMessageCaching, buildCacheControl } from './llm/PromptCache'

// Phase C: Hook HTTP executor
export { execHttpHook } from './hooks/execHttpHook'

// Phase C: Prompt hook provider setter
export { setPromptHookProvider } from './hooks/execPromptHook'

// Phase C: MCP tool refresh
export { mcpServerManager } from './mcp/MCPServerManager'

// Phase C: Skill activation
export { shouldActivateSkill, filterActiveSkills, extractTouchedFiles } from './skills/skill-activation'
export type { ActivationContext } from './skills/skill-activation'

// Phase C: Skill executor
export { executeSkill, hasShellBlocks } from './skills/SkillExecutor'
export type { SkillExecOptions, SkillExecResult } from './skills/SkillExecutor'

// Phase C: Bundled skills
export { getBundledSkills, findBundledSkill, BUNDLED_DEFS } from './skills/bundled-skills'

// Phase C: Cron scheduler
export { CronScheduler, cronScheduler } from './CronScheduler'
export type { CronJob } from './CronScheduler'

// Phase C: Monitor manager
export { MonitorManager, monitorManager } from './MonitorManager'
export type { MonitorInstance, MonitorEvent } from './MonitorManager'

// Phase C: Swarm manager
export { SwarmManager, swarmManager } from './coordinator/SwarmManager'
export type { Teammate, TeamConfig, SendMessageResult } from './coordinator/SwarmManager'

// Phase C: Task notification queue (background worker results)
export { TaskNotificationQueue, taskNotificationQueue } from './coordinator/TaskNotificationQueue'

// Phase C: Tool implementations — Cron, Monitor, Workflow, ToolSearch
export { cronCreateManifest, cronDeleteManifest, cronListManifest, cronCreateImpl, cronDeleteImpl, cronListImpl } from './tools/implementations/cron-tools'
export { monitorManifest, monitorImpl } from './tools/implementations/monitor-tools'
export { workflowManifest, workflowImpl } from './tools/implementations/workflow-tools'
export { toolSearchManifest, toolSearchImpl, TOOL_SEARCH_TOOL_NAME } from './tools/implementations/tool-search'

// Phase C: SendMessage tool (worker continuation)
export { SEND_MESSAGE_TOOLS } from './tools/implementations/send-message-tools'
export { sendMessageImpl } from './tools/implementations/send-message-impl'
