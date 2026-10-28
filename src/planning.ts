import { summarize } from './finance';
import type { Snapshot } from './models';
export type Budget = { id: string; month: string; category: string; amountCents: number };
export type Plan = {
  id: string;
  kind: 'bill' | 'income';
  title: string;
  amountCents: number;
  dueDate: string;
  category: string;
  recurring: boolean;
  paidEntryId: string | null;
};
export type Goal = { id: string; name: string; targetCents: number };
export type Allocation = { id: string; goalId: string; amountCents: number; date: string };
export function monthKey(year: number, month: number) {
  return year + '-' + String(month + 1).padStart(2, '0');
}
export function goalSaved(data: Snapshot, id: string) {
  return data.allocations.filter((a) => a.goalId === id).reduce((s, a) => s + a.amountCents, 0);
}
export function planningTotals(data: Snapshot, month: string) {
  const entries = data.entries.filter((e) => e.date.startsWith(month + '-'));
  const actual = summarize(entries);
  const pending = data.plans.filter((p) => p.dueDate.startsWith(month + '-') && !p.paidEntryId);
  const bills = pending.filter((p) => p.kind === 'bill').reduce((s, p) => s + p.amountCents, 0);
  const expected = pending
    .filter((p) => p.kind === 'income')
    .reduce((s, p) => s + p.amountCents, 0);
  const reserved = data.allocations.reduce((s, a) => s + a.amountCents, 0);
  const balance = data.accounts.reduce((s, a) => s + a.balanceCents, 0);
  return { ...actual, bills, expected, reserved, balance, unassigned: balance - bills - reserved };
}
