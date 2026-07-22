import type { ScannerEvent, ScannerEventKind } from './scanner-event'

export type ScannerConsumer = {
    kinds: readonly ScannerEventKind[]
    priority: number
    onEvent: (event: ScannerEvent) => void | Promise<void>
}

export type ScannerDispatcher = {
    registerConsumer: (consumer: ScannerConsumer) => () => void
    dispatch: (event: ScannerEvent) => void
}

type RegisteredScannerConsumer = {
    activationOrder: number
    kinds: ReadonlySet<ScannerEventKind>
    priority: number
    onEvent: ScannerConsumer['onEvent']
}

export function createScannerDispatcher(): ScannerDispatcher {
    const consumers = new Map<number, RegisteredScannerConsumer>()
    let activationOrder = 0

    return {
        registerConsumer(consumer) {
            activationOrder += 1
            const registrationId = activationOrder

            consumers.set(registrationId, {
                activationOrder,
                kinds: new Set(consumer.kinds),
                priority: consumer.priority,
                onEvent: consumer.onEvent,
            })

            return () => {
                consumers.delete(registrationId)
            }
        },
        dispatch(event) {
            let selectedConsumer: RegisteredScannerConsumer | undefined

            for (const consumer of consumers.values()) {
                if (!consumer.kinds.has(event.kind)) continue

                if (
                    !selectedConsumer ||
                    consumer.priority > selectedConsumer.priority ||
                    (consumer.priority === selectedConsumer.priority &&
                        consumer.activationOrder > selectedConsumer.activationOrder)
                ) {
                    selectedConsumer = consumer
                }
            }

            if (!selectedConsumer) return

            try {
                void Promise.resolve(selectedConsumer.onEvent(event)).catch(() => undefined)
            } catch {
                // Consumer failures are isolated from the scanner read loop.
            }
        },
    }
}
