import type { Account } from './Account';

export interface AuthenticationContext {
  state: 'ANONYMOUS' | 'SETUP' | 'HUMAN';
  csrfToken: string;
  setupExpiresAt?: string | null;
  enrollmentPurpose?: string | null;
  account?: Account | null;
}
