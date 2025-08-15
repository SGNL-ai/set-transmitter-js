import { RetryConfig } from './types';

export function calculateBackoff(
  attempt: number,
  config: Required<RetryConfig>,
  retryAfterMs?: number,
): number {
  // If Retry-After header is present, use it
  if (retryAfterMs !== undefined && retryAfterMs > 0) {
    return Math.min(retryAfterMs, config.maxBackoffMs);
  }

  // Calculate exponential backoff with jitter
  const exponentialDelay = config.backoffMs * Math.pow(config.backoffMultiplier, attempt - 1);
  const clampedDelay = Math.min(exponentialDelay, config.maxBackoffMs);

  // Add jitter (±25% randomization)
  const jitter = clampedDelay * 0.25;
  const minDelay = clampedDelay - jitter;
  const maxDelay = clampedDelay + jitter;

  return Math.floor(Math.random() * (maxDelay - minDelay) + minDelay);
}

export function parseRetryAfter(retryAfterHeader: string | undefined): number | undefined {
  if (!retryAfterHeader) {
    return undefined;
  }

  // If it's a number, assume it's delay in seconds
  const delaySeconds = parseInt(retryAfterHeader, 10);
  if (!isNaN(delaySeconds)) {
    return delaySeconds * 1000;
  }

  // If it's a date, calculate the delay
  const retryDate = new Date(retryAfterHeader);
  if (!isNaN(retryDate.getTime())) {
    const delayMs = retryDate.getTime() - Date.now();
    return delayMs > 0 ? delayMs : undefined;
  }

  return undefined;
}

export function isRetryableStatus(statusCode: number, retryableStatuses: number[]): boolean {
  return retryableStatuses.includes(statusCode);
}

export function shouldRetry(
  statusCode: number | undefined,
  attempt: number,
  config: Required<RetryConfig>,
): boolean {
  if (attempt >= config.maxAttempts) {
    return false;
  }

  if (statusCode === undefined) {
    // Network errors are retryable
    return true;
  }

  return isRetryableStatus(statusCode, config.retryableStatuses);
}

export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
