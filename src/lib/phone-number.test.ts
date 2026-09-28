import { describe, expect, it } from "vitest";
import { callingCode, countryForPastedNumber, internationalNumber, nationalNumber } from "./phone-number";

describe("international phone input", () => {
  it("keeps a Pakistani number in international form for submission", () => {
    expect(callingCode("PK")).toBe("92");
    expect(internationalNumber("PK", "0300 1234567")).toBe("+923001234567");
    expect(nationalNumber("+923001234567", "PK")).toBe("3001234567");
  });

  it("switches calling codes without dropping the local number", () => {
    expect(internationalNumber("SA", nationalNumber("+923001234567", "PK"))).toBe("+9663001234567");
    expect(countryForPastedNumber("+966 50 123 4567", "PK")).toBe("SA");
  });

  it("leaves the stored number empty until digits are entered", () => {
    expect(internationalNumber("PK", "")).toBe("");
  });
});
