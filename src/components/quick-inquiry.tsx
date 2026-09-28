import { ArrowRight, CalendarDays, MapPin, Users } from "lucide-react";

export function QuickInquiry() {
  return <form className="ms-quick-inquiry" action="/request" method="get">
    <div className="ms-quick-heading"><span><MapPin size={17}/></span><div><strong>Start with your travel plans</strong><small>We will help you complete the details</small></div></div>
    <label htmlFor="quick-destination">Destination</label>
    <select id="quick-destination" name="destination" defaultValue="MAKKAH"><option value="MAKKAH">Makkah</option><option value="MADINAH">Madinah</option><option value="JEDDAH">Jeddah</option><option value="RIYADH">Riyadh</option></select>
    <div className="ms-quick-grid ms-quick-dates"><div><label htmlFor="quick-checkin"><CalendarDays size={14}/> Check-in</label><input id="quick-checkin" name="checkIn" type="date" /></div><div><label htmlFor="quick-checkout"><CalendarDays size={14}/> Check-out</label><input id="quick-checkout" name="checkOut" type="date" /></div></div>
    <div className="ms-quick-grid"><div><label htmlFor="quick-adults"><Users size={14}/> Adults</label><input id="quick-adults" name="adults" type="number" min="1" max="30" defaultValue="2" /></div><div><label htmlFor="quick-rooms">Rooms</label><input id="quick-rooms" name="rooms" type="number" min="1" max="20" defaultValue="1" /></div></div>
    <button type="submit" className="button button-primary">Continue to your request <ArrowRight size={17}/></button>
    <p>No live availability. Our team checks suitable options after you submit.</p>
  </form>;
}
