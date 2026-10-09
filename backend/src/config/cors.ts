import cors from 'cors';
import { env } from './env.js';

export const corsOptions: cors.CorsOptions = {
  origin: (requestOrigin, callback) => {
    if (!requestOrigin) return callback(null, true);

    const allowedOrigins = env.CORS_ORIGIN.split(',').map((s) => s.trim());
    if (
      allowedOrigins.includes(requestOrigin) ||
      (env.NODE_ENV !== 'production' &&
        (requestOrigin.includes('localhost') || requestOrigin.includes('127.0.0.1')))
    ) {
      return callback(null, true);
    }

    return callback(new Error('CORS: Not allowed by policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
};
