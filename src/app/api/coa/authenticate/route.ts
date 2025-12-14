/**
 * CoA Authentication Endpoint
 *
 * POST /api/coa/authenticate
 *
 * Phase 5: Backend - Authentication & Access
 *
 * Authenticates clients using phone number only (simplified auth)
 * Returns JWT token and list of approved samples with CoA status
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CoAAuthRequestSchema, type CoAAuthResponse, type CoASampleInfo } from '@/types'
import {
    normalizePhoneVN,
    isValidVietnamesePhone,
    checkRateLimit,
    recordAuthAttempt,
} from '@/lib/coa-auth'
import { createCoAToken } from '@/lib/jwt'

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')

    if (forwarded) {
        return forwarded.split(',')[0].trim()
    }

    if (realIP) {
        return realIP
    }

    return 'unknown'
}

/**
 * POST /api/coa/authenticate
 *
 * Authenticate client and return approved samples with download tokens
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const clientIP = getClientIP(request)

        // Step 1: Check rate limit
        const rateLimit = checkRateLimit(clientIP)
        if (rateLimit.blocked) {
            const resetTime = rateLimit.resetAt?.toLocaleTimeString('vi-VN') || 'sau'

            return NextResponse.json<CoAAuthResponse>(
                {
                    success: false,
                    error: `Quá nhiều lần thử. Vui lòng thử lại sau ${resetTime}`,
                },
                { status: 429 }
            )
        }

        // Step 2: Parse and validate request body
        const body = await request.json()
        const validation = CoAAuthRequestSchema.safeParse(body)

        if (!validation.success) {
            recordAuthAttempt(clientIP, false)
            return NextResponse.json<CoAAuthResponse>(
                {
                    success: false,
                    error: 'Số điện thoại không hợp lệ',
                },
                { status: 400 }
            )
        }

        const { phone } = validation.data

        // Step 3: Validate Vietnamese phone format
        if (!isValidVietnamesePhone(phone)) {
            recordAuthAttempt(clientIP, false)
            return NextResponse.json<CoAAuthResponse>(
                {
                    success: false,
                    error: 'Số điện thoại không hợp lệ',
                },
                { status: 400 }
            )
        }

        // Step 4: Normalize phone number (+84 → 0)
        const normalizedPhone = normalizePhoneVN(phone)

        // Step 5: Query client by phone number
        const { data: client, error: clientError } = await supabase
            .from('clients')
            .select('id, name, phone')
            .eq('phone', normalizedPhone)
            .single()

        // Step 6: Log failed attempt if phone doesn't exist (don't reveal if phone exists)
        if (clientError || !client) {
            // Log failed attempt
            await supabase.from('coa_access_log').insert({
                client_id: null,
                sample_id: null,
                coa_report_id: null,
                ip_address: clientIP,
                user_agent: request.headers.get('user-agent') || 'Unknown',
                success: false,
                failure_reason: 'Invalid phone',
            })

            recordAuthAttempt(clientIP, false)

            return NextResponse.json<CoAAuthResponse>(
                {
                    success: false,
                    error: 'Không tìm thấy thông tin khách hàng',
                },
                { status: 401 }
            )
        }

        // Step 7: Fetch approved samples for this client
        const { data: samples, error: samplesError } = await supabase
            .from('samples')
            .select(`
                id,
                sample_id,
                type,
                received_at
            `)
            .eq('client_id', client.id)
            .eq('status', 'completed')
            .order('received_at', { ascending: false })

        if (samplesError) {
            console.error('Error fetching samples:', samplesError)
            return NextResponse.json<CoAAuthResponse>(
                {
                    success: false,
                    error: 'Đã xảy ra lỗi khi tải danh sách mẫu',
                },
                { status: 500 }
            )
        }

        // Step 8: Check which samples have CoA reports
        const sampleIds = samples?.map(s => s.id) || []
        const { data: coaReports } = await supabase
            .from('coa_reports')
            .select('sample_id')
            .in('sample_id', sampleIds)
            .eq('status', 'ready')
            .is('deleted_at', null)

        const samplesWithCoA = new Set(coaReports?.map(r => r.sample_id) || [])

        const sampleInfoList: CoASampleInfo[] = (samples || []).map(sample => ({
            id: sample.id,
            sample_id_display: sample.sample_id,
            sample_type: sample.type,
            received_date: sample.received_at,
            approved_at: null, // Not tracked in samples table
            has_coa: samplesWithCoA.has(sample.id),
        }))

        // Step 9: Generate JWT token for downloads
        const token = await createCoAToken({
            client_id: client.id,
        })

        // Step 10: Log successful authentication
        await supabase.from('coa_access_log').insert({
            client_id: client.id,
            sample_id: null,
            coa_report_id: null,
            ip_address: clientIP,
            user_agent: request.headers.get('user-agent') || 'Unknown',
            success: true,
            failure_reason: null,
        })

        recordAuthAttempt(clientIP, true)

        // Step 11: Return success response
        return NextResponse.json<CoAAuthResponse>({
            success: true,
            client_id: client.id,
            client_name: client.name,
            samples: sampleInfoList,
            token,
        })

    } catch (error) {
        console.error('CoA authentication error:', error)
        return NextResponse.json<CoAAuthResponse>(
            {
                success: false,
                error: 'Đã xảy ra lỗi hệ thống',
            },
            { status: 500 }
        )
    }
}
