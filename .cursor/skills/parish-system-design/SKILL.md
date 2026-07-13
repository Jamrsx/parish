---
name: parish-system-design
description: Design, improve, and extend the San Guillermo Parish church management system (Laravel API, React web, Expo mobile). Use when planning or implementing UI/UX changes, new features, role dashboards, forms, requests, inventory, notifications, API work, or system improvements in this repository.
---

# Parish System Design & Improvement

## When to Use

Apply this skill when the user wants to:
- Design or improve web/mobile UI
- Add or change parish features (services, certificates, requests, payments, inventory)
- Plan where code and database changes belong
- Review HCI, accessibility, or role-based workflows

## Core Stack

| Layer | Path | Tech |
|-------|------|------|
| Backend API | `Backend/` | Laravel 10, Sanctum, MySQL |
| Web admin/staff | `web/` | Vite, React 19, React Router, Tailwind 4, Axios |
| Mobile parishioner | `mobile/` | Expo 54, Expo Router, NativeWind, AsyncStorage |

**Not Inertia.** Web and mobile are separate frontends calling `Backend/routes/api.php`.

## Roles & Clients

| Role | Client | Login endpoint |
|------|--------|----------------|
| Secretary | Web | `/api/auth/web-login` |
| Cashier | Web | `/api/auth/web-login` |
| Priest | Web | `/api/auth/web-login` |
| Parishioner | Mobile (primary) | `/api/auth/mobile-login` |

- Web redirects by role via `web/library/AuthStorage.ts` and `web/context/AuthContext.tsx`
- Mobile blocks non-parishioners in `mobile/context/AuthContext.tsx` and `mobile/components/AuthGuard.tsx`
- Backend enforces roles with `role` middleware in `Backend/routes/api.php`

## Before Implementing

Follow the user's review workflow:

1. **Show a short plan first** — what will change, which files, and why
2. **Wait for go signal** before coding (unless user already said "proceed" or "go")
3. Keep scope minimal; match existing patterns

## Development Order (Required)

Always follow this order to avoid `Column not found` errors:

1. **Migrations** — `Backend/database/migrations/` (modify existing; add only if necessary)
2. **Models** — `Backend/app/Models/`
3. **Controllers** — `Backend/app/Http/Controllers/`
4. **API routes** — `Backend/routes/api.php`
5. **API clients** — `web/library/` or `mobile/library/`
6. **UI** — `web/src/` or `mobile/app/`

## Central Domain Flow

Most parishioner features follow this pattern:

```
Form (baptism | service | certificate)
  → manage_requests row (status, payment, priest assignment)
    → notifications to parishioner
      → secretary/cashier/priest actions on web
```

Key tables: `users`, `church_services`, `baptism_forms`, `service_forms`, `certificate_forms`, `godparents`, `manage_requests`, `notifications`, `inventory`, `borrow_records`.

`manage_requests` is the hub — link forms via `baptism_form_id`, `service_form_id`, or `certificate_form_id`.

## Where to Put Changes

| Feature area | Backend | Web | Mobile |
|--------------|---------|-----|--------|
| Auth / profile | `AuthController` | `(auth)/`, `AuthContext` | `(auth)/`, `AuthContext` |
| Service requests | `ManageRequestController`, form controllers | `Admin/Secretary_Dashboard/Manage_Requests.tsx` | `forms_request/`, `church_service.tsx` |
| Certificates | `CertificateFormController` | Parishioner forms (web has legacy pages) | `certificate_request/` |
| Scheduling / slots | `AvailabilityController`, `ChurchServiceController` | `Scheduled_Services.tsx` | `church_service.tsx` |
| Payments | `ManageRequestController@pay` | `Cashier_Dashboard/` | N/A (view status only) |
| Priest assignments | `ManageRequestController` | `Priest_Dashboard/` | N/A |
| Inventory | `InventoryController` | `Secretary_Dashboard/Inventory/` | N/A |
| Notifications | `NotificationController` | `notification.tsx` | `(tabs)/notification.tsx` |

## API Configuration

- Web base URL: `web/library/api.ts` → `VITE_API_URL` or fallback
- Mobile base URL: `mobile/library/api.ts` → `API_BASE_URL` constant
- Local Laragon IP (per project rules): `10.163.52.143`
- When testing on device, update mobile/web API URL to match current machine IP

## Design Rules

### Web (Secretary, Cashier, Priest)

- Tailwind utility classes; match existing dashboard layouts in `web/src/(protected)/Admin/`
- Secretary uses sidebar layout: `Secretary_Sidebar.tsx`
- Cashier and Priest use tabbed or standalone pages
- **All modals** use overlay: `bg-black/50 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50`
- Prefer clear hierarchy, spacing, and status badges (pending/approved/done/cancelled)

### Mobile (Parishioner)

- NativeWind (`className`) + SafeAreaView
- Large touch targets (7–10mm), thumb-friendly layout
- **No decorative/flowery text or tags** in UI copy
- Clean, professional, uncluttered screens
- Custom alerts/modals with `bg-black/50` overlay pattern
- `AuthGuard` wraps protected routes

### HCI (Both)

Consistency, accessibility (contrast, labels), simplicity, error prevention, visible feedback, user control (confirm destructive actions), learnable navigation.

## Implementation Checklist

```
- [ ] Checked migrations for actual column names and FKs
- [ ] Matched model `$fillable` and relationships
- [ ] Added/updated API route with correct role middleware
- [ ] Updated web/library or mobile/library client
- [ ] Added validation (backend + frontend where needed)
- [ ] Added user-facing error/success feedback
- [ ] Added console.log for debugging (project convention)
- [ ] Responsive: mobile-first for Expo; web works on smaller screens
- [ ] No new migration unless truly required
```

## Feature Proposal Template

When presenting a plan to the user, use:

```markdown
## Goal
[One sentence]

## Affected areas
- Backend: [files/endpoints]
- Web: [pages/components]
- Mobile: [screens]

## Database impact
[Tables/columns — or "none"]

## User flow
1. ...
2. ...

## UI notes
[Layout, states, validations, modals]

## Risks / edge cases
- ...
```

## Common Pitfalls

- Custom PKs: `user_id`, `request_id`, `service_id`, `baptism_id`, etc. — not Laravel defaults
- `church_services.service_type` drives form type detection (baptism, certificate, service form)
- Cashier dashboard may still use placeholder data — wire to `/admin/requests` payment endpoints when improving
- Web still has parishioner routes; mobile is the intended parishioner client
- Password is auto-hashed in `User` model mutator — don't double-hash in seeders/controllers

## Additional Resources

- Full file map and seeded data: [reference.md](reference.md)
- Example improvement plans: [examples.md](examples.md)
