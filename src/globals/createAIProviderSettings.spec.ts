import { describe, expect, test } from 'vitest'

import { createAIProviderSettings } from './createAIProviderSettings.js'

describe('createAIProviderSettings', () => {
  test('returns object with slug ai-provider-settings', () => {
    const result = createAIProviderSettings({ componentBasePath: 'field-craft/components' })
    expect(result.slug).toBe('ai-provider-settings')
  })

  test('returns access.read and access.update as functions', () => {
    const result = createAIProviderSettings({ componentBasePath: 'field-craft/components' })
    expect(typeof result.access.read).toBe('function')
    expect(typeof result.access.update).toBe('function')
  })

  test('fields array includes provider select and model relationship', () => {
    const result = createAIProviderSettings({ componentBasePath: 'field-craft/components' })
    const providerField = result.fields.find((f) => f.name === 'provider')
    expect(providerField).toBeDefined()
    expect(providerField?.type).toBe('select')
    const row = result.fields.find((f) => f.type === 'row') as { fields?: Array<{ name?: string; relationTo?: string }> }
    const modelField = row?.fields?.find((f) => f.name === 'model')
    expect(modelField).toBeDefined()
    expect(modelField?.relationTo).toBe('ai-models')
  })

  test('options as string: uses string as componentBasePath and default endpointPath', () => {
    const result = createAIProviderSettings('my/components')
    expect(result.slug).toBe('ai-provider-settings')
    const refetchRow = result.fields.find((f) => f.type === 'row')
    expect(refetchRow).toBeDefined()
    const rowFields = (refetchRow as { fields?: unknown[] }).fields ?? []
    const refetchField = rowFields.find((f: { name?: string }) => f.name === 'refetchModels')
    expect(refetchField).toBeDefined()
    const clientProps = (refetchField as { admin?: { components?: { Field?: { clientProps?: { endpointPath?: string } } } } })
      ?.admin?.components?.Field?.clientProps
    expect(clientProps?.endpointPath).toBe('/ai-suggestions')
  })

  test('options as object with endpointPath: endpointPath is used in clientProps', () => {
    const result = createAIProviderSettings({
      componentBasePath: 'field-craft/components',
      endpointPath: '/custom-ai',
    })
    const refetchRow = result.fields.find((f) => f.type === 'row')
    const rowFields = (refetchRow as { fields?: unknown[] }).fields ?? []
    const refetchField = rowFields.find((f: { name?: string }) => f.name === 'refetchModels')
    const clientProps = (refetchField as { admin?: { components?: { Field?: { clientProps?: { endpointPath?: string } } } } })
      ?.admin?.components?.Field?.clientProps
    expect(clientProps?.endpointPath).toBe('/custom-ai')
  })
})
