// ============================================================================
// NexusChat — Matchmaker Service with Session Continuity
// ============================================================================
// Manages queues and active matches keyed by anonymous sessionId.
// Supports priority pairing based on shared interests, duplicate entry prevention,
// and a 15-second reconnection grace period for temporary connection drops.
// ============================================================================

import { sessionStore } from './session.store.js';
import { logger } from '../utils/logger.js';

export type ChatMode = 'video' | 'text';

export interface QueueEntry {
  sessionId: string;
  socketId: string;
  userId?: string;
  mode: ChatMode;
  interests: string[];
  joinedAt: number;
}

export interface ActiveMatch {
  matchId: string;
  mode: ChatMode;
  user1: {
    sessionId: string;
    socketId: string;
    interests: string[];
  };
  user2: {
    sessionId: string;
    socketId: string;
    interests: string[];
  };
  sharedInterest: string | null;
  sharedInterests?: string[];
  startedAt: number;
  status: 'active' | 'reconnecting';
}

export function normalizeTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 30);
}

export function normalizeInterests(interests: string[] = []): string[] {
  if (!Array.isArray(interests)) return [];
  const normalized = interests
    .map((i) => (typeof i === 'string' ? normalizeTag(i) : ''))
    .filter((i) => i.length > 0);
  return Array.from(new Set(normalized)).slice(0, 10);
}

const RECONNECT_GRACE_PERIOD_MS = 15000; // 15 seconds

class MatchmakerService {
  // Waiting queues separated by mode
  private textQueue: QueueEntry[] = [];
  private videoQueue: QueueEntry[] = [];

  // Active matches indexed by matchId
  private activeMatches: Map<string, ActiveMatch> = new Map();

  // Reverse index: sessionId -> matchId
  private sessionToMatch: Map<string, string> = new Map();

  // Multi-socket presence tracking: sessionId -> Set of active socketIds
  private sessionToSockets: Map<string, Set<string>> = new Map();

  // Reverse index: socketId -> { sessionId, userId }
  private socketToSession: Map<string, { sessionId: string; userId: string }> = new Map();

  // Reconnection timers indexed by sessionId
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  // Avoid immediate rematching with previous partner: sessionId -> lastPartnerSessionId
  private lastPartnerSession: Map<string, string> = new Map();

  // Interest search window before eligible for random stranger fallback (in ms)
  private interestSearchWindowMs = 2000;

  public setInterestSearchWindowMs(ms: number): void {
    this.interestSearchWindowMs = ms;
  }

  public getInterestSearchWindowMs(): number {
    return this.interestSearchWindowMs;
  }

  /**
   * Tracks socket connection and binds sessionId + userId.
   * A single session can have multiple sockets (e.g. tabs or reconnecting),
   * but counts as 1 unique online user.
   */
  public onSocketConnected(socketId: string, sessionId: string, userId: string): void {
    this.socketToSession.set(socketId, { sessionId, userId });

    let sockets = this.sessionToSockets.get(sessionId);
    if (!sockets) {
      sockets = new Set<string>();
      this.sessionToSockets.set(sessionId, sockets);
    }
    sockets.add(socketId);
  }

  /**
   * Rebinds an existing socket to a new or verified sessionId & userId without duplicates.
   */
  public rebindSocket(socketId: string, newSessionId: string, newUserId: string): void {
    const oldInfo = this.socketToSession.get(socketId);
    if (oldInfo && oldInfo.sessionId !== newSessionId) {
      const oldSockets = this.sessionToSockets.get(oldInfo.sessionId);
      if (oldSockets) {
        oldSockets.delete(socketId);
        if (oldSockets.size === 0) {
          this.sessionToSockets.delete(oldInfo.sessionId);
        }
      }
    }
    this.onSocketConnected(socketId, newSessionId, newUserId);
  }

