// ============================================================================
// V Mingle — Production CORS & Preflight Verification Suite
// ============================================================================
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createServer } from 'http';
import { io as ioClient } from 'socket.io-client';
import { corsOptions, isOriginAllowed } from './src/config/cors.js';
import { initSocketService } from './src/services/socket.service.js';
import { sessionService } from './src/services/session.service.js';
import routes from './src/routes/index.js';

const TEST_PORT = 4995;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;

async function runCorsTests() {
  console.log('\n========================================');
  console.log('Running Production CORS & Preflight Tests');
  console.log('========================================\n');

  // Setup test Express server with identical middleware as server.ts
  const app = express();
  const httpServer = createServer(app);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
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
    // 1. Test unit origin matcher
    assert(isOriginAllowed('https://vmingle.in'), 'isOriginAllowed matches https://vmingle.in');
    assert(isOriginAllowed('https://www.vmingle.in'), 'isOriginAllowed matches https://www.vmingle.in');
    assert(isOriginAllowed('https://sub.vmingle.in'), 'isOriginAllowed matches *.vmingle.in subdomain');
    assert(isOriginAllowed('https://imingle-backend.onrender.com'), 'isOriginAllowed matches *.onrender.com');
    assert(!isOriginAllowed('https://evil-site.com'), 'isOriginAllowed rejects untrusted origin');

    // 2. Test GET /api/stats with Origin: https://vmingle.in
    const statsRes = await fetch(`${SERVER_URL}/api/stats`, {
      method: 'GET',
      headers: {
        Origin: 'https://vmingle.in',
      },
    });
    assert(statsRes.status === 200, 'GET /api/stats returns 200 OK');
    assert(
      statsRes.headers.get('access-control-allow-origin') === 'https://vmingle.in',
      'GET /api/stats has Access-Control-Allow-Origin: https://vmingle.in'
    );
    assert(
      statsRes.headers.get('access-control-allow-credentials') === 'true',
      'GET /api/stats has Access-Control-Allow-Credentials: true'
    );
    assert(
      statsRes.headers.get('cross-origin-resource-policy') === 'cross-origin',
      'Helmet CORP is set to cross-origin'
    );

    // 3. Test Preflight OPTIONS /api/session/init with Origin: https://vmingle.in
    const preflightRes = await fetch(`${SERVER_URL}/api/session/init`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://vmingle.in',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization',
      },
    });
    assert(
      preflightRes.status === 200 || preflightRes.status === 204,
      `Preflight OPTIONS /api/session/init returns ${preflightRes.status}`
    );
    assert(
      preflightRes.headers.get('access-control-allow-origin') === 'https://vmingle.in',
      'Preflight returns Access-Control-Allow-Origin: https://vmingle.in'
    );

    // 4. Test Preflight OPTIONS /api/config/ice-servers with Origin: https://www.vmingle.in
    const icePreflightRes = await fetch(`${SERVER_URL}/api/config/ice-servers`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://www.vmingle.in',
        'Access-Control-Request-Method': 'GET',
      },
    });
    assert(
      icePreflightRes.status === 200 || icePreflightRes.status === 204,
      `Preflight OPTIONS /api/config/ice-servers returns ${icePreflightRes.status}`
    );
    assert(
      icePreflightRes.headers.get('access-control-allow-origin') === 'https://www.vmingle.in',
      'Preflight returns Access-Control-Allow-Origin: https://www.vmingle.in'
    );

    // 5. Test Unauthorized Origin does not get CORS header
    const evilRes = await fetch(`${SERVER_URL}/api/stats`, {
      method: 'GET',
      headers: {
        Origin: 'https://evil-attacker.com',
      },
    });
    assert(
      evilRes.headers.get('access-control-allow-origin') === null,
      'Untrusted origin does not receive Access-Control-Allow-Origin header'
    );

    // 6. Test Socket.IO connection with Origin https://vmingle.in
    const socketConnected = await new Promise<boolean>((resolve) => {
      const socket = ioClient(SERVER_URL, {
        extraHeaders: {
          Origin: 'https://vmingle.in',
        },
        transports: ['websocket'],
      });

      const timeout = setTimeout(() => {
        socket.disconnect();
        resolve(false);
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        socket.disconnect();
        resolve(true);
      });

      socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        console.error('Socket connect error:', err.message);
        socket.disconnect();
        resolve(false);
      });
    });

    assert(socketConnected, 'Socket.IO handshake succeeds from origin https://vmingle.in without 400 error');
  } catch (err) {
    console.error('Test execution failed:', err);
    failed++;
  } finally {
    httpServer.close();
  }

  console.log('\n========================================');
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCorsTests();
