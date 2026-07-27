/**
 * JSON-line logging with an explicit allow-list of privacy-safe fields.
 */
import type { PrivacySafeLogger } from './contracts'

interface LoggerOptions {
  workerInstanceId: string
  write?: (line: string) => void
}

export function createPrivacySafeLogger({
  workerInstanceId,
  write = console.log,
}: LoggerOptions): PrivacySafeLogger {
  return {
    log(entry) {
      const output: Record<string, number | string> = {
        event: entry.event,
        level: entry.level,
        timestamp: new Date().toISOString(),
        workerInstanceId,
      }

      copyNumber(output, 'attemptNumber', entry.attemptNumber)
      copyString(output, 'batchItemId', entry.batchItemId)
      copyNumber(output, 'claimCount', entry.claimCount)
      copyNumber(output, 'durationMs', entry.durationMs)
      copyNumber(output, 'inFlight', entry.inFlight)
      copyString(output, 'outcomeCode', entry.outcomeCode)

      write(JSON.stringify(output))
    },
  }
}

export function classifyDatabaseError(error: unknown): string {
  const code = readErrorCode(error)
  if (code === '57014' || hasTimeoutMessage(error)) {
    return 'DATABASE_TIMEOUT'
  }
  if (
    code?.startsWith('08') ||
    code === '57P01' ||
    code === '57P02' ||
    code === '57P03'
  ) {
    return 'DATABASE_UNAVAILABLE'
  }
  return 'DATABASE_OPERATION_FAILED'
}

function copyNumber(
  target: Record<string, number | string>,
  key: string,
  value: number | undefined
) {
  if (value !== undefined) {
    target[key] = value
  }
}

function copyString(
  target: Record<string, number | string>,
  key: string,
  value: string | undefined
) {
  if (value !== undefined) {
    target[key] = value
  }
}

function readErrorCode(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code
  }
  return undefined
}

function hasTimeoutMessage(error: unknown) {
  return error instanceof Error && /timeout/i.test(error.message)
}
