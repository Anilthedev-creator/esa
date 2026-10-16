# ESA website audit — 9 October 2026

## Scope and confidence

Reviewed all **34 HTML pages**, their linked front-end scripts, the Node fallback routes in `server.js`, and the corresponding Spring controllers/services. The audit included a jsdom load pass for all 34 pages (with logged-in customer/admin states), basic interactions on projects filters, contact wizard, booking time chips, payment tabs, portal tabs and the case-study form, plus local-link/asset and markup checks.

**Results:** all 34 pages loaded without a JavaScript runtime exception in that pass; local `src`/`href` targets resolved; there were no duplicate IDs. This is not a visual browser/device test: jsdom does not lay out CSS, test actual screen-reader behaviour, or verify the Spring app compiles/runs. The Spring code could only be inspected statically in this environment.

The original audit found API security and privacy problems before this implementation wave. I verified the unauthenticated Node responses locally: `GET /api/bookings`, `GET /api/bookings/1`, `GET /api/payments/1`, and a valid `POST /api/auth/create/admin` all returned **200 without a token**. A temporary audit admin was created to prove the route and is removed when test data is cleaned up.

---

## Implementation status — first improvement wave (9 October 2026)

The findings below record the pre-remediation audit. This first code wave has now:

- Secured customer booking creation and booking/payment/enquiry detail lookups to the signed-in owner in Node and Spring; booking email is taken from the verified session, not the form. The legacy About write routes now require admin authorization in both backends.
- Made booking lists/admin creation admin-only; added production checks for the JWT secret and first-admin credentials in both backends, and removed the prefilled sample admin password from the admin form.
- Made transfer logging idempotent, persisted its reference/date, blocked card payment and portal cancellation while a transfer is pending, and kept sandbox card data to the last four digits only.
- Added backend validation for preferred booking dates/time slots and allowed the portal to clear a saved time preference. Updated the payment/receipt pages to use the owner token, escape displayed customer data, and clearly label a pending transfer as an acknowledgement rather than a paid receipt.

**Verification:** `npm test` passes (Node API ownership/state tests plus production-startup checks). Spring/JUnit tests have been added for ownership, payment-state transitions, bootstrap secrets and admin checks, but could not be run here because Maven and the Java/JDK tools are not installed. Treat the Spring code as not compile-verified until those tests run in a Java environment.

Still open from the audit: forced first-login password rotation, XSS hardening for public project/CMS content, broader admin-data accuracy and filters, and the remaining page-by-page visual/accessibility/content work. The broader redesign has not been started.

## Security findings from the pre-remediation audit

### P0 — anyone could create an administrator on the Node fallback

Before remediation, `server.js:296–311` handled `POST /api/auth/create/admin` without `requireAdmin`. `createAdmin.js` sent a bearer token and redirected the page when no token was in localStorage, but browser JavaScript is not a security boundary; a direct request succeeded without it. I verified this with a no-token POST returning 200. The Spring version already called `adminAccess.requireAdmin` (`ApiAuthController.java:140–143`), so the two backends disagreed.

**Status:** Addressed in this wave. Both APIs require an admin token; the page also redirects non-admin sessions. Node tests cover anonymous and customer-token requests; a Spring test was added but not run here.

**Fix:** put the admin check on the Node route, make the page role-aware too, and test unauthenticated, customer-token and admin-token cases. Remove the known development admin credential/default JWT secret before deployment (next item).

### P0 — built-in admin credentials and signing key were known

The Node fallback created `admin@esaengineering.com.au` with `Admin123` when no admin existed (`server.js:112–141`); the default JWT signing key was in source at `server.js:26`. Anyone who could reach a publicly deployed instance could use the known account and, because of the previous issue, mint another administrator.

**Status:** Production startup now refuses the demo signing key, missing first-admin credentials, and the sample account in the data store, in both backends. The local demo defaults remain available outside production. Forced password rotation is still open.

**Fix:** require a strong environment-provided secret and one-time admin bootstrap, force password rotation, and refuse to start in production with demo credentials/secrets.

### P0 — personal booking/payment data was enumerable without a session

On Node, `GET /api/bookings` returns the full bookings array (`server.js:812`), `GET /api/bookings/:id` returns a booking with name, email, phone and notes (`server.js:806–810`), and `GET /api/payments/:id` returns the full payment object (`server.js:923–927`). All three returned 200 without auth in the audit. IDs are sequential. The Node booking list is admin-only in Spring, but the by-ID booking and payment lookups are also public in `ApiPublicController.java:104–132, 299–302`; Spring additionally exposes `GET /api/enquiries/{id}` at `:196–199`.

