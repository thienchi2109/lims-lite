'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { logoutClient } from '@/lib/api-client'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User, LogOut, Settings, ChevronDown } from 'lucide-react'

interface UserProfileDropdownProps {
    user: {
        full_name: string | null
        role: string | null
    }
}

export function UserProfileDropdown({ user }: UserProfileDropdownProps) {
    const [showLogoutDialog, setShowLogoutDialog] = useState(false)
    const router = useRouter()

    const handleLogout = async () => {
        setShowLogoutDialog(false)
        try {
            await logoutClient()
        } catch (error) {
            console.error('Logout failed', error)
        } finally {
            router.replace('/login')
        }
    }

    const initials = user.full_name
        ? user.full_name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
        : 'U'

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        className="relative h-auto py-2 pl-2 pr-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-slate-200 dark:border-slate-700">
                                <AvatarImage src="" alt={user.full_name || 'User'} />
                                <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-semibold">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col items-start text-left hidden sm:flex">
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-none mb-1">
                                    {user.full_name}
                                </p>
                                <div className="flex items-center gap-1.5">
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                    </span>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 capitalize font-medium leading-none">
                                        {user.role}
                                    </p>
                                </div>
                            </div>
                            <ChevronDown className="w-4 h-4 text-slate-400 ml-1 hidden sm:block" />
                        </div>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium leading-none">{user.full_name}</p>
                            <p className="text-xs leading-none text-muted-foreground capitalize">
                                {user.role}
                            </p>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                        <Link href="/profile" className="flex items-center cursor-pointer">
                            <User className="mr-2 h-4 w-4" />
                            <span>Hồ sơ</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Cài đặt</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => setShowLogoutDialog(true)}
                        className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-950/50 cursor-pointer"
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Đăng xuất</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Xác nhận đăng xuất</DialogTitle>
                        <DialogDescription>
                            Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <div className="flex justify-end gap-3 w-full">
                            <Button variant="outline" onClick={() => setShowLogoutDialog(false)}>
                                Hủy
                            </Button>
                            <Button
                                onClick={handleLogout}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Đăng xuất
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
