import { GoogleGenerativeAI } from '@google/generative-ai'

import type { GoogleGeminiProviderConfig, MediaSuggestions } from '../../types.js'

import { getBrandVoiceInstruction } from '../brandPrompt.js'

function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {return text}
  const truncated = text.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  return lastSpace > 0 ? truncated.substring(0, lastSpace).trim() : truncated.trim()
}

export async function generateSuggestionsWithGoogle(
  imageBuffer: Buffer,
  mimeType: string,
  config: GoogleGeminiProviderConfig,
  additionalContext?: string,
  brandVoice?: string,
): Promise<MediaSuggestions> {
  const model = config.model
  const apiKey = config.apiKey

  if (!apiKey) {throw new Error('Google Gemini API key is not configured')}
  if (!model) {throw new Error('Google Gemini model is not configured')}

  const brandInstruction = getBrandVoiceInstruction(brandVoice)

  let prompt = `${brandInstruction}

Analyze this image and provide metadata. Respond with ONLY a valid JSON object in this exact format:

{"title":"SEO title (max 60 chars)","alt":"Accessible description (max 150 chars)","credits":"Source/brand or Unknown"}

Requirements:
- Title: Keyword-rich, descriptive
- Alt: What's in the image with context
- Credits: Identify brand/logo/source or use "Unknown"
- Keep responses concise and within character limits
- Output ONLY the JSON, no other text`

  if (additionalContext) {prompt += `\nContext: ${additionalContext}`}

  const genAI = new GoogleGenerativeAI(apiKey)
  const geminiModel = genAI.getGenerativeModel({ model })
  const base64Image = imageBuffer.toString('base64')
  const imagePart = {
    inlineData: { data: base64Image, mimeType },
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000)

  const result = await geminiModel.generateContent({
    contents: [{ parts: [{ text: prompt }, imagePart], role: 'user' }],
    generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
  })

  clearTimeout(timeoutId)

  const response = result.response
  const responseText = response.text().trim()

  if (config.onUsageRecord) {
    const usageMetadata = response.usageMetadata
    const inputTokens = usageMetadata?.promptTokenCount ?? 0
    const outputTokens = usageMetadata?.candidatesTokenCount ?? 0
    if (inputTokens > 0 || outputTokens > 0) {
      void config.onUsageRecord({ inputTokens, model, outputTokens })
    }
  }

  if (!responseText) {throw new Error('Empty response from Google Gemini')}

  let jsonText = responseText
  const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {jsonText = codeBlockMatch[1].trim()}

  const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(
      `No complete JSON object found in response. Received: ${responseText.substring(0, 300)}`,
    )
  }

  let suggestions: MediaSuggestions
  try {
    suggestions = JSON.parse(jsonMatch[0])
  } catch (_parseError) {
    let fixedJson = jsonMatch[0]
    if (!fixedJson.endsWith('}')) {fixedJson += '}'}
    const openBraces = (fixedJson.match(/\{/g) || []).length
    const closeBraces = (fixedJson.match(/\}/g) || []).length
    if (openBraces > closeBraces) {fixedJson += '}'.repeat(openBraces - closeBraces)}
    try {
      suggestions = JSON.parse(fixedJson)
    } catch (_secondError) {
      throw new Error(
        `Failed to parse JSON response. Received: ${responseText.substring(0, 300)}`,
      )
    }
  }

  if (!suggestions.title || !suggestions.alt || !suggestions.credits) {
    throw new Error('Invalid response structure from Google Gemini')
  }

  if (suggestions.title.length > 60) {suggestions.title = truncateAtWordBoundary(suggestions.title, 60)}
  if (suggestions.alt.length > 150) {suggestions.alt = truncateAtWordBoundary(suggestions.alt, 150)}
  if (suggestions.credits.length > 100) {suggestions.credits = truncateAtWordBoundary(suggestions.credits, 100)}

  return suggestions
}