The browser-only sign-in gate on `booking.html` did not protect these endpoints, and `POST /api/bookings` itself was also public in both backends. That allowed clients to bypass the intended account flow and choose another person's email.

**Status:** Addressed in this wave. The create endpoint now requires a customer token and uses the token email; booking/payment/enquiry detail reads return 404 for another customer. Booking list reads require an admin token.

**Fix:** use customer tokens and enforce booking ownership on every customer lookup; derive the email from the verified token rather than trusting the request body. Make list/detail admin routes consistently admin-only. Add negative API tests that prove anonymous users and one customer cannot read another customer's records.

### P0 — anyone could change payment/booking state by guessing an ID

Before remediation, `POST /api/payments/:id/confirm` and `/card` had no auth/ownership check in Node (`server.js:848–882, 884–921`) or Spring (`ApiPublicController.java:204–230, 233–297`). A caller could claim a transfer or make the demo card endpoint mark a payment complete and confirm its booking. A cancelled payment/booking could also be reactivated, and a pending transfer remained payable by card in the portal.

**Status:** Addressed in this wave. Payment routes require the booking owner, reject cancelled records, make transfer logging idempotent, and reject card payment while a transfer is pending. The portal hides pay/cancel actions during that pending state.

**Fix:** require the booking owner (or a signed one-time payment capability), check the booking/payment state, make operations idempotent, and have a deliberate “switch from transfer to card” path that explains the risk/cancels the transfer claim. The sandbox may remain fake, but it must not be an unauthenticated state-changing endpoint.

### P1 — the legacy About editor is separate from the shared CMS (write auth addressed)

Before remediation, the Node PUT handlers for `/about` and `/about/:field` did not call `requireAdmin`. The Spring `/about` routes already exist in `AboutController` and require `AdminAccess` (the earlier audit claim that Spring had no matching routes was incorrect). The editor still uses a legacy `aboutContent` shape that does not match the current public About page's CMS blocks.

**Status:** Node PUT routes now require admin authorization, matching Spring. The editor/CMS data-shape mismatch remains open.

### P1 — unescaped server/user content was inserted as HTML

Before remediation, `payment.js:84–105` built the booking summary with `innerHTML` and inserted the name/service/phone from the booking API without escaping. `receipt.html:93–114` did the same for customer/reference fields. `projects.js:41–57` builds public project cards from CMS/admin-supplied fields using raw `innerHTML` (`title`, `summary`, `location`, image URL); `content.js:27–31` also assigns saved HTML to `innerHTML` for `data-cms-html` blocks.

**Status:** Booking-summary and receipt values are now escaped. Public project/CMS rendering remains open and should be fixed before production.

**Fix:** render untrusted text with `textContent`/DOM nodes or escape every value in its exact HTML context; validate image URLs against the site's image directory. Only allow sanitized, explicitly trusted HTML for CMS blocks.

---

## Functional/data bugs across the site

