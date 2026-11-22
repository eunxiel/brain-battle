/**
 * Responsive audit.
 *   npm run audit:responsive --workspace @brain-battle/web
 *
 * Drives a real Chromium against the dev server at every target viewport,
 * reports horizontal overflow / vertical clipping / undersized touch targets,
 * and writes screenshots to apps/web/.audit for visual review.
 *
 * Uses the browser already installed on the machine (Chrome or Edge) instead of
 * downloading one.
 */
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../.audit');
const BASE = process.env.AUDIT_URL ?? 'http://localhost:5173';

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

/** Comma separated filters for fast iteration, e.g. ONLY_VIEWPORTS=phone,tablet */
const ONLY_VIEWPORTS = process.env.ONLY_VIEWPORTS?.split(',').filter(Boolean) ?? null;
const ONLY_ROUTES = process.env.ONLY_ROUTES?.split(',').filter(Boolean) ?? null;
const SKIP_ARENA = process.env.SKIP_ARENA === '1';

const ALL_VIEWPORTS = [
  { name: 'phone-small', width: 320, height: 568, mobile: true },
  { name: 'phone', width: 390, height: 844, mobile: true },
  { name: 'phone-landscape', width: 844, height: 390, mobile: true },
  { name: 'tablet', width: 768, height: 1024, mobile: true },
  { name: 'tablet-landscape', width: 1180, height: 820, mobile: true },
  { name: 'laptop', width: 1440, height: 900, mobile: false },
];

const ALL_ROUTES = [
  { path: '/', name: 'home' },
  { path: '/play', name: 'mode-select' },
  { path: '/lobby', name: 'lobby' },
  { path: '/leaderboard', name: 'leaderboard' },
  { path: '/profile', name: 'profile' },
];

const VIEWPORTS = ONLY_VIEWPORTS
  ? ALL_VIEWPORTS.filter((v) => ONLY_VIEWPORTS.includes(v.name))
  : ALL_VIEWPORTS;
const ROUTES = ONLY_ROUTES ? ALL_ROUTES.filter((r) => ONLY_ROUTES.includes(r.name)) : ALL_ROUTES;

let problems = 0;

function report(viewport, route, kind, detail) {
  problems++;
  console.log(`  [${kind}] ${route} @ ${viewport} — ${detail}`);
}

/** Runs inside the page: finds layout defects the CSS cannot self-report. */
function inspect() {
  const doc = document.documentElement;
  const overflowX = doc.scrollWidth - doc.clientWidth;

  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.right > doc.clientWidth + 1 || rect.left < -1) {
      const style = getComputedStyle(el);
      // Anything inside a clipping ancestor cannot grow the scroll width.
      let clipped = false;
      for (let node = el.parentElement; node; node = node.parentElement) {
        const parent = getComputedStyle(node);
        if (parent.overflowX === 'hidden' || parent.overflowX === 'clip') {
          clipped = true;
          break;
        }
      }
      if (clipped) continue;
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className).slice(0, 64),
        pos: style.position,
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      });
    }
  }

  const smallTargets = [];
  for (const el of document.querySelectorAll('button, a, input, [role="button"]')) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.height < 32 || rect.width < 32) {
      smallTargets.push({
        tag: el.tagName.toLowerCase(),
        label: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 28),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      });
    }
  }

  const tinyText = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el.textContent?.trim() || el.children.length > 0) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size > 0 && size < 10) {
      tinyText.push({ size, text: el.textContent.trim().slice(0, 24) });
    }
  }

  return {
    overflowX,
    clientWidth: doc.clientWidth,
    scrollHeight: doc.scrollHeight,
    clientHeight: doc.clientHeight,
    offenders: offenders.slice(0, 6),
    smallTargets: smallTargets.slice(0, 6),
    tinyText: tinyText.slice(0, 4),
  };
}

