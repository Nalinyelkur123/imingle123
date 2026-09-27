import cors from 'cors';

export const corsOptions: cors.CorsOptions = {
  origin: (requestOrigin, callback) => {
    if (!requestOrigin) return callback(null, true);

    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
};

