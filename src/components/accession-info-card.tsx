'use client'

import { UseFormReturn } from 'react-hook-form'
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command'
import { CalendarIcon, Check, ChevronsUpDown, Plus, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Client } from '@/types'

interface AccessionInfoCardProps {
    form: UseFormReturn<any>
    clients: Client[]
    sampleTypes: string[]
    onClientSearch: (query: string) => void
    isClientLoading: boolean
}

export function AccessionInfoCard({
    form,
    clients,
    sampleTypes,
    onClientSearch,
    isClientLoading
}: AccessionInfoCardProps) {
    return (
        <div className="space-y-4">
            {/* Client Selection */}
            <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel className="text-xs font-semibold text-slate-500 uppercase">Khách hàng / Đơn vị gửi mẫu</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                            "w-full justify-between bg-white dark:bg-slate-950 font-normal",
                                            !field.value && "text-muted-foreground"
                                        )}
                                    >
                                        {field.value
                                            ? clients.find(client => client.id === field.value)?.name || "Chọn khách hàng..."
                                            : "Tìm kiếm khách hàng..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0">
                                <Command shouldFilter={false}>
                                    <CommandInput
                                        placeholder="Nhập tên khách hàng..."
                                        onValueChange={onClientSearch}
                                    />
                                    <CommandEmpty>
                                        {isClientLoading ? (
                                            <span className="flex items-center justify-center p-2 text-xs text-muted-foreground">
                                                Đang tìm kiếm...
                                            </span>
                                        ) : (
                                            <div className="p-2 text-center">
                                                <p className="text-xs text-muted-foreground mb-2">Không tìm thấy khách hàng.</p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full text-xs h-8"
                                                    onClick={() => {/* Trigger create client dialog logic if needed */ }}
                                                >
                                                    <Plus className="mr-1 h-3 w-3" />
                                                    Thêm mới
                                                </Button>
                                            </div>
                                        )}
                                    </CommandEmpty>
                                    <CommandGroup className="max-h-[200px] overflow-auto">
                                        {clients.map((client) => (
                                            <CommandItem
                                                value={client.name}
                                                key={client.id}
                                                onSelect={() => {
                                                    form.setValue("clientId", client.id)
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        client.id === field.value ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{client.name}</span>
                                                    {client.phone && <span className="text-[10px] text-muted-foreground">{client.phone}</span>}
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {/* Sample Type Selection */}
            <FormField
                control={form.control}
                name="sampleTypeId"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-500 uppercase">Loại mẫu</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger className="bg-white dark:bg-slate-950">
                                    <SelectValue placeholder="Chọn loại mẫu" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {sampleTypes.map((type) => (
                                    <SelectItem key={type} value={type}>
                                        {type}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {/* Received Date Picker */}
            <FormField
                control={form.control}
                name="receivedDate"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel className="text-xs font-semibold text-slate-500 uppercase">Ngày nhận mẫu</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full pl-3 text-left font-normal bg-white dark:bg-slate-900", // Fix bg color
                                            !field.value && "text-muted-foreground"
                                        )}
                                    >
                                        {field.value ? (
                                            format(field.value, "PPP", { locale: vi })
                                        ) : (
                                            <span>Chọn ngày</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) =>
                                        date > new Date() || date < new Date("1900-01-01")
                                    }
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {/* Sender Name Input (Optional) */}
            <FormField
                control={form.control}
                name="senderName"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-500 uppercase">Người gửi (Tùy chọn)</FormLabel>
                        <FormControl>
                            <Input placeholder="Nhập tên người gửi..." {...field} className="bg-white dark:bg-slate-950" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    )
}
