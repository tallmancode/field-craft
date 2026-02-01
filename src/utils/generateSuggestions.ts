import type { MediaSuggestions, ProviderConfig } from '../types.js'

import { generateSuggestionsWithClaude } from './providers/claude.js'
import { generateSuggestionsWithGoogle } from './providers/google.js'
import { generateSuggestionsWithOllama } from './providers/ollama.js'

/**
 * Generate AI-powered suggestions for media metadata using the configured provider
 */
export async function generateMediaSuggestions(
  imageBuffer: Buffer,
  mimeType: string,
  config: ProviderConfig,
  additionalContext?: string,
  brandVoice?: string,
): Promise<MediaSuggestions> {
  switch (config.provider) {
    case 'claude-api':
      return generateSuggestionsWithClaude(imageBuffer, mimeType, config, additionalContext, brandVoice)
    case 'google-gemini':
      return generateSuggestionsWithGoogle(imageBuffer, mimeType, config, additionalContext, brandVoice)
    case 'ollama':
    case 'ollama-cloud':
      return generateSuggestionsWithOllama(imageBuffer, mimeType, config, additionalContext, brandVoice)
    default: {
      const cfg = config as ProviderConfig
      throw new Error(`Unsupported provider: ${cfg.provider}`)
    }
  }
}
