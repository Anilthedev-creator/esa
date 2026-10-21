# ESA Engineering Services Australia

This repository contains the ESA public website, customer portal and admin pages. The frontend is plain HTML, CSS and JavaScript. The main backend is Spring Boot (Java 17); a Node.js server is also included for local development and environments without Java.

## Run locally

You need Node.js 20 or later for the Node server. To use the Java server, install Java 17 and Maven.

```sh
npm ci
npm start
```

Open <http://localhost:8080>. The Node server stores its JSON data under `data/` by default. Set `ESA_DATA_DIR` to use a different private folder.

To run the Java backend instead, stop the Node server and run:

```sh
mvn spring-boot:run
```

Spring Boot uses an H2 database at `data/esa_db` by default. Set `DB_URL`, `DB_USERNAME` and `DB_PASSWORD` to use another database. Do not run both servers on port 8080 at the same time.

Run the Node checks with:

```sh
npm test
```

Run the Java checks with `mvn test` when Java 17 and Maven are available.

## Production setup

Set a unique `JWT_SECRET`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` before running either backend in production. Keep credentials out of Git. Turn off the demo card route with `ESA_DEMO_CARD_PAYMENTS=false` and keep `ESA_DEMO_EMAIL_PREVIEW=false`. Use HTTPS and protect the database, uploaded files and backups.

Set `PUBLIC_SITE_URL` to the official site origin, such as `https://example.com`, to enable the sitemap. The application does not guess ESA's public domain.

## Enquiry email

The enquiry form records the enquiry, then tries to send an acknowledgement to the customer and a notice to ESA. To deliver email, configure these server environment variables:

| Variable | Purpose |
|---|---|
| `SMTP_HOST` | SMTP server name |
| `SMTP_PORT` | SMTP port (defaults to 587) |
| `SMTP_USER` | SMTP username, if required |
| `SMTP_PASSWORD` | SMTP password, if required |
| `MAIL_FROM` | Sender address (defaults to `SMTP_USER`) |
| `ENQUIRY_NOTIFY_EMAIL` | ESA notification address (defaults to `ADMIN_EMAIL`) |

Both backends accept `SMTP_SECURE=true` for an implicit TLS connection such as port 465. Spring Boot also uses `SMTP_AUTH` and `SMTP_STARTTLS` (both default to `true`). For port 465, use the settings required by your provider, often `SMTP_SECURE=true` and `SMTP_STARTTLS=false`. Never commit SMTP credentials.

Without SMTP settings, messages are **not emailed**. The server writes private copies to `data/outbox/` and the form says that no email was sent. If SMTP delivery fails, it also saves a copy there and reports the failure. The outbox is for staff to review; it is not a retry queue and does not send messages later by itself. Real delivery needs a working SMTP account and deployment configuration.

## Booking rules

- Customers can request a start time every 30 minutes from 9:00 am to 4:30 pm, Melbourne time. 5:00 pm is the closing time, not a bookable start time.
- A requested time is not confirmed until ESA reviews the booking.
- Customers can reschedule until 90 minutes before the original requested time. After that, the portal hides the reschedule action and the server rejects changes. A new requested time must also be more than 90 minutes away.
- Older bookings that do not have a saved time use 5:00 pm as the cutoff reference.

## Payments and CMS limits

The built-in card form is a demo and is not connected to a payment provider. Do not enter real card details. Bank-transfer references remain pending until a staff member checks them.

The CMS stores page records and text blocks. It does not create a new HTML file or build a new page. A page record must match an existing static file before that page can be shown by the website. The project card renderer only uses local images under `src/main/resources/static/images/`.

## Stored information

Node data, uploads and outbox messages are stored under `data/` by default. Spring Boot uses H2 under `data/`, and its upload and outbox files also use that folder. These files are excluded from Git. Choose private, backed-up storage and set a retention process before using real customer data. Review `src/main/resources/static/privacy-policy.html` and have it checked against ESA's actual hosting and business practices before launch.
