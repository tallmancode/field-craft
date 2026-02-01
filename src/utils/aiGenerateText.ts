/**
 * AI-powered text generation for SEO metadata (title, description).
 * Supports Claude, Google Gemini, and Ollama - text-only (no image input).
 */

import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Ollama } from 'ollama'

import type {
  ClaudeApiProviderConfig,
  GoogleGeminiProviderConfig,
  OllamaCloudProviderConfig,
  OllamaProviderConfig,
  ProviderConfig,
} from '../types.js'

import { getBrandVoiceInstruction } from './brandPrompt.js'

const TITLE_MAX_LENGTH = 60
const DESCRIPTION_MAX_LENGTH = 155

function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {return text}
  const truncated = text.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  return lastSpace > 0 ? truncated.substring(0, lastSpace).trim() : truncated.trim()
}

function buildSeoPrompt(brandVoice?: string): string {
  const brandInstruction = getBrandVoiceInstruction(brandVoice)
  return `${brandInstruction}

Based on the following content, generate SEO metadata. Respond with ONLY a valid JSON object in this exact format:
{"title":"SEO meta title (max 60 chars)","description":"Meta description (max 155 chars)"}

Requirements:
- Title: Concise, keyword-rich, compelling
- Description: Summary that encourages clicks, within 155 chars
- Output ONLY the JSON, no markdown or other text`
}

async function generateWithClaude(
  prompt: string,
  config: ClaudeApiProviderConfig,
  brandVoice?: string,
): Promise<{ description: string; title: string }> {
  const anthropic = new Anthropic({ apiKey: config.apiKey })
  const fullPrompt = `${buildSeoPrompt(brandVoice)}\n\nContent:\n${prompt}`

  const message = await anthropic.messages.create({
    max_tokens: 512,
    messages: [{ content: fullPrompt, role: 'user' }],
    model: config.model,
  })

  const textBlock = message.content.find((block) => block.type === 'text')
  const responseText = textBlock && 'text' in textBlock ? textBlock.text.trim() : ''
  return parseSeoResponse(responseText)
}

async function generateWithGoogle(
  prompt: string,
  config: GoogleGeminiProviderConfig,
  brandVoice?: string,
): Promise<{ description: string; title: string }> {
  if (!config.apiKey) {throw new Error('Google Gemini API key is required')}
  if (!config.model) {throw new Error('Google Gemini model is required')}
  const genAI = new GoogleGenerativeAI(config.apiKey)
  const modelName = config.model
  const model = genAI.getGenerativeModel({ model: modelName })
  const fullPrompt = `${buildSeoPrompt(brandVoice)}\n\nContent:\n${prompt}`

  const result = await model.generateContent({
    contents: [{ parts: [{ text: fullPrompt }], role: 'user' }],
    generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
  })

  const response = result.response
  const responseText = response.text().trim()

  if (config.onUsageRecord) {
    const usageMetadata = response.usageMetadata
    const inputTokens = usageMetadata?.promptTokenCount ?? 0
    const outputTokens = usageMetadata?.candidatesTokenCount ?? 0
    if (inputTokens > 0 || outputTokens > 0) {
      void config.onUsageRecord({ inputTokens, model: modelName, outputTokens })
    }
  }

  return parseSeoResponse(responseText)
}

async function generateWithOllama(
  prompt: string,
  config: OllamaCloudProviderConfig | OllamaProviderConfig,
  brandVoice?: string,
): Promise<{ description: string; title: string }> {
  const apiUrl = (config.apiUrl || 'http://localhost:11434')
    .replace(/\/api\/?$/, '')
    .replace(/\/$/, '')

  const ollama = new Ollama({
    headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : undefined,
    host: apiUrl,
  })

  const fullPrompt = `${buildSeoPrompt(brandVoice)}\n\nContent:\n${prompt}`

  const response = (await ollama.generate({
    model: config.model,
    options: { num_predict: 512, temperature: 0.7 },
    prompt: fullPrompt,
    stream: false,
  })) as { response?: string }

  const responseText = response.response?.trim() || ''
  return parseSeoResponse(responseText)
}

function parseSeoResponse(responseText: string): { description: string; title: string } {
  let jsonText = responseText
  const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {jsonText = codeBlockMatch[1].trim()}

  const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`No JSON found in AI response: ${responseText.substring(0, 200)}`)
  }

  let parsed: { description?: string; title?: string }
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error(`Invalid JSON in AI response: ${responseText.substring(0, 200)}`)
  }

  const title = (parsed.title || 'Untitled').trim()
  const description = (parsed.description || '').trim()

  return {
    description:
      description.length > DESCRIPTION_MAX_LENGTH
        ? truncateAtWordBoundary(description, DESCRIPTION_MAX_LENGTH)
        : description,
    title: title.length > TITLE_MAX_LENGTH ? truncateAtWordBoundary(title, TITLE_MAX_LENGTH) : title,
  }
}

/**
 * Generate SEO metadata (title and description) from content using AI.
 */
export async function generateSEOMetadata(
  prompt: string,
  providerConfig: ProviderConfig,
  brandVoice?: string,
): Promise<{ description: string; title: string }> {
  if (!prompt.trim()) {
    throw new Error('Prompt content is required for AI generation')
  }

  switch (providerConfig.provider) {
    case 'claude-api':
      return generateWithClaude(prompt, providerConfig, brandVoice)
    case 'google-gemini':
      return generateWithGoogle(prompt, providerConfig, brandVoice)
    case 'ollama':
    case 'ollama-cloud':
      return generateWithOllama(prompt, providerConfig, brandVoice)
    default: {
      const cfg = providerConfig as ProviderConfig
      throw new Error(`Unsupported provider for text generation: ${cfg.provider}`)
    }
  }
}
