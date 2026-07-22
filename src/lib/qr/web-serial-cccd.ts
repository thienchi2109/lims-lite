export {
    DEFAULT_SCANNER_SERIAL_BAUD_RATE as DEFAULT_CCCD_SERIAL_BAUD_RATE,
    DEFAULT_SCANNER_SERIAL_IDLE_TIMEOUT_MS as DEFAULT_CCCD_SERIAL_IDLE_TIMEOUT_MS,
    createScannerSerialFrameDecoder as createCccdSerialFrameDecoder,
    getGrantedSerialPorts,
    getWebSerialApi,
    isWebSerialSupported,
    sanitizeScannerPayload as sanitizeCccdSerialPayload,
    type BrowserSerialLike,
    type BrowserSerialPortLike,
    type BrowserSerialReaderLike,
} from '@/lib/scanner/web-serial-scanner'
