'use client'

import { useState, useEffect } from 'react'
import { SampleWithUser } from '@/types'
import { SampleDetailPanel } from '@/components/sample-detail-panel'
import { AssignedTestsPanel } from '@/components/assigned-tests-panel'
import { TestAssignmentEditor } from '@/components/test-assignment-editor'
import { SampleResultsView } from '@/components/sample-results-view'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface SampleBottomRowProps {
    sample: SampleWithUser | null
}

export function SampleBottomRow({ sample }: SampleBottomRowProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [userRole, setUserRole] = useState<'analyst' | 'manager'>('analyst')
    const [userFullName, setUserFullName] = useState<string>('')
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const view = searchParams.get('view')

    // Fetch user role and name on mount
    useEffect(() => {
        const fetchUserData = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data } = await supabase
                    .from('users')
                    .select('role, full_name')
                    .eq('id', user.id)
                    .single()
                if (data) {
                    setUserRole(data.role as 'analyst' | 'manager')
                    setUserFullName(data.full_name || '')
                }
            }
        }
        fetchUserData()
    }, [])

    // Reset editing state when sample changes
    useEffect(() => {
        setIsEditing(false)
    }, [sample?.id])

    const handleAssignTests = () => {
        if (sample) {
            setIsEditing(true)
        }
    }

    const handleEditSuccess = () => {
        setIsEditing(false)
        router.refresh()
    }

    const handleCloseResults = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('view')
        router.replace(`${pathname}?${params.toString()}`)
    }

    // If view is 'results' and we have a sample, show the full-width results view
    if (view === 'results' && sample) {
        return (
            <div className="h-full">
                <SampleResultsView
                    sample={sample}
                    userRole={userRole}
                    userFullName={userFullName}
                    onClose={handleCloseResults}
                />
            </div>
        )
    }

    if (isEditing && sample) {
        return (
            <div className="h-full">
                <TestAssignmentEditor
                    sampleId={sample.id}
                    sampleName={sample.sample_id}
                    onCancel={() => setIsEditing(false)}
                    onSuccess={handleEditSuccess}
                    context={<SampleDetailPanel sample={sample} />}
                />
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            <div className="h-full min-h-0">
                <SampleDetailPanel sample={sample} />
            </div>
            <div className="h-full min-h-0">
                <AssignedTestsPanel
                    sampleId={sample?.id || null}
                    onAssignTests={handleAssignTests}
                />
            </div>
        </div>
    )
}
