# sample-management Specification

## Purpose
TBD - created by archiving change consolidate-samples-pages. Update Purpose after archive.
## Requirements
### Requirement: Unified samples workspace with role-aware permissions

The system SHALL provide a unified samples workspace at `/samples` that:
- Authenticates users and determines role server-side
- Uses TanStack Query for client-side data fetching (both roles)
- Enforces role-specific permissions for actions
- Redirects legacy routes (`/analyst/samples`, `/manager/samples`) transparently

**Context:** Currently, manager samples page uses TanStack Query (migrated Dec 7, 2025), while analyst samples page still uses legacy server-side rendering. This creates maintenance burden and feature parity gaps.

**Objective:** Create a single `/samples` workspace that serves both analyst and manager roles with TanStack Query-based data fetching and role-specific permissions.

#### Scenario: Analyst accesses unified workspace

**GIVEN** an authenticated user with analyst role  
**WHEN** the user navigates to `/analyst/samples` or `/samples`  
**THEN** the system SHALL:
- Redirect from `/analyst/samples` to `/samples` preserving query parameters
- Load the samples list via `useSamples` TanStack Query hook
- Load sample detail via `useSampleDetail` TanStack Query hook
- Display filters: search, status, date range, sort, pagination
- Enable actions: Edit (status=received), Enter Results (status=assigned/in_progress)
- Hide manager-only actions: Reject, Ignore
- Show back link to `/analyst` dashboard
- Auto-refresh data on mutations without manual browser refresh

#### Scenario: Manager accesses unified workspace

**GIVEN** an authenticated user with manager role  
**WHEN** the user navigates to `/manager/samples` or `/samples`  
**THEN** the system SHALL:
- Redirect from `/manager/samples` to `/samples` preserving query parameters
- Load the samples list via `useSamples` TanStack Query hook
- Load sample detail via `useSampleDetail` TanStack Query hook
- Display filters: search, status, date range, receiver, sort, pagination
- Enable actions: View Results (all statuses), Reject/Ignore (status=received/assigned)
- Hide analyst-only actions: Enter Results
- Show back link to `/manager` dashboard
- Auto-refresh data on mutations without manual browser refresh

#### Scenario: Permissions enforcement

**GIVEN** the unified `/samples` workspace is loaded  
**WHEN** actions are rendered based on user role  
**THEN** the system SHALL:
- Build permissions object server-side based on authenticated user role
- Pass permissions to `SamplesPageClient` as prop
- Gate UI actions by permissions (not route path)
- Enforce permissions server-side via RLS policies (defense in depth)
- Log any permission violations for audit trail

#### Scenario: Legacy route redirection

**GIVEN** a user with bookmarked URL to `/analyst/samples?page=2&status=received`  
**WHEN** the user opens the bookmark  
**THEN** the system SHALL:
- Authenticate user and verify role
- Redirect to `/samples?page=2&status=received` (query preserved)
- Load page with same filters and pagination state
- Maintain user context without data loss

#### Scenario: Auto-refresh after mutation

**GIVEN** a user has assigned tests to a sample  
**WHEN** the assignment completes successfully  
**THEN** the system SHALL:
- Invalidate TanStack Query cache for samples list
- Automatically refetch fresh data
- Navigate to page 1 of samples list
- Sort by `updated_at` DESC to show recently modified sample at top
- Update status badge in detail panel without manual refresh
- All behavior consistent for both analyst and manager roles

#### Scenario: Data consistency across tabs

**GIVEN** a user has `/samples` open in two browser tabs  
**WHEN** the user performs an action in Tab A that modifies a sample  
**AND** switches focus to Tab B  
**THEN** the system SHALL:
- Trigger window focus refetch in Tab B (TanStack Query default behavior)
- Update Tab B with latest data from server
- Synchronize sample list and detail panels
- Show consistent state across all tabs

### Requirement: Analyst can filter assays by specialty during assignment

The system SHALL allow analysts to quickly filter available assay definitions by “Nhóm xét nghiệm” when assigning tests in the accession workflow.

