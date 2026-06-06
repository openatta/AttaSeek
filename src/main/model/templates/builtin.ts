/**
 * Built-in model provider templates — re-exports canonical definitions from shared/types.
 * Main-process consumers should import types from shared/types/model directly;
 * this file exists for backward compatibility.
 */
export { BUILTIN_TEMPLATES, toUITemplates } from '../../../shared/types/model'
export type { UITemplate, ModelTemplate, ProviderInterface } from '../../../shared/types/model'
