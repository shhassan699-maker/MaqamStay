import { money } from "@/lib/pricing";
import Decimal from "decimal.js";
export function currencyTotals(rows:{currency:string;amount:{toString():string}}[]){const totals=new Map<string,Decimal>();for(const row of rows)totals.set(row.currency,(totals.get(row.currency)||new Decimal(0)).plus(row.amount.toString()));return [...totals].map(([currency,amount])=>money(amount.toString(),currency)).join(" · ")||"—"}
