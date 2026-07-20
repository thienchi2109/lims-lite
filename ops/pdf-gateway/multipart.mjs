/**
 * Validates the exact multipart contract required by the planned LIMS CoA
 * conversion client without retaining filenames or document content.
 */
const MAX_MULTIPART_PARTS = 7
const MAX_MULTIPART_DELIMITERS = MAX_MULTIPART_PARTS + 1
const MAX_PART_HEADER_BYTES = 2_048
const RESOURCE_HTTP_ERROR_STATUS_CODES = JSON.stringify(
  Array.from({ length: 200 }, (_, index) => index + 400)
)

const EXPECTED_FIELDS = new Map([
  ['emulatedMediaType', 'print'],
  ['printBackground', 'true'],
  ['preferCssPageSize', 'true'],
  ['skipNetworkIdleEvent', 'false'],
  ['failOnResourceLoadingFailed', 'true'],
  ['failOnResourceHttpStatusCodes', RESOURCE_HTTP_ERROR_STATUS_CODES],
])

export function validateMultipartContract(body, contentType) {
  const boundary = extractBoundary(contentType)
  const delimiter = `--${boundary}`
  const segments = splitMultipartSegments(body.toString('latin1'), delimiter)

  if (segments.length < 3 || !segments.at(-1).startsWith('--')) {
    throw new MultipartContractError('Malformed multipart boundary')
  }

  const seen = new Set()
  let partCount = 0

  for (const rawSegment of segments.slice(1, -1)) {
    if (!rawSegment.startsWith('\r\n')) {
      throw new MultipartContractError('Malformed multipart part')
    }

    const segment = rawSegment.slice(2, rawSegment.endsWith('\r\n') ? -2 : undefined)
    const headerEnd = segment.indexOf('\r\n\r\n')
    if (headerEnd < 0 || headerEnd > MAX_PART_HEADER_BYTES) {
      throw new MultipartContractError('Multipart part headers are invalid')
    }

    partCount += 1
    if (partCount > MAX_MULTIPART_PARTS) {
      throw new MultipartContractError('Multipart part count exceeds limit')
    }

    const headers = parsePartHeaders(segment.slice(0, headerEnd))
    const disposition = headers.get('content-disposition')
    const part = parseContentDisposition(disposition)

    if (seen.has(part.name)) {
      throw new MultipartContractError('Duplicate multipart part')
    }
    seen.add(part.name)

    const value = Buffer.from(
      segment.slice(headerEnd + 4),
      'latin1'
    ).toString('utf8')

    if (part.name === 'files') {
      if (
        part.filename !== 'index.html' ||
        !/^text\/html(?:\s*;|$)/i.test(headers.get('content-type') ?? '') ||
        value.length === 0
      ) {
        throw new MultipartContractError('Invalid index document part')
      }
      continue
    }

    const expectedValue = EXPECTED_FIELDS.get(part.name)
    if (expectedValue === undefined || value !== expectedValue) {
      throw new MultipartContractError('Unsupported conversion field')
    }
  }

  if (
    partCount !== MAX_MULTIPART_PARTS ||
    !seen.has('files') ||
    [...EXPECTED_FIELDS.keys()].some((name) => !seen.has(name))
  ) {
    throw new MultipartContractError('Required multipart parts are missing')
  }
}

function splitMultipartSegments(body, delimiter) {
  const segments = []
  let segmentStart = 0
  let delimiterCount = 0

  while (true) {
    const delimiterIndex = body.indexOf(delimiter, segmentStart)
    if (delimiterIndex < 0) {
      break
    }

    delimiterCount += 1
    if (delimiterCount > MAX_MULTIPART_DELIMITERS) {
      throw new MultipartContractError('Multipart part count exceeds limit')
    }

    segments.push(body.slice(segmentStart, delimiterIndex))
    segmentStart = delimiterIndex + delimiter.length
  }

  segments.push(body.slice(segmentStart))
  return segments
}

function extractBoundary(contentType) {
  if (typeof contentType !== 'string') {
    throw new MultipartContractError('Content-Type must be multipart/form-data')
  }

  const match =
    /^multipart\/form-data(?:\s*;[^;]*)*;\s*boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(
      contentType
    )
  const boundary = match?.[1] ?? match?.[2]

  if (
    !boundary ||
    boundary.length > 70 ||
    !/^[A-Za-z0-9'()+_,./:=?-]+$/.test(boundary)
  ) {
    throw new MultipartContractError('Invalid multipart boundary')
  }

  return boundary
}

function parsePartHeaders(headerText) {
  const headers = new Map()

  for (const line of headerText.split('\r\n')) {
    const separatorIndex = line.indexOf(':')
    if (separatorIndex <= 0) {
      throw new MultipartContractError('Malformed multipart header')
    }

    const name = line.slice(0, separatorIndex).trim().toLowerCase()
    const value = line.slice(separatorIndex + 1).trim()
    if (headers.has(name)) {
      throw new MultipartContractError('Duplicate multipart header')
    }
    headers.set(name, value)
  }

  return headers
}

function parseContentDisposition(value) {
  if (typeof value !== 'string') {
    throw new MultipartContractError('Missing content disposition')
  }

  const nameMatch = /^form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?$/.exec(
    value
  )
  if (!nameMatch) {
    throw new MultipartContractError('Invalid content disposition')
  }

  return {
    filename: nameMatch[2],
    name: nameMatch[1],
  }
}

export class MultipartContractError extends Error {
  constructor(message) {
    super(message)
    this.name = 'MultipartContractError'
  }
}
