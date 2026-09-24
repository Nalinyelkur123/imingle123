// ============================================================================
// V Mingle — Mock Detection Destination Server
// ============================================================================
// Lightweight HTTP server for local testing. Listens at
// http://<DETECTION_DESTINATION_IP>:<DETECTION_DESTINATION_PORT>/api/hair-detection
// and logs incoming detection payloads to stdout so you can easily verify
// that events from User 1, User 2, etc. are delivered with the correct
// session_id and user_id.
// ============================================================================

import http from 'http';
import { env } from '../config/env.js';

export function startMockDestinationServer(
  port = env.DETECTION_DESTINATION_PORT || 8080,
  host = '0.0.0.0'
): http.Server {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/hair-detection') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const now = new Date().toISOString();
          console.log('\n============================================================');
          console.log(`🎯 [DESTINATION_IP_RECEIVER] EVENT RECEIVED AT ${now}`);
          console.log(`   Session ID:         ${payload.session_id}`);
          console.log(`   User ID:            ${payload.user_id}`);
          console.log(`   Long Hair Detected: ${payload.long_hair_detected}`);
          console.log(`   Confidence:         ${payload.confidence}`);
          console.log(`   Client Timestamp:   ${payload.timestamp}`);
          console.log('============================================================\n');

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'received', acknowledged: true, receivedAt: now }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        }
      });
    } else if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', receiver: 'mock-destination' }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }
  });

  server.listen(port, host, () => {
    console.log(`\n📡 Mock Destination Receiver listening on http://${host}:${port}/api/hair-detection`);
  });

  return server;
}

// Standalone execution check
const isMain = process.argv[1]?.includes('mock-destination-server');
if (isMain) {
  startMockDestinationServer();
}
