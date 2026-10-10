import { sessionService } from './src/services/session.service.js';
import { submitReport } from './src/controllers/report.controller.js';
import { matchmaker } from './src/services/matchmaker.service.js';

async function testReportSecurity() {
  console.log('=== TESTING REPORT CONTROLLER SECURITY ===');
  await sessionService.init();
  const session1 = await sessionService.createOrResumeSession(null, 'video');

  // Test 1: No token
  let resStatus = 0;
  let resBody: any = null;
  const mockRes = {
    status: (code: number) => { resStatus = code; return mockRes; },
    json: (body: any) => { resBody = body; }
  };
  await submitReport({ headers: {}, body: { reason: 'spam' } } as any, mockRes as any);
  console.log('Test 1 (No token): Status =', resStatus, resStatus === 401 ? '✓ PASS' : '❌ FAIL');
  if (resStatus !== 401) throw new Error('Test 1 failed');

  // Test 2: Invalid token
  await submitReport({ headers: { authorization: 'Bearer invalid.token.value' }, body: { reason: 'spam' } } as any, mockRes as any);
  console.log('Test 2 (Invalid token): Status =', resStatus, resStatus === 401 ? '✓ PASS' : '❌ FAIL');
  if (resStatus !== 401) throw new Error('Test 2 failed');

  // Test 3: Session mismatch
  await submitReport({
    headers: { authorization: 'Bearer ' + session1.token },
    body: { reason: 'spam', reporterSessionId: 'sess_fake12345678' }
  } as any, mockRes as any);
  console.log('Test 3 (Mismatched reporterSessionId): Status =', resStatus, resStatus === 401 ? '✓ PASS' : '❌ FAIL');
  if (resStatus !== 401) throw new Error('Test 3 failed');

  // Test 4: Match mismatch (match exists, but session1 not participant)
  matchmaker.onSocketConnected('sock_x', 'sess_other1', 'usr_other1');
  matchmaker.onSocketConnected('sock_y', 'sess_other2', 'usr_other2');
  matchmaker.joinQueue('sess_other1', 'sock_x', 'video', [], 'usr_other1', () => true);
  const matchResult2 = matchmaker.joinQueue('sess_other2', 'sock_y', 'video', [], 'usr_other2', () => true);
  const otherMatchId = matchResult2.match?.matchId;

  await submitReport({
    headers: { authorization: 'Bearer ' + session1.token },
    body: { reason: 'spam', matchId: otherMatchId }
  } as any, mockRes as any);
  console.log('Test 4 (Match not participant of): Status =', resStatus, resStatus === 403 ? '✓ PASS' : '❌ FAIL');
  if (resStatus !== 403) throw new Error('Test 4 failed');

  // Test 5: Valid report with token
  await submitReport({
    headers: { authorization: 'Bearer ' + session1.token },
    body: { reason: 'harassment', description: 'Testing report submission' }
  } as any, mockRes as any);
  console.log('Test 5 (Valid report with token): Status =', resStatus, resStatus === 201 ? '✓ PASS' : '❌ FAIL');
  if (resStatus !== 201) throw new Error('Test 5 failed');

  console.log('\n🎉 ALL REPORT SECURITY TESTS PASSED!\n');
}

testReportSecurity()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
