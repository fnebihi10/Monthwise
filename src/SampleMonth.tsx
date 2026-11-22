import { euro } from './finance';
import { emptySnapshot, type LedgerEntry, type Snapshot } from './models';
import { MonthView } from './MonthView';
import { monthKey, reservationTotals } from './planning';
import { buildReports, reportForYear } from './reports';
import { ReservationSummary } from './ReservationSummary';

const year = 2026;
const month = 9;
const datePrefix = monthKey(year, month);
const accountId = 'sample-bank';
const entries: LedgerEntry[] = [
  {
    id: 'salary',
    kind: 'income',
    amountCents: 200000,
    date: datePrefix + '-01',
    merchant: 'Studio salary',
    category: 'Income',
    note: '',
    accountId,
    revision: 1,
  },
  {
    id: 'rent',
    kind: 'expense',
    amountCents: 70000,
    date: datePrefix + '-03',
    merchant: 'October rent',
    category: 'Home',
    note: '',
    accountId,
    revision: 1,
  },
  {
    id: 'market',
    kind: 'expense',
    amountCents: 7500,
    date: datePrefix + '-09',
    merchant: 'Saturday market',
    category: 'Groceries',
    note: '',
    accountId,
    revision: 1,
  },
  {
    id: 'train',
    kind: 'expense',
    amountCents: 2500,
    date: datePrefix + '-13',
    merchant: 'Rail pass',
    category: 'Transport',
    note: '',
    accountId,
    revision: 1,
  },
];
const bill = {
  id: 'utilities',
  kind: 'bill',
  title: 'Electricity bill',
  amountCents: 12500,
  dueDate: datePrefix + '-25',
  category: 'Home',
  recurring: false,
  paidEntryId: null,
} as const;
const goal = { id: 'emergency', name: 'Emergency fund', targetCents: 100000 };
const allocation = {
  id: 'allocation',
  goalId: goal.id,
  amountCents: 30000,
  date: datePrefix + '-14',
};
const report = reportForYear(buildReports(entries), year).months[month];
const openingBalanceCents = 40000;
const sample: Snapshot = {
  ...emptySnapshot,
  accounts: [
    {
      id: accountId,
      name: 'Everyday bank',
      kind: 'bank',
      openingBalanceCents,
      balanceCents: openingBalanceCents + report.retained,
    },
  ],
  entries,
  plans: [bill],
  goals: [goal],
  allocations: [allocation],
};

export function SampleMonth() {
  return (
    <div className="app sample-shell">
      <header className="header sample-header">
        <a className="brand" href="./">
          monthwise<span className="brand-period">.</span>
        </a>
        <a className="secondary-button" href="./">
          Back to home
        </a>
      </header>
      <main>
        <section className="intro">
          <div>
            <h1>
              Sample month<span className="title-dot">.</span>
            </h1>
            <p className="intro-copy">
              October 2026 · Explore a fictional ledger using search and filters.
            </p>
          </div>
        </section>
        <MonthView
          report={report}
          accounts={sample.accounts}
          year={year}
          month={month}
          availability={
            <>
              <ReservationSummary totals={reservationTotals(sample, datePrefix)} />
              <dl className="sample-reservations">
                <div>
                  <dt>Everyday bank opening balance</dt>
                  <dd>{euro(openingBalanceCents)}</dd>
                </div>
                <div>
                  <dt>{bill.title} · unpaid</dt>
                  <dd>{euro(bill.amountCents)}</dd>
                </div>
                <div>
                  <dt>{goal.name} · set aside</dt>
                  <dd>{euro(allocation.amountCents)}</dd>
                </div>
              </dl>
            </>
          }
        />
        <p className="sample-signin">
          <a className="primary-button" href="/auth/google">
            Continue with Google
          </a>
        </p>
      </main>
    </div>
  );
}
