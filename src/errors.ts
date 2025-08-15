export class TransmissionError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
    public readonly responseBody?: string,
    public readonly responseHeaders?: Record<string, string>,
  ) {
    super(message);
    this.name = 'TransmissionError';
    Object.setPrototypeOf(this, TransmissionError.prototype);
  }
}

export class TimeoutError extends TransmissionError {
  constructor(message: string, timeout: number) {
    super(`${message} (timeout: ${timeout}ms)`, undefined, true);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

export class NetworkError extends TransmissionError {
  public cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message, undefined, true);
    this.name = 'NetworkError';
    if (cause) {
      this.cause = cause;
    }
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
