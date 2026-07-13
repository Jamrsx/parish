# Parish System Reference

## Repository Layout

```
parish/
├── Backend/                 # Laravel API
│   ├── app/Http/Controllers/
│   ├── app/Models/
│   ├── database/migrations/
│   ├── database/seeders/
│   └── routes/api.php
├── web/                     # React web (staff + legacy parishioner pages)
│   ├── library/             # API clients
│   ├── context/             # AuthContext
│   └── src/
│       ├── (auth)/
│       └── (protected)/
│           ├── Admin/
│           │   ├── Secretary_Dashboard/
│           │   ├── Cashier_Dashboard/
│           │   └── Priest_Dashboard/
│           └── Parishioner_Dashboard/
└── mobile/                  # Expo parishioner app
    ├── library/
    ├── context/
    ├── components/
    └── app/
        ├── (auth)/
        └── Parishioner/(protected)/
            ├── (tabs)/
            ├── forms_request/
            └── certificate_request/
```

## Database Schema Summary

### users
- PK: `user_id`
- Roles: `secretary`, `cashier`, `priest`, `parishioner`
- Login: `email` or `username`

### church_services
- PK: `service_id`
- Fields: `service_type`, `fee`, `available_slots`

### baptism_forms
- PK: `baptism_id`
- Child, parents, address, contact, `preferred_date`, `preferred_time`

### service_forms
- PK: `serviceform_id`
- FK: `service_id` → church_services
- Used for Funeral Mass, House Blessing, Marriage inquiry

### certificate_forms
- PK: `certificate_id`
- FK: `service_id` (nullable)
- Baptismal / Marriage certificate requests

### godparents
- PK: `godparent_id`
- FK: `baptism_id`
- `relationship`: godfather | godmother

### manage_requests (hub table)
- PK: `request_id`
- FKs: `user_id`, `service_id`, optional form FKs, `processed_by`, `assigned_priest`, `cancelled_by`, `rescheduled_by`
- `status`: pending | approved | done | cancelled
- `payment_status`: unpaid | partial | paid
- `amount_paid`, `payment_date`, reschedule/cancel reason fields

### notifications
- PK: `notification_id`
- FKs: `user_id`, `request_id`
- `status`: unread | read

### inventory / borrow_records
- Inventory: sacristy, church, office_supply, office_equipment
- Borrow tracking with overdue/returned status

## Seeded Church Services

| service_type | fee | slots |
|--------------|-----|-------|
| Baptism | 500 | 10 |
| Marriage | 2000 | 3 |
| Funeral Mass | 1000 | 5 |
| House Blessing | 300 | 3 |
| Baptismal Certificate | 100 | 150 |
| Marriage Certificate | 100 | 150 |

## Seeded Test Users (password: `password123`)

| Role | Email / Username |
|------|------------------|
| Secretary | sec@gmail.com / secretary |
| Cashier | cashier@gmail.com / cashier |
| Priest | priest@gmail.com |
| Priest 2 | Priest2@gmail.com |
| Parishioner | maria@gmail.com, jose@gmail.com |

## API Route Groups

### Public
- `POST /auth/web-login`, `/auth/mobile-login`, `/auth/register`
- `GET /availability`, `/church-services`

### Admin (`role:secretary,cashier`)
- `/admin/requests` — approve, complete, cancel, pay, reschedule, assign-priest
- `/admin/inventory` — CRUD, borrow, return, statistics
- `/admin/church-services` — manage fees and slots
- `/admin/users` — list, delete

### Parishioner (`role:parishioner`)
- `/parishioner/baptism-forms`, `/service-forms`, `/certificate-forms`
- `POST /parishioner/manage-requests`
- `/parishioner/requests`, `/parishioner/statistics`
- `/parishioner/notifications`

### Priest (`role:priest`)
- `/priest/assigned-requests`
- `PUT /priest/requests/{id}/status`

## Web Routes (React Router)

| Path | Screen |
|------|--------|
| `/admin/secretary/dashboard` | Secretary home |
| `/admin/secretary/manage-requests` | Request management |
| `/admin/secretary/manage-inventory` | Inventory |
| `/admin/secretary/scheduled-services` | Calendar view |
| `/admin/secretary/service-records` | Records |
| `/admin/cashier/dashboard` | Cashier home |
| `/admin/cashier/manage-unpaid-request` | Payments |
| `/admin/cashier/mass-financial` | Financial records |
| `/priest/PriestHomePage` | Priest schedule |

## Mobile Routes (Expo Router)

| Screen | Path |
|--------|------|
| Home | `Parishioner/(protected)/(tabs)/home` |
| Church services | `(tabs)/church_service` |
| Notifications | `(tabs)/notification` |
| Profile | `(tabs)/profile` |
| Baptism form | `forms_request/BaptismForm` |
| Funeral Mass | `forms_request/FuneralMassForm` |
| House Blessing | `forms_request/HouseBlessingsForm` |
| Marriage inquiry | `forms_request/MarriageInquiryForm` |
| Baptismal cert | `certificate_request/BaptismalCertificate` |
| Marriage cert | `certificate_request/MarriageCertificate` |

## Request Status Lifecycle

```
pending → approved → done
   ↓         ↓
cancelled  cancelled (with reason)
```

Payment can be recorded at any stage via cashier (`payment_status`, `amount_paid`).

Notifications fire on: new request, status change, reschedule.

## Library Files (API Clients)

### Web (`web/library/`)
- `api.ts`, `AuthStorage.ts`
- `manage-request.ts`, `inventory.ts`, `borrowRecords.ts`
- `baptism-form.ts`, `service-form.ts`, `certificate-form.ts`
- `church_service.ts`, `Availability.ts`, `notification.ts`, `godparent.ts`

### Mobile (`mobile/library/`)
- `api.ts`, `AuthStorage.ts`
- `manage-request.ts`, `baptism-form.ts`, `service-form.ts`
- `certificate-form.ts`, `church_service.ts`, `availability.ts`, `godparent.ts`
