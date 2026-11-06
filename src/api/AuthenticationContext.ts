import type { Account } from './Account';

export interface AuthenticationContext {
  state: 'ANONYMOUS' | 'MFA_REQUIRED' | 'SETUP' | 'HUMAN';
  csrfToken: string;
  setupExpiresAt?: string | null;
  enrollmentPurpose?: string | null;
  account?: Account | null;
}
