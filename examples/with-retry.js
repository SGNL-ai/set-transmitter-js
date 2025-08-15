#!/usr/bin/env node

const { transmitSET, createTransmitter } = require('@sgnl-ai/set-transmitter');

// Example JWT (in production, this would be generated and signed)
const jwt = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImtleS0xIn0.eyJpc3MiOiJodHRwczovL2lzc3Vlci5leGFtcGxlLmNvbSIsImF1ZCI6Imh0dHBzOi8vcmVjZWl2ZXIuZXhhbXBsZS5jb20iLCJpYXQiOjE2MDAwMDAwMDAsImp0aSI6ImV2ZW50LTEyMyIsImV2ZW50cyI6eyJodHRwczovL3NjaGVtYXMub3BlbmlkLm5ldC9zZWNldmVudC9jYWVwL2V2ZW50LXR5cGUvc2Vzc2lvbi1yZXZva2VkIjp7InN1YmplY3QiOnsiZm9ybWF0IjoiZW1haWwiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20ifSwiaW5pdGlhdGluZ19lbnRpdHkiOiJhZG1pbiIsInJlYXNvbl9hZG1pbiI6IlNlY3VyaXR5IHBvbGljeSB2aW9sYXRpb24iLCJldmVudF90aW1lc3RhbXAiOjE2MDAwMDAwMDB9fX0.signature';

// Receiver endpoint
const url = 'https://receiver.example.com/events';

async function exampleWithAdvancedRetry() {
  console.log('Example: Advanced Retry Configuration');
  console.log('=====================================\n');

  try {
    const result = await transmitSET(jwt, url, {
      authToken: process.env.AUTH_TOKEN || 'demo-token',
      
      // Advanced retry configuration
      retry: {
        maxAttempts: 5,                            // Try up to 5 times
        retryableStatuses: [429, 500, 502, 503, 504], // Add 500 to retryable codes
        backoffMs: 2000,                           // Start with 2 second delay
        maxBackoffMs: 30000,                       // Max 30 second delay
        backoffMultiplier: 2,                      // Double the delay each time
      },
      
      // Custom timeout
      timeout: 10000, // 10 seconds
      
      // Custom headers
      headers: {
        'User-Agent': 'MyApp/1.0',
        'X-Request-ID': `req-${Date.now()}`,
      },
    });

    if (result.status === 'success') {
      console.log('✅ Event transmitted successfully!');
      console.log('Status Code:', result.statusCode);
    } else {
      console.log('❌ Transmission failed after retries');
      console.log('Status Code:', result.statusCode);
      console.log('Error:', result.error);
      console.log('Retryable:', result.retryable);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function exampleWithReusableTransmitter() {
  console.log('\nExample: Reusable Transmitter');
  console.log('==============================\n');

  // Create a transmitter with default configuration
  const transmitter = createTransmitter({
    authToken: process.env.AUTH_TOKEN || 'demo-token',
    headers: {
      'User-Agent': 'MyApp/1.0',
      'X-Service': 'CAEP-Handler',
    },
    retry: {
      maxAttempts: 3,
      backoffMs: 1000,
    },
    timeout: 15000,
  });

  // Use the transmitter for multiple events
  const events = [
    { jwt, url, id: 'event-1' },
    { jwt, url, id: 'event-2' },
    { jwt, url, id: 'event-3' },
  ];

  for (const event of events) {
    try {
      console.log(`Transmitting ${event.id}...`);
      
      const result = await transmitter(event.jwt, event.url, {
        // Override headers for specific request
        headers: {
          'X-Event-ID': event.id,
        },
      });

      if (result.status === 'success') {
        console.log(`✅ ${event.id} transmitted successfully`);
      } else {
        console.log(`❌ ${event.id} failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ ${event.id} error: ${error.message}`);
    }
  }
}

async function exampleWithRateLimiting() {
  console.log('\nExample: Handling Rate Limiting');
  console.log('================================\n');

  try {
    const result = await transmitSET(jwt, url, {
      authToken: process.env.AUTH_TOKEN || 'demo-token',
      
      // Configure for rate limiting scenarios
      retry: {
        maxAttempts: 10,                          // More attempts for rate limiting
        retryableStatuses: [429],                 // Only retry on rate limit
        backoffMs: 60000,                         // Start with 1 minute
        maxBackoffMs: 300000,                     // Max 5 minutes
        backoffMultiplier: 1,                     // Linear backoff for rate limits
      },
    });

    if (result.status === 'success') {
      console.log('✅ Event transmitted successfully!');
    } else if (result.statusCode === 429) {
      console.log('⚠️ Rate limited even after retries');
      console.log('Retry-After header:', result.headers['retry-after']);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run examples
async function main() {
  await exampleWithAdvancedRetry();
  await exampleWithReusableTransmitter();
  await exampleWithRateLimiting();
}

main().catch(console.error);