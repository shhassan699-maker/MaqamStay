import { describe,it,expect } from "vitest";
import { publicQuoteSelect } from "./public-quote-select";
describe("public quote data boundary",()=>{it("only selects customer-safe fields",()=>{const json=JSON.stringify(publicQuoteSelect);for(const sensitive of ["supplierPrice","supplier","supplierId","markupType","markupValue","expectedCommission","actualCommission","internalNotes","availabilityNotes","AdminNote","notes","phone","whatsapp"]){expect(json).not.toContain(`"${sensitive}"`)}expect(json).toContain("finalPrice");expect(json).toContain("hotelName")})});
