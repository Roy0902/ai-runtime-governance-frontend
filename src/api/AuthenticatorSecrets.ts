import type { Operation } from './Operation';

export interface AuthenticatorSecrets {
  operation: Operation;
  manualKey: string;
  provisioningUri: string;
  recoveryCodes: string[];
}
