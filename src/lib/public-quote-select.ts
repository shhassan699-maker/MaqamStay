// This allowlist is the customer data boundary. Keep internal pricing, supplier and notes out.
export const publicQuoteSelect = {
  id: true, expiresAt: true,
  request: { select: { requestNumber: true, status: true, adults: true, children: true, rooms: true, customer: { select: { name: true } }, destinations: { select: { destination: true, otherName: true, checkIn: true, checkOut: true } } } },
  options: { orderBy: { position: "asc" as const }, select: { position: true, recommended: true, label: true, finalPrice: true, hotelOption: { select: { id: true, hotelName: true, destination: true, roomType: true, stars: true, distance: true, mealPlan: true, checkIn: true, checkOut: true, nights: true, imageUrl: true, features: true, cancellationTerms: true, currency: true } } } }
} as const;