1. **Customer signup ends in the admin console path.** `signup.html:139–143` always redirects to `dashboard.html`, despite signup creating a customer role. The admin guard then sends that customer back to `index.html` instead of their portal. Redirect new accounts to `portal.html` and correct “Redirecting to dashboard…” copy.
2. **Dashboard numbers are misleading in both backends.** `server.js:329–352` and `AdminDataService.java:55–67, 108–114` count every payment amount as revenue, including incomplete/unpaid fees; count every enquiry as “Pending Enquiries”; and count future bookings as active even if cancelled/completed. Count only completed payments as revenue, count open enquiries, and exclude cancelled/completed bookings.
3. **Node dashboard chart/trend data is missing.** `admin-data.js:624–640` reads `bookingsThisWeek`, `bookingsLastWeek`, and `bookingsByDay`; Spring returns them, but Node `adminStats()` does not. On Node the chart stays blank and the trend falls back to zero. Add the same fields in Node or make the UI accurately show “not available”.
4. **Contact attachment limit disagrees with the API body limit.** `contact.html:313` accepts a raw file up to 4 MiB, then base64 expands it to more than 5 MiB; Node JSON parsing is capped at 5 MiB (`server.js:33`). Large files the UI accepts will fail with a generic send error. Raise the request limit with a separate upload-size guard, or lower the front-end cap to roughly 3.5 MiB.
5. **Admin “Filter” buttons are decorative.** The buttons at `bookings.html:129`, `customers.html:129`, `payments.html:129`, and `enquiries.html:129` have no handler anywhere in the JS. Replace them with a working search/status filter or remove them until functional.
6. **Payment receipt eligibility/wording is ambiguous — addressed in this wave.** The portal still links to payment details for a pending transfer, but the page now labels it “Transfer acknowledgement”, says the transfer has not cleared, and warns against paying again by card. A completed payment gets the “Payment receipt” label.
7. **Rescheduling could not clear a chosen time slot — addressed in this wave.** Node and Spring now accept “No preference”, validate the allowed slots, and reject past/invalid dates.
8. **Mail is a local outbox, not email delivery.** The Node helper writes to `data/outbox` (`server.js:45–56`); Java uses the same stand-in. Booking, enquiry, transfer, reset, and card flows tell users that an email was sent, but nothing is delivered outside the server. Keep the project demo label honest; wire a real provider before claiming operational email.
9. **Settings mostly do not affect the site.** `settings.html:129–180` lets the admin edit site name, timezone and language, but only `adminEmail` is used by the app; the other values are saved but not applied. Either wire them through the UI/time logic or remove those controls.
10. **Content “Add New Page” creates metadata, not a usable page.** `admin-data.js:744–779` and `server.js:545–555` add a CMS record, but no static HTML/route is created; the page has no editable blocks and the URL falls through to the 404 page. Draft/published status also does not control the static page. Rename this to “Add page record” or implement real page rendering/preview/publishing.
11. **The legacy About editor is not connected to the current About page.** Public `about.html` uses CMS keys such as `about-heading`, `story-intro`, `bio-greg` (`about.html:70–98`); `aboutPageAdmin.html` edits a different legacy `aboutContent` shape (`story`, `heading1`, etc.). `js/aboutAdmin.js:47–62` puts saved text into placeholders, not values; its save function then sends all input values (blank unless retyped) in 12 sequential requests. Editing one field can clear the rest, and the current public About blocks do not consume those keys.
12. **Audit-log promise is stronger than the implementation.** `auditLog.html:66–68` says every admin change is recorded. Node logs selected mutations; Spring currently logs case-study actions only. The page should either accurately say which events are captured or the event coverage should be made consistent across both backends.
13. **Static demo rows are presented as if they were real.** `dashboard.html:195–257`, `customers.html:155+`, `payments.html:150+`, and `enquiries.html` contain fictional names and values. They are replaced when the API loads, but remain if it fails; the $15,000 payment samples particularly conflict with the $50 fee. Show an explicit “sample data” state or clean empty/loading states instead.

---

## Page-by-page notes (all 34 HTML pages)

### Public site and customer journey

