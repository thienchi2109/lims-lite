import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Mail, Building2, CalendarDays } from "lucide-react"

interface UserProfileInfoProps {
    user: {
        username: string
        full_name: string
        role: string
        created_at: string
        lab?: string | null
    }
}

export function UserProfileInfo({ user }: UserProfileInfoProps) {
    const initials = user.full_name
        ? user.full_name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
        : 'U'

    const joinDate = new Date(user.created_at).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })

    return (
        <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/20 dark:shadow-black/20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md overflow-hidden">
            <div className="h-32 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-emerald-500/10 dark:from-blue-500/5 dark:via-cyan-500/5 dark:to-emerald-500/5" />

            <CardContent className="relative px-6 pb-8">
                <div className="-mt-16 mb-4 flex justify-between items-end">
                    <Avatar className="h-32 w-32 border-4 border-white dark:border-slate-900 shadow-md">
                        <AvatarImage src="" />
                        <AvatarFallback className="text-4xl font-bold bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                            {initials}
                        </AvatarFallback>
                    </Avatar>

                    <div className="mb-2">
                        <Badge variant="secondary" className="px-3 py-1 text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <span className="relative flex h-2 w-2 mr-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="capitalize">{user.role}</span>
                        </Badge>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                            {user.full_name}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 flex items-center">
                            @{user.username}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                            <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mr-3">
                                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                                    Đơn vị
                                </p>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                                    {user.lab || 'CDC Đồng Nai'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                            <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mr-3">
                                <CalendarDays className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                                    Ngày tham gia
                                </p>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                                    {joinDate}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
