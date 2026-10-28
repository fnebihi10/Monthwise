import { useState, type FormEvent } from 'react';
import { request } from './request';
import { clearPrivateData, lockCache } from './offline';

export function AccountPanel({ pendingCount, busy }: { pendingCount: number; busy: boolean }) {
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  async function remove(event: FormEvent) {
    event.preventDefault();
    if (confirmation !== 'DELETE' || deleting || busy || pendingCount) return;
    setDeleting(true);
    setError('');
    try {
      await request('/api/account/delete', 'POST', { confirmation });
      await lockCache().catch(() => {});
      await clearPrivateData().catch(() => {});
      window.location.assign('/');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not delete your account.');
      setDeleting(false);
    }
  }
  return (
    <section className="release-section">
      <p className="eyebrow">YOUR ACCOUNT, YOUR CHOICE</p>
      <h2>
        Delete your account<span className="title-dot">.</span>
      </h2>
      <p>
        Download a backup first if you want to keep your records. Deletion removes your cloud ledger
        and signs out every session. Other devices may still hold offline copies until you clear
        their browser data. Provider backups expire on their retention schedule.
      </p>
      <p className="muted">
        For protection, sign out and sign in again immediately before deleting. You must have signed
        in within the last ten minutes. <a href="/privacy.html">Privacy & data</a>
      </p>
      {pendingCount > 0 && (
        <p className="form-error">
          Sync or export your pending entries before deleting your account.
        </p>
      )}
      <form onSubmit={(event) => void remove(event)}>
        <fieldset disabled={busy || deleting || pendingCount > 0}>
          <label>
            Type DELETE to confirm
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              required
              pattern="DELETE"
            />
          </label>
          <button className="secondary-button" disabled={confirmation !== 'DELETE'}>
            {deleting ? 'Deleting…' : 'Delete my account and records'}
          </button>
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </section>
  );
}
