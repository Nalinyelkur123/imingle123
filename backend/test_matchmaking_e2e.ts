// ============================================================================
// Comprehensive End-to-End Matchmaking & Session Verification Test
// ============================================================================

import express from 'express';
import { createServer } from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { initSocketService } from './src/services/socket.service.js';
import { sessionService } from './src/services/session.service.js';
import { matchmaker } from './src/services/matchmaker.service.js';
import sessionRoutes from './src/routes/session.routes.js';
import { ClientEvents, ServerEvents, MatchEndReason } from './src/services/shared-types.js';

const TEST_PORT = 3999;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;

function createClient(token?: string): Promise<{ socket: ClientSocket; sessionData: any }> {
  return new Promise(async (resolve, reject) => {
    let sessionData: any = null;
    try {
      const res = await fetch(`${SERVER_URL}/api/session/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ mode: 'video' }),
      });
      const json = await res.json();
      sessionData = json.session || json.data;
    } catch (err) {
      return reject(err);
    }

    const socket = ioClient(SERVER_URL, {
      transports: ['websocket'],
      auth: { sessionToken: sessionData.token },
    });

    socket.on('connect', () => {
      resolve({ socket, sessionData });
    });

    socket.on('connect_error', (err) => {
      reject(err);
    });
  });
}

function waitForEvent<T = any>(socket: ClientSocket, event: string, timeoutMs = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout waiting for event "${event}" after ${timeoutMs}ms`));
    }, timeoutMs);

    const handler = (payload: T) => {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };

    socket.on(event, handler);
  });
}

