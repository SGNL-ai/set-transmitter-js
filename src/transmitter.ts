import {
  TransmitOptions,
  TransmitResult,
  DEFAULT_OPTIONS,
  DEFAULT_RETRY_CONFIG,
  RetryConfig,
} from './types';
import { CONTENT_TYPE_SET, CONTENT_TYPE_JSON, DEFAULT_USER_AGENT } from './constants';
import { TransmissionError, TimeoutError, NetworkError, ValidationError } from './errors';
import { calculateBackoff, parseRetryAfter, shouldRetry, delay } from './retry';
import {
  isValidSET,
  normalizeAuthToken,
  mergeHeaders,
  parseResponseHeaders,
  parseResponseBody,
} from './utils';

export async function transmitSET(
  jwt: string,
  url: string,
  options: TransmitOptions = {},
): Promise<TransmitResult> {
  // Validate JWT format
  if (!isValidSET(jwt)) {
    throw new ValidationError('Invalid SET format: JWT must be in format header.payload.signature');
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new ValidationError(`Invalid URL: ${url}`);
  }

  // Merge options with defaults
  const mergedOptions = {
    authToken: options.authToken,
    headers: options.headers || {},
    timeout: options.timeout ?? DEFAULT_OPTIONS.timeout!,
    parseResponse: options.parseResponse ?? DEFAULT_OPTIONS.parseResponse!,
    validateStatus: options.validateStatus ?? DEFAULT_OPTIONS.validateStatus!,
    retry: {
      ...DEFAULT_RETRY_CONFIG,
      ...(options.retry || {}),
    } as Required<RetryConfig>,
  };

  // Prepare headers
  const baseHeaders: Record<string, string> = {
    'Content-Type': CONTENT_TYPE_SET,
    Accept: CONTENT_TYPE_JSON,
    'User-Agent': DEFAULT_USER_AGENT,
  };

  // Add authorization header if provided
  const authToken = normalizeAuthToken(mergedOptions.authToken);
  if (authToken) {
    baseHeaders['Authorization'] = authToken;
  }

  // Merge custom headers
  const headers = mergeHeaders(baseHeaders, mergedOptions.headers);

  // Attempt transmission with retry logic
  let lastError: Error | undefined;
  let lastResponse: Response | undefined;

  for (let attempt = 1; attempt <= mergedOptions.retry.maxAttempts; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), mergedOptions.timeout);

      try {
        // Make the request
        const response = await fetch(parsedUrl.toString(), {
          method: 'POST',
          headers,
          body: jwt,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        lastResponse = response;

        // Parse response
        const responseHeaders = parseResponseHeaders(response.headers);
        const responseBody = await parseResponseBody(response, mergedOptions.parseResponse);

        // Check if status is successful
        const isSuccess = mergedOptions.validateStatus(response.status);

        if (isSuccess) {
          return {
            status: 'success',
            statusCode: response.status,
            body: responseBody,
            headers: responseHeaders,
          };
        }

        // Check if we should retry
        const canRetry = shouldRetry(response.status, attempt, mergedOptions.retry);
        if (!canRetry) {
          return {
            status: 'failed',
            statusCode: response.status,
            body: responseBody,
            headers: responseHeaders,
            error: `HTTP ${response.status}: ${response.statusText}`,
            retryable: mergedOptions.retry.retryableStatuses.includes(response.status),
          };
        }

        // Calculate backoff delay
        const retryAfterMs = parseRetryAfter(responseHeaders['retry-after']);
        const backoffMs = calculateBackoff(attempt, mergedOptions.retry, retryAfterMs);

        // Wait before retrying
        await delay(backoffMs);
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            lastError = new TimeoutError('Request timed out', mergedOptions.timeout);
          } else {
            lastError = new NetworkError(`Network error: ${error.message}`, error);
          }
        } else {
          lastError = new NetworkError('Unknown network error');
        }

        // Check if we should retry network errors
        if (!shouldRetry(undefined, attempt, mergedOptions.retry)) {
          throw lastError;
        }

        // Calculate backoff delay
        const backoffMs = calculateBackoff(attempt, mergedOptions.retry);
        await delay(backoffMs);
      }
    } catch (error) {
      // Re-throw if it's not a retryable error
      if (error instanceof ValidationError) {
        throw error;
      }
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  // If we've exhausted all retries
  if (lastResponse) {
    const responseHeaders = parseResponseHeaders(lastResponse.headers);
    // Body may have already been consumed, so handle the error
    let responseBody: string | Record<string, unknown> = '';
    try {
      responseBody = await parseResponseBody(lastResponse, mergedOptions.parseResponse);
    } catch {
      // Body already consumed, use empty string
      responseBody = '';
    }

    return {
      status: 'failed',
      statusCode: lastResponse.status,
      body: responseBody,
      headers: responseHeaders,
      error: lastError?.message || `HTTP ${lastResponse.status}: ${lastResponse.statusText}`,
      retryable: true,
    };
  }

  // Network error after all retries
  throw (
    lastError ||
    new TransmissionError('Failed to transmit SET after all retry attempts', undefined, true)
  );
}

export function createTransmitter(
  defaultOptions?: TransmitOptions,
): (jwt: string, url: string, options?: TransmitOptions) => Promise<TransmitResult> {
  return (jwt: string, url: string, options?: TransmitOptions) => {
    const mergedOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...(defaultOptions?.headers || {}),
        ...(options?.headers || {}),
      },
      retry: {
        ...(defaultOptions?.retry || {}),
        ...(options?.retry || {}),
      },
    };
    return transmitSET(jwt, url, mergedOptions);
  };
}
