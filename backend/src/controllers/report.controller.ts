// ============================================================================
// NexusChat — Report Controller
// ============================================================================

import { Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import { ReportReason } from '../services/shared-types.js';
import { sessionStore } from '../services/session.store.js';
import { sessionService } from '../services/session.service.js';
import { matchmaker } from '../services/matchmaker.service.js';

// Helper to extract session token from request
function extractToken(req: Request): string | null {
  // 1. Authorization header: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 2. Request body token
  if (req.body && typeof req.body.token === 'string') {
    return req.body.token.trim();
  }

  return null;
}

export async function submitReport(req: Request, res: Response): Promise<void> {
  const token = extractToken(req);
  const verified = sessionService.verifyToken(token);

  if (!verified) {
    res.status(401).json({
      error: 'Unauthorized: A valid anonymous session token is required to submit reports.',
    });
    return;
  }

  const { reason, description, matchId, reportedUserId, reporterSessionId } = req.body || {};

  // If reporterSessionId is explicitly provided, it must match the authenticated session
  if (reporterSessionId && reporterSessionId !== verified.sessionId) {
    res.status(401).json({
      error: 'Unauthorized: reporterSessionId does not match the authenticated session token.',
    });
    return;
  }

  if (!reason || !Object.values(ReportReason).includes(reason)) {
    res.status(400).json({
      error: 'Invalid or missing report reason.',
    });
    return;
  }

  // If matchId is provided, verify against matchmaker or session records
  if (matchId && typeof matchId === 'string') {
    const activeMatch = matchmaker.getMatch(matchId);
    if (activeMatch) {
      if (
        activeMatch.user1.sessionId !== verified.sessionId &&
        activeMatch.user2.sessionId !== verified.sessionId
      ) {
        res.status(403).json({
          error: 'Forbidden: You cannot report a match that you were not a participant of.',
        });
        return;
      }
    } else {
      // If match is no longer active in memory, verify against session record if available
      const session = await sessionService.getSession(verified.sessionId);
      if (session && session.currentMatchId && session.currentMatchId !== matchId) {
        logger.warn(`Report submitted for historical or mismatched matchId ${matchId} by session ${verified.sessionId}`);
      }
    }
  }

  const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  logger.warn('User report received via REST API', {
    reportId,
    reason,
    description: description ? String(description).slice(0, 500) : '',
    matchId,
    reportedUserId,
    reporterSessionId: verified.sessionId,
  });

  try {
    await sessionStore.saveReport({
      reportId,
      reporterSessionId: verified.sessionId,
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
