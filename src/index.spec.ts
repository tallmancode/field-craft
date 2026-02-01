import type { Config } from 'payload'
import { describe, expect, test } from 'vitest'

import { fieldCraft } from './index.js'

/** Minimal mock config: no db/admin, only what the plugin reads or mutates */
function mockConfig(overrides: Partial<Config> = {}): Config {
  return {
    collections: [
      {
        slug: 'media',
        upload: true,
        fields: [],
      },
      {
        slug: 'posts',
        fields: [
          {
            name: 'meta',
            type: 'group',
            fields: [
              { name: 'title', type: 'text' },
              { name: 'description', type: 'textarea' },
            ],
          },
        ],
      },
    ],
    globals: [],
    endpoints: [],
    ...overrides,
  } as unknown as Config
}

describe('fieldCraft plugin', () => {
  test('default / happy path: adds ai-models and ai-usage-logs collections', () => {
    const config = mockConfig()
    const plugin = fieldCraft({
      mediaSuggestions: { enabled: true, collections: ['media'] },
      seo: {
        enabled: true,
        collections: [{ slug: 'posts', titlePath: 'meta.title', descriptionPath: 'meta.description' }],
      },
    })
    const result = plugin(config)
    const slugs = result.collections?.map((c) => c.slug) ?? []
    expect(slugs).toContain('ai-models')
    expect(slugs).toContain('ai-usage-logs')
  })

  test('default / happy path: adds ai-provider-settings global', () => {
    const config = mockConfig()
    const plugin = fieldCraft({
      mediaSuggestions: { enabled: true, collections: ['media'] },
    })
    const result = plugin(config)
    const hasProviderSettings = result.globals?.some(
      (g) => (g as { slug?: string }).slug === 'ai-provider-settings',
    )
    expect(hasProviderSettings).toBe(true)
  })

  test('default / happy path: endpoints length increases', () => {
    const config = mockConfig()
    const plugin = fieldCraft({
      mediaSuggestions: { enabled: true, collections: ['media'] },
      seo: { enabled: true, collections: [{ slug: 'posts' }] },
    })
    const result = plugin(config)
    expect((result.endpoints ?? []).length).toBeGreaterThan(config.endpoints?.length ?? 0)
  })

  test('default / happy path: media collection has aiSuggestions field', () => {
    const config = mockConfig()
    const plugin = fieldCraft({
      mediaSuggestions: { enabled: true, collections: ['media'] },
    })
    const result = plugin(config)
    const media = result.collections?.find((c) => c.slug === 'media')
    const hasAiSuggestions = (media?.fields ?? []).some(
      (f: { name?: string }) => f.name === 'aiSuggestions',
    )
    expect(hasAiSuggestions).toBe(true)
  })

  test('default / happy path: seo collection has aiSeoGenerate field', () => {
    const config = mockConfig()
    const plugin = fieldCraft({
      mediaSuggestions: { enabled: true, collections: ['media'] },
      seo: {
        enabled: true,
        collections: [{ slug: 'posts', titlePath: 'meta.title', descriptionPath: 'meta.description' }],
      },
    })
    const result = plugin(config)
    const posts = result.collections?.find((c) => c.slug === 'posts')
    const hasAiSeo = (posts?.fields ?? []).some(
      (f: { name?: string }) => f.name === 'aiSeoGenerate',
    )
    expect(hasAiSeo).toBe(true)
  })

  test('disabled: true – no aiSuggestions/aiSeoGenerate and no media/SEO endpoints', () => {
    const config = mockConfig()
    const plugin = fieldCraft({
      disabled: true,
      mediaSuggestions: { enabled: true, collections: ['media'] },
      seo: { enabled: true, collections: [{ slug: 'posts' }] },
    })
    const result = plugin(config)
    expect((result.endpoints ?? []).length).toBe(config.endpoints?.length ?? 0)
    const media = result.collections?.find((c) => c.slug === 'media')
    const hasAiSuggestions = (media?.fields ?? []).some(
      (f: { name?: string }) => f.name === 'aiSuggestions',
    )
    expect(hasAiSuggestions).toBe(false)
    const posts = result.collections?.find((c) => c.slug === 'posts')
    const hasAiSeo = (posts?.fields ?? []).some(
      (f: { name?: string }) => f.name === 'aiSeoGenerate',
    )
    expect(hasAiSeo).toBe(false)
  })

  test('providerSettings.enabled false without providerConfig throws', () => {
    const config = mockConfig()
    const plugin = fieldCraft({
      mediaSuggestions: { enabled: true, collections: ['media'] },
      providerSettings: { enabled: false },
    })
    expect(() => plugin(config)).toThrow(/providerConfig is required/)
  })

  test('providerSettings.enabled false with providerConfig: no global, no list/refetch/test endpoints', () => {
    const config = mockConfig()
    const plugin = fieldCraft({
      mediaSuggestions: { enabled: true, collections: ['media'] },
      providerSettings: { enabled: false },
      providerConfig: { provider: 'ollama', model: 'llava:latest' },
    })
    const result = plugin(config)
    const hasProviderSettings = result.globals?.some(
      (g) => (g as { slug?: string }).slug === 'ai-provider-settings',
    )
    expect(hasProviderSettings).toBe(false)
    const paths = (result.endpoints ?? []).map((e) => (e as { path?: string }).path)
    expect(paths.some((p) => p?.includes('list-models'))).toBe(false)
    expect(paths.some((p) => p?.includes('refetch-models'))).toBe(false)
    expect(paths.some((p) => p?.includes('test-provider'))).toBe(false)
  })

  test('providerSettings.enabled false with providerConfig: media/SEO fields still added', () => {
    const config = mockConfig()
    const plugin = fieldCraft({
      mediaSuggestions: { enabled: true, collections: ['media'] },
      seo: { enabled: true, collections: [{ slug: 'posts' }] },
      providerSettings: { enabled: false },
      providerConfig: { provider: 'ollama', model: 'llava:latest' },
    })
    const result = plugin(config)
    const media = result.collections?.find((c) => c.slug === 'media')
    const hasAiSuggestions = (media?.fields ?? []).some(
      (f: { name?: string }) => f.name === 'aiSuggestions',
    )
    expect(hasAiSuggestions).toBe(true)
    const posts = result.collections?.find((c) => c.slug === 'posts')
    const hasAiSeo = (posts?.fields ?? []).some(
      (f: { name?: string }) => f.name === 'aiSeoGenerate',
    )
    expect(hasAiSeo).toBe(true)
  })

  test('mediaSuggestions.collections: only those collections get aiSuggestions', () => {
    const config = mockConfig({
      collections: [
        { slug: 'media', upload: true, fields: [] },
        { slug: 'uploads', upload: true, fields: [] },
      ],
    })
    const plugin = fieldCraft({
      mediaSuggestions: { enabled: true, collections: ['media'] },
    })
    const result = plugin(config)
    const media = result.collections?.find((c) => c.slug === 'media')
    const uploads = result.collections?.find((c) => c.slug === 'uploads')
    expect((media?.fields ?? []).some((f: { name?: string }) => f.name === 'aiSuggestions')).toBe(true)
    expect((uploads?.fields ?? []).some((f: { name?: string }) => f.name === 'aiSuggestions')).toBe(false)
  })

  test('seo.collections: only those collections get aiSeoGenerate', () => {
    const config = mockConfig({
      collections: [
        { slug: 'media', upload: true, fields: [] },
        { slug: 'posts', fields: [] },
        { slug: 'pages', fields: [] },
      ],
    })
    const plugin = fieldCraft({
      mediaSuggestions: { enabled: true, collections: ['media'] },
      seo: {
        enabled: true,
        collections: [{ slug: 'posts' }],
      },
    })
    const result = plugin(config)
    const posts = result.collections?.find((c) => c.slug === 'posts')
    const pages = result.collections?.find((c) => c.slug === 'pages')
    expect((posts?.fields ?? []).some((f: { name?: string }) => f.name === 'aiSeoGenerate')).toBe(true)
    expect((pages?.fields ?? []).some((f: { name?: string }) => f.name === 'aiSeoGenerate')).toBe(false)
  })
})
