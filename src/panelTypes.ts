import type { Snapshot } from './models';
import { monthKey } from './planning';
export type Mutate = (path: string, method: string, data: unknown) => Promise<void>;
export type Shared = {
  data: Snapshot;
  busy: boolean;
  mutate: Mutate;
  onMessage: (message: string) => void;
};
export const today = () => {
  const d = new Date();
  return monthKey(d.getFullYear(), d.getMonth()) + '-' + String(d.getDate()).padStart(2, '0');
};
