---
id: TASK-8
title: Tạo và tải template tiếp nhận có phiên bản
status: In Progress
assignee: []
created_date: '2026-11-02'
updated_date: '2026-11-02'
labels: [excel-import, implementation]
dependencies: [TASK-4]
priority: high
---

## Description

Issue: https://github.com/thienchi2109/lims-lite/issues/136 (sub-issue #107).

Change đầu tiên: [add-versioned-accession-template](../../openspec/changes/add-versioned-accession-template/proposal.md). Task này chỉ được bắt đầu sau root review TASK-4.

Nguồn và thứ tự: [phân chia TASK-4](../../docs/superpowers/specs/2026-11-02-import-implementation-partition.md), hợp đồng #112 §§2–5,7–9. Không phụ thuộc TASK-5/6 hoặc TASK-7. Chỉ sinh/tải workbook; chưa cho upload/import.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Phase 1 — một PR/session: bổ sung snapshot RPC server-authoritative trong migration mới forward-only nếu cần; lấy revision published, mã→UUID/generation và active configured pairs trong một snapshot nhất quán; không sửa RPC legacy hoặc migration đã áp dụng. Analyst authorization, RLS/grants/search_path và audit/privacy được kiểm thử.
- [ ] #2 Phase 2 — một PR/session: dùng thư viện `xlsx` đã cài và Node crypto để sinh tám sheet đúng hợp đồng, header/cột/metadata literal Text và cột nhập `@`; ngày hướng dẫn ISO năm1900–2100, ví dụ chỉ trong Hướng dẫn. Descriptor xác thực metadata và cả ba catalog; fail closed khi snapshot/version/signing config không sẵn sàng. Không lưu workbook hay PII.
- [ ] #3 Phase 3 — một PR/session: endpoint tải có authenticated analyst boundary và nút/lỗi/pending tiếng Việt, no-store; phiên bản1 là literal `1`, generated_at không tạo template TTL. Đề xuất nút “Tải template Excel” tại AccessionPageHeader trên /analyst/accession cạnh title, giữ WalkthroughTrigger, mobile wrap/keyboard/focus; chốt theo user steering trước UI. Tải file qua response binary; không nhét file vào JSON mutation bridge. Mutation nào có client invocation vẫn đi api-client.
- [ ] #4 Mỗi source phase có RED→GREEN focused checks phù hợp: snapshot authority/authorization, tampered descriptor/catalog/metadata, thiếu revision/pair, exact workbook layout/types/no seeded business rows và download error/accessibility; scoped lint/typecheck/OpenSpec strict PASS. Không thêm count caps nghiệp vụ hoặc dependency mới.
- [ ] #5 Phase 4 — session vận hành riêng sau authorization: áp dụng migrations đã commit trên home server qua SSH + sudo Docker psql; SQL regression và run_security_tests() PASS; rollout app/signing configuration rồi tải workbook qua app thực, lưu evidence PII-free. Không coi source/mocks là runtime proof; không chạy production trong workspace.
- [ ] #6 Root review exit: authority+download hoạt động theo phạm vi đã nghiệm thu, mỗi source/runtime gate có status và revision; handoff descriptor verifier/snapshot shape cho TASK-9/10. Chưa nghiệm thu importer toàn bộ; TASK-7 giữ gate cuối.
<!-- AC:END -->

## Phase 1 source checkpoint — 2026-11-02

[Evidence/interface](../../openspec/changes/add-versioned-accession-template/phase-1-source-evidence.md): migration 232 bổ sung `get_accession_template_snapshot()`, active analyst-only; source checks RED→GREEN, 30/30 focused tests, scoped lint/typecheck/OpenSpec strict PASS. AC #1 chỉ đánh dấu source gate; migration **chưa áp dụng**, SQL regression/run_security_tests()/runtime **NOT RUN**. Phase 2–4 và overall TASK-8 **INCOMPLETE**; chưa có generator/download/import UI.
