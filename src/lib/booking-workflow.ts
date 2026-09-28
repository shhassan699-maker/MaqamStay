import type { BookingStatus } from "@prisma/client";
export const bookingTransitions:Record<BookingStatus,BookingStatus[]>={PENDING:["CONFIRMED","CANCELLED"],CONFIRMED:["COMPLETED","CANCELLED","REFUNDED"],COMPLETED:["REFUNDED"],CANCELLED:["REFUNDED"],REFUNDED:[]};
export function canTransitionBooking(from:BookingStatus,to:BookingStatus){return from===to||bookingTransitions[from].includes(to)}
