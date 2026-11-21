export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? 'GET', credentials: 'same-origin', cache: 'no-store', signal: options.signal,
      headers: options.body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError('Cannot reach the pharmacy server. Check that the API is running.', 0);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('pharmacy:session-expired'));
    const message = typeof data?.message === 'string' ? data.message
      : [500, 502, 503, 504].includes(response.status)
        ? 'The pharmacy API is unavailable. Start the backend or restart PharmaDesk, then try again.'
        : 'The request could not be completed.';
    throw new ApiError(message, response.status);
  }
  return data as T;
}

export function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }
