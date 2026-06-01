import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import ManagerOtpPage from './page'

describe('ManagerOtpPage', () => {
    it('shows Vietnamese admin recovery guidance when OTP email is not configured', () => {
        render(<ManagerOtpPage />)

        expect(screen.getByRole('heading', { name: 'Xác thực email quản lý' })).toBeDefined()
        expect(screen.getByText(/liên hệ quản trị viên/i)).toBeDefined()
        expect(screen.getByText(/Quản lý người dùng/i)).toBeDefined()
        expect(screen.getByRole('link', { name: 'Đăng xuất' }).getAttribute('href')).toBe('/logout')
    })
})
