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
