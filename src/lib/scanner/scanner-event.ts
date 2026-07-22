import type { ParsedClientIdentityQr } from '@/lib/qr/parse-client-identity-qr'

export type ScannerEvent =
    | {
          kind: 'identity-qr'
          identity: ParsedClientIdentityQr
      }
    | {
          kind: 'sample-code'
          code: string
      }
    | {
          kind: 'unknown'
      }

export type ScannerEventKind = ScannerEvent['kind']
