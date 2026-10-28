import { useState } from 'react';
import { expenseCategories, type Snapshot, type LedgerEntry } from './models';
import { euro } from './finance';
export function HistoryPanel({
  data,
  onEdit,
}: {
  data: Snapshot;
  onEdit: (entry: LedgerEntry) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [count, setCount] = useState(30);
  const rows = data.entries
    .filter(
      (e) =>
        (category === 'all' || e.category === category) &&
        [e.date, e.merchant, e.note, e.category].some((v) =>
          v.toLowerCase().includes(query.toLowerCase()),
        ),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="release-section">
      <h2>
        Every little detail<span className="title-dot">.</span>
      </h2>
      <p className="muted">Search across all months and years. Tap an entry to edit it.</p>
      <div className="history-filters">
        <label>
          Search history
          <input
            value={query}
            placeholder="Shop, note, or YYYY-MM…"
            onChange={(e) => {
              setQuery(e.target.value);
              setCount(30);
            }}
          />
        </label>
        <label>
          Category
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setCount(30);
            }}
          >
            <option value="all">All categories</option>
            <option>Income</option>
            {expenseCategories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted">{rows.length} matching entries</p>
      <ul className="history-list">
        {rows.slice(0, count).map((e) => (
          <li key={e.id}>
            <button onClick={() => onEdit(e)}>
              <span>{e.date}</span>
              <span>
                <strong>{e.merchant}</strong>
                <small>
                  {e.category} · {data.accounts.find((a) => a.id === e.accountId)?.name}
                  {e.note ? ' · ' + e.note : ''}
                </small>
              </span>
              <strong className={e.kind === 'income' ? 'positive' : ''}>
                {e.kind === 'income' ? '+' : '−'}
                {euro(e.amountCents)}
              </strong>
            </button>
          </li>
        ))}
      </ul>
      {rows.length > count && (
        <button className="secondary-button" onClick={() => setCount((c) => c + 30)}>
          Show more
        </button>
      )}
    </section>
  );
}
