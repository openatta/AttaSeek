/**
 * Model Configure — shared types usable by both main and renderer processes.
 */

export interface ModelConfig {
  id: string
  name: string
  interfaceType: 'openai_compatible' | 'anthropic'
  endpointUrl: string
  models: string[]
  defaultModel: string
  extraParams?: Record<string, unknown>
  isDefault: boolean
  createdAt: number
  updatedAt: number
}

export interface CreateModelConfig {
  name: string
  interfaceType: 'openai_compatible' | 'anthropic'
  endpointUrl: string
  apiKey: string
  models: string[]
  defaultModel: string
  extraParams?: Record<string, unknown>
}

// ── Model provider templates (canonical source — consumed by main and renderer) ──

export interface ProviderInterface {
  type: 'anthropic' | 'openai_compatible'
  endpointUrl: string
  defaultModels: string[]
  defaultModel: string
}

export interface ModelTemplate {
  id: string; name: string; provider: string
  interfaces: ProviderInterface[]
  envKey: string; apiKeyUrl: string; apiKeyHeader: string
  apiKeyPrefix?: string; recommendedParams: Record<string, unknown>
  iconType: string; region: 'international' | 'china'; version: number
}

/** Flattened template for UI — one entry per interface */
export interface UITemplate {
  id: string; name: string
  iface: 'anthropic' | 'openai_compatible'
  endpoint: string; models: string; dmodel: string
  altEndpoint?: string; altModels?: string; altDmodel?: string
}

export function toUITemplates(templates: ModelTemplate[]): UITemplate[] {
  return templates.map(t => ({
    id: t.id, name: t.name,
    iface: t.interfaces[0].type,
    endpoint: t.interfaces[0].endpointUrl,
    models: t.interfaces[0].defaultModels.join(', '),
    dmodel: t.interfaces[0].defaultModel,
    altEndpoint: t.interfaces[1]?.endpointUrl,
    altModels: t.interfaces[1]?.defaultModels.join(', '),
    altDmodel: t.interfaces[1]?.defaultModel,
  }))
}

