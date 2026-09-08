/* The power-on self test, and the starfield that comes on when you leave. */
'use strict';

module.exports = {
  name: 'Boot screen and screensaver',
  async run(t) {
    /* ---------- off unless you ask for it ---------- */
    let page = await t.open();
    t.ok(!(await page.$('.post')), 'no self test by default — it just opens');

    await page.keyboard.press('Control+,');
    await page.check('#set-bootScreen');
    await page.click('.dlg-foot .btn');
    await page.reload();
    await page.waitForTimeout(250);

    t.ok(await page.isVisible('.post'), 'switched on, the machine posts before it hands over');
    t.ok(/IBM/.test(await page.textContent('.post-ibm')), 'with the logo');

    await page.waitForFunction(() => {
      const foot = document.querySelector('.post-foot');
      return foot && foot.classList.contains('show');
    }, null, { timeout: 4000 });
    t.ok(/Memory Test : \d+ KB OK/.test(await page.textContent('.post-mem')),
      'having counted the memory: ' + (await page.textContent('.post-mem')));
    t.eq(await page.textContent('.post-tp'), 'ThinkPad', 'and shown the ThinkPad line');

    await page.waitForFunction(() => !document.querySelector('.post'), null, { timeout: 5000 });
    t.ok(!(await page.$('.post')), 'then it clears itself and gets out of the way');
    t.ok(await page.evaluate(() => document.activeElement === document.querySelector('#editor')),
      'leaving you in the note, ready to type');

    /* ---------- any key skips it ---------- */
    await page.reload();                     /* same tab, so the setting is still on */
    await page.waitForTimeout(250);
    t.ok(await page.isVisible('.post'), 'it posts again on the next load');
    const before = await page.inputValue('#editor');
    await page.keyboard.press('k');
    await page.waitForTimeout(500);
    t.ok(!(await page.$('.post')), 'a key skips the self test');
    t.eq(await page.inputValue('#editor'), before,
      'and that key is swallowed rather than typed into the note');

    /* ---------- the screensaver ---------- */
    page = await t.open();
    await page.click('.menu-top[data-menu="view"]');
    await page.click('.dropdown[data-menu="view"] .mi:has-text("Start Screensaver")');
    await page.waitForTimeout(400);
    t.ok(await page.isVisible('.saver canvas'), 'View > Start Screensaver puts the stars up');
    const painted = await page.evaluate(() => {
      const c = document.querySelector('.saver canvas');
      const ctx = c.getContext('2d');
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let lit = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] > 40) lit++;
      return lit;
    });
    t.ok(painted > 50, 'and there are actually stars on it (' + painted + ' lit pixels)');

    const text = await page.inputValue('#editor');
    await page.keyboard.press('j');
    await page.waitForTimeout(300);
    t.ok(!(await page.$('.saver')), 'a keypress dismisses it');
    t.eq(await page.inputValue('#editor'), text, 'without that key landing in the note');

    /* the idle timer is a setting, and it sticks */
    await page.keyboard.press('Control+,');
    await page.selectOption('#set-screensaver', '5');
    t.eq(await page.evaluate(
      () => JSON.parse(localStorage.getItem('thinkpad.prefs.v1')).screensaver), '5',
      'the idle delay is remembered');
    await page.click('.dlg-foot .btn');
  }
};
