'use client'

import type { TextFieldClientComponent } from 'payload'

import { PasswordField } from '@payloadcms/ui'
import React from 'react'

export const RedactedApiKeyField: TextFieldClientComponent = (props) => {
  const { field, path } = props
  const fieldPath = path || field.name
  const fieldWithPlaceholder = {
    ...field,
    admin: {
      ...field.admin,
      placeholder: 'Enter API key',
    },
  }

  return (
    <div className="field-type redacted-api-key-field">
      <PasswordField
        field={fieldWithPlaceholder as Parameters<typeof PasswordField>[0]['field']}
        path={fieldPath}
        validate={() => true}
      />
    </div>
  )
}
