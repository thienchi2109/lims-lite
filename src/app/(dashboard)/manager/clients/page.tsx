import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getClientLifecycleManager } from '@/app/actions/client-lifecycle'
import { ClientLifecycleWorkspace } from '@/components/client-lifecycle-workspace'
import { DashboardHeader } from '@/components/dashboard-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

export default async function ClientLifecyclePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'manager') redirect('/manager')

  const lifecycle = await getClientLifecycleManager({
    status: 'active',
    limit: 50,
    offset: 0,
  })
  const lifecycleData = 'data' in lifecycle ? lifecycle.data : null
  const lifecycleError = 'error' in lifecycle ? lifecycle.error : null

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <DashboardHeader
        subtitle="Quản lý trạng thái và hiệu chỉnh khách hàng có kiểm soát"
        user={userData}
      />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/manager">
              <ArrowLeft className="size-4" />
              Quay lại
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">Vòng đời khách hàng</h1>
        </div>

        {lifecycleData ? (
          <ClientLifecycleWorkspace initialData={lifecycleData} />
        ) : (
          <Alert variant="destructive">
            <AlertDescription>
              {lifecycleError ?? 'Không thể tải dữ liệu vòng đời khách hàng'}
            </AlertDescription>
          </Alert>
        )}
      </main>
    </div>
  )
}
