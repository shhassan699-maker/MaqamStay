import countries from "@/data/countries.json";

export function callingCode(countryCode: string): string {
  return countries.find((country) => country.code === countryCode)?.dialCode ?? "92";
}

export function nationalNumber(value: string, countryCode: string): string {
  const prefix = `+${callingCode(countryCode)}`;
  return value.startsWith(prefix) ? value.slice(prefix.length) : value.replace(/^\+\d{1,4}/, "");
}

export function internationalNumber(countryCode: string, localValue: string): string {
  let digits = localValue.replace(/\D/g, "");
  if (countryCode === "PK") digits = digits.replace(/^0/, "");
  return digits ? `+${callingCode(countryCode)}${digits}` : "";
}

export function countryForPastedNumber(value: string, preferredCountry: string): string | undefined {
  const digits = value.replace(/\D/g, "");
  if (!value.trim().startsWith("+")) return undefined;
  const preferredCode = callingCode(preferredCountry);
  if (digits.startsWith(preferredCode)) return preferredCountry;
  return countries
    .filter((country) => country.dialCode && digits.startsWith(country.dialCode))
    .sort((a, b) => b.dialCode.length - a.dialCode.length)[0]?.code;
}
