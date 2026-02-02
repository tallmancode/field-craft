/**
 * Supported AI provider types
 */
export type ProviderType = 'claude-api' | 'google-gemini' | 'ollama' | 'ollama-cloud'

/**
 * Base provider configuration
 */
export interface BaseProviderConfig {
  apiKey?: string
  model: string
  provider: ProviderType
}

/**
 * Ollama-specific configuration (local/self-hosted)
 */
export interface OllamaProviderConfig extends BaseProviderConfig {
  apiUrl: string
  provider: 'ollama'
}

/**
 * Ollama Cloud-specific configuration (hosted at ollama.com)
 */
export interface OllamaCloudProviderConfig extends BaseProviderConfig {
  apiKey: string // Required for cloud
  apiUrl: string
  provider: 'ollama-cloud'
}

/**
 * Callback for recording AI usage (e.g. token counts)
 */
export interface GeminiUsageRecord {
  inputTokens: number
  model: string
  outputTokens: number
}

/**
 * Google Gemini-specific configuration
 */
export interface GoogleGeminiProviderConfig extends BaseProviderConfig {
  apiUrl?: string
  /** Optional callback to record token usage for dashboard metrics */
  onUsageRecord?: (usage: GeminiUsageRecord) => Promise<void> | void
  provider: 'google-gemini'
}

/**
 * Claude (Anthropic API)-specific configuration
 */
export interface ClaudeApiProviderConfig extends BaseProviderConfig {
  apiKey: string // Required for Anthropic API
  provider: 'claude-api'
}

/**
 * Union type for all provider configurations
 */
export type ProviderConfig =
  | ClaudeApiProviderConfig
  | GoogleGeminiProviderConfig
  | OllamaCloudProviderConfig
  | OllamaProviderConfig

/**
 * Simplified provider config for plugin options (config mode).
 * Used when providerSettings.enabled is false.
 */
export interface ProviderConfigInput {
  apiKey?: string
  apiUrl?: string
  model: string
  provider: ProviderType
}

/**
 * AI-generated media suggestions response
 */
export interface MediaSuggestions {
  alt: string
  credits: string
  title: string
}

/** Payload field types that media suggestions can populate */
export type MediaSuggestionType = 'text' | 'textarea'

/**
 * Configures a text or textarea field to populate with AI suggestions.
 * AI outputs (title, alt, credits) are mapped by position: 1st path → title, 2nd → alt, 3rd → credits.
 */
export interface PopulateFieldConfig {
  /** Field path to populate (e.g. 'alt', 'meta.title', 'caption') */
  path: string
  /** Target field type. Default: 'text' */
  fieldType?: MediaSuggestionType
}

/**
 * Media suggestions plugin sub-config
 */
export interface MediaSuggestionsConfig {
  collections?: string[]
  enabled?: boolean
  endpointPath?: string
  ollamaConfig?: {
    apiKey?: string
    apiUrl?: string
    model?: string
  }
  /**
   * Fields to populate with AI suggestions. Required for the feature to be active.
   * Each entry maps an AI output type to any text/textarea field path.
   * Omit or pass [] to show the panel with the button disabled and a config notice.
   */
  populateFields?: PopulateFieldConfig[]
  sidebarPosition?: boolean
}

/**
 * SEO collection config for injecting AIGenerateField
 */
export interface SEOCollectionConfig {
  descriptionPath?: string
  slug: string
  titlePath?: string
}

/**
 * SEO plugin sub-config
 */
export interface SEOConfig {
  collections?: SEOCollectionConfig[]
  contentExtractor?: (doc: Record<string, unknown>, collectionSlug: string) => string
  contentPaths?: Record<string, string[]>
  enabled?: boolean
  endpointPath?: string
}

/**
 * Unified FieldCraft plugin configuration
 */
export interface FieldCraftConfig {
  brandVoice?: string
  /** Base path for resolving components (e.g. 'field-craft/components'). Default: 'field-craft/components' */
  componentBasePath?: string
  disabled?: boolean
  mediaSuggestions?: MediaSuggestionsConfig
  /**
   * Provider config for config mode. Required when providerSettings.enabled is false.
   * Use when you prefer config/env over the Settings global.
   */
  providerConfig?: ProviderConfigInput
  /** Slug for the AI Provider Settings global. Ignored when providerSettings.enabled is false. */
  providerSettingsSlug?: string
  /**
   * When true (default): use AI Provider Settings global.
   * When false: use providerConfig instead; global and related UI/endpoints are not registered.
   */
  providerSettings?: { enabled?: boolean }
  seo?: SEOConfig
}

/**
 * Internal plugin configuration with all defaults applied
 */
export interface ResolvedMediaSuggestionsConfig {
  collections: string[]
  endpointPath: string
  ollamaConfig: { apiKey?: string; apiUrl: string; model: string }
  populateFields: PopulateFieldConfig[]
  /** When set, endpoints use this instead of the global. Used in config mode. */
  providerConfig: ProviderConfig | null
  providerSettingsSlug: string
  sidebarPosition: boolean
  /** When true, the AI Provider Settings global and related endpoints are registered. */
  useSettingsGlobal: boolean
}
