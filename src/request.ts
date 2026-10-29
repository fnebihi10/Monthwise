export class RequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public requestId?: string,
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
  if (!response.ok) {
    const reference = response.headers.get('X-Request-ID');
    const requestId = reference && /^[a-f0-9-]{36}$/i.test(reference) ? reference : undefined;
    const message = result?.error || 'Request failed.';
    throw new RequestError(
      response.status,
      message + (requestId && response.status >= 500 ? ' Reference: ' + requestId : ''),
      requestId,
    );
  }
  return result as T;
}

export function retryable(error: unknown) {
  return (
    !(error instanceof RequestError) ||
    [408, 425, 429].includes(error.status) ||
    error.status >= 500
  );
}
