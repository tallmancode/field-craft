'use client'

import type { UIFieldClientComponent } from 'payload'

import { Button, useDocumentInfo, useForm , useFormFields } from '@payloadcms/ui'
import { useState } from 'react'

import type { PopulateFieldConfig } from '../types.js'

interface AISuggestionsCustomProps {
  endpointPath?: string
  /** Fields to populate: maps AI suggestion types to text/textarea field paths */
  populateFields?: PopulateFieldConfig[]
}

export const AISuggestionsField: UIFieldClientComponent = (props) => {
  // Payload strips admin.components in createClientField, so we store config on field.aiSuggestionsConfig
  const p = props as AISuggestionsCustomProps & {
    customProps?: AISuggestionsCustomProps
    field?: {
      admin?: { components?: { Field?: { clientProps?: AISuggestionsCustomProps } } }
      aiSuggestionsConfig?: { endpointPath?: string; populateFields?: PopulateFieldConfig[] }
    }
  }
  const fromConfig = p.field?.aiSuggestionsConfig
  const fromClientProps = p.customProps ?? p.field?.admin?.components?.Field?.clientProps ?? p
  const endpointPath = fromConfig?.endpointPath ?? fromClientProps.endpointPath || '/ai-suggestions'
  const populateFields = fromConfig?.populateFields ?? fromClientProps.populateFields ?? []
  const hasFieldsConfigured = Array.isArray(populateFields) && populateFields.length > 0

  const { id } = useDocumentInfo()
  const { dispatchFields } = useForm()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<null | string>(null)
  const [success, setSuccess] = useState(false)
  const [context, setContext] = useState('')

  const filename = useFormFields(([fields]) => fields?.filename?.value)
  const url = useFormFields(([fields]) => fields?.url?.value)
  const file = useFormFields(([fields]) => fields?.file?.value) as File | undefined

  const hasFile = Boolean(url || filename || file)

  const handleGenerateSuggestions = async () => {
    if (!hasFile) {
      setError('Please upload an image file first')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      let requestBody:
        | { base64Image: string; context?: string; mimeType: string }
        | { context?: string; mediaId: string }

      if (id) {
        requestBody = {
          context: context.trim() || undefined,
          mediaId: String(id),
        }
      } else if (file) {
        const reader = new FileReader()
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            if (reader.result) {
              const base64 = (reader.result as string).split(',')[1]
              resolve(base64 || '')
            } else {
              reject(new Error('Failed to read file'))
            }
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        const base64Image = await base64Promise
        requestBody = {
          base64Image,
          context: context.trim() || undefined,
          mimeType: file.type,
        }
      } else {
        setError('No file data available')
        return
      }

      const apiUrl = typeof window !== 'undefined' ? window.location.origin : ''
      const response = await fetch(`${apiUrl}/api${endpointPath}`, {
        body: JSON.stringify(requestBody),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })

      const data = (await response.json()) as {
        details?: string
        error?: string
        success?: boolean
        suggestions?: { alt?: string; credits?: string; title?: string }
      }

      if (!response.ok) {
        setError(data.details ?? data.error ?? 'Failed to generate suggestions')
        return
      }

      if (data.success && data.suggestions) {
        const outputs: (keyof typeof data.suggestions)[] = ['title', 'alt', 'credits']
        for (let i = 0; i < populateFields.length && i < outputs.length; i++) {
          const { path } = populateFields[i]
          const value = data.suggestions[outputs[i]]
          if (value != null) {
            dispatchFields({ type: 'UPDATE', path, value })
          }
        }
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError('Invalid response from server')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Error generating AI suggestions:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{  padding: 'var(--base)' }}>
      <div style={{ marginBottom: 'var(--base)' }}>
        <h3 style={{ fontSize: 'var(--font-size-small)', margin: '0 0 var(--base) 0' }}>
          AI Suggestions
        </h3>
        <p
          style={{
            color: 'var(--theme-text)',
            fontSize: 'var(--font-size-small)',
            margin: '0 0 var(--base) 0',
            opacity: 0.7,
          }}
        >
          Generate AI-powered suggestions based on the image content and populate the configured
          text/textarea fields.
        </p>
      </div>

      {!hasFieldsConfigured && (
        <div
          style={{
            backgroundColor: 'var(--color-base-100)',
            color: 'var(--theme-text)',
            fontSize: 'var(--font-size-small)',
            marginBottom: 'calc(var(--base) / 2)',
            marginTop: 'var(--base)',
            opacity: 0.6,
            padding: 'var(--base)'
          }}
        >
          Configure <code>populateFields</code> in your FieldCraft <code>mediaSuggestions</code>{' '}
          config to enable AI suggestions. Add text/textarea field paths, e.g.{' '}
          <code>{`[{ path: 'alt', fieldType: 'text' }]`}</code>
        </div>
      )}

      <div style={{ marginBottom: 'var(--base)' }}>
        <label
          htmlFor="ai-context"
          style={{
            color: 'var(--theme-text)',
            display: 'block',
            fontSize: 'var(--font-size-small)',
            fontWeight: '600',
            marginBottom: 'calc(var(--base) / 2)',
          }}
        >
          Additional Context (optional)
        </label>
        <textarea
          id="ai-context"
          onChange={(e) => setContext(e.target.value)}
          placeholder="E.g., 'This is for a blog post about design', 'Focus on the architecture', etc."
          rows={3}
          style={{
            backgroundColor: 'var(--theme-input-bg)',
            border: '1px solid var(--theme-elevation-400)',
            borderRadius: 'var(--border-radius-s)',
            color: 'var(--theme-text)',
            fontFamily: 'inherit',
            fontSize: 'var(--font-size-small)',
            padding: 'calc(var(--base) / 2)',
            resize: 'vertical',
            width: '100%',
          }}
          value={context}
        />
      </div>

      <Button
        buttonStyle="secondary"
        disabled={isLoading || !hasFile || !hasFieldsConfigured}
        onClick={handleGenerateSuggestions}
        size="small"
      >
        {isLoading ? 'Generating...' : 'Generate AI Suggestions'}
      </Button>

      {error && (
        <div
          style={{
            backgroundColor: 'var(--theme-error-100)',
            borderRadius: 'var(--border-radius-m)',
            color: 'var(--theme-error-500)',
            fontSize: 'var(--font-size-small)',
            marginTop: 'var(--base)',
            padding: 'var(--base)',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div
          style={{
            backgroundColor: 'var(--theme-success-100)',
            borderRadius: 'var(--border-radius-m)',
            color: 'var(--theme-success-500)',
            fontSize: 'var(--font-size-small)',
            marginTop: 'var(--base)',
            padding: 'var(--base)',
          }}
        >
          <strong>Success!</strong> AI suggestions applied to fields
        </div>
      )}


      {hasFieldsConfigured && !hasFile && (
        <div
          style={{
            color: 'var(--theme-text)',
            fontSize: 'var(--font-size-small)',
            marginTop: 'var(--base)',
            opacity: 0.6,
          }}
        >
          Upload an image to enable AI suggestions
        </div>
      )}
    </div>
  )
}
