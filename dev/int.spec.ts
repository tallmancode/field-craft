import type { Config, Payload } from 'payload'

import configModule from '@payload-config'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

let payload: Payload
let config: Config

afterAll(async () => {
  // Payload 3 may not expose destroy - process exit cleans up
})

beforeAll(async () => {
  config = await configModule
  payload = await getPayload({ config })
})

describe('FieldCraft plugin integration tests', () => {
  test('plugin adds ai-models and ai-usage-logs collections', async () => {
    expect(payload.collections['ai-models']).toBeDefined()
    expect(payload.collections['ai-usage-logs']).toBeDefined()
  })

  test('plugin adds ai-provider-settings global', async () => {
    const globals = config.globals ?? []
    const hasProviderSettings = globals.some(
      (g: { slug?: string }) => g.slug === 'ai-provider-settings',
    )
    expect(hasProviderSettings).toBe(true)
  })

  test('posts collection has aiSeoGenerate field from SEO feature', async () => {
    const postsCollection = config.collections?.find(
      (c: { slug?: string }) => c.slug === 'posts',
    )
    const hasAiSeoField = (postsCollection?.fields ?? []).some(
      (f: { name?: string }) => f.name === 'aiSeoGenerate',
    )
    expect(hasAiSeoField).toBe(true)
  })

  test('media collection has aiSuggestions field from media suggestions feature', async () => {
    const mediaCollection = config.collections?.find(
      (c: { slug?: string }) => c.slug === 'media',
    )
    const hasAiSuggestionsField = (mediaCollection?.fields ?? []).some(
      (f: { name?: string }) => f.name === 'aiSuggestions',
    )
    expect(hasAiSuggestionsField).toBe(true)
  })
})
