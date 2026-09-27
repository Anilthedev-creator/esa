# ESA Engineering Services Australia

A full-stack web application for ESA Engineering, built with **Spring Boot 3** (Java 17) on the backend and plain **HTML / CSS / JavaScript** on the frontend, with a **Node.js fallback server** so `npm start` always works.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend (primary) | Spring Boot 3.2, Spring Data JPA, H2/PostgreSQL |
| Backend (fallback) | Node.js + Express (same API, same static files) |
| Database | H2 file-based by default (`./data/esa_db`), PostgreSQL optional |
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES6) |
| Build | Maven for Java, npm for Node |

## Why "Backend offline" happened & how it's fixed

The admin pages (`content.html`, `dashboard.html` etc.) call `/api/admin/*`. Previously (this section records the original state; the analytics items listed here have since been **removed entirely** — see the 2026-09-27 note below):

- Empty Java files (`Invoice.java`, `CustomerRepository.java` etc.) broke compilation
- `application.properties` hard-coded a local Postgres (`sobusdas/1234`) that doesn't exist in most dev machines
- Missing endpoints: `/api/admin/pages`, `/api/content`, `/api/bookings`, `/api/enquiries`, `/api/analytics/*`, `/api/admin/settings`, `/api/admin/analytics/activity`, customer/enquiry/payment detail + PATCH, page blocks CRUD
- Frontend `js/app.js` used `http://localhost:8080/auth/register` (hard-coded localhost, breaks in preview/proxy)
- No health check, no Node fallback, so `npm start` did nothing

**Fixes applied:**

1. **Removed 29 empty Java stubs** that prevented `mvn compile`
2. **Added H2 dependency** and switched default datasource to `jdbc:h2:file:./data/esa_db;MODE=PostgreSQL` so the app starts without Postgres. Postgres can still be used via env vars `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`
3. **New entities**: `CmsPage`, `CmsBlock`, `AnalyticsEvent`, `SiteSetting` + repositories + services (`CmsService`, `AnalyticsService`, `SettingsService`)
4. **Extended `ApiAdminController`**: now implements
   - `GET /api/admin/pages`, `POST /api/admin/pages`, `GET /api/admin/pages/{id}`, `PATCH /api/admin/pages/{id}`, `PUT /api/admin/pages/{id}/blocks`, `DELETE /api/admin/pages/{id}/blocks/{key}`
   - `GET /api/admin/customers/{id}`, `PATCH /api/admin/customers/{id}`
   - `GET /api/admin/enquiries/{id}`, `PATCH /api/admin/enquiries/{id}`
   - `GET /api/admin/payments/{id}`, `PATCH /api/admin/payments/{id}`
   - `GET /api/admin/analytics/activity?days=7|30`
   - `GET /api/admin/settings`, `PUT /api/admin/settings`
   - `GET /api/health`, `GET /api/admin/health`
5. **New public controllers**:
   - `ApiPublicController`: `POST /api/bookings`, `GET /api/bookings/{id}`, `POST /api/enquiries`, `POST /api/payments/{id}/confirm`
   - `ApiContentController`: `GET /api/content?slug=contact.html` (reads `data-cms` attributes from static HTML and overlays DB overrides)
   - `ApiAnalyticsController`: `POST /api/analytics/track` (beacon + JSON)
6. **Fixed models**: `Booking` now has `phone`, `status`, `createdAt`; `Contact` has `status`, `reply`, `createdAt`; `Payment` has `customerName`, `status`, `bookingId`
7. **Fixed `AboutService`**: `getOrCreate()` prevents `IndexOutOfBoundsException` when table empty
8. **Fixed `BookingController` & `ContactController`**: correct `@PathVariable` names, added `@CrossOrigin`
9. **Node fallback (`server.js` + `package.json`)**: Express server serves `src/main/resources/static` and implements **identical** API endpoints with file-based JSON persistence in `./data/*.json`. Now `npm start` works flawlessly even without Java.
10. **Frontend fixes**:
    - `admin-data.js`: updated offline banner message (`npm start` **or** `mvn spring-boot:run`) + Retry button
    - `js/app.js`: switched from hard-coded `http://localhost:8080/auth/register` to relative `/api/auth/signup`
    - `content.js` already handles map format

Result: frontend and backend communicate flawlessly on same origin (`http://localhost:8080`), no CORS issues, no "Backend offline" when server is running.

## Startup crash: `Table "site_settings" not found` (fixed)

