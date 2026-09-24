// ============================================================================
// Real-Time Long-Hair Detection Test Suite
// ============================================================================
// Tests:
// 1. Automatic user_id <-> session_id mapping for multiple independent users.
// 2. Canonical payload formatting (session_id, user_id, long_hair_detected, confidence, timestamp).
// 3. HTTP dispatch to configured destination IP.
// 4. Retry policy and graceful failure handling when destination is down.
// 5. Session disconnect and cleanup.
// ============================================================================

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { sessionService } from '../session.service.js';
import { HairDetectionService } from '../hair-detection.service.js';

describe('Real-Time Long-Hair Detection Feature', () => {
  let mockServer: http.Server;
  let receivedEvents: any[] = [];
  const testPort = 9876;
  const testIp = '127.0.0.1';

  before(async () => {
    await sessionService.init();

    // Start a mock destination server on port 9876 to verify HTTP event reception
    await new Promise<void>((resolve) => {
      mockServer = http.createServer((req, res) => {
        if (req.method === 'POST' && req.url === '/api/hair-detection') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            const parsed = JSON.parse(body);
            receivedEvents.push(parsed);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', received: true }));
          });
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      mockServer.listen(testPort, testIp, () => {
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      mockServer.close(() => resolve());
    });
  });

  test('1. Automatic independent user_id and session_id generation for User 1 and User 2', async () => {
    // User 1 connects
    const user1Session = await sessionService.createOrResumeSession(null, 'video');
    assert.ok(user1Session.sessionId.startsWith('sess_'), 'User 1 session ID should start with sess_');
    assert.ok(user1Session.userId.startsWith('usr_'), 'User 1 user ID should start with usr_');

    // User 2 connects independently
    const user2Session = await sessionService.createOrResumeSession(null, 'video');
    assert.ok(user2Session.sessionId.startsWith('sess_'), 'User 2 session ID should start with sess_');
    assert.ok(user2Session.userId.startsWith('usr_'), 'User 2 user ID should start with usr_');

    // Verify User 1 and User 2 have completely different session and user identities
    assert.notEqual(user1Session.sessionId, user2Session.sessionId, 'Session IDs must be unique');
    assert.notEqual(user1Session.userId, user2Session.userId, 'User IDs must be unique');
  });

  test('2. Successful delivery of detection event to configured destination IP', async () => {
    receivedEvents = [];
    const detectionService = new HairDetectionService();

    // User 1 triggers detection
    const user1Session = await sessionService.createOrResumeSession(null, 'video');

    const result = await detectionService.dispatchToDestination(
      {
        session_id: user1Session.sessionId,
        user_id: user1Session.userId,
        long_hair_detected: true,
        confidence: 0.93,
        timestamp: new Date().toISOString(),
      },
      Date.now(),
      {
        destinationIp: testIp,
        destinationPort: testPort,
        maxRetries: 1,
        timeoutMs: 2000,
        initialBackoffMs: 50,
      }
    );

    assert.equal(result.status, 'SUCCESS');
    assert.equal(result.long_hair_detected, true);
    assert.equal(result.confidence, 0.93);
    assert.equal(result.session_id, user1Session.sessionId);
    assert.equal(result.user_id, user1Session.userId);

    // Verify mock server received the event with identical session and user information
    assert.equal(receivedEvents.length, 1);
    assert.equal(receivedEvents[0].session_id, user1Session.sessionId);
    assert.equal(receivedEvents[0].user_id, user1Session.userId);
    assert.equal(receivedEvents[0].long_hair_detected, true);
  });

  test('3. Independent stream processing for User 2 without cross-contamination', async () => {
    receivedEvents = [];
    const detectionService = new HairDetectionService();

    const user2Session = await sessionService.createOrResumeSession(null, 'video');

    const result = await detectionService.processDetectionEvent(
      user2Session.sessionId,
      {
        long_hair_detected: false,
        confidence: 0.88,
      },
      user2Session.userId
    );

    // Event should reflect User 2's session and false detection
    assert.equal(result.session_id, user2Session.sessionId);
    assert.equal(result.user_id, user2Session.userId);
    assert.equal(result.long_hair_detected, false);
    assert.equal(result.confidence, 0.88);
  });

  test('4. Graceful failure handling and retries when destination IP is unreachable', async () => {
    const detectionService = new HairDetectionService();
    const unreachablePort = 59999; // Dead port

    const startTime = Date.now();
    const failedResult = await detectionService.dispatchToDestination(
      {
        session_id: 'sess_test_failure',
        user_id: 'usr_test_failure',
        long_hair_detected: true,
        confidence: 0.85,
        timestamp: new Date().toISOString(),
      },
      startTime,
      {
        destinationIp: '127.0.0.1',
        destinationPort: unreachablePort,
        maxRetries: 2,
        timeoutMs: 100,
        initialBackoffMs: 20,
      }
    );

    // Verify delivery status is marked FAILED without throwing error
    assert.equal(failedResult.status, 'FAILED');
    assert.ok(failedResult.error_message, 'Error message should be captured');
    assert.equal(failedResult.session_id, 'sess_test_failure');
    assert.equal(failedResult.user_id, 'usr_test_failure');
  });

  test('5. Session disconnect cleans up detection context', async () => {
    const detectionService = new HairDetectionService();
    const sessionId = 'sess_cleanup_test';

    await detectionService.processDetectionEvent(sessionId, {
      long_hair_detected: true,
      confidence: 0.9,
    });

    assert.equal(detectionService.getActiveStats().activeSessionsCount, 1);

    // Disconnect session
    detectionService.onSessionDisconnected(sessionId);
    assert.equal(detectionService.getActiveStats().activeSessionsCount, 0);
  });
});
