/**
 * Gemini API pricing per 1M tokens (USD) - standard tier.
 * See https://ai.google.dev/gemini-api/docs/pricing
 */
const PRICING_PER_1M: Record<string, { input: number; output: number }> = {
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.3 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gemini-3-flash-preview': { input: 0.5, output: 3 },
  'gemini-3-pro-preview': { input: 2, output: 12 },
}

const FALLBACK = { input: 0.3, output: 2.5 } // gemini-2.5-flash

function normalizeModelId(model: string): string {
  return model.replace(/^models\//, '').toLowerCase()
}

export function estimateGeminiCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const key = normalizeModelId(model)
  const pricing = PRICING_PER_1M[key] ?? FALLBACK
  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output
  return inputCost + outputCost
}
