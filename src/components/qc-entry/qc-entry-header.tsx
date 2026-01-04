import Link from 'next/link'
import { ChevronLeft, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface QCEntryHeaderProps {
    user: { full_name: string }
}

/**
 * Server component header for the QC Entry page.
 * Displays back navigation, title, user greeting, and walkthrough trigger.
 */
export function QCEntryHeader({ user }: QCEntryHeaderProps) {
    return (
        <header className="flex items-center justify-between border-b pb-4">
            {/* Left: Back button + Title */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/analyst" aria-label="Quay lại">
                        <ChevronLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">
                        Nhập QC
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Xin chào, {user.full_name}
                    </p>
                </div>
            </div>

            {/* Right: Walkthrough trigger */}
            <Button
                variant="ghost"
                size="icon"
                data-walkthrough-trigger
                aria-label="Xem hướng dẫn"
            >
                <HelpCircle className="h-5 w-5" />
            </Button>
        </header>
    )
}
