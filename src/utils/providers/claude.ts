import Anthropic from '@anthropic-ai/sdk'

import type { ClaudeApiProviderConfig, MediaSuggestions } from '../../types.js'

import { getBrandVoiceInstruction } from '../brandPrompt.js'

function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {return text}
  const truncated = text.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  return lastSpace > 0 ? truncated.substring(0, lastSpace).trim() : truncated.trim()
}

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const

function normalizeMediaType(
  mimeType: string,
): 'image/gif' | 'image/jpeg' | 'image/png' | 'image/webp' {
  const normalized = mimeType.toLowerCase().split(';')[0].trim()
  if (ALLOWED_MEDIA_TYPES.includes(normalized as (typeof ALLOWED_MEDIA_TYPES)[number])) {
    return normalized as 'image/gif' | 'image/jpeg' | 'image/png' | 'image/webp'
  }
  return 'image/jpeg'
}

export async function generateSuggestionsWithClaude(
  imageBuffer: Buffer,
  mimeType: string,
  config: ClaudeApiProviderConfig,
  additionalContext?: string,
  brandVoice?: string,
): Promise<MediaSuggestions> {
  const model = config.model
  const apiKey = config.apiKey

  if (!apiKey) {throw new Error('Claude API key is not configured')}
  if (!model) {throw new Error('Claude model is not configured')}

  const brandInstruction = getBrandVoiceInstruction(brandVoice)
  const mediaType = normalizeMediaType(mimeType)
  const base64Image = imageBuffer.toString('base64')

  let prompt = `${brandInstruction}

Analyze this image and provide metadata. Respond with ONLY a valid JSON object in this exact format:

{"title":"SEO title (max 60 chars)","alt":"Accessible description (max 150 chars)","credits":"Source/brand or Unknown"}

Requirements:
- Title: Keyword-rich, descriptive, relative to the software developer industry
- Alt: What's in the image with context and tie it back to the software developer industry, Identify brand logos if present
- Credits: Identify brand/logo/source or use "Unknown"
- Keep responses concise and within character limits
- Output ONLY the JSON, no other text`

  if (additionalContext) {prompt += `\nContext: ${additionalContext}`}

  let responseText: string
  try {
    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      max_tokens: 1024,
      messages: [
        {
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                data: base64Image,
                media_type: mediaType,
              },
            },
            { type: 'text', text: prompt },
          ],
          role: 'user',
        },
      ],
      model,
    })
    const textBlock = message.content.find((block) => block.type === 'text')
    responseText = textBlock && 'text' in textBlock ? textBlock.text.trim() : ''
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        throw new Error('Claude API request timed out after 60 seconds')
      }
      if (
        error.name === 'AuthenticationError' ||
        error.message.includes('401') ||
        error.message.includes('invalid_api_key')
      ) {
        throw new Error(
          `Invalid Claude API key. Get a key at https://console.anthropic.com/ Error: ${error.message}`,
        )
      }
      if (error.name === 'PermissionDeniedError' || error.message.includes('403')) {
        throw new Error(`Claude API permission denied. Error: ${error.message}`)
      }
      if (error.name === 'RateLimitError' || error.message.includes('429')) {
        throw new Error(`Claude API rate limit exceeded. Error: ${error.message}`)
      }
      if (
        error.message.includes('model') ||
        error.message.includes('not found') ||
        error.message.includes('404')
      ) {
        throw new Error(
          `Model "${model}" not found or not available for vision. ` +
            `Check model ID at https://docs.anthropic.com/en/docs/about-claude/models. Original error: ${error.message}`,
        )
      }
      throw new Error(`Failed to generate suggestions: ${error.message}`)
    }
    throw new Error('Failed to generate suggestions: Unknown error')
  }

  if (!responseText) {throw new Error('Empty response from Claude API')}

  let jsonText = responseText
  const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1].trim()
  } else {
    jsonText = responseText.replace(/^```(?:json)?\s*/i, '').trim()
  }

  let jsonStr: string
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    jsonStr = jsonMatch[0]
  } else {
    const start = jsonText.indexOf('{')
    if (start === -1) {
      throw new Error(`No JSON object found in response. Received: ${responseText.substring(0, 300)}`)
    }
    jsonStr = jsonText.slice(start)
    if (!jsonStr.endsWith('}')) {
      const inKeyOrValue = (jsonStr.match(/"/g) || []).length % 2 !== 0
      if (inKeyOrValue) {jsonStr += '"'}
      if (!jsonStr.trimEnd().endsWith('}')) {jsonStr += '}'}
    }
    const openBraces = (jsonStr.match(/\{/g) || []).length
    const closeBraces = (jsonStr.match(/\}/g) || []).length
    if (openBraces > closeBraces) {
      jsonStr += '}'.repeat(openBraces - closeBraces)
    }
  }

  let suggestions: MediaSuggestions
  try {
    suggestions = JSON.parse(jsonStr)
  } catch (_parseError) {
    let fixedJson = jsonStr
    if (!fixedJson.endsWith('}')) {fixedJson += '}'}
    const openBraces = (fixedJson.match(/\{/g) || []).length
    const closeBraces = (fixedJson.match(/\}/g) || []).length
    if (openBraces > closeBraces) {
      fixedJson += '}'.repeat(openBraces - closeBraces)
    }
    try {
      suggestions = JSON.parse(fixedJson)
    } catch (_secondError) {
      throw new Error(
        `Failed to parse JSON response from Claude. Received: ${responseText.substring(0, 300)}`,
      )
    }
  }

  if (!suggestions.title) {suggestions.title = 'Image'}
  if (!suggestions.alt) {suggestions.alt = 'Image description'}
  if (!suggestions.credits) {suggestions.credits = 'Unknown'}

  if (suggestions.title.length > 60) {suggestions.title = truncateAtWordBoundary(suggestions.title, 60)}
  if (suggestions.alt.length > 150) {suggestions.alt = truncateAtWordBoundary(suggestions.alt, 150)}
  if (suggestions.credits.length > 100) {suggestions.credits = truncateAtWordBoundary(suggestions.credits, 100)}

  return suggestions
}
