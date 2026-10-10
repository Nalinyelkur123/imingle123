// ============================================================================
// V Mingle — Real-Time Stranger Typing Indicator E2E Verification Suite
// ============================================================================
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createServer } from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { corsOptions } from './src/config/cors.js';
import { initSocketService } from './src/services/socket.service.js';
import { sessionService } from './src/services/session.service.js';
import routes from './src/routes/index.js';
import { ClientEvents, ServerEvents, TypingPayload } from './src/services/shared-types.js';

const TEST_PORT = 4991;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;

function createClient(): Promise<{ socket: ClientSocket; sessionData: any }> {
  return new Promise(async (resolve, reject) => {
    let sessionData: any = null;
    try {
      const res = await fetch(`${SERVER_URL}/api/session/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'text' }),
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

async function runTypingTests() {
  console.log('\n========================================');
  console.log('Running Real-Time Typing Indicator Tests');
  console.log('========================================\n');

  const app = express();
  const httpServer = createServer(app);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  app.use(express.json());
  app.use(routes);

  initSocketService(httpServer);
  await sessionService.init();

  await new Promise<void>((resolve) => {
    httpServer.listen(TEST_PORT, () => resolve());
  });

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  try {
    const userA = await createClient();
    const userB = await createClient();

    // 1. Join queue and establish match
    const matchPromise = new Promise<{ matchA: any; matchB: any }>((resolve) => {
      let mA: any = null;
      let mB: any = null;
      userA.socket.on(ServerEvents.MATCH_FOUND, (data) => {
        mA = data;
        if (mA && mB) resolve({ matchA: mA, matchB: mB });
      });
      userB.socket.on(ServerEvents.MATCH_FOUND, (data) => {
        mB = data;
        if (mA && mB) resolve({ matchA: mA, matchB: mB });
      });
    });

    userA.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'text', interests: [] });
    userB.socket.emit(ClientEvents.JOIN_QUEUE, { mode: 'text', interests: [] });

    await matchPromise;
    assert(true, 'User A and User B successfully matched in chat');

    // 2. User A starts typing -> User B receives typing_status true
    const userBReceivedTypingTrue = new Promise<boolean>((resolve) => {
      userB.socket.once(ServerEvents.TYPING_STATUS, (payload: TypingPayload) => {
        resolve(payload.isTyping === true);
      });
    });

    userA.socket.emit(ClientEvents.TYPING, { isTyping: true });
    const bGotTyping = await userBReceivedTypingTrue;
    assert(bGotTyping, 'User B receives typing_status: true when User A starts typing');

    // 3. User A stops typing -> User B receives typing_status false
    const userBReceivedTypingFalse = new Promise<boolean>((resolve) => {
      userB.socket.once(ServerEvents.TYPING_STATUS, (payload: TypingPayload) => {
        resolve(payload.isTyping === false);
      });
    });

    userA.socket.emit(ClientEvents.TYPING, { isTyping: false });
    const bGotTypingFalse = await userBReceivedTypingFalse;
    assert(bGotTypingFalse, 'User B receives typing_status: false when User A stops typing');

    // 4. User A starts typing, then sends a message -> User B receives typing_status false & message
    const userBMessageAndTypingReset = new Promise<{ gotMessage: boolean; typingReset: boolean }>((resolve) => {
      let gotMessage = false;
      let typingReset = false;

      const onTyping = (payload: TypingPayload) => {
        if (payload.isTyping === false) {
          typingReset = true;
          if (gotMessage && typingReset) {
            userB.socket.off(ServerEvents.TYPING_STATUS, onTyping);
            resolve({ gotMessage, typingReset });
          }
        }
      };
      userB.socket.on(ServerEvents.TYPING_STATUS, onTyping);

      userB.socket.once(ServerEvents.MESSAGE_RECEIVED, (payload) => {
        if (payload.content === 'Hello from User A') gotMessage = true;
        if (gotMessage && typingReset) {
          userB.socket.off(ServerEvents.TYPING_STATUS, onTyping);
          resolve({ gotMessage, typingReset });
        }
      });
    });

    userA.socket.emit(ClientEvents.TYPING, { isTyping: true });
    await new Promise((r) => setTimeout(r, 80));
    userA.socket.emit(ClientEvents.SEND_MESSAGE, { content: 'Hello from User A' });

    const resultMsg = await userBMessageAndTypingReset;
    assert(resultMsg.gotMessage && resultMsg.typingReset, 'Sending message automatically clears typing status and delivers message');

    // 5. User B types back -> User A receives typing_status true
    const userAReceivedTypingTrue = new Promise<boolean>((resolve) => {
      userA.socket.once(ServerEvents.TYPING_STATUS, (payload: TypingPayload) => {
        resolve(payload.isTyping === true);
      });
    });

    userB.socket.emit(ClientEvents.TYPING, { isTyping: true });
    const aGotTyping = await userAReceivedTypingTrue;
    assert(aGotTyping, 'User A receives typing_status: true when User B types back');

    // Cleanup sockets
    userA.socket.disconnect();
    userB.socket.disconnect();
  } catch (err) {
    console.error('Test error:', err);
    failed++;
  } finally {
    httpServer.close();
  }

  console.log('\n========================================');
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTypingTests();
