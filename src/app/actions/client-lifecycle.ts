'use server'

import { revalidatePath } from 'next/cache'
import { isAuthError, requireRole } from '@/lib/auth-helpers'
import { createClient } from '@/lib/supabase/server'
import {
  AdjudicateClientCollisionSchema,
  ClientCollisionAdjudicationResultSchema,
  ClientLifecycleDetailSchema,
  ClientLifecycleManagerDataSchema,
  ClientLifecycleMutationResultSchema,
  CorrectClientIdentitySchema,
  DeactivateClientSchema,
  GetClientLifecycleDetailSchema,
  GetClientLifecycleManagerSchema,
  RestoreClientSchema,
} from '@/types'

const MANAGER_ERROR = 'Chỉ Quản lý mới có thể quản lý vòng đời khách hàng'
const VALIDATION_ERROR = 'Thông tin vòng đời khách hàng không hợp lệ'

type RpcError = {
  code?: string
}

const SQLSTATE_MESSAGES: Record<string, string> = {
  P1110: MANAGER_ERROR,
  P1111: VALIDATION_ERROR,
  P1112: 'Không tìm thấy khách hàng',
  P1113: 'Thông tin khách hàng đã thay đổi. Vui lòng tải lại trước khi tiếp tục',
  P1114: 'Không thể hoàn tất vì thông tin đang xung đột với khách hàng hoạt động',
  P1115: 'Trạng thái khách hàng không phù hợp với thao tác này',
  P1116: 'Không thể lưu nhật ký bắt buộc. Không có thay đổi nào được thực hiện',
  P1117: 'Không thể xác nhận vì bằng chứng xung đột không còn hợp lệ',
}

async function requireLifecycleManager() {
  const auth = await requireRole('manager')
  return isAuthError(auth) ? null : auth
}

function mapRpcError(error: RpcError | null | undefined) {
  return error?.code && SQLSTATE_MESSAGES[error.code]
    ? SQLSTATE_MESSAGES[error.code]
    : 'Không thể hoàn tất thao tác vòng đời khách hàng'
}

async function runRpc(
  functionName: string,
  parameters: Record<string, unknown>,
) {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc(functionName, parameters)

    return error
      ? { error: mapRpcError(error as RpcError) }
      : { data }
  } catch {
    return { error: 'Đã xảy ra lỗi không mong muốn' }
  }
}

export async function getClientLifecycleManager(payload?: unknown) {
  if (!await requireLifecycleManager()) return { error: MANAGER_ERROR }

  const parsed = GetClientLifecycleManagerSchema.safeParse(payload ?? {})
  if (!parsed.success) return { error: VALIDATION_ERROR }

  const result = await runRpc('get_client_lifecycle_manager_v1', {
    p_status: parsed.data.status,
    p_search: parsed.data.search ?? null,
    p_limit: parsed.data.limit,
    p_offset: parsed.data.offset,
  })
  if ('error' in result) return result

  const data = ClientLifecycleManagerDataSchema.safeParse(result.data)
  return data.success ? { data: data.data } : { error: VALIDATION_ERROR }
}

export async function getClientLifecycleDetailManager(payload?: unknown) {
  if (!await requireLifecycleManager()) return { error: MANAGER_ERROR }

  const parsed = GetClientLifecycleDetailSchema.safeParse(payload)
  if (!parsed.success) return { error: VALIDATION_ERROR }

  const result = await runRpc('get_client_lifecycle_detail_manager_v1', {
    p_client_id: parsed.data.clientId,
  })
  if ('error' in result) return result

  const data = ClientLifecycleDetailSchema.safeParse(result.data)
  return data.success ? { data: data.data } : { error: VALIDATION_ERROR }
}

async function runMutation(
  functionName: string,
  parameters: Record<string, unknown>,
) {
  const result = await runRpc(functionName, parameters)
  if ('error' in result) return result

  const data = ClientLifecycleMutationResultSchema.safeParse(result.data)
  if (!data.success) return { error: VALIDATION_ERROR }

  revalidatePath('/manager/clients')
  return { data: data.data }
}

async function runAdjudication(
  functionName: string,
  parameters: Record<string, unknown>,
) {
  const result = await runRpc(functionName, parameters)
  if ('error' in result) return result

  const data = ClientCollisionAdjudicationResultSchema.safeParse(result.data)
  if (!data.success) return { error: VALIDATION_ERROR }

  revalidatePath('/manager/clients')
  return { data: data.data }
}

export async function deactivateClient(payload?: unknown) {
  if (!await requireLifecycleManager()) return { error: MANAGER_ERROR }

  const parsed = DeactivateClientSchema.safeParse(payload)
  if (!parsed.success) return { error: VALIDATION_ERROR }

  return runMutation('deactivate_client_v1', {
    p_client_id: parsed.data.clientId,
    p_expected_updated_at: parsed.data.expectedUpdatedAt,
    p_reason: parsed.data.reason,
  })
}

export async function restoreClient(payload?: unknown) {
  if (!await requireLifecycleManager()) return { error: MANAGER_ERROR }

  const parsed = RestoreClientSchema.safeParse(payload)
  if (!parsed.success) return { error: VALIDATION_ERROR }

  return runMutation('restore_client_v1', {
    p_client_id: parsed.data.clientId,
    p_expected_updated_at: parsed.data.expectedUpdatedAt,
    p_reason: parsed.data.reason,
  })
}

export async function correctClientIdentity(payload?: unknown) {
  if (!await requireLifecycleManager()) return { error: MANAGER_ERROR }

  const parsed = CorrectClientIdentitySchema.safeParse(payload)
  if (!parsed.success) return { error: VALIDATION_ERROR }

  return runMutation('correct_client_identity_v1', {
    p_client_id: parsed.data.clientId,
    p_expected_updated_at: parsed.data.expectedUpdatedAt,
    p_id_card_num: parsed.data.idCardNum,
    p_name: parsed.data.name,
    p_date_of_birth: parsed.data.dateOfBirth,
    p_gender: parsed.data.gender,
    p_phone: parsed.data.phone,
    p_reason: parsed.data.reason,
  })
}

export async function adjudicateClientCollision(payload?: unknown) {
  if (!await requireLifecycleManager()) return { error: MANAGER_ERROR }

  const parsed = AdjudicateClientCollisionSchema.safeParse(payload)
  if (!parsed.success) return { error: VALIDATION_ERROR }

  return runAdjudication('adjudicate_client_collision_v1', {
    p_client_id: parsed.data.clientId,
    p_related_client_id: parsed.data.relatedClientId,
    p_expected_updated_at: parsed.data.expectedUpdatedAt,
    p_related_expected_updated_at: parsed.data.relatedExpectedUpdatedAt,
    p_collision_type: parsed.data.collisionType,
    p_disposition: parsed.data.disposition,
    p_reason: parsed.data.reason,
  })
}
