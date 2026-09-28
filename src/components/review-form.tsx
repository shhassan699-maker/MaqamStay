"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BookingChoice = { id: string; label: string };
type ExistingReview = {
  id: string;
  displayName: string;
  rating: number;
  body: string;
  published: boolean;
};

export function ReviewForm({ bookings, review }: { bookings?: BookingChoice[]; review?: ExistingReview }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const body = {
      ...(review ? {} : { bookingId: fields.get("bookingId") }),
      displayName: fields.get("displayName"),
      rating: Number(fields.get("rating")),
      body: fields.get("body"),
      consentConfirmed: fields.get("consentConfirmed") === "on",
      published: fields.get("published") === "on",
    };
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      const response = await fetch(review ? `/api/admin/reviews/${review.id}` : "/api/admin/reviews", {
        method: review ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        const firstFieldError = Object.values(result.fields ?? {}).flat().find(Boolean);
        throw new Error(typeof firstFieldError === "string" ? firstFieldError : result.error ?? "Could not save review.");
      }
      setSaved(true);
      if (!review) form.reset();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save review.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="ms-review-form" onSubmit={submit}>
    {!review && <div className="field"><label htmlFor="review-booking">Confirmed booking</label><select id="review-booking" name="bookingId" required defaultValue=""><option value="" disabled>Choose a booking</option>{bookings?.map(booking => <option key={booking.id} value={booking.id}>{booking.label}</option>)}</select></div>}
    <div className="field-grid">
      <div className="field"><label htmlFor={`review-name-${review?.id ?? "new"}`}>Public display name</label><input id={`review-name-${review?.id ?? "new"}`} name="displayName" defaultValue={review?.displayName ?? ""} minLength={2} maxLength={80} placeholder="e.g. Ayesha K." required /></div>
      <div className="field"><label htmlFor={`review-rating-${review?.id ?? "new"}`}>Rating</label><select id={`review-rating-${review?.id ?? "new"}`} name="rating" defaultValue={review?.rating ?? 5}>{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} {value === 1 ? "star" : "stars"}</option>)}</select></div>
    </div>
    <div className="field"><label htmlFor={`review-body-${review?.id ?? "new"}`}>Customer&apos;s review</label><textarea id={`review-body-${review?.id ?? "new"}`} name="body" rows={5} minLength={20} maxLength={1200} defaultValue={review?.body ?? ""} placeholder="Enter the customer's own words with only approved edits." required /></div>
    <label className="ms-review-check"><input type="checkbox" name="consentConfirmed" defaultChecked={!!review} required /><span>I confirm this feedback came from the customer and they agreed to display this name and review publicly.</span></label>
    <label className="ms-review-check"><input type="checkbox" name="published" defaultChecked={review?.published ?? false} /><span>Publish on the website now</span></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    {saved && <p className="admin-success" role="status">Review saved.</p>}
    <button className="button button-primary" type="submit" disabled={busy || (!review && !bookings?.length)}>{busy ? "Saving..." : review ? "Save review" : "Add review"}</button>
  </form>;
}
