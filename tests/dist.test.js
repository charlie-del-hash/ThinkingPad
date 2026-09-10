/* The built single file, opened the way you would actually open it:
   double-clicked, no server, no network. */
'use strict';
const path = require('path');
const { ROOT } = require('./harness');

const FILE = 'file://' + path.join(ROOT, 'dist', 'thinkpad-notes.html');

module.exports = {
  name: 'The built file on its own',
  async run(t) {
    const page = await t.open({ url: FILE, settle: 700 });

    const offMachine = [];
    page.on('request', (r) => {
      const url = r.url();
      if (!url.startsWith('file://') && !url.startsWith('data:')) offMachine.push(url);
    });

    t.ok(await page.evaluate(() => document.body.classList.contains('fitted')),
      'it boots straight off the disk');
    t.ok((await page.inputValue('#editor')).length > 0, 'with the note it ships with');

    /* typing, saving, reloading — all without a server */
    await page.click('#editor');
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Kept on this disk\n\nand nowhere else');
    await page.waitForTimeout(700);
    await page.reload();
    await page.waitForTimeout(700);
    t.ok((await page.inputValue('#editor')).indexOf('Kept on this disk') === 0,
      'and notes survive a reload with no server involved');

    /* exporting has to hand over a real file here, not a blocked link */
    const waitForDownload = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
    await page.keyboard.press('Control+e');
    const download = await waitForDownload;
    t.ok(!!download, 'Ctrl+E writes out a .txt' +
      (download ? ' (' + download.suggestedFilename() + ')' : ''));

    /* the reset link works pasted at an already-open page, where the
       browser changes the hash without reloading anything */
    await page.evaluate(() => { window.location.hash = '#factory'; });
    await page.waitForTimeout(500);
    t.ok(await page.isVisible('.dlg'), '#factory offers the reset even without a reload');
    await page.click('.dlg-foot .btn:has-text("Factory reset")');
    await page.waitForTimeout(900);
    t.ok(/plain text notepad/.test(await page.inputValue('#editor')),
      'and hands back a factory fresh machine');

    t.eq(offMachine.length, 0,
      'and in all of that it asked the network for nothing' +
      (offMachine.length ? ': ' + offMachine[0] : ''));
  }
};
