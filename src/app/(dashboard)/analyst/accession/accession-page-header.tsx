'use client'

import { WalkthroughTrigger } from '@/components/walkthrough'

export function AccessionPageHeader() {
    return (
        <div className="mb-3 flex items-center justify-between">
            <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Tiếp nhận mẫu mới
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Nhập thông tin mẫu hoặc quét mã QR để tiếp nhận
                </p>
            </div>
            <WalkthroughTrigger
                tourId="accession"
                className="hidden xl:inline-flex"
            />
        </div>
    )
}
