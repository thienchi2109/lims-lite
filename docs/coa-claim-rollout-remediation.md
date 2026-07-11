# Xử lý CoA `pending` cũ trước migration 171

## Mục đích và giới hạn

Runbook này áp dụng cho database ở schema 170, trước khi chạy
`171_add_coa_generation_claims.sql`. Mọi dòng `public.coa_reports` có
`status = 'pending'` đều chặn rollout, không phụ thuộc tuổi của dòng.

Chỉ xử lý từng report đã được phê duyệt. Không cập nhật hàng loạt. Không sửa,
đổi tên hoặc chạy lại migration đã áp dụng. Mọi truy cập database dùng
`docker exec ... lims-postgres psql`; không dùng Supabase MCP, CLI hoặc Studio.

`ACCOUNTABLE_USER_ID` là UUID analyst hoặc manager chịu trách nhiệm theo phê
duyệt, không phải bằng chứng về người đang gõ lệnh. Quyền `postgres` có thể đặt
JWT và giả mạo `auth.uid()`. Audit DB chứng minh user được quy trách nhiệm,
report đích và chuyển đổi `pending` sang `failed`; audit DB không chứng minh
danh tính người thực thi trên shell.

Phiếu thay đổi bên ngoài và transcript lệnh phải xác định người thực thi. Trước
khi thao tác, ghi host OS account, thời gian UTC, commit SHA, toàn bộ command và
output vào phiếu thay đổi đã được phê duyệt:

```bash
printf 'host_os_account=%s\nutc_time=%s\ncommit_sha=%s\n' "$(id -un)" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(git rev-parse HEAD)"
```

Nhập tham số bằng prompt để không đưa free text vào literal shell assignment:

```bash
read -r -p "REPORT_ID: " REPORT_ID
read -r -p "ACCOUNTABLE_USER_ID da duoc phe duyet: " ACCOUNTABLE_USER_ID
read -r -p "Ly do remediation da duoc phe duyet: " REASON
read -r -p "Tham chieu phe duyet: " APPROVAL_REFERENCE
read -r -p "STALE_BEFORE theo UTC: " STALE_BEFORE
```

## 1. Sao lưu

```bash
docker exec lims-postgres pg_dump -U postgres -d postgres -Fc -f /tmp/coa-pre171-remediation.dump
docker cp lims-postgres:/tmp/coa-pre171-remediation.dump ./coa-pre171-remediation.dump
docker exec lims-postgres sh -lc "pg_restore -l /tmp/coa-pre171-remediation.dump | sed -n '1,20p'"
```

Không tiếp tục nếu backup hoặc kiểm tra danh sách nội dung bị lỗi. Đính kèm
checksum và vị trí lưu backup vào phiếu thay đổi.

## 2. Mở maintenance window

Quiesce toàn bộ đường ghi của ứng dụng và worker tạo CoA. Dừng đúng các service
Compose của repository:

```bash
docker compose stop app rest kong nginx
docker compose ps --status running --services app rest kong nginx
```

Command thứ hai phải không trả về service nào. Giữ bốn service dừng trong toàn
bộ preflight cuối, remediation, migration 171 và kiểm tra bảo mật.

Xác minh không còn session PostgREST có thể queue công việc:

```bash
docker exec -i lims-postgres psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
          AND application_name LIKE 'PostgREST%'
    ) THEN
        RAISE EXCEPTION
            'Application session remains; do not run CoA remediation';
    END IF;
END;
$$;
SQL
```

Preflight chỉ đọc và không giữ `cross-command lock` giữa các command. Chính
maintenance window và kiểm tra session ngăn request mới chen vào khoảng trống.
Nếu service tự khởi động lại hoặc session xuất hiện, dừng thao tác và quiesce
lại từ đầu.

## 3. Preflight cuối và bằng chứng trước xử lý

```bash
docker exec -i lims-postgres psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < scripts/coa-claim-rollout-preflight.sql
```

`COA_CLAIM_PREFLIGHT_OK_SCHEMA_170` nghĩa là không có blocker. Thông báo trỏ về
runbook này nghĩa là còn report `pending`. Trạng thái chỉ có một phần trong bốn
claim column phải fail closed và được escalation; không tự sửa schema.

Liệt kê toàn bộ blocker:

```bash
docker exec lims-postgres psql -U postgres -d postgres -X -P pager=off -c "SELECT id, sample_id, version, source_submission_id, status, error_message, file_path, file_hash, signature_id, superseded_by, generated_at, created_at, updated_at, deleted_at FROM public.coa_reports WHERE status = 'pending' ORDER BY created_at, id;"
```

