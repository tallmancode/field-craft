import type { Access, CollectionConfig } from 'payload'

const isAdmin: Access = ({ req: { user } }) => {
  if (!user) {return false}
  return (user as { roles?: string[] }).roles?.includes('admin') ?? false
}

const isAuthenticated: Access = ({ req: { user } }) => Boolean(user)

export const AIModelsCollection: CollectionConfig = {
  slug: 'ai-models',
  access: {
    create: isAdmin,
    delete: isAdmin,
    read: isAuthenticated,
    update: isAdmin,
  },
  admin: {
    hidden: true,
    useAsTitle: 'displayName',
  },
  fields: [
    {
      name: 'provider',
      type: 'select',
      options: [
        { label: 'Ollama (Local)', value: 'ollama' },
        { label: 'Ollama Cloud', value: 'ollama-cloud' },
        { label: 'Google Gemini', value: 'google-gemini' },
        { label: 'Claude API', value: 'claude-api' },
      ],
      required: true,
    },
    {
      name: 'modelId',
      type: 'text',
      admin: {
        description: 'API identifier (e.g. llava:latest, models/gemini-2.5-flash)',
      },
      required: true,
    },
    {
      name: 'displayName',
      type: 'text',
      admin: {
        description: 'Human-readable label for the dropdown',
      },
    },
  ],
  timestamps: true,
}
