import { HotelDirectory } from "@/components/catalog/hotel-directory";
import { metadata as makeMetadata } from "@/lib/seo";
export const metadata = makeMetadata(
  "Explore Saudi Hotels",
  "Browse published Saudi hotel profiles and request accommodation assistance.",
  "/hotels",
);
export default async function HotelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <HotelDirectory query={await searchParams} />;
}
