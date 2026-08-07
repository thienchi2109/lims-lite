import {
    VietnameseAddressCommuneListSchema,
    VietnameseAddressMetadataSchema,
    VietnameseAddressProvinceListSchema,
    VietnameseAddressSearchSchema,
    type VietnameseAddressCommuneList,
    type VietnameseAddressMetadata,
    type VietnameseAddressProvinceList,
    type VietnameseAddressSuggestion,
    type VietnameseAddressSuggestionResponse,
} from './contracts'

const DEFAULT_TIMEOUT_MS = 1_500
const MIN_TIMEOUT_MS = 100
const MAX_TIMEOUT_MS = 5_000
const MAX_RESPONSE_BYTES = 64 * 1024

type AdapterErrorCode =
    | 'disabled'
    | 'configuration'
    | 'timeout'
    | 'service_unavailable'
    | 'upstream_rejected'
    | 'invalid_response'

interface VietnameseAddressConfig {
    serviceUrl: string
    timeoutMs: number
}

interface AdapterRequestOptions<T> {
    route: 'meta' | 'provinces' | 'communes' | 'search'
    schema: { parse(value: unknown): T }
    resultCount?: (value: T) => number
}

function responseTooLarge() {
    return new VietnameseAddressAdapterError(
        'invalid_response',
        'Vietnamese address service response is too large',
    )
}

async function readBoundedResponseBody(response: Response) {
    const declaredLength = response.headers.get('content-length')
    if (
        declaredLength !== null
        && Number.isFinite(Number(declaredLength))
        && Number(declaredLength) > MAX_RESPONSE_BYTES
    ) {
        await response.body?.cancel()
        throw responseTooLarge()
    }

    if (!response.body) {
        return ''
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0

    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) {
                break
            }

            totalBytes += value.byteLength
            if (totalBytes > MAX_RESPONSE_BYTES) {
                await reader.cancel()
                throw responseTooLarge()
            }
            chunks.push(value)
        }
    } finally {
        reader.releaseLock()
    }

    const body = new Uint8Array(totalBytes)
    let offset = 0
    for (const chunk of chunks) {
        body.set(chunk, offset)
        offset += chunk.byteLength
    }
    return new TextDecoder().decode(body)
}

export class VietnameseAddressAdapterError extends Error {
    constructor(
        public readonly code: AdapterErrorCode,
        message: string,
    ) {
        super(message)
        this.name = 'VietnameseAddressAdapterError'
    }
}

export function getVietnameseAddressConfig(
    environment: NodeJS.ProcessEnv = process.env,
): VietnameseAddressConfig | null {
    const rawServiceUrl = environment.VIETNAMESE_ADDRESS_SERVICE_URL?.trim()
    if (!rawServiceUrl) {
        return null
    }

    let serviceUrl: URL
    try {
        serviceUrl = new URL(rawServiceUrl)
    } catch {
        throw new VietnameseAddressAdapterError(
            'configuration',
            'Vietnamese address service URL is invalid',
        )
    }

    if (
        !['http:', 'https:'].includes(serviceUrl.protocol)
        || serviceUrl.username
        || serviceUrl.password
        || serviceUrl.search
        || serviceUrl.hash
    ) {
        throw new VietnameseAddressAdapterError(
            'configuration',
            'Vietnamese address service URL is invalid',
        )
    }

    const rawTimeout = environment.VIETNAMESE_ADDRESS_SERVICE_TIMEOUT_MS?.trim()
    const timeoutMs = rawTimeout ? Number(rawTimeout) : DEFAULT_TIMEOUT_MS
    if (
        !Number.isInteger(timeoutMs)
        || timeoutMs < MIN_TIMEOUT_MS
        || timeoutMs > MAX_TIMEOUT_MS
    ) {
        throw new VietnameseAddressAdapterError(
            'configuration',
            'Vietnamese address service timeout is invalid',
        )
    }

    serviceUrl.pathname = serviceUrl.pathname.replace(/\/+$/, '')

    return {
        serviceUrl: serviceUrl.toString().replace(/\/$/, ''),
        timeoutMs,
    }
}

