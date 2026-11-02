// Memory-only v1 XLSX generation. No route, RPC access, retained files or business writes.
import 'server-only'
import * as XLSX from 'xlsx'
import { createTemplateBinding } from './binding'
import { BUSINESS_HEADERS, SHEET_NAMES, snapshotCatalogs, validateTemplateSnapshot } from './contract'

const GUIDE = [
    ['Hướng dẫn tiếp nhận mẫu bằng Excel — phiên bản 1'],
    ['Chỉ tiếp nhận mẫu mới đã lấy, chất lượng đạt. Không cập nhật mẫu cũ. Phải xem trước và xác nhận toàn bộ; có lỗi thì không nhập một phần.'],
    ['Giữ nguyên tám trang tính, tên trang, tên cột, thông tin template và danh mục. Nhập dữ liệu từ dòng 2 vào Khách hàng, Mẫu, Chỉ định; giữ tên cả các cột không bắt buộc.'],
    ['Nhập mọi giá trị dạng văn bản (Text), giữ số 0 đầu. Khi sao chép hãy dán giá trị, không dán công thức; không dùng ô số hoặc ngày của Excel.'],
    ['Ngày sinh và ngày hết hạn BHYT: ngày có thật dạng YYYY-MM-DD, năm 1900–2100; ví dụ 2000-02-29. Không dùng DD/MM/YYYY hoặc serial ngày Excel.'],
    ['Loại giấy tờ ghi chính xác CCCD hoặc CMND, đi cùng Số giấy tờ: CCCD 12 số, CMND 9 số ASCII; giữ số 0 đầu. Có thể để trống cả hai; không suy loại từ số giấy tờ.'],
    ['Họ và tên, Ngày sinh luôn bắt buộc. Giới tính (Nam, Nữ, Khác) và Số điện thoại hợp lệ bắt buộc nếu tạo mới khách hàng; 0000000000 không hợp lệ để tạo mới.'],
    ['Khi đã khớp khách hàng, Giới tính và Số điện thoại có thể trống; nếu nhập phải hợp lệ. Địa chỉ, Số BHYT, Ngày hết hạn BHYT không bắt buộc; không tự ghi đè hồ sơ đã có.'],
    ['Tên và ngày sinh không đủ chứng minh danh tính. Dùng đối sánh giấy tờ hoặc tên/ngày sinh/điện thoại theo hệ thống; hồ sơ mơ hồ hoặc xung đột phải được xử lý trước.'],
    ['Mỗi khách hàng/mẫu có mã tạm riêng trong file; tham chiếu đúng mã tạm. Mỗi mẫu thuộc một khách hàng và có chỉ định; không để dòng mồ côi hoặc chỉ định trùng.'],
    ['Chọn Mã loại mẫu, Mã chỉ tiêu trong danh mục và đúng Danh mục tương thích. Không dùng tên/phương pháp thay mã, không nhập UUID hoặc mã mẫu chính thức.'],
    ['Chỉ dùng file .xlsx do LIMS tạo, kích thước nhỏ hơn 10.000.000 bytes (thập phân); không giới hạn số khách hàng, mẫu hoặc chỉ định theo nghiệp vụ. Danh mục thay đổi thì tải template mới.'],
    ['Ví dụ giả, chỉ minh họa tại Hướng dẫn, không phải dòng import: KH-001 → M-001 → CT-000001, M-001 dùng LM-000001. Chỉ dùng mã nếu có trong danh mục tương thích của file.'],
]

// SheetJS CE ignores column numFmt. Its bundled CFB API can set OOXML column
// defaults without materializing a million empty cells or seeding business rows.
const cfb = XLSX.CFB as {
    read(data: Buffer, options: { type: 'buffer' }): unknown
    find(archive: unknown, path: string): { content?: Uint8Array } | null
    utils: { cfb_add(archive: unknown, path: string, data: Buffer): unknown }
    write(archive: unknown, options: { type: 'buffer'; fileType: 'zip'; compression: boolean }): unknown
}

