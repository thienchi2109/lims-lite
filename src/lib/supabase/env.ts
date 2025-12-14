function requiredEnv(name: string, value: string | undefined) {
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`)
    }
    return value
}

export function getSupabaseServerUrl() {
    return requiredEnv(
        'NEXT_PUBLIC_SUPABASE_URL',
        process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    )
}

export function getSupabaseAnonKey() {
    return requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function getSupabaseServiceRoleKey() {
    const key =
        process.env.SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_KEY

    if (!key) {
        throw new Error(
            'Missing Supabase service-role key. Set SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY).'
        )
    }

    return key
}

