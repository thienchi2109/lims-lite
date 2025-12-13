'use client'

import { useEffect, useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { getClientClient } from '@/lib/api-client'
import type { Client, CreateClient, SampleWithUser } from '@/types'
import { toast } from 'sonner'
import { ClientForm } from '@/components/client-form'
import { Loader2 } from 'lucide-react'

interface SampleEditDialogProps {
    sample: SampleWithUser
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function SampleEditDialog({
    sample,
    open,
    onOpenChange,
    onSuccess,
}: SampleEditDialogProps) {
    const [client, setClient] = useState<Client | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return

        setClient(null)
        setLoadError(null)

        if (!sample.client_id) {
            setLoadError('Mẫu chưa được liên kết với khách hàng')
            return
        }

        let cancelled = false

        const run = async () => {
            setIsLoading(true)
            try {
                const result = await getClientClient(sample.client_id as string)
                if (cancelled) return

                if ('data' in result && result.data) {
                    setClient(result.data as Client)
                    return
                }

                setLoadError('Không thể tải thông tin khách hàng')
            } catch (error) {
                if (cancelled) return
                setLoadError(error instanceof Error ? error.message : 'Không thể tải thông tin khách hàng')
            } finally {
                if (!cancelled) setIsLoading(false)
            }
        }

        run()

        return () => {
            cancelled = true
        }
    }, [open, sample.client_id])

    const clientInitialData: Partial<CreateClient> | undefined = client
        ? {
            name: client.name,
            id_card_num: client.id_card_num,
            date_of_birth: client.date_of_birth.split('T')[0],
            gender: client.gender,
            phone: client.phone,
            address: client.address || '',
            health_insurance_num: client.health_insurance_num || '',
            expiry_date: client.expiry_date ? client.expiry_date.split('T')[0] : '',
        }
        : undefined

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Chỉnh sửa thông tin khách hàng</DialogTitle>
                    <DialogDescription>
                        Cập nhật thông tin cho mẫu <span className="font-mono font-medium text-foreground">{sample.sample_id}</span>
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Đang tải thông tin khách hàng...
                    </div>
                ) : loadError ? (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                        {loadError}
                    </div>
                ) : client ? (
                    <ClientForm
                        mode="update"
                        clientId={client.id}
                        initialData={clientInitialData}
                        onSuccess={() => {
                            toast.success('Cập nhật khách hàng thành công')
                            onOpenChange(false)
                            onSuccess?.()
                        }}
                        onCancel={() => onOpenChange(false)}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    )
}
