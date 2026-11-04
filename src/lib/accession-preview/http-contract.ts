// Safe row failures cross the browser boundary intact; malformed transport bodies fail closed.
import { z } from 'zod'

const location = z.strictObject({ sheet: z.string().nullable(), row: z.number().int().positive().safe().nullable(),
    column: z.string().nullable(), header: z.string().nullable(), temporaryReference: z.string().nullable() })
export const PreviewValidationResponseSchema = z.strictObject({ ok: z.literal(false), batchId: z.string().uuid(),
    errors: z.array(location.extend({ code: z.string().regex(/^[A-Z][A-Z0-9_]*$/), message: z.string(),
        relatedLocations: z.array(location).optional() })).min(1) })
