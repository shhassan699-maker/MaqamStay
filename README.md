# MaqamStay

Published hotel catalog browsing now integrates server-to-server with the independent Inventory Admin. See [inventory integration setup and security](docs/inventory-integration.md). The customer retains its own PostgreSQL database and assisted-request workflow; no inventory MongoDB/admin credentials are shared.

MaqamStay is an assisted Saudi accommodation request and booking lead platform. Travelers send their plans, staff check options with suppliers, prepare customer quotes, and coordinate bookings manually through WhatsApp. There is no live inventory or payment processing.

## Stack and architecture

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4
- PostgreSQL and Prisma ORM 6 in a modular monolith
- React Hook Form and Zod for the seven-step request form; Zod validation also runs in every write route
- Database-backed admin sessions, bcrypt password hashes, same-origin checks and PostgreSQL-backed rate limits
- Decimal-safe pricing with `decimal.js` and PostgreSQL `Decimal(14,2)`

Public pages live in `src/app`; CRM pages live under `src/app/admin/(protected)`. Route handlers in `src/app/api` perform writes. `src/lib/public-quote-select.ts` is the customer-facing allowlist: supplier contacts, costs, margin, commission, availability notes and private notes are excluded from quote queries. Admin routes use the authenticated layout and write guards. The `src/proxy.ts` cookie check provides an early redirect; the database session is validated by the layout and API guards.

The important entities are `AdminUser`, `AdminSession`, `Customer`, `AccommodationRequest`, `RequestDestination`, `RequestCounter`, `Supplier`, `HotelOption`, `Quote`, `QuoteOption`, `CustomerInterest`, `Booking`, `Review`, `Commission`, `AdminNote`, `ActivityLog` and `RateLimit`. UUIDs are used internally; new requests receive an `MS-YYYY-000001` number and an opaque 256-bit quote token. Existing `SK-` request numbers remain valid.

## Local setup

Requirements: Node.js 24.11+ (or 22.18+), npm, and PostgreSQL 15+.

1. `npm install`
2. Copy `.env.example` to `.env` and set the values below. Create a local PostgreSQL database matching `DATABASE_URL`.
3. `npm run db:dev` to apply migrations in development.
4. `npm run db:seed` for fictional sample data.
5. Set `ADMIN_EMAIL`, `ADMIN_NAME` and a strong `ADMIN_PASSWORD` in `.env`, then run `npm run admin:create`.
6. `npm run dev` and open `http://localhost:3000`. Sign in at `/admin/login`.

The seed is idempotent for its named records and uses `.test` email domains and fictional hotels and suppliers. Do not run it against a production database. The admin creation command creates or resets the admin account named by `ADMIN_EMAIL`; remove the password from your local `.env` when done if you prefer.

## Environment variables

| Variable                                      | Purpose                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`                                | PostgreSQL connection string; required for all request and CRM writes    |
| `SESSION_SECRET`                              | At least 32 characters; HMAC key for rate-limit identifiers              |
| `NEXT_PUBLIC_SITE_URL`                        | Canonical site origin, such as `https://maqamstay.example`               |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`                 | Click-to-chat number in international digits only, with no `+` or spaces |
| `NEXT_PUBLIC_GA_ID`                           | Optional Google Analytics measurement ID (`G-...`)                       |
| `NEXT_PUBLIC_META_PIXEL_ID`                   | Optional Meta Pixel ID                                                   |
| `NEXT_PUBLIC_GOOGLE_ADS_ID`                   | Optional Google Ads ID (`AW-...`)                                        |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | Only for the `admin:create` command                                      |

The `NEXT_PUBLIC_` values are visible in the client bundle. Never put passwords, supplier data, margin settings or API secrets in them. Set the site URL to the exact public HTTPS origin in production. The `.env` file is gitignored; `.env.example` is safe to commit.

## Country and city suggestions