**Symptom** — the app died during startup with:

```
ApiAdminController.<init> → cmsService.ensureDefaultPages() + settingsService.ensureDefaults()
→ repo.existsById() → SELECT ... FROM site_settings → Table "site_settings" not found
```

**Cause** — three things, and the last one is the sneaky one:

1. **DB calls in a controller constructor.** Spring builds the `EntityManagerFactory` (which runs the DDL and creates the tables) *after* controller beans are instantiated. `ApiAdminController` and `ApiContentController` called `ensureDefaultPages()` / `ensureDefaults()` from their constructors, i.e. before the tables existed.
2. **An H2 URL that fought `H2Dialect`.** The URL carried `MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH`. Those H2 compatibility flags disagreed with `org.hibernate.dialect.H2Dialect`, so Hibernate's `ddl-auto=update` did not add the new tables to a database file created by an earlier run.
3. **Reserved words as column names.** `SiteSetting` declared columns named `key` and `value`, and `CmsBlock` declared one named `value`. `KEY` and `VALUE` are **reserved words in H2 2.x**, so Hibernate's unquoted DDL —

   ```sql
   create table site_settings (key varchar(255) not null, value varchar(2000), primary key (key))
   ```

   — is a syntax error. Hibernate **logs the failed `CREATE TABLE` and then boots normally**, so the app starts, every other table gets created, and `site_settings`/`cms_blocks` silently never exist. This is why the settings panel was still broken after fixing (1): the *timing* was fixed but the *table* was still never created. H2's non-fatal DDL behaviour turns a one-line schema mistake into a confusing runtime error much later.

**Fixes applied:**

1. **Removed all DB calls from controller constructors** (`ApiAdminController`, `ApiContentController`) — constructors now only assign fields.
2. **Added `DataInitializer`** (`CommandLineRunner`, `@Order(2)`), which runs *after* the `EntityManagerFactory` is built and therefore after the tables exist. It calls `cmsService.ensureDefaultPages()` and `settingsService.ensureDefaults()`, each in its own `try/catch` so a failure never aborts the boot.
3. **Renamed the reserved columns**: `key` → `setting_key`, `value` → `setting_value` (on `SiteSetting`) and `value` → `block_value` (on `CmsBlock`). The Java field names and the JSON keys the API serves (`key`, `value`, `siteName`, `adminEmail`, …) are unchanged, so no frontend change was needed.
4. **`AdminBootstrap` is now `@Order(1)`** so the first administrator is created before pages/settings are seeded.
5. **Made the seeding methods resilient** — `hasAdministrator()`, `ensureDefaultPages()` and `ensureDefaults()` catch `RuntimeException` and log (`noRollbackFor` on the transactional methods so the swallowed exception cannot surface as `UnexpectedRollbackException`).
6. **`SettingsService.getSettings()` is no longer `readOnly`.** It calls `ensureDefaults()`, which *inserts*; in a read-only transaction those inserts are never flushed, so an empty table would render as blank settings instead of the defaults.
7. **Simplified the H2 URL** — `MODE=PostgreSQL` / `DATABASE_TO_LOWER` / `DEFAULT_NULL_ORDERING` are gone; the dialect is now overridable via `DB_DIALECT`:

```properties
spring.datasource.url=${DB_URL:jdbc:h2:file:./data/esa_db;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE}
spring.jpa.database-platform=${DB_DIALECT:org.hibernate.dialect.H2Dialect}
```

**Startup order is now:** Hibernate creates tables → `AdminBootstrap` (@Order 1) creates the admin → `DataInitializer` (@Order 2) seeds pages + settings **and logs the resulting row counts** → HTTP traffic.

### If it still looks broken, check these in order

1. **`rm -rf data` and restart.** This is required, not optional — your `./data/esa_db.mv.db` was written under the old schema and the old column names, and `ddl-auto=update` cannot migrate them. (`data/` is gitignored; nothing tracked is lost.)
2. **Look for `CMS ready:` / `Settings ready:` in the boot log.** Those lines come from `DataInitializer` and print the row counts. If instead you see `site_settings is still EMPTY after seeding`, scroll up for a Hibernate DDL error — that is the real cause.
3. **Confirm the tables exist** at `/h2-console` (JDBC URL `jdbc:h2:file:./data/esa_db`, user `sa`, empty password): `SHOW TABLES;` should list `site_settings`, `cms_pages`, `cms_blocks`, `users`, `bookings`, `contacts`, `payments`. (The old `analytics_events` table is gone — see the analytics removal note below.)
4. **Hit the endpoint directly** to separate backend from frontend:
   ```bash
   TOKEN=$(curl -s -X POST localhost:8080/api/auth/signin \
     -H 'Content-Type: application/json' \
     -d '{"email":"admin@esaengineering.com.au","password":"Admin123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)
   curl -s localhost:8080/api/admin/settings -H "Authorization: Bearer $TOKEN"
   ```
   You should get `{"settings":{"siteName":"ESA Engineering","adminEmail":"…","timezone":"Australia/Melbourne","language":"en-AU"}}`. A 500 with "table not found" means the table still isn't there; a `{}` means the table exists but is empty.

