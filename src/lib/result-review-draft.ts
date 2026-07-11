import type { CoAData, ResultWithAssay } from '@/types'

export function buildResultReviewDraftData(
    sampleId: string,
    results: ResultWithAssay[],
): CoAData {
    const firstResult = results[0]

    return {
        sample: {
            id: sampleId,
            sample_id_display: firstResult?.sample_id_display || sampleId,
            approved_by: null,
            approved_at: null,
            client_name: firstResult?.client_name || undefined,
            sample_type: firstResult?.sample_type || undefined,
            received_date: firstResult?.received_date || undefined,
            client_dob: firstResult?.client_dob,
            client_gender: firstResult?.client_gender,
            client_address: firstResult?.client_address,
            client_health_insurance_num: firstResult?.client_health_insurance_num,
        },
        results: results.map((result) => ({
            result_id: result.id,
            assay_name: result.assay_name,
            value: result.value,
            unit: result.assay_units,
            normal_range: result.normal_range,
            method_name: result.method_name,
            lab_specialty_name: result.lab_specialty_name || null,
        })),
        approverName: '',
        approverSignature: null,
        signatureId: null,
        approvalDate: '',
        testingDate: firstResult?.entered_at || undefined,
    }
}
