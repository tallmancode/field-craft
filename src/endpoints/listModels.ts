import type { Endpoint, GlobalSlug, PayloadRequest } from 'payload'

import type { ResolvedMediaSuggestionsConfig } from '../types.js'

interface AiProviderSettingsDoc {
  apiKey?: string
  provider?: string
}

interface GoogleModelInfo {
  description?: string
  displayName?: string
  inputTokenLimit?: number
  name?: string
  outputTokenLimit?: number
  supportedGenerationMethods?: string[]
}

export function createListModelsEndpoint(config: ResolvedMediaSuggestionsConfig): Endpoint {
  return {
    handler: async (req: PayloadRequest) => {
      try {
        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        let apiKey: string | undefined

        try {
          const globalSettings = (await req.payload.findGlobal({
            slug: config.providerSettingsSlug,
            depth: 0,
          })) as AiProviderSettingsDoc | null

          if (globalSettings?.provider === 'google-gemini') {
            apiKey = globalSettings.apiKey ?? undefined
          }
        } catch (_error) {
          // Ignore
        }

        if (!apiKey) {
          return Response.json(
            {
              error: 'No Google Gemini API key configured',
              hint: 'Configure your API key in Settings → AI Provider Settings',
            },
            { status: 400 },
          )
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
          {
            headers: { 'Content-Type': 'application/json' },
            method: 'GET',
          },
        )

        if (!response.ok) {
          const errorText = await response.text()
          return Response.json(
            {
              apiKeyTested: true,
              details: `API returned ${response.status}: ${errorText}`,
              error: 'Failed to list models',
              hint: 'Verify your API key is valid at https://aistudio.google.com/app/apikey',
            },
            { status: 500 },
          )
        }

        const data = (await response.json()) as { models?: GoogleModelInfo[] }
        const models = data.models ?? []

        const visionModels = models.filter(
          (model: GoogleModelInfo) =>
            model.supportedGenerationMethods?.includes('generateContent') &&
            model.name &&
            (model.name.includes('vision') || model.name.includes('gemini')),
        )

        return Response.json({
          allModels: models.map((model: GoogleModelInfo) => model.name),
          allVisionModels: visionModels.map((model: GoogleModelInfo) => ({
            name: model.name,
            displayName: model.displayName,
            supportedMethods: model.supportedGenerationMethods,
          })),
          apiKeyValid: true,
          recommendedModels: visionModels
            .filter(
              (m: GoogleModelInfo) =>
                m.name?.includes('1.5-flash') ||
                m.name?.includes('1.5-pro') ||
                m.name?.includes('pro-vision'),
            )
            .map((model: GoogleModelInfo) => ({
              name: model.name,
              description: model.description,
              displayName: model.displayName,
              inputTokenLimit: model.inputTokenLimit,
              outputTokenLimit: model.outputTokenLimit,
              supportedMethods: model.supportedGenerationMethods,
            })),
          success: true,
          totalModels: models.length,
          visionModelsCount: visionModels.length,
        })
      } catch (error) {
        console.error('Error listing models:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return Response.json(
          {
            apiKeyTested: true,
            details: errorMessage,
            error: 'Failed to list models',
            hint: 'Verify your API key is valid at https://aistudio.google.com/app/apikey',
          },
          { status: 500 },
        )
      }
    },
    method: 'get',
    path: `${config.endpointPath}/list-models`,
  }
}
