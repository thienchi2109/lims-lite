import { getAssaySampleTypeCatalogManager } from '@/app/actions/assay-sample-type-compatibility'
import { getSpecialties } from '@/app/actions/assay-lookups'
import { AssaySampleTypeCompatibilityWorkspace } from '@/components/assay-sample-type-compatibility-workspace'
import { Button } from '@/components/ui/button'
import { DashboardHeader } from '@/components/dashboard-header'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function AssayCompatibilityPage() {
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

  const [catalog, specialties] = await Promise.all([
    getAssaySampleTypeCatalogManager(),
    getSpecialties(),
  ])
  const catalogData = 'data' in catalog ? catalog.data : null
  const specialtyRows = 'data' in specialties ? specialties.data ?? [] : []
  let sourceCatalogData = null
  let sourceCatalogAvailable = true

  if (catalogData?.revision?.sourceRevisionId) {
    const sourceCatalog = await getAssaySampleTypeCatalogManager({
      revisionId: catalogData.revision.sourceRevisionId,
    })
    sourceCatalogData = 'data' in sourceCatalog ? sourceCatalog.data : null
    sourceCatalogAvailable = Boolean(sourceCatalogData)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <DashboardHeader
        subtitle="Quản lý tương thích loại mẫu"
        user={userData}
      />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/manager/assays">
              <ArrowLeft className="size-4" />
              Quay lại danh sách chỉ tiêu
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">
            Quản lý tương thích loại mẫu
          </h1>
        </div>
        {catalogData && sourceCatalogAvailable ? (
          <AssaySampleTypeCompatibilityWorkspace
            key={catalogData.revision?.id ?? 'no-revision'}
            initialCatalog={catalogData}
            sourceCatalog={sourceCatalogData}
            specialties={specialtyRows.map((specialty) => ({
              id: specialty.id,
              name: specialty.name,
            }))}
          />
        ) : (
          <p role="alert" className="border-y bg-white px-4 py-6 text-red-600">
            Không thể tải dữ liệu tương thích loại mẫu.
          </p>
        )}
      </main>
    </div>
  )
}
