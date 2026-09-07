/* ============================================================
   run.js — runs every tests/*.test.js against a served copy of
   the app, and exits non-zero if anything fails so CI can gate.

     node tests/run.js               every suite
     node tests/run.js core safety   only those
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, serve, requirePlaywright, makeContext } = require('./harness');

const ESC = String.fromCharCode(27);
const paint = process.stdout.isTTY && !process.env.NO_COLOR;
const C = {
  pass: paint ? ESC + '[32m' : '',
  fail: paint ? ESC + '[31m' : '',
  dim: paint ? ESC + '[2m' : '',
  bold: paint ? ESC + '[1m' : '',
  off: paint ? ESC + '[0m' : ''
};

(async () => {
  const only = process.argv.slice(2);
  const files = fs.readdirSync(__dirname)
    .filter((f) => f.endsWith('.test.js'))
    .filter((f) => !only.length || only.some((o) => f.startsWith(o)))
    .sort();

  if (!files.length) {
    console.error('no suites matched: ' + only.join(', '));
    process.exit(1);
  }

  const { chromium } = requirePlaywright();
  const server = await serve(ROOT);
  const browser = await chromium.launch();
  const started = Date.now();
  let passed = 0;
  let failed = 0;

  for (const file of files) {
    const suite = require(path.join(__dirname, file));
    const results = [];
    const ctx = makeContext(browser, server.origin, results);
    console.log('\n' + C.bold + suite.name + C.off + C.dim + '  ' + file + C.off);
    try {
      await suite.run(ctx);
    } catch (e) {
      results.push({ ok: false, label: 'suite threw: ' + String(e.message).split('\n')[0] });
    }
    for (const e of ctx.errors) results.push({ ok: false, label: e });
    await ctx.cleanup();

    for (const r of results) {
      if (r.ok) { passed++; console.log('  ' + C.pass + 'pass' + C.off + '  ' + r.label); }
      else { failed++; console.log('  ' + C.fail + 'FAIL' + C.off + '  ' + r.label); }
    }
  }

  await browser.close();
  await server.close();

  console.log('\n' + passed + ' passed, ' + failed + ' failed, ' +
              ((Date.now() - started) / 1000).toFixed(1) + 's');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
