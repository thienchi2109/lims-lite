---
id: TASK-9
title: Parse và validate workbook template an toàn
status: To Do
assignee: []
created_date: '2026-11-02'
labels: [excel-import, implementation]
dependencies: [TASK-8]
priority: high
---

## Description

Issue: https://github.com/thienchi2109/lims-lite/issues/137 (sub-issue #107).

OpenSpec dự kiến `add-accession-workbook-validation` (chưa tạo; promote sau exit TASK-8). Nguồn: [mapping](../../docs/superpowers/specs/2026-11-02-import-implementation-partition.md), #112 §§3–5,7–9 và #114 file-only evidence.

Parser không tự match client hoặc tin catalog workbook. TASK-10 chịu canonical resolver và policy theo current authority. Không ghép prototype thẳng vào production.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Phase 1 — một PR/session: kiểm tra original XLSX <10.000.000 decimal bytes ở trust boundary; kiểm tra actual inflate/ZIP/XML/entry/cell/time/memory theo threat model, malformed local-header/central-directory/CRC và compression bomb fail closed trước parse/write. Prototype 32MiB/256 entries/160k cells/watchdog chỉ experimental; không copy làm capacity proof hoặc cap số dòng nghiệp vụ.
- [ ] #2 Phase 2 — một PR/session: parser exact tám sheets, headers/metadata/catalog integrity qua verifier TASK-8; chỉ literal Text, giữ zeros/NFC/trim/null, ngày ISO thật năm1900–2100. Reject formula/cached formulas, external links/macros/hidden data/unsupported workbook constructs theo #112 §7; không dùng formatted text/date inference.
- [ ] #3 Phase 3 — một PR/session: structural validation temp refs/case/uniqueness/orphans, duplicate sample-assay pairs, required values/typed CCCD–CMND/optional values; giữ tọa độ thật và lỗi tiếng Việt. Phone/gender chỉ bắt buộc tạo mới sau resolution TASK-10; same name+DOB không là duplicate proof. Không có business writes hoặc retained workbook/full payload trong temp app storage/cache/log.
- [ ] #4 Mỗi phase để lại focused RED→GREEN boundary/adversarial/normal tests, lint/typecheck và OpenSpec strict. Chứng minh 9.999.999/10.000.000/10.000.001 bytes, former count cap+1 được xử lý theo byte/validity/resource guards; invalid cell cuối không trả partial valid preview.
- [ ] #5 Exit source: parser trả validated in-memory structure hoặc toàn bộ errors; handoff cho TASK-10. Không có migration/rollout mới nếu chỉ pure parser. Runtime app/proxy upload limits và actual resource capacity do TASK-7 nghiệm thu sau TASK-12/13; source PASS không thay gate đó.
<!-- AC:END -->
