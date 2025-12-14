import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard-header'
import { SignatureSection } from '@/components/signature-section'

// Force dynamic rendering for session-based auth
export const dynamic = 'force-dynamic'

/**
 * Manager Settings Page
 *
 * Features:
 * - E-Signature upload and management
 * - Signature history viewer
 * - Preview current active signature
 * - Change signature functionality
 */
export default async function ManagerSettingsPage() {
    const supabase = await createClient()

    // 1. Authenticate user
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // 2. Verify manager role
    const { data: userData } = await supabase
        .from('users')
        .select('full_name, role')
        .eq('id', user.id)
        .single()

    if (userData?.role !== 'manager') {
        redirect('/manager')
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <DashboardHeader
                subtitle="Quản lý cài đặt tài khoản"
                user={userData}
            />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <Link href="/manager">
                        <Button variant="ghost" size="sm" className="hover:bg-slate-100 dark:hover:bg-slate-800">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Quay lại
                        </Button>
                    </Link>
                </div>

                <div className="space-y-6">
                    {/* E-Signature Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Chữ ký điện tử</CardTitle>
                            <CardDescription>
                                Quản lý chữ ký điện tử dùng cho phê duyệt Giấy chứng nhận phân tích (CoA)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <SignatureSection />
                        </CardContent>
                    </Card>

                    {/* Future sections can be added here */}
                    {/* Example: Account Settings, Notification Preferences, etc. */}
                </div>
            </main>
        </div>
    )
}
