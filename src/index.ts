import type { Config, Plugin } from 'payload'

import type {
  FieldCraftConfig,
  ProviderConfig,
  ProviderConfigInput,
  ResolvedMediaSuggestionsConfig,
  SEOCollectionConfig,
} from './types.js'

import { AIModelsCollection } from './collections/AIModelsCollection.js'
import { AIUsageLogsCollection } from './collections/AIUsageLogsCollection.js'
import { createAISeoGenerateEndpoint } from './endpoints/aiSeoGenerate.js'
import { createAISuggestionsEndpoint } from './endpoints/aiSuggestions.js'
import { createClaudeUsageEndpoint } from './endpoints/claudeUsage.js'
import { createGeminiUsageEndpoint } from './endpoints/geminiUsage.js'
import { createListModelsEndpoint } from './endpoints/listModels.js'
import { createRefetchModelsEndpoint } from './endpoints/refetchModels.js'
import { createTestProviderEndpoint } from './endpoints/testProvider.js'
import { createAIProviderSettings } from './globals/createAIProviderSettings.js'

const DEFAULT_COMPONENT_BASE = 'field-craft/components'
const DEFAULT_PROVIDER_SETTINGS_SLUG = 'ai-provider-settings'
const DEFAULT_MEDIA_ENDPOINT = '/ai-suggestions'
const DEFAULT_SEO_ENDPOINT = '/ai-seo-generate'

function resolveProviderConfigFromInput(input: ProviderConfigInput): ProviderConfig {
  const { provider, model, apiUrl, apiKey } = input
  switch (provider) {
    case 'ollama':
      return {
        apiKey,
        apiUrl: apiUrl ?? process.env.OLLAMA_API_URL ?? 'http://localhost:11434',
        model,
        provider: 'ollama',
      }
    case 'ollama-cloud':
      return {
        apiKey: apiKey ?? '',
        apiUrl: apiUrl ?? 'https://ollama.com',
        model,
        provider: 'ollama-cloud',
      }
    case 'google-gemini':
      return {
        apiKey: apiKey ?? '',
        apiUrl,
        model,
        provider: 'google-gemini',
      }
    case 'claude-api':
      return {
        apiKey: apiKey ?? '',
        model,
        provider: 'claude-api',
      }
    default: {
      const _: never = provider
      throw new Error(`Unknown provider: ${provider}`)
    }
  }
}

/**
 * FieldCraft: Payload CMS plugin for AI media suggestions and AI SEO generation.
 * Combines AI-powered metadata suggestions for uploads with SEO meta title/description generation.
 *
 * @example
 * ```ts
 * import { fieldCraft } from 'field-craft'
 *
 * export default buildConfig({
 *   plugins: [
 *     fieldCraft({
 *       mediaSuggestions: { enabled: true, collections: ['media'] },
 *       seo: {
 *         enabled: true,
 *         collections: [
 *           { slug: 'pages', titlePath: 'meta.title', descriptionPath: 'meta.description' },
 *         ],
 *         contentPaths: { pages: ['content', 'section'] },
 *       },
 *     }),
 *   ],
 * })
 * ```
 */
