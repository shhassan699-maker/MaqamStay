import Decimal from "decimal.js";

export function calculatePrice(input: { supplierPrice: string; taxesFees?: string; markupType: "FIXED" | "PERCENTAGE"; markupValue: string; customerPriceOverride?: string }) {
  const supplier = new Decimal(input.supplierPrice);
  const fees = new Decimal(input.taxesFees || "0");
  const markup = new Decimal(input.markupValue);
  if (supplier.isNegative() || fees.isNegative() || markup.isNegative()) throw new Error("Prices cannot be negative");
  const cost = supplier.plus(fees);
  const calculated = cost.plus(input.markupType === "FIXED" ? markup : cost.mul(markup).div(100));
  const customer = input.customerPriceOverride ? new Decimal(input.customerPriceOverride) : calculated;
  if (customer.lt(cost)) throw new Error("Customer price cannot be below supplier cost and fees");
  return { customerPrice: customer.toDecimalPlaces(2).toFixed(2), expectedCommission: customer.minus(cost).toDecimalPlaces(2).toFixed(2) };
}

export function money(value: string | number, currency: string) { const fixed=new Decimal(value).toFixed(2);const [whole,fraction]=fixed.split(".");return `${currency} ${whole.replace(/\B(?=(\d{3})+(?!\d))/g,",")}${fraction==="00"?"":`.${fraction}`}`; }