### H2 reserved words to avoid as column names

H2 2.x rejects these unquoted in DDL — the ones that bite JPA projects most often are **`KEY`**, **`VALUE`**, **`ORDER`**, **`USER`**, **`GROUP`**, **`YEAR`**, **`MONTH`**, **`DAY`**, **`HOUR`**, **`MINUTE`**, **`SECOND`**, **`LIMIT`**, **`OFFSET`**, **`TOP`**, **`ROW`**, **`TABLE`**, **`DEFAULT`**, **`PRIMARY`**, **`UNIQUE`**, **`CHECK`**, **`CONSTRAINT`**, **`VALUES`**, **`WHEN`**, **`WHERE`**, **`WITH`**. The authoritative list is in the H2 docs (Reserved Words). Prefer suffixed names: `setting_key`, `block_value`, `sort_order`, `user_role`.

If you must keep a reserved name, either quote it explicitly (`@Column(name = "\"key\"")`) or set `hibernate.auto_quote_keyword=true` — but a plain rename is the least surprising option.

## Security hardening (2026-09-27)

An end-to-end audit of all 59 Java files found that authentication was effectively absent. All of the following are fixed.

### What was wrong

*(This is the audit snapshot as it was found. The analytics items in row 6 have since been removed entirely — see the 2026-09-27 note below.)*

| # | Issue | Where |
|---|-------|-------|
| 1 | **Every `/api/admin/*` endpoint was open.** The guard returned early when no `Authorization` header was sent, so `curl` with no header read all customers, enquiries and payments | `ApiAdminController.checkAdminIfTokenPresent()` |
| 2 | **Anyone could create an administrator.** `POST /api/auth/create/admin` had no check at all, and `accountAdmin.html` called it with no token | `ApiAuthController.createAdmin()` |
| 3 | **Site content was writable by anyone.** All 12 `PUT /about/*` endpoints were unauthenticated | `AboutController` |
| 4 | **The legacy `/auth` controller stored passwords in plain text** and compared them with `.equals()` | `AuthService` |
| 5 | **Unauthenticated data + delete endpoints**: `/admin/customers`, `/admin/stats`, `/bookings/get`, `/contact/get`, `/payments`, `/api/bookings`, plus every `DELETE` | legacy controllers |
| 6 | The analytics chart filled empty days with `Math.random()` — fabricated numbers presented as real data | `AnalyticsService` |

### What changed

- **New `AdminAccess` component** — the single gate in front of every admin endpoint. Missing header → 401, invalid/expired → 401, valid non-admin → 403. There is deliberately **no** "no token = allow" path.
- **`ApiAdminController`** now calls `adminAccess.requireAdmin(auth)` on all 19 endpoints.
- **`ApiAuthController.createAdmin`** requires an admin token.
- **All 12 `AboutController` writes** require an admin token.
- **Legacy controllers kept but locked down** (per your decision): reads and writes/deletes on `/admin`, `/bookings`, `/contact`, `/payments` now require an admin token. `/auth/register` and `/auth/login` stay public because that is what a login form needs.
- **`AuthService` now hashes passwords** via `PasswordHasher` and upgrades legacy plain-text rows on successful login — same behaviour as `/api/auth/*`.
- **Analytics no longer fabricates data.** Quiet days show as `0`.
- **`ApiPublicController.getBooking`** uses `PaymentRepository.findFirstByBookingId` instead of `findAll()` + a Java-side filter (was an O(n) table scan per request).
- **`CustomerDTO`** now actually joins phone/company from the matching `User` by email, as its Javadoc always claimed.
- **`TokenService`** reordered its payload to `userId|role|expires|email` with `split("\\|", 4)`. An email containing `|` used to produce 5 fields and fail every verification.
- **Constructor injection** replaces `@Autowired` field injection in `AboutController`, `AdminController`, `ContactService`.
- **Deleted dead code**: `LoginReq` (no package declaration, unused), `PaymentStatus` (unused), `ChangePassword` (unused).
- **Frontend**: `aboutAdmin.js` and `createAdmin.js` now send `Authorization: Bearer <token>` and redirect to `signin.html` when there is no session. `signin.html`'s `next` whitelist now includes those two pages.

