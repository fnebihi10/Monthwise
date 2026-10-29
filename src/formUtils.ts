import { parseCents } from './finance';
export const failure = (error: unknown) =>
  error instanceof Error ? error.message : 'Unable to save. Try again.';
export function signedCents(value: string) {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value)) return null;
  if (Number(value) === 0) return 0;
  const parsed = parseCents(value.replace(/^-/, ''));
  return parsed === null ? null : value.startsWith('-') ? -parsed : parsed;
}
