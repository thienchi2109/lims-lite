// Reuse canonical field validation; identity resolution and create-only requirements belong to TASK-10.
import { ClientResolutionInputSchema, ResolveOrCreateClientInputSchema } from '@/types/client-resolution'
import { isValidVietnamesePhone, normalizePhoneVN } from '@/lib/coa-auth'
import type { WorkbookBudget } from './budget'
import { WorkbookErrors, type WorkbookLocation } from './errors'
import { BUSINESS_HEADERS } from '../accession-template/contract'

const creation = ResolveOrCreateClientInputSchema.shape
const clientFields = ClientResolutionInputSchema.safeExtend({
    gender: creation.gender.nullable(), address: creation.address,
    healthInsuranceNum: creation.healthInsuranceNum, expiryDate: creation.expiryDate,
})
export type ValidatedClient = ReturnType<typeof clientFields.parse> & { temporaryReference: string; callerContext: { sheet: string; row: number; temporaryReference: string } }
const fieldColumns: Record<string, number> = { name: 1, dateOfBirth: 2, governmentIdentityType: 3, governmentIdentityValue: 4, gender: 5, phone: 6, address: 7, healthInsuranceNum: 8, expiryDate: 9 }

export function validateClient(values: (string | null)[], row: number, budget: WorkbookBudget, errors: WorkbookErrors): ValidatedClient {
    budget.reserve(2048 + values.reduce((bytes, value) => bytes + (value?.length ?? 0) * 4, 0))
    const reference = values[0] ?? ''
    const location = (column: number): WorkbookLocation => ({ sheet: 'Khách hàng', row, column: String.fromCharCode(65 + column), header: BUSINESS_HEADERS[0][column], temporaryReference: reference || null })
    const rawPhone = values[6]
    let phone = rawPhone === '0000000000' || rawPhone == null ? null : rawPhone
    const phoneInvalid = rawPhone != null && (rawPhone.length > 30 || (phone != null && !isValidVietnamesePhone(phone)))
    if (phoneInvalid) errors.add('VALUE_INVALID', location(6), 'Số điện thoại phải hợp lệ và không quá 30 ký tự.')
    if (phone != null) phone = normalizePhoneVN(phone)
    const input = {
        name: values[1] ?? '', dateOfBirth: values[2] ?? '',
        governmentIdentityType: values[3]?.toLowerCase() ?? null, governmentIdentityValue: values[4],
        gender: values[5], phone, address: values[7], healthInsuranceNum: values[8], expiryDate: values[9],
        callerContext: { sheet: 'Khách hàng', row, temporaryReference: reference },
    }
    // Workbook's identity enum is case sensitive; the canonical enum uses lowercase spellings.
    const identityTypeInvalid = values[3] != null && !['CCCD', 'CMND'].includes(values[3])
    if (identityTypeInvalid) errors.add('IDENTITY_INVALID', location(3))
    // Enum failures in optional creation fields must not suppress the canonical identity refinement.
    const parsed = ClientResolutionInputSchema.safeParse({
        name: input.name, dateOfBirth: input.dateOfBirth, governmentIdentityType: input.governmentIdentityType,
        governmentIdentityValue: input.governmentIdentityValue, phone, callerContext: input.callerContext,
    })
    if (!parsed.success) for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]), column = fieldColumns[field]
        if (column === undefined) continue
        let code = 'VALUE_INVALID'
        if (field.startsWith('governmentIdentity')) code = 'IDENTITY_INVALID'
        else if (values[column] == null && [1, 2].includes(column)) code = 'REQUIRED_VALUE_MISSING'
        else if (['dateOfBirth', 'expiryDate'].includes(field)) code = 'DATE_INVALID'
        if ((column === 6 && code === 'VALUE_INVALID' && phoneInvalid) || (column === 3 && code === 'IDENTITY_INVALID' && identityTypeInvalid)) continue
        errors.add(code, location(column))
    }
    for (const field of ['gender', 'address', 'healthInsuranceNum', 'expiryDate'] as const) {
        const result = clientFields.shape[field].safeParse(input[field])
        if (!result.success) errors.add(field === 'expiryDate' ? 'DATE_INVALID' : 'VALUE_INVALID', location(fieldColumns[field]))
    }
    // Invalid placeholders stay internal: callers receive no rows whenever any error exists.
    return { ...input, ...(parsed.success ? parsed.data : {}), temporaryReference: reference } as ValidatedClient
}
