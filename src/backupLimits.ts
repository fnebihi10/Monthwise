// Export, file selection, validation, and the HTTP envelope share one contract.
export const MAX_BACKUP_BYTES = 8_000_000;
export const MAX_BACKUP_RECORDS = 25_000;
export const MAX_RESTORE_BYTES = MAX_BACKUP_BYTES + 1024;

export function assertBackupSize(value: unknown) {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_BACKUP_BYTES)
    throw Error(
      'This backup exceeds the 8 MB restore limit. Keep a database export for this ledger.',
    );
}