  /**
   * Handles user reconnection with the same sessionId.
   * Restores active match if within the 15-second grace period.
   */
  public handleReconnect(
    sessionId: string,
    newSocketId: string,
    userId: string
  ): {
    resumed: boolean;
    match?: ActiveMatch;
    partnerSocketId?: string;
    isInitiator?: boolean;
  } {
    this.onSocketConnected(newSocketId, sessionId, userId);

    // Check if user was in a match that was paused for reconnection
    const matchId = this.sessionToMatch.get(sessionId);
    if (!matchId) return { resumed: false };

    const match = this.activeMatches.get(matchId);
    if (!match) return { resumed: false };

    // Clear reconnect timer if active
    const timer = this.reconnectTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(sessionId);
    }

    // Update socketId in the match
    let isInitiator = false;
    let partnerSocketId = '';

    if (match.user1.sessionId === sessionId) {
      match.user1.socketId = newSocketId;
      partnerSocketId = match.user2.socketId;
      isInitiator = true;
    } else if (match.user2.sessionId === sessionId) {
      match.user2.socketId = newSocketId;
      partnerSocketId = match.user1.socketId;
      isInitiator = false;
    } else {
      return { resumed: false };
    }

    match.status = 'active';

    // Update session store
    sessionStore.updateSessionStatus(sessionId, 'matched', matchId).catch(() => {});

    logger.info(`Session ${sessionId} reconnected to active match ${matchId} on socket ${newSocketId}`);

