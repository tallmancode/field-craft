import type { Access, CollectionConfig } from 'payload'

const isAdmin: Access = ({ req: { user } }) => {
  if (!user) {return false}
  return (user as { roles?: string[] }).roles?.includes('admin') ?? false
}

export const AIUsageLogsCollection: CollectionConfig = {
  slug: 'ai-usage-logs',
  access: {
    create: isAdmin,
    delete: isAdmin,
    read: isAdmin,
    update: () => false,
  },
  admin: {
    hidden: true,
  },
  fields: [
    {
      name: 'provider',
      type: 'text',
      admin: {
        description: 'AI provider (e.g. google-gemini)',
      },
      required: true,
    },
    {
      name: 'model',
      type: 'text',
      admin: {
        description: 'Model identifier used for the request',
      },
      required: true,
    },
    {
      name: 'inputTokens',
      type: 'number',
      defaultValue: 0,
      required: true,
    },
    {
      name: 'outputTokens',
      type: 'number',
      defaultValue: 0,
      required: true,
    },
  ],
  timestamps: true,
}
