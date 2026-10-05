"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CircleHelp,
  MapPin,
  Users,
  Wallet,
} from "lucide-react";
import {
  destinations as allDestinations,
  preferences as allPreferences,
  requestSchema,
} from "@/lib/validation";
import { titleCase } from "@/lib/format";
import { track } from "@/lib/analytics";
import countries from "@/data/countries.json";
import { LocationAutocomplete } from "@/components/location-autocomplete";
import { PhoneInput } from "@/components/phone-input";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { whatsappUrl } from "@/lib/whatsapp";

type Values = z.infer<typeof requestSchema>;
const titles = [
  "Where do you need accommodation?",
  "When are you travelling?",
  "Who is travelling?",
  "What is your budget?",
  "What matters most?",
  "Anything else we should know?",
  "How can we reach you?",
];
const needMap: Record<string, string> = {
  "Hotels Near Haram": "Near Haram",
  "Budget Makkah Hotels": "Budget Friendly",
  "Family Hotels": "Family Friendly",
  "Hotels Near Masjid an-Nabawi": "Near Masjid an-Nabawi",
  "Premium Saudi Hotels": "5 Star",
  "Elderly-Friendly Stays": "Elderly Friendly",
};
const today = new Date().toISOString().slice(0, 10);
const countryNames = countries.map((item) => item.name);
export function RequestForm({
  initialDestination,
  initialNeed,
  initialCheckIn,
  initialCheckOut,
  initialAdults,
  initialRooms,
  initialHotel,
}: {
  initialDestination?: string;
  initialNeed?: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialAdults?: string;
  initialRooms?: string;
  initialHotel?: { slug: string; name: string; city: string };
}) {
  const router = useRouter();
  const [step, setStep] = useState(0),
    [serverError, setServerError] = useState(""),
    [loading, setLoading] = useState(false);
  const [attemptedSteps, setAttemptedSteps] = useState<Set<number>>(
    () => new Set(),
  );
  const [showContactErrors, setShowContactErrors] = useState(false);
  const initial = allDestinations.includes(
    initialDestination as (typeof allDestinations)[number],
  )
    ? (initialDestination as (typeof allDestinations)[number])
    : undefined;
  const initialPreference = initialNeed
    ? needMap[initialNeed] || allPreferences.find((p) => p === initialNeed)
    : undefined;
  const validDate = (value?: string) =>
    value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value))
      ? value
      : "";
  const checkIn = validDate(initialCheckIn);
  const checkOut = validDate(initialCheckOut);
  const initialDates =
    checkIn && checkIn >= today && checkOut && checkOut > checkIn
      ? { checkIn, checkOut }
      : { checkIn: "", checkOut: "" };
  const safeCount = (
    value: string | undefined,
    fallback: number,
    max: number,
  ) => {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= max
      ? number
      : fallback;
  };
  const form = useForm<Values>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      hotelSlug: initialHotel?.slug,
      destinations: initial ? [{ destination: initial, ...initialDates }] : [],
      adults: safeCount(initialAdults, 2, 30),
      children: 0,
      rooms: safeCount(initialRooms, 1, 20),
      preferences: initialPreference
        ? [initialPreference as Values["preferences"][number]]
        : [],
      name: "",
      whatsapp: "",
      phone: "",
      email: "",
      city: "",
      country: "Pakistan",
      privacyAccepted: false,
    },
  });
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form;
  const selected = useWatch({ control, name: "destinations" });
  const prefs = useWatch({ control, name: "preferences" });
  const hotelSlug = useWatch({ control, name: "hotelSlug" });
  const adults = useWatch({ control, name: "adults" });
  const children = useWatch({ control, name: "children" });
  const rooms = useWatch({ control, name: "rooms" });
  const budgetAmount = useWatch({ control, name: "budgetAmount" });
  const budgetCurrency = useWatch({ control, name: "budgetCurrency" });
  const budgetType = useWatch({ control, name: "budgetType" });
  const country = useWatch({ control, name: "country" });
  const city = useWatch({ control, name: "city" });
  const [whatsappCountry, setWhatsappCountry] = useState("PK");
  const [phoneCountry, setPhoneCountry] = useState("PK");
  const [cityFocused, setCityFocused] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const countryCode = countries.find(
    (item) =>
      item.name.toLocaleLowerCase() === country?.trim().toLocaleLowerCase(),
  )?.code;
  const countrySuggestions = useMemo(() => {
    const search = country?.trim().toLocaleLowerCase() ?? "";
    if (!search) return [];
    const matches = countries.filter(
      (item) =>
        item.name.toLocaleLowerCase().includes(search) ||
        item.code.toLocaleLowerCase() === search,
    );
    return matches
      .sort(
        (a, b) =>
          Number(!a.name.toLocaleLowerCase().startsWith(search)) -
          Number(!b.name.toLocaleLowerCase().startsWith(search)),
      )
      .slice(0, 8)
      .map((item) => item.name);
  }, [country]);
  useEffect(() => {
    if (!cityFocused || !countryCode) return;
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        setCityLoading(true);
        try {
          const params = new URLSearchParams({
            country: countryCode,
            q: city?.trim() ?? "",
          });
          const response = await fetch(`/api/locations/cities?${params}`, {
            signal: controller.signal,
          });
          if (response.ok) {
            const data: { cities: string[] } = await response.json();
            setCitySuggestions(data.cities);
          } else setCitySuggestions([]);
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError"))
            setCitySuggestions([]);
        } finally {
          if (!controller.signal.aborted) setCityLoading(false);
        }
      },
      city?.trim() ? 180 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [countryCode, city, cityFocused]);
  useEffect(() => {
    track("request_form_started");
  }, []);
  function toggleDestination(destination: (typeof allDestinations)[number]) {
    const items = form.getValues("destinations");
    setValue(
      "destinations",
      items.some((x) => x.destination === destination)
        ? items.filter((x) => x.destination !== destination)
        : [...items, { destination, checkIn: "", checkOut: "" }],
      { shouldDirty: true },
    );
    form.clearErrors("destinations");
    setServerError("");
  }
  function togglePreference(value: (typeof allPreferences)[number]) {
    setValue(
      "preferences",
      prefs.includes(value)
        ? prefs.filter((x) => x !== value)
        : [...prefs, value],
      { shouldValidate: true },
    );
  }
  async function next() {
    const fields: (keyof Values)[][] = [
      [],
      ["destinations"],
      ["adults", "children", "rooms"],
      ["budgetType", "budgetAmount", "budgetCurrency"],
      ["preferences", "preferredLocation"],
      ["requirements"],
      [
        "name",
        "whatsapp",
        "phone",
        "email",
        "city",
        "country",
        "privacyAccepted",
      ],
    ];
    const destinations = form.getValues("destinations");
    if (step === 0) {
      if (destinations.length === 0) {
        setServerError("Choose at least one destination.");
        return;
      }
      if (
        destinations.some(
          (d) => d.destination === "OTHER" && !d.otherName?.trim(),
        )
      ) {
        setServerError("Enter your other destination.");
        return;
      }
      setServerError("");
      setStep(1);
      return;
    }
    if (
      step === 1 &&
      destinations.some(
        (d) => !d.checkIn || !d.checkOut || d.checkOut <= d.checkIn,
      )
    ) {
      setServerError(
        "Enter valid check-in and check-out dates for every destination.",
      );
      return;
    }
    setServerError("");
    setAttemptedSteps((previous) => new Set(previous).add(step));
    if (!(await form.trigger(fields[step]))) {
      setServerError("Please review the fields above before continuing.");
      return;
    }
    setStep((s) => Math.min(s + 1, 6));
  }
  async function submit(values: Values) {
    setServerError("");
    setLoading(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(
          data.error || "Please check your details and try again.",
        );
        return;
      }
      track("request_form_completed");
      const params = new URLSearchParams({
        request: data.requestNumber,
        destinations: data.destinations
          .map((d: { destination: string }) => titleCase(d.destination))
          .join(" & "),
        dates: data.destinations
          .map(
            (d: { checkIn: string; checkOut: string }) =>
              `${d.checkIn} to ${d.checkOut}`,
          )
          .join("; "),
        guests: String(data.guests),
        rooms: String(data.rooms),
      });
      router.push(`/request/success?${params}`);
    } catch {
      setServerError("We couldn't send your request. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  const error = (name: keyof Values) =>
    (step === 6 ? showContactErrors : attemptedSteps.has(step))
      ? (errors[name]?.message as string | undefined)
      : undefined;
  return (
    <div className="ms-request-layout">
      <div className="form-shell ms-request-form">
        <div className="ms-request-form-top">
          <p className="kicker">ACCOMMODATION REQUEST</p>
          <span>Step {step + 1} of 7</span>
        </div>
        <h1>Let&apos;s find your stay.</h1>
        <p className="form-intro">
          A few details help us look for the right options. Our team checks
          availability after you submit.
        </p>
        <div className="form-progress" aria-label={`Step ${step + 1} of 7`}>
          {titles.map((title, i) => (
            <button
              key={title}
              type="button"
              title={title}
              aria-label={`Step ${i + 1}: ${title}`}
              aria-current={i === step ? "step" : undefined}
              className={i <= step ? "active" : ""}
              onClick={() => {
                if (i < step) {
                  setServerError("");
                  setStep(i);
                }
              }}
            >
              <span>{i < step ? <Check size={13} /> : i + 1}</span>
              <small>
                {
                  [
                    "Destination",
                    "Dates",
                    "Travelers",
                    "Budget",
                    "Preferences",
                    "Details",
                    "Contact",
                  ][i]
                }
              </small>
            </button>
          ))}
        </div>
        <p className="kicker">STEP {step + 1} OF 7</p>
        <h2>{titles[step]}</h2>
        <form
          onSubmit={form.handleSubmit(submit, () => setShowContactErrors(true))}
          noValidate
        >
          {hotelSlug && initialHotel && (
            <div className="date-panel">
              <strong>Selected hotel: {initialHotel.name}</strong>
              <p>
                {initialHotel.city} · Our team will check availability for your
                dates.
              </p>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setValue("hotelSlug", undefined)}
              >
                Remove hotel selection
              </button>
            </div>
          )}
          {step === 0 && (
            <>
              <p className="form-intro">
                Select one or more cities. You can set separate dates next.
              </p>
              <div className="choice-grid">
                {allDestinations.map((d) => (
                  <label className="choice" key={d}>
                    <input
                      type="checkbox"
                      checked={selected.some((x) => x.destination === d)}
                      onChange={() => toggleDestination(d)}
                    />
                    {titleCase(d)}
                  </label>
                ))}
              </div>
              {selected.some((d) => d.destination === "OTHER") && (
                <div className="field" style={{ marginTop: 18 }}>
                  <label htmlFor="other">Other destination</label>
                  <input
                    id="other"
                    value={
                      selected.find((d) => d.destination === "OTHER")
                        ?.otherName || ""
                    }
                    onChange={(e) =>
                      setValue(
                        "destinations",
                        selected.map((d) =>
                          d.destination === "OTHER"
                            ? { ...d, otherName: e.target.value }
                            : d,
                        ),
                      )
                    }
                  />
                </div>
              )}
            </>
          )}
          {step === 1 &&
            selected.map((d, i) => (
              <div className="date-panel" key={d.destination}>
                <h3>
                  {titleCase(d.destination)} {d.otherName && `- ${d.otherName}`}
                </h3>
                <div className="field-grid">
                  <div className="field">
                    <label htmlFor={`in-${i}`}>Check-in</label>
                    <input
                      id={`in-${i}`}
                      type="date"
                      min={today}
                      {...register(`destinations.${i}.checkIn`)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`out-${i}`}>Check-out</label>
                    <input
                      id={`out-${i}`}
                      type="date"
                      min={d.checkIn || today}
                      {...register(`destinations.${i}.checkOut`)}
                      required
                    />
                  </div>
                </div>
                {errors.destinations?.[i] && (
                  <p className="form-error">Please enter a valid date range.</p>
                )}
              </div>
            ))}
          {step === 2 && (
            <div className="field-grid">
              <div className="field">
                <label htmlFor="adults">Adults</label>
                <input
                  id="adults"
                  type="number"
                  min="1"
                  max="30"
                  {...register("adults", { valueAsNumber: true })}
                />
                <small>{error("adults")}</small>
              </div>
              <div className="field">
                <label htmlFor="children">Children</label>
                <input
                  id="children"
                  type="number"
                  min="0"
                  max="30"
                  {...register("children", { valueAsNumber: true })}
                />
                <small>{error("children")}</small>
              </div>
              <div className="field">
                <label htmlFor="rooms">Number of rooms</label>
                <input
                  id="rooms"
                  type="number"
                  min="1"
                  max="20"
                  {...register("rooms", { valueAsNumber: true })}
                />
                <small>{error("rooms")}</small>
              </div>
            </div>
          )}
          {step === 3 && (
            <>
              <p className="form-intro">
                Approximate is fine. You can leave this blank if you would like
                guidance.
              </p>
              <div className="field-grid">
                <div className="field">
                  <label htmlFor="budgetType">Budget basis</label>
                  <select
                    id="budgetType"
                    {...register("budgetType", {
                      setValueAs: (v) => v || undefined,
                    })}
                  >
                    <option value="">Select</option>
                    <option value="PER_NIGHT">Per night</option>
                    <option value="TOTAL">Total accommodation budget</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="currency">Currency</label>
                  <select
                    id="currency"
                    {...register("budgetCurrency", {
                      setValueAs: (v) => v || undefined,
                    })}
                  >
                    <option value="">Select</option>
                    <option value="PKR">PKR</option>
                    <option value="SAR">SAR</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="amount">Amount</label>
                <input
                  id="amount"
                  type="number"
                  min="1"
                  placeholder="e.g. 150000"
                  {...register("budgetAmount", {
                    setValueAs: (v) => (v === "" ? undefined : Number(v)),
                  })}
                />
                <small>{error("budgetAmount")}</small>
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <div className="choice-grid">
                {allPreferences.map((p) => (
                  <label className="choice" key={p}>
                    <input
                      type="checkbox"
                      checked={prefs.includes(p)}
                      onChange={() => togglePreference(p)}
                    />
                    {p}
                  </label>
                ))}
              </div>
              <div className="field" style={{ marginTop: 20 }}>
                <label htmlFor="preferredLocation">
                  Preferred distance or area (optional)
                </label>
                <input
                  id="preferredLocation"
                  placeholder="e.g. within 500m of Haram, or near a specific district"
                  {...register("preferredLocation")}
                />
                <small>{error("preferredLocation")}</small>
              </div>
            </>
          )}
          {step === 5 && (
            <div className="field">
              <label htmlFor="requirements">Additional requirements</label>
              <textarea
                id="requirements"
                placeholder="Travelling with my parents, so we'd prefer somewhere close and easy to access."
                {...register("requirements")}
              />
              <small>{error("requirements")}</small>
            </div>
          )}
          {step === 6 && (
            <>
              <div className="field-grid">
                <div className="field">
                  <label htmlFor="name">Full name *</label>
                  <input id="name" autoComplete="name" {...register("name")} />
                  <small>{error("name")}</small>
                </div>
                <Controller
                  name="whatsapp"
                  control={control}
                  render={({ field }) => (
                    <PhoneInput
                      id="whatsapp"
                      label="WhatsApp number"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      inputRef={field.ref}
                      countryCode={whatsappCountry}
                      onCountryChange={setWhatsappCountry}
                      error={error("whatsapp")}
                    />
                  )}
                />
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <PhoneInput
                      id="phone"
                      label="Phone number"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      inputRef={field.ref}
                      countryCode={phoneCountry}
                      onCountryChange={setPhoneCountry}
                      error={error("phone")}
                    />
                  )}
                />
                <div className="field">
                  <label htmlFor="email">Email (optional)</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    {...register("email")}
                  />
                  <small>{error("email")}</small>
                </div>
                <Controller
                  name="city"
                  control={control}
                  render={({ field }) => (
                    <LocationAutocomplete
                      id="city"
                      label="City"
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value);
                        setCitySuggestions([]);
                        setCityLoading(!!countryCode);
                      }}
                      onFocus={() => {
                        setCityFocused(true);
                        setCitySuggestions([]);
                        setCityLoading(!!countryCode);
                      }}
                      onBlur={() => {
                        field.onBlur();
                        setCityFocused(false);
                        setCityLoading(false);
                      }}
                      inputRef={field.ref}
                      autoComplete="address-level2"
                      suggestions={countryCode ? citySuggestions : []}
                      loading={cityLoading}
                      helper={
                        countryCode
                          ? "No city match found. You can still enter it manually."
                          : "Enter a listed country to see city suggestions, or enter your city manually."
                      }
                      error={error("city")}
                    />
                  )}
                />
                <Controller
                  name="country"
                  control={control}
                  render={({ field }) => (
                    <LocationAutocomplete
                      id="country"
                      label="Country"
                      value={field.value}
                      onChange={(value) => {
                        if (value !== field.value) {
                          setValue("city", "", { shouldDirty: true });
                          setCitySuggestions([]);
                          setCityLoading(false);
                        }
                        const match = countries.find(
                          (item) =>
                            item.name.toLocaleLowerCase() ===
                            value.trim().toLocaleLowerCase(),
                        );
                        if (match?.dialCode) {
                          if (!form.getValues("whatsapp"))
                            setWhatsappCountry(match.code);
                          if (!form.getValues("phone"))
                            setPhoneCountry(match.code);
                        }
                        field.onChange(value);
                      }}
                      onBlur={field.onBlur}
                      inputRef={field.ref}
                      autoComplete="country-name"
                      suggestions={countrySuggestions}
                      browseSuggestions={countryNames}
                      helper="No country match found. You can still enter it manually."
                      error={error("country")}
                    />
                  )}
                />
              </div>
              <label className="choice" style={{ marginTop: 10 }}>
                <input type="checkbox" {...register("privacyAccepted")} /> I
                agree to the{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  style={{ textDecoration: "underline" }}
                >
                  Privacy Policy
                </Link>
              </label>
              <small style={{ color: "#a33e37" }}>
                {error("privacyAccepted")}
              </small>
            </>
          )}
          {serverError && (
            <p className="form-error" role="alert">
              {serverError}
            </p>
          )}
          <div className="form-actions">
            {step > 0 ? (
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setServerError("");
                  setStep((s) => s - 1);
                }}
              >
                <ArrowLeft size={16} /> Back
              </button>
            ) : (
              <span />
            )}
            {step < 6 ? (
              <button
                type="button"
                className="button button-primary"
                onClick={(event) => {
                  event.preventDefault();
                  void next();
                }}
              >
                Continue <ArrowRight size={17} />
              </button>
            ) : (
              <button
                className="button button-primary"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  "Sending..."
                ) : (
                  <>
                    Send request <Check size={17} />
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
      <aside className="ms-request-aside" aria-label="Request summary">
        <div className="ms-request-summary">
          <div className="ms-request-summary-head">
            <span>
              <CalendarDays size={18} />
            </span>
            <div>
              <strong>Your request</strong>
              <small>Updates as you add details</small>
            </div>
          </div>
          <div className="ms-request-summary-row">
            <MapPin size={16} />
            <div>
              <small>DESTINATION</small>
              <strong>
                {selected.length
                  ? selected
                      .map((d) => d.otherName || titleCase(d.destination))
                      .join(" & ")
                  : "Add a destination"}
              </strong>
            </div>
          </div>
          <div className="ms-request-summary-row">
            <CalendarDays size={16} />
            <div>
              <small>TRAVEL DATES</small>
              <strong>
                {selected.some((d) => d.checkIn && d.checkOut)
                  ? selected
                      .filter((d) => d.checkIn && d.checkOut)
                      .map((d) => `${d.checkIn} to ${d.checkOut}`)
                      .join("; ")
                  : "Add your dates"}
              </strong>
            </div>
          </div>
          <div className="ms-request-summary-row">
            <Users size={16} />
            <div>
              <small>TRAVELERS</small>
              <strong>
                {Number(adults || 0) + Number(children || 0)} guests ·{" "}
                {rooms || 1} {rooms === 1 ? "room" : "rooms"}
              </strong>
            </div>
          </div>
          <div className="ms-request-summary-row">
            <Wallet size={16} />
            <div>
              <small>BUDGET</small>
              <strong>
                {budgetAmount && budgetCurrency
                  ? `${budgetCurrency} ${Number(budgetAmount).toLocaleString()}${budgetType === "PER_NIGHT" ? " per night" : " total"}`
                  : "Add a budget (optional)"}
              </strong>
            </div>
          </div>
        </div>
        <div className="ms-request-help">
          <CircleHelp size={21} />
          <h3>What happens next?</h3>
          <p>
            After you send your request, our team checks suitable accommodation
            options. We then share a quote you can review on your phone.
          </p>
          <a
            className="ms-request-help-link"
            href={whatsappUrl(
              "Assalamualaikum, I'd like help finding accommodation in Saudi Arabia.",
            )}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("whatsapp_clicked")}
          >
            <WhatsAppIcon size={17} /> Chat with us on WhatsApp
          </a>
        </div>
      </aside>
    </div>
  );
}
