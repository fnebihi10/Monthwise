import { PlanningPanel, HistoryPanel, ToolsPanel } from './ReleasePanels';
import { clearPrivateData, lockCache } from './offline';
import { download } from './download';
import { useEffect, useRef, useState } from 'react';
import { useLedger } from './useLedger';
import { AccountsPanel, EntryDialog } from './LedgerForms';
import { expenseCategories, type LedgerEntry } from './models';
import { entriesForMonth, euro, months, summarize } from './finance';

const categories = expenseCategories;
const shortDate = (date: string) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(
    new Date(date + 'T12:00:00Z'),
  );
function Arrow({ direction = 'right' }: { direction?: 'right' | 'left' }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      style={{ transform: direction === 'left' ? 'rotate(180deg)' : undefined }}
    >
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </svg>
  );
}
export default function App() {
  const ledger = useLedger();
  const { entries, accounts } = ledger;
  const [editing, setEditing] = useState<LedgerEntry | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [view, setView] = useState<
    'month' | 'year' | 'accounts' | 'planning' | 'history' | 'tools'
  >('month');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const [message, setMessage] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const monthStrip = useRef<HTMLElement>(null);
  useEffect(() => {
    const strip = monthStrip.current;
    const selected = strip?.querySelector<HTMLElement>('[aria-current="date"]');
    if (strip && selected)
      strip.scrollLeft +=
        selected.getBoundingClientRect().left -
        strip.getBoundingClientRect().left -
        (strip.clientWidth - selected.clientWidth) / 2;
  }, [month, year, view]);
  const monthEntries = entriesForMonth(entries, year, month);
  const total = summarize(monthEntries);
  const yearTotal = summarize(entries.filter((e) => e.date.startsWith(year + '-')));
  const expenses = monthEntries.filter((e) => e.kind === 'expense');
  const categoryTotals = categories
    .map((name) => ({
      name,
      amount: expenses
        .filter((e) => e.category === name)
        .reduce((sum, e) => sum + e.amountCents, 0),
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const filtered = monthEntries
    .filter(
      (e) =>
        (filter === 'all' || e.kind === filter) &&
        [e.merchant, e.category, e.note].some((s) => s.toLowerCase().includes(query.toLowerCase())),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const displayed = showAll ? filtered : filtered.slice(0, 6);
  useEffect(() => {
    setShowAll(false);
    setQuery('');
    setFilter('all');
  }, [year, month]);
  function navigate(delta: number) {
    const next = new Date(Date.UTC(year, month + delta, 1));
    setYear(next.getUTCFullYear());
    setMonth(next.getUTCMonth());
  }
  function openEntry(entry?: LedgerEntry) {
    if (!accounts.length) {
      setView('accounts');
      setMessage('Create an account first, then record your income or expenses.');
      return;
    }
    if (entry && ledger.pending.some((item) => item.id === entry.id)) {
      setMessage('Sync this pending entry before editing it.');
      return;
    }
    setEditing(entry || null);
    setFormKey((key) => key + 1);
    dialog.current?.showModal();
  }
  function onSaved(date: string, message: string) {
    const [entryYear, entryMonth] = date.split('-').map(Number);
    setYear(entryYear);
    setMonth(entryMonth - 1);
    setView('month');
    setMessage(message);
  }
  if (ledger.state !== 'ready')
    return (
      <div className="app auth-shell">
        <a className="brand" href="./">
          monthwise<span className="brand-period">.</span>
        </a>
        <section className="auth-card">
          <p className="eyebrow">YOUR PERSONAL LEDGER</p>
          <h1>
            {ledger.state === 'loading'
              ? 'A moment.'
              : ledger.state === 'signed-out'
                ? 'Make room for your plans.'
                : 'Let’s reconnect.'}
          </h1>
          <p>
            {ledger.state === 'loading'
              ? 'Opening your ledger…'
              : ledger.state === 'signed-out'
                ? 'Track income, expenses and savings goals, with a private ledger for your account.'
                : ledger.error}
          </p>
          {ledger.state === 'signed-out' && (
            <p className="muted">
              {ledger.error} <a href="/privacy.html">Privacy & data</a>
            </p>
          )}
          {ledger.state === 'signed-out' ? (
            <a className="primary-button" href="/auth/google">
              Continue with Google
            </a>
          ) : ledger.state === 'error' ? (
            <button
              className="primary-button"
              onClick={() => void ledger.refresh().catch(() => {})}
            >
              Try again
            </button>
          ) : null}
          <span className="muted">
            {import.meta.env.DEV
              ? 'Start the Monthwise backend with npm run dev.'
              : 'Check your connection and try again.'}
          </span>
        </section>
      </div>
    );
  const now = new Date();
  const defaultDay = year === now.getFullYear() && month === now.getMonth() ? now.getDate() : 1;
  const retainedPercent = total.income ? Math.round((total.retained / total.income) * 100) : null;
  return (
    <div className="app">
      <header className="header">
        <a className="brand" href="./" aria-label="Monthwise home">
          <span className="brand-mark">
            m<span>•</span>
          </span>
          monthwise<span className="brand-period">.</span>
        </a>
        <span className="header-caption">A LITTLE MORE CLARITY.</span>
        <div className="header-right">
          <span className="private-label">
            <span className="status-dot" />
            {ledger.user.local ? 'Local workspace' : ledger.user.email}
          </span>
          {!ledger.user.local && (
            <form
              method="post"
              action="/auth/logout"
              onSubmit={async (event) => {
                event.preventDefault();
                if (
                  ledger.pendingCount &&
                  !window.confirm(
                    'Signing out clears unsynced entries on this device. Export them first if you need a copy. Continue?',
                  )
                )
                  return;
                try {
                  const response = await fetch('/auth/logout', {
                    method: 'POST',
                    credentials: 'same-origin',
                    redirect: 'manual',
                  });
                  if (response.type !== 'opaqueredirect' && !response.ok) throw Error();
                  await lockCache().catch(() => {});
                  await clearPrivateData().catch(() => {});
                  window.location.assign('/');
                } catch {
                  setMessage('Connect to the internet to sign out securely.');
                }
              }}
            >
              <button className="signout-link" type="submit">
                Sign out
              </button>
            </form>
          )}
          <span className="avatar" aria-label="Personal profile">
            M
          </span>
        </div>
      </header>
      <div className="demo-banner">
        <span>
          {ledger.user.local ? (
            <>
              <strong>Local workspace</strong> · Saved on this computer. Not cloud-synced or backed
              up yet.
            </>
          ) : (
            <>
              <strong>Private ledger</strong> · Your records are saved securely to your account.
            </>
          )}
        </span>
        <span>{ledger.user.local ? 'DEVELOPMENT' : 'PERSONAL LEDGER'}</span>
      </div>
      <main>
        <div className="page-top">
          <div className="view-switch" aria-label="Ledger view">
            {(
              [
                ['month', 'The month'],
                ['year', 'The whole year'],
                ['accounts', 'Accounts'],
                ['planning', 'Plan'],
                ['history', 'History'],
                ['tools', 'Backup & app'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={view === key ? 'active' : ''}
                aria-pressed={view === key}
                onClick={() => setView(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="year-picker">
            <button aria-label="Previous year" onClick={() => setYear((y) => y - 1)}>
              <Arrow direction="left" />
            </button>
            <span>{year}</span>
            <button aria-label="Next year" onClick={() => setYear((y) => y + 1)}>
              <Arrow />
            </button>
          </div>
        </div>
        {['month', 'year', 'planning'].includes(view) && (
          <nav ref={monthStrip} className="month-strip" aria-label="Choose a month">
            {months.map((name, index) => (
              <button
                key={name}
                className={
                  month === index && (view === 'month' || view === 'planning') ? 'selected' : ''
                }
                aria-current={
                  month === index && (view === 'month' || view === 'planning') ? 'date' : undefined
                }
                onClick={() => {
                  setMonth(index);
                  setView((current) => (current === 'planning' ? 'planning' : 'month'));
                }}
              >
                <span className="month-number">{String(index + 1).padStart(2, '0')}</span>
                <span>{name.slice(0, 3)}</span>
                <span
                  className={
                    'month-dot ' +
                    (entriesForMonth(entries, year, index).length ? 'has-entries' : '')
                  }
                />
              </button>
            ))}
          </nav>
        )}
        {(ledger.offline || ledger.pendingCount > 0 || ledger.syncMessage) && (
          <>
            <div className="sync-banner" role="status">
              <span>
                {ledger.offline ? 'Offline ? ' : ''}
                {ledger.pendingCount
                  ? ledger.pendingCount + ' entries saved on this device, waiting to sync.'
                  : 'Viewing your saved ledger.'}{' '}
                {ledger.syncMessage}
              </span>
              <button onClick={() => void ledger.refresh().catch(() => {})}>Retry sync</button>
            </div>
            {ledger.pendingCount > 0 && (
              <details className="sync-details">
                <summary>Review pending entries</summary>
                <button
                  className="text-button"
                  onClick={() =>
                    download('monthwise-pending.json', JSON.stringify(ledger.pending, null, 2))
                  }
                >
                  Export a copy of pending entries
                </button>
                <ul>
                  {ledger.pending.map((item) => (
                    <li key={item.id}>
                      {item.entry.merchant} ? {euro(item.entry.amountCents)} ? {item.entry.date}
                      {item.error ? ' ? ' + item.error : ''}{' '}
                      <button
                        className="text-button"
                        onClick={() => {
                          if (window.confirm('Discard this unsynced entry from this device?'))
                            void ledger.discardPending(item.id);
                        }}
                      >
                        Discard
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
        <section className="intro">
          <div>
            <p className="eyebrow">
              {view === 'planning'
                ? 'A LITTLE INTENTION GOES A LONG WAY'
                : view === 'tools'
                  ? 'YOUR RECORDS. YOUR PEACE OF MIND.'
                  : 'YOUR MONEY, IN PERSPECTIVE'}
            </p>
            <h1>
              {
                {
                  month: months[month],
                  year: 'The year',
                  accounts: 'Your accounts',
                  planning: 'Make a plan',
                  history: 'Your history',
                  tools: 'Keep it safe',
                }[view]
              }
              <span className="title-dot">.</span>
              {view !== 'accounts' && <span className="title-year">{year}</span>}
            </h1>
            <p className="intro-copy">
              {view === 'planning'
                ? 'Make room for what matters this month.'
                : view === 'tools'
                  ? 'A separate copy. A familiar place on your phone.'
                  : 'A place for every euro. A clearer picture of what?s yours.'}
            </p>
          </div>
          <button className="primary-button" disabled={ledger.busy} onClick={() => openEntry()}>
            <span className="plus" aria-hidden="true">
              +
            </span>
            Add an entry
          </button>
        </section>
        {message && (
          <div className="feedback" role="status">
            {message}
            <button aria-label="Dismiss message" onClick={() => setMessage('')}>
              ×
            </button>
          </div>
        )}
        {view === 'planning' ? (
          <PlanningPanel
            data={ledger}
            busy={ledger.busy}
            mutate={ledger.mutate}
            onMessage={setMessage}
            year={year}
            month={month}
          />
        ) : view === 'history' ? (
          <HistoryPanel data={ledger} onEdit={openEntry} />
        ) : view === 'tools' ? (
          <ToolsPanel
            data={ledger}
            busy={ledger.busy}
            mutate={ledger.mutate}
            onMessage={setMessage}
            pendingCount={ledger.pendingCount}
          />
        ) : view === 'accounts' ? (
          <AccountsPanel
            accounts={accounts}
            transfers={ledger.transfers}
            busy={ledger.busy}
            mutate={ledger.mutate}
            onMessage={setMessage}
          />
        ) : view === 'month' ? (
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
                <span className="metric-caption">{expenses.length} expenses, big and small</span>
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
                              disabled={ledger.busy}
                              onClick={() => openEntry(entry)}
                              aria-label={'Edit ' + entry.merchant}
                            >
                              {entry.merchant}
                            </button>
                            <span className="entry-note">
                              {entry.note || entry.category}
                              {' · ' +
                                (accounts.find((a) => a.id === entry.accountId)?.name || 'Account')}
                            </span>
                          </td>
                          <td className="category-column">
                            <span className="category-tag">{entry.category}</span>
                          </td>
                          <td
                            className={
                              'amount-column entry-amount ' +
                              (entry.kind === 'income' ? 'positive' : '')
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
                    <p className="muted">
                      Your spending breakdown will appear after your first expense.
                    </p>
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
                    “What stayed” is income minus expenses. It doesn’t include opening balances or
                    unpaid bills. Review your commitments before making plans.
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
        ) : (
          <>
            <section className="annual-heading">
              <p>
                <strong>{euro(yearTotal.retained)}</strong> retained across the year
              </p>
              <span>
                Income {euro(yearTotal.income)} · Expenses {euro(yearTotal.spent)}
              </span>
            </section>
            <div className="year-grid">
              {months.map((name, index) => {
                const data = summarize(entriesForMonth(entries, year, index));
                return (
                  <button
                    className="year-card"
                    key={name}
                    onClick={() => {
                      setMonth(index);
                      setView('month');
                    }}
                  >
                    <span className="eyebrow">
                      {String(index + 1).padStart(2, '0')} / {year}
                    </span>
                    <h2>
                      {name}
                      <Arrow />
                    </h2>
                    <dl>
                      <div>
                        <dt>In</dt>
                        <dd>{euro(data.income)}</dd>
                      </div>
                      <div>
                        <dt>Out</dt>
                        <dd>{euro(data.spent)}</dd>
                      </div>
                      <div className="year-retained">
                        <dt>Stayed</dt>
                        <dd>{euro(data.retained)}</dd>
                      </div>
                    </dl>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>
      <footer className="site-footer">
        <span>
          monthwise. <span>Made for your everyday.</span>
        </span>
        <span>EUR · EN · {ledger.user.local ? 'LOCAL' : 'PRIVATE'}</span>
      </footer>
      <EntryDialog
        dialog={dialog}
        accounts={accounts}
        editing={editing}
        defaultDate={`${year}-${String(month + 1).padStart(2, '0')}-${String(defaultDay).padStart(2, '0')}`}
        formKey={formKey}
        busy={ledger.busy}
        mutate={ledger.mutate}
        onSaved={onSaved}
      />
    </div>
  );
}