export const fieldCraft = (pluginOptions: FieldCraftConfig = {}): Plugin => {
  return (incomingConfig: Config): Config => {
    const disabled = pluginOptions.disabled === true
    const providerSettingsEnabled =
      pluginOptions.providerSettings?.enabled !== false
    const providerSettingsSlug =
      pluginOptions.providerSettingsSlug ?? DEFAULT_PROVIDER_SETTINGS_SLUG
    const brandVoice = pluginOptions.brandVoice
    const componentBase =
      pluginOptions.componentBasePath ?? DEFAULT_COMPONENT_BASE

    let resolvedProviderConfig: ProviderConfig | null = null
    if (!providerSettingsEnabled) {
      if (!pluginOptions.providerConfig) {
        throw new Error(
          '[FieldCraft] providerConfig is required when providerSettings.enabled is false. ' +
            'Provide provider, model, and any required apiKey/apiUrl for your chosen provider.',
        )
      }
      resolvedProviderConfig = resolveProviderConfigFromInput(
        pluginOptions.providerConfig,
      )
    }

    // Resolve media suggestions config
    const mediaOpts = pluginOptions.mediaSuggestions ?? {}
    const mediaEnabled = disabled ? false : mediaOpts.enabled !== false
    const mediaEndpointPath = mediaOpts.endpointPath ?? DEFAULT_MEDIA_ENDPOINT

    const resolvedMediaConfig: ResolvedMediaSuggestionsConfig = {
      collections: mediaOpts.collections ?? [],
      endpointPath: mediaEndpointPath,
      ollamaConfig: {
        apiKey: mediaOpts.ollamaConfig?.apiKey ?? process.env.OLLAMA_API_KEY,
        apiUrl:
          mediaOpts.ollamaConfig?.apiUrl ??
          process.env.OLLAMA_API_URL ??
          'http://localhost:11434',
        model:
          mediaOpts.ollamaConfig?.model ??
          process.env.OLLAMA_MODEL ??
          'llava:latest',
      },
      populateFields: mediaOpts.populateFields ?? [],
      providerConfig: resolvedProviderConfig,
      providerSettingsSlug,
      sidebarPosition: mediaOpts.sidebarPosition !== false,
      useSettingsGlobal: providerSettingsEnabled,
    }

    // Resolve SEO config
    const seoOpts = pluginOptions.seo ?? {}
    const seoEnabled = disabled ? false : seoOpts.enabled !== false
    const seoEndpointPath = seoOpts.endpointPath ?? DEFAULT_SEO_ENDPOINT

    // Determine target upload collections for media suggestions
    let targetMediaCollections = resolvedMediaConfig.collections
    if (!targetMediaCollections || targetMediaCollections.length === 0) {
      targetMediaCollections =
        incomingConfig.collections
          ?.filter(
            (c) =>
              c.upload === true ||
              (typeof c.upload === 'object' && c.upload !== null),
          )
          .map((c) => c.slug) ?? []
    }

    // Modify collections: inject AI suggestions field + optionally SEO field
    const modifiedCollections = incomingConfig.collections?.map((collection) => {
      let result = { ...collection }

      // Media suggestions: add AISuggestionsField to upload collections
      if (
        mediaEnabled &&
        targetMediaCollections.includes(collection.slug) &&
        collection.upload
      ) {
        result = {
          ...result,
          fields: [
            ...(result.fields ?? []),
            {
              name: 'aiSuggestions',
              type: 'ui' as const,
              admin: {
                components: {
                  Field: {
                    clientProps: {
                      endpointPath: mediaEndpointPath,
                      populateFields: resolvedMediaConfig.populateFields,
                    },
                    exportName: 'AISuggestionsField',
                    path: `${componentBase}/AISuggestionsField`,
                  },
                },
                position: resolvedMediaConfig.sidebarPosition
                  ? ('sidebar' as const)
                  : undefined,
              },
              // Stored on field so it survives createClientField (admin.components is stripped)
              ...({
                aiSuggestionsConfig: {
                  endpointPath: mediaEndpointPath,
                  populateFields: resolvedMediaConfig.populateFields,
                },
              } as Record<string, unknown>),
            } as import('payload').Field,
          ],
        }
      }

      // SEO: inject AIGenerateField into configured collections
      if (seoEnabled && seoOpts.collections?.length) {
        const seoCol = seoOpts.collections.find(
          (c: SEOCollectionConfig) => c.slug === collection.slug,
        )
        if (seoCol) {
          const titlePath = seoCol.titlePath ?? 'meta.title'
          const descriptionPath = seoCol.descriptionPath ?? 'meta.description'
          result = {
            ...result,
            fields: [
              ...(result.fields ?? []),
              {
                name: 'aiSeoGenerate',
                type: 'ui' as const,
                admin: {
                  components: {
                    Field: {
                      clientProps: {
                        descriptionPath,
                        endpointPath: seoEndpointPath,
                        titlePath,
                      },
                      exportName: 'AIGenerateField',
                      path: `${componentBase}/AIGenerateField`,
                    },
                  },
                },
              },
            ],
          }
        }
      }

      return result
    })

    // Build endpoints
    const endpoints = [...(incomingConfig.endpoints ?? [])]

    if (mediaEnabled) {
      endpoints.push(createAISuggestionsEndpoint(resolvedMediaConfig, brandVoice))
      if (providerSettingsEnabled) {
        endpoints.push(createClaudeUsageEndpoint(resolvedMediaConfig))
        endpoints.push(createGeminiUsageEndpoint(resolvedMediaConfig))
        endpoints.push(createListModelsEndpoint(resolvedMediaConfig))
        endpoints.push(createRefetchModelsEndpoint(resolvedMediaConfig))
        endpoints.push(createTestProviderEndpoint(resolvedMediaConfig))
      }
    }

    if (seoEnabled) {
      endpoints.push(
        createAISeoGenerateEndpoint({
          brandVoice,
          contentExtractor: seoOpts.contentExtractor,
          contentPaths: seoOpts.contentPaths,
          endpointPath: seoEndpointPath,
          providerConfig: resolvedProviderConfig,
          providerSettingsSlug,
          useSettingsGlobal: providerSettingsEnabled,
        }),
      )
    }

    // Build globals
    const globals = [...(incomingConfig.globals ?? [])]
    if (providerSettingsEnabled) {
      globals.push(
        createAIProviderSettings({
          componentBasePath: componentBase,
          endpointPath: mediaEndpointPath,
        }),
      )
    }

    // Build collections
    const collections = [...(modifiedCollections ?? [])]
    if (providerSettingsEnabled) {
      collections.push(AIModelsCollection)
    }
    const needsAiUsageLogs =
      providerSettingsEnabled ||
      (resolvedProviderConfig?.provider === 'google-gemini')
    if (needsAiUsageLogs) {
      collections.push(AIUsageLogsCollection)
    }

    return {
      ...incomingConfig,
      admin: {
        ...incomingConfig.admin,
        components: {
          ...incomingConfig.admin?.components,
        },
      },
      collections,
      endpoints,
      globals,
    }
  }
}

export type {
  FieldCraftConfig,
  MediaSuggestions,
  MediaSuggestionType,
  PopulateFieldConfig,
  ProviderConfig,
  ProviderConfigInput,
} from './types.js'
