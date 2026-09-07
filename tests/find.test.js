/* Find: counting, stepping, and showing where the matches are. */
'use strict';

const TEXT = [
  'Printer notes',
  '',
  'The printer jammed again. Ask about the printer contract.',
  'Nothing to do with the printer: order more coffee.'
].join('\n');

module.exports = {
  name: 'Find',
  async run(t) {
    const page = await t.open();
    await page.click('#editor');
    await page.keyboard.press('Control+A');
    await page.keyboard.type(TEXT);
    await page.waitForTimeout(600);
    await page.click('#btnNew');
    await page.keyboard.type('Unrelated note about the kitchen');
    await page.waitForTimeout(600);
    await page.click('.note-item:has-text("Printer notes")');
    await page.waitForTimeout(300);

    await page.fill('#search', 'printer');
    await page.waitForTimeout(300);

    t.eq(await page.textContent('#findCount'), '1/4', 'the count shows how many matches are in this note');
    t.eq(await page.$$eval('.editor-underlay mark', (m) => m.length), 4,
      'every match is highlighted behind the text');
    t.eq(await page.$$eval('.editor-underlay mark.current', (m) => m.length), 1,
      'and one of them is the current match');

    /* the highlight layer has to sit exactly under the text */
    const aligned = await page.evaluate(() => {
      const ed = document.querySelector('#editor');
      const un = document.querySelector('.editor-underlay');
      const a = getComputedStyle(ed), b = getComputedStyle(un);
      return a.fontFamily === b.fontFamily && a.fontSize === b.fontSize &&
             a.lineHeight === b.lineHeight && a.paddingLeft === b.paddingLeft &&
             a.whiteSpace === b.whiteSpace &&
             Math.abs(parseFloat(un.style.width) - ed.clientWidth) < 1;
    });
    t.ok(aligned, 'and shares the metrics of the text it sits under');

    /* stepping */
    await page.keyboard.press('F3');
    await page.waitForTimeout(150);
    t.eq(await page.textContent('#findCount'), '2/4', 'F3 moves to the next match');
    const selected = await page.evaluate(() => {
      const ed = document.querySelector('#editor');
      return ed.value.slice(ed.selectionStart, ed.selectionEnd);
    });
    t.eq(selected.toLowerCase(), 'printer', 'and selects it in the text');

    await page.keyboard.press('Shift+F3');
    await page.waitForTimeout(150);
    t.eq(await page.textContent('#findCount'), '1/4', 'Shift+F3 goes back');

    await page.keyboard.press('Shift+F3');
    await page.waitForTimeout(150);
    t.eq(await page.textContent('#findCount'), '4/4', 'and wraps around the end');

    /* the list says which notes hold matches, and how many */
    t.eq(await page.textContent('.note-item.sel .nb'), '4', 'the list row counts the matches');
    t.eq((await page.$$('.note-item')).length, 1, 'and notes without any drop out of the list');

    /* typing keeps the highlights honest */
    await page.click('#editor');
    await page.keyboard.press('Control+End');
    await page.keyboard.type('\nprinter printer');
    await page.waitForTimeout(400);
    t.eq(await page.$$eval('.editor-underlay mark', (m) => m.length), 6,
      'new matches light up as you type');

    /* and clearing it puts everything back */
    await page.fill('#search', '');
    await page.waitForTimeout(300);
    t.eq(await page.$$eval('.editor-underlay mark', (m) => m.length), 0, 'clearing Find clears the highlights');
    t.eq(await page.textContent('#findCount'), '', 'and the counter');
    t.eq((await page.$$('.note-item')).length, 2, 'and the whole list comes back');

    /* a term with no matches says so rather than doing nothing */
    await page.fill('#search', 'zzzz');
    await page.waitForTimeout(300);
    t.eq(await page.textContent('#findCount'), 'none', 'a term with no matches says none');
  }
};