    return {
      resumed: true,
      match,
      partnerSocketId,
      isInitiator,
    };
  }

  /**
   * Tracks socket disconnection.
   * If the session has other active sockets open (e.g. another tab), it remains online.
   * If all sockets for the session are disconnected and user was in an active match,
   * holds it in grace period before ending.
   */
  public onSocketDisconnected(
    socketId: string,
    onGraceExpired: (match: ActiveMatch, partnerSocketId: string) => void
  ): {
    matchPaused?: ActiveMatch;
    partnerSocketId?: string;
    graceSeconds: number;
    sessionEnded: boolean;
  } {
    const sessionInfo = this.socketToSession.get(socketId);
    this.socketToSession.delete(socketId);

    if (!sessionInfo) {
      return { graceSeconds: 0, sessionEnded: false };
    }

    const { sessionId } = sessionInfo;
    const sockets = this.sessionToSockets.get(sessionId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.sessionToSockets.delete(sessionId);
      }
    }

    const hasRemainingSockets = (this.sessionToSockets.get(sessionId)?.size ?? 0) > 0;

    // If session still has other active sockets, do not dismantle queue or active match
    if (hasRemainingSockets) {
      return { graceSeconds: 0, sessionEnded: false };
    }

    // Remove from waiting queue if queued
    this.leaveQueue(sessionId);

    // Check if in active match
    const matchId = this.sessionToMatch.get(sessionId);
    if (!matchId) return { graceSeconds: 0, sessionEnded: true };

    const match = this.activeMatches.get(matchId);
    if (!match) return { graceSeconds: 0, sessionEnded: true };

    const partner = match.user1.sessionId === sessionId ? match.user2 : match.user1;
    const partnerSocketId = partner.socketId;
    if (!partnerSocketId) return { graceSeconds: 0, sessionEnded: true };

    // Set match status to reconnecting
    match.status = 'reconnecting';
    sessionStore.updateSessionStatus(sessionId, 'reconnecting', matchId).catch(() => {});

    logger.info(`Session ${sessionId} disconnected. Starting ${RECONNECT_GRACE_PERIOD_MS / 1000}s grace timer for match ${matchId}`);

    // Set grace period timer
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(sessionId);
      const currentMatch = this.activeMatches.get(matchId);
      if (currentMatch && currentMatch.status === 'reconnecting') {
        logger.info(`Grace period expired for session ${sessionId} in match ${matchId}`);
        const currentPartnerSocketId = currentMatch.user1.sessionId === sessionId
          ? currentMatch.user2.socketId
          : currentMatch.user1.socketId;
        this.endMatch(matchId, 'partner_disconnected');
        onGraceExpired(currentMatch, currentPartnerSocketId);
      }
    }, RECONNECT_GRACE_PERIOD_MS);

    this.reconnectTimers.set(sessionId, timer);

    return {
      matchPaused: match,
      partnerSocketId,
      graceSeconds: RECONNECT_GRACE_PERIOD_MS / 1000,
      sessionEnded: true,
    };
  }

  /**
   * Adds a user session to the appropriate queue and attempts to find a match.
   * Strictly prevents self-matching (same sessionId or same userId).
   * Automatically filters stale/dead candidates.
   */
  public joinQueue(
    sessionIdOrOptions:
      | string
      | {
          sessionId: string;
          socketId: string;
          mode: ChatMode;
          interests?: string[];
          userId?: string;
          isSocketAlive?: (id: string) => boolean;
        },
    rawSocketId?: string,
    rawMode?: ChatMode,
    rawInterests: string[] = [],
    rawUserId?: string,
    rawIsSocketAlive?: (id: string) => boolean
  ): {
    matched: boolean;
    match?: ActiveMatch;
    partnerSocketId?: string;
    partnerSessionId?: string;
    previousPartnerSocketId?: string;
  } {
    const sessionId = typeof sessionIdOrOptions === 'object' ? sessionIdOrOptions.sessionId : sessionIdOrOptions;
    const socketId = typeof sessionIdOrOptions === 'object' ? sessionIdOrOptions.socketId : rawSocketId!;
    const mode = typeof sessionIdOrOptions === 'object' ? sessionIdOrOptions.mode : rawMode!;
    const interests = typeof sessionIdOrOptions === 'object' ? (sessionIdOrOptions.interests || []) : rawInterests;
    const userId = typeof sessionIdOrOptions === 'object' ? sessionIdOrOptions.userId : rawUserId;
    const isSocketAlive = typeof sessionIdOrOptions === 'object' ? sessionIdOrOptions.isSocketAlive : rawIsSocketAlive;

    // If user is already in a match, record previous partner and end it cleanly
    let previousPartnerSocketId: string | undefined;
    const existingMatchId = this.sessionToMatch.get(sessionId);
    if (existingMatchId) {
      const oldMatch = this.activeMatches.get(existingMatchId);
      if (oldMatch) {
        previousPartnerSocketId =
          oldMatch.user1.sessionId === sessionId
            ? oldMatch.user2.socketId
            : oldMatch.user1.socketId;
      }
      this.endMatch(existingMatchId, 'new_search');
    }

    // Remove any existing queue entry for this session or socket
    this.leaveQueue(sessionId, socketId);

    const normalizedInterests = normalizeInterests(interests);

    const queue = mode === 'video' ? this.videoQueue : this.textQueue;

    // Prune stale/disconnected candidates from queue first
    if (isSocketAlive) {
      for (let i = queue.length - 1; i >= 0; i--) {
        if (!isSocketAlive(queue[i].socketId)) {
          logger.info(`Pruned dead socket ${queue[i].socketId} from ${mode} queue`);
          queue.splice(i, 1);
        }
      }
    }

    // Self-match prevention: skip same session, socket, or user
    const isEligible = (candidate: QueueEntry) => {
      if (candidate.sessionId === sessionId || candidate.socketId === socketId) return false;
      const effectiveUserId = userId || this.socketToSession.get(socketId)?.userId;
      const candidateUserId = candidate.userId || this.socketToSession.get(candidate.socketId)?.userId;
      if (effectiveUserId && candidateUserId && candidateUserId === effectiveUserId) return false;
      return true;
    };

    let partnerIndex = -1;
    let sharedInterest: string | null = null;
    let sharedInterests: string[] = [];
    const lastPartnerSessionId = this.lastPartnerSession.get(sessionId);

    // 1. Priority 1: match on shared interests (highest overlap score, last partner avoidance, FIFO)
    if (normalizedInterests.length > 0) {
      interface CandidateMatch {
        index: number;
        shared: string[];
        score: number;
        isLastPartner: boolean;
        joinedAt: number;
      }

      const interestCandidates: CandidateMatch[] = [];

      for (let i = 0; i < queue.length; i++) {
        const candidate = queue[i];
        if (!isEligible(candidate)) continue;

        const common = candidate.interests.filter((tag) =>
          normalizedInterests.includes(tag)
        );

        if (common.length > 0) {
          interestCandidates.push({
            index: i,
            shared: common,
            score: common.length,
            isLastPartner: candidate.sessionId === lastPartnerSessionId,
            joinedAt: candidate.joinedAt,
          });
        }
      }

      if (interestCandidates.length > 0) {
        // Sort:
        // 1. Highest overlap score first (e.g. 2 shared interests beats 1)
        // 2. Avoid immediate last partner if other interest candidates exist
        // 3. FIFO fairness (candidate who has waited longer in queue is paired first)
        interestCandidates.sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          if (a.isLastPartner !== b.isLastPartner) {
            return (a.isLastPartner ? 1 : 0) - (b.isLastPartner ? 1 : 0);
          }
          return a.joinedAt - b.joinedAt;
        });

        const selected = interestCandidates[0];
        partnerIndex = selected.index;
        sharedInterests = selected.shared;
        sharedInterest = selected.shared[0] || null;
      }
    }

    // 2. Priority 2: match with a random eligible stranger from waiting queue
    // Triggered immediately if incoming user entered NO interests (pure random mode),
    // or if the search window is disabled/0 (e.g. testing)
    const canDoImmediateRandom = normalizedInterests.length === 0 || this.interestSearchWindowMs === 0;

    if (partnerIndex === -1 && canDoImmediateRandom && queue.length > 0) {
      interface StrangerCandidate {
        index: number;
        isLastPartner: boolean;
        joinedAt: number;
      }

      const now = Date.now();
      const eligibleStrangers: StrangerCandidate[] = [];
      for (let i = 0; i < queue.length; i++) {
        const candidate = queue[i];
        if (!isEligible(candidate)) continue;

        // Candidate must either have no interests, or have waited past the interest search window
        const isReadyForRandom =
          candidate.interests.length === 0 ||
          this.interestSearchWindowMs === 0 ||
          now - candidate.joinedAt >= this.interestSearchWindowMs;

        if (isReadyForRandom) {
          eligibleStrangers.push({
            index: i,
            isLastPartner: candidate.sessionId === lastPartnerSessionId,
            joinedAt: candidate.joinedAt,
          });
        }
      }

      if (eligibleStrangers.length > 0) {
        // Sort: non-last partner first, then oldest waiting candidate (FIFO)
        eligibleStrangers.sort((a, b) => {
          if (a.isLastPartner !== b.isLastPartner) {
            return (a.isLastPartner ? 1 : 0) - (b.isLastPartner ? 1 : 0);
          }
          return a.joinedAt - b.joinedAt;
        });

        partnerIndex = eligibleStrangers[0].index;
        sharedInterest = null;
        sharedInterests = [];
      }
    }

    // If partner found, pair them
    if (partnerIndex !== -1) {
      const partner = queue.splice(partnerIndex, 1)[0];

      const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const activeMatch: ActiveMatch = {
        matchId,
        mode,
        user1: {
          sessionId,
          socketId,
          interests: normalizedInterests,
        },
        user2: {
          sessionId: partner.sessionId,
          socketId: partner.socketId,
          interests: partner.interests,
        },
        sharedInterest,
        sharedInterests,
        startedAt: Date.now(),
        status: 'active',
      };

      this.activeMatches.set(matchId, activeMatch);
      this.sessionToMatch.set(sessionId, matchId);
      this.sessionToMatch.set(partner.sessionId, matchId);

      // Persist to session store / database
      sessionStore.updateSessionStatus(sessionId, 'matched', matchId).catch(() => {});
      sessionStore.updateSessionStatus(partner.sessionId, 'matched', matchId).catch(() => {});
      sessionStore.recordMatch({
        matchId,
        sessionId1: sessionId,
        sessionId2: partner.sessionId,
        mode,
        sharedInterest,
        startedAt: activeMatch.startedAt,
        endedAt: null,
        endReason: null,
      }).catch(() => {});

      return {
        matched: true,
        match: activeMatch,
        partnerSocketId: partner.socketId,
        partnerSessionId: partner.sessionId,
        previousPartnerSocketId,
      };
    }

    // Otherwise, add to waiting queue
    const entry: QueueEntry = {
      sessionId,
      socketId,
      userId: userId || this.socketToSession.get(socketId)?.userId,
      mode,
      interests: normalizedInterests,
      joinedAt: Date.now(),
    };

    queue.push(entry);
    sessionStore.updateSessionStatus(sessionId, 'queued').catch(() => {});

    return { matched: false, previousPartnerSocketId };
  }

  /**
   * Removes a user from queue by sessionId or socketId
   */
  public leaveQueue(sessionId: string, socketId?: string): boolean {
    const vLen = this.videoQueue.length;
    const tLen = this.textQueue.length;

    this.videoQueue = this.videoQueue.filter(
      (e) => e.sessionId !== sessionId && (!socketId || e.socketId !== socketId)
    );
    this.textQueue = this.textQueue.filter(
      (e) => e.sessionId !== sessionId && (!socketId || e.socketId !== socketId)
    );

    const removed = this.videoQueue.length !== vLen || this.textQueue.length !== tLen;
    if (removed) {
      sessionStore.updateSessionStatus(sessionId, 'active').catch(() => {});
    }
    return removed;
  }

  /**
   * Retrieves active match for a given socketId
   */
  public getMatchBySocket(socketId: string): ActiveMatch | undefined {
    const sessionInfo = this.socketToSession.get(socketId);
    if (!sessionInfo) return undefined;
    const matchId = this.sessionToMatch.get(sessionInfo.sessionId);
    if (!matchId) return undefined;
    return this.activeMatches.get(matchId);
  }

  /**
   * Retrieves active match for a given sessionId
   */
  public getMatchBySession(sessionId: string): ActiveMatch | undefined {
    const matchId = this.sessionToMatch.get(sessionId);
    if (!matchId) return undefined;
    return this.activeMatches.get(matchId);
  }

  /**
   * Gets partner's socketId in an active match
   */
  public getPartnerSocketId(socketId: string): string | undefined {
    const match = this.getMatchBySocket(socketId);
    if (!match) return undefined;

    if (match.user1.socketId === socketId) {
      return match.user2.socketId;
    }
    return match.user1.socketId;
  }

  /**
   * Retrieves active match for a given matchId
   */
  public getMatch(matchId: string): ActiveMatch | undefined {
    return this.activeMatches.get(matchId);
  }

  /**
   * Ends an active match and records reason (supports matchId or sessionId)
   */
  public endMatch(matchIdOrSessionId: string, endReason = 'user_action'): ActiveMatch | undefined {
    let match = this.activeMatches.get(matchIdOrSessionId);
    let matchId = matchIdOrSessionId;

    if (!match) {
      const resolvedMatchId = this.sessionToMatch.get(matchIdOrSessionId);
      if (resolvedMatchId) {
        match = this.activeMatches.get(resolvedMatchId);
        matchId = resolvedMatchId;
      }
    }

    if (!match) return undefined;

    // Clear any pending reconnect timers
    const timer1 = this.reconnectTimers.get(match.user1.sessionId);
    if (timer1) {
      clearTimeout(timer1);
      this.reconnectTimers.delete(match.user1.sessionId);
    }
    const timer2 = this.reconnectTimers.get(match.user2.sessionId);
    if (timer2) {
      clearTimeout(timer2);
      this.reconnectTimers.delete(match.user2.sessionId);
    }

    this.sessionToMatch.delete(match.user1.sessionId);
    this.sessionToMatch.delete(match.user2.sessionId);
    this.activeMatches.delete(matchId);

    // Record last partner relationship to prevent instant rematch after skip
    this.lastPartnerSession.set(match.user1.sessionId, match.user2.sessionId);
    this.lastPartnerSession.set(match.user2.sessionId, match.user1.sessionId);

    // Update store
    sessionStore.updateSessionStatus(match.user1.sessionId, 'active', null).catch(() => {});
    sessionStore.updateSessionStatus(match.user2.sessionId, 'active', null).catch(() => {});
    sessionStore.endMatchRecord(matchId, endReason).catch(() => {});

    return match;
  }

  /**
   * Returns accurate real-time statistics based on unique active sessions
   */
  public getStats(): {
    onlineUsers: number;
    activeMatches: number;
    textQueueCount: number;
    videoQueueCount: number;
  } {
    return {
      onlineUsers: this.sessionToSockets.size,
      activeMatches: this.activeMatches.size,
      textQueueCount: this.textQueue.length,
      videoQueueCount: this.videoQueue.length,
    };
  }

  /**
   * Sweeps queues to form matches for candidates whose interest search window
   * has elapsed (falling back to random matching), or queued candidates who share interests.
   */
  public sweepQueues(isSocketAlive?: (id: string) => boolean): Array<{
    match: ActiveMatch;
    partnerSocketId: string;
    partnerSessionId: string;
  }> {
    const results: Array<{ match: ActiveMatch; partnerSocketId: string; partnerSessionId: string }> = [];
    const now = Date.now();

    for (const mode of ['video', 'text'] as const) {
      const queue = mode === 'video' ? this.videoQueue : this.textQueue;

      // 1. Prune dead sockets
      if (isSocketAlive) {
        for (let i = queue.length - 1; i >= 0; i--) {
          if (!isSocketAlive(queue[i].socketId)) {
            queue.splice(i, 1);
          }
        }
      }

      // 2. Pair candidates who share interests
      let foundInterestMatch = true;
      while (foundInterestMatch && queue.length >= 2) {
        foundInterestMatch = false;
        let bestPair: { i: number; j: number; shared: string[]; score: number } | null = null;

        for (let i = 0; i < queue.length; i++) {
          for (let j = i + 1; j < queue.length; j++) {
            const c1 = queue[i];
            const c2 = queue[j];
            const u1 = c1.userId || this.socketToSession.get(c1.socketId)?.userId;
            const u2 = c2.userId || this.socketToSession.get(c2.socketId)?.userId;
            if (
              c1.sessionId === c2.sessionId ||
              c1.socketId === c2.socketId ||
              (c1.userId && c2.userId && c1.userId === c2.userId) ||
              (u1 && u2 && u1 === u2)
            ) {
              continue;
            }

            const common = c1.interests.filter((t) => c2.interests.includes(t));
            if (common.length > 0) {
              if (!bestPair || common.length > bestPair.score) {
                bestPair = { i, j, shared: common, score: common.length };
              }
            }
          }
        }

        if (bestPair) {
          const p2 = queue.splice(bestPair.j, 1)[0];
          const p1 = queue.splice(bestPair.i, 1)[0];

          const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const activeMatch: ActiveMatch = {
            matchId,
            mode,
            user1: { sessionId: p1.sessionId, socketId: p1.socketId, interests: p1.interests },
            user2: { sessionId: p2.sessionId, socketId: p2.socketId, interests: p2.interests },
            sharedInterest: bestPair.shared[0] || null,
            sharedInterests: bestPair.shared,
            startedAt: Date.now(),
            status: 'active',
          };

          this.activeMatches.set(matchId, activeMatch);
          this.sessionToMatch.set(p1.sessionId, matchId);
          this.sessionToMatch.set(p2.sessionId, matchId);

          sessionStore.updateSessionStatus(p1.sessionId, 'matched', matchId).catch(() => {});
          sessionStore.updateSessionStatus(p2.sessionId, 'matched', matchId).catch(() => {});
          sessionStore.recordMatch({
            matchId,
            sessionId1: p1.sessionId,
            sessionId2: p2.sessionId,
            mode,
            sharedInterest: activeMatch.sharedInterest,
            startedAt: activeMatch.startedAt,
            endedAt: null,
            endReason: null,
          }).catch(() => {});

          results.push({ match: activeMatch, partnerSocketId: p2.socketId, partnerSessionId: p2.sessionId });
          foundInterestMatch = true;
        }
      }

      // 3. Fallback matching for candidates whose interest search window has elapsed, or who have no interests
      let foundRandomMatch = true;
      while (foundRandomMatch && queue.length >= 2) {
        foundRandomMatch = false;

        const readyIndices: number[] = [];
        for (let i = 0; i < queue.length; i++) {
          const c = queue[i];
          if (c.interests.length === 0 || this.interestSearchWindowMs === 0 || now - c.joinedAt >= this.interestSearchWindowMs) {
            readyIndices.push(i);
          }
        }

        if (readyIndices.length >= 2) {
          let pairIndices: [number, number] | null = null;
          for (let i = 0; i < readyIndices.length; i++) {
            for (let j = i + 1; j < readyIndices.length; j++) {
              const idx1 = readyIndices[i];
              const idx2 = readyIndices[j];
              const c1 = queue[idx1];
              const c2 = queue[idx2];
              const u1 = c1.userId || this.socketToSession.get(c1.socketId)?.userId;
              const u2 = c2.userId || this.socketToSession.get(c2.socketId)?.userId;
              const isSelf =
                c1.sessionId === c2.sessionId ||
                c1.socketId === c2.socketId ||
                (c1.userId && c2.userId && c1.userId === c2.userId) ||
                (u1 && u2 && u1 === u2);

              if (!isSelf) {
                pairIndices = [idx1, idx2];
                break;
              }
            }
            if (pairIndices) break;
          }

          if (pairIndices) {
            const idx2 = Math.max(pairIndices[0], pairIndices[1]);
            const idx1 = Math.min(pairIndices[0], pairIndices[1]);

            const p2 = queue.splice(idx2, 1)[0];
            const p1 = queue.splice(idx1, 1)[0];

            const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const activeMatch: ActiveMatch = {
              matchId,
              mode,
              user1: { sessionId: p1.sessionId, socketId: p1.socketId, interests: p1.interests },
              user2: { sessionId: p2.sessionId, socketId: p2.socketId, interests: p2.interests },
              sharedInterest: null,
              sharedInterests: [],
              startedAt: Date.now(),
              status: 'active',
            };

            this.activeMatches.set(matchId, activeMatch);
            this.sessionToMatch.set(p1.sessionId, matchId);
            this.sessionToMatch.set(p2.sessionId, matchId);

            sessionStore.updateSessionStatus(p1.sessionId, 'matched', matchId).catch(() => {});
            sessionStore.updateSessionStatus(p2.sessionId, 'matched', matchId).catch(() => {});
            sessionStore.recordMatch({
              matchId,
              sessionId1: p1.sessionId,
              sessionId2: p2.sessionId,
              mode,
              sharedInterest: null,
              startedAt: activeMatch.startedAt,
              endedAt: null,
              endReason: null,
            }).catch(() => {});

            results.push({ match: activeMatch, partnerSocketId: p2.socketId, partnerSessionId: p2.sessionId });
            foundRandomMatch = true;
          }
        }
      }
    }

    return results;
  }
}

export const matchmaker = new MatchmakerService();
