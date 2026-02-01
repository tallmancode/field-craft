import { describe, expect, test } from 'vitest'

import { extractContentFromDoc } from './extractContent.js'

describe('extractContentFromDoc', () => {
  test('doc with title and excerpt only', () => {
    const doc = {
      title: 'My Post',
      excerpt: 'Short summary here.',
    }
    const result = extractContentFromDoc(doc, 'posts')
    expect(result).toContain('My Post')
    expect(result).toContain('Short summary here.')
  })

  test('doc with content path (content array of blocks)', () => {
    const doc = {
      title: 'Page',
      content: [
        { blockType: 'paragraph', text: 'First paragraph.' },
        { blockType: 'heading', heading: 'Section title' },
      ],
    }
    const result = extractContentFromDoc(doc, 'posts')
    expect(result).toContain('Page')
    expect(result).toContain('First paragraph.')
    expect(result).toContain('Section title')
  })

  test('collection with default content path extracts blocks (e.g. posts)', () => {
    const doc = { title: 'Post', content: [{ text: 'Body text' }] }
    const result = extractContentFromDoc(doc, 'posts')
    expect(result).toContain('Post')
    expect(result).toContain('Body text')
  })

  test('collection with no default path still gets title and excerpt', () => {
    const doc = { title: 'Only Title', excerpt: 'Only excerpt.' }
    const result = extractContentFromDoc(doc, 'unknown-slug')
    expect(result).toContain('Only Title')
    expect(result).toContain('Only excerpt.')
  })

  test('output truncated to ~2000 chars when long', () => {
    const long = 'x'.repeat(2500)
    const doc = { title: 'Long', content: [{ text: long }] }
    const result = extractContentFromDoc(doc, 'posts')
    expect(result.length).toBeLessThanOrEqual(2004) // 2000 + '...'
    expect(result.endsWith('...')).toBe(true)
  })

  test('contentPaths override: custom path used for given slug', () => {
    const doc = {
      title: 'Custom',
      body: [{ text: 'From body path.' }],
    }
    const result = extractContentFromDoc(doc, 'custom-collection', {
      contentPaths: { 'custom-collection': ['body'] },
    })
    expect(result).toContain('Custom')
    expect(result).toContain('From body path.')
  })

  test('empty doc returns empty string', () => {
    expect(extractContentFromDoc({}, 'posts')).toBe('')
  })
})
