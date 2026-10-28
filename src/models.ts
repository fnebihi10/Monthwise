import type { Budget, Plan, Goal, Allocation } from './planning';
import type { Entry } from './finance';
export type Account = {
  id: string;
  name: string;
  kind: 'cash' | 'bank' | 'savings';
  openingBalanceCents: number;
  balanceCents: number;
};
export type LedgerEntry = Entry & { accountId: string; revision: number };
export type Transfer = {
  id: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amountCents: number;
  date: string;
  note: string;
};
export type Snapshot = {
  user: { id: string; email: string; local: boolean };
  accounts: Account[];
  entries: LedgerEntry[];
  transfers: Transfer[];
  budgets: Budget[];
  plans: Plan[];
  goals: Goal[];
  allocations: Allocation[];
};
export type LedgerPage = {
  snapshot: Snapshot;
  version: number;
  next: { entries: string | null; transfers: string | null };
};
export const expenseCategories = [
  'Groceries',
  'Food & drink',
  'Home',
  'Transport',
  'Shopping',
  'Health',
  'Subscriptions',
  'Other',
];
export const emptySnapshot: Snapshot = {
  user: { id: '', email: '', local: false },
  accounts: [],
  entries: [],
  transfers: [],
  budgets: [],
  plans: [],
  goals: [],
  allocations: [],
};
