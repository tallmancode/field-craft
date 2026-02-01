'use client'

import { Button, useFormFields } from '@payloadcms/ui'
import { useState } from 'react'

interface RefetchModelsButtonProps {
  endpointPath?: string
}

export function RefetchModelsButton({ endpointPath = '/ai-suggestions' }: RefetchModelsButtonProps) {
  const [refetching, setRefetching] = useState(false)
  const [result, setResult] = useState<{
    details?: string
    message: string
    success: boolean
  } | null>(null)

  const provider = useFormFields(([fields]) => fields.provider)

  const handleRefetch = async () => {
    if (!provider?.value) {return}

    setRefetching(true)
    setResult(null)

    try {
      const apiUrl = typeof window !== 'undefined' ? window.location.origin : ''
      const response = await fetch(`${apiUrl}/api${endpointPath}/refetch-models`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setResult({
          details:
            data.count != null
              ? `Open the model dropdown to see updated options.`
              : undefined,
          message: data.message || `Fetched ${data.count} model(s).`,
          success: true,
        })
      } else {
        setResult({
          details: data.details,
          message: data.error || 'Refetch failed',
          success: false,
        })
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      const isNetwork =
        msg.includes('Failed to fetch') ||
        msg.includes('Connection refused') ||
        msg.includes('ERR_CONNECTION_REFUSED') ||
        msg.includes('NetworkError')
      setResult({
        details: isNetwork
          ? `${msg}. Ensure the dev server is running (e.g. pnpm dev).`
          : msg,
        message: 'Failed to refetch models',
        success: false,
      })
    } finally {
      setRefetching(false)
    }
  }

  const canRefetch = Boolean(provider?.value)

  return (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'row',
        gap: '0.5rem',
      }}
    >
      <Button disabled={!canRefetch || refetching} onClick={handleRefetch}>
        {refetching ? 'Refetching...' : 'Refetch models'}
      </Button>
      {result && (
        <div
          style={{
            backgroundColor: result.success
              ? 'var(--theme-success-50)'
              : 'var(--theme-error-50)',
            border: `1px solid ${
              result.success ? 'var(--theme-success-500)' : 'var(--theme-error-500)'
            }`,
            borderRadius: 'var(--border-radius-s)',
            fontSize: '0.75rem',
            maxWidth: '100%',
            padding: '0.25rem 0.5rem',
          }}
        >
          {result.success ? '✓' : '✗'} {result.message}
          {result.details && (
            <div style={{ marginTop: '0.125rem', opacity: 0.9 }}>{result.details}</div>
          )}
        </div>
      )}
    </div>
  )
}
