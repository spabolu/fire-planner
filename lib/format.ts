const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const cents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});
export const money = (value: number) => dollars.format(value);
export const exactMoney = (value: number) => cents.format(value);
export const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
export const compactMoney = (value: number) =>
  Math.abs(value) >= 1e6
    ? `$${(value / 1e6).toFixed(2)}m`
    : Math.abs(value) >= 10000
      ? `$${Math.round(value / 1000)}k`
      : money(value);
