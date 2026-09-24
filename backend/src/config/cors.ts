// ============================================================================
// NexusChat — CORS Configuration
// ============================================================================
// CORS (Cross-Origin Resource Sharing) tells the browser which frontend
// URLs are allowed to make requests to this backend.
// Without CORS, the browser blocks http://localhost:3000 from calling
// http://localhost:3001 because they are different "origins" (different ports).
// ============================================================================

import cors from 'cors';
import { env } from './env.js';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'https://vmingle.in',
  'https://www.vmingle.in',
  'https://vmingle.com',
  'https://www.vmingle.com',
];

export const corsOptions: cors.CorsOptions = {
  origin: (requestOrigin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!requestOrigin) return callback(null, true);
    const allowed = env.CORS_ORIGIN.split(',').map((o) => o.trim());
    
    if (
      allowed.includes('*') ||
      allowed.includes(requestOrigin) ||
      DEFAULT_ALLOWED_ORIGINS.includes(requestOrigin)
    ) {
      return callback(null, true);
    }
    
    try {
      const hostname = new URL(requestOrigin).hostname;
      if (hostname.endsWith('.vmingle.in') || hostname.endsWith('.pages.dev')) {
        return callback(null, true);
      }
    } catch {
      // invalid URL
    }

    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
};

