/**
 * CoA Logout Endpoint
 *
 * POST /api/coa/logout
 *
 * Clears CoA session cookie
 */

import { NextResponse } from 'next/server'

export async function POST() {
    const response = NextResponse.json({ success: true })

    response.cookies.set({
        name: 'coa_token',
        value: '',
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/api/coa',
        maxAge: 0,
    })

    return response
}

