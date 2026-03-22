import type { ApprovalQueueSample, ApprovalTab } from '@/types'

type ApprovalSearchParams =
    | string
    | URLSearchParams
    | Record<string, string | string[] | undefined>

interface BuildApprovalQueueUrlOptions {
    pathname: string
    searchParams?: ApprovalSearchParams
    tab: ApprovalTab
    sampleId?: string | null
}

interface ResolveApprovalDeepLinkOptions {
    pathname: string
    searchParams?: ApprovalSearchParams
    tab: ApprovalTab
    sampleId?: string | null
    samples: ApprovalQueueSample[]
}

interface ResolveApprovalUrlStateOptions {
    searchParams?: ApprovalSearchParams
    fallbackTab: ApprovalTab
    fallbackSampleId?: string | null
}

function createApprovalSearchParams(searchParams?: ApprovalSearchParams): URLSearchParams {
    if (typeof searchParams === 'string') {
        return new URLSearchParams(searchParams)
    }

    if (searchParams instanceof URLSearchParams) {
        return new URLSearchParams(searchParams.toString())
    }

    if (searchParams) {
        const params = new URLSearchParams()

        for (const [key, value] of Object.entries(searchParams)) {
            if (Array.isArray(value)) {
                value.forEach((entry) => {
                    params.append(key, entry)
                })
                continue
            }

            if (value !== undefined) {
                params.set(key, value)
            }
        }

        return params
    }

    if (typeof window !== 'undefined') {
        return new URLSearchParams(window.location.search)
    }

    return new URLSearchParams()
}

export function getOppositeApprovalTab(tab: ApprovalTab): ApprovalTab {
    return tab === 'review' ? 'completed' : 'review'
}

export function resolveApprovalTab(tabValue: string | null | undefined, fallbackTab: ApprovalTab): ApprovalTab {
    return tabValue === 'completed' || tabValue === 'review' ? tabValue : fallbackTab
}

export function resolveApprovalUrlState({
    searchParams,
    fallbackTab,
    fallbackSampleId,
}: ResolveApprovalUrlStateOptions) {
    const params = createApprovalSearchParams(searchParams)
    const hasLiveSearchParams = searchParams !== undefined || typeof window !== 'undefined'

    return {
        tab: resolveApprovalTab(params.get('tab'), fallbackTab),
        sampleId: hasLiveSearchParams ? (params.get('sampleId') ?? null) : (fallbackSampleId ?? null),
    }
}

export function resolveApprovalSelectedSampleId(
    sampleId: string | null | undefined,
    samples: ApprovalQueueSample[],
): string | null {
    if (!sampleId) {
        return null
    }

    return samples.some((sample) => sample.id === sampleId) ? sampleId : null
}

export function buildApprovalQueueUrl({
    pathname,
    searchParams,
    tab,
    sampleId,
}: BuildApprovalQueueUrlOptions): string {
    const params = createApprovalSearchParams(searchParams)

    params.set('tab', tab)

    if (sampleId) {
        params.set('sampleId', sampleId)
    } else {
        params.delete('sampleId')
    }

    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
}

export function resolveApprovalDeepLink({
    pathname,
    searchParams,
    tab,
    sampleId,
    samples,
}: ResolveApprovalDeepLinkOptions) {
    const selectedSampleId = resolveApprovalSelectedSampleId(sampleId, samples)

    if (sampleId && !selectedSampleId) {
        return {
            selectedSampleId: null,
            redirectUrl: buildApprovalQueueUrl({
                pathname,
                searchParams,
                tab,
                sampleId: null,
            }),
        }
    }

    return {
        selectedSampleId,
        redirectUrl: null,
    }
}

export function replaceApprovalQueueUrl(url: string) {
    window.history.replaceState(null, '', url)
}
