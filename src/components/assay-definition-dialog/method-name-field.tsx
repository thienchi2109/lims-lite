'use client'

import { useEffect, useMemo, useState } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { FlaskConical } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AssayFormValues } from './types'

type Props = {
  form: UseFormReturn<AssayFormValues>
  suggestions: string[]
  loading: boolean
  disabled?: boolean
}

const MAX_VISIBLE_SUGGESTIONS = 6

function normalize(value: string) {
  return value.trim().toLowerCase()
}

export function MethodNameField({
  form,
  suggestions,
  loading,
  disabled = false,
}: Props) {
  const methodName = form.watch('methodName') || ''
  const [debouncedQuery, setDebouncedQuery] = useState(methodName)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(methodName)
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [methodName])

  const visibleSuggestions = useMemo(() => {
    const query = normalize(debouncedQuery)
    return suggestions
      .filter((suggestion) => {
        const normalized = normalize(suggestion)
        if (!normalized || normalized === normalize(methodName)) return false
        return query ? normalized.includes(query) : true
      })
      .slice(0, MAX_VISIBLE_SUGGESTIONS)
  }, [debouncedQuery, methodName, suggestions])

  const applySuggestion = (suggestion: string) => {
    form.setValue('methodName', suggestion, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="methodName">
        Phương pháp <span className="text-red-500">*</span>
      </Label>
      <div className="relative">
        <FlaskConical className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          id="methodName"
          {...form.register('methodName')}
          placeholder="Ví dụ: ELISA, RT-PCR, sắc ký lỏng"
          className="pl-9"
          disabled={disabled}
          autoComplete="off"
        />
      </div>
      {form.formState.errors.methodName && (
        <p className="text-sm text-destructive">
          {form.formState.errors.methodName.message}
        </p>
      )}
      <div className="min-h-8">
        {loading ? (
          <p className="text-xs text-muted-foreground">Đang tải gợi ý phương pháp...</p>
        ) : visibleSuggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2" aria-label="Gợi ý phương pháp">
            {visibleSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="rounded-md border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                onClick={() => applySuggestion(suggestion)}
                disabled={disabled}
                aria-label={`Dùng gợi ý phương pháp ${suggestion}`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nhập tự do hoặc chọn gợi ý có sẵn.
          </p>
        )}
      </div>
    </div>
  )
}
