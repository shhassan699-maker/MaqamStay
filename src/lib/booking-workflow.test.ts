import { describe,it,expect } from "vitest";
import { canTransitionBooking } from "./booking-workflow";
describe("booking status transitions",()=>{it("allows confirmation and completion",()=>{expect(canTransitionBooking("PENDING","CONFIRMED")).toBe(true);expect(canTransitionBooking("CONFIRMED","COMPLETED")).toBe(true)});it("rejects reopening a refunded booking",()=>expect(canTransitionBooking("REFUNDED","CONFIRMED")).toBe(false))});
