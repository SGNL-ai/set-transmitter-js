import {
  isValidSET,
  normalizeAuthToken,
  mergeHeaders,
  parseResponseHeaders,
  parseResponseBody,
} from '../src/utils';

describe('isValidSET', () => {
  it('should validate correct JWT format', () => {
    expect(
      isValidSET('eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJodHRwczovL2V4YW1wbGUuY29tIn0.signature'),
    ).toBe(true);
    expect(isValidSET('header.payload.signature')).toBe(true);
    expect(isValidSET('a.b.c')).toBe(true);
    expect(isValidSET('A-Za-z0-9_-.A-Za-z0-9_-.A-Za-z0-9_-')).toBe(true);
  });

  it('should reject invalid JWT format', () => {
    expect(isValidSET('')).toBe(false);
    expect(isValidSET('not.a.jwt')).toBe(true); // This is actually valid base64url
    expect(isValidSET('part1.part2')).toBe(false); // Only 2 parts
    expect(isValidSET('part1.part2.part3.part4')).toBe(false); // Too many parts
    expect(isValidSET('part1..part3')).toBe(false); // Empty part
    expect(isValidSET('.part2.part3')).toBe(false); // Empty first part
    expect(isValidSET('part1.part2.')).toBe(false); // Empty last part
  });

  it('should reject non-string input', () => {
    expect(isValidSET(null as any)).toBe(false);
    expect(isValidSET(undefined as any)).toBe(false);
    expect(isValidSET(123 as any)).toBe(false);
    expect(isValidSET({} as any)).toBe(false);
    expect(isValidSET([] as any)).toBe(false);
  });

  it('should reject JWTs with invalid characters', () => {
    expect(isValidSET('part1!.part2.part3')).toBe(false);
    expect(isValidSET('part1.part@2.part3')).toBe(false);
    expect(isValidSET('part1.part2.part#3')).toBe(false);
    expect(isValidSET('part=1.part2.part3')).toBe(false);
  });
});

describe('normalizeAuthToken', () => {
  it('should add Bearer prefix if missing', () => {
    expect(normalizeAuthToken('token123')).toBe('Bearer token123');
    expect(normalizeAuthToken('abc-xyz-123')).toBe('Bearer abc-xyz-123');
  });

  it('should not add Bearer prefix if already present', () => {
    expect(normalizeAuthToken('Bearer token123')).toBe('Bearer token123');
    expect(normalizeAuthToken('Bearer abc-xyz-123')).toBe('Bearer abc-xyz-123');
  });

  it('should handle undefined and empty tokens', () => {
    expect(normalizeAuthToken(undefined)).toBeUndefined();
    expect(normalizeAuthToken('')).toBeUndefined();
  });

  it('should handle tokens with spaces', () => {
    expect(normalizeAuthToken('token with spaces')).toBe('Bearer token with spaces');
    expect(normalizeAuthToken('Bearer token with spaces')).toBe('Bearer token with spaces');
  });

  it('should be case-sensitive for Bearer prefix', () => {
    expect(normalizeAuthToken('bearer token123')).toBe('Bearer bearer token123');
    expect(normalizeAuthToken('BEARER token123')).toBe('Bearer BEARER token123');
  });
});

describe('mergeHeaders', () => {
  it('should merge headers with custom taking precedence', () => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'DefaultAgent/1.0',
      'X-Default': 'default-value',
    };

    const customHeaders = {
      'User-Agent': 'CustomAgent/2.0',
      'X-Custom': 'custom-value',
    };

    const merged = mergeHeaders(defaultHeaders, customHeaders);

    expect(merged).toEqual({
      'Content-Type': 'application/json',
      'User-Agent': 'CustomAgent/2.0',
      'X-Default': 'default-value',
      'X-Custom': 'custom-value',
    });
  });

  it('should handle undefined custom headers', () => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'DefaultAgent/1.0',
    };

    const merged = mergeHeaders(defaultHeaders, undefined);

    expect(merged).toEqual(defaultHeaders);
  });

  it('should handle empty objects', () => {
    expect(mergeHeaders({}, {})).toEqual({});
    expect(mergeHeaders({ 'X-Test': 'value' }, {})).toEqual({ 'X-Test': 'value' });
    expect(mergeHeaders({}, { 'X-Test': 'value' })).toEqual({ 'X-Test': 'value' });
  });

  it('should handle case-sensitive header names', () => {
    const defaultHeaders = { 'content-type': 'text/plain' };
    const customHeaders = { 'Content-Type': 'application/json' };

    const merged = mergeHeaders(defaultHeaders, customHeaders);

    expect(merged).toEqual({
      'content-type': 'text/plain',
      'Content-Type': 'application/json',
    });
  });
});

