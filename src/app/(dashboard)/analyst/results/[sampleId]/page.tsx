import { redirect } from 'next/navigation'

/**
 * @deprecated This page is deprecated. Result entry now happens in the unified Samples page.
 * This redirect ensures backwards compatibility for any existing links/bookmarks.
 */

interface PageProps {
    params: Promise<{
        sampleId: string
    }>
}

export default async function AnalystResultsPage({ params }: PageProps) {
    const resolvedParams = await params
    redirect(`/analyst/samples?sampleId=${resolvedParams.sampleId}`)
}
