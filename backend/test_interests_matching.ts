// ============================================================================
// Comprehensive Interest-Based Matchmaking System Test Suite
// ============================================================================

import express from 'express';
import { createServer } from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { initSocketService } from './src/services/socket.service.js';
import { matchmaker, normalizeInterests } from './src/services/matchmaker.service.js';
import { sessionService } from './src/services/session.service.js';
import sessionRoutes from './src/routes/session.routes.js';
import { ClientEvents, ServerEvents } from './src/services/shared-types.js';

const TEST_PORT = 4005;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;

function createClient(): Promise<{ socket: ClientSocket; sessionData: any }> {
  return new Promise(async (resolve, reject) => {
    let sessionData: any = null;
    try {
      const res = await fetch(`${SERVER_URL}/api/session/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runTestSuite() {
  console.log('--- Starting Interest-Based Matchmaking Verification Suite ---');

  const app = express();
  app.use(express.json());
  app.use(sessionRoutes);

  const httpServer = createServer(app);
  await sessionService.init();
  initSocketService(httpServer);

  await new Promise<void>((resolve) => httpServer.listen(TEST_PORT, () => resolve()));
  console.log(`Test server active on port ${TEST_PORT}`);

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`, err);
      failed++;
    }
  }

  // Set default window
  matchmaker.setInterestSearchWindowMs(3000);

  // ── TEST 1: Tag Normalization & Sanitization ───────────────────────────────
  await test('Tag Normalization & Sanitization', async () => {
    const raw = ['#Gaming', '  GAMING  ', '#coding', 'anime!', 'super-long-tag-that-has-way-too-many-characters-and-exceeds-thirty-chars'];
    const normalized = normalizeInterests(raw);

    if (!normalized.includes('gaming')) throw new Error('Failed to lowercase and strip # from #Gaming');
    if (normalized.filter((t) => t === 'gaming').length !== 1) throw new Error('Failed to deduplicate identical tags');
    if (!normalized.includes('coding')) throw new Error('Failed to normalize #coding');
    if (!normalized.includes('anime')) throw new Error('Failed to strip punctuation from anime!');

    const longTag = normalized.find((t) => t.startsWith('super-long'));
    if (!longTag || longTag.length > 30) throw new Error('Failed to cap tag length to 30 characters');
  });

  // ── TEST 2: Priority Match on Shared Interest (#Gaming vs gaming) ──────────
  await test('Case and Hashtag Invariant Matching (#Gaming vs gaming)', async () => {
    const client1 = await createClient();
    const client2 = await createClient();

    // Client 1 joins with '#Gaming'
    client1.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: ['#Gaming'] });
    await sleep(50);

    // Client 2 joins with 'gaming'
    const p1 = waitForEvent(client1.socket, ServerEvents.MATCH_FOUND);
    const p2 = waitForEvent(client2.socket, ServerEvents.MATCH_FOUND);
    client2.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: ['gaming'] });

    const [match1, match2] = await Promise.all([p1, p2]);
    if (match1.sharedInterest !== 'gaming') throw new Error(`Expected sharedInterest 'gaming', got '${match1.sharedInterest}'`);
    if (match2.sharedInterest !== 'gaming') throw new Error(`Expected sharedInterest 'gaming', got '${match2.sharedInterest}'`);

    client1.socket.disconnect();
    client2.socket.disconnect();
    await sleep(50);
  });

  // ── TEST 3: Multi-Interest Overlap Scoring Prioritization ──────────────────
  await test('Higher Overlap Scoring Prioritization (2 shared > 1 shared)', async () => {
    matchmaker.setInterestSearchWindowMs(3000);

    const clientA = await createClient(); // has ['music']
    const clientB = await createClient(); // has ['gaming', 'coding']
    const clientC = await createClient(); // has ['gaming', 'coding', 'music']

    // Queue A with ['music']
    clientA.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: ['music'] });
    await sleep(50);

    // Queue B with ['gaming', 'coding'] - distinct interests from A, so neither pairs yet
    clientB.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: ['gaming', 'coding'] });
    await sleep(50);

    // Client C joins with ['gaming', 'coding', 'music'].
    // Shares 1 with A, 2 with B.
    // Client C MUST be paired with Client B (score 2 beats score 1).
    const pB = waitForEvent(clientB.socket, ServerEvents.MATCH_FOUND);
    const pC = waitForEvent(clientC.socket, ServerEvents.MATCH_FOUND);

    clientC.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: ['gaming', 'coding', 'music'] });

    const [matchB, matchC] = await Promise.all([pB, pC]);

    if (matchC.partnerId !== clientB.socket.id) {
      throw new Error(`Expected C to match with B (score 2), but matched with ${matchC.partnerId}`);
    }
    if (matchB.sharedInterests?.length !== 2) {
      throw new Error(`Expected 2 shared interests, got ${matchB.sharedInterests?.length}`);
    }

    clientA.socket.disconnect();
    clientB.socket.disconnect();
    clientC.socket.disconnect();
    await sleep(50);
  });

  // ── TEST 4: Random Fallback Without False Interest Claims ───────────────────
  await test('Random Fallback when no shared interests without false claims', async () => {
    // Pure random users (no interests) match immediately
    const client1 = await createClient();
    const client2 = await createClient();

    client1.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: [] });
    await sleep(50);

    const p1 = waitForEvent(client1.socket, ServerEvents.MATCH_FOUND);
    const p2 = waitForEvent(client2.socket, ServerEvents.MATCH_FOUND);

    client2.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: [] });

    const [match1, match2] = await Promise.all([p1, p2]);

    if (match1.sharedInterest !== null) {
      throw new Error(`Expected sharedInterest null for random fallback, got '${match1.sharedInterest}'`);
    }
    if (match2.sharedInterest !== null) {
      throw new Error(`Expected sharedInterest null for random fallback, got '${match2.sharedInterest}'`);
    }

    client1.socket.disconnect();
    client2.socket.disconnect();
    await sleep(50);
  });

  // ── TEST 5: Dynamic Queue Interest Update ──────────────────────────────────
  await test('Dynamic Queue Interest Update While Searching', async () => {
    matchmaker.setInterestSearchWindowMs(3000);

    const client1 = await createClient();
    const client2 = await createClient();

    // Client 1 searching with ['sports']
    client1.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: ['sports'] });
    await sleep(50);

    // Client 2 searching with ['anime']
    client2.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: ['anime'] });
    await sleep(50);

    // Neither matches initially.
    // Client 1 dynamically updates interest to ['anime'].
    const p1 = waitForEvent(client1.socket, ServerEvents.MATCH_FOUND);
    const p2 = waitForEvent(client2.socket, ServerEvents.MATCH_FOUND);

    client1.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: ['anime'] });

    const [match1, match2] = await Promise.all([p1, p2]);
    if (match1.sharedInterest !== 'anime') throw new Error(`Expected match on 'anime', got '${match1.sharedInterest}'`);
    if (match2.sharedInterest !== 'anime') throw new Error(`Expected match on 'anime', got '${match2.sharedInterest}'`);

    client1.socket.disconnect();
    client2.socket.disconnect();
    await sleep(50);
  });

  // ── TEST 6: Rematch (Next) Avoids Immediate Previous Partner ────────────────
  await test('Rematch (Next) avoids immediate previous partner when alternative exists', async () => {
    const client1 = await createClient();
    const client2 = await createClient();
    const client3 = await createClient();

    // 1. Client 1 and Client 2 match on 'tech'
    const p1 = waitForEvent(client1.socket, ServerEvents.MATCH_FOUND);
    const p2 = waitForEvent(client2.socket, ServerEvents.MATCH_FOUND);
    client1.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: ['tech'] });
    await sleep(50);
    client2.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: ['tech'] });
    await Promise.all([p1, p2]);

    // 2. Client 3 queues with 'tech' (waiting in queue)
    client3.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: ['tech'] });
    await sleep(50);

    // 3. Client 1 skips (Next)
    client1.socket.emit(ClientEvents.NEXT);
    await sleep(50);

    // Client 1 searches again. Client 3 and Client 2 exist.
    // Client 1 MUST pair with Client 3 (not Client 2 who was the immediate last partner).
    const pNext1 = waitForEvent(client1.socket, ServerEvents.MATCH_FOUND);
    client1.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'video', interests: ['tech'] });

    const matchNext1 = await pNext1;
    if (matchNext1.partnerId !== client3.socket.id) {
      throw new Error(`Expected Client 1 to match with Client 3, but matched with ${matchNext1.partnerId}`);
    }

    client1.socket.disconnect();
    client2.socket.disconnect();
    client3.socket.disconnect();
    await sleep(50);
  });

  console.log(`\n========================================`);
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  httpServer.close();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});