async function requestAddressService<T>(
    path: string,
    options: AdapterRequestOptions<T>,
) {
    const config = getVietnameseAddressConfig()
    if (!config) {
        throw new VietnameseAddressAdapterError(
            'disabled',
            'Vietnamese address service is disabled',
        )
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
    const startedAt = Date.now()
    let status = 503
    let resultCount: number | undefined

    try {
        const response = await fetch(`${config.serviceUrl}${path}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            signal: controller.signal,
        })
        status = response.status

        if (!response.ok) {
            throw new VietnameseAddressAdapterError(
                'upstream_rejected',
                'Vietnamese address service rejected the request',
            )
        }

        const body = await readBoundedResponseBody(response)

        let parsedJson: unknown
        try {
            parsedJson = JSON.parse(body)
        } catch {
            throw new VietnameseAddressAdapterError(
                'invalid_response',
                'Vietnamese address service returned invalid JSON',
            )
        }

        let parsed: T
        try {
            parsed = options.schema.parse(parsedJson)
        } catch {
            throw new VietnameseAddressAdapterError(
                'invalid_response',
                'Vietnamese address service response is invalid',
            )
        }

        resultCount = options.resultCount?.(parsed)
        return parsed
    } catch (error) {
        if (error instanceof VietnameseAddressAdapterError) {
            throw error
        }
        if (
            controller.signal.aborted
            || (error instanceof DOMException && error.name === 'AbortError')
        ) {
            throw new VietnameseAddressAdapterError(
                'timeout',
                'Vietnamese address service request timed out',
            )
        }
        throw new VietnameseAddressAdapterError(
            'service_unavailable',
            'Vietnamese address service is unavailable',
        )
    } finally {
        clearTimeout(timeout)
        console.info('vietnamese_address_adapter', {
            route: options.route,
            status,
            duration_ms: Date.now() - startedAt,
            result_count: resultCount,
        })
    }
}

export function getVietnameseAddressMetadata(): Promise<VietnameseAddressMetadata> {
    return requestAddressService('/v1/meta', {
        route: 'meta',
        schema: VietnameseAddressMetadataSchema,
    })
}

export function listVietnameseAddressProvinces(): Promise<
    VietnameseAddressProvinceList
> {
    return requestAddressService('/v1/provinces', {
        route: 'provinces',
        schema: VietnameseAddressProvinceListSchema,
        resultCount: (value) => value.provinces.length,
    })
}

export function listVietnameseAddressCommunes(
    provinceCode: string,
): Promise<VietnameseAddressCommuneList> {
    return requestAddressService(
        `/v1/provinces/${encodeURIComponent(provinceCode)}/communes`,
        {
            route: 'communes',
            schema: VietnameseAddressCommuneListSchema,
            resultCount: (value) => value.communes.length,
        },
    )
}

async function searchVietnameseAddresses(
    query: string,
    provinceCode: string | undefined,
    limit: number,
) {
    const params = new URLSearchParams({ q: query, limit: String(limit) })
    if (provinceCode) {
        params.set('province_code', provinceCode)
    }

    const search = await requestAddressService(`/v1/search?${params.toString()}`, {
        route: 'search',
        schema: VietnameseAddressSearchSchema,
        resultCount: (value) => value.results.length,
    })
    if (search.results.length > limit) {
        throw new VietnameseAddressAdapterError(
            'invalid_response',
            'Vietnamese address service returned too many results',
        )
    }
    return search
}

export async function searchVietnameseAddressSuggestions(
    query: string,
    provinceCode: string | undefined,
    limit: number,
): Promise<VietnameseAddressSuggestionResponse> {
    const [search, provinces] = await Promise.all([
        searchVietnameseAddresses(query, provinceCode, limit),
        listVietnameseAddressProvinces(),
    ])

    if (search.dataset_version !== provinces.dataset_version) {
        throw new VietnameseAddressAdapterError(
            'invalid_response',
            'Vietnamese address dataset versions do not match',
        )
    }

    const provinceNames = new Map(
        provinces.provinces.map((province) => [province.code, province.full_name]),
    )
    const suggestions = search.results.map((result): VietnameseAddressSuggestion => {
        const level = result.level
        if (level === 'province') {
            return {
                ...result,
                level,
                formatted_address: result.full_name,
            }
        }

        const provinceFullName = result.province_code
            ? provinceNames.get(result.province_code)
            : undefined
        if (!provinceFullName) {
            throw new VietnameseAddressAdapterError(
                'invalid_response',
                'Vietnamese address province is missing',
            )
        }

        return {
            ...result,
            level,
            province_full_name: provinceFullName,
            formatted_address: `${result.full_name}, ${provinceFullName}`,
        }
    })

    return {
        dataset_version: search.dataset_version,
        suggestions,
    }
}

export function toVietnameseAddressHttpError(error: unknown) {
    if (error instanceof VietnameseAddressAdapterError) {
        return {
            status: 503,
            code: error.code,
            message: 'Gợi ý địa chỉ hiện không khả dụng',
        }
    }

    return {
        status: 500,
        code: 'internal_error',
        message: 'Không thể xử lý yêu cầu địa chỉ',
    }
}
