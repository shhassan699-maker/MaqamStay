import { Star } from "lucide-react";
import { db } from "@/lib/db";
import { ReviewForm } from "@/components/review-form";

export default async function ReviewsPage() {
  const [reviews, bookings] = await Promise.all([
    db.review.findMany({
      select: {
        id: true, displayName: true, rating: true, body: true, publishedAt: true, createdAt: true,
        booking: { select: { reference: true, status: true, customer: { select: { name: true } }, option: { select: { hotelName: true, destination: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.booking.findMany({
      where: { status: { in: ["CONFIRMED", "COMPLETED"] }, review: { is: null }, reference: { not: { startsWith: "BK-2026-DEMO" } } },
      select: { id: true, reference: true, customer: { select: { name: true } }, option: { select: { hotelName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return <div className="admin-content ms-reviews-admin">
    <div className="admin-page-head"><div><p className="kicker">CUSTOMER FEEDBACK</p><h1>Reviews</h1><p>Publish only feedback received from a real customer with their permission.</p></div></div>
    <div className="ms-review-admin-grid">
      <section className="admin-panel detail-panel"><h2>Add a review</h2><p className="small-muted">Link feedback to a confirmed or completed booking. Drafts stay private.</p>{bookings.length ? <ReviewForm bookings={bookings.map(booking => ({ id: booking.id, label: `${booking.reference} — ${booking.customer.name} — ${booking.option.hotelName}` }))} /> : <p className="ms-review-empty">No eligible bookings are available. A booking must be confirmed or completed and have no existing review.</p>}</section>
      <aside className="ms-review-admin-note"><Star size={20} aria-hidden="true" /><h2>Reviews build trust when they are real.</h2><p>Use the customer&apos;s words. Confirm permission to publish the quote and display name. You can save a draft, edit it, or unpublish it at any time.</p><div><strong>{reviews.filter(review => review.publishedAt).length}</strong><span>published reviews</span></div></aside>
    </div>
    <section className="ms-review-admin-list" aria-label="Manage reviews">
      <div className="ms-review-list-head"><h2>All reviews</h2><span>{reviews.length} total</span></div>
      {reviews.length ? reviews.map(review => <details className="admin-panel detail-panel ms-review-admin-item" key={review.id}>
        <summary><span><strong>{review.displayName}</strong><small>{review.booking.reference} · {review.booking.option.destination.toLowerCase()} · {review.rating}/5 stars</small></span><span className="status-badge">{review.publishedAt ? "Published" : "Draft"}</span></summary>
        <p className="small-muted">Booking for {review.booking.customer.name} at {review.booking.option.hotelName} · {review.booking.status.toLowerCase()}</p>
        <ReviewForm review={{ id: review.id, displayName: review.displayName, rating: review.rating, body: review.body, published: !!review.publishedAt }} />
      </details>) : <div className="admin-panel detail-panel ms-review-empty">No reviews yet. Approved customer feedback will appear here and on the homepage once published.</div>}
    </section>
  </div>;
}
