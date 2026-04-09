import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardHeader } from '@/components/dashboard-header'
import { UserProfileInfo } from '@/components/user-profile-info'
import { ChangePasswordForm } from '@/components/change-password-form'
import SignatureUpload from '@/components/profile/signature-upload'

export default async function ProfilePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Fetch full user details including role and potentially lab info
    const { data: userData } = await supabase
        .from('users')
        .select('username, full_name, role, created_at, lab')
        .eq('id', user.id)
        .single()

    if (!userData) {
        // Handle edge case where auth user exists but public.users record doesn't
        redirect('/login')
    }

    if (userData.role === 'doctor') {
        redirect('/samples')
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
            <DashboardHeader
                subtitle="Hồ sơ người dùng"
                user={{
                    full_name: userData.full_name,
                    role: userData.role
                }}
            />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <Link href={userData.role === 'manager' ? '/manager' : '/analyst'}>
                        <Button variant="ghost" size="sm" className="hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Quay lại bảng điều khiển
                        </Button>
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    {/* Left Column: User Info */}
                    <div className="lg:col-span-1">
                        <UserProfileInfo user={userData} />
                    </div>

                    {/* Right Column: Settings */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Change Password Section */}
                        <ChangePasswordForm />

                        {/* Electronic Signature Section - Only for Manager and Analyst */}
                        {(userData.role === 'manager' || userData.role === 'analyst') && (
                            <SignatureUpload />
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}
