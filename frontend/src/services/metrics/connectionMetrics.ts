// ============================================================================
// V Mingle — Connection Performance Telemetry & Metrics Tracker
// ============================================================================
// Tracks high-resolution performance timings (using performance.now())
// from the instant "Start Chat" is clicked through media acquisition,
// matchmaking queue, WebRTC signaling, ICE connection, and first video frame.
// ============================================================================

export interface ConnectionMilestones {
  correlationId: string;
  startClickedAt?: number;
  mediaRequestStartedAt?: number;
  mediaReadyAt?: number;
  queueJoinedAt?: number;
  matchFoundAt?: number;
  offerCreatedAt?: number;
  offerSentAt?: number;
  offerReceivedAt?: number;
  answerCreatedAt?: number;
  answerSentAt?: number;
  answerReceivedAt?: number;
  iceConnectedAt?: number;
  firstTrackReceivedAt?: number;
  firstFrameRenderedAt?: number;
  failedAt?: number;
  failureReason?: string;
}

export interface ConnectionTimingSummary {
  correlationId: string;
  mediaAcquisitionMs: number;
  queueWaitMs: number;
  signalingMs: number;
  iceConnectMs: number;
  firstTrackMs: number;
  firstFrameMs: number;
  totalConnectMs: number;
}

export type NumericMilestone = keyof Omit<ConnectionMilestones, 'correlationId' | 'failureReason'>;

class ConnectionMetricsTracker {
  private current: ConnectionMilestones | null = null;

  public startAttempt(correlationId?: string): string {
    const id = correlationId || `conn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.current = {
      correlationId: id,
      startClickedAt: performance.now(),
    };
    return id;
  }

  public record(milestone: NumericMilestone, time = performance.now()): void {
    if (!this.current) return;
    this.current[milestone] = time;
  }

  public getCorrelationId(): string | undefined {
    return this.current?.correlationId;
  }

  public markFailed(reason: string): void {
    if (!this.current) return;
    this.current.failedAt = performance.now();
    this.current.failureReason = reason;
    console.warn(`[PERF] ⚠️ [${this.current.correlationId}] Connection attempt failed: ${reason}`);
  }

  public finish(): ConnectionTimingSummary | null {
    if (!this.current) return null;
    const startClickedAt = this.current.startClickedAt;
    if (typeof startClickedAt !== "number") return null;

    const m = this.current;
    const mediaAcquisitionMs =
      m.mediaReadyAt && m.mediaRequestStartedAt ? Math.round(m.mediaReadyAt - m.mediaRequestStartedAt) : 0;
    const queueWaitMs =
      m.matchFoundAt && m.queueJoinedAt ? Math.round(m.matchFoundAt - m.queueJoinedAt) : 0;
    const signalingMs =
      m.answerReceivedAt && m.offerCreatedAt
        ? Math.round(m.answerReceivedAt - m.offerCreatedAt)
        : m.answerSentAt && m.offerReceivedAt
        ? Math.round(m.answerSentAt - m.offerReceivedAt)
        : 0;
    const iceConnectMs =
      m.iceConnectedAt && m.matchFoundAt ? Math.round(m.iceConnectedAt - m.matchFoundAt) : 0;
    const firstTrackMs =
      m.firstTrackReceivedAt && m.matchFoundAt ? Math.round(m.firstTrackReceivedAt - m.matchFoundAt) : 0;
    const firstFrameMs =
      m.firstFrameRenderedAt && m.firstTrackReceivedAt
        ? Math.round(m.firstFrameRenderedAt - m.firstTrackReceivedAt)
        : 0;
    const totalConnectMs =
      (m.firstFrameRenderedAt || m.iceConnectedAt || m.firstTrackReceivedAt || performance.now()) -
      startClickedAt;

    const summary: ConnectionTimingSummary = {
      correlationId: m.correlationId,
      mediaAcquisitionMs,
      queueWaitMs,
      signalingMs,
      iceConnectMs,
      firstTrackMs,
      firstFrameMs,
      totalConnectMs: Math.round(totalConnectMs),
    };

    console.info(
      `[PERF] ⚡ Connection Established [${m.correlationId}]: Total: ${summary.totalConnectMs}ms | Media: ${summary.mediaAcquisitionMs}ms | Queue: ${summary.queueWaitMs}ms | Signaling: ${summary.signalingMs}ms | ICE: ${summary.iceConnectMs}ms | First Track: ${summary.firstTrackMs}ms`
    );

    return summary;
  }

  public reset(): void {
    this.current = null;
  }
}

export const connectionMetrics = new ConnectionMetricsTracker();
