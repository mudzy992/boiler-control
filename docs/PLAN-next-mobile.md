# Next Mobile + Frontend Fix Pack (Heating, Auth, Uploads, Gas Invoicing/Pricing)

## Summary
Implement one cohesive backend/mobile/frontend update for:
1. false heating anomaly at startup,
2. username-based login (email or username),
3. correct live heating status indication on mobile Heating screen,
4. unified Docker-backed file upload system,
5. gas reading image/reference/invoice workflows,
6. reference-based analytics with VAT-aware cost calculation,
7. gas price history tracking on user profile.

Scope is `backend`, `apps/mobile`, and `frontend` only (exclude `apps/web`).

## Implementation Plan

### 1. Data model and migrations
1. Add `username` to `User`:
- `username String? @unique`
- Keep nullable for existing users.
- Enforce username for new registrations at application layer.

2. Add gas pricing fields/models:
- `User.gasPriceExVat Float?` (current snapshot for profile read/write).
- New `GasPriceHistory` model:
  - `id, userId, priceExVat, vatRate(default 0.17), effectiveFrom, effectiveTo?, source(MANUAL|INVOICE), gasReadingId?, createdAt`.
- Add relation from `User` to `GasPriceHistory`.

3. Extend `GasReading`:
- `meterImagePath String?`
- `meterImageMime String?`
- `meterImageOriginalName String?`
- `isInvoiceReference Boolean @default(false)`
- `referenceMonth DateTime?` (month key: first day of month)
- `invoicePdfPath String?`
- `invoicePdfMime String?`
- `invoicePdfOriginalName String?`
- `invoiceUploadedAt DateTime?`
- `invoiceGasPriceExVat Float?` (optional captured value from invoice flow)
- `@@unique([userId, referenceMonth])` (supports “one reference per month”; non-reference rows keep `referenceMonth = null`).

4. Extend `HeatingEvent`:
- `anomalyCheckedAt DateTime?` to avoid repeated closed-event anomaly reevaluation.

### 2. Backend: anomaly logic and heating status correctness
1. Update anomaly detection API:
- `detectAnomalies(context, startTime, phase: 'OPEN' | 'CLOSED')`.
- `OPEN` phase checks only: `OVERSHOOT`, `PROLONGED_IDLE`.
- `CLOSED` phase checks: `EARLY_STOP`, `RAPID_CYCLING`, and statistical anomalies as applicable.

2. Update `HeatingAnomalyCheckerService`:
- Keep `checkOpenIntervals()` for active events with `phase='OPEN'`.
- Add `checkRecentlyClosedIntervals()` cron for recently ended events where `anomalyCheckedAt` is null, evaluate with `phase='CLOSED'`, then set `anomalyCheckedAt`.
- Ensure no “ended earlier” alert for still-open sessions.

3. Fix user identity usage inconsistencies:
- Replace `req.user.id` with `req.user.userId` in heating/dashboard endpoints that currently use the wrong field.

4. Improve dashboard thermostat status payload:
- Include per-thermostat `isHeatingNow` computed from latest event (`timestampEnd === null`).

### 3. Backend: unified upload mechanism
1. Add upload infrastructure module/service:
- Base path from env `UPLOAD_ROOT_PATH` default `/usr/src/app/uploads`.
- Use safe filename generation (crypto random + sanitized extension).
- Enforce MIME + size limits:
  - Images: jpeg/png/webp, max 5MB.
  - Invoices: pdf, max 10MB.
- Save with deterministic folder scheme:
  - `gas-readings/{readingId}/{random}.{ext}` for meter images.
  - `gas-readings/{readingId}/invoice/{random}.pdf` for invoices.
  - `users/{userId}/{random}.{ext}` for user images (avatar-ready path reserved now).

2. Keep files private:
- Serve only via authenticated endpoints with ownership checks (no public static file serving).

### 4. Backend: auth and profile APIs
1. Auth changes:
- `POST /api/auth/register`: require `username` (validation rules).
- `POST /api/auth/login`: accept `identifier` (email or username) + password.
- Backward compatibility: if old clients send `email`, treat it as `identifier`.
- Login resolution: match by email OR username (case-insensitive normalization in service).
- Include `username` in auth responses and `/api/auth/me`.

