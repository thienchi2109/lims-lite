import { describe, it, expect } from 'vitest'
import {
  getMethodForAssay,
  validateAssignments,
  prepareAssignmentData,
  type AssayWithMethods,
  type MethodSelectionResult,
} from './test-assignment-logic'

describe('getMethodForAssay', () => {
  it('returns user-selected method when explicitly provided', () => {
    const assay: AssayWithMethods = {
      id: 'assay-1',
      name: 'Glucose',
      code: 'GLU',
      specialty_id: 'chem-1',
      default_method_id: 'method-default',
      methods: [
        { id: 'method-1', name: 'HPLC', is_default: false },
        { id: 'method-default', name: 'Enzymatic', is_default: true },
      ],
    }

    const result = getMethodForAssay(assay, {
      userSelectedMethodId: 'method-1',
    })

    expect(result.methodId).toBe('method-1')
    expect(result.priority).toBe('user_selected')
    expect(result.warning).toBeUndefined()
  })

  it('returns filter-selected method when user filtered by method', () => {
    const assay: AssayWithMethods = {
      id: 'assay-1',
      name: 'Glucose',
      code: 'GLU',
      specialty_id: 'chem-1',
      default_method_id: 'method-default',
      methods: [
        { id: 'method-1', name: 'HPLC', is_default: false },
        { id: 'method-default', name: 'Enzymatic', is_default: true },
      ],
    }

    const result = getMethodForAssay(assay, {
      filterMethodId: 'method-1',
    })

    expect(result.methodId).toBe('method-1')
    expect(result.priority).toBe('filter_selected')
    expect(result.warning).toBeUndefined()
  })

  it('ignores filter if filtered method is not available for this assay', () => {
    const assay: AssayWithMethods = {
      id: 'assay-1',
      name: 'Glucose',
      code: 'GLU',
      specialty_id: 'chem-1',
      default_method_id: 'method-default',
      methods: [
        { id: 'method-default', name: 'Enzymatic', is_default: true },
      ],
    }

    const result = getMethodForAssay(assay, {
      filterMethodId: 'method-not-available',
    })

    // Should fall back to default method
    expect(result.methodId).toBe('method-default')
    expect(result.priority).toBe('default_method')
  })

  it('returns default method when no user selection or filter', () => {
    const assay: AssayWithMethods = {
      id: 'assay-1',
      name: 'Glucose',
      code: 'GLU',
      specialty_id: 'chem-1',
      default_method_id: 'method-default',
      methods: [
        { id: 'method-1', name: 'HPLC', is_default: false },
        { id: 'method-default', name: 'Enzymatic', is_default: true },
      ],
    }

    const result = getMethodForAssay(assay)

    expect(result.methodId).toBe('method-default')
    expect(result.priority).toBe('default_method')
    expect(result.warning).toBeUndefined()
  })

  it('returns first available method with warning when no default exists', () => {
    const assay: AssayWithMethods = {
      id: 'assay-1',
      name: 'Glucose',
      code: 'GLU',
      specialty_id: 'chem-1',
      default_method_id: null,
      methods: [
        { id: 'method-1', name: 'HPLC', is_default: false },
        { id: 'method-2', name: 'Spectrophotometry', is_default: false },
      ],
    }

    const result = getMethodForAssay(assay)

    expect(result.methodId).toBe('method-1')
    expect(result.priority).toBe('first_available')
    expect(result.warning).toContain('không có phương pháp mặc định')
    expect(result.warning).toContain('Glucose')
    expect(result.warning).toContain('HPLC')
  })

  it('returns null method with warning when assay has no methods', () => {
    const assay: AssayWithMethods = {
      id: 'assay-1',
      name: 'Visual Inspection',
      code: 'VIS',
      specialty_id: 'qual-1',
      default_method_id: null,
      methods: [],
    }

    const result = getMethodForAssay(assay)

    expect(result.methodId).toBeNull()
    expect(result.priority).toBe('none')
    expect(result.warning).toContain('chưa có phương pháp')
    expect(result.warning).toContain('Visual Inspection')
  })

  it('prioritizes user selection over filter', () => {
    const assay: AssayWithMethods = {
      id: 'assay-1',
      name: 'Glucose',
      code: 'GLU',
      specialty_id: 'chem-1',
      default_method_id: 'method-default',
      methods: [
        { id: 'method-1', name: 'HPLC', is_default: false },
        { id: 'method-2', name: 'Spectrophotometry', is_default: false },
        { id: 'method-default', name: 'Enzymatic', is_default: true },
      ],
    }

    const result = getMethodForAssay(assay, {
      userSelectedMethodId: 'method-1',
      filterMethodId: 'method-2',
    })

    // User selection wins
    expect(result.methodId).toBe('method-1')
    expect(result.priority).toBe('user_selected')
  })
})

