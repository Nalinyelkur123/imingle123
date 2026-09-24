// ============================================================================
// V Mingle — Hair Detection Routes
// ============================================================================
// REST endpoints for hair detection status, logs, and manual or fallback
// event submission.
// ============================================================================

import { Router, Request, Response } from 'express';
import { hairDetectionService } from '../services/hair-detection.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/detection/report
 * Endpoint to report a hair detection result for an active session
 */
router.post('/report', async (req: Request, res: Response) => {
  try {
    const { session_id, user_id, long_hair_detected, confidence, timestamp } = req.body;

    if (!session_id && !user_id) {
      res.status(400).json({ error: 'session_id or user_id is required' });
      return;
    }

    const sessionId = session_id || `sess_rest_${Date.now()}`;
    const result = await hairDetectionService.processDetectionEvent(
      sessionId,
      {
        session_id: sessionId,
        user_id,
        long_hair_detected: Boolean(long_hair_detected),
        confidence: typeof confidence === 'number' ? confidence : 0.85,
        timestamp: timestamp || new Date().toISOString(),
      },
      user_id
    );

    res.status(200).json({
      status: 'ok',
      result,
    });
  } catch (err) {
    logger.error('Failed to report detection event via REST:', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Failed to process detection event' });
  }
});

/**
 * GET /api/detection/status
 * Returns current configuration and active detection status
 */
router.get('/status', (_req: Request, res: Response) => {
  try {
    const stats = hairDetectionService.getActiveStats();
    res.status(200).json({
      status: 'ok',
      stats,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve detection stats' });
  }
});

/**
 * GET /api/detection/logs
 * Returns recent structured delivery logs
 */
router.get('/logs', (_req: Request, res: Response) => {
  try {
    const logs = hairDetectionService.getRecentLogs();
    res.status(200).json({
      status: 'ok',
      count: logs.length,
      logs,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve detection logs' });
  }
});

export default router;