async function main() {
  const executablePath = BROWSERS.find((path) => existsSync(path));
  if (!executablePath) {
    console.error('No Chrome or Edge found. Set one of the paths in BROWSERS.');
    process.exit(1);
  }

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
  });

  try {
    for (const viewport of VIEWPORTS) {
      console.log(`\n=== ${viewport.name} (${viewport.width}x${viewport.height})`);
      // A fresh context per viewport: otherwise localStorage carries the player
      // id over and the still-running Daily Challenge from the previous pass
      // redirects every route straight into the arena.
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setViewport({
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        isMobile: viewport.mobile,
        hasTouch: viewport.mobile,
      });

      const consoleErrors = [];
      page.on('pageerror', (error) => consoleErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });

      for (const route of ROUTES) {
        await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle2' });
        // Wait for the session handshake to replace the boot screen.
        try {
          await page.waitForFunction(
            () => !document.body.innerText.includes('Warming up your brain'),
            { timeout: 12_000 },
          );
        } catch {
          report(viewport.name, route.name, 'BOOT', 'stuck on the boot screen');
        }
        await new Promise((r) => setTimeout(r, 700));

        const result = await page.evaluate(inspect);

        if (result.overflowX > 1) {
          report(
            viewport.name,
            route.name,
            'H-OVERFLOW',
            `page scrolls ${result.overflowX}px sideways`,
          );
          for (const offender of result.offenders) {
            console.log(
              `          ↳ ${offender.pos} <${offender.tag} class="${offender.cls}"> x=${offender.left}..${offender.right} (limit ${result.clientWidth})`,
            );
          }
        }
        for (const target of result.smallTargets) {
          report(
            viewport.name,
            route.name,
            'TOUCH',
            `${target.tag} "${target.label}" is ${target.w}x${target.h}px (min 32)`,
          );
        }
        for (const text of result.tinyText) {
          report(viewport.name, route.name, 'FONT', `${text.size}px — "${text.text}"`);
        }

        await page.screenshot({
          path: resolve(OUT, `${viewport.name}--${route.name}.png`),
          fullPage: false,
        });
      }

      if (SKIP_ARENA) {
        await page.close();
        await context.close();
        continue;
      }

      // Daily Challenge gives a single-player arena without a second client.
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
      await page
        .waitForFunction(() => !document.body.innerText.includes('Warming up'), { timeout: 12_000 })
        .catch(() => undefined);
      const started = await page.evaluate(() => {
        const button = [...document.querySelectorAll('button')].find((b) =>
          /start run|beat it/i.test(b.textContent ?? ''),
        );
        if (!button) return false;
        button.click();
        return true;
      });
      if (started) {
        await new Promise((r) => setTimeout(r, 4200)); // countdown + round intro
        const arena = await page.evaluate(inspect);
        if (arena.overflowX > 1) {
          report(viewport.name, 'arena', 'H-OVERFLOW', `${arena.overflowX}px sideways`);
          for (const offender of arena.offenders) {
            console.log(`          ↳ <${offender.tag} class="${offender.cls}">`);
          }
        }
        if (arena.scrollHeight > arena.clientHeight + 2) {
          report(
            viewport.name,
            'arena',
            'V-SCROLL',
            `arena needs ${arena.scrollHeight}px in a ${arena.clientHeight}px viewport`,
          );
        }
        await page.screenshot({ path: resolve(OUT, `${viewport.name}--arena.png`) });
        await new Promise((r) => setTimeout(r, 5200));
        await page.screenshot({ path: resolve(OUT, `${viewport.name}--arena-play.png`) });
      } else {
        report(viewport.name, 'arena', 'SKIP', 'could not find the Daily Challenge button');
      }

      if (consoleErrors.length) {
        for (const error of [...new Set(consoleErrors)].slice(0, 3)) {
          report(viewport.name, 'console', 'JS-ERROR', error.slice(0, 120));
        }
      }
      await page.close();
      await context.close();
    }
  } finally {
    await browser.close();
  }

  console.log(
    `\n${problems === 0 ? 'NO LAYOUT PROBLEMS FOUND' : `${problems} PROBLEM(S) FOUND`}`,
  );
  console.log(`Screenshots: ${OUT}`);
}

main().catch((error) => {
  console.error('audit crashed:', error);
  process.exit(1);
});
