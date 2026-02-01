import type { Endpoint, PayloadRequest } from 'payload'

import fs from 'fs/promises'
import path from 'path'

import type { ProviderConfig, ResolvedMediaSuggestionsConfig } from '../types.js'

import { generateMediaSuggestions } from '../utils/generateSuggestions.js'

interface AiProviderSettingsDoc {
  apiKey?: string
  apiUrl?: string
  model?: { modelId?: string } | number | string
  provider?: string
}

interface MediaDoc {
  filename?: string
  mimeType?: string
}

export function createAISuggestionsEndpoint(
  config: ResolvedMediaSuggestionsConfig,
  brandVoice?: string,
): Endpoint {
  return {
    handler: async (req: PayloadRequest) => {
      try {
        if (!req.json) {
          return Response.json({ error: 'Invalid request' }, { status: 400 })
        }
        const body = await req.json()
        const { base64Image, context, imageUrl, mediaCollectionSlug, mediaId, mimeType } = body

        if (!mediaId && !imageUrl && !base64Image) {
          return Response.json(
            { error: 'Either mediaId, imageUrl, or base64Image is required' },
            { status: 400 },
          )
        }

        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        let imageBuffer: Buffer
        let imageMimeType: string

        const collectionSlug = mediaCollectionSlug || 'media'

        if (base64Image) {
          imageBuffer = Buffer.from(base64Image, 'base64')
          imageMimeType = mimeType || 'image/jpeg'
        } else if (mediaId) {
          let mediaDoc: MediaDoc
          try {
            mediaDoc = (await req.payload.findByID({
              id: mediaId,
              collection: collectionSlug,
              overrideAccess: false,
              user: req.user,
            })) as MediaDoc
          } catch (_error) {
            return Response.json(
              { error: 'Media not found or access denied' },
              { status: 404 },
            )
          }

          if (!mediaDoc.filename) {
            return Response.json({ error: 'Media file not found' }, { status: 400 })
          }

          const uploadsDir = path.resolve(process.cwd(), 'public/media/uploads')
          const filePath = path.join(uploadsDir, mediaDoc.filename)

          try {
            imageBuffer = await fs.readFile(filePath)
          } catch (error) {
            console.error('Error reading file:', error)
            return Response.json({ error: 'Failed to read media file' }, { status: 500 })
          }

          imageMimeType = mediaDoc.mimeType || 'image/jpeg'
        } else if (imageUrl) {
          try {
            const imageResponse = await fetch(imageUrl)
            if (!imageResponse.ok) {
              return Response.json({ error: 'Failed to fetch image' }, { status: 500 })
            }
            const arrayBuffer = await imageResponse.arrayBuffer()
            imageBuffer = Buffer.from(arrayBuffer)
            imageMimeType = imageResponse.headers.get('content-type') || 'image/jpeg'
          } catch (error) {
            console.error('Error fetching image from URL:', error)
            return Response.json({ error: 'Failed to fetch image from URL' }, { status: 500 })
          }
        } else {
          return Response.json({ error: 'Invalid request' }, { status: 400 })
        }

        if (!imageMimeType.startsWith('image/')) {
          return Response.json({ error: 'Only image files are supported' }, { status: 400 })
        }

        let providerConfig: ProviderConfig

        if (config.providerConfig) {
          providerConfig = config.providerConfig
          if (providerConfig.provider === 'google-gemini') {
            providerConfig = {
              ...providerConfig,
              onUsageRecord: async (usage: {
                inputTokens: number
                model: string
                outputTokens: number
              }) => {
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

            if (globalSettings?.provider) {
            const provider = globalSettings.provider
            const modelValue = globalSettings.model
            let modelId: string | undefined
            if (modelValue != null) {
              if (typeof modelValue === 'object' && modelValue !== null && 'modelId' in modelValue) {
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
                model: modelId || 'llava:latest',
                provider: 'ollama',
              }
            } else if (provider === 'ollama-cloud') {
              const cloudApiUrl = apiUrl || 'https://ollama.com'
              if (!apiKey) {
                return Response.json(
                  { error: 'Ollama Cloud requires an API key. Get one from https://ollama.com' },
                  { status: 400 },
                )
              }
              providerConfig = {
                apiKey,
                apiUrl: cloudApiUrl,
                model: modelId || 'llava',
                provider: 'ollama-cloud',
              }
            } else if (provider === 'google-gemini') {
              if (!apiKey) {
                return Response.json(
                  { error: 'Google Gemini API key is required in provider settings' },
                  { status: 400 },
                )
              }
              providerConfig = {
                apiKey,
                apiUrl,
                model: modelId || 'models/gemini-2.5-flash',
                onUsageRecord: async (usage: { inputTokens: number; model: string; outputTokens: number }) => {
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
                  { error: 'Claude API key is required in provider settings' },
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
            } else {
              providerConfig = {
                apiKey: config.ollamaConfig.apiKey,
                apiUrl: config.ollamaConfig.apiUrl,
                model: config.ollamaConfig.model,
                provider: 'ollama',
              }
            }
          } catch (error) {
            console.warn('Using fallback provider configuration:', error)
            providerConfig = {
              apiKey: config.ollamaConfig.apiKey,
              apiUrl: config.ollamaConfig.apiUrl,
              model: config.ollamaConfig.model,
              provider: 'ollama',
            }
          }
        }

        try {
          const suggestions = await generateMediaSuggestions(
            imageBuffer,
            imageMimeType,
            providerConfig,
            context,
            brandVoice,
          )

          return Response.json({ success: true, suggestions })
        } catch (error) {
          console.error('AI provider error:', error)
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          return Response.json(
            { details: errorMessage, error: 'Failed to generate AI suggestions' },
            { status: 500 },
          )
        }
      } catch (error) {
        console.error('Unexpected error:', error)
        return Response.json(
          { error: 'An unexpected error occurred' },
          { status: 500 },
        )
      }
    },
    method: 'post',
    path: config.endpointPath,
  }
}
