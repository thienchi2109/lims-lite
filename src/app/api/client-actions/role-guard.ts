import { createClient } from '@/lib/supabase/server'
import type { ClientActionName } from '@/lib/client-actions/types'
import { MANAGER_OTP_REQUIRED_ERROR, managerRequiresOtp } from '@/lib/manager-email-otp/guards'

const DOCTOR_ALLOWED_ACTIONS = new Set<ClientActionName>(['getSamples'])
const MANAGER_FORBIDDEN_ACTIONS = new Set<ClientActionName>(['createSample', 'accessionAndAssignTests'])
export const CLIENT_ACTION_FORBIDDEN_ERROR = 'Bạn không có quyền thực hiện thao tác này'

export async function getClientActionDenial(action: ClientActionName) {
    const supabase = await createClient()
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
        return null
    }

    const { data: userData, error: roleError } = await supabase
        .from('users')
        .select('role, can_access_confidential')
        .eq('id', user.id)
        .single()

    if (roleError) {
        return {
            error: 'Không thể xác minh quyền truy cập',
            status: 403,
        }
    }

    if (userData?.role === 'doctor') {
        if (DOCTOR_ALLOWED_ACTIONS.has(action)) {
            return null
        }

        return {
            error: CLIENT_ACTION_FORBIDDEN_ERROR,
            status: 403,
        }
    }

    if (userData?.role === 'manager' && managerRequiresOtp(userData)) {
        return {
            error: MANAGER_OTP_REQUIRED_ERROR,
            status: 403,
        }
    }

    if (userData?.role === 'manager' && MANAGER_FORBIDDEN_ACTIONS.has(action)) {
        return {
            error: CLIENT_ACTION_FORBIDDEN_ERROR,
            status: 403,
        }
    }

    return null
}
