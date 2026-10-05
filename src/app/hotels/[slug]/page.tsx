import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { CatalogUnavailable } from "@/components/catalog/hotel-directory";
import { distanceLabel, mediaPath } from "@/components/catalog/hotel-card";
import { getHotelBySlug } from "@/lib/inventory/inventory-client";
import { InventoryError } from "@/lib/inventory/inventory-errors";
import { slugSchema } from "@/lib/inventory/inventory-types";
import { metadata as makeMetadata } from "@/lib/seo";
import styles from "@/components/catalog/catalog.module.css";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  try {
    const hotel = await getHotelBySlug(slug);
    return makeMetadata(
      hotel.seo.title || hotel.name,
      hotel.seo.description || hotel.shortDescription,
      `/hotels/${hotel.slug}`,
    );
  } catch {
    return { title: "Hotel information | MaqamStay", robots: { index: false } };
  }
}
export default async function HotelPage({ params }: Props) {
  const { slug } = await params;
  if (!slugSchema.safeParse(slug).success) notFound();
  let hotel;
  try {
    hotel = await getHotelBySlug(slug);
  } catch (error) {
    if (error instanceof InventoryError && error.code === "NOT_FOUND")
      notFound();
    return (
      <PublicShell>
        <section className={styles.section}>
          <div className="container">
            <CatalogUnavailable />
          </div>
        </section>
      </PublicShell>
    );
  }
  return (
    <PublicShell>
      <section className={styles.hero}>
        <div className="container">
          <Link href={`/hotels?city=${hotel.city.slug}`}>
            ← Hotels in {hotel.city.name}
          </Link>
          <p className="ms-kicker">{hotel.area?.name || hotel.city.name}</p>
          <h1>{hotel.name}</h1>
          {hotel.arabicName && (
            <p lang="ar" dir="rtl">
              {hotel.arabicName}
            </p>
          )}
          <p>{hotel.shortDescription}</p>
          {hotel.starRating > 0 && (
            <span className={styles.stars}>
              {hotel.starRating}-star property
            </span>
          )}
        </div>
      </section>
      <section className={styles.section}>
        <div className="container">
          <div className={styles.gallery}>
            {hotel.media.map((photo, i) => (
              <Image
                unoptimized
                key={photo.url}
                src={mediaPath(photo.url)}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                priority={i === 0}
              />
            ))}
          </div>
          <div className={styles.detail}>
            <div className={styles.content}>
              <section>
                <h2>About your stay</h2>
                <p>{hotel.description}</p>
                <p>{hotel.address}</p>
              </section>
              {!!hotel.distances.length && (
                <section>
                  <h2>Location &amp; distances</h2>
                  <ul className={styles.distances}>
                    {hotel.distances.map((d, i) => (
                      <li key={i}>
                        <strong>{d.landmark}</strong>
                        <div>
                          {d.distanceMeters} meters ·{" "}
                          {d.transportMode.toLowerCase()}
                          {d.walkingMinutes !== undefined
                            ? ` · ${d.walkingMinutes} min walk`
                            : ""}
                        </div>
                        <small>{distanceLabel(d.verificationStatus)}</small>
                      </li>
                    ))}
                  </ul>
                  {hotel.location && (
                    <a
                      className="button button-secondary"
                      href={`https://www.google.com/maps/search/?api=1&query=${hotel.location.coordinates[1]},${hotel.location.coordinates[0]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View location on map
                    </a>
                  )}
                </section>
              )}
              <section>
                <h2>Amenities &amp; access</h2>
                <ul className={styles.tags}>
                  {hotel.amenities.map((a) => (
                    <li key={a.slug}>{a.name}</li>
                  ))}
                  {hotel.access.wheelchair && <li>Wheelchair access</li>}
                  {hotel.access.shuttle && <li>Shuttle service</li>}
                  {hotel.access.parking && <li>Parking</li>}
                </ul>
                <p>{hotel.access.notes}</p>
              </section>
              <section>
                <h2>Room configurations</h2>
                <p>
                  Room descriptions help you plan. We will check availability
                  for your travel dates.
                </p>
                <div className={styles.rooms}>
                  {hotel.rooms.map((r, i) => (
                    <article className={styles.room} key={i}>
                      <h3>{r.name}</h3>
                      <p>{r.description}</p>
                      <p>
                        {r.bedConfiguration}
                        <br />
                        Up to {r.maxGuests} guests · {r.maxAdults} adults ·{" "}
                        {r.maxChildren} children
                      </p>
                      {r.roomSize && <p>{r.roomSize} m²</p>}
                      {r.kitchenette && <span>Kitchenette</span>}
                    </article>
                  ))}
                </div>
              </section>
              <section>
                <h2>Property policies</h2>
                <dl className={styles.policies}>
                  {Object.entries({
                    "Check-in": hotel.policies.checkIn,
                    "Check-out": hotel.policies.checkOut,
                    Children: hotel.policies.child,
                    "Extra bed": hotel.policies.extraBed,
                    Cancellation: hotel.policies.cancellation,
                    Other: hotel.policies.other,
                  })
                    .filter(([, value]) => value)
                    .map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                </dl>
              </section>
            </div>
            <aside className={styles.aside}>
              <h2>Interested in this hotel?</h2>
              <p>
                Include it in your accommodation request. Our team will check
                suitability and availability for your dates.
              </p>
              <Link
                className="button button-primary"
                href={`/request?hotel=${hotel.slug}`}
              >
                Request this hotel
              </Link>
              <p>{hotel.availability.message}</p>
            </aside>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
