# ESA site implementation audit

This file tracks the main fixes and the work that still needs real deployment or business verification. It replaces the older page-by-page notes, which described code that has since changed.

## Implemented in this update

- **Accounts:** customer signup and portal flows use the customer role, password rules are checked by the backend, and protected pages use the signed-in account.
- **Safe rendering:** CMS text and project cards are rendered as text or built with DOM nodes rather than inserted as untrusted HTML. Project images are limited to local files under `/images/`.
- **Admin data:** dashboard totals use customer, upcoming-booking, open-enquiry and completed-payment data. Node and Spring expose matching metric names; the older Spring `/admin/stats` route now uses the same source and retains its older metric aliases.
- **Enquiries and uploads:** public submission sizes and file types are checked on the server, submissions are rate-limited, and uploaded files are kept with private server data. The form links to the privacy notice and reports whether emails were sent or saved locally.
- **Email:** optional SMTP delivery sends the customer acknowledgement and ESA notification. When SMTP is missing or a send fails, private outbox copies are saved when possible. The outbox is manual follow-up, not an automatic retry queue.
- **Bookings:** the date and slot are required. Starts are available every 30 minutes from 9:00 am to 4:30 pm Melbourne time. The portal hides rescheduling inside the 90-minute cutoff and both backends reject a late change or a replacement time within 90 minutes.
- **CMS:** the editor explains that a page record does not create an HTML page. Public rendering does not expose draft text.
- **Privacy, payment and SEO:** the policy describes current data flows and demo payment limits; the demo card route is blocked in production configuration; sitemap links use `PUBLIC_SITE_URL` rather than an invented domain.
- **Accessibility and feedback:** form labels, field limits, action names and empty/error states have been improved across the public and admin pages. Filters and pagination are wired to the displayed data.

## Before a real launch

1. **Configure and test SMTP.** Set the provider credentials and sender/recipient addresses outside Git. Test both customer and ESA delivery, SMTP failure, and the private outbox on the actual host. Outbox messages need a staff member to review and send them manually.
2. **Connect a real payment provider.** The built-in card flow is a demo and must not be used for real payment data. Keep `ESA_DEMO_CARD_PAYMENTS=false` in production.
3. **Finish CMS page publishing if needed.** The current CMS can store records and edit text blocks for existing static pages; it does not generate a new page file or publish arbitrary new routes.
4. **Verify business and legal content.** ESA should confirm service claims, staff details, project descriptions, contact information, privacy retention practices, hosting region and third-party services. The privacy notice is a working draft, not legal advice.
5. **Review deployment security.** Use HTTPS, unique administrator credentials and JWT secret, private persistent storage and protected backups. Confirm the retention and access rules for enquiries, uploads and email outbox files.
6. **Run the Java suite in a Java 17/Maven environment.** Maven, Java and `javac` were unavailable in the implementation environment, so Java changes and tests have not been compiled here. Node checks are available with `npm test`.
7. **Do a final accessibility and browser pass.** Check all pages with keyboard-only navigation, a screen reader, mobile layouts and supported browsers. Some legacy pages may still need detailed accessibility review.

## Verification notes

- `npm test` covers the Node API, booking slots, rescheduling cutoff, enquiry outbox behavior, account/data persistence and production safety checks.
- `node --check` should be run on changed JavaScript files after edits.
- Run `git diff --check` before merging.
- A passing local test does not verify real SMTP, card processing, deployment storage or ESA's business claims.
