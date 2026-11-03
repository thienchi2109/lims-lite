---
id: TASK-9
title: Parse và validate workbook template an toàn
status: Done
assignee: []
created_date: '2026-11-02'
labels: [excel-import, implementation]
dependencies: [TASK-8]
priority: high
---

## Description

Issue: https://github.com/thienchi2109/lims-lite/issues/137 (sub-issue #107).

OpenSpec `add-accession-workbook-validation`. Ngày 2026-11-03, người dùng giao worker triển khai TASK-9 theo backlog; root điều phối và review. Quyết định này cho phép bắt đầu source TASK-9 trong khi TASK-8 4.4/4.6 vẫn DEFERRED, chưa nghiệm thu. Nguồn: [mapping](../../docs/superpowers/specs/2026-11-02-import-implementation-partition.md), #112 §§3–5,7–9 và #114 file-only evidence.

Parser không tự match client hoặc tin catalog workbook. TASK-10 chịu canonical resolver và policy theo current authority. Không ghép prototype thẳng vào production.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Phase 1 — một PR/session: kiểm tra original XLSX <10.000.000 decimal bytes ở trust boundary; kiểm tra actual inflate/ZIP/XML/entry/cell/time/memory theo threat model, malformed local-header/central-directory/CRC và compression bomb fail closed trước parse/write. Prototype 32MiB/256 entries/160k cells/watchdog chỉ experimental; không copy làm capacity proof hoặc cap số dòng nghiệp vụ.
- [x] #2 Phase 2 — một PR/session: parser exact tám sheets, headers/metadata/catalog integrity qua verifier TASK-8; chỉ literal Text, giữ zeros/NFC/trim/null, ngày ISO thật năm1900–2100. Reject formula/cached formulas, external links/macros/sheet ẩn/unsupported workbook constructs theo #112 §7; vẫn đọc và validate mọi dòng ẩn/bị filter, không dùng formatted text/date inference.
- [x] #3 Phase 3 — một PR/session: structural validation temp refs/case/uniqueness/orphans, duplicate sample-assay pairs, required values/typed CCCD–CMND/optional values; giữ tọa độ thật và lỗi tiếng Việt. Phone/gender chỉ bắt buộc tạo mới sau resolution TASK-10; same name+DOB không là duplicate proof. Không có business writes hoặc retained workbook/full payload trong temp app storage/cache/log.
- [x] #4 Mỗi phase để lại focused RED→GREEN boundary/adversarial/normal tests, lint/typecheck và OpenSpec strict. Chứng minh 9.999.999/10.000.000/10.000.001 bytes, former count cap+1 được xử lý theo byte/validity/resource guards; invalid cell cuối không trả partial valid preview.
- [x] #5 Exit source: parser trả validated in-memory structure hoặc toàn bộ errors; handoff cho TASK-10. Không có migration/rollout mới nếu chỉ pure parser. Runtime app/proxy upload limits và actual resource capacity do TASK-7 nghiệm thu sau TASK-12/13; source PASS không thay gate đó.
<!-- AC:END -->

## Source exit — 2026-11-03

Root điều phối worker `gpt-6.1-sol/high`, review diff và tự chạy **163/163 focused tests**, scoped ESLint, typecheck, OpenSpec strict: PASS. Review spec/standards không còn blocker; các lỗi ZIP/XML/Unicode/diagnostic đã có regression RED→GREEN. Ba phase giữ checkpoint commit riêng, làm trực tiếp trên main.

[Evidence và handoff TASK-10](../../openspec/changes/add-accession-workbook-validation/evidence.md): OpenSpec **10/10**, API `validateAccessionWorkbook` trả typed rows hoặc errors-only. Policy tài nguyên bắt buộc do server cung cấp; không có production defaults. Generator source đổi sang shared strings cho đúng contract; workbook cũ `t="str"` cần tải lại sau deployment được cấp quyền riêng.

TASK-9 hoàn tất **source**, không có migration/deployment hoặc capacity acceptance. TASK-8 4.4/4.6 giữ DEFERRED; TASK-7 giữ runtime gate. TASK-10 chưa bắt đầu.
