"use client";

import { useState } from "react";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { whatsappUrl } from "@/lib/whatsapp";
import { track } from "@/lib/analytics";

type Props = { token: string; optionId: string; position: number; hotelName: string; requestNumber: string };

export function InterestButton({ token, optionId, position, hotelName, requestNumber }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function click() {
    const popup = window.open("", "_blank");
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/quotes/${token}/interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      if (!response.ok) throw new Error("Could not record your interest. Please try again.");
      track("hotel_option_interested", { option: position });
      track("whatsapp_clicked", { source: "quote" });
      const url = whatsappUrl(`Assalamualaikum, I'm interested in Option ${position} - ${hotelName} from quote ${requestNumber}.`);
      if (popup) popup.location.href = url;
      else window.location.href = url;
    } catch (cause) {
      popup?.close();
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div><button className="button button-primary" onClick={click} disabled={busy}><WhatsAppIcon size={19}/>{busy ? "Opening..." : "I'm Interested"}</button>{error && <small role="alert" style={{ display: "block", color: "#a33e37", marginTop: 7 }}>{error}</small>}</div>;
}