function formatBusinessColumns(data: Buffer): Buffer {
    const archive = cfb.read(data, { type: 'buffer' })
    function readXml(path: string): string {
        const content = cfb.find(archive, path)?.content
        if (!(content instanceof Uint8Array)) throw new Error('ACCESSION_TEMPLATE_GENERATION_UNAVAILABLE')
        return Buffer.from(content).toString('utf8')
    }
    const styles = readXml('/xl/styles.xml')
    const formats = styles.match(/<cellXfs count="([0-9]+)">([\s\S]*?)<\/cellXfs>/g)
    if (formats?.length !== 1) throw new Error('ACCESSION_TEMPLATE_GENERATION_UNAVAILABLE')
    const [, countText, existing] = formats[0].match(/<cellXfs count="([0-9]+)">([\s\S]*?)<\/cellXfs>/)!
    const styleIndex = Number(countText)
    if (!Number.isSafeInteger(styleIndex) || styleIndex < 1 || [...existing.matchAll(/<xf\b/g)].length !== styleIndex) throw new Error('ACCESSION_TEMPLATE_GENERATION_UNAVAILABLE')
    const textFormat = `<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`
    cfb.utils.cfb_add(archive, '/xl/styles.xml', Buffer.from(styles.replace(formats[0], `<cellXfs count="${styleIndex + 1}">${existing}${textFormat}</cellXfs>`)))
    BUSINESS_HEADERS.forEach((headers, index) => {
        // ponytail: fixed v1 eight-sheet order; resolve relationships if layout becomes dynamic.
        const path = `/xl/worksheets/sheet${index + 3}.xml`
        const xml = readXml(path)
        const columns = [...xml.matchAll(/<col\b[^>]*\/>/g)]
        if (columns.length !== headers.length || columns.some(([tag], column) => !tag.includes(`min="${column + 1}" max="${column + 1}"`) || /\bstyle=/.test(tag))) throw new Error('ACCESSION_TEMPLATE_GENERATION_UNAVAILABLE')
        const updated = xml.replace(/<col\b[^>]*\/>/g, tag => tag.replace('/>', ` style="${styleIndex}"/>`))
        cfb.utils.cfb_add(archive, path, Buffer.from(updated))
    })
    const output = cfb.write(archive, { type: 'buffer', fileType: 'zip', compression: true })
    if (!Buffer.isBuffer(output)) throw new Error('ACCESSION_TEMPLATE_GENERATION_UNAVAILABLE')
    return output
}

export function assertTemplateFileSize(bytes: number): void {
    if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes >= 10_000_000) throw new Error('ACCESSION_TEMPLATE_FILE_TOO_LARGE')
}

export function generateAccessionTemplate(snapshotInput: unknown, signingConfig: unknown): Buffer {
    const snapshot = validateTemplateSnapshot(snapshotInput)
    const metadata = createTemplateBinding(snapshot, signingConfig, new Date().toISOString())
    const workbook = XLSX.utils.book_new()
    const matrices = [GUIDE, metadata, ...BUSINESS_HEADERS.map(headers => [headers]), ...snapshotCatalogs(snapshot)]
    matrices.forEach((rows, index) => {
        const sheet = XLSX.utils.aoa_to_sheet(rows.map(row => row.map(value => ({ t: 's', v: value, z: '@' }))))
        sheet['!cols'] = rows[0].map(() => ({ wch: 24 }))
        XLSX.utils.book_append_sheet(workbook, sheet, SHEET_NAMES[index])
    })
    const raw: unknown = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true, WTF: true })
    if (!Buffer.isBuffer(raw)) throw new Error('ACCESSION_TEMPLATE_GENERATION_UNAVAILABLE')
    const output = formatBusinessColumns(raw)
    assertTemplateFileSize(output.length)
    return output
}