#### Scenario: Analyst filters tests by specialty

- **GIVEN** an authenticated analyst is on `/analyst/accession` and viewing the Test Assignment Grid  
- **WHEN** the analyst selects a specific specialty from the “Nhóm xét nghiệm” filter  
- **THEN** the grid SHALL request assays filtered server-side by that specialty  
- **AND** only assays linked to the selected specialty SHALL be displayed  
- **AND** the specialty badge SHALL be shown per assay row  
- **AND** any tests already selected SHALL remain selected even if they are not visible under the filter.

#### Scenario: Analyst clears the specialty filter

- **GIVEN** the “Nhóm xét nghiệm” filter is set to a specific specialty  
- **WHEN** the analyst selects “Tất cả nhóm xét nghiệm”  
- **THEN** the grid SHALL display assays from all specialties (including assays with no specialty).

### Requirement: Manager approval queue tab switching SHALL use cached TanStack Query state

The system SHALL load manager approval queue rows for `review` and `completed` through TanStack Query query keys that include the active tab, so switching tabs can reuse cached data instead of forcing a full route refresh for the queue list.

#### Scenario: Switching back to a previously loaded tab reuses cached rows

- **WHEN** a manager has already loaded both approval queue tabs in the current session
- **THEN** switching back to a previously viewed tab SHALL render cached rows immediately
- **AND** the system SHALL allow a background refetch without blanking the queue list
- **AND** the tab switch SHALL NOT depend on a full server route navigation just to show the list for the target tab

#### Scenario: The opposite tab is prefetched on likely intent

- **WHEN** a manager lands on the approval queue or signals intent to open the opposite tab
- **THEN** the system SHALL prefetch the opposite tab queue using a distinct approval queue query key
- **AND** the next tab switch SHALL reuse that prefetched data when it is still fresh

#### Scenario: Deep-link tab state survives hydration and refresh

- **WHEN** a manager opens `/manager/approvals?tab=completed` directly or refreshes that URL
- **THEN** the system SHALL hydrate the `completed` queue on initial load
- **AND** subsequent client-side tab switches SHALL keep the `tab` query parameter synchronized with the active tab

#### Scenario: Switching tabs clears stale sample selection

- **WHEN** a manager switches to a different approval tab and the current `sampleId` does not exist in that tab's queue
- **THEN** the system SHALL clear `sampleId` from the URL
- **AND** the system SHALL clear the related detail state instead of keeping a sample outside the active queue
- **AND** desktop and mobile SHALL apply the same rule

#### Scenario: Desktop and mobile preserve the same tab semantics

- **WHEN** a manager switches approval queue tabs on desktop or mobile breakpoint
- **THEN** the system SHALL apply the same rules for URL synchronization, cached queue reuse, and empty/error states
- **AND** breakpoint changes SHALL NOT introduce a different tab selection contract for the same URL

#### Scenario: Hidden layout does not duplicate queue side effects

- **WHEN** the approval page renders responsive desktop/mobile layouts around the same URL
- **THEN** only the viewport-active queue owner SHALL drive approval queue query, prefetch, and tab URL synchronization side effects
- **AND** hidden layouts SHALL NOT trigger duplicate fetch/prefetch behavior for the same tab switch

#### Scenario: Fetch failure is isolated to the active tab

- **WHEN** loading the active approval tab fails
- **THEN** the system SHALL show a Vietnamese error state for that tab
- **AND** the system SHALL preserve cached rows for the other tab until that tab is opened

### Requirement: Authorized users can filter Samples to confidential-associated samples

The Samples workspace SHALL provide an explicit confidential-only list filter for users whose authenticated dashboard session has `canAccessConfidential = true`.

#### Scenario: Authorized user sees confidential filter control

- **GIVEN** an authenticated analyst or manager has `canAccessConfidential = true`
- **WHEN** the user opens the Samples workspace
- **THEN** the filter toolbar SHALL render a control labeled "Mẫu nhạy cảm"
- **AND** the control SHALL be available alongside existing scope, sort, page-size, and advanced filter controls.

