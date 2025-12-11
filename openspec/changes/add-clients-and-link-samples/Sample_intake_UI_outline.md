#### 1. __Client Selection/Creation Flow__

__Current state__: The form has a simple `client_name` text field with QR scanner support.

__Option A: Search-First Workflow__

- Show a searchable client selector (combobox/autocomplete)
- Search by: name, phone, or ID card number
- If client exists → auto-fill all fields (name, DOB, gender, phone)
- If not found → Show "Tạo khách hàng mới" button → Open dialog/form to create new client
- QR scan auto-searches existing clients first, then prompts to create if not found

__Option B: QR/Manual Toggle Workflow__

- Two modes: "Quét QR" or "Nhập thủ công"
- QR mode: Scan → Auto-fill → Add phone manually → Done
- Manual mode: Show full client creation form inline
- Always search for duplicates before creating (by name + DOB)

__Option C: Unified Smart Form__

- Single form with all client fields
- As user types name/ID, show suggestions from existing clients
- QR scan populates fields, but user can edit
- "Khách hàng mới" vs "Khách hàng hiện có" radio buttons at top
- Smart duplicate detection with visual warning

__Which approach feels most natural for your analysts' workflow?__

---

#### 2. __Phone Number Input Timing__

__Question__: When should the phone number be entered?

__Option A__: Always required upfront (before sample creation)

- Pro: Complete client record immediately
- Con: Adds friction if analyst doesn't have phone number yet

__Option B__: Optional during intake, required before CoA generation

- Pro: Faster sample intake
- Con: More complex validation flow, might forget later

__Option C__: Required for new clients, optional for existing (can update later)

- Pro: Balanced approach
- Con: Inconsistent UX

__What's the typical workflow? Do analysts always have phone numbers during sample intake?__

---

#### 3. __Sample Type Selection__

__Current__: Hardcoded to 'Máu' placeholder

__Options for type selector__:

- __Dropdown/Select__: Simple, clean, works well for 8 types
- __Radio buttons__: More visible, but takes more space
- __Grouped by category__: If types relate to body systems (blood, urine, stool, etc.)

__Should sample type default to a common value (like 'Máu'), or force explicit selection?__

---

#### 4. __QR Parsing & Error Handling__

__Current QR format__: `id_card_num|name|dd/mm/yyyy|gender`

__UX considerations__:

- What happens if QR scan fails to parse?
- What if QR data doesn't match existing client (same ID card but different name)?
- Should we show a confirmation dialog after QR scan showing parsed data?
- Should analysts be able to edit QR-scanned data before creating client?

__Preferred error handling approach?__

---

#### 5. __Form Layout Options__

__Option A: Compact Vertical Form__ (current style)

```javascript
┌─────────────────────────────────┐
│ [Quét QR] button                │
│ Tên khách hàng: [_____________] │
│ Số điện thoại:  [_____________] │
│ Loại mẫu:       [▼ Dropdown   ] │
│ Thời gian nhận: [_____________] │
│                                 │
│ [Test Assignment Grid]          │
│ [Tạo mẫu và chỉ định]           │
└─────────────────────────────────┘
```

__Option B: Two-Step Wizard__

- Step 1: Client selection/creation (dedicated screen)
- Step 2: Sample details + test assignment
- Pro: Clear separation, less overwhelming
- Con: More clicks, slower for experienced users

__Option C: Expandable Sections__

```javascript
▼ Thông tin khách hàng (Client Info)
  [Client fields]
▼ Thông tin mẫu (Sample Details)
  [Sample type, received_at]
▼ Chỉ định xét nghiệm (Test Assignment)
  [Grid]
```

__Which layout would work best for your analysts?__

---

#### 6. __Client Data Display After Selection__

Once a client is selected (from search or QR), should we:

- Show all client details as __read-only__ fields?
- Show just a __summary card__ (name, phone, DOB)?
- Show an __"Edit client" button__ to update client info?
- Hide details and just show __"✓ Khách hàng: [Name]"__?

---

### 🎨 My Recommended Approach (for discussion)

Based on the existing patterns in your codebase and typical LIMS workflows, here's my suggested design:

__Recommended: "Search-First with Smart QR Integration"__

```typescript
┌─────────────────────────────────────────┐
│ 📋 THÔNG TIN KHÁCH HÀNG                 │
├─────────────────────────────────────────┤
│ Tìm khách hàng:                         │
│ [Search by name/phone/ID] [🔍] [📷 QR] │
│                                         │
│ ▼ Selected Client Display (if found):  │
│   ┌───────────────────────────────────┐ │
│   │ ✓ Nguyễn Văn A                    │ │
│   │ 📱 0912345678  🎂 01/01/1990      │ │
│   │ 🆔 001234567890                   │ │
│   │ [Chỉnh sửa] [Chọn khác]          │ │
│   └───────────────────────────────────┘ │
│                                         │
│ ─── OR ───                              │
│                                         │
│ Không tìm thấy?                         │
│ [+ Tạo khách hàng mới]                  │
│   → Opens inline form:                  │
│   Tên: [_______________]                │
│   CMND/CCCD: [_______________]          │
│   Ngày sinh: [_______________]          │
│   Giới tính: [● Nam ○ Nữ ○ Khác]       │
│   Điện thoại: [_______________] *       │
│   Địa chỉ: [_______________]            │
│                                         │
├─────────────────────────────────────────┤
│ 📝 THÔNG TIN MẪU                        │
├─────────────────────────────────────────┤
│ Loại mẫu: * [▼ Dropdown - 8 types]     │
│ Thời gian nhận: [datetime picker]      │
│                                         │
├─────────────────────────────────────────┤
│ [Test Assignment Grid]                  │
│ [Tạo mẫu và chỉ định]                   │
└─────────────────────────────────────────┘
```

__Key features__:

1. ✅ __Search-first__: Prevents duplicate clients
2. ✅ __QR integration__: Button triggers scan → auto-searches → shows result or creates new
3. ✅ __Clear visual feedback__: Shows selected client in a card
4. ✅ __Inline creation__: No dialog needed, keeps flow simple
5. ✅ __Required phone__: Captured during client creation
6. ✅ __Sample type dropdown__: Clean, explicit selection

---

## 🤔 Questions for You

Before I create the detailed implementation plan, please share your thoughts:

1. __Which client selection workflow__ resonates most with how your analysts actually work? (Search-first, QR/Manual toggle, or Unified smart form?)

2. __Phone number policy__: Required upfront, or can be added later?

3. __Sample type__: Should we default to a common type or force selection?

4. __Form layout preference__: Compact vertical, wizard, or expandable sections?

5. __QR error handling__: How should we handle QR parsing failures or data mismatches?

6. __New component needed?__ Should we create a reusable `<ClientSelector>` component, or keep everything in the accession form?

Once you provide feedback on these UX decisions, I'll create a detailed implementation plan with:

- Component breakdown
- State management approach
- Validation strategy
- Vietnamese labels mapping
- Test assignment

What are your thoughts on these design options? 🎯