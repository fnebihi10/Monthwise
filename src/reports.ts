import type { LedgerEntry } from './models';

export type MonthReport = {
  entries: LedgerEntry[];
  income: number;
  spent: number;
  retained: number;
  expenseCount: number;
  categories: { name: string; amount: number }[];
};
export type YearReport = { months: MonthReport[]; income: number; spent: number; retained: number };
const empty = (): MonthReport => ({
  entries: [],
  income: 0,
  spent: 0,
  retained: 0,
  expenseCount: 0,
  categories: [],
});

// One pass over the ledger; subsequent month/year navigation reuses the index.
export function buildReports(entries: LedgerEntry[]) {
  const reports = new Map<string, MonthReport>();
  const categories = new Map<string, Map<string, number>>();
  for (const entry of entries) {
    const key = entry.date.slice(0, 7);
    let report = reports.get(key);
    if (!report) {
      report = empty();
      reports.set(key, report);
      categories.set(key, new Map());
    }
    report.entries.push(entry);
    if (entry.kind === 'income') report.income += entry.amountCents;
    else {
      report.spent += entry.amountCents;
      report.expenseCount++;
      const totals = categories.get(key)!;
      totals.set(entry.category, (totals.get(entry.category) || 0) + entry.amountCents);
    }
    report.retained = report.income - report.spent;
  }
  for (const [key, report] of reports)
    report.categories = [...categories.get(key)!]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  return reports;
}

export function reportForYear(reports: Map<string, MonthReport>, year: number): YearReport {
  const months = Array.from(
    { length: 12 },
    (_, month) => reports.get(`${year}-${String(month + 1).padStart(2, '0')}`) || empty(),
  );
  const income = months.reduce((sum, month) => sum + month.income, 0);
  const spent = months.reduce((sum, month) => sum + month.spent, 0);
  return { months, income, spent, retained: income - spent };
}