### Tests added

`src/test/java/` (there were none):

- `PasswordHasherTest` — format, random salt, plaintext never stored, correct/incorrect password, malformed stored values, legacy plain-text upgrade path
- `TokenServiceTest` — round-trip, Bearer prefix, tampered payload, wrong secret, structurally broken tokens, expiry, and a **regression test for the `|`-in-email bug**
- `AdminAccessTest` — the missing/blank/garbage header cases that used to be waved through, admin passes, customer gets 403, expired gets 401

Run with `mvn test`.

### Impact on how you use the app

Direct `curl` against `/api/admin/*` now needs a token:

```bash
TOKEN=$(curl -s -X POST localhost:8080/api/auth/signin -H 'Content-Type: application/json' \
  -d '{"email":"admin@esaengineering.com.au","password":"Admin123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)
curl -s localhost:8080/api/admin/settings -H "Authorization: Bearer $TOKEN"
```

The browser UI is unaffected — `admin-data.js` already attaches the token and its guard redirects to `signin.html` when there is none.

### Known remaining items

- **No rate limiting** on `/api/auth/signin`, `/api/bookings`, `/api/enquiries`.
- **No token revocation** — logout is client-side only; a stolen token is valid until it expires (`app.auth.token-ttl-hours`).
- **`confirmPayment` accepts any 12+ digit number** — simulated validation, not real payment processing.
- **Some endpoints still return JPA entities directly** (`getEnquiryPublic`, `listBookings`, legacy controllers). No lazy-loading risk today (no relations on those entities), but it leaks internal fields.
- **`app.auth.token-secret` is a checked-in default** — set it via env var in any real deployment.

## Analytics removed, payments wired up, customer portal added (2026-09-27)

### Analytics — removed entirely

The analytics page measured nothing, so it has been deleted rather than repaired.

What was wrong:

- `tracking.js` was loaded by **exactly one page** (`payment.html`). Nothing else emitted a beacon, so the "visits" series was a count of people who had already reached step 2 of a booking.
- `/api/admin/analytics/activity` fabricated its numbers: `Math.random()` filled in any day with no recorded hits, so the chart moved even with zero traffic.
- The dashboard's "site activity" trend and chart were drawn from that same feed.

Deleted: `analytics.html`, `tracking.js`, `AnalyticsService`, `ApiAnalyticsController`, `AnalyticsEvent`, `AnalyticsEventRepository`, the `/analytics/activity` endpoint, the `renderAnalytics` renderer and the CSV export in `admin-data.js`, every Analytics nav link, and the analytics-only CSS rules.

**What replaced the dashboard chart.** Rather than leave the dashboard with a dead chart, its trend now uses real booking rows: `GET /api/admin/stats` additionally returns `bookingsByDay` (bookings per day for the last 14 days), `bookingsThisWeek` and `bookingsLastWeek`. The dashboard draws the same single-series chart from `bookingsByDay` and the trend reads "N bookings vs last week". These are honest counts of rows that exist, not estimates.

### Payments — the booking flow now reaches the payment page

`payment.html` and `payment.js` existed and were wired to live endpoints, but nothing ever navigated to them:

- `main.js` showed a thank-you note after `POST /api/bookings` and **never redirected**, so a booking was created with a `PENDING` payment and no customer ever saw the payment page.
- `booking-success.html` implied there was no payment step.

Now: a successful `POST /api/bookings` redirects to `payment.html?booking=<id>`. Enquiries (`/api/enquiries`) still just show a thank-you note — only the booking endpoint redirects. The portal's "Pay" button navigates to the same URL, so an outstanding fee can be paid later, not just immediately after booking.

**The consultation fee is now configurable at $50.** It was hard-coded as `250` in `ApiPublicController` (two places) and in the Node fallback, while `payment.html` already displayed a `$50` placeholder. The value now comes from:

```properties
app.booking.consultation-fee=50
```

`ApiPublicController` injects it with a `@Value` default of `50`, and uses it both when creating the `Payment` row and as the fallback when a booking has no payment row. The Node fallback reads `CONSULTATION_FEE` (default `50`). Change the property, not the Java.