export const BUILTIN_TEMPLATES: ModelTemplate[] = [
  { id:'anthropic', name:'Anthropic Claude', provider:'Anthropic',
    interfaces: [{ type:'anthropic', endpointUrl:'https://api.anthropic.com', defaultModels:['claude-sonnet-4-6','claude-haiku-4-5-20251001','claude-opus-4-8'], defaultModel:'claude-sonnet-4-6' }],
    envKey:'ANTHROPIC_API_KEY', apiKeyUrl:'https://console.anthropic.com/keys', apiKeyHeader:'x-api-key',
    recommendedParams:{temperature:0.7,maxTokens:4096}, iconType:'anthropic', region:'international', version:1 },
  { id:'openai', name:'OpenAI', provider:'OpenAI',
    interfaces: [{ type:'openai_compatible', endpointUrl:'https://api.openai.com/v1', defaultModels:['gpt-4o','gpt-4o-mini','gpt-4.1'], defaultModel:'gpt-4o' }],
    envKey:'OPENAI_API_KEY', apiKeyUrl:'https://platform.openai.com/api-keys', apiKeyHeader:'Authorization', apiKeyPrefix:'Bearer ',
    recommendedParams:{temperature:0.7,maxTokens:4096}, iconType:'openai', region:'international', version:1 },
  { id:'gemini', name:'Google Gemini', provider:'Google',
    interfaces: [{ type:'openai_compatible', endpointUrl:'https://generativelanguage.googleapis.com/v1beta/openai', defaultModels:['gemini-2.5-pro','gemini-2.5-flash','gemini-2.0-flash'], defaultModel:'gemini-2.5-flash' }],
    envKey:'GEMINI_API_KEY', apiKeyUrl:'https://aistudio.google.com/apikey', apiKeyHeader:'Authorization', apiKeyPrefix:'Bearer ',
    recommendedParams:{temperature:0.7,maxTokens:8192}, iconType:'gemini', region:'international', version:1 },
  { id:'grok', name:'xAI Grok', provider:'xAI',
    interfaces: [{ type:'openai_compatible', endpointUrl:'https://api.x.ai/v1', defaultModels:['grok-4','grok-4-mini'], defaultModel:'grok-4' }],
    envKey:'XAI_API_KEY', apiKeyUrl:'https://x.ai/api', apiKeyHeader:'Authorization', apiKeyPrefix:'Bearer ',
    recommendedParams:{temperature:0.7,maxTokens:4096}, iconType:'grok', region:'international', version:1 },
  { id:'mistral', name:'Mistral AI', provider:'Mistral',
    interfaces: [{ type:'openai_compatible', endpointUrl:'https://api.mistral.ai/v1', defaultModels:['mistral-large','mistral-small','codestral'], defaultModel:'mistral-large' }],
    envKey:'MISTRAL_API_KEY', apiKeyUrl:'https://console.mistral.ai/api-keys', apiKeyHeader:'Authorization', apiKeyPrefix:'Bearer ',
    recommendedParams:{temperature:0.7,maxTokens:4096}, iconType:'mistral', region:'international', version:1 },
  { id:'cohere', name:'Cohere', provider:'Cohere',
    interfaces: [{ type:'openai_compatible', endpointUrl:'https://api.cohere.com/v1', defaultModels:['command-r-plus','command-r'], defaultModel:'command-r-plus' }],
    envKey:'COHERE_API_KEY', apiKeyUrl:'https://dashboard.cohere.com/api-keys', apiKeyHeader:'Authorization', apiKeyPrefix:'Bearer ',
    recommendedParams:{temperature:0.7,maxTokens:4096}, iconType:'cohere', region:'international', version:1 },
  { id:'deepseek', name:'DeepSeek', provider:'DeepSeek (深度求索)',
    interfaces: [
      { type:'openai_compatible', endpointUrl:'https://api.deepseek.com/v1', defaultModels:['deepseek-v4-pro','deepseek-v4-flash'], defaultModel:'deepseek-v4-pro' },
      { type:'anthropic', endpointUrl:'https://api.deepseek.com/anthropic', defaultModels:['deepseek-v4-pro','deepseek-v4-flash'], defaultModel:'deepseek-v4-pro' }],
    envKey:'DEEPSEEK_API_KEY', apiKeyUrl:'https://platform.deepseek.com/api_keys', apiKeyHeader:'Authorization', apiKeyPrefix:'Bearer ',
    recommendedParams:{temperature:0.7,maxTokens:4096}, iconType:'deepseek', region:'china', version:3 },
  { id:'qwen', name:'Qwen (通义千问)', provider:'Alibaba Cloud',
    interfaces: [
      { type:'openai_compatible', endpointUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModels:['qwen-max','qwen-plus','qwen-turbo'], defaultModel:'qwen-max' },
      { type:'anthropic', endpointUrl:'https://dashscope.aliyuncs.com/compatible-mode/anthropic', defaultModels:['qwen3-coder-plus','qwen3.7-max','qwen3.6-plus'], defaultModel:'qwen3.7-max' }],
    envKey:'DASHSCOPE_API_KEY', apiKeyUrl:'https://bailian.console.aliyun.com/', apiKeyHeader:'Authorization', apiKeyPrefix:'Bearer ',
    recommendedParams:{temperature:0.7,maxTokens:4096}, iconType:'qwen', region:'china', version:2 },
  { id:'kimi', name:'Kimi (月之暗面)', provider:'Moonshot AI',
    interfaces: [
      { type:'openai_compatible', endpointUrl:'https://api.moonshot.cn/v1', defaultModels:['kimi-k2-0905-preview','kimi-k2-turbo-preview'], defaultModel:'kimi-k2-0905-preview' },
      { type:'anthropic', endpointUrl:'https://api.moonshot.cn/anthropic', defaultModels:['kimi-k2-0905-preview','kimi-k2-turbo-preview'], defaultModel:'kimi-k2-0905-preview' }],
    envKey:'MOONSHOT_API_KEY', apiKeyUrl:'https://platform.moonshot.cn/console/api-keys', apiKeyHeader:'Authorization', apiKeyPrefix:'Bearer ',
    recommendedParams:{temperature:0.7,maxTokens:4096}, iconType:'kimi', region:'china', version:3 },
  { id:'glm', name:'GLM (智谱)', provider:'Zhipu AI',
    interfaces: [
      { type:'openai_compatible', endpointUrl:'https://open.bigmodel.cn/api/paas/v4', defaultModels:['glm-4-plus','glm-4-flash'], defaultModel:'glm-4-plus' },
      { type:'anthropic', endpointUrl:'https://open.bigmodel.cn/api/anthropic', defaultModels:['glm-4.5','glm-4.7'], defaultModel:'glm-4.5' }],
    envKey:'ZHIPU_API_KEY', apiKeyUrl:'https://open.bigmodel.cn/usercenter/apikeys', apiKeyHeader:'Authorization', apiKeyPrefix:'Bearer ',
    recommendedParams:{temperature:0.7,maxTokens:4096}, iconType:'glm', region:'china', version:2 },
  { id:'minimax', name:'MiniMax', provider:'MiniMax',
    interfaces: [
      { type:'openai_compatible', endpointUrl:'https://api.minimax.chat/v1', defaultModels:['abab7-chat','abab6.5s-chat'], defaultModel:'abab7-chat' },
      { type:'anthropic', endpointUrl:'https://api.minimax.io/anthropic', defaultModels:['MiniMax-M2.7','MiniMax-M2.7-highspeed'], defaultModel:'MiniMax-M2.7' }],
    envKey:'MINIMAX_API_KEY', apiKeyUrl:'https://platform.minimax.chat/', apiKeyHeader:'Authorization', apiKeyPrefix:'Bearer ',
    recommendedParams:{temperature:0.7,maxTokens:4096}, iconType:'minimax', region:'china', version:2 },
]

export interface UsageStats {
  totalInput: number
  totalOutput: number
  byModel: { model: string; inputTokens: number; outputTokens: number }[]
  byDay: { date: string; inputTokens: number; outputTokens: number }[]
}
