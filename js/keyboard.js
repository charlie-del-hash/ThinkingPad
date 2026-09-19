/* ============================================================
   keyboard.js — the ThinkPad keyboard
   The seven-row deck IBM shipped on the T4x: Esc and twelve
   function keys, then PrtSc, ScrLk, Pause, and the six editing
   keys in one long half-height row; the browser keys either side
   of the up arrow; Fn in the corner, in blue. Builds the deck,
   mirrors real keystrokes, and lets you type by clicking caps.
   ============================================================ */
(function (global) {
  'use strict';

  var UNITS = 15;                      /* every row is fifteen key widths */

  function k(code, label, w, opts) {
    var o = opts || {};
    return { code: code, label: label, w: w || 1, sub: o.sub, ch: o.ch, cls: o.cls,
             fn: o.fn, icon: o.icon, name: o.name };
  }
  function sp(w) { return { spacer: true, w: w }; }

  /* The blue marks under the legends: what Fn does to that key on the
     real machine. Drawn small, so only the shape has to read. */
  var ICONS = {
    screen:   'M1.5 2.5h9v6h-9zM4 10.5h4',
    moon:     'M8.9 7.7A4.1 4.1 0 1 1 6.1 1.4a3.3 3.3 0 0 0 2.8 6.3z',
    wireless: 'M6 11V6.2M3.6 4.6a3.4 3.4 0 0 1 4.8 0M1.6 2.6a6.2 6.2 0 0 1 8.8 0',
    displays: 'M1.5 4.5h6v5h-6zM4.5 2.5h6v5H8.5',
    hibernate:'M2 2.5h8v7H2zM4.5 5h3l-3 3h3',
    sunhi:    'M6 1.2v1.6M6 9.2v1.6M1.2 6h1.6M9.2 6h1.6M2.6 2.6l1.1 1.1M8.3 8.3l1.1 1.1M2.6 9.4l1.1-1.1M8.3 3.7l1.1-1.1M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
    sunlo:    'M6 2.2v1.2M6 8.6v1.2M2.2 6h1.2M8.6 6h1.2M7.5 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z',
    lamp:     'M3 1.5h6M6 1.5v2.1M3.6 9.5 6 5.4l2.4 4.1',
    back:     'M9.5 9A3 3 0 0 0 6.5 6H3M5 4 3 6l2 2',
    fwd:      'M2.5 9A3 3 0 0 1 5.5 6H9M7 4l2 2-2 2'
  };

  var F = 0.66, EDIT = 0.66, GAP = 0.06;
  var ROWS = [
    { cls: 'fn-row', keys: [
      k('Escape', 'Esc', 0.9, { cls: 'wide-label' }),
      k('F1', 'F1', F), k('F2', 'F2', F), k('F3', 'F3', F, { fn: 'screen' }), k('F4', 'F4', F, { fn: 'moon' }), sp(GAP),
      k('F5', 'F5', F, { fn: 'wireless' }), k('F6', 'F6', F), k('F7', 'F7', F, { fn: 'displays' }), k('F8', 'F8', F), sp(GAP),
      k('F9', 'F9', F), k('F10', 'F10', F), k('F11', 'F11', F), k('F12', 'F12', F, { fn: 'hibernate' }), sp(GAP),
      k('PrintScreen', 'PrtSc', F, { cls: 'wide-label' }),
      k('ScrollLock', 'ScrLk', F, { cls: 'wide-label' }),
      k('Pause', 'Pause', F, { cls: 'wide-label' }), sp(GAP),
      k('Insert', 'Insert', EDIT, { cls: 'wide-label' }),
      k('Delete', 'Delete', EDIT, { cls: 'wide-label' }),
      k('Home', 'Home', EDIT, { cls: 'wide-label', fn: 'sunhi' }),
      k('End', 'End', EDIT, { cls: 'wide-label', fn: 'sunlo' }),
      k('PageUp', 'PgUp', EDIT, { cls: 'wide-label', fn: 'lamp' }),
      k('PageDown', 'PgDn', EDIT, { cls: 'wide-label' })
    ]},
    { keys: [
      k('Backquote', '`', 1, { sub: '~', ch: '`' }),
      k('Digit1', '1', 1, { sub: '!', ch: '1' }), k('Digit2', '2', 1, { sub: '@', ch: '2' }),
      k('Digit3', '3', 1, { sub: '#', ch: '3' }), k('Digit4', '4', 1, { sub: '$', ch: '4' }),
      k('Digit5', '5', 1, { sub: '%', ch: '5' }), k('Digit6', '6', 1, { sub: '^', ch: '6' }),
      k('Digit7', '7', 1, { sub: '&', ch: '7' }), k('Digit8', '8', 1, { sub: '*', ch: '8' }),
      k('Digit9', '9', 1, { sub: '(', ch: '9' }), k('Digit0', '0', 1, { sub: ')', ch: '0' }),
      k('Minus', '-', 1, { sub: '_', ch: '-' }), k('Equal', '=', 1, { sub: '+', ch: '=' }),
      k('Backspace', 'Backspace', 2, { cls: 'wide-label' })
    ]},
    { keys: [
      k('Tab', 'Tab', 1.5, { cls: 'wide-label', ch: '\t' }),
      k('KeyQ', 'Q', 1, { ch: 'q' }), k('KeyW', 'W', 1, { ch: 'w' }), k('KeyE', 'E', 1, { ch: 'e' }),
      k('KeyR', 'R', 1, { ch: 'r' }), k('KeyT', 'T', 1, { ch: 't' }), k('KeyY', 'Y', 1, { ch: 'y' }),
      k('KeyU', 'U', 1, { ch: 'u' }), k('KeyI', 'I', 1, { ch: 'i' }), k('KeyO', 'O', 1, { ch: 'o' }),
      k('KeyP', 'P', 1, { ch: 'p' }),
      k('BracketLeft', '[', 1, { sub: '{', ch: '[' }), k('BracketRight', ']', 1, { sub: '}', ch: ']' }),
      k('Backslash', '\\', 1.5, { sub: '|', ch: '\\' })
    ]},
    { keys: [
      k('CapsLock', 'Caps Lock', 1.75, { cls: 'wide-label' }),
      k('KeyA', 'A', 1, { ch: 'a' }), k('KeyS', 'S', 1, { ch: 's' }), k('KeyD', 'D', 1, { ch: 'd' }),
      k('KeyF', 'F', 1, { ch: 'f' }), k('KeyG', 'G', 1, { ch: 'g' }), k('KeyH', 'H', 1, { ch: 'h' }),
      k('KeyJ', 'J', 1, { ch: 'j' }), k('KeyK', 'K', 1, { ch: 'k' }), k('KeyL', 'L', 1, { ch: 'l' }),
      k('Semicolon', ';', 1, { sub: ':', ch: ';' }), k('Quote', "'", 1, { sub: '"', ch: "'" }),
      k('Enter', 'Enter', 2.25, { cls: 'wide-label', ch: '\n' })
    ]},
    { keys: [
      k('ShiftLeft', 'Shift', 2, { cls: 'wide-label' }),
      k('KeyZ', 'Z', 1, { ch: 'z' }), k('KeyX', 'X', 1, { ch: 'x' }), k('KeyC', 'C', 1, { ch: 'c' }),
      k('KeyV', 'V', 1, { ch: 'v' }), k('KeyB', 'B', 1, { ch: 'b' }), k('KeyN', 'N', 1, { ch: 'n' }),
      k('KeyM', 'M', 1, { ch: 'm' }),
      k('Comma', ',', 1, { sub: '<', ch: ',' }), k('Period', '.', 1, { sub: '>', ch: '.' }),
      k('Slash', '/', 1, { sub: '?', ch: '/' }),
      k('ShiftRight', 'Shift', 0.85, { cls: 'wide-label' }),
      k('BrowserBack', '', 0.48, { cls: 'browser', icon: 'back', name: 'Browser back' }),
      k('ArrowUp', '▲', 0.83, { cls: 'arrow' }),
      k('BrowserForward', '', 0.48, { cls: 'browser', icon: 'fwd', name: 'Browser forward' }),
      sp(0.36)
    ]},
    { keys: [
      k('Fn', 'Fn', 1, { cls: 'fn' }),
      k('ControlLeft', 'Ctrl', 1, { cls: 'wide-label' }),
      k('AltLeft', 'Alt', 1.25, { cls: 'wide-label' }),
      k('Space', '', 6.75, { ch: ' ', name: 'Space' }),
      k('AltRight', 'Alt', 1.25, { cls: 'wide-label' }),
      k('ControlRight', 'Ctrl', 1.25, { cls: 'wide-label' }),
      k('ArrowLeft', '◀', 0.83, { cls: 'arrow' }),
      k('ArrowDown', '▼', 0.84, { cls: 'arrow' }),
      k('ArrowRight', '▶', 0.83, { cls: 'arrow' })
    ]}
  ];

  /* Where the shine ends up on a keyboard someone actually used: the
     home row and the letters English leans on, the space bar, and the
     two keys every hand reaches for without looking. */
  var WEAR = {
    KeyA: 2, KeyS: 2, KeyD: 2, KeyF: 2, KeyJ: 2, KeyE: 2, KeyR: 2, KeyT: 2,
    KeyN: 2, KeyI: 2, KeyO: 2, Space: 2, Backspace: 2, Enter: 2,
    ShiftLeft: 2, ControlLeft: 2,
    KeyQ: 1, KeyW: 1, KeyY: 1, KeyU: 1, KeyP: 1, KeyG: 1, KeyH: 1, KeyK: 1,
    KeyL: 1, KeyZ: 1, KeyC: 1, KeyV: 1, KeyB: 1, KeyM: 1, Comma: 1, Period: 1,
    Tab: 1, CapsLock: 1, Fn: 1, AltLeft: 1, ShiftRight: 1, Escape: 1, Delete: 1,
    ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1
  };

  var byCode = Object.create(null);

  function svg(d, cls) {
    var NS = 'http://www.w3.org/2000/svg';
    var el = document.createElementNS(NS, 'svg');
    el.setAttribute('viewBox', '0 0 12 12');
    el.setAttribute('class', cls);
    el.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    el.appendChild(path);
    return el;
  }

  function build(root, onKeyClick) {
    var frag = document.createDocumentFragment();

    ROWS.forEach(function (row) {
      var r = document.createElement('div');
      r.className = 'krow' + (row.cls ? ' ' + row.cls : '');
      row.keys.forEach(function (key) {
        var el = document.createElement(key.spacer ? 'div' : 'button');
        /* A fixed share of the row rather than a flex weight, so a column
           lands in the same place on every row however many keys the row
           holds — the up arrow has to sit exactly over the down arrow. */
        el.style.flex = '0 0 ' + (key.w * 100 / UNITS).toFixed(4) + '%';
        if (key.spacer) {
          el.className = 'key spacer';
          el.setAttribute('aria-hidden', 'true');
        } else {
          el.type = 'button';
          el.className = 'key' + (key.cls ? ' ' + key.cls : '');
          el.dataset.code = key.code;
          if (WEAR[key.code]) el.dataset.wear = WEAR[key.code];
          if (key.fn) el.classList.add('has-fn');

          var cap = document.createElement('span');
          cap.className = 'cap';
          if (key.sub) {
            el.classList.add('dual');
            var sub = document.createElement('span');
            sub.className = 'sub';
            sub.textContent = key.sub;
            cap.appendChild(sub);
          }
          var main = document.createElement('span');
          main.className = 'main';
          main.textContent = key.label;
          cap.appendChild(main);
          if (key.fn) cap.appendChild(svg(ICONS[key.fn], 'fnl'));
          if (key.icon) cap.appendChild(svg(ICONS[key.icon], 'glyph'));
          el.appendChild(cap);

          el.tabIndex = -1;
          el.setAttribute('aria-label', key.label || key.name || key.code);
          byCode[key.code] = el;
          el.addEventListener('mousedown', function (e) { e.preventDefault(); }); // never steal focus
          el.addEventListener('click', function (e) { onKeyClick(key, e); });
        }
        r.appendChild(el);
      });
      frag.appendChild(r);
    });

    // keep the TrackPoint on top of the freshly-built rows
    var nub = root.querySelector('.trackpoint');
    root.insertBefore(frag, nub || null);
  }

  /* physical key -> cap on screen */
  function press(code) {
    var el = byCode[code];
    if (el) el.classList.add('down');
  }
  function release(code) {
    var el = byCode[code];
    if (el) el.classList.remove('down');
  }
  function releaseAll() {
    Object.keys(byCode).forEach(function (c) { byCode[c].classList.remove('down'); });
  }
  global.TPKeyboard = {
    build: build, press: press, release: release, releaseAll: releaseAll
  };
})(window);
