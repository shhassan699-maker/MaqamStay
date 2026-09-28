import Link from "next/link";
import { ArrowRight, BookOpen, Building2, Coins, Inbox, MessageCircle, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { titleCase, dateLabel } from "@/lib/format";
import { currencyTotals } from "@/lib/admin-format";

export default async function Dashboard() {
  const [counts, recent, bookings] = await Promise.all([
    db.accommodationRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    db.accommodationRequest.findMany({ take: 6, orderBy: { createdAt: "desc" }, include: { customer: true, destinations: true } }),
    db.booking.findMany({ select: { currency: true, expectedCommission: true, actualCommission: true, commissions: true } }),
  ]);
  const count = (status: string) => counts.find(item => item.status === status)?._count._all || 0;
  const cards = [
    { label: "New Requests", value: count("NEW"), icon: Inbox },
    { label: "Waiting for Supplier", value: count("SUPPLIER_REQUESTED"), icon: Building2 },
    { label: "Options Received", value: count("OPTIONS_RECEIVED"), icon: Building2 },
    { label: "Quotes Sent", value: count("QUOTE_SENT"), icon: Inbox },
    { label: "Customer Interested", value: count("CUSTOMER_INTERESTED"), icon: MessageCircle },
    { label: "Payment Pending", value: count("PAYMENT_PENDING"), icon: Coins },
    { label: "Confirmed Bookings", value: count("BOOKED"), icon: BookOpen },
    { label: "Cancelled", value: count("CANCELLED"), icon: Inbox },
  ];
  const expected = currencyTotals(bookings.filter(booking => booking.commissions.some(commission => commission.status !== "VOID")).map(booking => ({ currency: booking.currency, amount: booking.expectedCommission })));
  const realized = currencyTotals(bookings.filter(booking => booking.commissions.some(commission => commission.status === "RECEIVED")).map(booking => ({ currency: booking.currency, amount: booking.actualCommission || booking.expectedCommission })));
  const latest = recent[0];

  return <div className="admin-content ms-admin-content"><div className="ms-admin-dashboard-head"><div><p className="ms-kicker">MAQAMSTAY OPERATIONS</p><h1>Accommodation dashboard</h1><p>Track requests, quotes, bookings and commission in one place.</p></div><div className="ms-admin-commission-summary"><div><Coins size={19}/><span><small>EXPECTED COMMISSION</small><strong>{expected}</strong></span></div><div><ShieldCheck size={19}/><span><small>REALIZED COMMISSION</small><strong>{realized}</strong></span></div></div></div>
    <div className="ms-admin-status-grid">{cards.map(card => <Link href={`/admin/requests?status=${({ "New Requests":"NEW", "Waiting for Supplier":"SUPPLIER_REQUESTED", "Options Received":"OPTIONS_RECEIVED", "Quotes Sent":"QUOTE_SENT", "Customer Interested":"CUSTOMER_INTERESTED", "Payment Pending":"PAYMENT_PENDING", "Confirmed Bookings":"BOOKED", "Cancelled":"CANCELLED" } as Record<string,string>)[card.label]}`} className="ms-admin-status-card" key={card.label}><span><card.icon size={15}/>{card.label}</span><strong>{card.value}</strong><ArrowRight size={15} className="ms-admin-status-arrow"/></Link>)}</div>
    <div className="ms-admin-dashboard-grid"><section className="admin-panel ms-admin-table-panel"><div className="admin-panel-head"><div><p className="ms-kicker">LATEST ACTIVITY</p><h2>Recent requests</h2></div><Link href="/admin/requests">View all <ArrowRight size={15}/></Link></div><div className="table-scroll"><table className="admin-table"><thead><tr><th>Request & customer</th><th>Destination</th><th>Created</th><th>Status</th><th aria-label="Open request"/></tr></thead><tbody>{recent.map(request => <tr key={request.id}><td><Link href={`/admin/requests/${request.id}`} className="table-link">{request.requestNumber}</Link><small className="ms-admin-customer-name">{request.customer.name}</small></td><td>{request.destinations.map(destination => titleCase(destination.destination)).join(" & ")}</td><td>{dateLabel(request.createdAt)}</td><td><span className="status-badge">{titleCase(request.status)}</span></td><td><Link href={`/admin/requests/${request.id}`} aria-label={`Open ${request.requestNumber}`} className="ms-admin-row-arrow"><ArrowRight size={16}/></Link></td></tr>)}</tbody></table></div>{recent.length === 0 && <p className="empty-state">No requests yet. New customer requests will appear here.</p>}</section>
      <aside className="ms-admin-side-panel"><div className="ms-admin-side-top"><p className="ms-kicker">LATEST REQUEST</p>{latest ? <><h2>{latest.requestNumber}</h2><span className="status-badge">{titleCase(latest.status)}</span></> : <h2>No requests yet</h2>}</div>{latest ? <><div className="ms-admin-side-customer"><span>{latest.customer.name.split(" ").map(part => part[0]).slice(0,2).join("").toUpperCase()}</span><div><strong>{latest.customer.name}</strong><small>{latest.customer.city}, {latest.customer.country}</small></div></div><div className="ms-admin-side-facts"><div><small>DESTINATION</small><strong>{latest.destinations.map(destination => destination.otherName || titleCase(destination.destination)).join(" & ")}</strong></div><div><small>TRAVELERS</small><strong>{latest.adults + latest.children} guests · {latest.rooms} {latest.rooms === 1 ? "room" : "rooms"}</strong></div><div><small>TRAVEL DATES</small><strong>{latest.destinations.map(destination => `${dateLabel(destination.checkIn)} to ${dateLabel(destination.checkOut)}`).join("; ")}</strong></div><div><small>CREATED</small><strong>{dateLabel(latest.createdAt)}</strong></div></div><Link className="button button-primary" href={`/admin/requests/${latest.id}`}>Open request <ArrowRight size={16}/></Link></> : <p className="small-muted">Submit a request through the public site to start the accommodation workflow.</p>}</aside></div>
  </div>;
}