1. **`index.html`** — Good: has a page description and structured business data. The hero/sections repeat the same 22+, $80M+ figures in multiple places (`:112–139, 207–230`); use fewer, sourced proof points. The skip target is a `<section>` rather than a `<main>`; add a main landmark. Verify the figures and “since 2004” wording against the exact anniversary date. Make social preview image URLs absolute.
2. **`about.html`** — Add a meta description. Verify the leader credentials, sector reach and service-area claims. The track-record copy includes “$80M, 110,000T” (`:126`), while the projects card calls the same facility 80,000T; reconcile before publishing. Use the current CMS editor, not the legacy About page.
3. **`services.html`** — The core navigation advertises five detail pages, but this grid only links Plant Commissioning, Production Optimisation and Dangerous Goods (`:73–116`); Utility Appraisals and Waste Management are missing from the grid. Several other cards are not links at all. Add all five core service cards with clear booking/contact actions; label supporting services separately.
4. **`projects.html`** — Fix the 80,000T/110,000-tonne contradiction in the first project (`:118–121`). The category filters were exercised and work. Public cards populated from the CMS are vulnerable to unescaped HTML via `projects.js`; fix the shared rendering issue above. Add the missing page description and verify project/customer permissions before publishing names and figures.
5. **`commissioning.html`** — Add a meta description and verify broad claims such as “fully compliant”. The two-column inline grid (`:84–85`) has no mobile override; move it to a responsive class so it stacks cleanly. Add a concise project outcome/proof point and a contact CTA after the process.
6. **`appraisals.html`** — Add a meta description. The “10–25%” monthly savings claim (`:107`) needs a source, qualifying language, or a real case study. “Energy balancers” and “return spend to your operations budget” read unclearly; explain what measurements/deliverable a customer actually receives. The inline two-column section should stack on mobile.
7. **`optimisation.html`** — Add a meta description. “Start case study” links to the booking form (`:77`), so the label is confusing; use “Book an optimisation consultation”. Verify the claims about specific PLC brands and millisecond precision. The hero image is marked lazy-loaded even though it is above the fold; prioritize it for loading.
8. **`waste-management.html`** — Add a meta description. The “30% average reduction”, “ISO 14001 certified flows” and “12-month ROI” metrics (`:92–94`) need real evidence and careful wording; “certified flows” is not clear. Add scope, deliverables and one verifiable before/after example.
9. **`dangerous-goods.html`** — Add a meta description. Name the precise standard/version and clearly scope what ESA assesses; avoid implying a blanket regulatory guarantee. Add a visible “talk to a qualified engineer” CTA and evidence/case study.
10. **`contact.html`** — Add a meta description. Most visible labels are not connected to fields (`:79–158`); this includes the seven conditional wizard inputs. Require a useful message, add `name`/accessible names to dynamic fields, and make the service wording consistent (“Utility Appraisal(s)”). The wizard appends answers to the message on every submit attempt, so a retry after a network error can duplicate them. The 4 MiB attachment cap conflicts with Node's 5 MiB base64 JSON limit. The map itself has a title and is lazy-loaded.
11. **`booking.html`** — Service preselection and time chips loaded and worked in the runtime pass. The signed-in profile now prefills name/email, and the API takes ownership from the session. Still add a minimum date and say clearly that time slots are *requested*, not availability guarantees.
12. **`payment.html`** — The sandbox warning is clear, both payment tabs ran without client runtime errors, booking/payment access is now owner-bound, and cancelled/pending-transfer states are checked server-side. Booking-summary fields are escaped before rendering. The card-number formatter resets the caret to the end on each keystroke, making middle edits awkward. Implement tab keyboard/tabpanel semantics or use a simpler radio-style method selector.
13. **`signin.html`** — Add an H1/meta description and programmatically associate the email/password labels (`:66–77`). Add `autocomplete="username"` and `autocomplete="current-password"`. The redirect logic is role-aware, but test the `next` flow after admin and customer sign-in.
14. **`signup.html`** — Fix the post-signup redirect to the customer portal (`:139–143`); current copy says “dashboard” and sends a customer to the admin guard. The button says “Submit Request” although registration is immediate. Add an H1, page description, associated labels, privacy-policy link/consent, and a clear explanation of what data is required.
15. **`forgot-password.html`** — Add an H1, page description and an associated email label. The UI says the reset link is “on its way”, while the backend only writes it to the server's outbox. Make the demo limitation explicit or implement real delivery and throttling/abuse controls.
16. **`reset-password.html`** — Add an H1, page description and associated labels. The browser checks uppercase/lowercase/number, but both reset endpoints accept any eight-character password (`server.js:284`; `ApiAuthService.java` reset method); enforce the same policy on the server. Avoid leaking reset tokens into logs/referrers and provide clear expired-token handling.
17. **`portal.html`** — Hash links work because `portal.js` activates tabs, though `#bookings`/`#payments` are not actual element IDs. Tabs lack full tab semantics (`role`, `aria-selected`, `aria-controls`/keyboard navigation). A pending transfer still shows “Pay”, creating a double-payment risk. The reschedule modal can clear neither a previously chosen slot nor reject a past date. Add empty/error/retry states and show payment method/last four consistently in both backends.
18. **`receipt.html`** — A signed-in user still sees the “Sign in” header because this page loads `auth.js` but not `main.js` (`:77`); apply the shared header behaviour. Escape dynamic row fields (`:93–114`). In the Spring backend, portal payment summaries currently omit `method`/`cardLast4`, so “Paid by” is missing. Distinguish a pending transfer acknowledgement from an actual paid receipt.
19. **`resources.html`** — All three local PDFs exist and the links resolve. Verify insurance amounts, signatories, review date and qualifications in the generated PDFs before treating them as official, then show document version/review date and file size on the page. Add a meta description only if not already present (this page has one).
20. **`safety-standards.html`** — Add a meta description. Replace broad claims such as “every ... functions under zero-harm conditions” and “comply precisely with ... standards” with the actual policies, standards, limits and review date ESA can substantiate. Link the WHSE PDF and contact team.
21. **`privacy-policy.html`** — Rewrite rather than lightly edit. It is last dated January 2026 (`:68`) and claims “high-tier cryptographic barriers” (`:77`) that do not match the JSON-file demo storage. It needs an accurate list of collected data (including attachments, portal, payment last-four), purposes, storage/retention, actual processors/third parties (including remote fonts/maps), access/correction/deletion, complaint contact and overseas disclosure. Get legal review before claiming APP compliance.
22. **`team.html`** — Good: this page has a meta description. Verify “60 combined years”, roles, qualifications and the Engineers Australia chair claim. Break the long bios into scannable expertise/selected-work blocks and add a clear contact CTA.
23. **`404.html`** — The branded recovery links work. Add a meta description, a site search or a clearer “go to services/contact” path, and use a less casual “gone walkies” tone if this is the corporate production site.

