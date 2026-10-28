export class RequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function request<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: data ? { 'Content-Type': 'application/json' } : {},
    body: data ? JSON.stringify(data) : undefined,
    redirect: 'error',
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new RequestError(
      response.status,
      'Could not read ledger data. Check your connection and sign-in.',
    );
  }
  if (!response.ok) throw new RequestError(response.status, result.error || 'Request failed.');
  return result as T;
}

export function retryable(error: unknown) {
  return (
    !(error instanceof RequestError) ||
    [408, 425, 429].includes(error.status) ||
    error.status >= 500
  );
}
