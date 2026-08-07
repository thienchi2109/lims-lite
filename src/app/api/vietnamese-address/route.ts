import { NextResponse } from 'next/server'
import { isAuthError, requireRole } from '@/lib/auth-helpers'
import {
    ADDRESS_SEARCH_LIMIT,
    normalizeAddressSearchLimit,
    normalizeAdministrativeAddressQuery,
    normalizeProvinceCode,
} from '@/lib/vietnamese-address/contracts'
import {
    getVietnameseAddressMetadata,
    listVietnameseAddressCommunes,
    listVietnameseAddressProvinces,
    searchVietnameseAddressSuggestions,
    toVietnameseAddressHttpError,
} from '@/lib/vietnamese-address/server'

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' }

function json(data: unknown, status = 200) {
    return NextResponse.json(data, {
        status,
        headers: NO_STORE_HEADERS,
    })
}

function hasOnlySingleValueParams(
    params: URLSearchParams,
    allowed: ReadonlySet<string>,
) {
    for (const key of params.keys()) {
        if (!allowed.has(key) || params.getAll(key).length !== 1) {
            return false
        }
    }
    return true
}

export async function GET(request: Request) {
    const auth = await requireRole(['analyst', 'manager'])
    if (isAuthError(auth)) {
        return json(
            { error: auth.error === 'Unauthorized' ? 'Chưa đăng nhập' : 'Không có quyền truy cập' },
            auth.error === 'Unauthorized' ? 401 : 403,
        )
    }

    const params = new URL(request.url).searchParams
    const operation = params.get('operation')

    try {
        switch (operation) {
            case 'meta':
                if (!hasOnlySingleValueParams(params, new Set(['operation']))) {
                    return json({ error: 'Yêu cầu không hợp lệ' }, 400)
                }
                return json(await getVietnameseAddressMetadata())

            case 'provinces':
                if (!hasOnlySingleValueParams(params, new Set(['operation']))) {
                    return json({ error: 'Yêu cầu không hợp lệ' }, 400)
                }
                return json(await listVietnameseAddressProvinces())

            case 'communes': {
                const provinceCode = normalizeProvinceCode(params.get('province_code'))
                if (
                    !provinceCode
                    || !hasOnlySingleValueParams(
                        params,
                        new Set(['operation', 'province_code']),
                    )
                ) {
                    return json({ error: 'Yêu cầu không hợp lệ' }, 400)
                }
                return json(await listVietnameseAddressCommunes(provinceCode))
            }

            case 'search': {
                const query = normalizeAdministrativeAddressQuery(params.get('q') ?? '')
                const rawProvinceCode = params.get('province_code')
                const normalizedProvinceCode = rawProvinceCode
                    ? normalizeProvinceCode(rawProvinceCode)
                    : undefined
                const rawLimit = params.get('limit')
                const limit = rawLimit
                    ? normalizeAddressSearchLimit(rawLimit)
                    : ADDRESS_SEARCH_LIMIT
                if (
                    !query
                    || (rawProvinceCode !== null && !normalizedProvinceCode)
                    || !limit
                    || !hasOnlySingleValueParams(
                        params,
                        new Set(['operation', 'q', 'province_code', 'limit']),
                    )
                ) {
                    return json({ error: 'Yêu cầu không hợp lệ' }, 400)
                }
                return json(
                    await searchVietnameseAddressSuggestions(
                        query,
                        normalizedProvinceCode ?? undefined,
                        limit,
                    ),
                )
            }

            default:
                return json({ error: 'Yêu cầu không hợp lệ' }, 400)
        }
    } catch (error) {
        const httpError = toVietnameseAddressHttpError(error)
        return json({
            error: httpError.message,
            code: httpError.code,
        }, httpError.status)
    }
}
