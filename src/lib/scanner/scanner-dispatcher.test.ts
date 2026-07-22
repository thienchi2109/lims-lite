import { describe, expect, it, vi } from 'vitest'

import type { ScannerEvent } from './scanner-event'
import { createScannerDispatcher } from './scanner-dispatcher'

const sampleEvent: ScannerEvent = {
    kind: 'sample-code',
    code: 'CDC-XN-22072026-0001',
}

const identityEvent: ScannerEvent = {
    kind: 'identity-qr',
    identity: {
        idCardNum: '086094006827',
        name: 'Nguyễn Thiện Chí',
        dateOfBirth: '1994-09-21',
        gender: 'Nam',
        address: 'Cần Thơ',
    },
}

describe('createScannerDispatcher', () => {
    it('delivers an event only to the highest-priority eligible consumer', () => {
        const dispatcher = createScannerDispatcher()
        const ineligible = vi.fn()
        const lowerPriority = vi.fn()
        const highestPriority = vi.fn()

        dispatcher.registerConsumer({
            kinds: ['identity-qr'],
            priority: 999,
            onEvent: ineligible,
        })
        dispatcher.registerConsumer({
            kinds: ['sample-code'],
            priority: 100,
            onEvent: lowerPriority,
        })
        dispatcher.registerConsumer({
            kinds: ['sample-code', 'unknown'],
            priority: 200,
            onEvent: highestPriority,
        })

        dispatcher.dispatch(sampleEvent)

        expect(highestPriority).toHaveBeenCalledOnce()
        expect(highestPriority).toHaveBeenCalledWith(sampleEvent)
        expect(lowerPriority).not.toHaveBeenCalled()
        expect(ineligible).not.toHaveBeenCalled()
    })

    it('uses the most recently activated consumer to break an equal-priority tie', () => {
        const dispatcher = createScannerDispatcher()
        const firstConsumer = vi.fn()
        const recentConsumer = vi.fn()

        dispatcher.registerConsumer({
            kinds: ['sample-code'],
            priority: 100,
            onEvent: firstConsumer,
        })
        dispatcher.registerConsumer({
            kinds: ['sample-code'],
            priority: 100,
            onEvent: recentConsumer,
        })

        dispatcher.dispatch(sampleEvent)

        expect(recentConsumer).toHaveBeenCalledOnce()
        expect(firstConsumer).not.toHaveBeenCalled()
    })

    it('stops delivery after unregistering a consumer', () => {
        const dispatcher = createScannerDispatcher()
        const onEvent = vi.fn()
        const unregister = dispatcher.registerConsumer({
            kinds: ['sample-code'],
            priority: 100,
            onEvent,
        })

        unregister()
        unregister()
        dispatcher.dispatch(sampleEvent)

        expect(onEvent).not.toHaveBeenCalled()
    })

    it('is a no-op when no consumer accepts the event', () => {
        const dispatcher = createScannerDispatcher()
        const onEvent = vi.fn()

        dispatcher.registerConsumer({
            kinds: ['identity-qr'],
            priority: 100,
            onEvent,
        })

        expect(() => dispatcher.dispatch(sampleEvent)).not.toThrow()
        expect(onEvent).not.toHaveBeenCalled()
    })

    it('isolates synchronous consumer failures and remains usable', () => {
        const dispatcher = createScannerDispatcher()
        const unregister = dispatcher.registerConsumer({
            kinds: ['sample-code'],
            priority: 100,
            onEvent: () => {
                throw new Error('consumer failed')
            },
        })

        expect(() => dispatcher.dispatch(sampleEvent)).not.toThrow()

        unregister()
        const healthyConsumer = vi.fn()
        dispatcher.registerConsumer({
            kinds: ['sample-code'],
            priority: 100,
            onEvent: healthyConsumer,
        })
        dispatcher.dispatch(sampleEvent)

        expect(healthyConsumer).toHaveBeenCalledOnce()
    })

    it('handles asynchronous rejection without logging sensitive data', async () => {
        const dispatcher = createScannerDispatcher()
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const rawIdentityPayload =
            '086094006827|331757192|Nguyễn Thiện Chí|21091994|Nam|Cần Thơ|10052021'
        const unregister = dispatcher.registerConsumer({
            kinds: ['identity-qr'],
            priority: 300,
            onEvent: async () => {
                throw new Error(rawIdentityPayload)
            },
        })

        expect(() => dispatcher.dispatch(identityEvent)).not.toThrow()
        await Promise.resolve()
        await Promise.resolve()

        expect(consoleError).not.toHaveBeenCalled()
        expect(consoleWarn).not.toHaveBeenCalled()

        unregister()
        const healthyConsumer = vi.fn()
        dispatcher.registerConsumer({
            kinds: ['identity-qr'],
            priority: 300,
            onEvent: healthyConsumer,
        })
        dispatcher.dispatch(identityEvent)

        expect(healthyConsumer).toHaveBeenCalledOnce()
    })

    it('never delivers one event to multiple consumers', () => {
        const dispatcher = createScannerDispatcher()
        const consumers = [vi.fn(), vi.fn(), vi.fn()]

        consumers.forEach((onEvent, index) => {
            dispatcher.registerConsumer({
                kinds: ['sample-code'],
                priority: index,
                onEvent,
            })
        })

        dispatcher.dispatch(sampleEvent)

        expect(consumers.reduce((total, consumer) => total + consumer.mock.calls.length, 0)).toBe(1)
    })
})
