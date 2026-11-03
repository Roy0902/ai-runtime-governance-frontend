export interface Failure {
  code: string;
  message: string;
  correlationId: string;
  retryAfterSeconds?: number | null;
  fieldErrors?: { field: string; message: string }[] | null;
}
