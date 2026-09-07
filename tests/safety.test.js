/* Losing work is the only unforgivable bug in a notepad. */
'use strict';

module.exports = {
  name: 'Not losing your work',
  async run(t) {
    /* ---------- delete is reversible ---------- */
    let page = await t.open();
    await page.click('#editor');
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Keep me');
    await page.waitForTimeout(600);
    await page.click('#btnNew');
    await page.keyboard.type('Throw me away');
    await page.waitForTimeout(600);

    await page.keyboard.press('Control+D');
    await page.click('.dlg-foot .btn');
    await page.waitForTimeout(300);
    t.eq((await page.$$('.note-item')).length, 1, 'a deleted note leaves the list');
    t.ok(await page.isVisible('.statusbar .st-action'), 'and the status bar offers Undo');
    t.ok(await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('thinkpad.notes.v1'));
      return db.notes.some((n) => n.deleted && n.body.indexOf('Throw me away') === 0);
    }), 'it is kept as a tombstone rather than erased');

    await page.click('.statusbar .st-action');
    await page.waitForTimeout(300);
    t.eq((await page.$$('.note-item')).length, 2, 'Undo puts it back in the list');
    t.ok((await page.inputValue('#editor')).indexOf('Throw me away') === 0, 'and reopens it');

    /* ---------- the trash can be emptied on purpose ---------- */
    await page.keyboard.press('Control+D');
    await page.click('.dlg-foot .btn');
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+,');
    await page.click('.settings .dlg-tab[data-tab="data"]');
    t.ok(/1 in the trash/.test(await page.textContent('.settings .sunken')),
      'the Data tab counts what is in the trash');
    await page.click('.set-pane[data-tab="data"] button:has-text("Empty the trash")');
    await page.waitForTimeout(200);
    await page.click('.dlg-foot .btn');
    await page.waitForTimeout(300);
    t.ok(await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('thinkpad.notes.v1'));
      return db.notes.every((n) => !n.deleted);
    }), 'emptying the trash removes the tombstones for good');

    /* ---------- two tabs ---------- */
    page = await t.open();
    await page.click('#editor');
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Tab one note');
    await page.waitForTimeout(600);

    const other = await t.tab(page);
    await other.click('#btnNew');
    await other.keyboard.type('Written in the second tab');
    await other.waitForTimeout(800);
    await page.waitForTimeout(400);
    t.eq((await page.$$('.note-item')).length, 2, 'a note made in one tab appears in the other');
    t.ok(/another tab/.test(await page.textContent('#stMsg')), 'and the status bar says where it came from');

    /* an edit in flight here is never overwritten by the other tab */
    await page.evaluate(() => {
      const ed = document.querySelector('#editor');
      ed.value = 'HALF-TYPED SENTENCE';
      ed.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const activeId = await page.evaluate(() => JSON.parse(localStorage.getItem('thinkpad.notes.v1')).activeId);
    await other.evaluate((id) => {
      const db = JSON.parse(localStorage.getItem('thinkpad.notes.v1'));
      const n = db.notes.find((x) => x.id === id);
      n.body = 'CLOBBERED BY THE OTHER TAB';
      n.updated = Date.now() + 5000;
      localStorage.setItem('thinkpad.notes.v1', JSON.stringify(db));
    }, activeId);
    await page.waitForTimeout(300);
    t.eq(await page.inputValue('#editor'), 'HALF-TYPED SENTENCE',
      'what you are typing survives the other tab saving the same note');

    /* ---------- a full disk says so ---------- */
    page = await t.open();
    await page.addInitScript(() => {
      const real = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function (k, v) {
        if (k === 'thinkpad.notes.v1') {
          const e = new Error('quota');
          e.name = 'QuotaExceededError';
          throw e;
        }
        return real(k, v);
      };
    });
    await page.reload();
    await page.waitForTimeout(400);
    await page.click('#editor');
    await page.keyboard.type('this cannot be saved');
    await page.waitForTimeout(800);
    t.ok(/NOT saved/.test(await page.textContent('#stMsg')), 'a failed save is reported, not swallowed');
    t.ok(await page.isVisible('.dlg'), 'and it explains what to do about it');
    t.ok(await page.evaluate(
      () => document.querySelector('.led-hdd').classList.contains('amber')),
      'the drive light goes amber');

    /* ---------- a script that fails to load ---------- */
    t.allow(/TPSettings is not defined|ERR_FAILED/);
    page = await t.open();
    await page.route('**/settings.js', (route) => route.abort());
    await page.reload();
    await page.waitForTimeout(500);
    const failure = await page.textContent('#lcdInner');
    t.ok(/did not start/.test(failure), 'a missing script shows a failure panel, not a dead screen');
    t.ok(/still in this browser/.test(failure), 'which says the notes are safe');
    t.ok(await page.isVisible('button:has-text("Reset settings and reload")'), 'and offers a way out');
    await page.unroute('**/settings.js');

    /* ---------- #reset ---------- */
    page = await t.open();
    await page.evaluate(() => {
      localStorage.setItem('thinkpad.prefs.v1', JSON.stringify({ theme: 'amber', fontSize: 19 }));
    });
    /* a bare hash change would not reload anything, so make it a real navigation */
    await page.goto(t.origin + '/index.html?from=test#reset');
    await page.waitForTimeout(500);
    t.eq(await page.evaluate(() => document.querySelector('#lcd').dataset.theme), 'classic',
      '#reset starts again with standard settings');
    t.eq(await page.evaluate(() => window.location.hash + window.location.search), '',
      'and tidies the hash away');
    t.ok(await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('thinkpad.notes.v1'));
      return db && db.notes.length > 0;
    }), 'without touching the notes');
  }
};