### Admin and management pages

24. **`dashboard.html`** — Replace fictional sample rows and reply buttons (`:195–257`) with explicit loading/empty states. Correct the metrics and Node chart contract described above. Promote “Needs attention” to the real action queue and expose a reliable refresh time. The dashboard heading is an H2 without a page H1.
25. **`customers.html`** — Replace fictional customer rows as a fallback. The Filter button is inert. “Last Updated” is always `null` in current Node/Spring customer projections, so either populate it or remove the column. Decide whether admin users belong in “Customer Management”. Add search/status filtering and safe CSV formula handling.
26. **`bookings.html`** — Filter button is inert; implement date/status/service filters and useful empty states. The Node booking list is admin-protected now; the UI still needs clear booking/payment status labels, filters and cancellation handling.
27. **`payments.html`** — Static sample payments show $15,000 (`:150+`) despite the site's $50 consultation fee; never leave those rows visible as live data. Filter is inert and “Incompleted” is misspelled in the renderer. Add status/method filtering, completed-only revenue, and protect CSV exports from spreadsheet formulas. Spring's admin projection now includes card method/last four and transfer details for parity.
28. **`enquiries.html`** — Filter is inert and static sample enquiries are fictional. Add search/status/date filters, a clear unread/new state, and keyboard-accessible action buttons; preserve safe escaping of message content. Align the audit log with reply/status changes.
29. **`content.html`** — “Add New Page” is not a real page publisher yet; it creates only metadata. Make that limitation explicit or implement a template, preview, route rendering and publish/draft rules. Add validation for slugs and visible save/error state.
30. **`caseStudies.html`** — Page loads and its form interaction ran. It checks only for *some* token, not an admin role; the API must remain the authority and the UI should redirect customers cleanly. Delete handling treats any HTTP response as a success toast; check `response.ok` and report failures. Public card rendering needs the shared XSS fix.
31. **`auditLog.html`** — Checks for a token, not admin role; on a 403 the response is still parsed as JSON and rendered as “Nothing logged yet”, which misstates an access error as an empty log. Check status and show an access/error state. Align the “every change” copy with actual Node/Spring event coverage.
32. **`settings.html`** — Four labels are not associated with their fields. Site name, timezone and language save but have no effect; use constrained selects/validation if implemented. Expose which settings are live and show the current business email/fee/payment configuration.
33. **`aboutPageAdmin.html`** — This legacy editor is broken against the current CMS (details above), has no site/admin navigation, and its labels are not programmatically connected. Remove it or rebuild it as a proper CMS screen backed by the same secured API as the public page.
34. **`accountAdmin.html`** — The page now requires a locally stored admin role, the prefilled `Admin123` password is removed, and Node/Spring both require an admin token for the server route. Production bootstrap requires environment-provided credentials. Verify password validation and the production setup in a Java deployment before release.

---

## Site-wide polish / “massive improvement” plan

1. **Security and privacy foundation first:** secure every booking/payment/admin route in Node and Spring; remove default credentials/secrets; fix stored/reflected HTML injection; add API ownership tests and state-transition tests.
2. **Repair the end-to-end journeys:** customer signup → portal; signed-in booking → owner-bound payment; pending transfer handling; receipts; real email or honest outbox messaging. Add browser-level tests for these flows.
3. **Make admin data truthful:** correct dashboard math, align Node/Spring response contracts, remove fake samples, make all filter/search/export controls real, add audit coverage.
4. **Refresh the whole UI consistently:** shared header/footer/page-width/spacing/type components, responsive service-page grids, stronger hero hierarchy, real case-study photography and outcomes, consistent CTAs, useful empty/loading/error states. Reduce the scattered inline styling so every page can be improved together.
5. **Accessibility, SEO and performance:** link every label to its field, proper H1/main landmarks, keyboard/focus handling for dropdowns/tabs/modals, page-specific descriptions and absolute Open Graph URLs, self-host or document external assets, prioritize hero imagery, and test at phone/tablet/desktop widths.
6. **Legal/content accuracy pass:** reconcile project numbers and validate all performance, compliance, staff, insurance and certification claims; rewrite privacy policy from actual data flows and have it reviewed.

Recommended order: **security/privacy → payment/booking correctness → admin data → shared visual rebuild → accessibility/SEO/content validation**. A visual redesign before the P0 security items would make the site look better while leaving the most serious problems open.
