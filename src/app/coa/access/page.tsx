/**
 * Public portal for clients to retrieve approved laboratory results.
 */

import type { Metadata } from 'next'

import { CoAAccessPortal } from '@/components/coa-access-portal'

export const metadata: Metadata = {
    title: 'Tra cứu kết quả xét nghiệm | CDC Cần Thơ',
    description: 'Cổng tra cứu phiếu kết quả xét nghiệm chính thức của CDC Cần Thơ.',
    robots: { index: false, follow: false },
}

export default function CoAAccessPage() {
    return <CoAAccessPortal currentYear={new Date().getFullYear()} />
}
