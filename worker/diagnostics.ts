import { json } from './common';

export function recordFailure(
  scope: 'ledger' | 'worker' | 'auth',
  requestId: string,
  status: number,
) {
  // Deliberately no error object, URL, user identity, IP, headers, SQL, or body.
  console.error(
    JSON.stringify({
      event: 'request_failed',
      scope,
      requestId,
      status,
      at: new Date().toISOString(),
    }),
  );
}

export function failureResponse(scope: 'ledger' | 'worker', requestId: string, status: 500 | 503) {
  recordFailure(scope, requestId, status);
  const response = json(
    { error: 'Unable to complete this request. Please try again.', requestId },
    status,
  );
  response.headers.set('X-Request-ID', requestId);
  return response;
}