Thu report đích và audit hiện có:

```bash
docker exec lims-postgres psql -U postgres -d postgres -X -P pager=off -v "report_id=$REPORT_ID" -c "SELECT id, sample_id, version, source_submission_id, status, error_message, file_path, file_hash, signature_id, superseded_by, generated_at, created_at, updated_at, deleted_at FROM public.coa_reports WHERE id = :'report_id'::uuid;"
docker exec lims-postgres psql -U postgres -d postgres -X -P pager=off -v "report_id=$REPORT_ID" -c "SELECT id, operation, changed_by, changed_at, old_values, new_values FROM public.audit_logs WHERE table_name = 'coa_reports' AND record_id = :'report_id'::uuid ORDER BY changed_at, id;"
```

Đính kèm output vào phiếu thay đổi trước khi phê duyệt remediation.

## 4. Phân loại active và stale

Mốc `STALE_BEFORE` phải cũ hơn thời điểm hiện tại ít nhất 15 phút, bằng lease
tạo CoA hiện có. Mốc tương lai hoặc mới hơn ngưỡng này bị script từ chối.

```bash
docker exec -i lims-postgres psql -U postgres -d postgres -X -P pager=off -v ON_ERROR_STOP=1 -v "report_id=$REPORT_ID" -v "stale_before=$STALE_BEFORE" <<'SQL'
SELECT id, status,
       GREATEST(created_at, updated_at, generated_at) AS latest_activity,
       CASE
           WHEN :'stale_before'::timestamptz >
                clock_timestamp() - INTERVAL '15 minutes'
               THEN 'INVALID_CUTOFF'
           WHEN GREATEST(created_at, updated_at, generated_at) >=
                :'stale_before'::timestamptz
               THEN 'ACTIVE_OR_STALE_NOT_PROVEN'
           ELSE 'STALE_CANDIDATE_REQUIRES_LOG_REVIEW'
       END AS classification
FROM public.coa_reports
WHERE id = :'report_id'::uuid;
SQL
docker compose logs --since 30m app rest
```

Xem report là active hoặc chưa chứng minh stale nếu activity chưa cũ hơn cutoff,
log có request/retry đang chạy, hoặc không xác định được trạng thái generation.
Không remediation trường hợp này. Giữ report nguyên trạng, dừng rollout và
escalation cho quản lý phòng xét nghiệm, chủ hệ thống và vận hành. Chỉ tiếp tục
khi có phê duyệt bằng văn bản xác nhận generation đã dừng và cutoff hợp lệ.

## 5. Dry-run một report

Script khóa và kiểm tra lại report, tạo chuyển đổi cùng audit, in JSON bằng
chứng, rồi `ROLLBACK` mặc định:

```bash
docker exec -i lims-postgres psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -v "report_id=$REPORT_ID" -v "accountable_user_id=$ACCOUNTABLE_USER_ID" -v "reason=$REASON" -v "approval_reference=$APPROVAL_REFERENCE" -v "stale_before=$STALE_BEFORE" -v "commit_remediation=false" < scripts/coa-legacy-pending-remediation.sql
```

JSON phải có đúng `report_id`, `accountable_user_id`, `approval_reference`,
`old_status = pending`, `new_status = failed`, `audited_reason` chứa lý do và
tham chiếu phê duyệt, cùng mọi cờ `preserved = true`. Dòng cuối phải xác nhận
transaction đã rollback. Nếu có sai lệch, không commit.

## 6. Commit remediation đã được phê duyệt

Người phê duyệt phải kiểm tra dry-run và transcript trước khi cho phép commit.
Chạy lại đúng tham số, chỉ đổi `commit_remediation`:

```bash
docker exec -i lims-postgres psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -v "report_id=$REPORT_ID" -v "accountable_user_id=$ACCOUNTABLE_USER_ID" -v "reason=$REASON" -v "approval_reference=$APPROVAL_REFERENCE" -v "stale_before=$STALE_BEFORE" -v "commit_remediation=true" < scripts/coa-legacy-pending-remediation.sql
```

Rollback chỉ hợp lệ trước `COMMIT`. Sau commit, không đổi report về `pending`,
không xóa audit và không viết lại lịch sử.

## 7. Bằng chứng sau xử lý

