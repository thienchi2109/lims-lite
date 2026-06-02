import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ManagerOtpProfileNotice } from './manager-otp-profile-notice'

describe('ManagerOtpProfileNotice', () => {
    it('tells managers to contact an administrator instead of editing the OTP destination themselves', () => {
        render(<ManagerOtpProfileNotice />)

        expect(screen.getByText('Email nhận OTP quản lý')).toBeDefined()
        expect(screen.getByText(/không thể tự thay đổi/i)).toBeDefined()
        expect(screen.getByText(/liên hệ quản trị viên/i)).toBeDefined()
        expect(screen.queryByLabelText(/Email nhận OTP/i)).toBeNull()
    })
})
