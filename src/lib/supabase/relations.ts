/**
 * Helpers for Supabase nested relation values.
 */

export type RelationValue<T> = T | T[] | null | undefined

export function firstRelation<T>(value: RelationValue<T>): T | null {
    return Array.isArray(value) ? value[0] ?? null : value ?? null
}
