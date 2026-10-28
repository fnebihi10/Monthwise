import { useState, type FormEvent } from 'react';
import { serializeBackup, validateBackup, transactionCsv, type Backup } from './backup';
import { MAX_BACKUP_BYTES } from './backupLimits';
import { download } from './download';
import { today, type Shared } from './panelTypes';
export function ToolsPanel({
  data,
  busy,
  mutate,
  onMessage,
  pendingCount = 0,
}: Shared & { pendingCount?: number }) {
  const [backup, setBackup] = useState<Backup | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  async function read(event: FormEvent<HTMLInputElement>) {
    setBackup(null);
    setConfirmed(false);
    setError('');
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw Error('Backups must be at most 8 MB.');
      const b = validateBackup(JSON.parse(await file.text()));
      if (b.ownerId !== data.user.id) throw Error('This backup belongs to another account.');
      setBackup(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid backup.');
    }
  }
  return (
    <section className="tools-panel">
      <div className="release-grid">
        <section className="release-section">
          <p className="eyebrow">KEEP A COPY THAT’S YOURS</p>
          <h2>
            Backup & export<span className="title-dot">.</span>
          </h2>
          <p className="muted">
            JSON includes accounts, transactions, transfers, budgets, plans, goals and allocations.
            It contains private financial information. Save it somewhere you trust. Backups support
            up to 8 MB and 25,000 records per collection.
          </p>
          {pendingCount > 0 && (
            <p className="form-error">Sync your pending entries before backing up or restoring.</p>
          )}
          <div className="form-actions">
            <button
              className="primary-button"
              disabled={busy || pendingCount > 0}
              onClick={() => {
                try {
                  download('monthwise-backup-' + today() + '.json', serializeBackup(data));
                  setError('');
                  onMessage('Backup downloaded. Keep it in Files or another trusted location.');
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Could not create backup.');
                }
              }}
            >
              Download full backup
            </button>
            <button
              className="secondary-button"
              disabled={pendingCount > 0}
              onClick={() =>
                download(
                  'monthwise-transactions-' + today() + '.csv',
                  transactionCsv(data),
                  'text/csv;charset=utf-8',
                )
              }
            >
              Export CSV
            </button>
            <button
              className="secondary-button"
              disabled={busy || pendingCount > 0 || exporting}
              onClick={async () => {
                setExporting(true);
                setError('');
                try {
                  const { exportExcel } = await import('./excel');
                  await exportExcel(data);
                  onMessage(
                    'Excel report downloaded. Open the .xlsx file to see formatted sheets.',
                  );
                } catch {
                  setError('Could not export Excel. Check your connection and try again.');
                } finally {
                  setExporting(false);
                }
              }}
            >
              {exporting ? 'Preparing Excel...' : 'Export Excel (.xlsx)'}
            </button>
          </div>
          <p className="muted">
            Download a separate backup regularly. Your cloud database also has provider-managed
            point-in-time recovery.
          </p>
        </section>
        <section className="release-section">
          <p className="eyebrow">BRING YOUR RECORDS BACK</p>
          <h2>
            Restore missing records<span className="title-dot">.</span>
          </h2>
          <p className="muted">
            Restore never deletes your current records. Changed matching records stop the import
            rather than being overwritten.
          </p>
          <label className="file-label">
            Choose JSON backup
            <input
              type="file"
              accept=".json,application/json"
              disabled={busy || pendingCount > 0}
              onChange={(e) => void read(e)}
            />
          </label>
          {backup && (
            <div className="restore-preview">
              <h3>Check this backup</h3>
              <p>Created {new Date(backup.createdAt).toLocaleString()}</p>
              <p>
                {backup.accounts.length} accounts · {backup.entries.length} entries ·{' '}
                {backup.transfers.length} transfers
              </p>
              <p>
                {backup.budgets.length} budgets · {backup.plans.length} planned items ·{' '}
                {backup.goals.length} goals · {backup.allocations.length} allocations
              </p>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I reviewed this backup. Restore missing records.
              </label>
              <button
                className="primary-button"
                disabled={!confirmed || busy || pendingCount > 0}
                onClick={async () => {
                  try {
                    download(
                      'monthwise-before-restore-' + today() + '.json',
                      serializeBackup(data),
                    );
                    await mutate('/api/restore', 'POST', { backup });
                    setBackup(null);
                    onMessage('Missing records restored. Existing records were preserved.');
                    setError('');
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Restore failed.');
                  }
                }}
              >
                Restore missing records
              </button>
              <p className="muted">A copy of your current ledger downloads before import begins.</p>
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
      <section className="release-section install-section">
        <p className="eyebrow">MAKE IT AN EVERYDAY THING</p>
        <h2>
          On your iPhone<span className="title-dot">.</span>
        </h2>
        <ol>
          <li>Open this app in Safari and sign in.</li>
          <li>Tap Share, then Add to Home Screen.</li>
          <li>Keep Open as Web App enabled if offered, then tap Add.</li>
        </ol>
        <p className="muted">
          Open the installed app online once to prepare offline use. Offline income and expense
          entries stay on this device until synced. Editing, transfers, planning and restore need a
          connection. Keep your device locked; offline records live in browser storage.
        </p>
      </section>
    </section>
  );
}
