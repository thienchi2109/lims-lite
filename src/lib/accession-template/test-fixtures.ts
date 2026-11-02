// Synthetic authority and signing material shared by template regression tests only.
export function snapshotFixture() {
    return {
        revisionId: '10000000-0000-4000-8000-000000000001',
        revisionNumber: '9007199254740993',
        sampleTypes: [
            { id: '20000000-0000-4000-8000-000000000001', importCode: 'LM-000001', name: '=Loại mẫu', compatibilityGeneration: '9007199254740993' },
            { id: '20000000-0000-4000-8000-000000000002', importCode: 'LM-000002', name: '00002', compatibilityGeneration: '2' },
        ],
        assays: [
            { id: '30000000-0000-4000-8000-000000000001', importCode: 'CT-000001', name: '+Chỉ tiêu', methodName: '=Phương pháp', compatibilityGeneration: '3' },
            { id: '30000000-0000-4000-8000-000000000002', importCode: 'CT-000002', name: '00003', methodName: null, compatibilityGeneration: '4' },
        ],
        pairs: [
            { sampleTypeId: '20000000-0000-4000-8000-000000000001', assayDefinitionId: '30000000-0000-4000-8000-000000000001' },
            { sampleTypeId: '20000000-0000-4000-8000-000000000002', assayDefinitionId: '30000000-0000-4000-8000-000000000002' },
        ],
    }
}

export const signingFixture = () => ({ activeKeyId: 'synthetic-1', keys: { 'synthetic-1': 'a1'.repeat(32) } })
export const generatedAtFixture = '2026-11-02T07:00:00.123Z'

export function catalogFixture() {
    return [
        [['Mã loại mẫu', 'Tên loại mẫu'], ['LM-000001', '=Loại mẫu'], ['LM-000002', '00002']],
        [['Mã chỉ tiêu', 'Tên chỉ tiêu', 'Phương pháp'], ['CT-000001', '+Chỉ tiêu', '=Phương pháp'], ['CT-000002', '00003', '']],
        [['Mã loại mẫu', 'Mã chỉ tiêu'], ['LM-000001', 'CT-000001'], ['LM-000002', 'CT-000002']],
    ]
}
