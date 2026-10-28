export type Entry = {
  id: string;
  kind: 'income' | 'expense';
  amountCents: number;
  date: string;
  merchant: string;
  category: string;
  note: string;
};
export const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const currencyFormatter = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
export function euro(cents: number) {
  return currencyFormatter.format(cents / 100);
}
export function entriesForMonth<T extends Entry>(entries: T[], year: number, month: number) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  return entries.filter((entry) => entry.date.startsWith(prefix));
}
export function summarize(entries: Entry[]) {
  const income = entries
    .filter((e) => e.kind === 'income')
    .reduce((sum, e) => sum + e.amountCents, 0);
  const spent = entries
    .filter((e) => e.kind === 'expense')
    .reduce((sum, e) => sum + e.amountCents, 0);
  return { income, spent, retained: income - spent };
}
export function parseCents(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 100000000 ? cents : null;
}
