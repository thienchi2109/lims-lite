'use client'

import { Plug, Unplug } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { useOptionalScanner } from './use-scanner'

type ScannerConnectionButtonProps = {
    className?: string
}

export function ScannerConnectionButton({
    className,
}: ScannerConnectionButtonProps) {
    const scanner = useOptionalScanner()
    if (!scanner) return null

    const isConnected = scanner.state === 'connected'
    const isDisabled =
        scanner.state === 'connecting' || scanner.state === 'unsupported'
    const accessibleLabel = {
        connected: 'Ngắt kết nối scanner',
        connecting: 'Đang kết nối scanner',
        error: 'Kết nối lại scanner',
        permission_required: 'Kết nối scanner',
        unsupported: 'Trình duyệt không hỗ trợ Web Serial',
    }[scanner.state]

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="inline-flex" tabIndex={isDisabled ? 0 : -1}>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className={cn(
                            'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white',
                            className,
                        )}
                        aria-label={accessibleLabel}
                        data-state={scanner.state}
                        disabled={isDisabled}
                        onClick={() => {
                            if (isConnected) {
                                void scanner.disconnect()
                                return
                            }
                            void scanner.connect()
                        }}
                    >
                        {isConnected ? (
                            <Unplug aria-hidden="true" />
                        ) : (
                            <Plug
                                aria-hidden="true"
                                className={
                                    scanner.state === 'connecting'
                                        ? 'animate-pulse'
                                        : undefined
                                }
                            />
                        )}
                    </Button>
                </span>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>{accessibleLabel}</TooltipContent>
        </Tooltip>
    )
}
