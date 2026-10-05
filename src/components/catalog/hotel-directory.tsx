import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { whatsappUrl } from "@/lib/whatsapp";
import {
  getHotels,
  getCities,
  getAreas,
  getLandmarks,
} from "@/lib/inventory/inventory-client";
import {
  hotelFiltersSchema,
  type HotelFilters,
} from "@/lib/inventory/inventory-types";
import { HotelCard } from "./hotel-card";
import styles from "./catalog.module.css";

export function CatalogUnavailable() {
  return (
    <div className={styles.notice} role="status">
      <h2>Let us help you find the right stay.</h2>
      <p>
        Hotel information is temporarily unavailable. You can still send us your
        accommodation requirements.
      </p>
      <div className={styles.actions}>
        <Link className="button button-primary" href="/request">
          Request accommodation
        </Link>
        <a
          className="button button-secondary"
          href={whatsappUrl("I'd like help finding accommodation.")}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp help
        </a>
      </div>
    </div>
  );
}
export async function HotelDirectory({
  query,
  city,
}: {
  query: Record<string, string | string[] | undefined>;
  city?: string;
}) {
  const picked = Object.fromEntries(
    Object.keys(hotelFiltersSchema.shape)
      .filter((k) => query[k] !== undefined && query[k] !== "")
      .map((k) => [k, query[k]]),
  );
  if (city) picked.city = city;
  const parsed = hotelFiltersSchema.safeParse(picked);
  const filters: HotelFilters = parsed.success
    ? parsed.data
    : { ...(city ? { city } : {}) };
  const results = await Promise.allSettled([
    getHotels(filters),
    getCities(),
    getAreas(filters.city),
    getLandmarks(filters.city),
  ]);
  const hotels =
    results[0].status === "fulfilled" ? results[0].value : undefined;
  const cities =
    results[1].status === "fulfilled" ? results[1].value.items : [];
  const areas = results[2].status === "fulfilled" ? results[2].value.items : [];
  const landmarks =
    results[3].status === "fulfilled" ? results[3].value.items : [];
  const selectedCity = cities.find((c) => c.slug === filters.city);
  const path = city ? `/${city}/hotels` : "/hotels";
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters))
      if (v !== undefined && k !== "page") params.set(k, String(v));
    params.set("page", String(page));
    return `${path}?${params}`;
  };
  return (
    <PublicShell>
      <section className={styles.hero}>
        <div className="container">
          <p className="ms-kicker">EXPLORE YOUR STAY</p>
          <h1>
            {selectedCity
              ? `Hotels in ${selectedCity.name}`
              : "A place for your journey."}
          </h1>
          <p>
            Explore published hotel profiles, locations and room configurations.
            Tell us which hotel interests you and our team will check options
            for your dates.
          </p>
        </div>
      </section>
      <section className={styles.section}>
        <div className="container">
          {!parsed.success && (
            <div className={styles.notice} role="alert">
              Please review the filters. Select a landmark when specifying a
              distance.
            </div>
          )}
          {hotels ? (
            <>
              <form method="get" action={path} className={styles.filters}>
                <div className={styles.field}>
                  <label htmlFor="catalog-city">City</label>
                  <select
                    id="catalog-city"
                    name="city"
                    defaultValue={filters.city || ""}
                  >
                    <option value="">All cities</option>
                    {cities.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="catalog-area">Area</label>
                  <select
                    id="catalog-area"
                    name="area"
                    defaultValue={filters.area || ""}
                  >
                    <option value="">All areas</option>
                    {areas.map((a) => (
                      <option key={a.slug} value={a.slug}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="catalog-stars">Star rating</label>
                  <select
                    id="catalog-stars"
                    name="starRating"
                    defaultValue={
                      filters.starRating === undefined
                        ? ""
                        : String(filters.starRating)
                    }
                  >
                    <option value="">All ratings</option>
                    {[5, 4, 3, 2, 1, 0].map((s) => (
                      <option key={s} value={s}>
                        {s ? `${s} stars` : "Unrated"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="catalog-type">Property type</label>
                  <select
                    id="catalog-type"
                    name="propertyType"
                    defaultValue={filters.propertyType || ""}
                  >
                    <option value="">All properties</option>
                    {[
                      "HOTEL",
                      "APARTMENT",
                      "APARTHOTEL",
                      "RESORT",
                      "HOSTEL",
                      "GUESTHOUSE",
                      "VILLA",
                      "OTHER",
                    ].map((t) => (
                      <option key={t} value={t}>
                        {t.charAt(0) + t.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="catalog-landmark">Landmark</label>
                  <select
                    id="catalog-landmark"
                    name="landmark"
                    defaultValue={filters.landmark || ""}
                  >
                    <option value="">Any landmark</option>
                    {landmarks.map((l) => (
                      <option key={l.slug} value={l.slug}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="catalog-distance">
                    Maximum distance (meters)
                  </label>
                  <input
                    id="catalog-distance"
                    name="maxDistance"
                    type="number"
                    min="0"
                    max="100000"
                    defaultValue={
                      filters.maxDistance === undefined
                        ? ""
                        : String(filters.maxDistance)
                    }
                  />
                </div>
                <div className={styles.checks}>
                  <label>
                    <input
                      type="checkbox"
                      name="wheelchair"
                      value="true"
                      defaultChecked={filters.wheelchair === "true"}
                    />
                    Wheelchair access
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="shuttle"
                      value="true"
                      defaultChecked={filters.shuttle === "true"}
                    />
                    Shuttle service
                  </label>
                  <button className="button button-primary" type="submit">
                    Apply filters
                  </button>
                  <Link href={path}>Clear filters</Link>
                </div>
              </form>
              <p className={styles.summary}>
                {hotels.total} published{" "}
                {hotels.total === 1 ? "hotel" : "hotels"} · Profiles describe
                properties; availability is checked after your request.
              </p>
              {hotels.items.length ? (
                <div className={styles.grid}>
                  {hotels.items.map((h) => (
                    <HotelCard key={h.slug} hotel={h} />
                  ))}
                </div>
              ) : (
                <div className={styles.notice}>
                  <h2>No published hotels match these filters.</h2>
                  <p>
                    Broaden your filters or send us your accommodation
                    requirements.
                  </p>
                  <Link className="button button-primary" href="/request">
                    Request accommodation
                  </Link>
                </div>
              )}
              {hotels.pages > 1 && (
                <nav className={styles.pagination} aria-label="Hotel pages">
                  {hotels.page > 1 && (
                    <Link href={pageHref(hotels.page - 1)}>Previous page</Link>
                  )}
                  <span>
                    Page {hotels.page} of {hotels.pages}
                  </span>
                  {hotels.page < hotels.pages && (
                    <Link href={pageHref(hotels.page + 1)}>Next page</Link>
                  )}
                </nav>
              )}
            </>
          ) : (
            <CatalogUnavailable />
          )}
        </div>
      </section>
    </PublicShell>
  );
}