```bash
docker exec lims-postgres psql -U postgres -d postgres -X -P pager=off -v "report_id=$REPORT_ID" -c "SELECT id, sample_id, version, source_submission_id, status, error_message, file_path, file_hash, signature_id, superseded_by, generated_at, created_at, updated_at, deleted_at FROM public.coa_reports WHERE id = :'report_id'::uuid;"
docker exec lims-postgres psql -U postgres -d postgres -X -P pager=off -v "report_id=$REPORT_ID" -c "SELECT id, changed_by, changed_at, old_values ->> 'status' AS old_status, new_values ->> 'status' AS new_status, new_values ->> 'error_message' AS audited_reason FROM public.audit_logs WHERE table_name = 'coa_reports' AND record_id = :'report_id'::uuid AND operation = 'UPDATE' ORDER BY changed_at DESC, id DESC LIMIT 5;"
```

So sánh bằng chứng trước và sau. Chỉ `status`, `error_message`, `updated_at`
được thay đổi. `id`, `sample_id`, `version`, `source_submission_id`,
`file_path`, `file_hash`, `signature_id`, `superseded_by`, `generated_at`,
`created_at`, `deleted_at` phải giữ nguyên. Audit phải có accountable user,
report đích, old `pending`, new `failed`, lý do và approval reference.

## 8. Sửa sai theo hướng tiến sau commit

Nếu cần bổ sung lý do sau commit, tạo phê duyệt mới và audit event mới. Không
phục hồi `pending`; không xóa hoặc cập nhật audit cũ.

```bash
read -r -p "Noi dung forward correction da duoc phe duyet: " FORWARD_CORRECTION
read -r -p "Tham chieu phe duyet moi: " APPROVAL_REFERENCE
docker exec -i lims-postgres psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -v "report_id=$REPORT_ID" -v "accountable_user_id=$ACCOUNTABLE_USER_ID" -v "correction_reason=$FORWARD_CORRECTION" -v "approval_reference=$APPROVAL_REFERENCE" <<'SQL'
BEGIN;
SELECT set_config('request.jwt.claim.sub', :'accountable_user_id', true);
SELECT set_config('lims.coa_forward_report_id', :'report_id', true);
SELECT set_config(
    'lims.coa_forward_correction',
    :'correction_reason' || ' | Approval reference: ' || :'approval_reference',
    true
);
SELECT id, status, error_message
FROM public.coa_reports
WHERE id = :'report_id'::uuid
FOR UPDATE;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.coa_reports
        WHERE id = current_setting('lims.coa_forward_report_id')::uuid
          AND status = 'failed'
    ) THEN
        RAISE EXCEPTION 'Forward correction requires a failed CoA report';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = current_setting('request.jwt.claim.sub')::uuid
          AND deleted_at IS NULL
          AND role IN ('analyst', 'manager')
    ) THEN
        RAISE EXCEPTION 'Accountable user must be active';
    END IF;
END;
$$;
UPDATE public.coa_reports
SET error_message = error_message || E'\nForward correction: '
        || current_setting('lims.coa_forward_correction'),
    updated_at = clock_timestamp()
WHERE id = :'report_id'::uuid
  AND status = 'failed';
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.audit_logs AS audit
        JOIN public.coa_reports AS report
          ON report.id = audit.record_id
        WHERE audit.table_name = 'coa_reports'
          AND audit.record_id =
              current_setting('lims.coa_forward_report_id')::uuid
          AND audit.operation = 'UPDATE'
          AND audit.changed_by =
              current_setting('request.jwt.claim.sub')::uuid
          AND audit.new_values ->> 'error_message' = report.error_message
          AND audit.changed_at >= transaction_timestamp()
    ) THEN
        RAISE EXCEPTION
            'Forward correction audit row was not recorded';
    END IF;
END;
$$;
SELECT id, status, error_message
FROM public.coa_reports
WHERE id = :'report_id'::uuid;
COMMIT;
SQL
```

Thu lại report và audit, rồi gắn approval mới và transcript vào phiếu thay đổi.
DB audit vẫn chỉ chứng minh user được quy trách nhiệm và chuyển đổi row; bằng
chứng bên ngoài xác định người thực thi.

## 9. Preflight, migration, bảo mật và resume

Trong khi bốn service vẫn dừng, chạy lại preflight. Chỉ tiếp tục khi không còn
bất kỳ report `pending` nào:

```bash
docker exec -i lims-postgres psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < scripts/coa-claim-rollout-preflight.sql
```

Áp dụng migration 171 theo hướng tiến, không sửa file migration:

```bash
docker exec -i lims-postgres psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < supabase/migrations/171_add_coa_generation_claims.sql
```

Xác minh bảo mật:

```bash
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"
```

Không resume nếu migration hoặc bất kỳ security test nào thất bại. Sau khi xác
minh migration và security thành công, mới mở lại đường ứng dụng:

```bash
docker compose start rest app kong nginx
docker compose ps --status running app rest kong nginx
```