#### Scenario: Authorized user enables confidential-only filtering

- **GIVEN** an authenticated analyst or manager has `canAccessConfidential = true`
- **WHEN** the user enables the "Mẫu nhạy cảm" filter
- **THEN** the URL SHALL represent the confidential-only state
- **AND** the Samples query SHALL request only samples that contain at least one result linked to a confidential assay
- **AND** pagination totals SHALL be calculated from that confidential-only row set.

#### Scenario: Confidential-only filter preserves active sample default

- **GIVEN** an authenticated user has `canAccessConfidential = true`
- **AND** no explicit `scope=all` or `status` filter is selected
- **WHEN** the user enables the "Mẫu nhạy cảm" filter
- **THEN** completed samples SHALL remain hidden by the existing active-scope default
- **AND** only active confidential-associated samples SHALL be returned.

#### Scenario: Authorized user combines confidential-only with all-scope filtering

- **GIVEN** an authenticated user has `canAccessConfidential = true`
- **WHEN** the user enables both "Mẫu nhạy cảm" and "Hiển thị tất cả"
- **THEN** the Samples list SHALL include confidential-associated samples across all statuses allowed by the remaining filters
- **AND** non-confidential samples SHALL be excluded.

### Requirement: Unauthorized users cannot discover confidential-associated samples through the confidential-only filter

The Samples workspace and Samples list query SHALL keep confidential-associated samples non-discoverable for users whose authenticated session does not have confidential access.

#### Scenario: Unauthorized user does not see confidential filter control

- **GIVEN** an authenticated user has `canAccessConfidential = false`
- **WHEN** the user opens the Samples workspace
- **THEN** the filter toolbar SHALL NOT render the "Mẫu nhạy cảm" control.

#### Scenario: Unauthorized URL tampering returns no confidential rows or counts

- **GIVEN** an authenticated user has `canAccessConfidential = false`
- **WHEN** the user manually opens a Samples URL with the confidential-only query state
- **THEN** the Samples list query SHALL return no confidential-associated rows
- **AND** the returned total count SHALL NOT reveal the number of confidential-associated samples.

#### Scenario: Unauthorized default list remains non-discoverable

- **GIVEN** an authenticated user has `canAccessConfidential = false`
- **WHEN** the user opens the Samples workspace without the confidential-only query state
- **THEN** confidential-associated samples SHALL remain absent from rows and totals
- **AND** all existing non-confidential Samples filters SHALL continue to work.

### Requirement: Confidential-only Samples filtering is enforced server-side

The system SHALL enforce confidential-only Samples filtering inside the database-backed list path before counting, sorting, and pagination.

#### Scenario: Confidential-only query uses database predicate

- **WHEN** the Samples list is requested with confidential-only filtering enabled
- **THEN** `get_samples_page` SHALL apply the confidential-associated-sample predicate before computing `total_count`
- **AND** the application SHALL NOT rely on client-side filtering or post-pagination filtering to remove non-confidential rows.

#### Scenario: Normal and confidential-only list states use separate cache identities

- **WHEN** a user toggles the "Mẫu nhạy cảm" filter
- **THEN** the Samples query key SHALL distinguish confidential-only results from normal Samples results
- **AND** previously cached normal-list rows SHALL NOT be reused as the confidential-only list payload.

### Requirement: Analyst must select sample quality during accession

Hệ thống SHALL yêu cầu analyst đánh giá chất lượng của mỗi mẫu mới bằng đúng một trong hai giá trị `Đạt` hoặc `Không đạt` trong luồng `/analyst/accession`.

#### Scenario: Desktop displays the required quality choices below sample type

- **WHEN** analyst mở form tiếp nhận mẫu trên desktop
- **THEN** hệ thống SHALL hiển thị nhãn `Chất lượng mẫu` ngay dưới trường `Loại mẫu`
- **AND** hệ thống SHALL hiển thị hai Shadcn `Checkbox` có nhãn `Đạt` và `Không đạt`
- **AND** hệ thống SHALL hiển thị trực tiếp hai lựa chọn thay vì dùng dropdown/select
- **AND** không checkbox nào SHALL được chọn mặc định.

