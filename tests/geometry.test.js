/* The panel is 4:3 and the whole machine fits the window. */
'use strict';

const SIZES = [
  [1920, 1080, 'a 1080p screen, fullscreen'],
  [1920, 945, 'a 1080p screen, maximised browser'],
  [1920, 880, 'a 1080p screen, with a bookmarks bar'],
  [1440, 900, '1440x900'],
  [1280, 720, '1280x720']
];

async function geometry(page) {
  return page.evaluate(() => {
    const lcd = document.querySelector('#lcd').getBoundingClientRect();
    const machine = document.querySelector('#machine').getBoundingClientRect();
    return {
      ratio: +(lcd.width / lcd.height).toFixed(3),
      lcd: Math.round(lcd.width) + 'x' + Math.round(lcd.height),
      insideH: machine.bottom <= window.innerHeight + 1,
      insideW: machine.right <= window.innerWidth + 1,
      scrolls: document.documentElement.scrollHeight > window.innerHeight + 1
    };
  });
}

module.exports = {
  name: 'Panel geometry',
  async run(t) {
    for (const [width, height, label] of SIZES) {
      const page = await t.open({ context: { viewport: { width: width, height: height } } });
      const g = await geometry(page);
      t.ok(Math.abs(g.ratio - 4 / 3) < 0.01, label + ': panel is 4:3 (' + g.lcd + ', ' + g.ratio + ')');
      t.ok(g.insideH && g.insideW && !g.scrolls, label + ': the whole machine fits, nothing clipped');
    }

    /* folding the keyboard away re-fits the panel rather than leaving a gap */
    const page = await t.open({ context: { viewport: { width: 1920, height: 945 } } });
    const folded = await geometry(page);
    await page.click('.menu-top[data-menu="view"]');
    await page.click('.dropdown[data-menu="view"] .mi:first-child');
    await page.waitForTimeout(350);
    const open = await geometry(page);
    t.ok(Math.abs(open.ratio - 4 / 3) < 0.01, 'still 4:3 with the keyboard out (' + open.lcd + ')');
    t.ok(parseInt(open.lcd) < parseInt(folded.lcd), 'the panel gives up room to the keyboard');
    t.ok(open.insideH && open.insideW, 'and the machine still fits');

    /* a resize re-fits */
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(350);
    const resized = await geometry(page);
    t.ok(Math.abs(resized.ratio - 4 / 3) < 0.01, 'a resize re-fits to 4:3 (' + resized.lcd + ')');
    t.ok(resized.insideH && resized.insideW, 'and it still fits afterwards');
  }
};
