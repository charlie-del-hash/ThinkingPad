/* The notepad itself: typing, saving, the list, the hardware. */
'use strict';

module.exports = {
  name: 'Core notepad',
  async run(t) {
    const page = await t.open();

    /* the deck is folded away by default; bring it back for the key tests */
    await page.click('.menu-top[data-menu="view"]');
    await page.click('.dropdown[data-menu="view"] .mi:first-child');
    await page.waitForTimeout(250);
    t.ok(await page.isVisible('.keyboard'), 'View > Keyboard unfolds the deck');

    /* typing */
    await page.click('#editor');
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Standup notes\n\nblocked on the printer again');
    await page.waitForTimeout(700);

    const db = await page.evaluate(() => JSON.parse(localStorage.getItem('thinkpad.notes.v1')));
    t.ok(db.notes[0].body.startsWith('Standup notes'), 'typing autosaves to localStorage');
    t.ok((await page.textContent('#winTitle')).startsWith('Standup notes'), 'title bar follows the first line');
    t.eq(await page.textContent('.note-item .nt'), 'Standup notes', 'list row title follows the first line');

    /* a second note */
    await page.click('#btnNew');
    await page.keyboard.type('Second note');
    await page.waitForTimeout(600);
    t.eq((await page.$$('.note-item')).length, 2, 'two notes in the list');
    t.ok(!(await page.inputValue('#editor')).includes('printer'), 'a new note starts empty');

    /* find */
    await page.fill('#search', 'printer');
    await page.waitForTimeout(300);
    t.eq((await page.$$('.note-item')).length, 1, 'find filters the list');
    await page.fill('#search', '');
    await page.waitForTimeout(250);

    /* typeface */
    await page.click('#stFont');
    t.ok(/IBM Plex Mono/.test(await page.evaluate(
      () => getComputedStyle(document.querySelector('#editor')).fontFamily)),
      'the status bar switches the note face to IBM Plex');
    t.ok(await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('thinkpad.prefs.v1'));
      return p.preset === 'plex' && p.monoFont === 'plex' && p.uiFont === 'plex';
    }), 'the typeface choice persists');
    await page.click('#stFont');
    t.ok(/Courier New/.test(await page.evaluate(
      () => getComputedStyle(document.querySelector('#editor')).fontFamily)),
      'and switches back to the period face');

    /* the keyboard mirrors real typing */
    await page.click('#editor');
    await page.keyboard.down('KeyK');
    const lit = await page.evaluate(
      () => document.querySelector('.key[data-code="KeyK"]').classList.contains('down'));
    await page.keyboard.up('KeyK');
    t.ok(lit, 'a physical keypress lights the cap on screen');

    const before = (await page.inputValue('#editor')).length;
    await page.click('.key[data-code="KeyZ"]');
    t.eq((await page.inputValue('#editor')).length, before + 1, 'clicking a cap types a character');
    await page.keyboard.press('Backspace');

    /* F5 the way Notepad always did */
    await page.click('#editor');
    await page.keyboard.press('F5');
    t.ok(/\d\d:\d\d \d{4}-\d\d-\d\d/.test(await page.inputValue('#editor')), 'F5 stamps the time and date');

    /* TrackPoint */
    await page.click('#editor');
    await page.keyboard.press('Control+A');
    await page.keyboard.type(Array.from({ length: 120 }, (_, i) => 'line ' + i).join('\n'));
    await page.evaluate(() => { document.querySelector('#editor').scrollTop = 0; });
    const box = await (await page.$('#trackpoint')).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 20, { steps: 4 });
    await page.waitForTimeout(400);
    const scrolled = await page.evaluate(() => document.querySelector('#editor').scrollTop);
    await page.mouse.up();
    t.ok(scrolled > 20, 'pushing the TrackPoint scrolls the page (scrollTop ' + scrolled + ')');

    /* menus and dialogs */
    await page.click('.menu-top[data-menu="help"]');
    t.ok(await page.isVisible('.dropdown[data-menu="help"]'), 'a menu opens');
    await page.click('.dropdown[data-menu="help"] .mi:first-child');
    t.ok(await page.isVisible('.dlg'), 'a dialog opens');
    await page.keyboard.press('Escape');
    t.ok(!(await page.isVisible('.dlg')), 'Escape closes the dialog');

    /* delete asks first */
    await page.keyboard.press('Control+D');
    t.ok(await page.isVisible('.dlg'), 'Ctrl+D asks before deleting');
    await page.click('.dlg-foot .btn');
    await page.waitForTimeout(250);
    t.eq((await page.$$('.note-item')).length, 1, 'the note leaves the list');

    /* and it all survives a reload */
    await page.reload();
    await page.waitForTimeout(400);
    t.ok((await page.inputValue('#editor')).length > 0, 'the note comes back after a reload');
    t.eq((await page.$$('.note-item')).length, 1, 'the list comes back after a reload');
  }
};
