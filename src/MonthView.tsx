import { useEffect, useMemo, useState } from 'react';
import type { Account, LedgerEntry } from './models';
import { euro, months } from './finance';
import { Arrow } from './Arrow';
import type { MonthReport } from './reports';
const shortDate = (date: string) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(
    new Date(date + 'T12:00:00Z'),
  );
export function MonthView({
  report,
  accounts,
  busy,
  year,
  month,
  openEntry,
  navigate,
}: {
  report: MonthReport;
  accounts: Account[];
  busy: boolean;
  year: number;
  month: number;
  openEntry: (entry?: LedgerEntry) => void;
  navigate: (delta: number) => void;
}) {
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [showAll, setShowAll] = useState(false);
  const monthEntries = report.entries,
    total = report,
    categoryTotals = report.categories;
  const filtered = useMemo(
    () =>
      monthEntries
        .filter(
          (e) =>
            (filter === 'all' || e.kind === filter) &&
            [e.merchant, e.category, e.note].some((s) =>
              s.toLowerCase().includes(query.toLowerCase()),
            ),
        )
        .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)),
    [monthEntries, filter, query],
  );
  const displayed = showAll ? filtered : filtered.slice(0, 6);
  const accountNames = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const retainedPercent = total.income ? Math.round((total.retained / total.income) * 100) : null;
  useEffect(() => {
    setQuery('');
    setFilter('all');
    setShowAll(false);
  }, [year, month]);
  return (
    <>
      <section className="summary" aria-label="Monthly financial summary">
        <div className="summary-cell">
          <span className="eyebrow">01 / MONEY IN</span>
          <p className="money">{euro(total.income)}</p>
          <span className="metric-caption">Income received this month</span>
        </div>
        <div className="summary-cell">
          <span className="eyebrow">02 / MONEY OUT</span>
          <p className="money">{euro(total.spent)}</p>
          <span className="metric-caption">{report.expenseCount} expenses, big and small</span>
        </div>
        <div className="summary-cell retained">
          <span className="eyebrow">03 / WHAT STAYED</span>
          <p className="money">{euro(total.retained)}</p>
          <span className="metric-caption">
            {retainedPercent === null
              ? 'Add income to see your retained share'
              : retainedPercent + '% of this month’s income retained'}
          </span>
        </div>
      </section>
      <div className="workspace">
        <section className="ledger">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE DETAILS MATTER</span>
              <h2>
                Your ledger<span className="entry-count">{monthEntries.length}</span>
              </h2>
            </div>
            <span className="small-label">
              {months[month]} {year}
            </span>
          </div>
          <div className="ledger-controls">
            <label className="search">
              <svg
                aria-hidden="true"
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="10" cy="10" r="6" />
                <path d="m15 15 5 5" />
              </svg>
              <input
                aria-label="Search transactions"
                placeholder="Find a purchase, place, or note…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowAll(false);
                }}
              />
            </label>
            <select
              aria-label="Filter transactions"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setShowAll(false);
              }}
            >
              <option value="all">All entries</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">WHEN</th>
                  <th scope="col">THE WHAT & WHERE</th>
                  <th scope="col" className="category-column">
                    CATEGORY
                  </th>
                  <th scope="col" className="amount-column">
                    AMOUNT
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((entry) => (
                  <tr key={entry.id}>
                    <td className="date-cell">{shortDate(entry.date)}</td>
                    <td>
                      <button
                        className="merchant edit-entry"
                        disabled={busy}
                        onClick={() => openEntry(entry)}
                        aria-label={'Edit ' + entry.merchant}
                      >
                        {entry.merchant}
                      </button>
                      <span className="entry-note">
                        {entry.note || entry.category}
                        {' · ' + (accountNames.get(entry.accountId) || 'Account')}
                      </span>
                    </td>
                    <td className="category-column">
                      <span className="category-tag">{entry.category}</span>
                    </td>
                    <td
                      className={
                        'amount-column entry-amount ' + (entry.kind === 'income' ? 'positive' : '')
                      }
                    >
                      {entry.kind === 'income' ? '+' : '−'}
                      {euro(entry.amountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtered.length && (
            <div className="empty-state">
              <span>Nothing here. Yet.</span>
              <p>
                {query || filter !== 'all'
                  ? 'Try a different search or filter.'
                  : 'Start this chapter with your first income or expense.'}
              </p>
              {!query && filter === 'all' && (
                <button className="text-button" onClick={() => openEntry()}>
                  Add your first entry <Arrow />
                </button>
              )}
            </div>
          )}
          {filtered.length > 6 && (
            <button className="show-more" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Show fewer entries' : `See all ${filtered.length} entries`}
              <Arrow direction={showAll ? 'left' : 'right'} />
            </button>
          )}
        </section>
        <aside>
          <section className="spending">
            <p className="eyebrow">FOLLOW THE MONEY</p>
            <h2>
              Where it went<span className="title-dot">.</span>
            </h2>
            <div className="spending-bar" aria-label="Expense distribution">
              {categoryTotals.map((category, i) => (
                <span
                  key={category.name}
                  style={{ flex: category.amount, background: `var(--chart-${i % 6})` }}
                  title={category.name + ' ' + euro(category.amount)}
                />
              ))}
            </div>
            {categoryTotals.length ? (
              <ul className="category-list">
                {categoryTotals.map((category, i) => (
                  <li key={category.name}>
                    <span className="category-name">
                      <i style={{ background: `var(--chart-${i % 6})` }} />
                      {category.name}
                    </span>
                    <span>{euro(category.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Your spending breakdown will appear after your first expense.</p>
            )}
          </section>
          <section className="note-card">
            <span className="note-star" aria-hidden="true">
              ✳
            </span>
            <p className="eyebrow">A NOTE ON YOUR NUMBERS</p>
            <h3>
              Left over isn’t
              <br />
              all spoken for.
            </h3>
            <p>
              “What stayed” is income minus expenses. It doesn’t include opening balances or unpaid
              bills. Review your commitments before making plans.
            </p>
          </section>
        </aside>
      </div>
      <section className="month-footer">
        <button className="text-button" onClick={() => navigate(-1)}>
          <Arrow direction="left" />
          {months[(month + 11) % 12]}
          {month === 0 ? ' ' + (year - 1) : ''}
        </button>
        <span>Every month has a story. This one is yours.</span>
        <button className="text-button" onClick={() => navigate(1)}>
          {months[(month + 1) % 12]}
          {month === 11 ? ' ' + (year + 1) : ''}
          <Arrow />
        </button>
      </section>
    </>
  );
}
