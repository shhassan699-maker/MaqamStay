import { notFound } from "next/navigation";
import { HotelDirectory } from "@/components/catalog/hotel-directory";
import { getCities } from "@/lib/inventory/inventory-client";
import { slugSchema } from "@/lib/inventory/inventory-types";
import { metadata as makeMetadata } from "@/lib/seo";
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return makeMetadata(
    "Saudi Hotel Profiles",
    "Explore published hotel profiles and accommodation assistance.",
    `/${slug}/hotels`,
  );
}
export default async function CityHotelsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  if (!slugSchema.safeParse(slug).success) notFound();
  // Validate active city when the service is reachable; outage renders the useful catalog fallback.
  let exists: boolean | undefined;
  try {
    exists = (await getCities()).items.some((c) => c.slug === slug);
  } catch {
    /* directory handles outage */
  }
  if (exists === false) notFound();
  return <HotelDirectory city={slug} query={await searchParams} />;
}
