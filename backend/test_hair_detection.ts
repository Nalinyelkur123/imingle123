// ============================================================================
// Test Suite: Hair Detection Service & Circuit Breaker
// ============================================================================

import { hairDetectionService } from './src/services/hair-detection.service.js';
import { startMockDestinationServer } from './src/utils/mock-destination-server.js';
import { env } from './src/config/env.js';
import http from 'http';

async function runTests() {
  console.log('\n========================================');
  console.log('Running Hair Detection & Circuit Breaker Tests');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // Test 1: Disabled detection or no long hair detected
  // --------------------------------------------------------------------------
  console.log('\n--- Test 1: Hair not detected (or disabled) ---');
  hairDetectionService.resetCircuitBreaker();
  const res1 = await hairDetectionService.processDetectionEvent('sess_test_1', {
    session_id: 'sess_test_1',
    user_id: 'usr_test_1',
    long_hair_detected: false,
    confidence: 0.2,
    timestamp: new Date().toISOString(),
  });
  assert(res1.status === 'SUCCESS', 'Returns status SUCCESS when hair not detected');
  assert(!res1.error_message, 'No error message when detection skipped');

  // --------------------------------------------------------------------------
  // Test 2: Circuit breaker trips on unreachable destination
  // --------------------------------------------------------------------------
  console.log('\n--- Test 2: Destination unreachable trips circuit breaker ---');
  hairDetectionService.resetCircuitBreaker();
  
  // Use a port where nothing is listening (e.g. 59999)
  const deadPort = 59999;
  const startTime = Date.now();
  const res2 = await hairDetectionService.dispatchToDestination(
    {
      session_id: 'sess_test_circuit',
      user_id: 'usr_test_circuit',
      long_hair_detected: true,
      confidence: 0.95,
      timestamp: new Date().toISOString(),
    },
    startTime,
    {
      destinationHost: '127.0.0.1',
      destinationPort: deadPort,
      maxRetries: 0,
      timeoutMs: 500,
    }
  );

  assert(res2.status === 'FAILED', 'Initial call fails gracefully on unreachable port');
  assert(Boolean(res2.error_message), 'Contains error message detailing failure');

  // Next call should hit open circuit without making network calls
  const statsAfterTrip = hairDetectionService.getActiveStats();
  assert(statsAfterTrip.circuitOpen, 'Circuit breaker is now marked open');

  const probeTime = Date.now();
  const res3 = await hairDetectionService.dispatchToDestination(
    {
      session_id: 'sess_test_circuit_fast',
      user_id: 'usr_test_circuit_fast',
      long_hair_detected: true,
      confidence: 0.95,
      timestamp: new Date().toISOString(),
    },
    probeTime,
    {
      destinationHost: '127.0.0.1',
      destinationPort: deadPort,
    }
  );

  assert(res3.status === 'FAILED', 'Subsequent call returns FAILED via circuit breaker');
  assert(res3.error_message?.includes('Circuit open'), 'Subsequent call indicates circuit is open');
  assert(res3.processing_time_ms < 50, 'Circuit fast-fails in < 50ms without waiting for network timeout');

  // --------------------------------------------------------------------------
  // Test 3: Successful delivery with mock destination server
  // --------------------------------------------------------------------------
  console.log('\n--- Test 3: Successful delivery to mock receiver server ---');
  hairDetectionService.resetCircuitBreaker();
  const mockPort = 8181;
  const mockServer: http.Server = startMockDestinationServer(mockPort, '127.0.0.1');

  try {
    // Wait briefly for mock server to bind
    await new Promise((r) => setTimeout(r, 100));

    const res4 = await hairDetectionService.dispatchToDestination(
      {
        session_id: 'sess_test_mock',
        user_id: 'usr_test_mock',
        long_hair_detected: true,
        confidence: 0.98,
        timestamp: new Date().toISOString(),
      },
      Date.now(),
      {
        destinationHost: '127.0.0.1',
        destinationPort: mockPort,
      }
    );

    assert(res4.status === 'SUCCESS', 'Dispatches successfully to active mock server');
    assert(res4.destination_port === mockPort, 'Correct destination port reported in delivery result');

    const recentLogs = hairDetectionService.getRecentLogs();
    assert(recentLogs.length > 0, 'Delivery logged in recent deliveries history');
    assert(recentLogs[0].session_id === 'sess_test_mock', 'Logged event matches dispatched session ID');
  } finally {
    mockServer.close();
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n========================================');
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
