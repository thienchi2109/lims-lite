'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { UserRole } from '@/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormLabel } from '@/components/ui/form'
import { SignatureUploadField } from '@/components/signature-upload-field'
import { Info } from 'lucide-react'

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

            {isSelfEdit && userRole === 'manager' && (
                <SignatureUploadField
                    value={signatureFile}
                    onChange={onSignatureFileChange}
                    error={signatureError || undefined}
                    required={false}
                />
            )}

            {isOtherEdit && userRole === 'manager' && (
                <div className="space-y-2">
                    <FormLabel>Chữ ký điện tử</FormLabel>
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                            Người dùng này cần tự tải lên chữ ký điện tử của họ khi đăng nhập.
                            Bạn không thể tải lên chữ ký thay họ để đảm bảo tuân thủ quy định.
                        </AlertDescription>
                    </Alert>
                </div>
            )}
        </>
    )
}
