import type { Entry } from './finance';
export const DEMO_YEAR = 2026;
export const demoEntries: Entry[] = [];
const purchases = [
  ['05', 'Viva Fresh', 'Groceries', 4275, 'Weekly groceries'],
  ['08', 'Urban traffic', 'Transport', 1500, 'Monthly bus pass'],
  ['11', 'Coffee & company', 'Food & drink', 680, 'Coffee with friends'],
  ['14', 'Gjirafa50', 'Shopping', 5990, 'Wireless headphones'],
  ['17', 'Viva Fresh', 'Groceries', 2860, 'Dinner ingredients'],
  ['20', 'Pizza place', 'Food & drink', 1250, 'Friday dinner'],
  ['23', 'Pharmacy', 'Health', 940, 'Personal care'],
  ['26', 'Corner bakery', 'Food & drink', 420, 'Breakfast'],
] as const;
for (let month = 0; month < 10; month++) {
  const prefix = `2026-${String(month + 1).padStart(2, '0')}`;
  const multiplier = 1 + ((month * 7) % 5) / 10;
  demoEntries.push({
    id: `salary-${month}`,
    kind: 'income',
    amountCents: 90000,
    date: `${prefix}-01`,
    merchant: 'Monthly salary',
    category: 'Salary',
    note: 'Example income',
  });
  demoEntries.push({
    id: `rent-${month}`,
    kind: 'expense',
    amountCents: 25000,
    date: `${prefix}-02`,
    merchant: 'Apartment rent',
    category: 'Home',
    note: 'Example monthly rent',
  });
  purchases.forEach(([day, merchant, category, amount, note], index) => {
    demoEntries.push({
      id: `purchase-${month}-${index}`,
      kind: 'expense',
      amountCents: Math.round(amount * multiplier),
      date: `${prefix}-${day}`,
      merchant,
      category,
      note,
    });
  });
}
