import type { Endpoint, GlobalSlug, PayloadRequest } from 'payload'

import type { ResolvedMediaSuggestionsConfig } from '../types.js'

interface AiProviderSettingsDoc {
  adminApiKey?: string
  apiKey?: string
  provider?: string
}

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1/organizations'
const ANTHROPIC_VERSION = '2023-06-01'

interface CostResult {
  [key: string]: unknown
  amount: string
  currency?: string
}

interface CostBucket {
  ending_at: string
  results: CostResult[]
  starting_at: string
}

interface CostReportResponse {
  data?: CostBucket[]
  has_more?: boolean
  next_page?: string
}

interface UsageResult {
  [key: string]: unknown
  cache_creation?: {
    ephemeral_1h_input_tokens?: number
    ephemeral_5m_input_tokens?: number
  }
  cache_read_input_tokens?: number
  output_tokens?: number
  uncached_input_tokens?: number
}

interface UsageBucket {
  ending_at: string
  results: UsageResult[]
  starting_at: string
}

interface UsageReportResponse {
  data?: UsageBucket[]
  has_more?: boolean
  next_page?: string
}

function parseAmount(amount: unknown): number {
  if (typeof amount === 'number') {return amount}
  if (typeof amount === 'string') {
    const parsed = parseFloat(amount)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

export function createClaudeUsageEndpoint(config: ResolvedMediaSuggestionsConfig): Endpoint {
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

        if (globalSettings?.provider !== 'claude-api') {
          return Response.json(
            { error: 'Claude is not the configured provider', showWidget: false },
            { status: 404 },
          )
        }

        const adminApiKey =
          globalSettings?.adminApiKey?.trim() ||
          process.env.ANTHROPIC_ADMIN_API_KEY?.trim() ||
          (globalSettings?.apiKey?.trim()?.startsWith('sk-ant-admin') ? globalSettings.apiKey.trim() : undefined)

        if (!adminApiKey || !adminApiKey.startsWith('sk-ant-admin')) {
          const hasRegularKey = Boolean(globalSettings?.apiKey?.trim())
          const hasEnvVar = Boolean(process.env.ANTHROPIC_ADMIN_API_KEY?.trim())
          let hint: string
          if (hasEnvVar) {
            hint =
              'ANTHROPIC_ADMIN_API_KEY is set but the key may be invalid (must start with sk-ant-admin). Restart the server after changing .env.'
          } else if (hasRegularKey) {
            hint =
              'The regular Claude API key cannot access usage data. Add ANTHROPIC_ADMIN_API_KEY to .env and restart, or add the Admin API Key in Settings → AI Provider Settings (get it from https://console.anthropic.com/settings/admin-keys).'
          } else {
            hint =
              'Add ANTHROPIC_ADMIN_API_KEY to .env and restart, or add the Admin API Key in Settings → AI Provider Settings. Get it from https://console.anthropic.com/settings/admin-keys'
          }
          return Response.json(
            { error: 'Admin API key not configured', hint },
            { status: 400 },
          )
        }

        const now = new Date()
        const endTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
        const startTime = new Date(endTime)
        startTime.setUTCDate(startTime.getUTCDate() - 7)

        const params = new URLSearchParams({
          bucket_width: '1d',
          ending_at: endTime.toISOString().replace(/\.\d{3}Z$/, 'Z'),
          limit: '7',
          starting_at: startTime.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        })

        const headers: Record<string, string> = {
          'anthropic-version': ANTHROPIC_VERSION,
          'Content-Type': 'application/json',
          'x-api-key': adminApiKey,
        }

        let totalSpendCents = 0
        let totalInputTokens = 0
        let totalOutputTokens = 0

        const costRes = await fetch(`${ANTHROPIC_BASE}/cost_report?${params}`, {
          headers,
          method: 'GET',
        })

        if (!costRes.ok) {
          const errText = await costRes.text()
          if (costRes.status === 401) {
            return Response.json(
              {
                details: 'Check your key at https://console.anthropic.com/settings/admin-keys',
                error: 'Invalid Admin API key',
              },
              { status: 401 },
            )
          }
          if (costRes.status === 403) {
            return Response.json(
              {
                details: errText || 'Ensure your key has Admin API permissions',
                error: 'Admin API access denied',
              },
              { status: 403 },
            )
          }
          if (costRes.status === 429) {
            return Response.json(
              { error: 'Rate limit exceeded', hint: 'Try again in a few minutes' },
              { status: 429 },
            )
          }
          return Response.json(
            { details: errText || costRes.statusText, error: 'Failed to fetch cost report' },
            { status: 500 },
          )
        }

        const costData = (await costRes.json()) as CostReportResponse
        for (const bucket of costData.data ?? []) {
          for (const result of bucket.results ?? []) {
            totalSpendCents += parseAmount(result.amount)
          }
        }

        const usageRes = await fetch(`${ANTHROPIC_BASE}/usage_report/messages?${params}`, {
          headers,
          method: 'GET',
        })

        if (!usageRes.ok) {
          const errText = await usageRes.text()
          if (usageRes.status === 401 || usageRes.status === 403) {
            return Response.json(
              {
                details: errText || usageRes.statusText,
                error: 'Invalid or insufficient Admin API permissions',
              },
              { status: usageRes.status },
            )
          }
          if (usageRes.status === 429) {
            return Response.json(
              { error: 'Rate limit exceeded', hint: 'Try again in a few minutes' },
              { status: 429 },
            )
          }
          return Response.json(
            { details: errText || usageRes.statusText, error: 'Failed to fetch usage report' },
            { status: 500 },
          )
        }

        const usageData = (await usageRes.json()) as UsageReportResponse
        for (const bucket of usageData.data ?? []) {
          for (const result of bucket.results ?? []) {
            totalInputTokens +=
              (result.uncached_input_tokens ?? 0) +
              (result.cache_read_input_tokens ?? 0) +
              (result.cache_creation?.ephemeral_1h_input_tokens ?? 0) +
              (result.cache_creation?.ephemeral_5m_input_tokens ?? 0)
            totalOutputTokens += result.output_tokens ?? 0
          }
        }

        const spendUsd = totalSpendCents / 100
        const period = {
          end: endTime.toISOString().slice(0, 10),
          start: startTime.toISOString().slice(0, 10),
        }

        return Response.json({
          currency: 'USD',
          period,
          spend: spendUsd,
          usage: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            totalTokens: totalInputTokens + totalOutputTokens,
          },
        })
      } catch (error) {
        console.error('[Claude Usage] Error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return Response.json(
          { details: message, error: 'Failed to fetch Claude usage data' },
          { status: 500 },
        )
      }
    },
    method: 'get',
    path: `${config.endpointPath}/claude-usage`,
  }
}
