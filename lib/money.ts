/**
 * Prices, in the currency of the organization that charges them.
 *
 * ADR-0024 (resolution 2) put the currency on `organizations.currency`
 * (ISO 4217, default UYU) instead of hardcoding a `$` at every call site,
 * which is what the screens did before and is wrong the first time a
 * business quotes in another currency.
 *
 * Plain module, not `"use server"`: it's called from client components too.
 *
 *   formatMoney(2500, organization.currency) // "$ 2.500"
 *   formatMoney(null, "UYU")                 // "—"
 */
export function formatMoney(amount: number | null | undefined, currency: string): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return "—";
  }

  // Round prices read as prices, not as accounting: "$ 2.500", not
  // "$ 2.500,00". Cents only show up when there are cents.
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;

  try {
    return new Intl.NumberFormat("es-UY", {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    // An unknown ISO code makes Intl throw. The database CHECK only
    // guarantees three uppercase letters, so "XXX" reaches here -- and a
    // price that fails to render is worse than one rendered plainly.
    return `${currency} ${amount.toLocaleString("es-UY")}`;
  }
}
