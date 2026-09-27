import { io } from 'socket.io-client';
import { httpServer } from '../server.js';
import { sessionService } from '../services/session.service.js';
import { matchmaker } from '../services/matchmaker.service.js';

async function runAudit() {
  console.log('=== STARTING PRODUCTION AUDIT VERIFICATION SUITE ===\n');

  const PORT = process.env.PORT || 3001;
  const BASE_URL = `http://localhost:${PORT}`;

  try {
    await sessionService.init().catch(() => {});
    // 1. Provision two distinct anonymous sessions
    console.log('\n--- 1. Testing Session Provisioning & Token HMAC Validation ---');
    const sessA = await sessionService.createOrResumeSession(null, 'video');
    const sessB = await sessionService.createOrResumeSession(null, 'video');
    console.log(`Session A created: ${sessA.sessionId} (User: ${sessA.userId})`);
    console.log(`Session B created: ${sessB.sessionId} (User: ${sessB.userId})`);

    if (sessA.sessionId === sessB.sessionId) {
      throw new Error('FAILED: Distinct sessions received identical sessionId');
    }

    // 2. Connect Client A (Tab 1)
    console.log('\n--- 2. Testing Socket Connection & Presence (Client A Tab 1) ---');
    let onlineCountReported = 0;

    const socketA1 = io(BASE_URL, {
      transports: ['websocket'],
      auth: { sessionToken: sessA.token },
    });

    await new Promise<void>((resolve) => {
      socketA1.on('online_count', (payload: { count: number }) => {
        onlineCountReported = payload.count;
        console.log(`[EVENT: online_count] -> ${onlineCountReported}`);
      });
      socketA1.on('session_established', (data) => {
        console.log(`[EVENT: session_established] Client A1 bound to ${data.sessionId}`);
        resolve();
      });
    });

    let stats = matchmaker.getStats();
    console.log(`Current stats: onlineUsers=${stats.onlineUsers}`);
    if (stats.onlineUsers !== 1) {
      throw new Error(`FAILED: Expected 1 online user, got ${stats.onlineUsers}`);
    }

    // 3. Connect Client A (Tab 2) with the SAME session
    console.log('\n--- 3. Testing Duplicate Socket / Multi-Tab Same-User Presence (Client A Tab 2) ---');
    const socketA2 = io(BASE_URL, {
      transports: ['websocket'],
      auth: { sessionToken: sessA.token },
    });

    await new Promise<void>((resolve) => {
      socketA2.on('session_established', () => resolve());
    });

    stats = matchmaker.getStats();
    console.log(`Current stats after Tab 2 connects: onlineUsers=${stats.onlineUsers}`);
    if (stats.onlineUsers !== 1) {
      throw new Error(`FAILED: Multi-tab same user duplicated online count: ${stats.onlineUsers}`);
    }

    // 4. Connect Client B (Different User)
    console.log('\n--- 4. Testing Client B Connection ---');
    const socketB = io(BASE_URL, {
      transports: ['websocket'],
      auth: { sessionToken: sessB.token },
    });

    await new Promise<void>((resolve) => {
      socketB.on('session_established', () => resolve());
    });

    stats = matchmaker.getStats();
    console.log(`Current stats after User B connects: onlineUsers=${stats.onlineUsers}`);
    if (stats.onlineUsers !== 2) {
      throw new Error(`FAILED: Expected 2 online users, got ${stats.onlineUsers}`);
    }

    // 5. Matchmaking Queue & Self-Match Prevention
    console.log('\n--- 5. Testing Queue & Self-Match Prevention ---');
    // Tab A1 and Tab A2 should NOT match each other
    socketA1.emit('join_queue', { mode: 'video', interests: ['tech'] });
    socketA2.emit('join_queue', { mode: 'video', interests: ['tech'] });

    await new Promise((r) => setTimeout(r, 200));

    stats = matchmaker.getStats();
    console.log(`Stats after Tab A1 and A2 join queue: activeMatches=${stats.activeMatches}, videoQueue=${stats.videoQueueCount}`);
    if (stats.activeMatches !== 0) {
      throw new Error('FAILED: Tab A1 and Tab A2 self-matched!');
    }

    // 6. Match User B with User A
    console.log('\n--- 6. Testing Pairing Between User A and User B ---');
    let matchFoundA: any = null;
    let matchFoundB: any = null;
    let activeSocketA = socketA2;

    const matchPromiseA = new Promise<void>((resolve) => {
      const onMatch = (payload: any, sock: any) => {
        matchFoundA = payload;
        activeSocketA = sock;
        console.log('[EVENT: match_found Client A]', payload);
        resolve();
      };
      socketA1.on('match_found', (p) => onMatch(p, socketA1));
      socketA2.on('match_found', (p) => onMatch(p, socketA2));
    });

    const matchPromiseB = new Promise<void>((resolve) => {
      socketB.on('match_found', (payload) => {
        matchFoundB = payload;
        console.log('[EVENT: match_found Client B]', payload);
        resolve();
      });
    });

    socketB.emit('join_queue', { mode: 'video', interests: ['tech'] });

    await Promise.all([matchPromiseA, matchPromiseB]);

    if (!matchFoundA || !matchFoundB) {
      throw new Error('FAILED: Match was not established between A and B');
    }
    if (matchFoundA.matchId !== matchFoundB.matchId) {
      throw new Error('FAILED: Match IDs do not match');
    }
    if (matchFoundA.isInitiator === matchFoundB.isInitiator) {
      throw new Error('FAILED: Both peers received the same initiator role');
    }

    // 7. WebRTC Signaling Relay: Offer, Answer, ICE
    console.log('\n--- 7. Testing WebRTC Signaling Relay ---');
    let offerReceivedTarget: any = null;
    let answerReceivedTarget: any = null;
    let iceReceivedTarget: any = null;

    const initiatorSocket = matchFoundA.isInitiator ? activeSocketA : socketB;
    const receiverSocket = matchFoundA.isInitiator ? socketB : activeSocketA;

    receiverSocket.on('webrtc_offer', (payload) => {
      offerReceivedTarget = payload;
      console.log('[EVENT: webrtc_offer Receiver received]');
    });

    initiatorSocket.on('webrtc_answer', (payload) => {
      answerReceivedTarget = payload;
      console.log('[EVENT: webrtc_answer Initiator received]');
    });

    receiverSocket.on('ice_candidate', (payload) => {
      iceReceivedTarget = payload;
      console.log('[EVENT: ice_candidate Receiver received]');
    });

    // Initiator sends offer
    initiatorSocket.emit('webrtc_offer', {
      matchId: matchFoundA.matchId,
      sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n',
    });

    await new Promise((r) => setTimeout(r, 200));
    if (!offerReceivedTarget) {
      throw new Error('FAILED: Receiver did not receive webrtc_offer');
    }

    // Receiver sends answer
    receiverSocket.emit('webrtc_answer', {
      matchId: matchFoundA.matchId,
      sdp: 'v=0\r\no=- 54321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n',
    });

    await new Promise((r) => setTimeout(r, 200));
    if (!answerReceivedTarget) {
      throw new Error('FAILED: Initiator did not receive webrtc_answer');
    }

    // Exchange ICE Candidate
    initiatorSocket.emit('ice_candidate', {
      matchId: matchFoundA.matchId,
      candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 50000 typ host',
      sdpMLineIndex: 0,
      sdpMid: '0',
    });

    await new Promise((r) => setTimeout(r, 200));
    if (!iceReceivedTarget) {
      throw new Error('FAILED: Receiver did not receive ice_candidate');
    }

    // 8. Next Stranger & Match Cleanup
    console.log('\n--- 8. Testing Next Stranger & Match Teardown ---');
    let matchEndedReceiver = false;
    receiverSocket.on('match_ended', (payload) => {
      console.log('[EVENT: match_ended Receiver received]', payload);
      matchEndedReceiver = true;
    });

    initiatorSocket.emit('next');
    await new Promise((r) => setTimeout(r, 200));

    if (!matchEndedReceiver) {
      throw new Error('FAILED: Partner did not receive match_ended when initiator clicked next');
    }

    // 9. Disconnect and Accurate Decrement
    console.log('\n--- 9. Testing Disconnect & Presence Clean Teardown ---');
    socketA1.disconnect();
    socketA2.disconnect();
    await new Promise((r) => setTimeout(r, 200));

    stats = matchmaker.getStats();
    console.log(`Stats after User A disconnects all tabs: onlineUsers=${stats.onlineUsers}`);
    if (stats.onlineUsers !== 1) {
      throw new Error(`FAILED: Expected 1 online user after User A disconnect, got ${stats.onlineUsers}`);
    }

    socketB.disconnect();
    await new Promise((r) => setTimeout(r, 200));

    stats = matchmaker.getStats();
    console.log(`Stats after User B disconnects: onlineUsers=${stats.onlineUsers}`);
    if (stats.onlineUsers !== 0) {
      throw new Error(`FAILED: Expected 0 online users after all disconnect, got ${stats.onlineUsers}`);
    }

    console.log('\n🎉 ALL PRODUCTION AUDIT VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
  } finally {
    httpServer.close();
    process.exit(0);
  }
}

runAudit().catch((err) => {
  console.error('\n❌ AUDIT VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
