import { redirect } from 'next/navigation'

/**
 * @deprecated This page is deprecated. Result review now happens in the unified Samples page.
 * This redirect ensures backwards compatibility for any existing links/bookmarks.
 */

interface PageProps {
    params: Promise<{
        sampleId: string
    }>
}

export default async function ManagerResultsPage({ params }: PageProps) {
    const resolvedParams = await params
    redirect(`/manager/samples?sampleId=${resolvedParams.sampleId}`)
}
