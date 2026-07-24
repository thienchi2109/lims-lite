interface DetachedHtmlDocumentOptions {
    autoPrint?: boolean
    onBlocked?: () => void
    onFailed?: () => void
}

interface PendingDetachedHtmlDocumentOptions {
    onBlocked?: () => void
    onFailed?: () => void
}

interface RenderDetachedHtmlDocumentOptions {
    autoPrint?: boolean
}

export interface PendingDetachedHtmlDocument {
    render: (html: string, options?: RenderDetachedHtmlDocumentOptions) => void
    close: () => void
}

type DetachedDocumentMessage =
    | { type: 'render'; html: string; autoPrint: boolean }
    | { type: 'close' }

const DETACHED_WINDOW_READY_TIMEOUT_MS = 5_000
const DETACHED_FRAME_LOAD_TIMEOUT_MS = 30_000

function createChannelName(): string {
    const randomId = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`

    return `detached-html-document:${randomId}`
}

function createDetachedDocumentShell(channelName: string): string {
    const serializedChannelName = JSON.stringify(channelName).replaceAll('<', '\\u003c')

    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Tài liệu</title>
    <style>
        html, body { height: 100%; margin: 0; }
        body { background: #e2e8f0; }
        [hidden] { display: none !important; }
        #status {
            display: grid;
            min-height: 100%;
            place-items: center;
            color: #334155;
            font: 16px system-ui, sans-serif;
        }
        iframe {
            width: 100%;
            height: 100%;
            border: 0;
            background: white;
        }
    </style>
</head>
<body>
    <div id="status">Đang tải tài liệu...</div>
    <iframe
        id="document-frame"
        title="Tài liệu"
        sandbox="allow-same-origin allow-modals"
        hidden
    ></iframe>
    <script>
        const channel = new BroadcastChannel(${serializedChannelName});
        const frame = document.getElementById('document-frame');
        const status = document.getElementById('status');
        let finished = false;

        const finish = (type) => {
            if (finished) return;
            finished = true;
            channel.postMessage({ type });
            channel.close();
        };

        const showLoadFailure = () => {
            status.textContent = 'Không thể tải tài liệu';
            status.hidden = false;
            frame.hidden = true;
            finish('failed');
        };

        channel.addEventListener('message', (event) => {
            const message = event.data;
            if (!message || typeof message !== 'object') return;

            if (message.type === 'close') {
                finish('completed');
                window.close();
                return;
            }

            if (message.type !== 'render' || typeof message.html !== 'string') return;

            const loadTimeoutId = window.setTimeout(
                showLoadFailure,
                ${DETACHED_FRAME_LOAD_TIMEOUT_MS},
            );

            frame.addEventListener('load', () => {
                if (finished) return;
                window.clearTimeout(loadTimeoutId);

                try {
                    if (message.autoPrint && frame.contentWindow) {
                        frame.contentWindow.focus();
                        frame.contentWindow.print();
                    }
                    finish('completed');
                } catch {
                    showLoadFailure();
                }
            }, { once: true });

            frame.srcdoc = message.html;
            status.hidden = true;
            frame.hidden = false;
        });

        window.addEventListener('pagehide', () => finish('closed'), { once: true });
        URL.revokeObjectURL(window.location.href);
        channel.postMessage({ type: 'ready' });
    </script>
</body>
</html>`
}

export function openPendingDetachedHtmlDocument(
    options: PendingDetachedHtmlDocumentOptions = {},
): PendingDetachedHtmlDocument {
    const channelName = createChannelName()
    const channel = new BroadcastChannel(channelName)
    const shellHtml = createDetachedDocumentShell(channelName)
    const objectUrl = URL.createObjectURL(
        new Blob([shellHtml], { type: 'text/html;charset=utf-8' }),
    )

    let ready = false
    let settled = false
    let closeRequested = false
    let pendingMessage: DetachedDocumentMessage | null = null
    let readyTimeoutId = 0

    const cleanup = () => {
        if (settled) return
        settled = true
        window.clearTimeout(readyTimeoutId)
        URL.revokeObjectURL(objectUrl)
        channel.close()
    }

    const flushPendingMessage = () => {
        if (!ready || settled || !pendingMessage) return
        channel.postMessage(pendingMessage)
        pendingMessage = null
    }

    channel.addEventListener('message', (event) => {
        const message = event.data
        if (!message || typeof message !== 'object') return

        if (message.type === 'ready') {
            ready = true
            window.clearTimeout(readyTimeoutId)
            URL.revokeObjectURL(objectUrl)
            flushPendingMessage()
            return
        }

        if (message.type === 'failed') {
            options.onFailed?.()
            cleanup()
            return
        }

        if (message.type === 'completed' || message.type === 'closed') {
            cleanup()
        }
    })

    readyTimeoutId = window.setTimeout(() => {
        if (!closeRequested) {
            options.onBlocked?.()
        }
        cleanup()
    }, DETACHED_WINDOW_READY_TIMEOUT_MS)

    try {
        window.open(objectUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
        cleanup()
        throw error
    }

    return {
        render(html, renderOptions = {}) {
            if (settled || closeRequested) return
            pendingMessage = {
                type: 'render',
                html,
                autoPrint: renderOptions.autoPrint ?? false,
            }
            flushPendingMessage()
        },
        close() {
            if (settled || closeRequested) return
            closeRequested = true
            pendingMessage = { type: 'close' }
            flushPendingMessage()
        },
    }
}

export function openDetachedHtmlDocument(
    html: string,
    options: DetachedHtmlDocumentOptions = {},
): PendingDetachedHtmlDocument {
    const documentSession = openPendingDetachedHtmlDocument({
        onBlocked: options.onBlocked,
        onFailed: options.onFailed,
    })
    documentSession.render(html, { autoPrint: options.autoPrint })
    return documentSession
}
