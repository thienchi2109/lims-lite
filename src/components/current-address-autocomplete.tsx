'use client'

import {
    useEffect,
    useId,
    useRef,
    useState,
    type ComponentProps,
    type KeyboardEvent,
} from 'react'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
    ADDRESS_SEARCH_DEBOUNCE_MS,
    normalizeAdministrativeAddressQuery,
    type VietnameseAddressSuggestion,
} from '@/lib/vietnamese-address/contracts'
import { searchVietnameseAddressClient } from '@/lib/vietnamese-address/client'

interface CurrentAddressAutocompleteProps extends Omit<
    ComponentProps<typeof Input>,
    'onChange' | 'value'
> {
    value: string
    onChange: (value: string) => void
}

export function CurrentAddressAutocomplete({
    value,
    onChange,
    className,
    disabled,
    onBlur,
    onFocus,
    onKeyDown,
    ...inputProps
}: CurrentAddressAutocompleteProps) {
    const generatedId = useId()
    const listboxId = `${generatedId}-suggestions`
    const requestVersionRef = useRef(0)
    const [suggestionState, setSuggestionState] = useState<{
        value: string
        suggestions: VietnameseAddressSuggestion[]
    }>({
        value: '',
        suggestions: [],
    })
    const [activeIndex, setActiveIndex] = useState(-1)
    const [isOpen, setIsOpen] = useState(false)
    const [loadingValue, setLoadingValue] = useState<string | null>(null)
    const [isAvailable, setIsAvailable] = useState(true)
    const [userQueryValue, setUserQueryValue] = useState<string | null>(null)
    const suggestions = (
        isAvailable && suggestionState.value === value
        && userQueryValue === value
    )
        ? suggestionState.suggestions
        : []
    const isLoading = loadingValue === value

    useEffect(() => {
        const requestVersion = ++requestVersionRef.current
        const controller = new AbortController()
        const query = userQueryValue === value
            ? normalizeAdministrativeAddressQuery(userQueryValue)
            : null

        if (!query || !isAvailable || disabled) {
            return () => controller.abort()
        }

        const timer = setTimeout(async () => {
            setLoadingValue(value)
            const result = await searchVietnameseAddressClient(query, {
                signal: controller.signal,
            })

            if (requestVersion !== requestVersionRef.current) {
                return
            }

            if (result.disabled) {
                setIsAvailable(false)
            }
            setSuggestionState({
                value,
                suggestions: result.data?.suggestions ?? [],
            })
            setActiveIndex(-1)
            setLoadingValue((current) => current === value ? null : current)
        }, ADDRESS_SEARCH_DEBOUNCE_MS)

        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [disabled, isAvailable, userQueryValue, value])

    const selectSuggestion = (suggestion: VietnameseAddressSuggestion) => {
        requestVersionRef.current += 1
        setUserQueryValue(null)
        setSuggestionState({ value: '', suggestions: [] })
        setActiveIndex(-1)
        setIsOpen(false)
        onChange(suggestion.formatted_address)
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        onKeyDown?.(event)
        if (event.defaultPrevented) {
            return
        }

        if (!isOpen || suggestions.length === 0) {
            return
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActiveIndex((index) => (index + 1) % suggestions.length)
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex((index) => (
                index <= 0 ? suggestions.length - 1 : index - 1
            ))
        } else if (event.key === 'Enter' && activeIndex >= 0) {
            event.preventDefault()
            selectSuggestion(suggestions[activeIndex])
        } else if (event.key === 'Escape') {
            setIsOpen(false)
        }
    }

    return (
        <div className="relative">
            <Input
                {...inputProps}
                value={value}
                disabled={disabled}
                className={cn('pr-9', className)}
                role="combobox"
                aria-autocomplete="list"
                aria-controls={isOpen ? listboxId : undefined}
                aria-expanded={isOpen && suggestions.length > 0}
                onChange={(event) => {
                    const nextValue = event.target.value
                    requestVersionRef.current += 1
                    setUserQueryValue(nextValue)
                    setIsOpen(true)
                    setActiveIndex(-1)
                    onChange(nextValue)
                }}
                onFocus={(event) => {
                    setIsOpen(true)
                    onFocus?.(event)
                }}
                onBlur={(event) => {
                    setIsOpen(false)
                    onBlur?.(event)
                }}
                onKeyDown={handleKeyDown}
            />
            {isLoading ? (
                <Loader2
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground"
                />
            ) : null}
            {isOpen && suggestions.length > 0 ? (
                <div
                    id={listboxId}
                    role="listbox"
                    className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                >
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={`${suggestion.level}-${suggestion.code}`}
                            type="button"
                            role="option"
                            aria-selected={index === activeIndex}
                            className={cn(
                                'flex w-full items-start rounded-sm px-2 py-2 text-left text-sm',
                                'hover:bg-accent hover:text-accent-foreground',
                                index === activeIndex && 'bg-accent text-accent-foreground',
                            )}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selectSuggestion(suggestion)}
                        >
                            {suggestion.formatted_address}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    )
}
