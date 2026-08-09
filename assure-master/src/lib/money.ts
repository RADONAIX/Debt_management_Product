/**
 * Currency formatting for the Subscriber 360 screens.
 *
 * One place decides how money looks, so tiles, tables and charts can never
 * disagree. `money` gives the exact figure, `moneyShort` the compact form.
 */

export const CURRENCY = "$";

export const money = (amount?: number | null): string =>
  amount === null || amount === undefined
    ? "—"
    : `${CURRENCY}${Math.round(amount).toLocaleString("en-US")}`;

export const moneyShort = (amount?: number | null): string => {
  if (amount === null || amount === undefined) return "—";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${CURRENCY}${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${CURRENCY}${(amount / 1_000).toFixed(1)}K`;
  return `${CURRENCY}${Math.round(amount)}`;
};
