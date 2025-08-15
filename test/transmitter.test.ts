import { transmitSET, createTransmitter } from '../src/transmitter';
import { ValidationError, TimeoutError, NetworkError } from '../src/errors';

// Mock fetch globally
const originalFetch = global.fetch;
let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = jest.fn();
  global.fetch = mockFetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

describe('transmitSET', () => {
  const validJWT = 'eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJodHRwczovL2V4YW1wbGUuY29tIn0.signature';
  const validURL = 'https://example.com/events';

  describe('validation', () => {
    it('should reject invalid JWT format', async () => {
      await expect(transmitSET('invalid-jwt', validURL)).rejects.toThrow(ValidationError);
      await expect(transmitSET('', validURL)).rejects.toThrow(ValidationError);
      await expect(transmitSET('part1.part2', validURL)).rejects.toThrow(ValidationError);
    });

    it('should reject invalid URL', async () => {
      await expect(transmitSET(validJWT, 'not-a-url')).rejects.toThrow(ValidationError);
      await expect(transmitSET(validJWT, '')).rejects.toThrow(ValidationError);
    });

    it('should accept valid JWT and URL', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('{"accepted": true}', {
          status: 202,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const result = await transmitSET(validJWT, validURL);
      expect(result.status).toBe('success');
      expect(result.statusCode).toBe(202);
    });
  });

  describe('headers', () => {
    it('should set required headers', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('{"accepted": true}', {
          status: 202,
          headers: { 'content-type': 'application/json' },
        }),
      );

      await transmitSET(validJWT, validURL);

      expect(mockFetch).toHaveBeenCalledWith(
        validURL,
        expect.objectContaining({
          method: 'POST',
          body: validJWT,
          headers: expect.objectContaining({
            'Content-Type': 'application/secevent+jwt',
            Accept: 'application/json',
            'User-Agent': 'SGNL-Action-Framework/1.0',
          }),
        }),
      );
    });

    it('should add Bearer prefix to auth token if missing', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('{"accepted": true}', {
          status: 202,
          headers: { 'content-type': 'application/json' },
        }),
      );

      await transmitSET(validJWT, validURL, { authToken: 'token123' });

      expect(mockFetch).toHaveBeenCalledWith(
        validURL,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token123',
          }),
        }),
      );
    });

    it('should not add Bearer prefix if already present', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('{"accepted": true}', {
          status: 202,
          headers: { 'content-type': 'application/json' },
        }),
      );

      await transmitSET(validJWT, validURL, { authToken: 'Bearer xyz789' });

      expect(mockFetch).toHaveBeenCalledWith(
        validURL,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer xyz789',
          }),
        }),
      );
    });

    it('should merge custom headers', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('{"accepted": true}', {
          status: 202,
          headers: { 'content-type': 'application/json' },
        }),
      );

      await transmitSET(validJWT, validURL, {
        headers: {
          'X-Request-ID': 'abc123',
          'User-Agent': 'CustomAgent/2.0',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        validURL,
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Request-ID': 'abc123',
            'User-Agent': 'CustomAgent/2.0',
            'Content-Type': 'application/secevent+jwt',
          }),
        }),
      );
    });
  });

  describe('response handling', () => {
    it('should parse JSON response when parseResponse is true', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('{"accepted": true, "id": "evt123"}', {
          status: 202,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const result = await transmitSET(validJWT, validURL);
      expect(result.body).toEqual({ accepted: true, id: 'evt123' });
    });

    it('should return text response when parseResponse is false', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('{"accepted": true}', {
          status: 202,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const result = await transmitSET(validJWT, validURL, { parseResponse: false });
      expect(result.body).toBe('{"accepted": true}');
    });

    it('should return text if JSON parsing fails', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('not-json', {
          status: 202,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const result = await transmitSET(validJWT, validURL);
      expect(result.body).toBe('not-json');
    });

    it('should include response headers', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('{"accepted": true}', {
          status: 202,
          headers: {
            'content-type': 'application/json',
            'x-transaction-id': 'txn123',
          },
        }),
      );

      const result = await transmitSET(validJWT, validURL);
      expect(result.headers).toMatchObject({
        'content-type': 'application/json',
        'x-transaction-id': 'txn123',
      });
    });
  });

  describe('status validation', () => {
    it('should use default validateStatus (< 400)', async () => {
      mockFetch.mockResolvedValueOnce(new Response('', { status: 399 }));

      const result = await transmitSET(validJWT, validURL);
      expect(result.status).toBe('success');
    });

    it('should fail for status >= 400 by default', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('{"error": "Bad Request"}', {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const result = await transmitSET(validJWT, validURL);
      expect(result.status).toBe('failed');
      expect(result.statusCode).toBe(400);
    });

    it('should use custom validateStatus', async () => {
      mockFetch.mockResolvedValueOnce(new Response('', { status: 404 }));

      const result = await transmitSET(validJWT, validURL, {
        validateStatus: (status) => status === 404,
      });
      expect(result.status).toBe('success');
    });
  });

  describe('timeout handling', () => {
    it('should timeout after specified duration', async () => {
      mockFetch.mockImplementationOnce((url, options) => {
        return new Promise((resolve, reject) => {
          // Listen for abort signal
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              const error = new Error('The operation was aborted');
              error.name = 'AbortError';
              reject(error);
            });
          }
          // Never resolve
        });
      });

      // This should timeout
      await expect(
        transmitSET(validJWT, validURL, {
          timeout: 100,
          retry: { maxAttempts: 1 },
        }),
      ).rejects.toThrow(TimeoutError);
    });

    it('should use default timeout of 30 seconds', async () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      mockFetch.mockResolvedValueOnce(new Response('', { status: 200 }));

      await transmitSET(validJWT, validURL);

      // Verify timeout was set (default 30000ms)
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
      setTimeoutSpy.mockRestore();
    });
  });

  describe('retry logic', () => {
    it('should retry on retryable status codes', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('', { status: 503 }))
        .mockResolvedValueOnce(new Response('', { status: 502 }))
        .mockResolvedValueOnce(new Response('{"accepted": true}', { status: 200 }));

      const result = await transmitSET(validJWT, validURL, {
        retry: { maxAttempts: 3, backoffMs: 10 },
      });

      expect(result.status).toBe('success');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable status codes', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('{"error": "Unauthorized"}', {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const result = await transmitSET(validJWT, validURL);
      expect(result.status).toBe('failed');
      expect(result.retryable).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on network errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(new Response('{"accepted": true}', { status: 200 }));

      const result = await transmitSET(validJWT, validURL, {
        retry: { maxAttempts: 2, backoffMs: 10 },
      });

      expect(result.status).toBe('success');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should respect maxAttempts', async () => {
      mockFetch.mockResolvedValue(new Response('', { status: 503 }));

      const result = await transmitSET(validJWT, validURL, {
        retry: { maxAttempts: 2, backoffMs: 10 },
      });

      expect(result.status).toBe('failed');
      expect(result.retryable).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should respect Retry-After header', async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response('', {
            status: 429,
            headers: { 'retry-after': '2' },
          }),
        )
        .mockResolvedValueOnce(new Response('{"accepted": true}', { status: 200 }));

      const result = await transmitSET(validJWT, validURL, {
        retry: { maxAttempts: 2 },
      });

      // Should have succeeded after retry
      expect(result.status).toBe('success');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should apply exponential backoff', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('', { status: 503 }))
        .mockResolvedValueOnce(new Response('', { status: 503 }))
        .mockResolvedValueOnce(new Response('{"accepted": true}', { status: 200 }));

      const result = await transmitSET(validJWT, validURL, {
        retry: {
          maxAttempts: 3,
          backoffMs: 10,
          backoffMultiplier: 2,
        },
      });

      // Should have succeeded after retries
      expect(result.status).toBe('success');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should respect maxBackoffMs', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('', { status: 503 }))
        .mockResolvedValueOnce(new Response('{"accepted": true}', { status: 200 }));

      const result = await transmitSET(validJWT, validURL, {
        retry: {
          maxAttempts: 2,
          backoffMs: 10,
          maxBackoffMs: 100,
        },
      });

      // Should succeed after retry
      expect(result.status).toBe('success');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should allow custom retryableStatuses', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('', { status: 418 })) // I'm a teapot
        .mockResolvedValueOnce(new Response('{"accepted": true}', { status: 200 }));

      const result = await transmitSET(validJWT, validURL, {
        retry: {
          maxAttempts: 2,
          retryableStatuses: [418],
          backoffMs: 10,
        },
      });

      expect(result.status).toBe('success');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should handle 400 Bad Request', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('{"error": "Invalid event"}', {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const result = await transmitSET(validJWT, validURL);
      expect(result.status).toBe('failed');
      expect(result.statusCode).toBe(400);
      expect(result.body).toEqual({ error: 'Invalid event' });
      expect(result.retryable).toBe(false);
    });

    it('should handle 401 Unauthorized', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('{"error": "Unauthorized"}', {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const result = await transmitSET(validJWT, validURL);
      expect(result.status).toBe('failed');
      expect(result.statusCode).toBe(401);
      expect(result.retryable).toBe(false);
    });

    it('should handle 403 Forbidden', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('{"error": "Forbidden"}', {
          status: 403,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const result = await transmitSET(validJWT, validURL);
      expect(result.status).toBe('failed');
      expect(result.statusCode).toBe(403);
      expect(result.retryable).toBe(false);
    });

    it('should handle 404 Not Found', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('{"error": "Endpoint not found"}', {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const result = await transmitSET(validJWT, validURL);
      expect(result.status).toBe('failed');
      expect(result.statusCode).toBe(404);
      expect(result.retryable).toBe(false);
    });

    it('should handle 429 Too Many Requests', async () => {
      mockFetch.mockResolvedValue(
        new Response('Rate limit exceeded', {
          status: 429,
          headers: { 'retry-after': '60' },
        }),
      );

      const result = await transmitSET(validJWT, validURL, {
        retry: { maxAttempts: 1 },
      });

      expect(result.status).toBe('failed');
      expect(result.statusCode).toBe(429);
      expect(result.retryable).toBe(true);
    });

    it('should handle 500 Internal Server Error', async () => {
      mockFetch.mockResolvedValue(new Response('Internal Server Error', { status: 500 }));

      const result = await transmitSET(validJWT, validURL, {
        retry: { maxAttempts: 1 },
      });

      expect(result.status).toBe('failed');
      expect(result.statusCode).toBe(500);
    });

    it('should handle 502 Bad Gateway', async () => {
      mockFetch.mockResolvedValue(new Response('Bad Gateway', { status: 502 }));

      const result = await transmitSET(validJWT, validURL, {
        retry: { maxAttempts: 1 },
      });

      expect(result.status).toBe('failed');
      expect(result.statusCode).toBe(502);
      expect(result.retryable).toBe(true);
    });

    it('should handle 503 Service Unavailable', async () => {
      mockFetch.mockResolvedValue(new Response('Service Unavailable', { status: 503 }));

      const result = await transmitSET(validJWT, validURL, {
        retry: { maxAttempts: 1 },
      });

      expect(result.status).toBe('failed');
      expect(result.statusCode).toBe(503);
      expect(result.retryable).toBe(true);
    });

    it('should handle 504 Gateway Timeout', async () => {
      mockFetch.mockResolvedValue(new Response('Gateway Timeout', { status: 504 }));

      const result = await transmitSET(validJWT, validURL, {
        retry: { maxAttempts: 1 },
      });

      expect(result.status).toBe('failed');
      expect(result.statusCode).toBe(504);
      expect(result.retryable).toBe(true);
    });

    it('should throw NetworkError after all retries fail', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      await expect(
        transmitSET(validJWT, validURL, {
          retry: { maxAttempts: 2, backoffMs: 10 },
        }),
      ).rejects.toThrow(NetworkError);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});

describe('createTransmitter', () => {
  const validJWT = 'eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJodHRwczovL2V4YW1wbGUuY29tIn0.signature';
  const validURL = 'https://example.com/events';

  it('should create a transmitter with default options', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('{"accepted": true}', {
        status: 202,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const transmitter = createTransmitter({
      authToken: 'default-token',
      headers: { 'X-Default': 'value' },
    });

    await transmitter(validJWT, validURL);

    expect(mockFetch).toHaveBeenCalledWith(
      validURL,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer default-token',
          'X-Default': 'value',
        }),
      }),
    );
  });

  it('should allow overriding default options', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('{"accepted": true}', {
        status: 202,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const transmitter = createTransmitter({
      authToken: 'default-token',
      headers: { 'X-Default': 'value' },
    });

    await transmitter(validJWT, validURL, {
      authToken: 'override-token',
      headers: { 'X-Override': 'new-value' },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      validURL,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer override-token',
          'X-Default': 'value',
          'X-Override': 'new-value',
        }),
      }),
    );
  });

  it('should merge retry configurations', async () => {
    mockFetch.mockResolvedValue(new Response('', { status: 503 }));

    const transmitter = createTransmitter({
      retry: { maxAttempts: 5, backoffMs: 100 },
    });

    await transmitter(validJWT, validURL, {
      retry: { backoffMs: 50 },
    });

    // Should use maxAttempts: 5 from default, backoffMs: 50 from override
    expect(mockFetch).toHaveBeenCalledTimes(5);
  });
});
