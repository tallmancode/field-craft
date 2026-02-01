import type { Endpoint, GlobalSlug, PayloadRequest } from 'payload'

import type { ResolvedMediaSuggestionsConfig } from '../types.js'

import { estimateGeminiCost } from '../utils/geminiPricing.js'

interface AiProviderSettingsDoc {
  provider?: string
}

export function createGeminiUsageEndpoint(config: ResolvedMediaSuggestionsConfig): Endpoint {
  return {
    handler: async (req: PayloadRequest) => {
      try {
        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const globalSettings = (await req.payload.findGlobal({
          slug: config.providerSettingsSlug,
          depth: 0,
        })) as AiProviderSettingsDoc | null

        if (globalSettings?.provider !== 'google-gemini') {
          return Response.json(
            { error: 'Gemini is not the configured provider', showWidget: false },
            { status: 404 },
          )
        }

        const now = new Date()
        const sevenDaysAgo = new Date(now)
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        const result = await req.payload.find({
          collection: 'ai-usage-logs',
          depth: 0,
          limit: 10000,
          overrideAccess: true,
          req,
          where: {
            and: [
              { provider: { equals: 'google-gemini' } },
              { createdAt: { greater_than_equal: sevenDaysAgo.toISOString() } },
            ],
          },
        })

        let totalInputTokens = 0
        let totalOutputTokens = 0
        let estimatedSpend = 0

        for (const doc of result.docs) {
          const inputTokens = (doc as { inputTokens?: number }).inputTokens ?? 0
          const outputTokens = (doc as { outputTokens?: number }).outputTokens ?? 0
          const model = (doc as { model?: string }).model ?? 'models/gemini-2.5-flash'
          totalInputTokens += inputTokens
          totalOutputTokens += outputTokens
          estimatedSpend += estimateGeminiCost(model, inputTokens, outputTokens)
        }

        const period = {
          end: now.toISOString().slice(0, 10),
          start: sevenDaysAgo.toISOString().slice(0, 10),
        }

        return Response.json({
          currency: 'USD',
          disclaimer:
            'Usage from this CMS only. View full account usage at https://aistudio.google.com/usage',
          period,
          source: 'self-tracked',
          spend: Math.round(estimatedSpend * 10000) / 10000,
          usage: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            totalTokens: totalInputTokens + totalOutputTokens,
          },
        })
      } catch (error) {
        console.error('[Gemini Usage] Error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return Response.json(
          { details: message, error: 'Failed to fetch Gemini usage data' },
          { status: 500 },
        )
      }
    },
    method: 'get',
    path: `${config.endpointPath}/gemini-usage`,
  }
}
