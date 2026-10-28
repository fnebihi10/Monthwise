import { expect, it } from 'vitest';
import { createId } from './ids';
it('creates valid distinct UUIDs when randomUUID is unavailable on a phone LAN preview', () => {
  const insecureContextSource = {
    getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
  };
  const ids = Array.from({ length: 100 }, () => createId(insecureContextSource));
  expect(new Set(ids).size).toBe(100);
  for (const id of ids)
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
