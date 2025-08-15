export function isValidSET(jwt: string): boolean {
  if (typeof jwt !== 'string') {
    return false;
  }

  // Basic JWT format validation: header.payload.signature
  const parts = jwt.split('.');
  if (parts.length !== 3) {
    return false;
  }

  // Check that each part is base64url encoded
  const base64urlRegex = /^[A-Za-z0-9_-]+$/;
  return parts.every((part) => base64urlRegex.test(part));
}

export function normalizeAuthToken(token?: string): string | undefined {
  if (!token) {
    return undefined;
  }

  // If token already starts with "Bearer ", return as is
  if (token.startsWith('Bearer ')) {
    return token;
  }

  // Otherwise, add "Bearer " prefix
  return `Bearer ${token}`;
}

export function mergeHeaders(
  defaultHeaders: Record<string, string>,
  customHeaders?: Record<string, string>,
): Record<string, string> {
  return {
    ...defaultHeaders,
    ...customHeaders,
  };
}

export function parseResponseHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export async function parseResponseBody(
  response: Response,
  parseJson: boolean,
): Promise<string | Record<string, unknown>> {
  const text = await response.text();

  if (!parseJson || !text) {
    return text;
  }

  // Try to parse as JSON if content-type indicates JSON
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      // If parsing fails, return as text
      return text;
    }
  }

  return text;
}