#### Scenario: Mobile displays the required quality choices below sample type

- **WHEN** analyst mở bước thông tin mẫu trong mobile accession wizard
- **THEN** hệ thống SHALL hiển thị `Chất lượng mẫu` ngay dưới `Loại mẫu` và trước `Thời gian nhận`
- **AND** hệ thống SHALL dùng cùng hai lựa chọn Shadcn `Checkbox` như desktop.

#### Scenario: Selecting one quality clears the other

- **WHEN** analyst chọn `Đạt` trong khi `Không đạt` đang được chọn
- **THEN** hệ thống SHALL chọn `Đạt` và bỏ chọn `Không đạt`
- **AND** hành vi tương tự SHALL áp dụng khi analyst chọn `Không đạt`.

#### Scenario: Missing quality blocks accession

- **WHEN** analyst chưa chọn `Đạt` hoặc `Không đạt`
- **THEN** hệ thống SHALL không cho lưu mẫu trên desktop
- **AND** hệ thống SHALL không cho xác nhận lưu trong mobile accession wizard
- **AND** submit validation SHALL trả về thông báo tiếng Việt cho trường bắt buộc.

#### Scenario: Mobile review shows the selected quality

- **WHEN** analyst đã chọn chất lượng và chuyển đến bước rà soát mobile
- **THEN** hệ thống SHALL hiển thị lại giá trị `Đạt` hoặc `Không đạt` trước khi analyst xác nhận.

### Requirement: Sample quality must persist through every accession path

Hệ thống SHALL truyền, xác thực và lưu `sample_quality` cho cả mẫu không có xét nghiệm và mẫu được tạo kèm chỉ định xét nghiệm.

#### Scenario: Accession without tests stores acceptable quality

- **WHEN** analyst chọn `Đạt` và tiếp nhận mẫu không có xét nghiệm
- **THEN** mẫu mới SHALL được lưu với `sample_quality = TRUE`
- **AND** trạng thái mẫu SHALL tiếp tục tuân theo workflow không có xét nghiệm hiện tại.

#### Scenario: Accession without tests stores unacceptable quality

- **WHEN** analyst chọn `Không đạt` và tiếp nhận mẫu không có xét nghiệm
- **THEN** mẫu mới SHALL được lưu với `sample_quality = FALSE`
- **AND** mẫu SHALL vẫn được tạo theo workflow không có xét nghiệm hiện tại
- **AND** hệ thống SHALL không tự động loại bỏ mẫu hoặc yêu cầu lý do.

#### Scenario: Accession with tests stores acceptable quality

- **WHEN** analyst chọn `Đạt` và tiếp nhận mẫu có các xét nghiệm đã chọn
- **THEN** mẫu mới SHALL được lưu với `sample_quality = TRUE`
- **AND** các xét nghiệm SHALL được tạo và gán theo workflow hiện tại.

#### Scenario: Accession with tests stores unacceptable quality

- **WHEN** analyst chọn `Không đạt` và tiếp nhận mẫu có các xét nghiệm đã chọn
- **THEN** mẫu mới SHALL được lưu với `sample_quality = FALSE`
- **AND** các xét nghiệm SHALL vẫn được tạo và gán theo workflow hiện tại
- **AND** trạng thái mẫu hoặc result SHALL không bị thay đổi chỉ vì chất lượng là `Không đạt`.

#### Scenario: Server contract rejects a missing quality value

- **WHEN** client gửi một trong hai mutation tiếp nhận mẫu mà không có `sample_quality`
- **THEN** Zod và Server Action contract SHALL từ chối payload
- **AND** không mẫu hoặc result nào SHALL được tạo.

#### Scenario: Database contract rejects a missing quality value for new samples

