import { useRef, useState, type ReactNode, type FormEvent } from 'react';
import { euro, parseCents } from './finance';
import { createId } from './ids';
import { expenseCategories } from './models';
import { monthKey, planningTotals, goalSaved } from './planning';
import { today, type Shared } from './panelTypes';
const money = (f: FormData) => {
  const n = parseCents(String(f.get('amount')));
  if (n === null) throw Error('Enter a positive amount with up to two decimals.');
  return n;
};
function Category() {
  return (
    <select name="category">
      {expenseCategories.map((c) => (
        <option key={c}>{c}</option>
      ))}
    </select>
  );
}
function Form({
  path,
  payload,
  children,
  busy,
  mutate,
  onMessage,
  label,
}: {
  path: string;
  payload: (f: FormData, id: string) => unknown;
  children: ReactNode;
  label: string;
} & Pick<Shared, 'busy' | 'mutate' | 'onMessage'>) {
  const id = useRef(createId());
  const [error, setError] = useState('');
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await mutate(path, 'POST', payload(new FormData(form), id.current));
      id.current = createId();
      form.reset();
      setError('');
      onMessage('Saved to your ledger.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }
  return (
    <form className="release-form" onSubmit={save}>
      <fieldset disabled={busy}>
        {children}
        <button className="primary-button">{busy ? 'Saving…' : label}</button>
      </fieldset>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
function Remove({
  path,
  busy,
  mutate,
  onMessage,
  label = 'Remove',
}: { path: string; label?: string } & Pick<Shared, 'busy' | 'mutate' | 'onMessage'>) {
  const [error, setError] = useState('');
  return (
    <>
      <button
        className="text-button remove-small"
        disabled={busy}
        onClick={async () => {
          if (
            !window.confirm(
              'Remove this item? Removing a goal releases its allocations. Paid transactions remain in your ledger.',
            )
          )
            return;
          try {
            await mutate(path, 'DELETE', {});
            onMessage('Removed.');
            setError('');
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not remove.');
          }
        }}
      >
        {label}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
export function PlanningPanel({
  data,
  busy,
  mutate,
  onMessage,
  year,
  month,
}: Shared & { year: number; month: number }) {
  const key = monthKey(year, month),
    totals = planningTotals(data, key),
    shared = { busy, mutate, onMessage };
  const previous = new Date(year, month - 1, 1),
    previousKey = monthKey(previous.getFullYear(), previous.getMonth());
  const [error, setError] = useState('');
  return (
    <section className="planning-panel">
      <div className="planning-summary">
        {[
          ['STILL TO PAY', totals.bills],
          ['EXPECTED, NOT RECEIVED', totals.expected],
          ['UNASSIGNED AFTER RESERVATIONS', totals.unassigned],
        ].map(([label, value]) => (
          <div key={label}>
            <span className="eyebrow">{label}</span>
            <strong>{euro(Number(value))}</strong>
          </div>
        ))}
      </div>
      <p className="calculation-note">
        All account balances ({euro(totals.balance)}) minus this month’s unpaid bills (
        {euro(totals.bills)}) minus goal allocations ({euro(totals.reserved)}). Budgets are limits,
        so they aren’t subtracted again. Expected income isn’t included.
      </p>
      <div className="plan-toolbar">
        <p className="muted">Plans for {key}. Your actual purchases stay in the monthly ledger.</p>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={async () => {
            try {
              await mutate('/api/copy-month', 'POST', { source: previousKey, destination: key });
              onMessage('Copied missing budgets and repeating items. Paid history was unchanged.');
              setError('');
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not copy.');
            }
          }}
        >
          Use previous month’s plan
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="release-grid">
        <section className="release-section">
          <p className="eyebrow">GIVE YOUR MONTH SOME SHAPE</p>
          <h2>
            Category budgets<span className="title-dot">.</span>
          </h2>
          <p className="muted">Saving a category again updates its limit for this month only.</p>
          <Form
            key={'budget' + key}
            path="/api/budgets"
            {...shared}
            label="Save budget"
            payload={(f, id) => ({
              id,
              month: key,
              category: f.get('category'),
              amountCents: money(f),
            })}
          >
            <label>
              Category
              <Category />
            </label>
            <label>
              Monthly limit (€)
              <input name="amount" inputMode="decimal" required placeholder="0.00" />
            </label>
          </Form>
          {data.budgets
            .filter((b) => b.month === key)
            .map((b) => {
              const used = data.entries
                .filter(
                  (e) =>
                    e.kind === 'expense' &&
                    e.category === b.category &&
                    e.date.startsWith(key + '-'),
                )
                .reduce((s, e) => s + e.amountCents, 0);
              return (
                <article className="budget-row" key={b.id}>
                  <div>
                    <strong>{b.category}</strong>
                    <span>
                      {euro(used)} of {euro(b.amountCents)}
                    </span>
                  </div>
                  <progress
                    max={b.amountCents}
                    value={Math.min(used, b.amountCents)}
                    aria-label={b.category + ' budget used'}
                  />
                  <span className={used > b.amountCents ? 'over-budget' : 'muted'}>
                    {used > b.amountCents
                      ? euro(used - b.amountCents) + ' over'
                      : euro(b.amountCents - used) + ' left'}
                  </span>
                  <Remove path={'/api/budgets/' + b.id} {...shared} />
                </article>
              );
            })}
        </section>
        <section className="release-section">
          <p className="eyebrow">KNOW WHAT’S COMING</p>
          <h2>
            Bills & expected income<span className="title-dot">.</span>
          </h2>
          <p className="muted">Marking an item paid or received creates one actual transaction.</p>
          <Form
            key={'plan' + key}
            path="/api/plans"
            {...shared}
            label="Add planned item"
            payload={(f, id) => ({
              id,
              kind: f.get('kind'),
              title: f.get('title'),
              amountCents: money(f),
              dueDate: f.get('date'),
              category: f.get('category'),
              recurring: f.get('recurring') === 'on',
            })}
          >
            <label>
              Type
              <select name="kind">
                <option value="bill">Bill to pay</option>
                <option value="income">Income expected</option>
              </select>
            </label>
            <label>
              Name
              <input name="title" maxLength={100} required placeholder="Rent, salary, internet…" />
            </label>
            <label>
              Amount (€)
              <input name="amount" inputMode="decimal" required placeholder="0.00" />
            </label>
            <label>
              Due / expected date
              <input
                type="date"
                name="date"
                required
                defaultValue={key + '-01'}
                min={key + '-01'}
                max={key + '-' + String(new Date(year, month + 1, 0).getDate())}
              />
            </label>
            <label>
              Expense category
              <Category />
            </label>
            <label className="check-label">
              <input type="checkbox" name="recurring" />
              Include when copying to another month
            </label>
          </Form>
          {data.plans
            .filter((p) => p.dueDate.startsWith(key + '-'))
            .map((p) => (
              <article className="planned-item" key={p.id}>
                <div className="item-heading">
                  <div>
                    <strong>{p.title}</strong>
                    <span>
                      {p.dueDate} · {p.kind === 'bill' ? 'Bill' : 'Expected income'}
                      {p.recurring ? ' · Repeats' : ''}
                    </span>
                  </div>
                  <strong>{euro(p.amountCents)}</strong>
                </div>
                {p.paidEntryId ? (
                  <p className="paid-label">
                    {p.kind === 'bill' ? 'Paid' : 'Received'} · linked in your ledger. Correct it in
                    History if needed.
                  </p>
                ) : data.accounts.length ? (
                  <Form
                    path={'/api/plans/' + p.id + '/pay'}
                    {...shared}
                    label={p.kind === 'bill' ? 'Mark paid' : 'Mark received'}
                    payload={(f, id) => ({
                      entryId: id,
                      accountId: f.get('accountId'),
                      date: f.get('date'),
                    })}
                  >
                    <label>
                      Account
                      <select name="accountId">
                        {data.accounts.map((a) => (
                          <option value={a.id} key={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Actual date
                      <input name="date" type="date" required defaultValue={today()} />
                    </label>
                  </Form>
                ) : (
                  <p className="muted">Create an account to record payment.</p>
                )}
                <Remove path={'/api/plans/' + p.id} {...shared} label="Remove plan" />
              </article>
            ))}
        </section>
      </div>
      <section className="release-section goals-section">
        <p className="eyebrow">SOMETHING TO LOOK FORWARD TO</p>
        <h2>
          Your savings goals<span className="title-dot">.</span>
        </h2>
        <p className="muted">
          Allocations earmark money you already have. They are not expenses or bank transfers. Only
          allocate money that is actually available.
        </p>
        <Form
          path="/api/goals"
          {...shared}
          label="Create goal"
          payload={(f, id) => ({ id, name: f.get('name'), targetCents: money(f) })}
        >
          <label>
            Goal name
            <input name="name" required maxLength={60} placeholder="Emergency fund, a trip…" />
          </label>
          <label>
            Target (€)
            <input name="amount" inputMode="decimal" required placeholder="0.00" />
          </label>
        </Form>
        <div className="release-grid">
          {data.goals.map((g) => (
            <article className="goal-card" key={g.id}>
              <h3>{g.name}</h3>
              <p className="goal-money">
                {euro(goalSaved(data, g.id))}
                <small> / {euro(g.targetCents)}</small>
              </p>
              <progress
                max={g.targetCents}
                value={Math.min(goalSaved(data, g.id), g.targetCents)}
                aria-label={g.name + ' progress'}
              />
              <Form
                path="/api/allocations"
                {...shared}
                label="Set money aside"
                payload={(f, id) => ({
                  id,
                  goalId: g.id,
                  amountCents: money(f),
                  date: f.get('date'),
                })}
              >
                <label>
                  Allocation (€)
                  <input name="amount" inputMode="decimal" required placeholder="0.00" />
                </label>
                <label>
                  Date
                  <input name="date" type="date" required defaultValue={today()} />
                </label>
              </Form>
              {data.allocations
                .filter((a) => a.goalId === g.id)
                .map((a) => (
                  <div className="allocation-row" key={a.id}>
                    <span>
                      {a.date} · {euro(a.amountCents)}
                    </span>
                    <Remove path={'/api/allocations/' + a.id} {...shared} label="Release" />
                  </div>
                ))}
              <Remove path={'/api/goals/' + g.id} {...shared} label="Remove goal" />
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
