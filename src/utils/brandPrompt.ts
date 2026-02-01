/**
 * Default brand voice instruction for AI content generation.
 * Used for short-form output (e.g. media title, alt text, SEO metadata).
 */
export const DEFAULT_BRAND_VOICE_INSTRUCTION =
  'Write in a warm, conversational tone for developers. Use clear, natural language. Avoid jargon, corporate speak, and superlatives. Titles and alt text should be descriptive and keyword-friendly while feeling approachable.'

/**
 * Get brand voice instruction, with optional override from plugin config.
 */
export function getBrandVoiceInstruction(override?: string): string {
  return override?.trim() || DEFAULT_BRAND_VOICE_INSTRUCTION
}
