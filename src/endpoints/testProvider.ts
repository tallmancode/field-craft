import type { Endpoint, PayloadRequest } from 'payload'

import type { ProviderConfig, ResolvedMediaSuggestionsConfig } from '../types.js'

import { generateMediaSuggestions } from '../utils/generateSuggestions.js'

export function createTestProviderEndpoint(config: ResolvedMediaSuggestionsConfig): Endpoint {
  return {
    handler: async (req: PayloadRequest) => {
      try {
        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!req.json) {
          return Response.json({ error: 'Invalid request' }, { status: 400 })
        }
        const body = await req.json()
        const { apiKey, apiUrl, model: modelInput, provider } = body

        if (!provider || modelInput == null || modelInput === '') {
          return Response.json(
            { error: 'Provider and model are required' },
            { status: 400 },
          )
        }

        let modelId: string
        if (typeof modelInput === 'string' && (modelInput.includes(':') || modelInput.includes('/'))) {
          modelId = modelInput
        } else {
          try {
            const modelDoc = await req.payload.findByID({
              id: modelInput,
              collection: 'ai-models',
              depth: 0,
            })
            modelId = (modelDoc as { modelId?: string })?.modelId ?? String(modelInput)
          } catch {
            modelId = String(modelInput)
          }
        }

        let providerConfig: ProviderConfig

        if (provider === 'ollama' || provider === 'ollama-cloud') {
          const resolvedApiUrl =
            apiUrl || (provider === 'ollama-cloud' ? 'https://ollama.com' : undefined)

          if (!resolvedApiUrl) {
            return Response.json(
              { error: 'API URL is required for Ollama' },
              { status: 400 },
            )
          }

          if (provider === 'ollama-cloud' && !apiKey) {
            return Response.json(
              { error: 'API key is required for Ollama Cloud' },
              { status: 400 },
            )
          }

          providerConfig = {
            apiKey,
            apiUrl: resolvedApiUrl,
            model: modelId,
            provider,
          }
        } else if (provider === 'google-gemini') {
          if (!apiKey) {
            return Response.json(
              { error: 'API key is required for Google Gemini' },
              { status: 400 },
            )
          }

          providerConfig = {
            apiKey,
            apiUrl,
            model: modelId,
            provider: 'google-gemini',
          }
        } else if (provider === 'claude-api') {
          if (!apiKey) {
            return Response.json(
              { error: 'API key is required for Claude API' },
              { status: 400 },
            )
          }

          providerConfig = {
            apiKey,
            model: modelId,
            provider: 'claude-api',
          }
        } else {
          return Response.json(
            { error: `Unknown provider: ${provider}` },
            { status: 400 },
          )
        }

        const testImageBase64 =
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
        const testImageBuffer = Buffer.from(testImageBase64, 'base64')

        const result = await generateMediaSuggestions(
          testImageBuffer,
          'image/png',
          providerConfig,
          'This is a test image to verify provider configuration.',
        )

        return Response.json({
          message: 'Provider configuration is working correctly!',
          model: modelId,
          provider,
          success: true,
          testResult: {
            alt: result.alt,
            credits: result.credits,
            title: result.title,
          },
        })
      } catch (error) {
        console.error('Provider test error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        return Response.json(
          {
            details: errorMessage,
            error: 'Provider test failed',
            success: false,
          },
          { status: 500 },
        )
      }
    },
    method: 'post',
    path: `${config.endpointPath}/test-provider`,
  }
}
