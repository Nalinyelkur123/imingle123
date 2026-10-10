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
  destinationHost?: string;
  destinationIp?: string;
  destinationPort?: number;
  maxRetries?: number;
  timeoutMs?: number;
  initialBackoffMs?: number;
}

export class HairDetectionService {
  private recentDeliveries: DetectionEventDeliveryResult[] = [];
  private activeSessionDetections: Map<string, { lastDetectedAt: number; count: number }> = new Map();
  private circuitOpenUntil = 0;
  private lastCircuitWarnLogAt = 0;
  private static readonly CIRCUIT_COOLDOWN_MS = 30_000;

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
    if (!env.DETECTION_ENABLED || !canonicalPayload.long_hair_detected) {
      return {
        session_id: sessionId,
        user_id: userId,
        long_hair_detected: canonicalPayload.long_hair_detected,
        confidence: canonicalPayload.confidence,
        timestamp,
        destination_ip: env.DETECTION_DESTINATION_HOST || env.DETECTION_DESTINATION_IP,
        destination_port: env.DETECTION_DESTINATION_PORT,
        processing_time_ms: Date.now() - startTime,
        status: 'SUCCESS',
      };
    }

    // Deliver event to configured destination host
    return this.dispatchToDestination(canonicalPayload, startTime);
  }

  /**
   * Dispatches the detection payload to the configured destination host with retry policy
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
    const destinationHost = options?.destinationHost ?? options?.destinationIp ?? env.DETECTION_DESTINATION_HOST ?? env.DETECTION_DESTINATION_IP;
    const destinationPort = options?.destinationPort ?? env.DETECTION_DESTINATION_PORT;
    const destinationUrl = `http://${destinationHost}:${destinationPort}/api/hair-detection`;

    // Circuit breaker check: If destination was recently unreachable, suppress repeated network calls
    const now = Date.now();
    if (now < this.circuitOpenUntil) {
      const processingTime = now - startTime;
      const remainingSeconds = Math.ceil((this.circuitOpenUntil - now) / 1000);
      const failedResult: DetectionEventDeliveryResult = {
        session_id: payload.session_id,
        user_id: payload.user_id,
        long_hair_detected: payload.long_hair_detected,
        confidence: payload.confidence,
        timestamp: payload.timestamp,
        destination_ip: destinationHost,
        destination_port: destinationPort,
        processing_time_ms: processingTime,
        status: 'FAILED',
        error_message: `Circuit open: destination ${destinationHost}:${destinationPort} unreachable. Backing off for ${remainingSeconds}s`,
      };

      this.recordLog(failedResult, true);
      return failedResult;
    }

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
          // Reset circuit breaker on success
          this.circuitOpenUntil = 0;
          this.lastCircuitWarnLogAt = 0;

          const processingTime = Date.now() - startTime;
          const result: DetectionEventDeliveryResult = {
            session_id: payload.session_id,
            user_id: payload.user_id,
            long_hair_detected: payload.long_hair_detected,
            confidence: payload.confidence,
            timestamp: payload.timestamp,
            destination_ip: destinationHost,
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

        const cause = (err as { cause?: { code?: string; message?: string } })?.cause;
        const code = (err as { code?: string })?.code || cause?.code;
        const errStr = `${lastError} ${cause?.message || ''}`;
        const isConnRefused =
          code === 'ECONNREFUSED' ||
          code === 'ENOTFOUND' ||
          code === 'ECONNRESET' ||
          /econnrefused|connection refused|fetch failed/i.test(errStr);

        if (isConnRefused) {
          // Trip circuit breaker immediately to protect Node.js event loop
          this.circuitOpenUntil = Date.now() + HairDetectionService.CIRCUIT_COOLDOWN_MS;
          break;
        }
      }

      // If attempts remain, wait with exponential backoff before retrying
      if (attempt <= maxRetries) {
        const backoffMs = initialBackoffMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    // Exhausted retries -> Record failure gracefully without throwing
    const isConnRefused = /connection refused|econnrefused|fetch failed/i.test(lastError || '');
    if (isConnRefused) {
      this.circuitOpenUntil = Date.now() + HairDetectionService.CIRCUIT_COOLDOWN_MS;
    }

    const processingTime = Date.now() - startTime;
    const failedResult: DetectionEventDeliveryResult = {
      session_id: payload.session_id,
      user_id: payload.user_id,
      long_hair_detected: payload.long_hair_detected,
      confidence: payload.confidence,
      timestamp: payload.timestamp,
      destination_ip: destinationHost,
      destination_port: destinationPort,
      processing_time_ms: processingTime,
      status: 'FAILED',
      error_message: lastError,
    };

    this.recordLog(failedResult, false);
    return failedResult;
  }

  /**
   * Outputs structured detection logs per requirement specification
   */
  private recordLog(result: DetectionEventDeliveryResult, isThrottled = false): void {
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
      const now = Date.now();
      if (isThrottled) {
        if (now - this.lastCircuitWarnLogAt >= HairDetectionService.CIRCUIT_COOLDOWN_MS) {
          this.lastCircuitWarnLogAt = now;
          logger.warn(`${structuredEntry} | note="circuit open; suppressing repeated failure logs for 30s"`);
        }
      } else {
        this.lastCircuitWarnLogAt = now;
        logger.warn(structuredEntry);
      }
    }
  }

  /**
   * Reset circuit breaker state (useful for tests or after reconfiguring destination)
   */
  public resetCircuitBreaker(): void {
    this.circuitOpenUntil = 0;
    this.lastCircuitWarnLogAt = 0;
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
    circuitOpen: boolean;
    activeSessionsCount: number;
    totalDeliveries: number;
  } {
    return {
      configuredDestination: `http://${env.DETECTION_DESTINATION_IP}:${env.DETECTION_DESTINATION_PORT}/api/hair-detection`,
      fps: env.DETECTION_FPS,
      enabled: env.DETECTION_ENABLED,
      circuitOpen: Date.now() < this.circuitOpenUntil,
      activeSessionsCount: this.activeSessionDetections.size,
      totalDeliveries: this.recentDeliveries.length,
    };
  }
}

export const hairDetectionService = new HairDetectionService();
