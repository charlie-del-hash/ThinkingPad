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

    /* ---------- the highlight has to be readable under every scheme ---------- */
    await page.fill('#search', 'printer');
    await page.waitForTimeout(300);
    for (const theme of ['classic', 'paper', 'midnight', 'amber', 'green']) {
      const worst = await page.evaluate((name) => {
        document.querySelector('#lcd').dataset.theme = name;
        const ink = getComputedStyle(document.querySelector('#editor')).color;
        const marks = ['mark', 'mark.current'].map((sel) =>
          getComputedStyle(document.querySelector('.editor-underlay ' + sel)).backgroundColor);
        const parse = (s) => s.match(/\d+/g).slice(0, 3).map(Number);
        const lum = (rgb) => {
          const c = rgb.map((v) => v / 255)
            .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
          return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
        };
        const a = lum(parse(ink));
        return Math.min.apply(null, marks.map((bg) => {
          const b = lum(parse(bg));
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        }));
      }, theme);
      t.ok(worst >= 4.5,
        theme + ': text stays readable on a highlight (' + worst.toFixed(1) + ':1)');
    }
    await page.evaluate(() => { document.querySelector('#lcd').dataset.theme = 'classic'; });

    /* ---------- and line up when the tab width is not eight ---------- */
    await page.keyboard.press('Control+,');
    await page.click('.settings .dlg-tab[data-tab="screen"]');
    await page.selectOption('#set-tabSize', '2');
    await page.click('.dlg-foot .btn');
    await page.waitForTimeout(200);
    t.eq(await page.evaluate(
      () => getComputedStyle(document.querySelector('.editor-underlay')).tabSize),
      await page.evaluate(() => getComputedStyle(document.querySelector('#editor')).tabSize),
      'the highlight layer uses the same tab stops as the text');
  }
};
