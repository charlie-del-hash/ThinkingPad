/* The details that make it read as a machine rather than a web page. */
'use strict';

module.exports = {
  name: 'Period detail',
  async run(t) {
    const page = await t.open({ context: { viewport: { width: 1920, height: 945 } } });

    /* the deck lies flat */
    t.ok(await page.evaluate(() => document.body.classList.contains('deck-flat')),
      'the deck is tipped away by default');
    const tilted = await page.evaluate(
      () => getComputedStyle(document.querySelector('.base')).transform);
    t.ok(tilted && tilted !== 'none' && tilted.indexOf('matrix3d') === 0,
      'which is a real 3D transform, not a fake gradient');

    await page.keyboard.press('Control+,');
    await page.uncheck('#set-deckTilt');
    await page.waitForTimeout(200);
    t.eq(await page.evaluate(() => getComputedStyle(document.querySelector('.base')).transform),
      'none', 'and it can be switched off for a flat-on view');
    await page.check('#set-deckTilt');
    await page.click('.dlg-foot .btn');

    /* the machine sits on the desk */
    t.ok(await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector('#machine'), '::after');
      return s.backgroundImage !== 'none' && s.filter.indexOf('blur') === 0;
    }), 'a blurred contact shadow pools under the front lip');

    /* backlight bleed sits over the panel without tinting white paper */
    t.ok(await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector('#lcd'), '::after');
      return s.mixBlendMode === 'screen' && s.backgroundImage.indexOf('radial-gradient') >= 0;
    }), 'backlight bleed is screen-blended, so it only shows on a dark picture');

    /* a dialog makes the window behind it go inactive */
    const activeBar = await page.evaluate(
      () => getComputedStyle(document.querySelector('.win > .titlebar')).backgroundImage);
    await page.keyboard.press('Control+,');
    await page.waitForTimeout(200);
    t.ok(await page.evaluate(() => document.body.classList.contains('modal')),
      'opening a dialog marks the window inactive');
    const inactiveBar = await page.evaluate(
      () => getComputedStyle(document.querySelector('.win > .titlebar')).backgroundImage);
    t.ok(inactiveBar !== activeBar && !/10, 36, 106/.test(inactiveBar),
      'so its title bar greys out the way it used to');
    await page.click('.dlg-foot .btn');
    await page.waitForTimeout(200);
    t.ok(await page.evaluate(() => !document.body.classList.contains('modal')),
      'and comes back when the dialog closes');

    /* hotkey underlines wait for Alt */
    const underline = () => page.evaluate(
      () => getComputedStyle(document.querySelector('.menu-top u')).textDecorationLine);
    t.eq(await underline(), 'none', 'menu hotkeys are not underlined at rest');
    await page.keyboard.down('Alt');
    await page.waitForTimeout(100);
    t.eq(await underline(), 'underline', 'holding Alt reveals them');
    await page.keyboard.up('Alt');
    await page.waitForTimeout(100);
    t.eq(await underline(), 'none', 'and letting go hides them again');

    /* the battery light */
    const bat = await page.evaluate(() => {
      const led = document.querySelector('.led-bat');
      return {
        supported: !!navigator.getBattery,
        title: led.parentNode.getAttribute('title') || '',
        lit: led.classList.contains('on') || led.classList.contains('amber')
      };
    });
    t.ok(bat.lit, 'the battery light is lit');
    if (bat.supported) {
      t.ok(/Battery \d+%/.test(bat.title), 'and reports the real charge: ' + bat.title);
    } else {
      t.ok(true, 'this browser will not report a battery, so the light stays plain green');
    }
  }
};
