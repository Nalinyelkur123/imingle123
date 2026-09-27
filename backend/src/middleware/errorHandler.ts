// ============================================================================
// NexusChat — Centralized Error Handler
// ============================================================================
// Catches ALL errors from route handlers and sends consistent JSON responses.
// NEVER exposes internal stack traces to users (security risk).
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    logger.warn('Application error', {
      requestId: req.requestId,
      statusCode: err.statusCode,
      message: err.message,
      path: req.path,
    });

    res.status(err.statusCode).json({
      error: { message: err.message, code: err.statusCode },
    });
    return;
  }

  // Handle Express body-parser payload too large (413)
  const errAny = err as any;
  if (errAny.type === 'entity.too.large' || errAny.status === 413) {
    logger.warn('Payload too large', {
      requestId: req.requestId,
      statusCode: 413,
      message: err.message,
      path: req.path,
    });
    res.status(413).json({
      error: { message: 'Payload too large. Maximum allowed size is 1MB.', code: 413 },
    });
    return;
  }

  // Handle Express body-parser JSON syntax error (400)
  if ((err instanceof SyntaxError && 'body' in err) || errAny.status === 400) {
    logger.warn('Invalid JSON in request body', {
      requestId: req.requestId,
      statusCode: 400,
      message: err.message,
      path: req.path,
    });
    res.status(400).json({
      error: { message: 'Invalid JSON syntax in request body.', code: 400 },
    });
    return;
  }

  logger.error('Unexpected error', {
    requestId: req.requestId,
    message: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(500).json({
    error: { message: 'Internal server error', code: 500 },
  });
}
