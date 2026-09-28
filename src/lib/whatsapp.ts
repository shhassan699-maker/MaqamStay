export function whatsappUrl(message: string) {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  if (!number) return "#";
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
export function whatsappTo(number:string,message:string){const digits=number.replace(/\D/g,"");return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;}

export function requestWhatsAppMessage(requestNumber: string, destinations: string[], guests: number, rooms: number) {
  return `Assalamualaikum, I submitted an accommodation request through MaqamStay.\n\nRequest: ${requestNumber}\nDestination: ${destinations.join(" & ")}\nGuests: ${guests}\nRooms: ${rooms}\n\nI'd like help finding suitable accommodation.`;
}
