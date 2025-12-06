'use client'

import { useState } from 'react'
import { logout } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from '@/components/ui/dialog'

export function LogoutButton() {
    const [open, setOpen] = useState(false)

    const handleLogout = async () => {
        setOpen(false)
        await logout()
    }

    return (
        <>
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setOpen(true)}
            >
                Đăng xuất
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Xác nhận đăng xuất</DialogTitle>
                        <DialogDescription>
                            Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-3">
                        <DialogClose asChild>
                            <Button variant="outline">Hủy</Button>
                        </DialogClose>
                        <Button 
                            onClick={handleLogout}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Đăng xuất
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
