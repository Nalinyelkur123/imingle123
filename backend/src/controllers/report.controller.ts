// ============================================================================
// NexusChat — Report Controller
// ============================================================================

import { Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import { ReportReason } from '../services/shared-types.js';
import { sessionStore } from '../services/session.store.js';

export async function submitReport(req: Request, res: Response): Promise<void> {
  const { reason, description, matchId, reportedUserId, reporterSessionId } = req.body || {};

  if (!reason || !Object.values(ReportReason).includes(reason)) {
    res.status(400).json({
      error: 'Invalid or missing report reason.',
    });
    return;
  }

  const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  logger.warn('User report received via REST API', {
    reportId,
    reason,
    description: description ? String(description).slice(0, 500) : '',
    matchId,
    reportedUserId,
  });

  try {
    await sessionStore.saveReport({
      reportId,
      reporterSessionId: reporterSessionId || null,
      reportedUserId: reportedUserId || null,
      matchId: matchId || null,
      reason,
      description: description ? String(description).slice(0, 500) : '',
      createdAt: Date.now(),
      status: 'pending',
    });
  } catch (err) {
    logger.error('Failed to persist user report to store:', {
      error: err instanceof Error ? err.message : String(err),
      reportId,
    });
  }

  res.status(201).json({
    status: 'ok',
    message: 'Report submitted successfully. Thank you for keeping Umingle safe.',
    reportId,
  });
}
