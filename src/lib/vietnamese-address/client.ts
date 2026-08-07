import {
    ADDRESS_SEARCH_LIMIT,
    VietnameseAddressSuggestionResponseSchema,
    normalizeAdministrativeAddressQuery,
    type VietnameseAddressSuggestionResponse,
} from './contracts'

interface AddressSearchClientOptions {
    signal?: AbortSignal
}

export type AddressSearchClientResult = {
    data?: VietnameseAddressSuggestionResponse
    error?: string
    unavailable?: boolean
    disabled?: boolean
}

export async function searchVietnameseAddressClient(
    rawQuery: string,
    options: AddressSearchClientOptions = {},
): Promise<AddressSearchClientResult> {
    const query = normalizeAdministrativeAddressQuery(rawQuery)
    if (!query) {
        return { error: 'Nội dung tìm kiếm địa chỉ không hợp lệ' }
    }

    const params = new URLSearchParams({
        operation: 'search',
        q: query,
        limit: String(ADDRESS_SEARCH_LIMIT),
    })

    try {
        const response = await fetch(`/api/vietnamese-address?${params.toString()}`, {
            method: 'GET',
            credentials: 'include',
            signal: options.signal,
        })
        const body = await response.json().catch(() => null) as unknown

        if (!response.ok) {
            const error = (
                typeof body === 'object'
                && body !== null
                && 'error' in body
                && typeof body.error === 'string'
            )
                ? body.error
                : 'Không thể tải gợi ý địa chỉ'
            const errorCode = (
                typeof body === 'object'
                && body !== null
                && 'code' in body
                && typeof body.code === 'string'
            )
                ? body.code
                : null
            const disabled = errorCode === 'disabled' || errorCode === 'configuration'
            return {
                error,
                unavailable: response.status >= 500 && !disabled,
                disabled,
            }
        }

        const parsed = VietnameseAddressSuggestionResponseSchema.safeParse(body)
        if (!parsed.success) {
            return {
                error: 'Phản hồi gợi ý địa chỉ không hợp lệ',
                unavailable: true,
            }
        }

        return { data: parsed.data }
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            return { error: 'Yêu cầu đã bị hủy' }
        }
        return {
            error: 'Không thể tải gợi ý địa chỉ',
            unavailable: true,
        }
    }
}
