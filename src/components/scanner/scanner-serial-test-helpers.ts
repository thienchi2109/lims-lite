import { vi } from 'vitest'

type MockReaderResult = {
    value?: Uint8Array
    done: boolean
}

type PendingRead = {
    reject: (reason?: unknown) => void
    resolve: (result: MockReaderResult) => void
}

export function createDeferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((promiseResolve, promiseReject) => {
        resolve = promiseResolve
        reject = promiseReject
    })

    return { promise, reject, resolve }
}

export function createMockSerialPort() {
    const queuedResults: MockReaderResult[] = []
    let pendingRead: PendingRead | null = null

    const reader = {
        read: vi.fn(() => {
            const queuedResult = queuedResults.shift()
            if (queuedResult) return Promise.resolve(queuedResult)

            return new Promise<MockReaderResult>((resolve, reject) => {
                pendingRead = { reject, resolve }
            })
        }),
        cancel: vi.fn(async () => {
            pendingRead?.resolve({ done: true })
            pendingRead = null
        }),
        releaseLock: vi.fn(),
    }

    const port = {
        readable: {
            getReader: vi.fn(() => reader),
        },
        open: vi.fn(async () => {}),
        close: vi.fn(async () => {}),
    }

    return {
        port,
        reader,
        pushChunk(value: Uint8Array) {
            if (pendingRead) {
                pendingRead.resolve({ value, done: false })
                pendingRead = null
                return
            }

            queuedResults.push({ value, done: false })
        },
        failRead(error: unknown) {
            pendingRead?.reject(error)
            pendingRead = null
        },
        finishRead() {
            if (pendingRead) {
                pendingRead.resolve({ done: true })
                pendingRead = null
                return
            }

            queuedResults.push({ done: true })
        },
    }
}

export function setNavigatorSerial(serial: unknown) {
    Object.defineProperty(window.navigator, 'serial', {
        configurable: true,
        value: serial,
    })
}