describe('parseResponseHeaders', () => {
  it('should convert Headers object to plain object', () => {
    const headers = new Headers({
      'content-type': 'application/json',
      'x-transaction-id': 'txn123',
      'retry-after': '60',
    });

    const parsed = parseResponseHeaders(headers);

    expect(parsed).toEqual({
      'content-type': 'application/json',
      'x-transaction-id': 'txn123',
      'retry-after': '60',
    });
  });

  it('should handle empty headers', () => {
    const headers = new Headers();
    const parsed = parseResponseHeaders(headers);
    expect(parsed).toEqual({});
  });

  it('should handle headers with multiple values', () => {
    const headers = new Headers();
    headers.append('set-cookie', 'session=abc123');
    headers.append('set-cookie', 'token=xyz789');

    const parsed = parseResponseHeaders(headers);

    // Note: The actual behavior depends on the Headers implementation
    // Modern browsers only keep the last value for set-cookie
    expect(parsed['set-cookie']).toBeDefined();
  });

  it('should lowercase header names', () => {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-Custom-Header': 'value',
    });

    const parsed = parseResponseHeaders(headers);

    // Headers API automatically lowercases header names
    expect(parsed).toEqual({
      'content-type': 'application/json',
      'x-custom-header': 'value',
    });
  });
});

describe('parseResponseBody', () => {
  it('should parse JSON when content-type is application/json', async () => {
    const response = new Response('{"key": "value", "number": 42}', {
      headers: { 'content-type': 'application/json' },
    });

    const body = await parseResponseBody(response, true);

    expect(body).toEqual({ key: 'value', number: 42 });
  });

  it('should parse JSON with charset in content-type', async () => {
    const response = new Response('{"key": "value"}', {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });

    const body = await parseResponseBody(response, true);

    expect(body).toEqual({ key: 'value' });
  });

  it('should return text when parseJson is false', async () => {
    const response = new Response('{"key": "value"}', {
      headers: { 'content-type': 'application/json' },
    });

    const body = await parseResponseBody(response, false);

    expect(body).toBe('{"key": "value"}');
  });

  it('should return text for non-JSON content-type', async () => {
    const response = new Response('<html>Hello</html>', {
      headers: { 'content-type': 'text/html' },
    });

    const body = await parseResponseBody(response, true);

    expect(body).toBe('<html>Hello</html>');
  });

  it('should return text if JSON parsing fails', async () => {
    const response = new Response('not-json', {
      headers: { 'content-type': 'application/json' },
    });

    const body = await parseResponseBody(response, true);

    expect(body).toBe('not-json');
  });

  it('should handle empty response body', async () => {
    const response = new Response('', {
      headers: { 'content-type': 'application/json' },
    });

    const body = await parseResponseBody(response, true);

    expect(body).toBe('');
  });

  it('should handle response without content-type header', async () => {
    const response = new Response('{"key": "value"}');

    const body = await parseResponseBody(response, true);

    expect(body).toBe('{"key": "value"}');
  });

  it('should handle complex JSON structures', async () => {
    const complexJson = {
      array: [1, 2, 3],
      nested: { a: 1, b: { c: 2 } },
      null: null,
      boolean: true,
      string: 'test',
    };

    const response = new Response(JSON.stringify(complexJson), {
      headers: { 'content-type': 'application/json' },
    });

    const body = await parseResponseBody(response, true);

    expect(body).toEqual(complexJson);
  });
});
