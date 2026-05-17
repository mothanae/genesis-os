export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

const RETRYABLE_STATUS_CODES = new Set([408, 429, 502, 503, 504]);

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 16000, onRetry } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const isRetryable =
        (error instanceof Error && error.name === 'ApiClientError') ||
        (typeof error === 'object' &&
          error !== null &&
          'statusCode' in error &&
          typeof (error as { statusCode: number }).statusCode === 'number' &&
          RETRYABLE_STATUS_CODES.has((error as { statusCode: number }).statusCode));

      if (!isRetryable) throw error;

      onRetry?.(attempt + 1, error);

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unreachable');
}
