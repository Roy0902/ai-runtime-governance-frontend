import type { Failure } from './api/Failure';

export class ApiError extends Error {
  status: number;
  code: string;
  fieldErrors: { field: string; message: string }[];
  retryAfterSeconds: number | null;

  constructor(status: number, failure: Failure) {
    super(failure.message);
    this.status = status;
    this.code = failure.code;
    this.fieldErrors = failure.fieldErrors ?? [];
    this.retryAfterSeconds = failure.retryAfterSeconds ?? null;
  }
}

let csrfToken = '';

export function setCsrfToken(token: string): void {
  csrfToken = token;
}

export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {};
  if (options.body !== undefined || ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers['Content-Type'] = 'application/json';
  }
  if (csrfToken && method !== 'GET') {
    headers['X-CSRF-Token'] = csrfToken;
  }
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new ApiError(response.status, payload as Failure);
  }
  return payload as T;
}