### Customer portal — new self-service area

`portal.html` + `portal.js` + `ApiPortalController` (`/api/portal`) + `PortalService` + `PortalAccess`. The backend is scoped entirely by the email inside the bearer token; the frontend never sends a customer identity of its own.

A customer can:

- see their own bookings, enquiries and payments, plus an overview with totals and any outstanding fee
- **pay an outstanding fee** (navigates to `payment.html?booking=<id>`)
- **cancel their own booking** while it is still pending or confirmed and unpaid
- **reopen their own enquiry** once our team has marked it resolved
- edit their own profile (name, phone, company)
- change their own password (current password required)

An administrator browsing the portal sees exactly what a customer sees — their own rows.

Two deliberate restrictions:

- **Email is not editable.** It is the key the entire portal is scoped by, so changing it would silently orphan the customer's bookings and enquiries.
- **A paid booking cannot be cancelled from the portal.** Cancelling a paid booking means a refund, which is a human decision. The customer is told to call instead.

Rows belonging to someone else return **404, not 403**, so guessing booking or enquiry ids reveals nothing about other customers.

`Payment` has no email column, so portal payments are resolved by joining on the customer's booking ids (`PaymentRepository.findByBookingIdIn`). Matching on `customerName` would have leaked payments from anyone with a similar name.

### Sign-in and the header are now role-aware

Previously every signed-in user was sent to `dashboard.html` — the admin console — including customers, who cannot use it.

- `signin.html` now redirects by the role in the sign-in response: administrators to `dashboard.html`, everyone else to `portal.html`. An explicit `?next=` still wins.
- `main.js` `updateHeaderButtons()` builds the same choice, so the header link says "My Portal" for a customer and "Dashboard" for an administrator.
- The admin guard in `admin-data.js` already redirected non-admins away from the admin pages, so the two directions now agree.

### Node fallback

`server.js` got the matching treatment: the analytics routes and the `analytics` JSON store are gone, the fee uses `CONSULTATION_FEE` (default 50), and all eleven `/api/portal/*` routes are implemented against the JSON files. Its `requireAdmin` middleware had the same "no Authorization header = dev open" hole the Spring side had, and that is now closed too — a missing token is a 401.

## Project Structure

```
├── src/main/java/com/esaengineering/
│   ├── api/                # REST API (admin, auth, public, content, portal, health)
│   ├── config/             # CORS, AppConfig (TokenService), DatabaseConfig
│   ├── controller/         # Legacy controllers (/about, /bookings, /contact)
│   ├── model/              # JPA entities + CMS entities
│   ├── repository/         # Spring Data JPA
│   ├── security/           # PasswordHasher, TokenService
│   ├── service/            # Business logic + CmsService, SettingsService
│   └── web/                # ApiException, ApiExceptionHandler
├── src/main/resources/
│   ├── application.properties
│   └── static/             # Frontend (served by both Spring Boot and Node)
│       ├── admin-data.js   # Admin portal wiring (now resilient)
│       ├── auth.js         # Session layer
│       ├── content.js      # CMS public loader
│       ├── main.js         # Public site interactions + role-aware header
│       ├── portal.js       # Customer portal (own bookings/enquiries/payments)
│       ├── payment.js      # Step 2 of the booking flow
│       └── *.html          # incl. portal.html (customer) and payment.html
├── server.js               # Node fallback (Express)
├── package.json            # npm start
├── pom.xml
└── data/                   # H2 DB file + Node JSON persistence (gitignored)
```

## Quick Start

### Option A: Node fallback (fastest, no Java needed)

```bash
npm install
npm start
# open http://localhost:8080
# admin: admin@esaengineering.com.au / Admin123
```

### Option B: Spring Boot (primary)

```bash
# H2 by default (no Postgres needed)
mvn spring-boot:run
# or
./mvnw spring-boot:run

# To use Postgres:
DB_URL=jdbc:postgresql://localhost:5432/esa_database \
DB_USERNAME=your_user \
DB_PASSWORD=your_pass \
DB_DRIVER=org.postgresql.Driver \
mvn spring-boot:run
```

The app starts on **http://localhost:8080**.

### Access

| Page | URL |
|------|-----|
| Home | /index.html |
| Services | /services.html |
| Contact | /contact.html |
| Sign In | /signin.html |
| Sign Up | /signup.html |
| Customer Portal | /portal.html |
| Payment (step 2) | /payment.html?booking=&lt;id&gt; |
| Admin Dashboard | /dashboard.html |
| Content Management | /content.html |
| API Health | /api/health |

