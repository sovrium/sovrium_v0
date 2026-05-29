// Third-party imports
import { useForm, type AnyFieldApi } from '@tanstack/react-form'
import { useState } from 'react'
import { XIcon } from 'lucide-react'

// Feature imports
import type { InputDto } from '../../../features/form/application/dto/input.dto'

// Shared UI imports
import { cn } from '../lib/utils.lib'
import { FormDescription, FormItem, FormLabel, FormMessage } from '../ui/form.ui'
import { Input } from '../ui/input.ui'
import { Button } from '../ui/button.ui'
import { Textarea } from '../ui/textarea.ui'
import { Checkbox } from '../ui/checkbox.ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.ui'
import { AlertDestructive } from './alert.component'

function FormInfo({ formField }: { formField: AnyFieldApi }) {
  return (
    <>
      {formField.state.meta.isTouched && !formField.state.meta.isValid ? (
        <em>{formField.state.meta.errors.join(',')}</em>
      ) : null}
      {formField.state.meta.isValidating ? 'Validating...' : null}
    </>
  )
}

function FormInput({ field, input }: { field: AnyFieldApi; input: InputDto }) {
  const props = {
    id: field.name,
    name: field.name,
    value: String(field.state.value ?? ''),
    onBlur: field.handleBlur,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>) =>
      field.handleChange(e.target.value),
  }
  const textProps = {
    required: input.required,
    placeholder: 'placeholder' in input ? input.placeholder : undefined,
  }
  switch (input.type) {
    case 'single-line-text':
      return (
        <Input
          {...props}
          type="text"
          {...textProps}
        />
      )
    case 'phone-number':
      return (
        <Input
          {...props}
          type="tel"
          {...textProps}
        />
      )
    case 'email':
      return (
        <Input
          {...props}
          type="email"
          {...textProps}
        />
      )
    case 'url':
      return (
        <Input
          {...props}
          type="url"
          {...textProps}
        />
      )
    case 'long-text':
      return (
        <Textarea
          {...props}
          {...textProps}
        />
      )
    case 'checkbox':
      return (
        <Checkbox
          id={field.name}
          name={field.name}
          checked={field.state.value === 'true'}
          onCheckedChange={(checked) => field.handleChange(checked ? 'true' : 'false')}
          required={input.required}
          onBlur={field.handleBlur}
        />
      )
    case 'single-select': {
      const showClear = Boolean(field.state.value) && !input.required
      return (
        <div className="relative w-[240px]">
          <Select
            name={field.name}
            onValueChange={(value) => field.handleChange(value)}
            value={field.state.value ?? ''}
            required={input.required}
            autoComplete="off"
          >
            <SelectTrigger className={cn('w-full', showClear && 'pr-12')}>
              <SelectValue placeholder={input.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {input.options.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showClear ? (
            <button
              type="button"
              aria-label="Clear selection"
              onClick={() => field.handleChange('')}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-8 -translate-y-1/2"
            >
              <XIcon className="size-4" />
            </button>
          ) : null}
        </div>
      )
    }
    case 'single-attachment':
      return (
        <Input
          id={field.name}
          name={field.name}
          type="file"
          required={input.required}
          accept={input.accept}
          onBlur={field.handleBlur}
          onChange={(e) => {
            field.handleChange(e.target.files?.[0])
          }}
        />
      )
    default: {
      const _exhaustiveCheck: never = input
      throw new Error(`Unhandled case: ${_exhaustiveCheck}`)
    }
  }
}

type FormProps = {
  inputs: InputDto[]
  onSubmit: (values: Record<string, string | File>) => Promise<void>
  submitLabel?: string
}

export function Form({ inputs, onSubmit, submitLabel = 'Submit' }: FormProps) {
  const [submissionError, setSubmissionError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: inputs.reduce((acc: Record<string, string | File>, input) => {
      if ('defaultValue' in input) {
        acc[input.name] = String(input.defaultValue)
      }
      return acc
    }, {}),
    onSubmit: async ({ value }: { value: Record<string, string | File> }) => {
      try {
        setSubmissionError(null)
        await onSubmit(value)
      } catch (error) {
        setSubmissionError(
          error instanceof Error ? error.message : 'An error occurred during submission'
        )
      }
    },
  })

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <div className="space-y-4">
          {inputs.map((input) => {
            return (
              <form.Field
                key={input.name}
                name={input.name}
                children={(field) => {
                  return (
                    <FormItem>
                      <FormLabel htmlFor={field.name}>
                        <div className="flex w-full items-center justify-between gap-2">
                          <span>{input.label}</span>
                          {input.required ? <span className="text-red-500">*</span> : null}
                        </div>
                      </FormLabel>
                      <FormInput
                        field={field}
                        input={input}
                      />
                      <FormDescription>{input.description}</FormDescription>
                      <FormMessage>
                        <FormInfo formField={field} />
                      </FormMessage>
                    </FormItem>
                  )
                }}
              />
            )
          })}
          {submissionError && (
            <div className="mb-4">
              <AlertDestructive
                title="Submission failed"
                description={submissionError}
              />
            </div>
          )}
        </div>
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <div className="mt-4 flex justify-end gap-4">
              <Button
                type="submit"
                disabled={!canSubmit}
              >
                {isSubmitting ? '...' : submitLabel}
              </Button>
            </div>
          )}
        />
      </form>
    </div>
  )
}
