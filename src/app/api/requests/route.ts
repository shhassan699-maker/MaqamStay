import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { failure, publicWriteGuard } from "@/lib/http";
import { rateLimited } from "@/lib/rate-limit";
import { requestSchema } from "@/lib/validation";
import { resolveRequestHotel } from "@/lib/inventory/request-hotel";

export async function POST(req: Request) {
  const guard = await publicWriteGuard();
  if (guard) return guard;
  if (await rateLimited("request", 6))
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  try {
    const data = requestSchema.parse(await req.json());
    let selectedHotel:
      Awaited<ReturnType<typeof resolveRequestHotel>> | undefined;
    if (data.hotelSlug) {
      try {
        selectedHotel = await resolveRequestHotel(
          data.hotelSlug,
          data.destinations,
        );
      } catch {
        return NextResponse.json(
          {
            error:
              "We could not confirm your selected hotel. Check the hotel and destination, or remove the selection and send your accommodation requirements.",
          },
          { status: 422 },
        );
      }
    }
    const requestNumber = await db.$transaction(async (tx) => {
      const whatsapp = `+${data.whatsapp.replace(/\D/g, "")}`,
        phone = `+${data.phone.replace(/\D/g, "")}`;
      const savedCustomer = await tx.customer.upsert({
        where: { whatsapp },
        create: {
          name: data.name,
          whatsapp,
          phone,
          email: data.email || null,
          city: data.city,
          country: data.country,
        },
        update: {
          name: data.name,
          phone,
          email: data.email || null,
          city: data.city,
          country: data.country,
        },
      });
      const year = new Date().getUTCFullYear();
      const counter = await tx.requestCounter.upsert({
        where: { year },
        create: { year, value: 1 },
        update: { value: { increment: 1 } },
      });
      const number = `MS-${year}-${String(counter.value).padStart(6, "0")}`;
      await tx.accommodationRequest.create({
        data: {
          requestNumber: number,
          customerId: savedCustomer.id,
          adults: data.adults,
          children: data.children,
          rooms: data.rooms,
          budgetType: data.budgetType,
          budgetAmount: data.budgetAmount?.toString(),
          budgetCurrency: data.budgetCurrency,
          preferences: data.preferences,
          preferredLocation: data.preferredLocation,
          requirements: data.requirements,
          privacyAcceptedAt: new Date(),
          destinations: {
            create: data.destinations.map((d) => ({
              destination: d.destination,
              otherName: d.otherName,
              checkIn: new Date(`${d.checkIn}T00:00:00Z`),
              checkOut: new Date(`${d.checkOut}T00:00:00Z`),
            })),
          },
          activities: {
            create: [
              {
                type: "REQUEST_SUBMITTED",
                description: "Accommodation request submitted",
              },
              ...(selectedHotel
                ? [
                    {
                      type: "CATALOG_HOTEL_SELECTED",
                      description: JSON.stringify(selectedHotel),
                    },
                  ]
                : []),
            ],
          },
        },
      });
      return number;
    });
    return NextResponse.json(
      {
        requestNumber,
        destinations: data.destinations.map((d) => ({
          destination: d.destination,
          checkIn: d.checkIn,
          checkOut: d.checkOut,
        })),
        guests: data.adults + data.children,
        rooms: data.rooms,
      },
      { status: 201 },
    );
  } catch (error) {
    return failure(error);
  }
}