### Default Admin

- Email: `admin@esaengineering.com.au`
- Password: `Admin123`
- Created on first startup if no ADMIN exists (see `AdminBootstrap` and Node `ensureAdmin()`)

## API Endpoints (now fully implemented)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register |
| POST | `/api/auth/signin` | Sign in (returns token) |
| GET | `/api/auth/me` | Current user (Bearer token) |
| POST | `/api/auth/logout` | Sign out |
| POST | `/api/bookings` | Create booking (public) |
| GET | `/api/bookings/{id}` | Get booking + payment |
| POST | `/api/enquiries` | Submit contact form |
| POST | `/api/payments/{id}/confirm` | Confirm payment |
| GET | `/api/content?slug=contact.html` | Public CMS blocks |
| GET | `/api/admin/stats` | Dashboard stats |
| GET | `/api/admin/customers` | List customers |
| GET | `/api/admin/customers/{id}` | Customer detail |
| PATCH | `/api/admin/customers/{id}` | Update customer |
| GET | `/api/admin/enquiries` | List enquiries |
| GET | `/api/admin/enquiries/{id}` | Enquiry detail |
| PATCH | `/api/admin/enquiries/{id}` | Update enquiry (status/reply) |
| GET | `/api/admin/payments` | List payments |
| GET | `/api/admin/payments/{id}` | Payment detail |
| PATCH | `/api/admin/payments/{id}` | Update payment |
| GET | `/api/admin/pages` | List CMS pages |
| POST | `/api/admin/pages` | Create page |
| GET | `/api/admin/pages/{id}` | Page + blocks |
| PATCH | `/api/admin/pages/{id}` | Update page status |
| PUT | `/api/admin/pages/{id}/blocks` | Save blocks |
| DELETE | `/api/admin/pages/{id}/blocks/{key}` | Reset block |
| GET | `/api/admin/settings` | Get settings |
| PUT | `/api/admin/settings` | Save settings |
| GET | `/api/portal/me` | Own profile (bearer token) |
| PUT | `/api/portal/profile` | Update own profile |
| POST | `/api/portal/password` | Change own password |
| GET | `/api/portal/bookings` | Own bookings |
| GET | `/api/portal/bookings/{id}` | Own booking + payment |
| POST | `/api/portal/bookings/{id}/cancel` | Cancel own unpaid booking |
| GET | `/api/portal/enquiries` | Own enquiries |
| POST | `/api/portal/enquiries/{id}/reopen` | Reopen own resolved enquiry |
| GET | `/api/portal/payments` | Own payments |
| GET | `/api/portal/summary` | Everything above in one call |
| GET | `/api/health` | Health check |

## Frontend ↔ Backend Communication

- **Same origin**: both Spring Boot and Node serve static files and API from `http://localhost:8080`, so no CORS issues in production. `CorsConfig` allows `*` for dev.
- **Auth**: `auth.js` stores `token` in `localStorage`, sends `Authorization: Bearer <token>` to admin APIs. `ApiAdminController` verifies via `TokenService`.
- **Content**: `content.js` fetches `/api/content?slug=...` and injects into `[data-cms]` elements. Admin edits via `PUT /api/admin/pages/{id}/blocks`.
- **Forms**: `main.js` handles `data-local-submit` + `data-api` forms (`/api/bookings`, `/api/enquiries`) with JSON.
- **Payments**: `main.js` redirects to `payment.html?booking=<id>` after a successful `POST /api/bookings`; `payment.js` loads the booking from `/api/bookings/{id}` and posts the card to `/api/payments/{id}/confirm`.
- **Portal**: `portal.js` attaches the bearer token from `auth.js` to every `/api/portal/*` call. The server scopes each response to the email inside that token; the client never sends a customer identity.

## Troubleshooting "Backend offline"

1. Ensure server is running: `npm start` **or** `mvn spring-boot:run`
2. Check health: `curl http://localhost:8080/api/health`
3. If pages still show demo data, open DevTools → Network tab, look for failed `/api/admin/*` calls
4. Verify token: `localStorage.getItem('token')` in console, then `fetch('/api/auth/me', {headers:{Authorization:'Bearer '+token}})`
5. Hard reload: Ctrl+Shift+R

## License

Proprietary — ESA Engineering Services Australia.
