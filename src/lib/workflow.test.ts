import { describe,it,expect } from "vitest";
import { canTransition } from "./workflow";
describe("request status transitions",()=>{it("allows the expected assisted workflow",()=>{expect(canTransition("NEW","SUPPLIER_REQUESTED")).toBe(true);expect(canTransition("OPTIONS_RECEIVED","QUOTE_SENT")).toBe(true);expect(canTransition("PAYMENT_PENDING","BOOKED")).toBe(true)});it("rejects skipping straight from a new request to booked",()=>expect(canTransition("NEW","BOOKED")).toBe(false));it("does not reopen cancelled requests",()=>expect(canTransition("CANCELLED","NEW")).toBe(false))});
