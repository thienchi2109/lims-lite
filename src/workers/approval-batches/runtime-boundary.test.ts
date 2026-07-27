import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const workerDirectory = resolve(
  process.cwd(),
  'src/workers/approval-batches'
)
const productionSources = readdirSync(workerDirectory)
  .filter((fileName) => fileName.endsWith('.ts') && !fileName.endsWith('.test.ts'))
  .map((fileName) => ({
    fileName,
    source: readFileSync(join(workerDirectory, fileName), 'utf8'),
  }))

describe('approval batch worker runtime boundary', () => {
  test('does not import web request, session, auth, or Supabase client code', () => {
    const combinedSource = productionSources
      .map(({ source }) => source)
      .join('\n')

    expect(combinedSource).not.toMatch(
      /from ['"](?:next|@\/app|@\/lib\/supabase|.*\/app\/|.*\/manager-email-otp)/
    )
    expect(combinedSource).not.toMatch(
      /cookies\(|headers\(|createClient\(|createAdminClient\(|getUser\(|getSession\(/
    )
  })

  test('contains no manager token or OTP configuration surface', () => {
    const combinedSource = productionSources
      .map(({ source }) => source)
      .join('\n')

    expect(combinedSource).not.toMatch(
      /MANAGER.*(?:JWT|OTP|TOKEN)|SERVICE_ROLE_KEY|ANON_KEY|ACCESS_TOKEN|REFRESH_TOKEN/
    )
  })

  test('keeps SQL access behind claim, execute, and readiness calls', () => {
    const adapter = productionSources.find(
      ({ fileName }) => fileName === 'postgres-adapter.ts'
    )?.source

    expect(adapter).toBeDefined()
    expect(adapter).toContain('claim_approval_batch_items_worker($1, $2)')
    expect(adapter).toContain('execute_approval_batch_item_worker($1, $2)')
    expect(adapter).toContain('SELECT 1 AS ready')
    expect(adapter).not.toMatch(
      /\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+)?public\./i
    )
    expect(adapter).not.toMatch(
      /\bFROM\s+public\.approval_(?:batches|batch_items|batch_item_attempts)\b/i
    )
  })
})
