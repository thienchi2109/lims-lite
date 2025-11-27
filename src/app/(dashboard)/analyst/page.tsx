import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Plus, List } from 'lucide-react'

export default async function AnalystDashboard() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: userData } = await supabase
        .from('users')
        .select('full_name, role')
        .eq('id', user.id)
        .single()

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            CDC-LIMS
                        </h1>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Analyst Dashboard
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                {userData?.full_name}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 capitalize">
                                {userData?.role}
                            </p>
                        </div>
                        <form action={logout}>
                            <Button variant="outline" size="sm" type="submit">
                                Logout
                            </Button>
                        </form>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Accession Sample Card */}
                    <Link href="/analyst/accession">
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <Plus className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle>Accession Sample</CardTitle>
                                        <CardDescription>
                                            Receive new samples into the system
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    Use QR scanner or manual entry to register new samples
                                </p>
                            </CardContent>
                        </Card>
                    </Link>

                    {/* Sample List Card */}
                    <Link href="/analyst/samples">
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <List className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle>Sample List</CardTitle>
                                        <CardDescription>
                                            View and manage all samples
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    Search, filter, and edit sample information
                                </p>
                            </CardContent>
                        </Card>
                    </Link>
                </div>
            </main>
        </div>
    )
}
