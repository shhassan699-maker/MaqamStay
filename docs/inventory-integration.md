# Inventory catalog integration

The customer site and `maqamstay-inventory-admin` remain independent applications with independent package manifests, environment files, builds and databases. The customer uses its existing PostgreSQL assisted-request system; it receives no inventory MongoDB credentials or ODM models. Customer lint/typecheck explicitly exclude the standalone inventory directory.

## Local configuration

Run the inventory platform according to its README (admin 3100, API 4000). In the inventory admin's Integrations screen, create a key named `maqamstay-customer-local`, with its fixed `catalog.read` scope. Copy it once into the **customer** server environment:

```dotenv
INVENTORY_API_URL=http://127.0.0.1:4000
INVENTORY_CATALOG_API_KEY=<one-time-key>
INVENTORY_TIMEOUT_MS=5000
```

Run the customer normally with `npm run dev` on 3000. Publish a complete, reviewed hotel in the inventory admin; drafts never appear. Existing request processing still needs the customer's existing PostgreSQL configuration. Automated browser tests deliberately use an unreachable isolated PostgreSQL URL so they cannot write your customer database.

Staging uses the provider-neutral `.env.staging.example`, the deployed API HTTPS origin, and a dedicated `maqamstay-customer-staging` key. Production uses a different key, database and deployment. None of these variables has a `NEXT_PUBLIC_` prefix. Do not share keys between environments or place them in build arguments, browser analytics, logs, commits or hydration data.

## Contract and files

`src/lib/inventory/inventory-client.ts` imports `server-only`. Next rejects a client component importing it. Its public functions call only six known GET contracts: hotel list/detail, cities, areas, landmarks and nearby. Inputs and all nested outputs have independent strict Zod schemas in `inventory-types.ts`. Supplier/commercial/admin/session/storage fields cause fail-closed validation; no internal DTO is imported from the inventory repository.

Routes: `/hotels`, `/hotels/[slug]`, and the existing root `[slug]` convention extended with `/[slug]/hotels` for active cities. The hotel directory has city/area/star/property/landmark/distance/accessibility/shuttle filters and server pagination. Area/landmark select options currently show the first 50 records for the selected city; large selectors can be extended using the existing page arguments. Filtering does not indicate room availability or prices. The directory navigation link and sitemap entry follow the existing customer design and SEO conventions.

Cards/detail pages in `src/components/catalog` reuse the site's neutral/cream/forest/gold system and public shell. They display only approved descriptions, images, rooms, policies, amenities and supplied access information. Distance labels explicitly identify map verified, manually verified, supplier-provided approximate and unverified approximate values. Previously published snapshots without the additive `landmarkSlug` field continue rendering; republish them to participate in slug-based landmark filtering.

`/api/catalog/media/[id]` accepts only a Mongo-style opaque image identifier and fetches the single known published-image route. It never forwards user headers or a catalog/admin key, never fetches an arbitrary URL, and rejects redirects, unexpected MIME and oversized output. It streams no private bucket URLs and sends no-store to prevent this site caching an unpublished image. Unpublishing cannot retract bytes a browser already received.

## Requests and caching

The detail CTA links to `/request?hotel=<slug>`. The server resolves the published hotel before showing a safe name/city/slug selection. The form can remove that selection. On POST, `resolveRequestHotel` resolves it **again**, verifies the requested city, and stores only the resolved slug/name/city in a `CATALOG_HOTEL_SELECTED` activity in the existing request transaction. No new booking/payment/rate flow or database migration was introduced. A missing/mismatched hotel blocks the selected-hotel submission before any database writes; the user can remove it and submit requirements normally. Client-supplied names/costs are ignored.

`inventory-cache.ts` keeps at most 100 validated response bodies for conditional ETag reuse for 60 seconds. Every call still reaches the origin with `cache: no-store` and optional `If-None-Match`; only an authorized origin 304 permits reuse. Errors evict the body. No stale-on-error or Next persistent caching delays unpublish/key revocation. Consequently pending admin edits keep the stable snapshot; republish changes the response, and unpublish removes it on the next request. This reduces response bytes rather than database round trips.

Five-second default timeouts (configurable 100–15000 ms), bounded JSON reads and safe local errors handle 401/403/404/429/5xx, timeout, invalid JSON and schema mismatch. Redirects are rejected. An unavailable list/detail offers Request Accommodation and WhatsApp instead of crashing the whole site. Invalid hotel slugs and genuinely unpublished/deleted hotels return 404.

## Rotation and verification

Create a replacement staging `catalog.read` key, update only the customer server secret, restart/redeploy it, check list/detail/location calls, then revoke the old key in Inventory Admin. Rollback can switch to a still-valid previous key; never reactivate a revoked key or use an admin session. Rotating the Inventory API SESSION_SECRET revokes all derived sessions/reset/service hashes and requires new credentials.

Run `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm test` and `npm run build` here. After building both products, run `npm run test:browser` from the standalone project for the real customer/admin/API publishing workflow and responsive checks. `node scripts/verify-public-bundles.mjs` there scans both browser builds for server configuration/secret leakage.

See the standalone [staging guide](../maqamstay-inventory-admin/docs/staging.md), [restore evidence](../maqamstay-inventory-admin/docs/restore-evidence.json), and [phase report](../maqamstay-inventory-admin/docs/staging-verification.md). Real DNS/TLS/provider access and managed S3/Mongo restore rehearsals remain pending; local evidence does not establish production readiness.
