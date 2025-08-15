#!/usr/bin/env node

const { transmitSET, EventTypes } = require('@sgnl-ai/set-transmitter');

// Example JWT (in production, this would be generated and signed)
const jwt = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImtleS0xIn0.eyJpc3MiOiJodHRwczovL2lzc3Vlci5leGFtcGxlLmNvbSIsImF1ZCI6Imh0dHBzOi8vcmVjZWl2ZXIuZXhhbXBsZS5jb20iLCJpYXQiOjE2MDAwMDAwMDAsImp0aSI6ImV2ZW50LTEyMyIsImV2ZW50cyI6eyJodHRwczovL3NjaGVtYXMub3BlbmlkLm5ldC9zZWNldmVudC9jYWVwL2V2ZW50LXR5cGUvc2Vzc2lvbi1yZXZva2VkIjp7InN1YmplY3QiOnsiZm9ybWF0IjoiZW1haWwiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20ifSwiaW5pdGlhdGluZ19lbnRpdHkiOiJhZG1pbiIsInJlYXNvbl9hZG1pbiI6IlNlY3VyaXR5IHBvbGljeSB2aW9sYXRpb24iLCJldmVudF90aW1lc3RhbXAiOjE2MDAwMDAwMDB9fX0.signature';

// Receiver endpoint
const url = 'https://receiver.example.com/events';

async function main() {
  console.log('Transmitting Security Event Token...\n');

  try {
    // Basic transmission
    const result = await transmitSET(jwt, url, {
      authToken: process.env.AUTH_TOKEN || 'demo-token',
    });

    if (result.status === 'success') {
      console.log('✅ Event transmitted successfully!');
      console.log('Status Code:', result.statusCode);
      console.log('Response:', result.body);
      console.log('Headers:', result.headers);
    } else {
      console.log('❌ Transmission failed');
      console.log('Status Code:', result.statusCode);
      console.log('Error:', result.error);
      console.log('Response:', result.body);
      console.log('Retryable:', result.retryable);
    }
  } catch (error) {
    console.error('❌ Error during transmission:', error.message);
    
    if (error.name === 'ValidationError') {
      console.error('Check your JWT format and URL');
    } else if (error.name === 'TimeoutError') {
      console.error('Request timed out - try increasing the timeout');
    } else if (error.name === 'NetworkError') {
      console.error('Network error - check your connection');
    }
  }
}

// Display available event types
console.log('Available CAEP Event Types:');
console.log('----------------------------');
Object.entries(EventTypes).forEach(([key, value]) => {
  console.log(`${key}: ${value}`);
});
console.log('----------------------------\n');

// Run the example
main().catch(console.error);