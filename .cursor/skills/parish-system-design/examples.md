# Parish System Design Examples

## Example 1: Add a new certificate type

### Goal
Add "Confirmation Certificate" request for parishioners.

### Plan
1. **Database**: Add `Confirmation Certificate` row in `church_services` seeder (or admin UI); extend `certificate_forms` only if new fields needed
2. **Backend**: `CertificateFormController` validation; `ChurchService` type helpers if needed
3. **Mobile**: New screen in `certificate_request/`; update `church_service.tsx` availability mapping
4. **Web**: Secretary views already use `manage_requests` — may need form detail display only

### User flow
Parishioner opens Church Service → Certificates → Confirmation → fills form → `certificate-forms` POST → `manage-requests` POST → notification created.

---

## Example 2: Improve cashier unpaid requests page

### Goal
Replace hardcoded transactions with live unpaid/partial requests.

### Plan
1. **Backend**: Use existing `GET /admin/requests?payment_status=unpaid`
2. **Web**: Update `Manage_Unpaid_Request.tsx` to call `manageRequestAPI.getAll({ payment_status: 'unpaid' })`
3. **Web**: Wire pay action to `manageRequestAPI.pay(id, { amount })`
4. **UI**: Show remaining balance from `remaining_balance`; confirm before payment

---

## Example 3: Secretary inventory borrow modal

### Goal
Improve borrow UX with validation and feedback.

### Plan
1. **Backend**: Already has `POST /admin/inventory/{id}/borrow`
2. **Web**: `BorrowItemModal.tsx` — validate quantity ≤ available, future return date
3. **Modal overlay**: `bg-black/50 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50`
4. **Feedback**: Success/error alert; refresh `InventoryTable` and `BorrowerLogsTable`

---

## Example 4: Mobile form submission error handling

### Goal
Show field-level errors from Laravel validation.

### Pattern
```typescript
try {
  const response = await api.createBaptismForm(data);
  if (response.success) { /* navigate or alert success */ }
} catch (error: any) {
  console.log('Baptism form error:', error);
  const errors = error?.data?.errors;
  if (errors) {
    // Map to form field state
  } else {
    showCustomAlert('Error', error?.data?.message || 'Submission failed');
  }
}
```

---

## Example 5: Feature proposal (what to show user before coding)

```markdown
## Goal
Let secretary export filtered service records as CSV.

## Affected areas
- Backend: `ManageRequestController@export` (exists)
- Web: `Service_Records.tsx` — add Export button with current filters

## Database impact
None

## User flow
1. Secretary applies filters on Service Records
2. Clicks Export
3. Browser downloads CSV blob from `/admin/requests/export`

## UI notes
- Export button in page header next to filters
- Loading state on button during download
- Toast on failure

## Risks
- Large datasets: consider date range requirement
```
