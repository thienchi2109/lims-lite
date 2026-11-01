---
id: TASK-6
title: Thực hiện retirement client legacy Gate B theo evidence được duyệt
status: To Do
assignee: []
created_date: '2026-11-01'
labels: [excel-import, client-canonical, cleanup]
dependencies: [TASK-5]
priority: medium
---

## Description

Theo dõi các phase retirement sau evidence gate; không mặc định mọi task chưa tick đều chưa được triển khai. Khi TASK-5 xong, đối chiếu source/runtime evidence hiện hành để chọn phần thực sự còn cần làm.

Nguồn: [retire-client-canonical-legacy-paths](../../openspec/changes/retire-client-canonical-legacy-paths/tasks.md), tasks 2.1–2.5, 3.1–3.5 và 4.1–4.4. Đây là luồng cleanup song song, không phải blocker cho importer mới dùng v2.

Checkpoint source 2026-11-01 vẫn có [findClientByIdentity raw lookup](../../src/app/actions/clients.ts) và [API wrapper](../../src/lib/api-client.ts). Điều này chứng minh entrypoint còn hiện diện, không chứng minh toàn bộ retirement chưa làm hoặc rằng mọi entrypoint đều được phép xóa.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Có evidence/approval TASK-5 và danh sách candidate được duyệt; rà phần đã có implementation hoặc bằng chứng hoàn tất trước khi tạo diff mới.
- [ ] #2 Chuyển caller được duyệt sang v2 và chỉ bỏ compatibility dispatch/flags/entrypoints đã chứng minh không còn cần; giữ confidentiality, localization và hành vi đã adjudicate.
- [ ] #3 Có RED→GREEN regression cho caller/API/compatibility bị đổi theo OpenSpec phase 2; không coi code search đơn thuần là runtime proof.
- [ ] #4 Retirement DB nếu cần dùng migration mới forward-only với baseline assertions, rollback-only/concurrency checks và run_security_tests theo repo; không sửa migration đã apply hoặc gỡ object ngoài danh sách được duyệt.
- [ ] #5 Hoàn tất focused regression, typecheck/lint, approved home-server verification và closeout evidence của phase 4; phân biệt source/local với runtime ở từng kết luận.
- [ ] #6 Đồng bộ OpenSpec/archive/tracker theo evidence thực tế, giữ audit/business data và truy vết từng mục retained/remove; không tick hoàn tất chỉ vì proposal tồn tại.
<!-- AC:END -->
