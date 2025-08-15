export interface TransmitOptions {
  authToken?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retry?: RetryConfig;
  parseResponse?: boolean;
  validateStatus?: (status: number) => boolean;
}

export interface RetryConfig {
  maxAttempts?: number;
  retryableStatuses?: number[];
  backoffMs?: number;
  maxBackoffMs?: number;
  backoffMultiplier?: number;
}

export interface TransmitResult {
  status: 'success' | 'failed';
  statusCode: number;
  body: string | Record<string, unknown>;
  headers: Record<string, string>;
  error?: string;
  retryable?: boolean;
}

export interface TransmitterConfig {
  defaultOptions?: TransmitOptions;
}

export const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  retryableStatuses: [429, 502, 503, 504],
  backoffMs: 1000,
  maxBackoffMs: 10000,
  backoffMultiplier: 2,
};

export const DEFAULT_OPTIONS: TransmitOptions = {
  timeout: 30000,
  parseResponse: true,
  validateStatus: (status) => status < 400,
  retry: DEFAULT_RETRY_CONFIG,
};
