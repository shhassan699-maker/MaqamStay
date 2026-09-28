import { z } from "zod";

const parsed = z.object({ DATABASE_URL: z.string().min(1), SESSION_SECRET: z.string().min(32), NEXT_PUBLIC_WHATSAPP_NUMBER: z.string().regex(/^\d{8,15}$/), NEXT_PUBLIC_SITE_URL: z.url() }).safeParse(process.env);
export function env() { if (!parsed.success) throw new Error(`Invalid environment: ${parsed.error.issues.map(i => i.path.join(".")).join(", ")}`); return parsed.data; }