2. User profile changes:
- `GET /api/user` includes:
  - `username`
  - `gasPriceExVat`
  - derived `gasPriceVatRate=0.17`
  - derived `gasPriceIncVat` (if price exists).
- `PUT /api/user` accepts:
  - `username?`
  - `gasPriceExVat?`
  - `gasPriceEffectiveFrom?` (optional, default now).
- On price update:
  - close previous active `GasPriceHistory` record (`effectiveTo`)
  - insert new history row with source `MANUAL`
  - update `User.gasPriceExVat`.

### 5. Backend: gas reading/reference/invoice endpoints
1. Create/extend gas reading create endpoint to support multipart:
- `POST /api/gas/reading`
- Fields: `counterValue`, `readingDate`, `markAsReference?`
- File: `meterImage?`
- Preserve JSON compatibility when no file is sent.

2. Reference operations:
- `PATCH /api/gas/reading/:id/reference` with `{ isReference: boolean }`.
- When setting true:
  - compute month key from reading date (user timezone if available, else UTC).
  - unset prior reference for same user+month in transaction.
  - set target reading as reference and set `referenceMonth`.
- When false:
  - unset `isInvoiceReference` and `referenceMonth`.

3. Invoice operations:
- `POST /api/gas/reading/:id/invoice` multipart:
  - file `invoicePdf`
  - optional `invoiceGasPriceExVat`
- Require reading to be current month reference or existing reference reading.
- Save invoice metadata/path.
- If `invoiceGasPriceExVat` provided:
  - create/adjust `GasPriceHistory` entry with source `INVOICE`, effective from reference month start.
- `DELETE /api/gas/reading/:id/invoice` remove DB linkage and file.
- `GET /api/gas/reading/:id/meter-image` authenticated download.
- `GET /api/gas/reading/:id/invoice` authenticated download.

4. Gas list response shape:
- Include flags/metadata needed by UI:
  - `isInvoiceReference`, `referenceMonth`, `hasMeterImage`, `hasInvoicePdf`, `invoiceUploadedAt`.

### 6. Backend: gas analytics update
1. Change default period behavior in `GET /api/gas/analysis`:
- If `from/to` absent:
  - use latest reference reading date as `from`.
  - use latest reading/current time as `to`.
  - if no reference exists: fallback last 30 days.
- Return `period.mode` to indicate which default was used.

2. Add reference-aware and VAT-aware totals:
- `consumptionFromReferenceM3`
- `costExVat`
- `vatAmount`
- `costIncVat`
- `referenceReading` object (id/date/counterValue) when available.
- `priceBreakdown` grouped by effective price period (from `GasPriceHistory`) for transparency.

3. Cost resolution rule:
- For each consumption interval between readings, apply price active at interval end timestamp.
- VAT fixed at 17%.

### 7. Mobile app changes (`apps/mobile`)
1. Auth:
- Login screen field becomes “Email or Username”.
- Register screen adds `username`.
- `AuthContext` and `apiClient` signatures switch to `identifier` login.

2. Heating screen:
- Fix thermostat activity mapping (`deviceId` instead of nonexistent `thermostatId`).
- Prefer backend `thermostat.isHeatingNow` when present.
- Keep recent sessions rendering unchanged.

3. Gas readings:
- `GasForm` supports:
  - meter image selection/upload
  - “mark as monthly invoice reference” toggle.
- Reading cards:
  - show reference badge
  - show meter image action
  - invoice upload/replace/delete actions for reference reading.
- Use authenticated file download/open flow.

4. Gas analytics:
- Default card highlights “From last reference to current”.
- Show consumption + cost incl/excl VAT + VAT amount.
- Display active gas price and source window.

5. Profile:
- Add editable `username`.
- Add `gasPriceExVat` input.
- Show computed price incl VAT and last price update info (from profile payload/history summary).

