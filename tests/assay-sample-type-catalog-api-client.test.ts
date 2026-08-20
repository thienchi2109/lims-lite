import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

const actionNames = [
  'getAssaySampleTypeCatalogManager',
  'getPublishedAssaySampleTypeCatalog',
  'cloneAssaySampleTypeCatalogRevision',
  'updateAssaySampleTypeCatalogReview',
  'reviewAssaySampleTypeCatalogRevision',
  'publishAssaySampleTypeCatalogRevision',
] as const

describe('assay sample-type catalog API client contracts', () => {
  it('registers every Phase 3 action in the client-action bridge', () => {
    const actionTypes = read('src/lib/client-actions/types.ts')
    const route = read('src/app/api/client-actions/route.ts')

    for (const actionName of actionNames) {
      expect(actionTypes).toContain(`| '${actionName}'`)
      expect(route).toMatch(new RegExp(`\\b${actionName}\\b`))
    }
  })

  it('exports typed API client wrappers for every Phase 3 action', () => {
    const apiClient = read('src/lib/api-client.ts')

    for (const actionName of actionNames) {
      expect(apiClient).toMatch(
        new RegExp(`export function ${actionName}Client\\b`),
      )
      expect(apiClient).toContain(`'${actionName}'`)
    }
  })
})
