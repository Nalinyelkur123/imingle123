// ============================================================================
// NexusChat — Socket.IO Real-Time Service with Session Continuity
// ============================================================================
// Manages authenticated WebSocket communication, matchmaking lifecycles,
// WebRTC signaling relay, chat messaging, and reconnection grace periods.
// ============================================================================

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { corsOptions } from '../config/cors.js';
import { logger } from '../utils/logger.js';
import { matchmaker, ChatMode } from './matchmaker.service.js';
import { sessionService } from './session.service.js';
import { sessionStore } from './session.store.js';
import { hairDetectionService } from './hair-detection.service.js';
import {
  ClientEvents,
  ServerEvents,
  MatchEndReason,
  ErrorCode,
  MAX_MESSAGE_LENGTH,
  SendMessagePayload,
  ReportPayload,
  WebRTCOfferPayload,
  WebRTCAnswerPayload,
  ICECandidatePayload,
  HairDetectionPayload,
} from './shared-types.js';

let ioInstance: SocketIOServer | null = null;

export function initSocketService(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: corsOptions,
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  ioInstance = io;

  // ── Authentication Middleware ─────────────────────────────────────────────
  // Validates cryptographically signed sessionToken during handshake, or auto-provisions
  // an anonymous session to prevent connection drops.
  io.use(async (socket, next) => {
    let token =
      socket.handshake.auth?.sessionToken ||
      socket.handshake.auth?.token ||
      (socket.handshake.headers?.authorization?.startsWith('Bearer ')
        ? socket.handshake.headers.authorization.substring(7).trim()
        : null);

    let verified = sessionService.verifyToken(token);

    if (!verified) {
      try {
        const freshSession = await sessionService.createOrResumeSession(null, 'video');
        token = freshSession.token;
        verified = { sessionId: freshSession.sessionId, expiresAt: freshSession.expiresAt };
        logger.info(`Auto-provisioned anonymous session ${freshSession.sessionId} for socket ${socket.id}`);
      } catch (err) {
        logger.error('Failed to auto-provision anonymous session on socket handshake', {
          error: err instanceof Error ? err.message : String(err),
        });
        return next(new Error('AUTHENTICATION_ERROR: Valid anonymous session token required'));
      }
    }

    const sessionRecord = await sessionService.getSession(verified.sessionId);
    const userId = sessionRecord?.userId || `usr_${verified.sessionId.replace(/^sess_/, '')}`;

    socket.data.sessionId = verified.sessionId;
    socket.data.userId = userId;
    socket.data.sessionToken = token;
    next();
  });

  const broadcastOnlineCount = () => {
    const stats = matchmaker.getStats();
    io.emit('online_count', { count: stats.onlineUsers });
  };

  io.on('connection', (socket: Socket) => {
    let currentSessionId = socket.data.sessionId as string;
    let currentUserId = socket.data.userId as string;
    let currentSessionToken = socket.data.sessionToken as string;
    matchmaker.onSocketConnected(socket.id, currentSessionId, currentUserId);
    logger.info(`Socket connected: ${socket.id} (Session: ${currentSessionId}, User: ${currentUserId})`);
    broadcastOnlineCount();

    // Inform client of active session identity
    socket.emit('session_established', {
      sessionId: currentSessionId,
      userId: currentUserId,
      sessionToken: currentSessionToken,
    });

    // ── DYNAMIC AUTHENTICATION / RE-BINDING ──────────────────────────────────
    socket.on('authenticate', async (payload: { sessionToken?: string }) => {
      if (!payload?.sessionToken) return;
      const verified = sessionService.verifyToken(payload.sessionToken);
      if (!verified) return;

      const sessionRecord = await sessionService.getSession(verified.sessionId);
      const newUserId = sessionRecord?.userId || `usr_${verified.sessionId.replace(/^sess_/, '')}`;
      const oldSessionId = socket.data.sessionId;

      socket.data.sessionId = verified.sessionId;
      socket.data.userId = newUserId;
      socket.data.sessionToken = payload.sessionToken;

      matchmaker.rebindSocket(socket.id, verified.sessionId, newUserId);
      logger.info(`Socket ${socket.id} authenticated/re-bound from session ${oldSessionId} to ${verified.sessionId} (User: ${newUserId})`);

      broadcastOnlineCount();

      socket.emit('session_established', {
        sessionId: verified.sessionId,
        userId: newUserId,
        sessionToken: payload.sessionToken,
      });
    });

    // ── CHECK RECONNECTION TO ACTIVE MATCH ──────────────────────────────────
    const reconnectResult = matchmaker.handleReconnect(socket.data.sessionId, socket.id, socket.data.userId);
    if (reconnectResult.resumed && reconnectResult.match && reconnectResult.partnerSocketId) {
      logger.info(`Session ${socket.data.sessionId} re-established match ${reconnectResult.match.matchId}`);

      socket.emit('match_reconnected', {
        matchId: reconnectResult.match.matchId,
        partnerId: reconnectResult.partnerSocketId,
        isInitiator: reconnectResult.isInitiator,
        sharedInterest: reconnectResult.match.sharedInterest,
      });

      io.to(reconnectResult.partnerSocketId).emit('peer_reconnected', {
        matchId: reconnectResult.match.matchId,
        partnerId: socket.id,
        isInitiator: !reconnectResult.isInitiator,
      });
    }

    // ── JOIN QUEUE ──────────────────────────────────────────────────────────
    socket.on(
      ClientEvents.JOIN_QUEUE,
      (payload: { mode?: ChatMode; interests?: string[] }) => {
        const mode: ChatMode = payload?.mode === 'video' ? 'video' : 'text';
        const interests: string[] = Array.isArray(payload?.interests)
          ? payload.interests
          : [];

        const activeSessionId = socket.data.sessionId as string;
        const activeUserId = socket.data.userId as string;

        logger.info(`Session ${activeSessionId} (Socket ${socket.id}) joining queue for mode: ${mode}`);

        const isSocketAlive = (id: string) => io.sockets.sockets.has(id);
        const result = matchmaker.joinQueue(activeSessionId, socket.id, mode, interests, activeUserId, isSocketAlive);

        // If user was previously matched, notify that old partner that they left
        if (result.previousPartnerSocketId) {
          io.to(result.previousPartnerSocketId).emit(ServerEvents.MATCH_ENDED, {
            reason: MatchEndReason.PARTNER_LEFT,
          });
        }

        if (result.matched && result.match && result.partnerSocketId) {
          const partnerSocket = io.sockets.sockets.get(result.partnerSocketId);

          if (!partnerSocket) {
            // Partner dropped before pairing was finalized
            matchmaker.endMatch(result.match.matchId, 'partner_missing');
            matchmaker.joinQueue(activeSessionId, socket.id, mode, interests, activeUserId, isSocketAlive);
            return;
          }

          logger.info(
            `Match formed: ${result.match.matchId} between ${activeSessionId} (${socket.id}) and ${result.partnerSessionId} (${result.partnerSocketId})`
          );

          // Emit MATCH_FOUND to initiating peer (socket)
          socket.emit(ServerEvents.MATCH_FOUND, {
            matchId: result.match.matchId,
            partnerId: result.partnerSocketId,
            isInitiator: true,
            sharedInterest: result.match.sharedInterest,
          });

          // Emit MATCH_FOUND to answering peer (partner)
          partnerSocket.emit(ServerEvents.MATCH_FOUND, {
            matchId: result.match.matchId,
            partnerId: socket.id,
            isInitiator: false,
            sharedInterest: result.match.sharedInterest,
          });
        }
      }
    );

    // ── LEAVE QUEUE ─────────────────────────────────────────────────────────
    socket.on(ClientEvents.LEAVE_QUEUE, () => {
      matchmaker.leaveQueue(socket.data.sessionId, socket.id);
    });

    // ── SEND MESSAGE ────────────────────────────────────────────────────────
    socket.on(ClientEvents.SEND_MESSAGE, (payload: SendMessagePayload) => {
      const match = matchmaker.getMatchBySocket(socket.id);
      if (!match) {
        socket.emit(ServerEvents.ERROR, {
          code: ErrorCode.NOT_IN_MATCH,
          message: 'You are not currently connected with a stranger.',
        });
        return;
      }

      const content = (payload?.content || '').trim();
      if (!content) return;

      if (content.length > MAX_MESSAGE_LENGTH) {
        socket.emit(ServerEvents.ERROR, {
          code: ErrorCode.INVALID_MESSAGE,
          message: `Message exceeds limit of ${MAX_MESSAGE_LENGTH} characters.`,
        });
        return;
      }

      const partnerSocketId = matchmaker.getPartnerSocketId(socket.id);
      if (!partnerSocketId) return;

      const messagePayload = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        content,
        timestamp: new Date().toISOString(),
      };

      io.to(partnerSocketId).emit(ServerEvents.MESSAGE_RECEIVED, messagePayload);
    });

    // ── WEBRTC SIGNALING: OFFER ─────────────────────────────────────────────
    socket.on(ClientEvents.WEBRTC_OFFER, (payload: WebRTCOfferPayload) => {
      const match = matchmaker.getMatchBySocket(socket.id) || matchmaker.getMatchBySession(socket.data.sessionId);
      if (!match) return;
      if (payload?.matchId && match.matchId !== payload.matchId) return;
      if (!payload?.sdp || typeof payload.sdp !== 'string') return;

      const partnerSocketId = matchmaker.getPartnerSocketId(socket.id) ||
        (match.user1.sessionId === socket.data.sessionId ? match.user2.socketId : match.user1.socketId);
      if (partnerSocketId) {
        io.to(partnerSocketId).emit(ServerEvents.WEBRTC_OFFER, payload);
      }
    });

    // ── WEBRTC SIGNALING: ANSWER ────────────────────────────────────────────
    socket.on(ClientEvents.WEBRTC_ANSWER, (payload: WebRTCAnswerPayload) => {
      const match = matchmaker.getMatchBySocket(socket.id) || matchmaker.getMatchBySession(socket.data.sessionId);
      if (!match) return;
      if (payload?.matchId && match.matchId !== payload.matchId) return;
      if (!payload?.sdp || typeof payload.sdp !== 'string') return;

      const partnerSocketId = matchmaker.getPartnerSocketId(socket.id) ||
        (match.user1.sessionId === socket.data.sessionId ? match.user2.socketId : match.user1.socketId);
      if (partnerSocketId) {
        io.to(partnerSocketId).emit(ServerEvents.WEBRTC_ANSWER, payload);
      }
    });

    // ── WEBRTC SIGNALING: ICE CANDIDATE ─────────────────────────────────────
    socket.on(ClientEvents.ICE_CANDIDATE, (payload: ICECandidatePayload) => {
      const match = matchmaker.getMatchBySocket(socket.id) || matchmaker.getMatchBySession(socket.data.sessionId);
      if (!match) return;
      if (payload?.matchId && match.matchId !== payload.matchId) return;
      if (!payload?.candidate || typeof payload.candidate !== 'string') return;

      const partnerSocketId = matchmaker.getPartnerSocketId(socket.id) ||
        (match.user1.sessionId === socket.data.sessionId ? match.user2.socketId : match.user1.socketId);
      if (partnerSocketId) {
        io.to(partnerSocketId).emit(ServerEvents.ICE_CANDIDATE, payload);
      }
    });

    // ── NEXT ────────────────────────────────────────────────────────────────
    socket.on(ClientEvents.NEXT, () => {
      const partnerSocketId = matchmaker.getPartnerSocketId(socket.id);
      const match = matchmaker.getMatchBySocket(socket.id);

      if (match) {
        matchmaker.endMatch(match.matchId, 'next_stranger');
      }

      if (partnerSocketId) {
        io.to(partnerSocketId).emit(ServerEvents.MATCH_ENDED, {
          reason: MatchEndReason.PARTNER_LEFT,
        });
      }
    });

    // ── STOP ────────────────────────────────────────────────────────────────
    socket.on(ClientEvents.STOP, () => {
      const activeSessionId = socket.data.sessionId as string;
      matchmaker.leaveQueue(activeSessionId);
      const partnerSocketId = matchmaker.getPartnerSocketId(socket.id);
      const match = matchmaker.getMatchBySocket(socket.id);

      if (match) {
        matchmaker.endMatch(match.matchId, 'user_stop');
      }

      if (partnerSocketId) {
        io.to(partnerSocketId).emit(ServerEvents.MATCH_ENDED, {
          reason: MatchEndReason.USER_STOP,
        });
      }
    });

    // ── REPORT USER ─────────────────────────────────────────────────────────
    socket.on(ClientEvents.REPORT_USER, async (payload: ReportPayload) => {
      const activeSessionId = socket.data.sessionId as string;
      const partnerSocketId = matchmaker.getPartnerSocketId(socket.id);
      const match = matchmaker.getMatchBySocket(socket.id);
      const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      logger.warn(`Session ${activeSessionId} reported partner socket ${partnerSocketId}`, {
        reportId,
        reason: payload?.reason,
        description: payload?.description,
      });

      try {
        await sessionStore.saveReport({
          reportId,
          reporterSessionId: activeSessionId,
          reportedUserId: partnerSocketId || null,
          matchId: match?.matchId || null,
          reason: payload?.reason || 'other',
          description: payload?.description ? String(payload.description).slice(0, 500) : '',
          createdAt: Date.now(),
          status: 'pending',
        });
      } catch (err) {
        logger.error('Failed to persist user report from socket:', {
          error: err instanceof Error ? err.message : String(err),
          reportId,
        });
      }

      if (match) {
        matchmaker.endMatch(match.matchId, 'reported');
      }

      if (partnerSocketId) {
        io.to(partnerSocketId).emit(ServerEvents.MATCH_ENDED, {
          reason: MatchEndReason.REPORTED,
        });
      }
    });

    // ── REAL-TIME HAIR DETECTION EVENT ──────────────────────────────────────
    socket.on(ClientEvents.HAIR_DETECTION_RESULT, async (payload: HairDetectionPayload) => {
      try {
        const sid = socket.data.sessionId as string;
        await hairDetectionService.processDetectionEvent(sid, payload, socket.data.userId);
      } catch (err) {
        logger.error('Error processing hair detection event from socket:', {
          error: err instanceof Error ? err.message : String(err),
          sessionId: socket.data.sessionId,
        });
      }
    });

    // ── DISCONNECT ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const sid = socket.data.sessionId as string;
      logger.info(`Socket disconnected: ${socket.id} (Session: ${sid})`);
      hairDetectionService.onSessionDisconnected(sid);

      const cleanup = matchmaker.onSocketDisconnected(socket.id, (_expiredMatch, expiredPartnerSocketId) => {
        // Callback fired if 15s grace period expires without user reconnecting
        if (expiredPartnerSocketId) {
          io.to(expiredPartnerSocketId).emit(ServerEvents.PARTNER_DISCONNECTED, {});
          io.to(expiredPartnerSocketId).emit(ServerEvents.MATCH_ENDED, {
            reason: MatchEndReason.PARTNER_DISCONNECTED,
          });
        }
      });

      // If in active match, notify partner of temporary connection drop
      if (cleanup.matchPaused && cleanup.partnerSocketId) {
        io.to(cleanup.partnerSocketId).emit('peer_reconnecting', {
          graceSeconds: cleanup.graceSeconds,
        });
      }

      broadcastOnlineCount();
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return ioInstance;
}