- **WHEN** một caller cố tạo mẫu mới mà không cung cấp chất lượng sau khi rollout enforcement hoàn tất
- **THEN** database SHALL từ chối INSERT
- **AND** caller SHALL không thể dùng RPC signature cũ để bỏ qua yêu cầu.

### Requirement: Sample quality must preserve historical truth and audit controls

Hệ thống SHALL giữ dữ liệu lịch sử không bị suy diễn và SHALL ghi nhận đánh giá chất lượng mới trong audit trail hiện có.

#### Scenario: Existing samples remain unassessed

- **WHEN** migration thêm `sample_quality` được áp dụng
- **THEN** các mẫu tồn tại trước migration SHALL giữ `sample_quality = NULL`
- **AND** migration SHALL không backfill hoặc đặt default cho các bản ghi đó.

#### Scenario: New sample audit log includes quality

- **WHEN** một mẫu mới được tạo với chất lượng `Đạt` hoặc `Không đạt`
- **THEN** audit log INSERT của mẫu SHALL chứa giá trị `sample_quality`
- **AND** `changed_by` SHALL tiếp tục nhận diện analyst thực hiện tiếp nhận.

#### Scenario: Accession authorization remains unchanged

- **WHEN** caller không phải analyst cố gọi RPC tiếp nhận mẫu
- **THEN** hệ thống SHALL từ chối thao tác như contract hiện tại
- **AND** migration SHALL giữ fixed `search_path`, RLS behavior và quyền execute tối thiểu của các `SECURITY DEFINER` RPC.

### Requirement: CCCD scanning remains the primary entry path

Address autocomplete SHALL be secondary to successful CCCD scanning and SHALL
not delay or overwrite newer scanner-owned form state.

#### Scenario: CCCD scan succeeds

- **WHEN** a valid supported scan supplies client data
- **THEN** the scan SHALL populate the draft through the existing flow
- **AND** stale autocomplete work SHALL not overwrite the scanned address

#### Scenario: Scanner is unavailable

- **WHEN** scanning is unavailable or fails
- **THEN** the analyst SHALL still be able to use autocomplete or manual entry

### Requirement: Existing client address persistence is preserved

The integration SHALL use the existing client address field and existing
authorized mutation. It SHALL not add structured-address columns or change
current client audit and RLS controls.

#### Scenario: Suggested address is saved

- **WHEN** an analyst selects a suggestion and saves a valid client
- **THEN** the formatted text SHALL be persisted in the existing address field
- **AND** existing authorization, RLS, and audit behavior SHALL apply

#### Scenario: Manual address is saved

- **WHEN** the analyst enters address text manually
- **THEN** the existing mutation SHALL accept it under current validation and
  authorization rules

### Requirement: Address-service failure does not block accession

Client creation and sample accession SHALL remain available when the address
service or Tailscale path is unavailable.

#### Scenario: Lookup fails

- **WHEN** the service times out, is unreachable, is not ready, or returns an
  invalid payload
- **THEN** the form SHALL preserve current user input and allow manual entry
- **AND** the analyst SHALL still be able to continue when existing required
  fields are valid

#### Scenario: Service recovers

- **WHEN** a later lookup succeeds
- **THEN** suggestions MAY resume
- **AND** SHALL not replace text already owned by a newer scan or user edit

### Requirement: Mẫu tham chiếu loại mẫu chuẩn

Mẫu mới SHALL lưu `sample_type_id` tham chiếu loại mẫu active. Hợp đồng đọc SHALL trả UUID, mã và tên loại mẫu; cột text legacy chỉ là projection tương thích và không được mâu thuẫn với master data.

#### Scenario: Tiếp nhận mẫu với loại mẫu hợp lệ

- **WHEN** Analyst chọn một loại mẫu active và tạo mẫu
- **THEN** hệ thống SHALL lưu định danh loại mẫu chuẩn
- **AND** response SHALL trả mã và tên tiếng Việt hiện hành

#### Scenario: Loại mẫu không tồn tại hoặc đã xóa mềm

