import { createId } from './ids';
import { useMemo, useState, type FormEvent, type RefObject } from 'react';
import { parseCents } from './finance';
import { expenseCategories, type Account, type LedgerEntry } from './models';
import type { Mutate } from './panelTypes';
import { failure } from './formUtils';
export function EntryDialog({
  dialog,
  accounts,
  editing,
  defaultDate,
  formKey,
  busy,
  mutate,
  onSaved,
}: {
  dialog: RefObject<HTMLDialogElement | null>;
  accounts: Account[];
  editing: LedgerEntry | null;
  defaultDate: string;
  formKey: number;
  busy: boolean;
  mutate: Mutate;
  onSaved: (date: string, message: string) => void;
}) {
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const creationId = useMemo(() => createId(), [formKey]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amountCents = parseCents(String(data.get('amount')));
    if (amountCents === null) {
      setError('Enter a positive euro amount with up to two decimals.');
      return;
    }
    const date = String(data.get('date'));
    try {
      await mutate(
        editing ? '/api/entries/' + editing.id : '/api/entries',
        editing ? 'PUT' : 'POST',
        {
          id: editing?.id || creationId,
          revision: editing?.revision,
          accountId: data.get('accountId'),
          kind: data.get('kind'),
          amountCents,
          date,
          merchant: String(data.get('merchant')).trim(),
          category: data.get('category'),
          note: String(data.get('note')).trim(),
        },
      );
      dialog.current?.close();
      onSaved(date, editing ? 'Entry updated.' : 'Entry saved.');
    } catch (error) {
      setError(failure(error));
    }
  }
  async function remove() {
    if (!editing) return;
    try {
      await mutate('/api/entries/' + editing.id, 'DELETE', { revision: editing.revision });
      dialog.current?.close();
      onSaved(editing.date, 'Entry deleted.');
    } catch (error) {
      setError(failure(error));
      setConfirmDelete(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="entry-dialog"
      aria-labelledby="entry-title"
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClose={() => {
        setError('');
        setConfirmDelete(false);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) dialog.current?.close();
      }}
    >
      <form key={formKey} onSubmit={save}>
        <div className="dialog-heading">
          <p className="eyebrow">A LITTLE DETAIL. A CLEARER PICTURE.</p>
          <button
            disabled={busy}
            type="button"
            className="close-button"
            aria-label="Close entry form"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <h2 id="entry-title">
          {editing ? 'Edit' : 'Add'} an entry<span className="title-dot">.</span>
        </h2>
        <p className="form-note">Saved to your ledger. You can come back to it any time.</p>
        <fieldset disabled={busy}>
          <label>
            Type
            <select name="kind" defaultValue={editing?.kind || 'expense'}>
              <option value="expense">Expense — money out</option>
              <option value="income">Income — money in</option>
            </select>
          </label>
          <div className="form-row">
            <label>
              Amount (€)
              <input
                name="amount"
                inputMode="decimal"
                placeholder="0.00"
                defaultValue={editing ? (editing.amountCents / 100).toFixed(2) : ''}
                required
                pattern="[0-9]+(\.[0-9]{1,2})?"
              />
            </label>
            <label>
              Date
              <input
                name="date"
                type="date"
                defaultValue={editing?.date || defaultDate}
                required
                min="1900-01-01"
                max="9999-12-31"
              />
            </label>
          </div>
          <label>
            Account
            <select name="accountId" defaultValue={editing?.accountId || accounts[0]?.id} required>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Name / place
            <input
              name="merchant"
              placeholder="e.g. Groceries at Viva Fresh"
              defaultValue={editing?.merchant || ''}
              required
              maxLength={100}
            />
          </label>
          <label>
            Expense category
            <select
              name="category"
              defaultValue={editing?.kind === 'expense' ? editing.category : 'Groceries'}
            >
              {expenseCategories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            Note (optional)
            <input
              name="note"
              placeholder="What would you like to remember?"
              defaultValue={editing?.note || ''}
              maxLength={250}
            />
          </label>
          <button className="primary-button submit-button" type="submit">
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Save entry'}
          </button>
        </fieldset>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {editing && !confirmDelete && (
          <button
            disabled={busy}
            className="delete-button"
            type="button"
            onClick={() => setConfirmDelete(true)}
          >
            Delete this entry
          </button>
        )}
        {confirmDelete && (
          <div className="delete-confirm">
            <p>Delete this entry? Your totals and account balance will be recalculated.</p>
            <button
              disabled={busy}
              type="button"
              className="delete-button"
              onClick={() => void remove()}
            >
              Yes, delete entry
            </button>
            <button
              disabled={busy}
              type="button"
              className="text-button"
              onClick={() => setConfirmDelete(false)}
            >
              Keep entry
            </button>
          </div>
        )}
      </form>
    </dialog>
  );
}
