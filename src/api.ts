export interface Account {
  accountId: string;
  email: string;
  emailVerified: boolean;
  mfaState: string;
  scopeId: string | null;
  gatewayEntitlement: 'ABSENT' | 'GRANTED' | 'REVOKED';
  session: {
    createdAt: string;
    absoluteExpiresAt: string;
    idleExpiresAt: string;
    recentAuthExpiresAt: string | null;
  };
}

export interface AuthContext {
  state: 'ANONYMOUS' | 'SETUP' | 'HUMAN';
  csrfToken: string;
  setupExpiresAt?: string | null;
  enrollmentPurpose?: string | null;
  account?: Account | null;
}

export interface Operation {
  operationId: string;
  purpose: string;
  state: string;
  createdAt: string;
  expiresAt: string;
}

export interface AuthenticatorSecrets {
  operation: Operation;
  manualKey: string;
  provisioningUri: string;
  recoveryCodes: string[];
}

export interface RecoverySecrets {
  operation: Operation;
  recoveryCodes: string[];
}

export interface Failure {
  code: string;
  message: string;
  correlationId: string;
  retryAfterSeconds?: number | null;
  fieldErrors?: { field: string; message: string }[] | null;
}

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

export function setCsrf(token: string): void {
  csrfToken = token;
}

export async function api<T>(
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