- **WHEN** caller gửi định danh/mã loại mẫu không hợp lệ
- **THEN** tạo mẫu SHALL thất bại
- **AND** hệ thống SHALL không fallback sang text tự do

#### Scenario: Backfill mẫu lịch sử

- **WHEN** migration ánh xạ mẫu lịch sử sang master data
- **THEN** mỗi mẫu SHALL nhận đúng một `sample_type_id`
- **AND** `samples.type` SHALL tiếp tục khớp tên loại mẫu trong giai đoạn tương thích

### Requirement: Picker chỉ hiển thị chỉ tiêu tương thích

Sau khi người dùng chọn loại mẫu, accession desktop/mobile và module gán bổ sung SHALL tải chỉ tiêu từ revision published hiện hành và chỉ hiển thị pair hợp lệ, không stale.

#### Scenario: Chọn loại mẫu

- **WHEN** Analyst chọn loại mẫu trong accession
- **THEN** picker SHALL tải các chỉ tiêu compatible cùng revision number
- **AND** chỉ tiêu không compatible hoặc stale SHALL không xuất hiện

#### Scenario: Đổi loại mẫu sau khi đã chọn chỉ tiêu

- **WHEN** Analyst đổi sang loại mẫu khác
- **THEN** selection không còn compatible SHALL bị loại khỏi form
- **AND** UI SHALL thông báo bằng tiếng Việt rằng danh sách chỉ tiêu đã được cập nhật

#### Scenario: Catalog đổi trước submit

- **WHEN** UI submit với revision không còn hiện hành
- **THEN** server SHALL từ chối toàn bộ thao tác
- **AND** UI SHALL yêu cầu tải lại catalog, không tự submit lại theo revision mới

### Requirement: Mọi đường tạo chỉ định dùng cùng validator database

Các RPC assignment v2 thay thế `accession_and_assign_tests`/`assign_tests_to_sample` SHALL gọi cùng resolver fail-closed trong transaction. Contract cũ SHALL chỉ tồn tại trong cửa sổ chuyển đổi và SHALL bị retire trước khi enforcement hoàn tất. Mọi INSERT production vào `results` SHALL được trigger bảo vệ; client-side filtering SHALL không thay thế enforcement ở database.

#### Scenario: Tiếp nhận kèm nhiều chỉ định hợp lệ

- **WHEN** mọi pair trong payload hợp lệ theo cùng revision
- **THEN** sample và toàn bộ result SHALL được tạo nguyên tử
- **AND** response SHALL ghi revision đã dùng

#### Scenario: Một pair trong batch nhỏ không hợp lệ

- **WHEN** payload có ít nhất một chỉ tiêu missing, incompatible hoặc stale
- **THEN** toàn bộ thao tác SHALL rollback
- **AND** không sample, result hoặc audit một phần nào được giữ lại

#### Scenario: Gán bổ sung cho mẫu hiện có

- **WHEN** Analyst hoặc Quản lý gán thêm chỉ tiêu
- **THEN** database SHALL resolve theo loại mẫu hiện tại của mẫu
- **AND** cặp không hợp lệ SHALL bị từ chối trước khi INSERT

#### Scenario: Ghi trực tiếp bỏ qua RPC

- **WHEN** một role có đường ghi cố INSERT result không qua RPC
- **THEN** trigger SHALL thực thi cùng compatibility check
- **AND** RLS/grants hiện có SHALL vẫn là lớp bảo vệ bổ sung

#### Scenario: Chuyển đổi contract không làm hỏng app cũ

- **WHEN** migration additive tạo RPC v2
- **THEN** RPC cũ SHALL tiếp tục hoạt động trong cửa sổ chuyển đổi
- **AND** ứng dụng v2 SHALL được deploy/smoke trước khi migration enforcement retire RPC cũ

### Requirement: Loại mẫu bất biến sau chỉ định đầu tiên

Khi mẫu đã có ít nhất một result, `sample_type_id` và projection `type` SHALL không được thay đổi trực tiếp. Mẫu chưa có result MAY đổi sang loại mẫu active qua mutation có quyền và audit.

