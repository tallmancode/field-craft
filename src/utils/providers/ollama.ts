import { Ollama } from 'ollama'

import type {
  MediaSuggestions,
  OllamaCloudProviderConfig,
  OllamaProviderConfig,
} from '../../types.js'

import { getBrandVoiceInstruction } from '../brandPrompt.js'

interface OllamaGenerateResponse {
  error?: string
  response?: string
  thinking?: string
}

function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {return text}
  const truncated = text.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  return lastSpace > 0 ? truncated.substring(0, lastSpace).trim() : truncated.trim()
}

export async function generateSuggestionsWithOllama(
  imageBuffer: Buffer,
  mimeType: string,
  config: OllamaCloudProviderConfig | OllamaProviderConfig,
  additionalContext?: string,
  brandVoice?: string,
): Promise<MediaSuggestions> {
  let apiUrl = config.apiUrl
  const model = config.model
  const apiKey = config.apiKey

  if (!apiUrl) {throw new Error('Ollama API URL is not configured')}
  if (!model) {throw new Error('Ollama model is not configured')}

  apiUrl = apiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '')

  const ollama = new Ollama({
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    host: apiUrl,
  })

  const base64Image = imageBuffer.toString('base64')
  const brandInstruction = getBrandVoiceInstruction(brandVoice)

  let prompt = `${brandInstruction}

Return JSON only. No extra text.
{"title":"short title max 60 chars","alt":"describe image max 150 chars","credits":"brand/source or Unknown"}

Title: keyword-rich, descriptive
Alt: what's in image, context
Credits: identify brand/logo or Unknown`

  if (additionalContext) {prompt += `\nContext: ${additionalContext}`}

  let response: OllamaGenerateResponse
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

    response = (await ollama.generate({
      images: [base64Image],
      model,
      options: { num_predict: 1024, temperature: 0.7 },
      prompt,
      stream: false,
    })) as OllamaGenerateResponse

    clearTimeout(timeoutId)
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Ollama request timed out after 60 seconds')
      }
      if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
        throw new Error(`Cannot connect to Ollama at ${apiUrl}. Is Ollama running? Error: ${error.message}`)
      }
      if (
        error.message.includes('401') ||
        error.message.includes('403') ||
        error.message.includes('unauthorized')
      ) {
        throw new Error(`Authentication failed. Check your OLLAMA_API_KEY. Error: ${error.message}`)
      }
      if (error.message.includes('model') || error.message.includes('not found')) {
        const isCloud = apiUrl.includes('ollama.com')
        const helpText = isCloud
          ? `\n\nFor Ollama Cloud, try: llava, llama3.2-vision, qwen2-vl\nVisit https://ollama.com/library for available models.`
          : `\n\nFor local Ollama, ensure the model is pulled: ollama pull ${model}`
        throw new Error(`Model "${model}" not found or not available. ${helpText}\n\nOriginal error: ${error.message}`)
      }
      throw new Error(`Failed to generate suggestions: ${error.message}`)
    }
    throw new Error('Failed to generate suggestions: Unknown error')
  }

  if (response.error) {throw new Error(`Ollama returned error: ${response.error}`)}

  let responseText = response.response?.trim() || ''
  if (!responseText && response.thinking) {responseText = response.thinking.trim()}

  let jsonText = responseText
  const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {jsonText = codeBlockMatch[1].trim()}

  const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(
      `No JSON object found in response. Model may need more tokens. Received: ${responseText.substring(0, 300)}`,
    )
  }

  let suggestions: MediaSuggestions
  try {
    suggestions = JSON.parse(jsonMatch[0])
  } catch (_parseError) {
    let fixedJson = jsonMatch[0]
    if (!fixedJson.endsWith('}')) {
      if ((fixedJson.match(/"/g) || []).length % 2 !== 0) {fixedJson += '"'}
      fixedJson += '}'
    }
    try {
      suggestions = JSON.parse(fixedJson)
      if (!suggestions.title) {suggestions.title = 'Image'}
      if (!suggestions.alt) {suggestions.alt = 'Image description'}
      if (!suggestions.credits) {suggestions.credits = 'Unknown'}
    } catch (_secondError) {
      throw new Error(
        `Failed to parse JSON response. Received: ${responseText.substring(0, 300)}`,
      )
    }
  }

  if (!suggestions.title || !suggestions.alt || !suggestions.credits) {
    throw new Error('Invalid response structure from Ollama')
  }

  if (suggestions.title.length > 60) {suggestions.title = truncateAtWordBoundary(suggestions.title, 60)}
  if (suggestions.alt.length > 150) {suggestions.alt = truncateAtWordBoundary(suggestions.alt, 150)}
  if (suggestions.credits.length > 100) {suggestions.credits = truncateAtWordBoundary(suggestions.credits, 100)}

  return suggestions
}
