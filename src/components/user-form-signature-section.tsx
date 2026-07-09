'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { UserRole } from '@/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormLabel } from '@/components/ui/form'
import { SignatureUploadField } from '@/components/signature-upload-field'
import { Info } from 'lucide-react'
import { getSignatureSelfUploadGuidance } from '@/lib/signature-readiness'

interface UserFormSignatureSectionProps {
    isEdit: boolean
    isSelfEdit: boolean
    isOtherEdit: boolean
    selectedRole: UserRole | undefined
    signatureError: string | null
    signatureFile: File | null
    userRole?: UserRole
    onSignatureFileChange: Dispatch<SetStateAction<File | null>>
}

export function UserFormSignatureSection({
    isEdit,
    isSelfEdit,
    isOtherEdit,
    selectedRole,
    signatureError,
    signatureFile,
    userRole,
    onSignatureFileChange,
}: UserFormSignatureSectionProps) {
    const createGuidance = !isEdit ? getSignatureSelfUploadGuidance(selectedRole) : null
    const otherEditGuidance = isOtherEdit ? getSignatureSelfUploadGuidance(userRole) : null

    return (
        <>
            {!isEdit && selectedRole === 'manager' && (
                <SignatureUploadField
                    value={signatureFile}
                    onChange={onSignatureFileChange}
                    error={signatureError || undefined}
                    required={false}
                />
            )}

            {!isEdit && selectedRole === 'analyst' && createGuidance && (
                <div className="space-y-2">
                    <FormLabel>Chữ ký điện tử</FormLabel>
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                            {createGuidance}
                        </AlertDescription>
                    </Alert>
                </div>
            )}

            {isSelfEdit && userRole === 'manager' && (
                <SignatureUploadField
                    value={signatureFile}
                    onChange={onSignatureFileChange}
                    error={signatureError || undefined}
                    required={false}
                />
            )}

            {otherEditGuidance && (
                <div className="space-y-2">
                    <FormLabel>Chữ ký điện tử</FormLabel>
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                            {otherEditGuidance}
                        </AlertDescription>
                    </Alert>
                </div>
            )}
        </>
    )
}