#### Scenario: Sửa loại mẫu trước khi gán chỉ tiêu

- **WHEN** người có quyền đổi loại mẫu của sample chưa có result
- **THEN** mutation SHALL thành công nếu loại mẫu mới active
- **AND** audit SHALL ghi before/after

#### Scenario: Sửa loại mẫu sau khi đã gán chỉ tiêu

- **WHEN** caller cố đổi loại mẫu của sample đã có result
- **THEN** database SHALL từ chối
- **AND** chỉ định và loại mẫu lịch sử SHALL giữ nguyên

### Requirement: Chỉ định lịch sử không bị diễn giải lại

Enforcement mới SHALL áp dụng cho INSERT result mới, không xóa, sửa trạng thái hoặc đánh dấu invalid các result đã tồn tại trước publication/enforcement.

#### Scenario: Catalog đầu tiên được publish

- **WHEN** revision đầu tiên trở thành hiện hành
- **THEN** mọi result lịch sử SHALL giữ nguyên dữ liệu và audit
- **AND** absence của pair hiện tại SHALL không tự thay đổi result cũ

#### Scenario: Pair bị bỏ ở revision mới

- **WHEN** Quản lý publish revision bỏ một pair
- **THEN** result lịch sử của pair đó SHALL vẫn đọc được
- **AND** chỉ các assignment mới SHALL bị từ chối

### Requirement: Lỗi compatibility có contract ổn định và tiếng Việt

Database SHALL phát error code phân biệt missing catalog, stale revision, unknown sample type, unreviewed assay, incompatible pair và stale assay fingerprint. Application SHALL map các code này sang thông báo tiếng Việt nhất quán.

#### Scenario: Pair không tương thích

- **WHEN** assignment bị từ chối vì pair không nằm trong allowlist
- **THEN** UI SHALL hiển thị thông báo tiếng Việt nêu loại mẫu và mã chỉ tiêu liên quan
- **AND** SHALL không hiển thị raw database stack hoặc dữ liệu nhạy cảm

#### Scenario: Catalog chưa sẵn sàng

- **WHEN** chưa có revision published hoàn chỉnh
- **THEN** assignment SHALL fail-closed
- **AND** UI SHALL hướng dẫn liên hệ Quản lý để hoàn tất catalog

### Requirement: Samples linked to clients with snapshot naming
The system SHALL require every sample to reference a client while retaining a snapshot of the client name for audit/history.
- Columns: `client_id UUID NOT NULL REFERENCES clients(id)`, `client_name TEXT NOT NULL` (snapshot from clients.name).
- Behavior: a trigger SHALL set `client_name` from the linked client on insert/update; manual edits to client_name are not required for linkage.

#### Scenario: Create sample for an existing client
- **GIVEN** a client exists in the registry
- **WHEN** a user creates a sample with `client_id` set to that client
- **THEN** the system SHALL auto-fill `client_name` from the client row
- **AND** persist both the FK and snapshot name
- **AND** maintain existing `sample_status` enum for `status`

#### Scenario: Reject sample without client linkage
- **WHEN** a sample creation attempt omits `client_id`
- **THEN** the system SHALL reject the request before insert
- **AND** SHALL NOT create a sample row

---

### Requirement: Sample type validation via CHECK list
The system SHALL validate `samples.type` as TEXT against the allowed Vietnamese list: `Máu`, `Dịch niệu đạo/âm đạo`, `Nước tiểu`, `Phết tế bào âm đạo`, `Ngoáy trực tràng/hậu môn`, `Phân`, `Nước`, `Thực phẩm`.

#### Scenario: Accept allowed sample type
- **WHEN** a sample is created with `type = 'Nước tiểu'`
- **THEN** the insert SHALL succeed
- **AND** the type value SHALL be stored as TEXT

#### Scenario: Reject disallowed sample type
- **WHEN** a sample creation or update uses `type = 'Khác'`
- **THEN** the system SHALL reject the operation due to the CHECK constraint
- **AND** SHALL return a validation error