### 8. Web frontend changes (`frontend`)
1. Auth:
- Login form label/input becomes “Email or Username”.
- `AuthContext` + API client use `identifier`.

2. Profile page:
- Add `username`.
- Add `gasPriceExVat` field and show derived VAT-inclusive value.

3. Gas readings page/form/card:
- Add meter image upload on create.
- Add “mark reference” option.
- Add invoice upload/download/delete actions on reference reading.
- Show badges for reference/image/invoice.
- Align API paths to backend singular routes (`/gas/reading...`) and new endpoints.

4. Gas analytics page:
- Default presentation for last-reference-to-current window.
- Show VAT-aware totals and price breakdown summary.

### 9. Docker/config updates
1. Keep existing host mount:
- `/mnt/shared-app-files/boiler-control:/usr/src/app/uploads:rw`.
2. Add env/config docs:
- `UPLOAD_ROOT_PATH=/usr/src/app/uploads`.
3. Ensure startup creates needed base directories if missing.

## Public API / Interface Changes

### Auth
- `POST /api/auth/login` request: `{ identifier, password }` (accept legacy `{ email, password }`).
- `POST /api/auth/register` request adds `username`.
- Auth responses include `user.username`.

### User
- `GET /api/user` response adds `username`, gas price and VAT-derived fields.
- `PUT /api/user` request supports `username`, `gasPriceExVat`, `gasPriceEffectiveFrom`.

### Gas
- `POST /api/gas/reading` accepts multipart + optional `meterImage` + `markAsReference`.
- `PATCH /api/gas/reading/:id/reference`
- `POST /api/gas/reading/:id/invoice`
- `DELETE /api/gas/reading/:id/invoice`
- `GET /api/gas/reading/:id/meter-image`
- `GET /api/gas/reading/:id/invoice`
- `GET /api/gas/analysis` returns reference window + VAT-aware cost metrics.

### Response type additions
- Gas reading DTOs include:
  - `isInvoiceReference`, `referenceMonth`, `hasMeterImage`, `hasInvoicePdf`, `invoiceUploadedAt`.
- Dashboard thermostat DTO includes `isHeatingNow`.

## Test Cases and Scenarios

### Backend automated
1. Auth:
- login with email works.
- login with username works.
- duplicate username rejected.
- existing user without username can still login via email.

2. Anomaly:
- open event at 4 minutes does not trigger EARLY_STOP/RAPID_CYCLING.
- closed short event triggers RAPID_CYCLING only after end.
- closed under-average event triggers EARLY_STOP after end.
- open overshoot/prolonged-idle still detected.

3. Gas reference:
- setting reference enforces one-per-month rule.
- setting new reference in same month replaces old one transactionally.

4. Uploads:
- valid image/pdf accepted.
- invalid mime rejected.
- oversize rejected at 5MB/10MB limits.
- owner mismatch on download returns forbidden/not found.

5. Pricing/analytics:
- default analysis range uses latest reference.
- fallback to 30 days without reference.
- VAT 17% calculations correct.
- price history effective date selection applies correctly.

### Frontend/mobile verification
1. Login by email and username on mobile and `frontend`.
2. Heating screen status badge updates correctly while heating is active.
3. Add gas reading with/without image.
4. Mark reading as monthly reference and replace existing same-month reference.
5. Upload/download/delete invoice PDF on reference reading.
6. Analytics default window starts at last reference and shows cost + VAT.
7. Profile gas price update changes displayed VAT-inclusive value.

## Assumptions and Defaults
- Web scope is `frontend` only (not `apps/web`).
- Existing users are not forced to set username immediately.
- VAT is fixed to `17%` (`0.17` multiplier base).
- One invoice-reference reading per user per calendar month.
- Invoice PDF is optional when marking reference.
- Files are private and served only through authenticated endpoints.
- Upload limits are 5MB for images and 10MB for PDFs.
- Month-key for reference logic uses user timezone when available, otherwise UTC.
- Storage root inside container is `/usr/src/app/uploads`, mapped to host `/mnt/shared-app-files/boiler-control/`.
