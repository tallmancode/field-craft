import { describe, expect, test } from 'vitest'

import {
  DEFAULT_BRAND_VOICE_INSTRUCTION,
  getBrandVoiceInstruction,
} from './brandPrompt.js'

describe('getBrandVoiceInstruction', () => {
  test('with no arg returns default string (warm, conversational)', () => {
    const result = getBrandVoiceInstruction()
    expect(result).toBe(DEFAULT_BRAND_VOICE_INSTRUCTION)
    expect(result).toContain('warm')
    expect(result).toContain('conversational')
  })

  test('with empty string returns default', () => {
    expect(getBrandVoiceInstruction('')).toBe(DEFAULT_BRAND_VOICE_INSTRUCTION)
  })

  test('with whitespace-only returns default', () => {
    expect(getBrandVoiceInstruction('   ')).toBe(DEFAULT_BRAND_VOICE_INSTRUCTION)
    expect(getBrandVoiceInstruction('\t\n')).toBe(DEFAULT_BRAND_VOICE_INSTRUCTION)
  })

  test('with non-empty override returns trimmed override', () => {
    const override = 'Be formal and technical.'
    expect(getBrandVoiceInstruction(override)).toBe(override)
    expect(getBrandVoiceInstruction('  ' + override + '  ')).toBe(override)
  })
})
