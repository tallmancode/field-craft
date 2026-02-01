import type { Endpoint, GlobalSlug, PayloadRequest } from 'payload'

import type { ResolvedMediaSuggestionsConfig } from '../types.js'

interface AiProviderSettingsDoc {
  apiKey?: string
  apiUrl?: string
  provider?: string
}

interface GoogleModelInfo {
  displayName?: string
  name?: string
  supportedGenerationMethods?: string[]
}

interface OllamaModelResponse {
  models?: { name: string }[]
}

export function createRefetchModelsEndpoint(config: ResolvedMediaSuggestionsConfig): Endpoint {
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

        if (!globalSettings?.provider) {
          return Response.json(
            { error: 'No provider selected. Select a provider in AI Provider Settings first.' },
            { status: 400 },
          )
        }

        const provider = globalSettings.provider
        const apiUrl = globalSettings.apiUrl ?? undefined
        const apiKey = globalSettings.apiKey ?? undefined

        let modelEntries: { displayName: string; modelId: string }[] = []

        if (provider === 'ollama') {
          const baseUrl = (apiUrl || 'http://localhost:11434').replace(/\/api\/?$/, '').replace(/\/$/, '')
          const tagsUrl = `${baseUrl}/api/tags`
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          if (apiKey) {headers['Authorization'] = `Bearer ${apiKey}`}

          const response = await fetch(tagsUrl, { headers, method: 'GET' })
          if (!response.ok) {
            const errorText = await response.text()
            return Response.json(
              {
                details: `API returned ${response.status}: ${errorText}`,
                error: 'Failed to fetch Ollama models',
                hint: 'Ensure Ollama is running and the API URL is correct.',
              },
              { status: 500 },
            )
          }

          const data = (await response.json()) as OllamaModelResponse
          const models = data.models ?? []
          modelEntries = models.map((m) => ({ displayName: m.name, modelId: m.name }))
        } else if (provider === 'ollama-cloud') {
          const baseUrl = (apiUrl || 'https://ollama.com').replace(/\/api\/?$/, '').replace(/\/$/, '')
          const tagsUrl = `${baseUrl}/api/tags`

          if (!apiKey) {
            return Response.json(
              { error: 'Ollama Cloud requires an API key. Configure it in AI Provider Settings.' },
              { status: 400 },
            )
          }

          const response = await fetch(tagsUrl, {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            method: 'GET',
          })
          if (!response.ok) {
            const errorText = await response.text()
            return Response.json(
              {
                details: `API returned ${response.status}: ${errorText}`,
                error: 'Failed to fetch Ollama Cloud models',
                hint: 'Verify your API key at https://ollama.com',
              },
              { status: 500 },
            )
          }

          const data = (await response.json()) as OllamaModelResponse
          const models = data.models ?? []
          modelEntries = models.map((m) => ({ displayName: m.name, modelId: m.name }))
        } else if (provider === 'google-gemini') {
          if (!apiKey) {
            return Response.json(
              { error: 'Google Gemini requires an API key. Configure it in AI Provider Settings.' },
              { status: 400 },
            )
          }

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
            { headers: { 'Content-Type': 'application/json' }, method: 'GET' },
          )
          if (!response.ok) {
            const errorText = await response.text()
            return Response.json(
              {
                details: `API returned ${response.status}: ${errorText}`,
                error: 'Failed to fetch Google Gemini models',
                hint: 'Verify your API key at https://aistudio.google.com/app/apikey',
              },
              { status: 500 },
            )
          }

          const data = (await response.json()) as { models?: GoogleModelInfo[] }
          const models = data.models ?? []
          const visionModels = models.filter(
            (m: GoogleModelInfo) =>
              m.supportedGenerationMethods?.includes('generateContent') &&
              m.name &&
              (m.name.includes('vision') || m.name.includes('gemini')),
          )
          modelEntries = visionModels.map((m: GoogleModelInfo) => ({
            displayName: m.displayName || m.name || m.name!,
            modelId: m.name!,
          }))
        } else if (provider === 'claude-api') {
          if (!apiKey) {
            return Response.json(
              { error: 'Claude API requires an API key. Configure it in AI Provider Settings.' },
              { status: 400 },
            )
          }

          const response = await fetch('https://api.anthropic.com/v1/models?limit=1000', {
            headers: {
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
            },
            method: 'GET',
          })
          if (!response.ok) {
            const errorText = await response.text()
            return Response.json(
              {
                details: `API returned ${response.status}: ${errorText}`,
                error: 'Failed to fetch Claude API models',
                hint: 'Verify your API key at https://console.anthropic.com/',
              },
              { status: 500 },
            )
          }

          const data = (await response.json()) as { data?: { display_name?: string; id: string }[] }
          const models = data.data ?? []
          modelEntries = models.map((m) => ({
            displayName: m.display_name || m.id,
            modelId: m.id,
          }))
        } else {
          return Response.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
        }

        if (modelEntries.length === 0) {
          return Response.json(
            { count: 0, message: 'No models found for this provider.', success: true },
            { status: 200 },
          )
        }

        await req.payload.delete({
          collection: 'ai-models',
          req,
          where: { provider: { equals: provider } },
        })

        for (const entry of modelEntries) {
          await req.payload.create({
            collection: 'ai-models',
            data: {
              displayName: entry.displayName || entry.modelId,
              modelId: entry.modelId,
              provider,
            },
            req,
          })
        }

        return Response.json({
          count: modelEntries.length,
          message: `Fetched ${modelEntries.length} model(s) for ${provider}.`,
          success: true,
        })
      } catch (error) {
        console.error('Refetch models error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return Response.json(
          { details: errorMessage, error: 'Failed to refetch models' },
          { status: 500 },
        )
      }
    },
    method: 'post',
    path: `${config.endpointPath}/refetch-models`,
  }
}
