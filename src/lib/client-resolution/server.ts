import 'server-only'

import { isAuthError, requireRole } from '@/lib/auth-helpers'
import { createClient } from '@/lib/supabase/server'
import {
  ClientResolutionInputSchema,
  ClientResolutionResultSchema,
  ResolveOrCreateClientInputSchema,
  type ClientResolutionInput,
  type ClientResolutionResult,
  type ResolveOrCreateClientInput,
} from '@/types'
import { z } from 'zod'

const SAFE_RESOLUTION_ERROR =
  'Không thể phân giải khách hàng. Vui lòng thử lại.'
const SAFE_RESOLUTION_FORBIDDEN =
  'Bạn không có quyền phân giải khách hàng'

const RpcRowSchema = z.strictObject({
  outcome: z.string(),
  reason_code: z.string(),
  client_id: z.string().uuid().nullable(),
  created: z.boolean(),
})

type ResolverResponse =
  | { data: ClientResolutionResult }
  | { error: string }

function mapRpcRows(rows: unknown): ResolverResponse {
  const parsedRows = z.array(RpcRowSchema).safeParse(rows)
  if (!parsedRows.success || parsedRows.data.length !== 1) {
    return { error: SAFE_RESOLUTION_ERROR }
  }

  const row = parsedRows.data[0]
  const result = ClientResolutionResultSchema.safeParse({
    outcome: row.outcome,
    reasonCode:
      row.reason_code === 'restricted_candidate'
        ? 'identity_conflict'
        : row.reason_code,
    clientId: row.client_id,
    created: row.created,
  })

  return result.success
    ? { data: result.data }
    : { error: SAFE_RESOLUTION_ERROR }
}

function getValidationError(
  error: z.ZodError,
  fallback: string,
): string {
  const issue = error.issues[0]
  const field = issue?.path[0]
  const fieldMessages: Record<string, string> = {
    governmentIdentityType: 'Loại CCCD/CMND không hợp lệ',
    governmentIdentityValue: 'Số CCCD/CMND không hợp lệ',
    name: 'Họ tên không hợp lệ',
    dateOfBirth: 'Ngày sinh không hợp lệ',
    gender: 'Giới tính không hợp lệ',
    phone: 'Số điện thoại không hợp lệ',
    address: 'Địa chỉ không hợp lệ',
    healthInsuranceNum: 'Số bảo hiểm y tế không hợp lệ',
    expiryDate: 'Ngày hết hạn không hợp lệ',
    callerContext: 'Ngữ cảnh nguồn dữ liệu không hợp lệ',
  }

  if (typeof field === 'string' && fieldMessages[field]) {
    return issue?.code === 'custom' ? issue.message : fieldMessages[field]
  }

  return fallback
}

async function authorizeResolver() {
  const auth = await requireRole(['analyst', 'manager'])
  return isAuthError(auth) ? { error: SAFE_RESOLUTION_FORBIDDEN } : null
}

export async function resolveClientIdentityV2(
  input: ClientResolutionInput,
): Promise<ResolverResponse> {
  const denial = await authorizeResolver()
  if (denial) return denial

  const parsed = ClientResolutionInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      error: getValidationError(
        parsed.error,
        'Thông tin định danh không hợp lệ',
      ),
    }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('resolve_client_identity_v2', {
      p_government_identity_type:
        parsed.data.governmentIdentityType ?? null,
      p_government_identity_value:
        parsed.data.governmentIdentityValue ?? null,
      p_name: parsed.data.name,
      p_date_of_birth: parsed.data.dateOfBirth,
      p_phone: parsed.data.phone ?? null,
    })

    return error ? { error: SAFE_RESOLUTION_ERROR } : mapRpcRows(data)
  } catch {
    return { error: SAFE_RESOLUTION_ERROR }
  }
}

export async function resolveOrCreateClientV2(
  input: ResolveOrCreateClientInput,
): Promise<ResolverResponse> {
  const denial = await authorizeResolver()
  if (denial) return denial

  const parsed = ResolveOrCreateClientInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      error: getValidationError(
        parsed.error,
        'Thông tin khách hàng không hợp lệ',
      ),
    }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('resolve_or_create_client_v2', {
      p_government_identity_type:
        parsed.data.governmentIdentityType ?? null,
      p_government_identity_value:
        parsed.data.governmentIdentityValue ?? null,
      p_name: parsed.data.name,
      p_date_of_birth: parsed.data.dateOfBirth,
      p_gender: parsed.data.gender,
      p_phone: parsed.data.phone,
      p_address: parsed.data.address ?? null,
      p_health_insurance_num:
        parsed.data.healthInsuranceNum ?? null,
      p_expiry_date: parsed.data.expiryDate ?? null,
    })

    return error ? { error: SAFE_RESOLUTION_ERROR } : mapRpcRows(data)
  } catch {
    return { error: SAFE_RESOLUTION_ERROR }
  }
}
