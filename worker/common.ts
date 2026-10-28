import { MAX_RESTORE_BYTES } from '../src/backupLimits';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    },
  });
}
export function text(value: unknown, name: string, max: number, optional = false) {
  if (typeof value !== 'string' || (!optional && !value.trim()) || value.trim().length > max)
    throw new ApiError(400, 'Check ' + name + '.');
  return value.trim();
}
export function amount(value: unknown, allowZero = false) {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    Math.abs(value) > 100000000 ||
    (!allowZero && value <= 0)
  )
    throw new ApiError(400, 'Invalid amount.');
  return value;
}
export function date(value: unknown) {
  const result = text(value, 'date', 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result) ||
    result < '1900-01-01' ||
    result > '9999-12-31' ||
    !Number.isFinite(Date.parse(result + 'T12:00:00Z')) ||
    new Date(result + 'T12:00:00Z').toISOString().slice(0, 10) !== result
  )
    throw new ApiError(400, 'Choose a valid date.');
  return result;
}
export function uuid(value: unknown) {
  const id = text(value, 'ID', 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw new ApiError(400, 'Invalid ID.');
  return id;
}
export async function body(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new ApiError(415, 'Use JSON for this request.');
  const limit = new URL(request.url).pathname === '/api/restore' ? MAX_RESTORE_BYTES : 8192;
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Missing request body.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      throw new ApiError(413, 'Request is too large.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error();
    return data as Record<string, unknown>;
  } catch {
    throw new ApiError(400, 'Invalid JSON.');
  }
}
export async function accountExists(db: D1Database, owner: string, id: string) {
  if (
    !(await db.prepare('SELECT id FROM accounts WHERE owner_id=? AND id=?').bind(owner, id).first())
  )
    throw new ApiError(404, 'Account not found.');
}
