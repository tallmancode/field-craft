'use client'

import { Button, useFormFields } from '@payloadcms/ui'
import { useState } from 'react'

interface TestProviderButtonProps {
  endpointPath?: string
}

export function TestProviderButton({ endpointPath = '/ai-suggestions' }: TestProviderButtonProps) {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{
    details?: string
    message: string
    success: boolean
  } | null>(null)

  const provider = useFormFields(([fields]) => fields.provider)
  const model = useFormFields(([fields]) => fields.model)
  const apiUrl = useFormFields(([fields]) => fields.apiUrl)
  const apiKey = useFormFields(([fields]) => fields.apiKey)

  const handleTest = async () => {
    setTesting(true)
    setResult(null)

    try {
      const apiBase = typeof window !== 'undefined' ? window.location.origin : ''
      const response = await fetch(`${apiBase}/api${endpointPath}/test-provider`, {
        body: JSON.stringify({
          apiKey: apiKey.value,
          apiUrl: apiUrl.value,
          model: model.value,
          provider: provider.value,
        }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setResult({
          details: `Test completed with ${data.provider} using ${data.model}`,
          message: data.message,
          success: true,
        })
      } else {
        setResult({
          details: data.details,
          message: data.error || 'Test failed',
          success: false,
        })
      }
    } catch (error) {
      setResult({
        details: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to test provider',
        success: false,
      })
    } finally {
      setTesting(false)
    }
  }

  const canTest = provider.value && model.value

  return (
    <div style={{ marginTop: '1rem' }}>
      <Button
        disabled={!canTest || testing}
        onClick={handleTest}
        type="button"
      >
        {testing ? 'Testing...' : 'Test Provider Configuration'}
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
            borderRadius: 'var(--border-radius-m)',
            marginTop: '1rem',
            padding: '1rem',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
            {result.success ? '✓ Success' : '✗ Error'}
          </div>
          <div>{result.message}</div>
          {result.details && (
            <div
              style={{ fontSize: '0.875rem', marginTop: '0.5rem', opacity: 0.8 }}
            >
              {result.details}
            </div>
          )}
        </div>
      )}

      {!canTest && (
        <div
          style={{
            color: 'var(--theme-elevation-700)',
            fontSize: '0.875rem',
            marginTop: '0.5rem',
          }}
        >
          Please select a provider and model to test
        </div>
      )}
    </div>
  )
}
