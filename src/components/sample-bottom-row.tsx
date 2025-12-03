'use client'

import { useState, useEffect } from 'react'
import { SampleWithUser } from '@/types'
import { SampleDetailPanel } from '@/components/sample-detail-panel'
import { AssignedTestsPanel } from '@/components/assigned-tests-panel'
import { TestAssignmentEditor } from '@/components/test-assignment-editor'
import { useRouter } from 'next/navigation'

interface SampleBottomRowProps {
    sample: SampleWithUser | null
}

export function SampleBottomRow({ sample }: SampleBottomRowProps) {
    const [isEditing, setIsEditing] = useState(false)
    const router = useRouter()

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
