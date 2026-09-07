/* ============================================================
   harness.js — a static server, a browser, and a few asserts.
   No test framework: these run in plain node.
   ============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

/* Playwright may be a local devDependency, or already installed
   globally on this machine. Try both before giving up. */
function requirePlaywright() {
  const ids = [process.env.PLAYWRIGHT_MODULE, 'playwright', '@playwright/test'].filter(Boolean);
  for (const id of ids) {
    try { return require(id); } catch (e) { /* keep looking */ }
  }
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return require(path.join(globalRoot, 'playwright'));
  } catch (e) { /* fall through */ }
  throw new Error('Playwright not found. Run:  npm install && npx playwright install chromium');
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8'
};

function serve(root) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(root, url === '/' ? 'index.html' : url);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, body) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        origin: 'http://127.0.0.1:' + port,
        close: () => new Promise((r) => server.close(r))
      });
    });
  });
}

/* One suite's view of the world. */
function makeContext(browser, origin, results) {
  const contexts = new Set();
  const ctx = {
    origin: origin,
    results: results,
    errors: [],
    allowed: [],

    /* a suite that breaks something on purpose says so here */
    allow(re) { ctx.allowed.push(re); },

    /* a fresh browser context, which means fresh localStorage */
    async open(o) {
      const opts = o || {};
      const bctx = await browser.newContext(
        Object.assign({ viewport: { width: 1440, height: 900 } }, opts.context)
      );
      const page = await bctx.newPage();
      ctx.watch(page);
      await page.goto(origin + (opts.path || '/index.html'));
      await page.waitForTimeout(opts.settle || 400);
      contexts.add(bctx);
      page.browserContext = bctx;
      return page;
    },

    /* a second tab sharing storage with an existing page */
    async tab(page, p) {
      const t = await page.browserContext.newPage();
      ctx.watch(t);
      await t.goto(origin + (p || '/index.html'));
      await t.waitForTimeout(400);
      return t;
    },

    watch(page) {
      const expected = (text) => ctx.allowed.some((re) => re.test(text));
      page.on('pageerror', (e) => {
        if (!expected(e.message)) ctx.errors.push('page error: ' + e.message);
      });
      page.on('console', (m) => {
        const text = m.text();
        if (m.type() !== 'error') return;
        if (/ERR_CONNECTION|fonts\.g|favicon/.test(text) || expected(text)) return;
        ctx.errors.push('console error: ' + text);
      });
    },

    ok(cond, label) {
      results.push({ ok: !!cond, label: label });
      return !!cond;
    },
    eq(actual, expected, label) {
      const ok = String(actual) === String(expected);
      results.push({ ok: ok, label: label + (ok ? '' : '  (got ' + actual + ', wanted ' + expected + ')') });
      return ok;
    },

    async cleanup() {
      for (const c of contexts) {
        try { await c.close(); } catch (e) { /* closing anyway */ }
      }
    }
  };
  return ctx;
}

module.exports = { ROOT: ROOT, serve: serve, requirePlaywright: requirePlaywright, makeContext: makeContext };
