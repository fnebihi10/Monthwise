import { createId } from './ids';
import { useRef, useState, type FormEvent } from 'react';
import { euro, parseCents } from './finance';
import type { Account, Transfer } from './models';
import type { Mutate } from './panelTypes';
import { failure, signedCents } from './formUtils';
export function AccountsPanel({
  accounts,
  transfers,
  busy,
  mutate,
  onMessage,
}: {
  accounts: Account[];
  transfers: Transfer[];
  busy: boolean;
  mutate: Mutate;
  onMessage: (message: string) => void;
}) {
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(accounts.length === 0);
  const [moving, setMoving] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const accountId = useRef(createId());
  const transferId = useRef(createId());
  const date = new Date();
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  async function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const opening = signedCents(String(data.get('opening')));
    if (opening === null) {
      setError('Enter a valid opening balance, such as 0 or 250.50.');
      return;
    }
    try {
      await mutate('/api/accounts', 'POST', {
        id: accountId.current,
        name: data.get('name'),
        kind: data.get('kind'),
        openingBalanceCents: opening,
      });
      accountId.current = createId();
      form.reset();
      setAdding(false);
      setError('');
      onMessage('Account created. Your starting balance is separate from monthly income.');
    } catch (error) {
      setError(failure(error));
    }
  }
  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAccount) return;
    const fields = new FormData(event.currentTarget);
    const opening = signedCents(String(fields.get('opening')));
    if (opening === null) {
      setError('Enter a valid opening balance.');
      return;
    }
    try {
      await mutate('/api/accounts/' + editingAccount.id, 'PUT', {
        name: fields.get('name'),
        kind: fields.get('kind'),
        openingBalanceCents: opening,
        previous: {
          name: editingAccount.name,
          kind: editingAccount.kind,
          openingBalanceCents: editingAccount.openingBalanceCents,
        },
      });
      setEditingAccount(null);
      setError('');
      onMessage('Account updated. Your recorded income and expenses were kept.');
    } catch (error) {
      setError(failure(error));
    }
  }
  async function move(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const amountCents = parseCents(String(data.get('amount')));
    if (amountCents === null) {
      setError('Enter a positive transfer amount with up to two decimals.');
      return;
    }
    if (data.get('source') === data.get('destination')) {
      setError('Choose two different accounts.');
      return;
    }
    try {
      await mutate('/api/transfers', 'POST', {
        id: transferId.current,
        sourceAccountId: data.get('source'),
        destinationAccountId: data.get('destination'),
        amountCents,
        date: data.get('date'),
        note: data.get('note'),
      });
      transferId.current = createId();
      form.reset();
      setMoving(false);
      setError('');
      onMessage('Transfer recorded. Income and expenses are unchanged.');
    } catch (error) {
      setError(failure(error));
    }
  }
  async function removeTransfer(id: string) {
    try {
      await mutate('/api/transfers/' + id, 'DELETE', {});
      setDeleting(null);
      setError('');
      onMessage('Transfer removed from both accounts.');
    } catch (error) {
      setError(failure(error));
    }
  }
  return (
    <section className="accounts-panel" aria-label="Accounts and transfers">
      <div className="accounts-intro">
        <p>
          Cash in your pocket. Money in the bank. A little set aside.
          <br />
          Give each one a home, and see the whole picture.
        </p>
        <div>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => {
              setAdding((v) => !v);
              setMoving(false);
              setError('');
            }}
          >
            + Add account
          </button>
          {accounts.length > 1 && (
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => {
                setMoving((v) => !v);
                setAdding(false);
                setError('');
              }}
            >
              Move money ↗
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {adding && (
        <form className="inline-form" onSubmit={addAccount}>
          <h2>
            A home for your money<span className="title-dot">.</span>
          </h2>
          <p className="muted">
            The opening balance is what you already have before the transactions you record here. It
            won’t count as income. A negative balance represents an overdraft.
          </p>
          <fieldset disabled={busy}>
            <div className="account-form-grid">
              <label>
                Account name
                <input name="name" required maxLength={60} placeholder="e.g. My bank account" />
              </label>
              <label>
                Type
                <select name="kind">
                  <option value="bank">Bank account</option>
                  <option value="cash">Cash</option>
                  <option value="savings">Savings</option>
                </select>
              </label>
              <label>
                Opening balance (€)
                <input name="opening" required defaultValue="0.00" inputMode="decimal" />
              </label>
            </div>
            <div className="form-actions">
              <button type="submit" className="primary-button">
                {busy ? 'Saving…' : 'Create account'}
              </button>
              <button type="button" className="text-button" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {editingAccount && (
        <form className="inline-form" onSubmit={saveAccount} aria-label="Edit account">
          <h2>Edit account</h2>
          <p className="muted">
            Opening balance is money held before your recorded transactions. If you recorded your
            starting money as an income entry, use 0 here to avoid counting it twice. Changing this
            balance updates the account total for all history.
          </p>
          <fieldset disabled={busy}>
            <div className="account-form-grid">
              <label>
                Account name
                <input name="name" required maxLength={60} defaultValue={editingAccount.name} />
              </label>
              <label>
                Type
                <select name="kind" aria-label="Type" defaultValue={editingAccount.kind}>
                  <option value="bank">Bank account</option>
                  <option value="cash">Cash</option>
                  <option value="savings">Savings</option>
                </select>
              </label>
              <label>
                Opening balance
                <input
                  name="opening"
                  required
                  inputMode="decimal"
                  defaultValue={(editingAccount.openingBalanceCents / 100).toFixed(2)}
                />
              </label>
            </div>
            <button className="primary-button">Save account changes</button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setEditingAccount(null);
                setError('');
              }}
            >
              Cancel editing
            </button>
          </fieldset>
        </form>
      )}
      {moving && (
        <form className="inline-form" onSubmit={move}>
          <h2>
            Same money. A new home<span className="title-dot">.</span>
          </h2>
          <p className="muted">
            Transfers move money between your accounts. They don’t count as spending or income.
          </p>
          <fieldset disabled={busy}>
            <div className="account-form-grid">
              <label>
                From
                <select name="source" required>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                To
                <select name="destination" defaultValue={accounts[1]?.id} required>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Amount (€)
                <input name="amount" inputMode="decimal" required placeholder="0.00" />
              </label>
              <label>
                Date
                <input
                  name="date"
                  type="date"
                  defaultValue={today}
                  required
                  min="1900-01-01"
                  max="9999-12-31"
                />
              </label>
              <label className="wide-label">
                Note (optional)
                <input name="note" maxLength={250} placeholder="e.g. Putting a little aside" />
              </label>
            </div>
            <div className="form-actions">
              <button className="primary-button" type="submit">
                {busy ? 'Saving…' : 'Record transfer'}
              </button>
              <button className="text-button" type="button" onClick={() => setMoving(false)}>
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      )}
      <div className="accounts-grid">
        {accounts.map((account, index) => (
          <article className="account-card" key={account.id}>
            <span className="eyebrow">
              {String(index + 1).padStart(2, '0')} / {account.kind.toUpperCase()}
            </span>
            <h2>{account.name}</h2>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setEditingAccount({ ...account });
                setAdding(false);
                setMoving(false);
                setError('');
              }}
              aria-label={'Edit account ' + account.name}
            >
              Edit account
            </button>
            <p className="account-balance">{euro(account.balanceCents)}</p>
            <span className="metric-caption">
              Opening balance {euro(account.openingBalanceCents)}
            </span>
          </article>
        ))}
      </div>
      {accounts.length > 0 && (
        <div className="combined-balance">
          <span>Across your accounts</span>
          <strong>{euro(accounts.reduce((sum, a) => sum + a.balanceCents, 0))}</strong>
          <small>Opening balances + income − expenses. Transfers cancel out.</small>
        </div>
      )}
      <section className="transfer-history">
        <p className="eyebrow">BETWEEN YOUR ACCOUNTS</p>
        <h2>
          Money on the move<span className="title-dot">.</span>
        </h2>
        {!transfers.length ? (
          <p className="muted">Your transfers will appear here.</p>
        ) : (
          <ul>
            {transfers.map((transfer) => (
              <li key={transfer.id}>
                <div>
                  <span className="merchant">
                    {accounts.find((a) => a.id === transfer.sourceAccountId)?.name} →{' '}
                    {accounts.find((a) => a.id === transfer.destinationAccountId)?.name}
                  </span>
                  <span className="entry-note">
                    {transfer.date}
                    {transfer.note ? ' · ' + transfer.note : ''}
                  </span>
                </div>
                <strong>{euro(transfer.amountCents)}</strong>
                {deleting === transfer.id ? (
                  <div className="transfer-confirm">
                    <span>Remove from both accounts?</span>
                    <button
                      className="delete-button"
                      disabled={busy}
                      onClick={() => void removeTransfer(transfer.id)}
                    >
                      Confirm removal
                    </button>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => setDeleting(null)}
                    >
                      Keep transfer
                    </button>
                  </div>
                ) : (
                  <button
                    disabled={busy}
                    className="text-button"
                    aria-label={
                      'Remove transfer ' + transfer.date + ' ' + euro(transfer.amountCents)
                    }
                    onClick={() => setDeleting(transfer.id)}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
