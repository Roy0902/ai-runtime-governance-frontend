export type ProviderKind = 'LANGSMITH' | 'LANGFUSE';

export interface ProviderCredentialSummary {
  provider: ProviderKind;
  name: string;
  accessKey: string | null;
  secretHint: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderCredentialInput {
  accessKey?: string | null;
  secretKey: string;
  name?: string | null;
}

export const PROVIDERS: ProviderKind[] = ['LANGSMITH', 'LANGFUSE'];
