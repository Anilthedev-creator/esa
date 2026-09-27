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

The admin pages (`content.html`, `dashboard.html` etc.) call `/api/admin/*`. Previously:

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
3. **Confirm the tables exist** at `/h2-console` (JDBC URL `jdbc:h2:file:./data/esa_db`, user `sa`, empty password): `SHOW TABLES;` should list `site_settings`, `cms_pages`, `cms_blocks`, `analytics_events`.
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

## Project Structure

```
├── src/main/java/com/esaengineering/
│   ├── api/                # REST API (admin, auth, public, content, analytics, health)
│   ├── config/             # CORS, AppConfig (TokenService), DatabaseConfig
│   ├── controller/         # Legacy controllers (/about, /bookings, /contact)
│   ├── model/              # JPA entities + new CMS entities
│   ├── repository/         # Spring Data JPA
│   ├── security/           # PasswordHasher, TokenService
│   ├── service/            # Business logic + CmsService, AnalyticsService, SettingsService
│   └── web/                # ApiException, ApiExceptionHandler
├── src/main/resources/
│   ├── application.properties
│   └── static/             # Frontend (served by both Spring Boot and Node)
│       ├── admin-data.js   # Admin portal wiring (now resilient)
│       ├── auth.js         # Session layer
│       ├── content.js      # CMS public loader
│       ├── main.js         # Public site interactions
│       ├── tracking.js     # Analytics beacon
│       └── *.html
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
| POST | `/api/analytics/track` | Track page view |
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
| GET | `/api/admin/analytics/activity?days=7` | Activity chart |
| GET | `/api/admin/settings` | Get settings |
| PUT | `/api/admin/settings` | Save settings |
| GET | `/api/health` | Health check |

## Frontend ↔ Backend Communication

- **Same origin**: both Spring Boot and Node serve static files and API from `http://localhost:8080`, so no CORS issues in production. `CorsConfig` allows `*` for dev.
- **Auth**: `auth.js` stores `token` in `localStorage`, sends `Authorization: Bearer <token>` to admin APIs. `ApiAdminController` verifies via `TokenService`.
- **Content**: `content.js` fetches `/api/content?slug=...` and injects into `[data-cms]` elements. Admin edits via `PUT /api/admin/pages/{id}/blocks`.
- **Forms**: `main.js` handles `data-local-submit` + `data-api` forms (`/api/bookings`, `/api/enquiries`) with JSON.
- **Analytics**: `tracking.js` uses `navigator.sendBeacon` to `/api/analytics/track`.

## Troubleshooting "Backend offline"

1. Ensure server is running: `npm start` **or** `mvn spring-boot:run`
2. Check health: `curl http://localhost:8080/api/health`
3. If pages still show demo data, open DevTools → Network tab, look for failed `/api/admin/*` calls
4. Verify token: `localStorage.getItem('token')` in console, then `fetch('/api/auth/me', {headers:{Authorization:'Bearer '+token}})`
5. Hard reload: Ctrl+Shift+R

## License

Proprietary — ESA Engineering Services Australia.
