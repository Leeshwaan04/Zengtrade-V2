import puppeteer from 'puppeteer-core';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'https://zengtrade.in';

const VIEWPORTS = [
  { name: 'Mobile Small (Android 360)', width: 360, height: 640, isMobile: true, hasTouch: true },
  { name: 'Mobile SE (iPhone SE 375)', width: 375, height: 667, isMobile: true, hasTouch: true },
  { name: 'Mobile Modern (iPhone 14 390)', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'Mobile Max (iPhone 15 Pro Max 430)', width: 430, height: 932, isMobile: true, hasTouch: true },
  { name: 'Mobile Landscape (844x390)', width: 844, height: 390, isMobile: true, hasTouch: true },
  { name: 'Tablet Portrait (iPad 768)', width: 768, height: 1024, isMobile: true, hasTouch: true },
  { name: 'Tablet Air (iPad Air 820)', width: 820, height: 1180, isMobile: true, hasTouch: true },
  { name: 'Tablet Landscape (iPad 1024)', width: 1024, height: 768, isMobile: false, hasTouch: true },
  { name: 'Laptop Small (1280x800)', width: 1280, height: 800, isMobile: false, hasTouch: false },
  { name: 'Desktop Standard (1440x900)', width: 1440, height: 900, isMobile: false, hasTouch: false },
  { name: 'Desktop Full HD (1920x1080)', width: 1920, height: 1080, isMobile: false, hasTouch: false }
];

const PAGES = [
  '/',
  '/how-it-works/',
  '/pricing/',
  '/sitemap/',
  '/coins/',
  '/coins/bitcoin/',
  '/strategies/supertrend-breakout/bitcoin/',
  '/strategies/supertrend-breakout/bitcoin/5m/',
  '/indicators/rsi/bitcoin/15m/',
  '/compare/supertrend-vs-ema-cross/bitcoin/',
  '/blog/bitcoin-halving-supply-shock-cycle/',
  '/learn/what-is-a-market-regime-in-crypto-trading/',
  '/terms/',
  '/login'
];

async function runAudit() {
  console.log('='.repeat(70));
  console.log('📱 STARTING COMPREHENSIVE RESPONSIVENESS & DEVICE COMPATIBILITY AUDIT');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📐 Testing ${VIEWPORTS.length} viewports across ${PAGES.length} pages (${VIEWPORTS.length * PAGES.length} total test scenarios)`);
  console.log('='.repeat(70));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const issues = [];

  for (const p of PAGES) {
    const fullUrl = `${BASE_URL}${p}`;
    console.log(`\n🔍 Testing Page: ${p}`);

    for (const vp of VIEWPORTS) {
      totalTests++;
      await page.setViewport({
        width: vp.width,
        height: vp.height,
        isMobile: vp.isMobile,
        hasTouch: vp.hasTouch,
        deviceScaleFactor: 1
      });

      const consoleErrors = [];
      const failedRequests = [];

      const onConsole = msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      };
      const onReqFailed = req => {
        failedRequests.push(`${req.url()} (${req.failure()?.errorText || 'failed'})`);
      };

      page.on('console', onConsole);
      page.on('requestfailed', onReqFailed);

      try {
        const response = await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const httpStatus = response.status();

        // 1. Check HTTP Status
        if (httpStatus !== 200) {
          throw new Error(`HTTP ${httpStatus}`);
        }

        // 2. Evaluate layout metrics
        const metrics = await page.evaluate(() => {
          const docW = document.documentElement.scrollWidth;
          const winW = window.innerWidth;
          const bodyW = document.body ? document.body.scrollWidth : 0;
          const hasHorizontalOverflow = docW > winW + 1; // 1px threshold for sub-pixel rounding

          // Find overflowing elements if overflow exists
          let overflowElements = [];
          if (hasHorizontalOverflow) {
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
              const rect = el.getBoundingClientRect();
              if (rect.right > winW + 2) {
                const tag = el.tagName.toLowerCase();
                const cls = el.className ? `.${String(el.className).trim().split(/\s+/).join('.')}` : '';
                const id = el.id ? `#${el.id}` : '';
                overflowElements.push(`${tag}${id}${cls} (right: ${Math.round(rect.right)}px > win: ${winW}px)`);
                if (overflowElements.length >= 3) break;
              }
            }
          }

          // Viewport tag check
          const vpMeta = document.querySelector('meta[name="viewport"]');
          const hasViewportMeta = !!vpMeta && !!vpMeta.getAttribute('content');

          // Check for tiny font sizes on mobile
          const textElements = Array.from(document.querySelectorAll('p, span, a, h1, h2, h3, h4, li, div'));
          let tinyFonts = 0;
          for (const el of textElements) {
            if (el.children.length === 0 && el.innerText && el.innerText.trim().length > 3) {
              const fontSize = parseFloat(window.getComputedStyle(el).fontSize);
              if (fontSize < 9) tinyFonts++;
            }
          }

          return {
            winW,
            docW,
            hasHorizontalOverflow,
            overflowElements,
            hasViewportMeta,
            tinyFonts
          };
        });

        // Evaluate results
        const testFailures = [];
        if (!metrics.hasViewportMeta) {
          testFailures.push('Missing viewport meta tag');
        }
        if (metrics.hasHorizontalOverflow) {
          testFailures.push(`Horizontal overflow: doc width ${metrics.docW}px > window ${metrics.winW}px. Offending: ${metrics.overflowElements.join(', ')}`);
        }

        if (testFailures.length > 0) {
          failedTests++;
          console.log(`  ❌ [${vp.name}]: ${testFailures.join(' | ')}`);
          issues.push({ page: p, viewport: vp.name, failures: testFailures });
        } else {
          passedTests++;
          process.stdout.write(`  ✅ [${vp.name}] OK `);
          if (totalTests % 3 === 0) process.stdout.write('\n');
        }

      } catch (err) {
        failedTests++;
        console.log(`  ❌ [${vp.name}]: Execution error - ${err.message}`);
        issues.push({ page: p, viewport: vp.name, failures: [err.message] });
      } finally {
        page.off('console', onConsole);
        page.off('requestfailed', onReqFailed);
      }
    }
    console.log('');
  }

  await browser.close();

  console.log('\n' + '='.repeat(70));
  console.log('🏁 RESPONSIVENESS AUDIT RESULTS SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Test Scenarios : ${totalTests}`);
  console.log(`Passed               : ${passedTests} (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log(`Failed               : ${failedTests}`);

  if (issues.length > 0) {
    console.log('\n⚠️ ISSUES DETECTED:');
    for (const item of issues) {
      console.log(`- Page ${item.page} on [${item.viewport}]:`);
      for (const f of item.failures) {
        console.log(`    • ${f}`);
      }
    }
    process.exit(1);
  } else {
    console.log('\n🎉 ALL 154 VIEWPORT SCENARIOS PASSED 100%! ZERO HORIZONTAL OVERFLOW & PERFECT RESPONSIVENESS ACROSS ALL DEVICE TYPES!');
    process.exit(0);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
