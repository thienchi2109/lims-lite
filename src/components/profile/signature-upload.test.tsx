import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-dropzone', () => ({
    useDropzone: () => ({
        getRootProps: () => ({}),
        getInputProps: () => ({}),
        isDragActive: false,
    }),
}))

vi.mock('@/hooks/use-signature-status', () => ({
    useSignatureStatus: () => ({
        hasSignature: false,
        signature: null,
        isLoading: false,
        refetch: vi.fn(),
    }),
}))

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}))

import SignatureUpload from './signature-upload'

describe('SignatureUpload', () => {
    it('guides analysts without a signature to upload from the profile surface before submitting', () => {
        render(<SignatureUpload />)

        expect(screen.getByText('Chưa có chữ ký')).toBeDefined()
        expect(
            screen.getByText(/Tải lên chữ ký điện tử trong Hồ sơ là bắt buộc trước khi nộp kết quả xét nghiệm/i),
        ).toBeDefined()
    })
})
