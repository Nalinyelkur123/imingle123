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

    // In development mode or if CORS_ORIGIN contains wildcard, allow all origins
    if (env.NODE_ENV !== 'production' && (env.CORS_ORIGIN.includes('*') || !env.CORS_ORIGIN)) {
      return callback(null, true);
    }

    const allowed = env.CORS_ORIGIN.split(',').map((o) => o.trim());

    if (
      allowed.includes('*') ||
      allowed.includes(requestOrigin) ||
      DEFAULT_ALLOWED_ORIGINS.includes(requestOrigin)
    ) {
      return callback(null, true);
    }

    try {
      const url = new URL(requestOrigin);
      const hostname = url.hostname;

      // Allow production domains and common deployment/tunnel domains
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.vmingle.in') ||
        hostname.endsWith('.vmingle.com') ||
        hostname.endsWith('.pages.dev') ||
        hostname.endsWith('.vercel.app') ||
        hostname.endsWith('.ngrok-free.app') ||
        hostname.endsWith('.ngrok.io') ||
        hostname.endsWith('.loca.lt') ||
        hostname.endsWith('.trycloudflare.com')
      ) {
        return callback(null, true);
      }

      // Allow private LAN IPv4 addresses (192.168.x.x, 10.x.x.x, 172.16-31.x.x) for local multi-device testing
      const isPrivateLanIp =
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);

      if (isPrivateLanIp) {
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

