import Image from "next/image";
import Link from "next/link";
import { MapPin, ArrowUpRight } from "lucide-react";
import type { PublicHotel } from "@/lib/inventory/inventory-types";
import styles from "./catalog.module.css";
export function mediaPath(url: string) {
  return `/api/catalog/media/${url.split("/").pop()}`;
}
export function distanceLabel(status: string) {
  return (
    (
      {
        MAP_VERIFIED: "Map verified",
        MANUALLY_VERIFIED: "Manually verified",
        SUPPLIER_PROVIDED: "Supplier provided · approximate",
        UNVERIFIED: "Approximate · unverified",
      } as Record<string, string>
    )[status] || "Approximate"
  );
}
export function HotelCard({ hotel }: { hotel: PublicHotel }) {
  const photo = hotel.media[0];
  const distance = hotel.distances[0];
  return (
    <article className={styles.card}>
      {photo && (
        <Image
          unoptimized
          src={mediaPath(photo.url)}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          className={styles.image}
        />
      )}
      <div className={styles.copy}>
        {hotel.starRating > 0 && (
          <span className={styles.stars}>{hotel.starRating}-star property</span>
        )}
        <h2>
          <Link href={`/hotels/${hotel.slug}`}>{hotel.name}</Link>
        </h2>
        <span className={styles.location}>
          <MapPin size={15} />
          {hotel.area?.name ? `${hotel.area.name}, ` : ""}
          {hotel.city.name}
        </span>
        <p>{hotel.shortDescription}</p>
        {distance && (
          <p>
            {distance.distanceMeters < 1000
              ? `${distance.distanceMeters} m`
              : `${(distance.distanceMeters / 1000).toFixed(1)} km`}{" "}
            from {distance.landmark}
            <br />
            <small>{distanceLabel(distance.verificationStatus)}</small>
          </p>
        )}
        <ul className={styles.tags} aria-label="Hotel features">
          {hotel.access.shuttle && <li>Shuttle service</li>}
          {hotel.access.wheelchair && <li>Wheelchair access</li>}
          {hotel.amenities.slice(0, 3).map((a) => (
            <li key={a.slug}>{a.name}</li>
          ))}
        </ul>
        <Link
          className="button button-secondary"
          href={`/hotels/${hotel.slug}`}
        >
          View hotel <ArrowUpRight size={16} />
        </Link>
      </div>
    </article>
  );
}
