import type { Endpoint, PayloadRequest } from 'payload'

import type { GeminiUsageRecord, ProviderConfig } from '../types.js'

import { generateSEOMetadata } from '../utils/aiGenerateText.js'
import {
  extractContentFromDoc,
  type ExtractContentOptions,
} from '../utils/extractContent.js'

interface AiProviderSettingsDoc {
  apiKey?: string
  apiUrl?: string
  model?: { modelId?: string } | number | string
  provider?: string
}

export interface AISeoGenerateEndpointConfig {
  brandVoice?: string
  contentExtractor?: (doc: Record<string, unknown>, collectionSlug: string) => string
  contentPaths?: Record<string, string[]>
  endpointPath?: string
  providerConfig: ProviderConfig | null
  providerSettingsSlug: string
  useSettingsGlobal: boolean
}

export function createAISeoGenerateEndpoint(config: AISeoGenerateEndpointConfig): Endpoint {
  const endpointPath = config.endpointPath || '/ai-seo-generate'

  return {
    handler: async (req: PayloadRequest) => {
      try {
        if (!req.json) {
          return Response.json({ error: 'Invalid request' }, { status: 400 })
        }

        const body = await req.json()
        const { action, collectionSlug, doc, globalSlug, promptOverride, target = 'seo' } = body

        if (!doc || typeof doc !== 'object') {
          return Response.json({ error: 'Document data is required' }, { status: 400 })
        }

        const slug = collectionSlug || globalSlug
        if (!slug || typeof slug !== 'string') {
          return Response.json(
            { error: 'collectionSlug or globalSlug is required' },
            { status: 400 },
          )
        }

        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        let extractedPrompt: string
        if (config.contentExtractor) {
          extractedPrompt = config.contentExtractor(doc, slug)
        } else {
          const options: ExtractContentOptions | undefined = config.contentPaths
            ? { contentPaths: config.contentPaths }
            : undefined
          extractedPrompt = extractContentFromDoc(doc, slug, options)
        }

        if (action === 'extract') {
          return Response.json({ prompt: extractedPrompt, success: true })
        }

        let prompt: string
        if (typeof promptOverride === 'string' && promptOverride.trim()) {
          prompt = promptOverride.trim()
        } else {
          prompt = extractedPrompt
        }

        if (!prompt) {
          return Response.json(
            {
              error:
                'No content to generate from. Add page content or provide custom prompt in the modal.',
            },
            { status: 400 },
          )
        }

        let providerConfig: ProviderConfig

        if (config.providerConfig) {
          providerConfig = config.providerConfig
          if (providerConfig.provider === 'google-gemini') {
            providerConfig = {
              ...providerConfig,
              onUsageRecord: async (usage: GeminiUsageRecord) => {
                try {
                  await req.payload.create({
                    collection: 'ai-usage-logs',
                    data: {
                      inputTokens: usage.inputTokens,
                      model: usage.model,
                      outputTokens: usage.outputTokens,
                      provider: 'google-gemini',
                    },
                    overrideAccess: true,
                    req,
                  })
                } catch (err) {
                  console.warn('[AI Usage] Failed to record Gemini usage:', err)
                }
              },
            }
          }
        } else {
          try {
            const globalSettings = (await req.payload.findGlobal({
              slug: config.providerSettingsSlug,
              depth: 1,
            })) as AiProviderSettingsDoc | null

            if (!globalSettings?.provider) {
              return Response.json(
                {
                  error:
                    'AI provider not configured. Configure in Settings > AI Provider Settings.',
                },
                { status: 400 },
              )
            }

            const provider = globalSettings.provider
          const modelValue = globalSettings.model
          let modelId: string | undefined

          if (modelValue != null) {
            if (
              typeof modelValue === 'object' &&
              modelValue !== null &&
              'modelId' in modelValue
            ) {
              modelId = (modelValue as { modelId: string }).modelId
            } else if (typeof modelValue === 'string' || typeof modelValue === 'number') {
              const modelDoc = await req.payload.findByID({
                id: String(modelValue),
                collection: 'ai-models',
                depth: 0,
              })
              modelId = (modelDoc as { modelId?: string })?.modelId
            }
          }

          const apiKey = globalSettings.apiKey ?? undefined
          const apiUrl = globalSettings.apiUrl ?? undefined

          if (provider === 'ollama') {
            if (!apiUrl) {
              return Response.json(
                { error: 'Ollama API URL is required in provider settings' },
                { status: 400 },
              )
            }
            providerConfig = {
              apiKey,
              apiUrl,
              model: modelId || 'llama3.2',
              provider: 'ollama',
            }
          } else if (provider === 'ollama-cloud') {
            const cloudApiUrl = apiUrl || 'https://ollama.com'
            if (!apiKey) {
              return Response.json(
                { error: 'Ollama Cloud requires an API key' },
                { status: 400 },
              )
            }
            providerConfig = {
              apiKey,
              apiUrl: cloudApiUrl,
              model: modelId || 'llama3.2',
              provider: 'ollama-cloud',
            }
          } else if (provider === 'google-gemini') {
            if (!apiKey) {
              return Response.json(
                { error: 'Google Gemini API key is required' },
                { status: 400 },
              )
            }
            providerConfig = {
              apiKey,
              apiUrl,
              model: modelId || 'models/gemini-2.5-flash',
              onUsageRecord: async (usage: GeminiUsageRecord) => {
                try {
                  await req.payload.create({
                    collection: 'ai-usage-logs',
                    data: {
                      inputTokens: usage.inputTokens,
                      model: usage.model,
                      outputTokens: usage.outputTokens,
                      provider: 'google-gemini',
                    },
                    overrideAccess: true,
                    req,
                  })
                } catch (err) {
                  console.warn('[AI Usage] Failed to record Gemini usage:', err)
                }
              },
              provider: 'google-gemini',
            }
          } else if (provider === 'claude-api') {
            if (!apiKey) {
              return Response.json(
                { error: 'Claude API key is required' },
                { status: 400 },
              )
            }
            providerConfig = {
              apiKey,
              model: modelId || 'claude-sonnet-4-5-20250929',
              provider: 'claude-api',
            }
          } else {
            return Response.json(
              { error: `Unknown provider: ${provider}` },
              { status: 400 },
            )
          }
          } catch (error) {
            console.error('Failed to load provider config:', error)
            return Response.json(
              { error: 'Failed to load AI provider configuration' },
              { status: 500 },
            )
          }
        }

        try {
          const result = await generateSEOMetadata(prompt, providerConfig, config.brandVoice)

          if (target === 'excerpt') {
            return Response.json({
              description: result.description,
              success: true,
            })
          }

          return Response.json({
            description: result.description,
            success: true,
            title: result.title,
          })
        } catch (error) {
          console.error('AI SEO generation error:', error)
          const message = error instanceof Error ? error.message : 'Unknown error'
          return Response.json(
            { details: message, error: 'Failed to generate SEO metadata' },
            { status: 500 },
          )
        }
      } catch (error) {
        console.error('AI SEO generate endpoint error:', error)
        return Response.json(
          { error: 'An unexpected error occurred' },
          { status: 500 },
        )
      }
    },
    method: 'post',
    path: endpointPath,
  }
}