async function runTests() {
  console.log('=== STARTING FULL END-TO-END MATCHMAKING VERIFICATION ===\n');

  // 1. Initialize Test Server
  const app = express();
  app.use(express.json());
  app.use(sessionRoutes);

  const httpServer = createServer(app);
  await sessionService.init();
  const ioServer = initSocketService(httpServer);

  await new Promise<void>((resolve) => httpServer.listen(TEST_PORT, resolve));
  console.log(`[SETUP] Test server running on port ${TEST_PORT}`);

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Session Tab Isolation & No Shared Identity
    // ------------------------------------------------------------------------
    console.log('\n[TEST 1] Verifying Session Tab Isolation...');
    const user1 = await createClient();
    const user2 = await createClient();

    if (user1.sessionData.sessionId === user2.sessionData.sessionId) {
      throw new Error('FAIL: user1 and user2 received the same sessionId!');
    }
    console.log(`✓ User 1 Session: ${user1.sessionData.sessionId}`);
    console.log(`✓ User 2 Session: ${user2.sessionData.sessionId}`);
    console.log('✓ SUCCESS: Two tabs receive distinct, tab-isolated session identities.');

    // ------------------------------------------------------------------------
    // TEST 2: Start & Matchmaking Flow (User 1 joins queue, User 2 matches)
    // ------------------------------------------------------------------------
    console.log('\n[TEST 2] Verifying Start & Match Formation Flow...');
    user1.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: [] });
    console.log('✓ User 1 joined waiting queue (finding stranger...)');

    // Give 50ms for user1 to enter queue
    await new Promise((r) => setTimeout(r, 50));

    const matchPromise1 = waitForEvent(user1.socket, ServerEvents.MATCH_FOUND);
    const matchPromise2 = waitForEvent(user2.socket, ServerEvents.MATCH_FOUND);

    user2.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: [] });
    console.log('✓ User 2 joined queue (matching...)');

    const [match1, match2] = await Promise.all([matchPromise1, matchPromise2]);

    if (match1.matchId !== match2.matchId) {
      throw new Error(`FAIL: Match IDs do not match! ${match1.matchId} vs ${match2.matchId}`);
    }
    if (match1.partnerId !== user2.socket.id || match2.partnerId !== user1.socket.id) {
      throw new Error('FAIL: Partner IDs do not match socket IDs!');
    }
    console.log(`✓ Both users matched! MatchId: ${match1.matchId}`);
    console.log('✓ SUCCESS: Match correctly formed between eligible strangers.');

    // ------------------------------------------------------------------------
    // TEST 3: Real-Time Chat Messaging Between Matched Strangers
    // ------------------------------------------------------------------------
    console.log('\n[TEST 3] Verifying Chat Messaging Between Strangers...');
    const messagePromise = waitForEvent(user2.socket, ServerEvents.MESSAGE_RECEIVED);

    user1.socket.emit(ClientEvents.SEND_MESSAGE, { content: 'Hello stranger from same network!' });

    const received = await messagePromise;
    if (received.content !== 'Hello stranger from same network!') {
      throw new Error(`FAIL: Incorrect message content: ${received.content}`);
    }
    console.log(`✓ User 2 received message: "${received.content}"`);
    console.log('✓ SUCCESS: Real-time messaging works between matched strangers.');

    // ------------------------------------------------------------------------
    // TEST 4: Skip / Next Flow (User 1 skips -> User 2 notified -> User 3 matches)
    // ------------------------------------------------------------------------
    console.log('\n[TEST 4] Verifying Skip / Next Stranger Flow...');
    const user3 = await createClient();

    // User 3 is waiting in queue
    user3.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: [] });
    await new Promise((r) => setTimeout(r, 50));

    const user2LeftPromise = waitForEvent(user2.socket, ServerEvents.MATCH_ENDED);
    const user1NewMatchPromise = waitForEvent(user1.socket, ServerEvents.MATCH_FOUND);
    const user3MatchPromise = waitForEvent(user3.socket, ServerEvents.MATCH_FOUND);

    // User 1 clicks Next -> emits NEXT, then JOIN_QUEUE
    user1.socket.emit(ClientEvents.NEXT);
    user1.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: [] });

    const [user2Left, matchUser1New, matchUser3] = await Promise.all([
      user2LeftPromise,
      user1NewMatchPromise,
      user3MatchPromise,
    ]);

    if (user2Left.reason !== MatchEndReason.PARTNER_LEFT) {
      throw new Error(`FAIL: Expected reason PARTNER_LEFT, got ${user2Left.reason}`);
    }
    if (matchUser1New.matchId !== matchUser3.matchId) {
      throw new Error('FAIL: User 1 did not match with User 3!');
    }
    console.log(`✓ User 2 was notified of stranger leaving (${user2Left.reason})`);
    console.log(`✓ User 1 and User 3 matched! MatchId: ${matchUser1New.matchId}`);
    console.log('✓ SUCCESS: Skip/Next ends old match cleanly and finds a new stranger.');

    // ------------------------------------------------------------------------
    // TEST 5: Rapid Start & Rapid Skip Guard
    // ------------------------------------------------------------------------
    console.log('\n[TEST 5] Verifying Rapid Start / Skip Duplication Guard...');
    // Rapidly emitting JOIN_QUEUE 5 times should result in only 1 active queue entry
    user2.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: [] });
    user2.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: [] });
    user2.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: [] });
    user2.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: [] });
    user2.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: [] });

    await new Promise((r) => setTimeout(r, 100));
    const stats = matchmaker.getStats();
    if (stats.videoQueueCount > 1) {
      throw new Error(`FAIL: Video queue count is ${stats.videoQueueCount}, expected 1.`);
    }
    console.log(`✓ Queue count after 5 rapid starts: ${stats.videoQueueCount}`);
    console.log('✓ SUCCESS: Rapid start does not create duplicate queue entries.');

    // ------------------------------------------------------------------------
    // TEST 6: Multiple Concurrent Strangers (A, B, C, D) Matching Correctly
    // ------------------------------------------------------------------------
    console.log('\n[TEST 6] Verifying Concurrent Multi-User Matchmaking...');
    user1.socket.disconnect();
    user2.socket.disconnect();
    user3.socket.disconnect();
    await new Promise((r) => setTimeout(r, 100));

    const clientA = await createClient();
    const clientB = await createClient();
    const clientC = await createClient();
    const clientD = await createClient();

    const matchesPromise = Promise.all([
      waitForEvent(clientA.socket, ServerEvents.MATCH_FOUND),
      waitForEvent(clientB.socket, ServerEvents.MATCH_FOUND),
      waitForEvent(clientC.socket, ServerEvents.MATCH_FOUND),
      waitForEvent(clientD.socket, ServerEvents.MATCH_FOUND),
    ]);

    clientA.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video' });
    clientB.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video' });
    clientC.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video' });
    clientD.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video' });

    const allMatches = await matchesPromise;
    const matchIds = new Set(allMatches.map((m) => m.matchId));
    if (matchIds.size !== 2) {
      throw new Error(`FAIL: Expected 2 unique matches among 4 users, got ${matchIds.size}`);
    }
    console.log(`✓ 4 concurrent users formed exactly 2 distinct matches: ${Array.from(matchIds).join(', ')}`);
    console.log('✓ SUCCESS: Concurrent matchmaking allocates each user to exactly one match without race conditions.');

    // ------------------------------------------------------------------------
    // TEST 7: Partner Disconnect & Cleanup
    // ------------------------------------------------------------------------
    console.log('\n[TEST 7] Verifying Partner Disconnect Grace & Expiration Handling...');
    const matchA = matchmaker.getMatchBySocket(clientA.socket.id);
    if (!matchA) throw new Error('FAIL: clientA not in match');

    const partnerSocketId = clientA.socket.id === matchA.user1.socketId ? matchA.user2.socketId : matchA.user1.socketId;
    const partnerClient = [clientB, clientC, clientD].find((c) => c.socket.id === partnerSocketId)!;

    // Disconnect partner
    const peerReconnectingPromise = waitForEvent(clientA.socket, 'peer_reconnecting');
    partnerClient.socket.disconnect();

    const reconnectingPayload = await peerReconnectingPromise;
    console.log(`✓ Client A received peer_reconnecting with graceSeconds: ${reconnectingPayload.graceSeconds}`);
    console.log('✓ SUCCESS: Disconnect grace period starts and notifies partner.');

    // ------------------------------------------------------------------------
    // TEST 8: Reconnection within Grace Period
    // ------------------------------------------------------------------------
    console.log('\n[TEST 8] Verifying Reconnection to Active Match...');
    const reconnectedSocket = ioClient(SERVER_URL, {
      transports: ['websocket'],
      auth: { sessionToken: partnerClient.sessionData.token },
    });

    const clientAReconnectedPromise = waitForEvent(clientA.socket, 'peer_reconnected');
    const partnerResumedPromise = waitForEvent(reconnectedSocket, 'match_reconnected');

    const [cAEvent, pResumed] = await Promise.all([clientAReconnectedPromise, partnerResumedPromise]);
    if (pResumed.matchId !== matchA.matchId) {
      throw new Error(`FAIL: Resumed match ID mismatch: ${pResumed.matchId} vs ${matchA.matchId}`);
    }
    console.log(`✓ Partner resumed match ${pResumed.matchId}!`);
    console.log(`✓ Client A received peer_reconnected notification.`);
    console.log('✓ SUCCESS: Seamless reconnection restores active match state.');

    // Cleanup remaining test sockets
    clientA.socket.disconnect();
    reconnectedSocket.disconnect();
    clientB.socket.disconnect();
    clientC.socket.disconnect();
    clientD.socket.disconnect();

    console.log('\n=======================================================');
    console.log('🎉 ALL END-TO-END MATCHMAKING TESTS PASSED SUCCESSFULLY!');
    console.log('=======================================================');
  } finally {
    ioServer.close();
    httpServer.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED WITH ERROR:', err);
  process.exit(1);
});
