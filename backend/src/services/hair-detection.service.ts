// ============================================================================
// V Mingle — Real-Time Long-Hair Detection Service
// ============================================================================
// Receives detection results associated with active user sessions, validates
// user_id and session_id mappings, formats detection payloads, dispatches
// HTTP events to the configured destination IP, implements retry policies,
// and records structured audit logs.
// ============================================================================

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { sessionService } from './session.service.js';
import {
  HairDetectionPayload,
  DetectionEventDeliveryResult,
} from './shared-types.js';

export interface DispatchOptions {
  destinationIp?: string;
  destinationPort?: number;
  maxRetries?: number;
  timeoutMs?: number;
  initialBackoffMs?: number;
}

export class HairDetectionService {
  private recentDeliveries: DetectionEventDeliveryResult[] = [];
  private activeSessionDetections: Map<string, { lastDetectedAt: number; count: number }> = new Map();

  /**
   * Processes an incoming detection event from a user session.
   */
  public async processDetectionEvent(
    sessionId: string,
    payload: HairDetectionPayload,
    resolvedUserId?: string
  ): Promise<DetectionEventDeliveryResult> {
    const startTime = Date.now();
    const timestamp = payload.timestamp || new Date().toISOString();

    // 1. Resolve User ID from active session if not explicitly provided
    let userId = resolvedUserId || payload.user_id;
    if (!userId && sessionId) {
      try {
        const sessionRecord = await sessionService.getSession(sessionId);
        if (sessionRecord) {
          userId = sessionRecord.userId;
        }
      } catch (err) {
        logger.warn(`Could not resolve userId from sessionStore for ${sessionId}:`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    // Fallback if session had not initialized userId
    if (!userId) {
      userId = `usr_${sessionId.replace(/^sess_/, '')}`;
    }

    const canonicalPayload = {
      session_id: sessionId,
      user_id: userId,
      long_hair_detected: Boolean(payload.long_hair_detected),
      confidence: Number((payload.confidence || 0).toFixed(2)),
      timestamp,
    };

    // Track active session detection count
    const sessionStats = this.activeSessionDetections.get(sessionId) || { lastDetectedAt: 0, count: 0 };
    sessionStats.lastDetectedAt = Date.now();
    sessionStats.count += 1;
    this.activeSessionDetections.set(sessionId, sessionStats);

    // If long hair is not detected, or if detection is disabled, record and return without sending HTTP
    if (!env.DETECTION_ENABLED) {
      return {
        session_id: sessionId,
        user_id: userId,
        long_hair_detected: canonicalPayload.long_hair_detected,
        confidence: canonicalPayload.confidence,
        timestamp,
        destination_ip: env.DETECTION_DESTINATION_IP,
        destination_port: env.DETECTION_DESTINATION_PORT,
        processing_time_ms: Date.now() - startTime,
        status: 'SUCCESS',
      };
    }

    // Deliver event to configured destination IP
    return this.dispatchToDestination(canonicalPayload, startTime);
  }

  /**
   * Dispatches the detection payload to the configured destination IP with retry policy
   */
  public async dispatchToDestination(
    payload: {
      session_id: string;
      user_id: string;
      long_hair_detected: boolean;
      confidence: number;
      timestamp: string;
    },
    startTime: number,
    options?: DispatchOptions
  ): Promise<DetectionEventDeliveryResult> {
    const destinationIp = options?.destinationIp ?? env.DETECTION_DESTINATION_IP;
    const destinationPort = options?.destinationPort ?? env.DETECTION_DESTINATION_PORT;
    const destinationUrl = `http://${destinationIp}:${destinationPort}/api/hair-detection`;

    const maxRetries = options?.maxRetries ?? env.DETECTION_RETRY_COUNT;
    const timeoutMs = options?.timeoutMs ?? env.DETECTION_TIMEOUT_MS;
    const initialBackoffMs = options?.initialBackoffMs ?? 500;

    let attempt = 0;
    let lastError: string | undefined;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(destinationUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'VMingle-Detection-Service/1.0',
            'X-Detection-Session-Id': payload.session_id,
            'X-Detection-User-Id': payload.user_id,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutHandle);

        if (response.ok) {
          const processingTime = Date.now() - startTime;
          const result: DetectionEventDeliveryResult = {
            session_id: payload.session_id,
            user_id: payload.user_id,
            long_hair_detected: payload.long_hair_detected,
            confidence: payload.confidence,
            timestamp: payload.timestamp,
            destination_ip: destinationIp,
            destination_port: destinationPort,
            processing_time_ms: processingTime,
            status: 'SUCCESS',
          };

          this.recordLog(result);
          return result;
        } else {
          lastError = `HTTP ${response.status} ${response.statusText}`;
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            lastError = `Connection timed out after ${timeoutMs}ms`;
          } else {
            lastError = err.message;
          }
        } else {
          lastError = String(err);
        }
      }

      // If attempts remain, wait with exponential backoff before retrying
      if (attempt <= maxRetries) {
        const backoffMs = initialBackoffMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    // Exhausted retries -> Record failure gracefully without throwing
    const processingTime = Date.now() - startTime;
    const failedResult: DetectionEventDeliveryResult = {
      session_id: payload.session_id,
      user_id: payload.user_id,
      long_hair_detected: payload.long_hair_detected,
      confidence: payload.confidence,
      timestamp: payload.timestamp,
      destination_ip: destinationIp,
      destination_port: destinationPort,
      processing_time_ms: processingTime,
      status: 'FAILED',
      error_message: lastError,
    };

    this.recordLog(failedResult);
    return failedResult;
  }

  /**
   * Outputs structured detection logs per requirement specification
   */
  private recordLog(result: DetectionEventDeliveryResult): void {
    // 1. Maintain in-memory delivery history (capped at 200 items)
    this.recentDeliveries.unshift(result);
    if (this.recentDeliveries.length > 200) {
      this.recentDeliveries.pop();
    }

    // 2. Structured log format:
    // timestamp
    // user_id
    // session_id
    // long_hair_detected=true/false
    // confidence=0.91
    // destination=192.168.1.100
    // status=SUCCESS/FAILED
    const structuredEntry = [
      `[HAIR_DETECTION_EVENT]`,
      result.timestamp,
      `user_id=${result.user_id}`,
      `session_id=${result.session_id}`,
      `long_hair_detected=${result.long_hair_detected}`,
      `confidence=${result.confidence}`,
      `destination=${result.destination_ip}:${result.destination_port}`,
      `processing_time=${result.processing_time_ms}ms`,
      `status=${result.status}`,
      result.error_message ? `error="${result.error_message}"` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    if (result.status === 'SUCCESS') {
      logger.info(structuredEntry);
    } else {
      logger.warn(structuredEntry);
    }
  }

  /**
   * Clean up session tracking on disconnect or session termination
   */
  public onSessionDisconnected(sessionId: string): void {
    this.activeSessionDetections.delete(sessionId);
    logger.info(`Cleaned up hair detection session context for: ${sessionId}`);
  }

  /**
   * Retrieve recent delivery logs
   */
  public getRecentLogs(): DetectionEventDeliveryResult[] {
    return [...this.recentDeliveries];
  }

  /**
   * Retrieve active session statistics
   */
  public getActiveStats(): {
    configuredDestination: string;
    fps: number;
    enabled: boolean;
    activeSessionsCount: number;
    totalDeliveries: number;
  } {
    return {
      configuredDestination: `http://${env.DETECTION_DESTINATION_IP}:${env.DETECTION_DESTINATION_PORT}/api/hair-detection`,
      fps: env.DETECTION_FPS,
      enabled: env.DETECTION_ENABLED,
      activeSessionsCount: this.activeSessionDetections.size,
      totalDeliveries: this.recentDeliveries.length,
    };
  }
}

export const hairDetectionService = new HairDetectionService();
