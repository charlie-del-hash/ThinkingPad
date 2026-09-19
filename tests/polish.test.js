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

    /* ---------- the marks under the lights ---------- */
    const icons = await page.$$eval('.led-cell', (cells) => cells.map((c) => {
      const svg = c.querySelector('svg.ico');
      return { label: svg && svg.getAttribute('aria-label'), title: c.getAttribute('title') };
    }));
    t.eq(icons.length, 8, 'eight indicators on the bezel');
    t.eq(icons.map((i) => i.label).join(', '),
      'Bluetooth, Wireless, Num Lock, Caps Lock, Drive in use, Battery, Standby, Power',
      'left to right as the T4x had them, each a drawn mark named for a screen reader');
    t.ok(icons.every((i) => i.title), 'and titled, so hovering says which is which');
    t.eq(await page.$$eval('.led-cell em', (els) => els.length), 0,
      'the old text labels are gone');

    /* the mark is the light: a lit indicator is the pictogram glowing, not a dot */
    const glow = await page.evaluate(() => {
      const on = getComputedStyle(document.querySelector('.led-pwr + .ico'));
      const off = getComputedStyle(document.querySelector('.led-bt + .ico'));
      const dot = getComputedStyle(document.querySelector('.led-pwr'));
      return { on: on.stroke, off: off.stroke, lit: on.filter !== 'none', dot: dot.display };
    });
    t.ok(glow.on !== glow.off && glow.lit, 'a lit indicator is its mark glowing (' + glow.on + ')');
    t.eq(glow.dot, 'none', 'and there is no separate dot to look at');
    t.ok(await page.evaluate(() => document.querySelector('.led-wifi').classList.contains('on')),
      'the wireless light is on while the browser has a network');
    t.ok(/Wireless/.test(await page.getAttribute('.led-wifi + .ico', 'aria-label')) &&
      /connected/.test(await page.evaluate(() => document.querySelector('.led-wifi').parentNode.title)),
      'and says so when hovered');

    /* ---------- ten years of fingers ---------- */
    await page.keyboard.press('Control+,');
    await page.check('#set-deck');
    await page.waitForTimeout(300);
    t.ok(await page.evaluate(() => !document.body.classList.contains('worn')),
      'the machine arrives factory fresh');
    t.ok(await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector('.key[data-code="KeyF"]'), '::after');
      return s.backgroundImage === 'none' || s.content === 'none';
    }), 'with no shine on any of the caps');

    await page.check('#set-wear');
    await page.waitForTimeout(200);
    t.ok(await page.evaluate(() => document.body.classList.contains('worn')),
      'and Wear and tear ages it on request');
    t.eq(await page.getAttribute('.key[data-code="KeyF"]', 'data-wear'), '2',
      'the home row takes the worst of it');
    t.eq(await page.getAttribute('.key[data-code="KeyE"]', 'data-wear'), '2',
      'along with the letters English leans on');
    t.eq(await page.getAttribute('.key[data-code="F7"]', 'data-wear'), null,
      'while F7 stays as good as the day it left Yamato');
    t.ok(await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector('.key[data-code="KeyF"]'), '::after');
      return s.backgroundImage.indexOf('radial-gradient') >= 0;
    }), 'and the shine is actually painted on the cap');

    await page.uncheck('#set-wear');
    await page.click('.dlg-foot .btn');
    await page.waitForTimeout(200);

    /* ---------- reachable without a mouse ---------- */
    await page.keyboard.press('Control+,');
    await page.waitForTimeout(200);
    const trapped = await page.evaluate(() => {
      const dlg = document.querySelector('.dlg');
      const stops = dlg.querySelectorAll('button, input, select, textarea');
      stops[stops.length - 1].focus();
      return dlg.contains(document.activeElement);
    });
    t.ok(trapped, 'a dialog can be tabbed through');
    await page.keyboard.press('Tab');
    t.ok(await page.evaluate(() => document.querySelector('.dlg').contains(document.activeElement)),
      'and Tab off the end comes back round instead of escaping behind it');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    t.ok(await page.evaluate(() => document.activeElement === document.querySelector('#editor')),
      'closing it hands focus back to the page');

    await page.click('.menu-top[data-menu="file"]');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    t.eq(await page.textContent('.mi.focus .lbl'), 'Open .txt…',
      'the arrow keys walk down an open menu');
    await page.keyboard.press('ArrowUp');
    t.eq(await page.textContent('.mi.focus .lbl'), 'New Note', 'and back up it');
    await page.keyboard.press('ArrowRight');
    t.ok(await page.isVisible('.dropdown[data-menu="edit"]'), 'and across to the next menu');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);

    t.eq(await page.getAttribute('#stMsg', 'aria-live'), 'polite',
      'the status bar announces itself to a screen reader');

    /* ---------- the seven-row keyboard ---------- */
    const deck = await page.evaluate(() => {
      const codes = (sel) => Array.from(document.querySelectorAll(sel + ' .key[data-code]'))
        .map((k) => k.dataset.code);
      const box = (code) => document.querySelector('.key[data-code="' + code + '"]').getBoundingClientRect();
      const up = box('ArrowUp'), down = box('ArrowDown');
      const fn = getComputedStyle(document.querySelector('.key[data-code="Fn"] .cap')).color;
      const letter = getComputedStyle(document.querySelector('.key[data-code="KeyF"] .cap')).color;
      return {
        top: codes('.krow.fn-row'),
        rows: document.querySelectorAll('.krow').length,
        aligned: Math.abs(up.left - down.left) < 1 && Math.abs(up.right - down.right) < 1,
        fnBlue: fn !== letter,
        marks: document.querySelectorAll('.key .fnl').length,
        f4mark: !!document.querySelector('.key[data-code="F4"] .fnl')
      };
    });
    t.eq(deck.rows, 6, 'six rows of keys, the top one half height, which IBM counted as seven');
    t.eq(deck.top.slice(13).join(' '), 'PrintScreen ScrollLock Pause Insert Delete Home End PageUp PageDown',
      'PrtSc, ScrLk, Pause and the six editing keys ride the end of the function row');
    t.ok(deck.top.length === 22, 'twenty-two keys along the top');
    t.ok(await page.$('.key[data-code="BrowserBack"]') && await page.$('.key[data-code="BrowserForward"]'),
      'the browser keys sit either side of the up arrow');
    t.ok(deck.aligned, 'and the up arrow sits exactly over the down arrow');
    t.ok(deck.fnBlue, 'Fn is printed in blue');
    t.ok(deck.marks >= 7 && deck.f4mark, 'with blue marks for what Fn does to the keys (' + deck.marks + ')');

    /* ---------- every colour scheme stays readable ---------- */
    for (const theme of ['luna', 'classic', 'paper', 'midnight', 'amber', 'green']) {
      const ratio = await page.evaluate((name) => {
        document.querySelector('#lcd').dataset.theme = name;
        const fg = getComputedStyle(document.querySelector('#editor')).color;
        const bg = getComputedStyle(document.querySelector('.editor-wrap')).backgroundColor;
        const parse = (s) => s.match(/\d+/g).slice(0, 3).map(Number);
        const lum = (rgb) => {
          const c = rgb.map((v) => v / 255)
            .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
          return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
        };
        const a = lum(parse(fg)), b = lum(parse(bg));
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      }, theme);
      t.ok(ratio >= 4.5, theme + ' text on paper is readable (' + ratio.toFixed(1) + ':1)');
    }
    await page.evaluate(() => { document.querySelector('#lcd').dataset.theme = 'luna'; });

    /* ---------- it boots into XP ---------- */
    t.eq(await page.evaluate(() => document.querySelector('#lcd').dataset.theme), 'luna',
      'the panel wears Luna out of the box');
    const luna = await page.evaluate(() => {
      const bar = getComputedStyle(document.querySelector('.win > .titlebar'));
      const close = getComputedStyle(document.querySelector('#tbClose'));
      const face = getComputedStyle(document.querySelector('.win')).backgroundColor;
      return { bar: bar.backgroundImage, close: close.backgroundImage, radius: close.borderRadius, face: face };
    });
    t.ok(/rgb\(0, 88, 230\)/.test(luna.bar) && !/10, 36, 106/.test(luna.bar),
      'a blue title bar, not the old navy sweep');
    t.ok(/rgb\(2\d\d, [4-9]\d, [2-6]\d\)/.test(luna.close) && luna.radius !== '0px',
      'with the red rounded close button');
    t.eq(luna.face, 'rgb(236, 233, 216)', 'and the sand-coloured face XP had');

    /* The drawn scrollbar has to survive: Chromium honours scrollbar-color
       too, and if it is set the ::-webkit-scrollbar rules are thrown away
       for a plain native bar — which is what happened here for a year. */
    t.eq(await page.evaluate(() => getComputedStyle(document.querySelector('#editor')).scrollbarColor),
      'auto', 'scrollbar-color stays auto where ::-webkit-scrollbar is drawn, so the drawn bar shows');

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
