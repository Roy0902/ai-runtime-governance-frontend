export interface ModelUsage {
  id: string;
  traceId: string;
  eventId: string | null;
  credentialId: string | null;
  clientConversationId: string | null;
  clientUserAgent: string | null;
  provider: string | null;
  requestedModel: string;
  responseModel: string | null;
  responseId: string | null;
  systemFingerprint: string | null;
  serviceTier: string | null;
  stream: boolean;
  statusCode: number | null;
  outcome: 'completed' | 'failed' | 'canceled';
  finishReasons: string[];
  toolCallNames: string[];
  inputTokens: number | null;
  outputTokens: number | null;
  cachedInputTokens: number | null;
  reasoningOutputTokens: number | null;
  totalTokens: number | null;
  providerReportedCostUsd: number | null;
  inputCostUsd: number | null;
  outputCostUsd: number | null;
  cachedInputCostUsd: number | null;
  totalCostUsd: number | null;
  currency: string;
  requestBytes: number | null;
  responseBytes: number | null;
  captureTruncated: boolean;
  durationMs: number | null;
  timeToFirstByteMs: number | null;
  errorType: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  providerUsage: Record<string, unknown>;
  responseHeaders: Record<string, string>;
  langfuseObservationId: string | null;
  receivedAt: string;
}

export interface ObservationContent {
  observationId: string;
  traceId: string;
  name: string | null;
  type: string | null;
  model: string | null;
  input: string | null;
  output: string | null;
  usage: Record<string, unknown>;
  cost: Record<string, unknown>;
  startTime: string | null;
  endTime: string | null;
}

export interface UsageGroup {
  key: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  totalCostUsd: number | null;
}

export interface UsageSummary {
  from: string;
  to: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  totalCostUsd: number | null;
  currency: string;
  byModel: UsageGroup[];
  byDay: UsageGroup[];
}
