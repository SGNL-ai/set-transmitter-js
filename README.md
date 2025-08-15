# @sgnl-ai/set-transmitter

HTTP transmission library for Security Event Tokens (SET) with CAEP/SSF support. Zero runtime dependencies, built on native fetch API.

## Features

- 🚀 **Zero runtime dependencies** - Uses native fetch API
- 🔄 **Smart retry logic** - Exponential backoff with jitter
- 🎯 **Full TypeScript support** - Written in TypeScript with complete type definitions
- ⚡ **Lightweight** - Minimal bundle size
- 🛡️ **Comprehensive error handling** - Detailed error types and messages
- 📦 **ESM and CommonJS** - Dual module support
- 🔐 **CAEP/SSF compliant** - Follows RFC 8417 standards

## Installation

```bash
npm install @sgnl-ai/set-transmitter
```

## Basic Usage

```typescript
import { transmitSET } from '@sgnl-ai/set-transmitter';

// Transmit a Security Event Token
const result = await transmitSET(
  'eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJodHRwczovL2V4YW1wbGUuY29tIn0.signature',
  'https://receiver.example.com/events',
  {
    authToken: 'Bearer xyz123',
  }
);

if (result.status === 'success') {
  console.log('Event transmitted successfully:', result.body);
} else {
  console.error('Transmission failed:', result.error);
}
```

## Advanced Usage

### With All Options

```typescript
import { transmitSET } from '@sgnl-ai/set-transmitter';

const result = await transmitSET(jwt, url, {
  // Authentication
  authToken: 'Bearer token', // or just 'token' - Bearer prefix will be added

  // Custom headers
  headers: {
    'User-Agent': 'MyApp/2.0',
    'X-Request-ID': 'req-123',
  },

  // Timeout in milliseconds (default: 30000)
  timeout: 10000,

  // Retry configuration
  retry: {
    maxAttempts: 5,                              // Maximum retry attempts
    retryableStatuses: [429, 502, 503, 504],    // Which HTTP codes to retry
    backoffMs: 2000,                            // Initial backoff in milliseconds
    maxBackoffMs: 30000,                        // Maximum backoff
    backoffMultiplier: 2,                       // Exponential backoff multiplier
  },

  // Response handling
  parseResponse: true,                          // Auto-parse JSON responses
  validateStatus: (status) => status < 400,     // Custom success validation
});
```

### Creating a Reusable Transmitter

```typescript
import { createTransmitter } from '@sgnl-ai/set-transmitter';

// Create a transmitter with default options
const transmitter = createTransmitter({
  authToken: 'Bearer default-token',
  headers: {
    'User-Agent': 'MyApp/2.0',
  },
  retry: {
    maxAttempts: 5,
    backoffMs: 2000,
  },
});

// Use the transmitter (options can be overridden per call)
const result = await transmitter(jwt, url, {
  headers: {
    'X-Request-ID': 'specific-request-id',
  },
});
```

### Error Handling

```typescript
import { transmitSET, ValidationError, TimeoutError, NetworkError } from '@sgnl-ai/set-transmitter';

try {
  const result = await transmitSET(jwt, url, options);
  
  if (result.status === 'failed') {
    if (result.retryable) {
      console.log('Request failed but is retryable:', result.error);
    } else {
      console.log('Request failed and is not retryable:', result.error);
    }
    
    // Handle specific status codes
    switch (result.statusCode) {
      case 400:
        console.error('Bad request:', result.body);
        break;
      case 401:
        console.error('Unauthorized - check auth token');
        break;
      case 429:
        console.error('Rate limited:', result.headers['retry-after']);
        break;
    }
  }
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid input:', error.message);
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out:', error.message);
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
  }
}
```

### Integration with @sgnl-ai/secevent

```typescript
import { createBuilder } from '@sgnl-ai/secevent';
import { transmitSET, EventTypes } from '@sgnl-ai/set-transmitter';
import { createPrivateKey } from 'crypto';

// Build the SET
const builder = createBuilder()
  .withIssuer('https://issuer.example.com')
  .withAudience('https://receiver.example.com')
  .withEvent(EventTypes.SESSION_REVOKED, {
    subject: {
      format: 'email',
      email: 'user@example.com',
    },
    initiating_entity: 'admin',
    reason_admin: 'Security policy violation',
    event_timestamp: Math.floor(Date.now() / 1000),
  });

// Sign it
const privateKey = createPrivateKey(privateKeyPem);
const { jwt } = await builder.sign({
  key: privateKey,
  kid: 'key-id',
  alg: 'RS256',
});

// Transmit it
const result = await transmitSET(jwt, 'https://receiver.example.com/events', {
  authToken: process.env.AUTH_TOKEN,
});
```

## API Reference

### transmitSET(jwt, url, options?)

Main function to transmit a Security Event Token.

**Parameters:**
- `jwt` (string): The signed JWT string
- `url` (string): The destination endpoint URL
- `options` (TransmitOptions): Optional configuration object

**Returns:** `Promise<TransmitResult>`

### createTransmitter(defaultOptions?)

Creates a reusable transmitter function with default options.

**Parameters:**
- `defaultOptions` (TransmitOptions): Default options for all transmissions

**Returns:** Function with signature `(jwt, url, options?) => Promise<TransmitResult>`

### isValidSET(jwt)

Helper function to validate JWT format (basic check).

**Parameters:**
- `jwt` (string): The JWT string to validate

**Returns:** `boolean`

### EventTypes

Constants for standard CAEP event types:
- `SESSION_REVOKED`
- `TOKEN_CLAIMS_CHANGE`
- `CREDENTIAL_CHANGE`
- `ASSURANCE_LEVEL_CHANGE`
- `DEVICE_COMPLIANCE_CHANGE`

## Types

### TransmitOptions

```typescript
interface TransmitOptions {
  authToken?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retry?: RetryConfig;
  parseResponse?: boolean;
  validateStatus?: (status: number) => boolean;
}
```

### TransmitResult

```typescript
interface TransmitResult {
  status: 'success' | 'failed';
  statusCode: number;
  body: string | Record<string, unknown>;
  headers: Record<string, string>;
  error?: string;
  retryable?: boolean;
}
```

### RetryConfig

```typescript
interface RetryConfig {
  maxAttempts?: number;
  retryableStatuses?: number[];
  backoffMs?: number;
  maxBackoffMs?: number;
  backoffMultiplier?: number;
}
```

## Retry Logic

The library implements intelligent retry logic with:

- **Exponential backoff with jitter** - Prevents thundering herd problem
- **Retry-After header support** - Respects server-specified retry delays
- **Configurable retry conditions** - Customize which status codes trigger retries
- **Network error handling** - Automatically retries on network failures

Default retryable status codes: 429, 502, 503, 504

## Requirements

- Node.js >= 18.0.0 (for native fetch support)
- TypeScript >= 5.0 (for TypeScript projects)

## Migration from Inline Transmission

If you're currently using inline transmission code in your CAEP actions:

**Before:**
```javascript
// Manual transmission with fetch
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/secevent+jwt',
    'Authorization': `Bearer ${token}`,
  },
  body: jwt,
});

if (!response.ok) {
  // Manual error handling
}
```

**After:**
```javascript
import { transmitSET } from '@sgnl-ai/set-transmitter';

const result = await transmitSET(jwt, url, {
  authToken: token,
});

if (result.status === 'failed') {
  // Automatic retry logic and error handling included
}
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please use the [GitHub issues page](https://github.com/sgnl-ai/set-transmitter-js/issues).