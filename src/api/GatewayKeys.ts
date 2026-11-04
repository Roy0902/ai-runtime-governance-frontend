export interface GatewayKeySummary {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface GatewaySetup {
  id: string;
  name: string;
  token: string;
  createdAt: string;
  baseUrl: string;
  chatCompletionsPath: string;
  models: string[];
  openCodeConfig: string;
  vsCodeConfig: string;
}
