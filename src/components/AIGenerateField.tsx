'use client'

import type { UIFieldClientComponent } from 'payload'

import { Button, Drawer , DrawerToggler, useDocumentInfo, useDrawerSlug, useForm } from '@payloadcms/ui'
import React, { useCallback, useState } from 'react'

interface AIGenerateFieldCustomProps {
  descriptionPath?: string
  endpointPath?: string
  modalTitle?: string
  target?: 'excerpt' | 'seo'
  titlePath?: string
}

export const AIGenerateField: UIFieldClientComponent = (props) => {
  const customProps = (props as { customProps?: AIGenerateFieldCustomProps }).customProps ?? {}
  const endpointPath = customProps.endpointPath ?? '/ai-seo-generate'
  const titlePath =
    customProps.titlePath ??
    (customProps.target === 'excerpt' ? undefined : 'meta.title')
  const descriptionPath =
    customProps.descriptionPath ??
    (customProps.target === 'excerpt' ? 'excerpt' : 'meta.description')
  const modalTitle =
    customProps.modalTitle ??
    (customProps.target === 'excerpt' ? 'AI Generate Excerpt' : 'AI Generate SEO')
  const target = customProps.target ?? 'seo'

  const buttonLabel = target === 'excerpt' ? 'AI Generate Excerpt' : 'AI Generate SEO'
  const descriptionText =
    target === 'excerpt'
      ? 'The prompt is pre-filled from your page content. Edit it if needed, then click Generate to create an excerpt.'
      : 'The prompt is pre-filled from your page content. Edit it if needed, then click Generate to create meta title and description.'
  const successText =
    target === 'excerpt'
      ? 'Excerpt generated and applied to field.'
      : 'SEO metadata generated and applied to fields.'
  const generateButtonLabel =
    target === 'excerpt' ? 'Generate Excerpt' : 'Generate Title & Description'

  const { collectionSlug, globalSlug } = useDocumentInfo()
  const { dispatchFields, getData } = useForm()
  const drawerSlug = useDrawerSlug(
    target === 'excerpt' ? 'ai-excerpt-generate' : 'ai-seo-generate',
  )

  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false)
  const [error, setError] = useState<null | string>(null)
  const [success, setSuccess] = useState(false)

  const slug = collectionSlug ?? globalSlug ?? ''

  const fetchDefaultPrompt = useCallback(async () => {
    if (!slug) {return}
    setIsLoadingPrompt(true)
    setError(null)
    try {
      const apiUrl = typeof window !== 'undefined' ? window.location.origin : ''
      const response = await fetch(`${apiUrl}/api${endpointPath}`, {
        body: JSON.stringify({
          action: 'extract',
          collectionSlug: slug || undefined,
          doc: getData(),
          globalSlug: slug || undefined,
        }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const data = (await response.json()) as { prompt?: string; success?: boolean }
      if (data.success && typeof data.prompt === 'string') {
        setPrompt(data.prompt)
      } else {
        setPrompt('')
      }
    } catch (err) {
      console.error('Failed to fetch default prompt:', err)
      setPrompt('')
    } finally {
      setIsLoadingPrompt(false)
    }
  }, [endpointPath, getData, slug])

  const handleOpenDrawer = useCallback(() => {
    setError(null)
    setSuccess(false)
    fetchDefaultPrompt()
  }, [fetchDefaultPrompt])

  const handleGenerate = async () => {
    const effectivePrompt = prompt.trim()
    if (!effectivePrompt) {
      setError('Enter or edit the prompt content, then click Generate.')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const apiUrl = typeof window !== 'undefined' ? window.location.origin : ''
      const response = await fetch(`${apiUrl}/api${endpointPath}`, {
        body: JSON.stringify({
          collectionSlug: slug || undefined,
          doc: getData(),
          globalSlug: slug || undefined,
          promptOverride: effectivePrompt,
          target,
        }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })

      const data = (await response.json()) as {
        description?: string
        details?: string
        error?: string
        success?: boolean
        title?: string
      }

      if (!response.ok) {
        setError(data.details ?? data.error ?? 'Failed to generate')
        return
      }

      if (data.success) {
        if (data.title && titlePath) {
          dispatchFields({ type: 'UPDATE', path: titlePath, value: data.title })
        }
        if (data.description && descriptionPath) {
          dispatchFields({ type: 'UPDATE', path: descriptionPath, value: data.description })
        }
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError(data.error ?? 'Invalid response')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ marginBottom: 'var(--base)' }}>
      <DrawerToggler onClick={handleOpenDrawer} slug={drawerSlug}>
        {buttonLabel}
      </DrawerToggler>

      <Drawer slug={drawerSlug} title={modalTitle}>
        <div style={{ padding: 'var(--base) 0' }}>
          <p
            style={{
              color: 'var(--theme-text)',
              fontSize: 'var(--font-size-small)',
              margin: '0 0 var(--base) 0',
              opacity: 0.8,
            }}
          >
            {descriptionText}
          </p>

          <div style={{ marginBottom: 'var(--base)' }}>
            <label
              htmlFor="ai-seo-prompt"
              style={{
                color: 'var(--theme-text)',
                display: 'block',
                fontSize: 'var(--font-size-small)',
                fontWeight: 600,
                marginBottom: 'calc(var(--base) / 2)',
              }}
            >
              Prompt (editable)
            </label>
            {isLoadingPrompt ? (
              <div
                style={{
                  backgroundColor: 'var(--theme-elevation-100)',
                  borderRadius: 'var(--border-radius-m)',
                  fontSize: 'var(--font-size-small)',
                  padding: 'var(--base)',
                }}
              >
                Loading content...
              </div>
            ) : (
              <textarea
                id="ai-seo-prompt"
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Page content will be extracted automatically, or enter custom prompt..."
                rows={8}
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
                value={prompt}
              />
            )}
          </div>

          <Button
            buttonStyle="primary"
            disabled={isLoading || isLoadingPrompt || !prompt.trim()}
            onClick={handleGenerate}
            size="small"
            type="button"
          >
            {isLoading ? 'Generating...' : generateButtonLabel}
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
              {error}
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
              {successText}
            </div>
          )}
        </div>
      </Drawer>
    </div>
  )
}
