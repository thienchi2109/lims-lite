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
import type { ValidatedClient } from '@/lib/accession-workbook/clients'
import { PreviewClientInputSchema, PreviewClientRowSchema, type PreviewClientRow } from '@/lib/accession-preview/client-contract'

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

// Read-only batch bridge: raw caller references never cross the SQL boundary.
export async function resolveAccessionPreviewClientsV1(
  clients: ValidatedClient[],
  signal?: AbortSignal,
): Promise<{ data: PreviewClientRow[] } | { error: string }> {
  const auth = await requireRole('analyst')
  if (isAuthError(auth)) return { error: SAFE_RESOLUTION_FORBIDDEN }
  signal?.throwIfAborted()
  const rows = new Set<number>()
  const inputs = []
  for (const client of clients) {
    const { name, dateOfBirth, governmentIdentityType = null, governmentIdentityValue = null,
      gender, phone = null, address = null, healthInsuranceNum = null, expiryDate = null } = client
    const row = client.callerContext?.row
    const parsed = PreviewClientInputSchema.safeParse({ name, dateOfBirth, governmentIdentityType, governmentIdentityValue,
      gender, phone, address, healthInsuranceNum, expiryDate })
    if (!parsed.success || !Number.isSafeInteger(row) || row <= 0 || rows.has(row)) return { error: SAFE_RESOLUTION_ERROR }
    rows.add(row)
    inputs.push({ row, ...parsed.data })
  }
  if (!inputs.length) return { error: SAFE_RESOLUTION_ERROR }
  try {
    const supabase = await createClient()
    const operation = supabase.rpc('resolve_accession_preview_clients_v1', { p_clients: inputs })
    const { data, error } = await (signal ? operation.abortSignal(signal) : operation)
    const parsed = z.array(PreviewClientRowSchema).safeParse(data)
    if (error || !parsed.success || parsed.data.length !== inputs.length) return { error: SAFE_RESOLUTION_ERROR }
    const seen = new Set<number>()
    for (const result of parsed.data) {
      if (!rows.has(result.row) || seen.has(result.row) || result.issues.some(issue =>
        issue.relatedRows.some(related => !rows.has(related) || related === result.row))) return { error: SAFE_RESOLUTION_ERROR }
      seen.add(result.row)
    }
    return { data: parsed.data }
  } catch {
    return { error: SAFE_RESOLUTION_ERROR }
  }
}
