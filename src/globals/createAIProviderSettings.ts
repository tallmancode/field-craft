import type { Access, GlobalConfig, Where } from 'payload'

const isAdmin: Access = ({ req: { user } }) => {
  if (!user) {return false}
  return (user as { roles?: string[] }).roles?.includes('admin') ?? false
}

const isAnyone: Access = () => true

export interface CreateAIProviderSettingsOptions {
  /** Base path for resolving components (e.g. 'field-craft/components') */
  componentBasePath: string
  /** Endpoint base path (e.g. '/ai-suggestions') for refetch/test API calls */
  endpointPath?: string
}

/**
 * Create the AI Provider Settings global with the given component base path.
 */
export function createAIProviderSettings(
  options: CreateAIProviderSettingsOptions | string,
): GlobalConfig {
  const componentBasePath =
    typeof options === 'string' ? options : options.componentBasePath
  const endpointPath =
    typeof options === 'string' ? '/ai-suggestions' : options.endpointPath ?? '/ai-suggestions'
  return {
    slug: 'ai-provider-settings',
    access: {
      read: isAnyone,
      update: isAdmin,
    },
    admin: {
      description: 'Configure AI provider settings for media suggestions and SEO generation',
      group: 'Settings',
    },
    fields: [
      {
        name: 'provider',
        type: 'select',
        admin: {
          description:
            'Select the AI provider for media suggestions and SEO generation',
        },
        defaultValue: 'ollama',
        options: [
          { label: 'Ollama (Local/Self-hosted)', value: 'ollama' },
          { label: 'Ollama (Cloud - ollama.com)', value: 'ollama-cloud' },
          { label: 'Google Gemini Vision', value: 'google-gemini' },
          { label: 'Claude (Anthropic API)', value: 'claude-api' },
        ],
        required: true,
      },
      {
        type: 'row',
        fields: [
          {
            name: 'model',
            type: 'relationship',
            admin: {
              condition: (data) => Boolean(data.provider),
              description:
                "Select from cached models. Use 'Refetch models' if the list is empty or outdated.",
              width: '85%',
            },
            filterOptions: ({ siblingData }): Where => {
              const provider = (siblingData as { provider?: string })?.provider
              if (!provider) {return { id: { in: [] } }}
              return { provider: { equals: provider } }
            },
            relationTo: 'ai-models',
            required: false,
          },
          {
            name: 'refetchModels',
            type: 'ui',
            admin: {
              components: {
                Field: {
                  clientProps: { endpointPath },
                  exportName: 'RefetchModelsButton',
                  path: `${componentBasePath}/RefetchModelsButton`,
                },
              },
              condition: (data) => Boolean(data.provider),
              width: '15%',
            },
          },
        ],
      },
      {
        name: 'apiUrl',
        type: 'text',
        admin: {
          condition: (data) =>
            data.provider === 'ollama' || data.provider === 'ollama-cloud',
          description:
            'API endpoint URL - Ollama Local: http://localhost:11434 | Ollama Cloud: https://ollama.com (default)',
        },
      },
      {
        name: 'apiKey',
        type: 'text',
        admin: {
          components: {
            Field: {
              exportName: 'RedactedApiKeyField',
              path: `${componentBasePath}/RedactedApiKeyField`,
            },
          },
          condition: (data) => Boolean(data.provider),
          description:
            'API key - Optional for Ollama Local | Required for Ollama Cloud, Google Gemini, and Claude API (console.anthropic.com)',
        },
      },
      {
        name: 'testProvider',
        type: 'ui',
        admin: {
          components: {
            Field: {
              clientProps: { endpointPath },
              exportName: 'TestProviderButton',
              path: `${componentBasePath}/TestProviderButton`,
            },
          },
          condition: (data) => Boolean(data.provider),
        },
      },
    ],
    hooks: {
      afterRead: [
        ({ doc }) => {
          const model = doc?.model
          if (model != null && typeof model === 'string') {
            if (model.includes('/') || model.includes(':') || !/^[a-f0-9]{24}$/i.test(model)) {
              doc.model = null
            }
          }
          return doc
        },
      ],
      beforeChange: [
        ({ data, originalDoc }) => {
          if (data?.provider && originalDoc?.provider && data.provider !== originalDoc.provider) {
            data.model = undefined
          }
          if (data?.model != null && typeof data.model === 'string') {
            if (
              data.model.includes('/') ||
              data.model.includes(':') ||
              !/^[a-f0-9]{24}$/i.test(data.model)
            ) {
              data.model = undefined
            }
          }
          // Preserve API keys when form sends empty (PasswordField does not return masked values on save)
          if (originalDoc) {
            if ((data?.apiKey === undefined || data?.apiKey === '') && originalDoc.apiKey) {
              data.apiKey = originalDoc.apiKey
            }
          }
          return data
        },
      ],
    },
  }
}
