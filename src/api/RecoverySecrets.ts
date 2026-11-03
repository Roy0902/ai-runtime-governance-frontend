import type { Operation } from './Operation';

export interface RecoverySecrets {
  operation: Operation;
  recoveryCodes: string[];
}
