// Safe Vietnamese errors carry coordinates, never raw profile cells or exception details.
import { SHEET_NAMES } from '../accession-template/contract'
import type { WorkbookBudget } from './budget'

export type WorkbookLocation = { sheet: string | null; row: number | null; column: string | null; header: string | null; temporaryReference: string | null }
export type WorkbookError = WorkbookLocation & { code: string; message: string; relatedLocations?: WorkbookLocation[] }
const messages: Record<string, string> = {
    ARCHIVE_INVALID: 'Tệp XLSX bị hỏng hoặc có cấu trúc ZIP không được hỗ trợ.',
    XML_INVALID: 'Nội dung XML trong tệp XLSX không hợp lệ.',
    RESOURCE_LIMIT: 'Tệp vượt giới hạn xử lý an toàn. Vui lòng chia nhỏ tệp và thử lại.',
    RESOURCE_POLICY_INVALID: 'Cấu hình xử lý tệp chưa sẵn sàng.',
    ACCESSION_TEMPLATE_CONFIGURATION_UNAVAILABLE: 'Cấu hình template trên máy chủ chưa sẵn sàng. Vui lòng liên hệ quản lý.',
    ACCESSION_TEMPLATE_CATALOG_UNAVAILABLE: 'Danh mục trên máy chủ chưa sẵn sàng. Vui lòng liên hệ quản lý.',
    ACCESSION_TEMPLATE_FILE_TOO_LARGE: 'Tệp XLSX phải nhỏ hơn 10.000.000 bytes.',
    WORKBOOK_FEATURE_UNSUPPORTED: 'Tệp có cấu trúc hoặc tính năng không được hỗ trợ. Hãy dùng template hiện hành và dán giá trị văn bản.',
    CELL_TYPE_INVALID: 'Ô phải là văn bản (Text) để giữ nguyên dữ liệu và số 0 đầu.',
    CELL_VALUE_INVALID: 'Văn bản chứa ký tự không thể lưu an toàn. Hãy sửa dữ liệu gốc và thử lại.',
    TEMPLATE_METADATA_INVALID: 'Thông tin template hoặc danh mục đã bị thay đổi. Vui lòng tải lại template.',
    TEMPLATE_VERSION_UNSUPPORTED: 'Phiên bản template không được hỗ trợ. Vui lòng tải template hiện hành.',
    CATALOG_STALE: 'Danh mục đã thay đổi. Hãy tải template mới và xem trước lại.',
    TEMPLATE_STRUCTURE_INVALID: 'Trang tính, dòng hướng dẫn hoặc tên cột không đúng template hiện hành.',
    REQUIRED_VALUE_MISSING: 'Thiếu giá trị bắt buộc. Vui lòng điền đủ thông tin.',
    VALUE_INVALID: 'Giá trị không đúng định dạng hoặc vượt độ dài cho phép của cột.',
    DATE_INVALID: 'Ngày phải có thật, dạng YYYY-MM-DD, năm 1900–2100; ví dụ 2000-02-29.',
    IDENTITY_INVALID: 'Loại và số giấy tờ phải đi cùng nhau: CCCD 12 số hoặc CMND 9 số ASCII.',
    TEMP_REFERENCE_INVALID: 'Mã tạm phải dài 1–40 ký tự, bắt đầu bằng chữ hoặc số; chỉ dùng chữ, số, dấu gạch dưới hoặc gạch ngang.',
    TEMP_REFERENCE_DUPLICATE: 'Mã tạm bị trùng. Hãy dùng mã riêng cho mỗi dòng khai báo.',
    TEMP_REFERENCE_NOT_FOUND: 'Không tìm thấy mã tạm được tham chiếu. Hãy kiểm tra cả chữ hoa và chữ thường.',
    ASSIGNMENT_DUPLICATE: 'Một mẫu chỉ được chỉ định cùng mã chỉ tiêu một lần. Hãy xóa dòng trùng.',
    ORPHAN_ROW: 'Dòng này chưa có mẫu hoặc chỉ định liên kết.',
    CATALOG_CODE_INVALID: 'Mã không có trong danh mục hợp lệ.',
    COMPATIBILITY_INVALID: 'Chỉ tiêu không được phép cho loại mẫu này. Vui lòng kiểm tra danh mục.',
}
export const emptyLocation = (): WorkbookLocation => ({ sheet: null, row: null, column: null, header: null, temporaryReference: null })
export function workbookError(code: string, location: Partial<WorkbookLocation> = {}, message?: string): WorkbookError {
    return { ...emptyLocation(), ...location, code, message: message ?? messages[code] ?? messages.WORKBOOK_FEATURE_UNSUPPORTED }
}
export class WorkbookFailure extends Error {
    readonly issue: WorkbookError
    constructor(code: string, location: Partial<WorkbookLocation> = {}) { super(code); this.issue = workbookError(code, location) }
}
export class WorkbookErrors {
    readonly errors: WorkbookError[] = []
    constructor(private readonly budget: WorkbookBudget) {}
    add(code: string, location: Partial<WorkbookLocation> = {}, message?: string, relatedLocations?: WorkbookLocation[]): void {
        this.budget.reserve(2048 + (relatedLocations?.length ?? 0) * 1024)
        this.errors.push({ ...workbookError(code, location, message), ...(relatedLocations ? { relatedLocations } : {}) })
    }
    sorted(): WorkbookError[] {
        this.budget.reserve(this.errors.length * 16)
        let comparisons = 0
        const sheet = (value: string | null) => value == null ? -1 : SHEET_NAMES.indexOf(value as typeof SHEET_NAMES[number])
        this.errors.sort((a, b) => {
            if (++comparisons % 1024 === 0) this.budget.check()
            return sheet(a.sheet) - sheet(b.sheet) || (a.row ?? 0) - (b.row ?? 0) || columnNumber(a.column) - columnNumber(b.column) || a.code.localeCompare(b.code, 'en')
        })
        this.budget.check()
        return this.errors
    }
}
export function columnNumber(column: string | null): number {
    let value = 0
    for (const letter of column ?? '') value = value * 26 + letter.charCodeAt(0) - 64
    return value
}
