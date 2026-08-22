import { describe, expect, it } from 'vitest'
import {
  ClientResolutionInputSchema,
  ClientResolutionResultSchema,
  ResolveOrCreateClientInputSchema,
  type ClientResolutionReasonCode,
} from '@/types'
import {
  CLIENT_RESOLUTION_LABELS,
  localizeClientResolution,
} from '@/lib/client-resolution/messages'

const matchedResult = {
  outcome: 'matched',
  reasonCode: 'trusted_identity_match',
  clientId: '11111111-1111-4111-8111-111111111111',
  created: false,
} as const

describe('client resolver v2 contracts', () => {
  it('accepts raw identity inputs without application-side canonical conversion', () => {
    const parsed = ClientResolutionInputSchema.parse({
      governmentIdentityType: 'cccd',
      governmentIdentityValue: ' 086094006827 ',
      name: '  Nguyễn   Văn A ',
      dateOfBirth: '1994-09-21',
      phone: ' +84901234567 ',
      callerContext: {
        sheet: 'Danh sách 1',
        row: 12,
        temporaryReference: 'TMP-12',
      },
    })

    expect(parsed.governmentIdentityValue).toBe(' 086094006827 ')
    expect(parsed.name).toBe('  Nguyễn   Văn A ')
    expect(parsed.phone).toBe(' +84901234567 ')
  })

  it('rejects unknown fields and invalid typed identity pairs', () => {
    expect(() =>
      ClientResolutionInputSchema.parse({
        governmentIdentityType: 'cccd',
        governmentIdentityValue: null,
        name: 'Nguyễn Văn A',
        dateOfBirth: '1994-09-21',
        extra: 'not allowed',
      }),
    ).toThrow()

    expect(() =>
      ClientResolutionInputSchema.parse({
        governmentIdentityType: 'passport',
        governmentIdentityValue: 'A123',
        name: 'Nguyễn Văn A',
        dateOfBirth: '1994-09-21',
      }),
    ).toThrow()
  })

  it.each([
    ['cccd', '123456789', 'CCCD phải gồm đúng 12 chữ số'],
    ['cccd', '12345678901A', 'CCCD phải gồm đúng 12 chữ số'],
    ['cmnd', '12345678', 'CMND phải gồm đúng 9 chữ số'],
    ['cmnd', '12345678A', 'CMND phải gồm đúng 9 chữ số'],
  ] as const)(
    'validates trimmed %s values without changing the raw input',
    (governmentIdentityType, governmentIdentityValue, expectedMessage) => {
      const result = ClientResolutionInputSchema.safeParse({
        governmentIdentityType,
        governmentIdentityValue: ` ${governmentIdentityValue} `,
        name: 'Nguyễn Văn A',
        dateOfBirth: '1994-09-21',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(expectedMessage)
      }
    },
  )

  it('accepts a raw nine-digit CMND without trimming the parsed value', () => {
    const parsed = ClientResolutionInputSchema.parse({
      governmentIdentityType: 'cmnd',
      governmentIdentityValue: ' 123456789 ',
      name: 'Nguyễn Văn A',
      dateOfBirth: '1994-09-21',
    })

    expect(parsed.governmentIdentityValue).toBe(' 123456789 ')
  })

  it('requires complete profile data only for resolve-and-create', () => {
    expect(() =>
      ResolveOrCreateClientInputSchema.parse({
        name: 'Nguyễn Văn A',
        dateOfBirth: '1994-09-21',
      }),
    ).toThrow()

    expect(
      ResolveOrCreateClientInputSchema.parse({
        governmentIdentityType: null,
        governmentIdentityValue: null,
        name: 'Nguyễn Văn A',
        dateOfBirth: '1994-09-21',
        gender: 'Nam',
        phone: '0901234567',
      }),
    ).toMatchObject({
      gender: 'Nam',
      phone: '0901234567',
    })
  })

  it.each([
    ['dateOfBirth', '2026-02-31', 'Ngày sinh không hợp lệ'],
    ['expiryDate', '2026-02-31', 'Ngày hết hạn không hợp lệ'],
  ] as const)(
    'rejects impossible calendar values for %s with a Vietnamese message',
    (field, value, expectedMessage) => {
      const result = ResolveOrCreateClientInputSchema.safeParse({
        governmentIdentityType: null,
        governmentIdentityValue: null,
        name: 'Nguyễn Văn A',
        dateOfBirth: '1994-09-21',
        gender: 'Nam',
        phone: '0901234567',
        [field]: value,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(expectedMessage)
      }
    },
  )

  it.each(['0000000000', '0123456789', '0201234567'])(
    'rejects placeholder or invalid Vietnamese phone %s',
    (phone) => {
      const result = ResolveOrCreateClientInputSchema.safeParse({
        governmentIdentityType: null,
        governmentIdentityValue: null,
        name: 'Nguyễn Văn A',
        dateOfBirth: '1994-09-21',
        gender: 'Nam',
        phone,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'Số điện thoại không hợp lệ',
        )
      }
    },
  )

  it('enforces client identifiers only for matched results', () => {
    expect(ClientResolutionResultSchema.parse(matchedResult)).toEqual(
      matchedResult,
    )
    expect(
      ClientResolutionResultSchema.parse({
        outcome: 'conflict',
        reasonCode: 'identity_conflict',
        clientId: null,
        created: false,
      }),
    ).toMatchObject({
      outcome: 'conflict',
      clientId: null,
    })

    expect(() =>
      ClientResolutionResultSchema.parse({
        outcome: 'conflict',
        reasonCode: 'identity_conflict',
        clientId: matchedResult.clientId,
        created: false,
      }),
    ).toThrow()
  })

  it('centralizes the four Vietnamese outcome labels', () => {
    expect(CLIENT_RESOLUTION_LABELS).toEqual({
      matched: 'Đã khớp',
      not_found: 'Không tìm thấy khách hàng',
      ambiguous: 'Không thể xác định duy nhất',
      conflict: 'Xung đột thông tin',
    })
  })

  it.each([
    ['trusted_identity_match', 'CCCD/CMND'],
    ['trusted_identity_not_found', 'tạo mới'],
    ['trusted_identity_ambiguous', 'quản lý'],
    ['trusted_identity_disagreement', 'không khớp'],
    ['name_dob_match', 'họ tên'],
    ['name_dob_ambiguous', 'quản lý'],
    ['inactive_candidate', 'ngừng hoạt động'],
    ['accent_only_conflict', 'dấu'],
    ['phone_conflict', 'số điện thoại'],
    ['cross_key_conflict', 'thông tin định danh'],
    ['identity_conflict', 'không thể xử lý tự động'],
    ['invalid_identity_input', 'không hợp lệ'],
    ['client_created', 'đã được tạo'],
  ] satisfies Array<[ClientResolutionReasonCode, string]>)(
    'maps %s to an actionable Vietnamese message',
    (reasonCode, expectedText) => {
      const localized = localizeClientResolution(
        {
          outcome:
            reasonCode === 'client_created' ||
            reasonCode.endsWith('_match')
              ? 'matched'
              : reasonCode.includes('ambiguous')
                ? 'ambiguous'
                : reasonCode.includes('not_found')
                  ? 'not_found'
                  : 'conflict',
          reasonCode,
          clientId:
            reasonCode === 'client_created' ||
            reasonCode.endsWith('_match')
              ? matchedResult.clientId
              : null,
          created: reasonCode === 'client_created',
        },
        {
          sheet: 'Danh sách 1',
          row: 12,
          temporaryReference: 'TMP-12',
        },
      )

      expect(localized.message.toLowerCase()).toContain(
        expectedText.toLowerCase(),
      )
      expect(localized.message).toContain('Danh sách 1')
      expect(localized.message).toContain('trang tính Danh sách 1')
      expect(localized.message).toContain('dòng 12')
      expect(localized.message).toContain('TMP-12')
      expect(localized.message).not.toMatch(
        /duplicate key|violates unique|postgres|clients_unique|restricted|confidential/i,
      )
    },
  )
})
