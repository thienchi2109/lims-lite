import { z } from 'zod'

export const ADDRESS_SEARCH_LIMIT = 8
export const ADDRESS_SEARCH_MAX_LIMIT = 10
export const ADDRESS_SEARCH_DEBOUNCE_MS = 300

const VietnameseAddressUnitBaseSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    full_name: z.string().min(1),
    kind: z.string().min(1),
}).strict()

const VietnameseAddressProvinceSchema = VietnameseAddressUnitBaseSchema
const VietnameseAddressCommuneSchema = VietnameseAddressUnitBaseSchema.extend({
    province_code: z.string().regex(/^\d{2}$/),
}).strict()
const VietnameseAddressSearchResultSchema = z.discriminatedUnion('level', [
    VietnameseAddressProvinceSchema.extend({
        level: z.literal('province'),
    }).strict(),
    VietnameseAddressCommuneSchema.extend({
        level: z.literal('commune'),
    }).strict(),
])

export const VietnameseAddressMetadataSchema = z.object({
    service_version: z.string().min(1),
    dataset: z.object({
        version: z.string().min(1),
        schema_version: z.string().min(1),
        effective_date: z.string().min(1),
        province_count: z.number().int().nonnegative(),
        commune_count: z.number().int().nonnegative(),
    }).strict(),
}).strict()

export const VietnameseAddressProvinceListSchema = z.object({
    dataset_version: z.string().min(1),
    provinces: z.array(VietnameseAddressProvinceSchema),
}).strict()

export const VietnameseAddressCommuneListSchema = z.object({
    dataset_version: z.string().min(1),
    province: VietnameseAddressProvinceSchema,
    communes: z.array(VietnameseAddressCommuneSchema),
}).strict()

export const VietnameseAddressSearchSchema = z.object({
    dataset_version: z.string().min(1),
    result_count: z.number().int().nonnegative(),
    results: z.array(VietnameseAddressSearchResultSchema)
        .max(ADDRESS_SEARCH_MAX_LIMIT),
}).strict().refine(
    (value) => value.result_count === value.results.length,
    { message: 'Search result count does not match results' },
)

export const VietnameseAddressSuggestionSchema = z.discriminatedUnion('level', [
    VietnameseAddressProvinceSchema.extend({
        level: z.literal('province'),
        formatted_address: z.string().min(1),
    }).strict(),
    VietnameseAddressCommuneSchema.extend({
        level: z.literal('commune'),
        province_full_name: z.string().min(1),
        formatted_address: z.string().min(1),
    }).strict(),
])

export const VietnameseAddressSuggestionResponseSchema = z.object({
    dataset_version: z.string().min(1),
    suggestions: z.array(VietnameseAddressSuggestionSchema)
        .max(ADDRESS_SEARCH_MAX_LIMIT),
}).strict()

export type VietnameseAddressMetadata = z.infer<
    typeof VietnameseAddressMetadataSchema
>
export type VietnameseAddressProvinceList = z.infer<
    typeof VietnameseAddressProvinceListSchema
>
export type VietnameseAddressCommuneList = z.infer<
    typeof VietnameseAddressCommuneListSchema
>
export type VietnameseAddressSearch = z.infer<
    typeof VietnameseAddressSearchSchema
>
export type VietnameseAddressSuggestion = z.infer<
    typeof VietnameseAddressSuggestionSchema
>
export type VietnameseAddressSuggestionResponse = z.infer<
    typeof VietnameseAddressSuggestionResponseSchema
>

export function normalizeAdministrativeAddressQuery(value: string) {
    const query = value.trim().replace(/\s+/g, ' ')
    const tokens = query.split(' ').filter(Boolean)
    const byteLength = new TextEncoder().encode(query).byteLength

    if (
        query.length < 2
        || [...query].length > 64
        || byteLength > 128
        || tokens.length > 8
        || !/^[\p{L}\p{M}\s'’-]+$/u.test(query)
    ) {
        return null
    }

    return query
}

export function normalizeProvinceCode(value: string | null | undefined) {
    const code = value?.trim()
    return code && /^\d{2}$/.test(code) ? code : null
}

export function normalizeAddressSearchLimit(
    value: string | number | null | undefined,
) {
    const limit = typeof value === 'number' ? value : Number(value)
    return Number.isInteger(limit) && limit >= 1 && limit <= ADDRESS_SEARCH_MAX_LIMIT
        ? limit
        : null
}