The request form shows the country list when opened and major cities for the selected country when the city field opens. Typing filters either list; both fields also accept manually entered places missing from the catalog. A flag and calling-code picker builds full international WhatsApp and phone numbers. The catalog is stored locally in `src/data`; only the small country list reaches the browser, while `GET /api/locations/cities?country=PK&q=Lah` searches city names on the server. See [location data attribution and license](src/data/README.md) before redistributing the data files. The flag artwork comes from the MIT-licensed [flag-icons](https://github.com/lipis/flag-icons) package.

## Routes

Public: `/`, `/makkah`, `/madinah`, `/jeddah`, `/riyadh`, `/request`, `/request/success`, `/how-it-works`, `/about`, `/faq`, `/contact`, `/privacy`, `/terms`, and private bearer-link `/quote/[token]`.

Admin: `/admin/login`, `/admin`, `/admin/requests`, `/admin/requests/[id]`, `/admin/suppliers`, `/admin/customers`, `/admin/customers/[id]`, `/admin/bookings`, `/admin/reviews`, and `/admin/commissions`.

API writes: `POST /api/requests`; `POST /api/quotes/[token]/interest`; admin login/logout; admin request status, assignment and note routes; supplier create/update; option create; quote create; booking create/update; review create/update. Write routes validate input and origin, and admin writes require a valid database session.

## Workflow

1. A traveler sends multiple destinations with separate date ranges, travelers, rooms, budget, preferences and contact details. Submission creates a customer and numbered request.
2. Staff assign a supplier and staff owner, add private notes and hotel options. Supplier price, taxes, fixed/percentage markup and any final-price override are recorded internally. The expected gross commission is the final customer price minus supplier cost and fees.
3. Staff select 1–5 options and mark one recommended. The quote snapshots final customer prices and creates a random link valid for 30 days. Staff share it manually on WhatsApp and mark the request `QUOTE_SENT`.
4. The customer opens the mobile quote and taps **I'm Interested**. Interest is recorded before WhatsApp opens. Staff then coordinate the booking manually and track payment and commission status.

Quotes are subject to supplier confirmation. They never represent instant inventory or a confirmed booking. Multiple currencies are supported for stored prices and reports are separated by currency; there is no exchange-rate conversion.

## Customer reviews

Staff can add feedback at `/admin/reviews` for a confirmed or completed booking that does not already have a review. Enter a public display name, the customer's words and a 1–5 rating. Staff must confirm that the customer gave permission to publish their name and review. Reviews can be saved as private drafts, edited, published or unpublished. Only published reviews linked to currently confirmed or completed bookings appear on the homepage; the section stays hidden until a real review is published. The public query selects only the review text, display name, rating and destination. No fictional reviews are seeded, and fictional development bookings cannot be reviewed.

## Checks and deployment

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm audit`, and `npm run build`. Tests cover validation, pricing, status transitions, request creation, quote generation, booking creation, admin authorization and the customer data allowlist. Database-backed end-to-end tests require a running PostgreSQL service; this repository's automated tests mock database boundaries.

Deploy the Next.js app to a Node-capable host with PostgreSQL. Set environment variables in the hosting platform, run `npm run db:migrate` as a release step, create an admin account using the one-time command, then run `npm run build` and `npm start`. Use HTTPS and a trusted reverse proxy that supplies the client IP for rate limits. Back up PostgreSQL and restrict database access. Uploading hotel photos is intentionally replaced with an HTTPS image URL field for this MVP.

WhatsApp uses click-to-chat URLs derived from `NEXT_PUBLIC_WHATSAPP_NUMBER`; it does not send messages automatically. Optional analytics scripts load only when configured. Admin, secure quote and request-success pages do not initialize third-party analytics, and the site uses a `no-referrer` policy to avoid leaking quote tokens through image requests. Quote-open and interest events are recorded in the internal activity timeline.

## Photography

The public destination photography is stored in `public/images` and shown only as destination context, not as photos of hotels offered in a quote. The images are used under the [Unsplash License](https://unsplash.com/license): [Makkah hero](https://unsplash.com/photos/KbtfseYfgaE), [Makkah destination](https://unsplash.com/photos/Ko0Dpd1MOJY), [Madinah](https://unsplash.com/photos/lFibU8A8Y-I), [Jeddah](https://unsplash.com/photos/fwRCftPs02M), and [Riyadh](https://unsplash.com/photos/MAPTe538-vA). Replace these source photos if the brand later acquires commissioned destination photography.

## Current MVP limits

- No supplier API, live availability, automated notifications, online payments, customer accounts or currency conversion.
- Supplier contact, booking confirmation and quote delivery are manual operator steps.
- Quote image assets are externally hosted HTTPS URLs entered by staff. Check image usage rights before publishing.
- A local PostgreSQL database is required to exercise request submission and CRM workflows.

Next practical steps are a staging database smoke test, operator review of the complete WhatsApp handoff, an image upload service, stronger deployment-specific rate limiting, and a privacy/terms review for the launch jurisdiction.

# MaqamStay
