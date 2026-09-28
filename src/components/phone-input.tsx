"use client";

import { ChevronDown } from "lucide-react";
import type { Ref } from "react";
import "flag-icons/css/flag-icons.min.css";
import countries from "@/data/countries.json";
import { callingCode, countryForPastedNumber, internationalNumber, nationalNumber } from "@/lib/phone-number";

type Props = {
  id: string;
  label: string;
  value: string;
  countryCode: string;
  onCountryChange: (code: string) => void;
  onChange: (value: string) => void;
  onBlur: () => void;
  inputRef?: Ref<HTMLInputElement>;
  error?: string;
};

function flagEmoji(code: string): string {
  return String.fromCodePoint(...Array.from(code, (letter) => 127397 + letter.charCodeAt(0)));
}

export function PhoneInput({ id, label, value, countryCode, onCountryChange, onChange, onBlur, inputRef, error }: Props) {
  const local = nationalNumber(value, countryCode);

  function changeCountry(code: string) {
    onCountryChange(code);
    onChange(internationalNumber(code, local));
  }

  function changeNumber(raw: string) {
    const pastedCountry = countryForPastedNumber(raw, countryCode);
    if (pastedCountry) {
      onCountryChange(pastedCountry);
      const prefix = callingCode(pastedCountry);
      onChange(internationalNumber(pastedCountry, raw.replace(/\D/g, "").slice(prefix.length)));
      return;
    }
    onChange(internationalNumber(countryCode, raw));
  }

  return <div className="field phone-field">
    <label htmlFor={id}>{label} *</label>
    <div className="phone-input-row">
      <div className="phone-code-picker">
        <span className={`fi fi-${countryCode.toLowerCase()}`} aria-hidden="true" />
        <span aria-hidden="true">+{callingCode(countryCode)}</span>
        <ChevronDown size={14} aria-hidden="true" />
        <select aria-label={`${label} country calling code`} value={countryCode} onChange={(event) => changeCountry(event.target.value)}>
          {countries.filter((country) => country.dialCode).map((country) => <option key={country.code} value={country.code}>{flagEmoji(country.code)} {country.name} (+{country.dialCode})</option>)}
        </select>
      </div>
      <input id={id} ref={inputRef} type="tel" inputMode="tel" autoComplete="tel-national" value={local} onChange={(event) => changeNumber(event.target.value)} onBlur={onBlur} placeholder={countryCode === "PK" ? "300 1234567" : "Phone number"} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}/>
    </div>
    {error && <small id={`${id}-error`} className="location-error" role="alert">{error}</small>}
  </div>;
}
