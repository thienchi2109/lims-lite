'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Check, ChevronsUpDown, Search, Scan, Plus, User, Phone, Calendar, CreditCard, Edit, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { ClientQrScannerDialog } from '@/components/client-qr-scanner-dialog'
import { ClientForm } from '@/components/client-form'
import { fetchClientsClient, findClientByIdentityClient } from '@/lib/api-client'
import { parseClientIdentityQr } from '@/lib/qr/parse-client-identity-qr'
import { Client, CreateClient } from '@/types'
import { toast } from 'sonner'

interface ClientSelectorProps {
    selectedClient: Client | null
    onSelect: (client: Client | null) => void
    // Controlled state props
    isOpenForm?: boolean
    onOpenFormChange?: (open: boolean) => void
    formData?: Partial<CreateClient>
    onFormDataChange?: (data: Partial<CreateClient> | undefined) => void
    hideQRButton?: boolean
}

export function ClientSelector({
    selectedClient,
    onSelect,
    isOpenForm,
    onOpenFormChange,
    formData,
    onFormDataChange,
    hideQRButton = false
}: ClientSelectorProps) {
    const [open, setOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [clients, setClients] = useState<Client[]>([])
    const [loading, setLoading] = useState(false)
    const [showQRScanner, setShowQRScanner] = useState(false)

    // Internal state for uncontrolled mode
    const [internalShowClientForm, setInternalShowClientForm] = useState(false)
    const [internalClientFormData, setInternalClientFormData] = useState<Partial<CreateClient> | undefined>(undefined)

    // Derived state
    const showClientForm = isOpenForm ?? internalShowClientForm
    const clientFormData = formData ?? internalClientFormData

    const setShowClientForm = (show: boolean) => {
        if (onOpenFormChange) {
            onOpenFormChange(show)
        } else {
            setInternalShowClientForm(show)
        }
    }

    const setClientFormData = (data: Partial<CreateClient> | undefined) => {
        if (onFormDataChange) {
            onFormDataChange(data)
        } else {
            setInternalClientFormData(data)
        }
    }

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (open) {
                fetchClients(searchQuery)
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery, open])

    const fetchClients = async (query: string) => {
        setLoading(true)
        try {
            const result = await fetchClientsClient(query)
            if (result.data) {
                setClients(result.data)
            }
        } catch (error) {
            console.error('Failed to fetch clients', error)
        } finally {
            setLoading(false)
        }
    }

    const handleQRScan = async (decodedText: string) => {
        setShowQRScanner(false)

        const parsed = parseClientIdentityQr(decodedText)
        if (!parsed) {
            toast.error('Mã QR không hợp lệ. Vui lòng thử lại hoặc nhập thủ công.')
            return
        }

        const { idCardNum, name, dateOfBirth, gender } = parsed
        const address = parsed.address

        try {
            const result = await findClientByIdentityClient(name, dateOfBirth)

            if (result.data) {
                onSelect(result.data)
                return
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Không thể tìm khách hàng'
            toast.error(message)
        }

        setClientFormData({
            name,
            id_card_num: idCardNum || '',
            date_of_birth: dateOfBirth,
            gender,
            phone: '', // Required
            address: address || '',
        })
        setShowClientForm(true)
    }

    // Memoize formatted date to prevent forced reflows
    const formattedDOB = useMemo(() => {
        if (!selectedClient) return ''
        try {
            return new Date(selectedClient.date_of_birth).toLocaleDateString('vi-VN')
        } catch {
            return 'N/A'
        }
    }, [selectedClient])


    if (showClientForm) {
        return (
            <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {clientFormData ? 'Tạo từ QR' : 'Khách hàng mới'}
                    </h3>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                            setShowClientForm(false)
                            setClientFormData(undefined)
                        }}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <ClientForm
                    initialData={clientFormData}
                    onSuccess={(client) => {
                        onSelect(client)
                        setShowClientForm(false)
                        setClientFormData(undefined)
                    }}
                    onCancel={() => {
                        setShowClientForm(false)
                        setClientFormData(undefined)
                    }}
                />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {selectedClient ? (
                <div className="bg-sky-50/50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-800 rounded-lg p-3 flex flex-col gap-3 shadow-sm">
                    <div className="flex justify-between items-start">
                        <div className="font-medium text-sky-900 dark:text-sky-100 truncate">
                            {selectedClient.name}
                        </div>
                        <div className="flex gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-sky-600 hover:text-sky-700 hover:bg-sky-100"
                                onClick={() => {
                                    setClientFormData({
                                        name: selectedClient.name,
                                        id_card_num: selectedClient.id_card_num,
                                        date_of_birth: selectedClient.date_of_birth.split('T')[0],
                                        gender: selectedClient.gender,
                                        phone: selectedClient.phone,
                                        address: selectedClient.address || '',
                                        health_insurance_num: selectedClient.health_insurance_num || '',
                                        expiry_date: selectedClient.expiry_date ? selectedClient.expiry_date.split('T')[0] : '',
                                    })
                                    setShowClientForm(true)
                                }}
                            >
                                <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => onSelect(null)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 text-xs text-sky-700 dark:text-sky-300">
                        <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3 opacity-70" />
                            <span>{selectedClient.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 opacity-70" />
                            <span>{formattedDOB}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CreditCard className="h-3 w-3 opacity-70" />
                            <span className="truncate">{selectedClient.id_card_num}</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="flex gap-2 w-full">
                        <Popover open={open} onOpenChange={setOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={open}
                                    className="flex-1 w-full justify-between shadow-sm border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 min-w-0 h-11 px-3 text-sm font-normal"
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <Search className="h-5 w-5 text-slate-400" />
                                        <span className={cn("truncate", !selectedClient && !searchQuery ? "text-slate-500" : "")}>
                                            {searchQuery || "Tìm hoặc thêm mới..."}
                                        </span>
                                    </div>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                                <div className="flex items-center border-b px-3">
                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                    <Input
                                        placeholder="Tìm tên, SĐT, CMND..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0 focus-visible:ring-0 px-0 shadow-none"
                                    />
                                </div>
                                <div className="max-h-[200px] overflow-y-auto p-1">
                                    {loading ? (
                                        <div className="py-6 text-center text-sm text-muted-foreground">
                                            Đang tìm kiếm...
                                        </div>
                                    ) : clients.length === 0 ? (
                                        <div className="py-6 text-center text-sm text-muted-foreground">
                                            {searchQuery ? 'Không tìm thấy khách hàng.' : 'Nhập để tìm kiếm.'}
                                            {searchQuery && (
                                                <Button
                                                    variant="link"
                                                    className="mt-2 h-auto p-0 text-sky-600"
                                                    onClick={() => {
                                                        setClientFormData({ name: searchQuery })
                                                        setShowClientForm(true)
                                                        setOpen(false)
                                                    }}
                                                >
                                                    + Tạo mới "{searchQuery}"
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        clients.map((client) => {
                                            // Pre-calculate birth year to prevent forced reflows
                                            const birthYear = new Date(client.date_of_birth).getFullYear()

                                            return (
                                                <div
                                                    key={client.id}
                                                    className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                                    onClick={() => {
                                                        onSelect(client)
                                                        setOpen(false)
                                                    }}
                                                >
                                                    <div className="flex flex-col w-full">
                                                        <span className="font-medium">{client.name}</span>
                                                        <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                                                            <span>{client.phone}</span>
                                                            <span>{birthYear}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>

                        {!hideQRButton && (
                            <Button
                                variant="outline"
                                size="icon"
                                className="shrink-0 text-sky-600 hover:text-sky-700 hover:bg-sky-50 border-slate-200 dark:border-slate-800 shadow-sm h-11 w-11"
                                onClick={() => setShowQRScanner(true)}
                                title="Quét mã QR"
                            >
                                <Scan className="h-5 w-5" />
                            </Button>
                        )}
                    </div>

                    {/* Quick Create Button (Mobile friendly) */}
                    <Button
                        variant="ghost"
                        className="w-full justify-start text-sky-600 hover:text-sky-700 hover:bg-sky-50 h-8 px-2 text-xs"
                        onClick={() => {
                            setClientFormData(undefined)
                            setShowClientForm(true)
                        }}
                    >
                        <Plus className="mr-2 h-3 w-3" />
                        Tạo khách hàng mới
                    </Button>
                </div>
            )}

            <ClientQrScannerDialog open={showQRScanner} onOpenChange={setShowQRScanner} onScan={handleQRScan} />
        </div>
    )
}
