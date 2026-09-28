import type { Destination } from "@prisma/client";

type ReviewForPublic = {
  id: string;
  displayName: string;
  rating: number;
  body: string;
  booking: { option: { destination: Destination } };
};

// Keep the public shape explicit. Booking, customer, admin and consent data stay private.
export function toPublicReview(review: ReviewForPublic) {
  return {
    id: review.id,
    displayName: review.displayName,
    rating: review.rating,
    body: review.body,
    destination: review.booking.option.destination,
  };
}
