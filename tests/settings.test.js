/* Settings: every control writes through to the machine and persists. */
'use strict';

module.exports = {
  name: 'Settings',
  async run(t) {
    const page = await t.open({ context: { viewport: { width: 1920, height: 945 } } });

    t.ok(!(await page.isVisible('.keyboard')), 'the keyboard is folded away by default');
    const roomy = await page.evaluate(() => {
      const r = document.querySelector('#lcd').getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    t.ok(roomy.w > 900, 'which leaves a roomy panel (' + roomy.w + 'x' + roomy.h + ')');

    await page.keyboard.press('Control+,');
    t.ok(await page.isVisible('.settings'), 'Ctrl+comma opens Settings');
    const tabs = await page.$$eval('.settings .dlg-tab', (els) => els.map((e) => e.textContent));
    t.eq(tabs.join(','), 'Machine,Screen,Notes,Data', 'four tabs');
    const rows = await page.$$eval('.settings .set-row', (els) => els.length);
    t.ok(rows >= 30, rows + ' settings across the tabs');

    /* checkbox */
    await page.check('#set-deck');
    await page.waitForTimeout(300);
    t.ok(await page.isVisible('.keyboard'), 'Machine > Keyboard puts the deck back');

    /* selects */
    await page.selectOption('#set-caseFinish', 'titanium');
    t.eq(await page.evaluate(() => document.body.dataset.case), 'titanium', 'case finish applies');
    await page.click('.settings .dlg-tab[data-tab="screen"]');
    t.ok(await page.evaluate(
      () => !document.querySelector('.set-pane[data-tab="machine"]').offsetParent),
      'only one tab pane shows at a time');
    await page.selectOption('#set-theme', 'midnight');
    t.eq(await page.evaluate(() => document.querySelector('#lcd').dataset.theme), 'midnight',
      'screen colours apply');
    const paper = await page.evaluate(
      () => getComputedStyle(document.querySelector('.editor-wrap')).backgroundColor);
    t.ok(/rgb\(1[0-9], 2[01], 2[0-9]\)/.test(paper), 'midnight repaints the paper (' + paper + ')');

    /* slider */
    await page.evaluate(() => {
      const el = document.querySelector('#set-fontSize');
      el.value = 17;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    t.eq(await page.evaluate(() => getComputedStyle(document.querySelector('#editor')).fontSize),
      '17px', 'the note size slider applies');

    /* panel shape and the bare-notepad mode */
    await page.click('.settings .dlg-tab[data-tab="machine"]');
    await page.selectOption('#set-aspect', '16:10');
    await page.waitForTimeout(300);
    t.eq(await page.evaluate(() => {
      const r = document.querySelector('#lcd').getBoundingClientRect();
      return (r.width / r.height).toFixed(2);
    }), '1.60', 'the 16:10 panel shape applies');
    await page.selectOption('#set-aspect', '4:3');
    await page.uncheck('#set-showCase');
    await page.waitForTimeout(300);
    t.ok(!(await page.isVisible('.base')) && !(await page.isVisible('.bezel-foot')),
      'the machine can be taken away entirely');
    t.ok(await page.evaluate(() => {
      const r = document.querySelector('#lcd').getBoundingClientRect();
      return Math.round(r.width) >= window.innerWidth - 2 && Math.round(r.height) >= window.innerHeight - 2;
    }), 'and the notepad then fills the window');
    await page.check('#set-showCase');
    await page.waitForTimeout(300);

    /* notes tab */
    await page.click('.settings .dlg-tab[data-tab="notes"]');
    await page.selectOption('#set-listSide', 'right');
    t.ok(await page.evaluate(() => document.body.classList.contains('list-right')),
      'the note list can move to the right');
    await page.selectOption('#set-listSide', 'left');
    await page.selectOption('#set-sort', 'title');
    t.eq(await page.evaluate(
      () => JSON.parse(localStorage.getItem('thinkpad.prefs.v1')).sort), 'title',
      'settings persist the moment they change');

    /* data tab */
    await page.click('.settings .dlg-tab[data-tab="data"]');
    const report = (await page.textContent('.settings .sunken')).trim();
    t.ok(/note/.test(report) && /KB/.test(report), 'the Data tab reports storage: ' + report);
    await page.click('.dlg-foot .btn');

    /* the status-bar shortcut and the form agree */
    await page.click('#stFont');
    await page.keyboard.press('Control+,');
    await page.click('.settings .dlg-tab[data-tab="screen"]');
    t.ok((await page.inputValue('#set-preset')) === 'plex' &&
         (await page.inputValue('#set-monoFont')) === 'plex',
      'the status-bar typeface toggle syncs the form');
    await page.click('.dlg-foot .btn');

    /* everything survives a reload */
    await page.reload();
    await page.waitForTimeout(450);
    const kept = await page.evaluate(() => ({
      deck: !document.body.classList.contains('no-keyboard'),
      caseFinish: document.body.dataset.case,
      theme: document.querySelector('#lcd').dataset.theme,
      size: getComputedStyle(document.querySelector('#editor')).fontSize
    }));
    t.ok(kept.deck && kept.caseFinish === 'titanium' && kept.theme === 'midnight' && kept.size === '17px',
      'every setting survives a reload (' + JSON.stringify(kept) + ')');
  }
};
