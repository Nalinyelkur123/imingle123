import puppeteer from 'puppeteer-core';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FRONTEND_URL = 'http://localhost:3000/text';

async function testRealBrowserTyping() {
  console.log('\n======================================================');
  console.log('Launching 2 Real Browser Sessions for Typing Indicator');
  console.log('======================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
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
    // Create two isolated incognito browser contexts
    const contextA = await browser.createBrowserContext();
    const contextB = await browser.createBrowserContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    pageA.on('console', (msg) => {
      console.log('  [Browser A]', msg.text());
    });
    pageB.on('console', (msg) => {
      console.log('  [Browser B]', msg.text());
    });

    pageA.on('pageerror', (err) => console.error('  [Browser A PageError]', err));
    pageB.on('pageerror', (err) => console.error('  [Browser B PageError]', err));

    console.log('Navigating Session A and Session B to', FRONTEND_URL);
    await Promise.all([
      pageA.goto(FRONTEND_URL, { waitUntil: 'networkidle2' }),
      pageB.goto(FRONTEND_URL, { waitUntil: 'networkidle2' }),
    ]);

    // Wait for matchmaking to pair both browser pages
    console.log('Waiting for both browser sessions to match...');
    try {
      await Promise.all([
        pageA.waitForFunction(() => document.body.innerText.includes('Say hi!'), { timeout: 15000 }),
        pageB.waitForFunction(() => document.body.innerText.includes('Say hi!'), { timeout: 15000 }),
      ]);
    } catch (e) {
      const textA = await pageA.evaluate(() => document.body.innerText.slice(0, 400));
      const textB = await pageB.evaluate(() => document.body.innerText.slice(0, 400));
      console.log('  Page A Text on timeout:\n', textA);
      console.log('  Page B Text on timeout:\n', textB);
      throw e;
    }
    assert(true, 'Both browser sessions paired into active chat');

    const matchInfoA = await pageA.evaluate(() => ({
      body: document.body.innerText.substring(0, 300),
      connected: !document.querySelector('input[aria-label="Message stranger"]')?.hasAttribute('disabled')
    }));
    const matchInfoB = await pageB.evaluate(() => ({
      body: document.body.innerText.substring(0, 300),
      connected: !document.querySelector('input[aria-label="Message stranger"]')?.hasAttribute('disabled')
    }));
    console.log('  Page A status:', JSON.stringify(matchInfoA));
    console.log('  Page B status:', JSON.stringify(matchInfoB));

    // 1. Session A starts typing into chat input
    const inputSelector = 'input[aria-label="Message stranger"]';
    await pageA.waitForSelector(inputSelector);
    await pageB.waitForSelector(inputSelector);

    console.log('Session A focusing and typing: "Hello from browser A"...');
    await pageA.focus(inputSelector);
    await pageA.type(inputSelector, 'Hello from browser A', { delay: 40 });

    // 2. Check Session B for "Stranger is typing"
    const typingVisibleInB = await pageB.waitForFunction(
      () => document.body.innerText.includes('Stranger is typing'),
      { timeout: 5000 }
    );
    assert(Boolean(typingVisibleInB), 'Session B displays "Stranger is typing" when Session A types');

    // 3. Wait for debounce timeout without typing in Session A -> indicator should disappear in Session B
    console.log('Waiting 2s for typing debounce inactivity in Session A...');
    await new Promise((r) => setTimeout(r, 2200));
    const typingHiddenInB = await pageB.evaluate(() => !document.body.innerText.includes('Stranger is typing'));
    assert(typingHiddenInB, 'Session B hides typing indicator after 1.5s debounce inactivity');

    // 4. Session A types more and sends message
    console.log('Session A sends message...');
    await pageA.type(inputSelector, ' - Sent!');
    await pageA.keyboard.press('Enter');

    // 5. Verify message received in Session B and typing indicator is absent
    await pageB.waitForFunction(() => document.body.innerText.includes('Hello from browser A - Sent!'), { timeout: 5000 });
    const typingStillHiddenInB = await pageB.evaluate(() => !document.body.innerText.includes('Stranger is typing'));
    assert(typingStillHiddenInB, 'Session B received message and typing indicator is completely cleared');

    // 6. Session B types back to Session A
    console.log('Session B typing back...');
    await pageB.focus(inputSelector);
    await pageB.type(inputSelector, 'Replying from browser B', { delay: 40 });
    const typingVisibleInA = await pageA.waitForFunction(
      () => document.body.innerText.includes('Stranger is typing'),
      { timeout: 5000 }
    );
    assert(Boolean(typingVisibleInA), 'Session A displays "Stranger is typing" when Session B types back');

    // 7. Session B presses Enter to send
    await pageB.keyboard.press('Enter');
    await pageA.waitForFunction(() => document.body.innerText.includes('Replying from browser B'), { timeout: 5000 });
    const typingHiddenInA = await pageA.evaluate(() => !document.body.innerText.includes('Stranger is typing'));
    assert(typingHiddenInA, 'Session A received message from Session B and typing indicator is cleared');

    await contextA.close();
    await contextB.close();
  } catch (err) {
    console.error('Browser testing failed:', err);
    failed++;
  } finally {
    await browser.close();
  }

  console.log('\n======================================================');
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

testRealBrowserTyping();