describe('validateAssignments', () => {
  it('returns valid when assignments have methods', () => {
    const assignments = [
      {
        assay: {
          id: 'assay-1',
          name: 'Glucose',
          code: 'GLU',
          specialty_id: 'chem-1',
          default_method_id: 'method-1',
          methods: [{ id: 'method-1', name: 'HPLC', is_default: true }],
        },
        methodId: 'method-1',
      },
    ]

    const result = validateAssignments(assignments)

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  it('returns error when no assignments provided', () => {
    const result = validateAssignments([])

    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('chọn ít nhất một xét nghiệm')
  })

  it('returns warning when some assignments have no method', () => {
    const assignments = [
      {
        assay: {
          id: 'assay-1',
          name: 'Glucose',
          code: 'GLU',
          specialty_id: 'chem-1',
          default_method_id: 'method-1',
          methods: [{ id: 'method-1', name: 'HPLC', is_default: true }],
        },
        methodId: 'method-1',
      },
      {
        assay: {
          id: 'assay-2',
          name: 'Visual Inspection',
          code: 'VIS',
          specialty_id: 'qual-1',
          default_method_id: null,
          methods: [],
        },
        methodId: null,
      },
    ]

    const result = validateAssignments(assignments)

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('1 xét nghiệm không có phương pháp')
  })

  it('returns warning with correct count for multiple method-less assignments', () => {
    const assignments = [
      {
        assay: {
          id: 'assay-1',
          name: 'Visual Inspection',
          code: 'VIS',
          specialty_id: 'qual-1',
          default_method_id: null,
          methods: [],
        },
        methodId: null,
      },
      {
        assay: {
          id: 'assay-2',
          name: 'Manual Count',
          code: 'MAN',
          specialty_id: 'qual-1',
          default_method_id: null,
          methods: [],
        },
        methodId: null,
      },
      {
        assay: {
          id: 'assay-3',
          name: 'Preliminary Test',
          code: 'PRE',
          specialty_id: 'qual-1',
          default_method_id: null,
          methods: [],
        },
        methodId: null,
      },
    ]

    const result = validateAssignments(assignments)

    expect(result.valid).toBe(true)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('3 xét nghiệm không có phương pháp')
  })
})

describe('prepareAssignmentData', () => {
  it('returns assignments without duplicates', () => {
    const assignments = [
      { assayId: 'assay-1', methodId: 'method-1' },
      { assayId: 'assay-2', methodId: 'method-2' },
    ]

    const result = prepareAssignmentData(assignments)

    expect(result).toHaveLength(2)
    expect(result).toEqual(assignments)
  })

  it('removes duplicate assignments with same assay and method', () => {
    const assignments = [
      { assayId: 'assay-1', methodId: 'method-1' },
      { assayId: 'assay-1', methodId: 'method-1' }, // Duplicate
      { assayId: 'assay-2', methodId: 'method-2' },
    ]

    const result = prepareAssignmentData(assignments)

    expect(result).toHaveLength(2)
    expect(result).toEqual([
      { assayId: 'assay-1', methodId: 'method-1' },
      { assayId: 'assay-2', methodId: 'method-2' },
    ])
  })

  it('keeps assignments with same assay but different methods', () => {
    const assignments = [
      { assayId: 'assay-1', methodId: 'method-1' },
      { assayId: 'assay-1', methodId: 'method-2' }, // Different method
    ]

    const result = prepareAssignmentData(assignments)

    expect(result).toHaveLength(2)
    expect(result).toEqual(assignments)
  })

  it('handles null methodId correctly in deduplication', () => {
    const assignments = [
      { assayId: 'assay-1', methodId: null },
      { assayId: 'assay-1', methodId: null }, // Duplicate with null
      { assayId: 'assay-2', methodId: null },
    ]

    const result = prepareAssignmentData(assignments)

    expect(result).toHaveLength(2)
    expect(result).toEqual([
      { assayId: 'assay-1', methodId: null },
      { assayId: 'assay-2', methodId: null },
    ])
  })

  it('distinguishes null methodId from actual methodId', () => {
    const assignments = [
      { assayId: 'assay-1', methodId: 'method-1' },
      { assayId: 'assay-1', methodId: null }, // Different - null vs method-1
    ]

    const result = prepareAssignmentData(assignments)

    expect(result).toHaveLength(2)
    expect(result).toEqual(assignments)
  })

  it('preserves order of first occurrence', () => {
    const assignments = [
      { assayId: 'assay-1', methodId: 'method-1' },
      { assayId: 'assay-2', methodId: 'method-2' },
      { assayId: 'assay-1', methodId: 'method-1' }, // Duplicate
      { assayId: 'assay-3', methodId: 'method-3' },
    ]

    const result = prepareAssignmentData(assignments)

    expect(result).toHaveLength(3)
    expect(result).toEqual([
      { assayId: 'assay-1', methodId: 'method-1' },
      { assayId: 'assay-2', methodId: 'method-2' },
      { assayId: 'assay-3', methodId: 'method-3' },
    ])
  })
})
