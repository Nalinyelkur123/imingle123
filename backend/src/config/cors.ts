import cors from 'cors';
import { env } from './env.js';

// Always allow official production and staging domains
const ALWAYS_ALLOWED_ORIGINS = [
  'https://vmingle.in',
  'https://www.vmingle.in',
  'http://vmingle.in',
  'http://www.vmingle.in',
];

export function isOriginAllowed(requestOrigin?: string): boolean {
  if (!requestOrigin) return true;

  const lower = requestOrigin.trim().toLowerCase();

  // Allow explicit known domains
  if (ALWAYS_ALLOWED_ORIGINS.some((o) => o.toLowerCase() === lower)) {
    return true;
  }

  // Parse CORS_ORIGIN from env (comma-separated)
  const envOrigins = (env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (envOrigins.includes('*') || envOrigins.includes(lower)) {
    return true;
  }

  try {
    const url = new URL(requestOrigin);
    const host = url.hostname.toLowerCase();

    // Allow official production domain & subdomains (e.g. staging.vmingle.in)
    if (host === 'vmingle.in' || host.endsWith('.vmingle.in')) {
      return true;
    }

    // Allow Render service deployment domains (*.onrender.com)
    if (host === 'onrender.com' || host.endsWith('.onrender.com')) {
      return true;
    }

    // Allow local development
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.local')
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export const corsOptions: cors.CorsOptions = {
  origin: (requestOrigin, callback) => {
    if (isOriginAllowed(requestOrigin)) {
      return callback(null, true);
    }
    // Return null, false to reject cleanly without unhandled server exception
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['X-Request-ID'],
  maxAge: 86400,
};
