/* ============================================================
   keyboard.js — the seven-row ThinkPad keyboard
   Builds the deck, mirrors real keystrokes, and lets you type
   by clicking the keys. Fn sits in the corner where it belongs.
   ============================================================ */
(function (global) {
  'use strict';

  function k(code, label, w, opts) {
    var o = opts || {};
    return { code: code, label: label, w: w || 1, sub: o.sub, ch: o.ch, cls: o.cls, toggle: o.toggle };
  }
  function sp(w) { return { spacer: true, w: w }; }

  /* Widths per row sum to 15 so the columns line up like a real deck. */
  var ROWS = [
    { cls: 'fn-row', keys: [
      k('Escape', 'Esc', 1.2, { cls: 'wide-label' }), sp(0.4),
      k('F1', 'F1', 0.8), k('F2', 'F2', 0.8), k('F3', 'F3', 0.8), k('F4', 'F4', 0.8), sp(0.35),
      k('F5', 'F5', 0.8), k('F6', 'F6', 0.8), k('F7', 'F7', 0.8), k('F8', 'F8', 0.8), sp(0.35),
      k('F9', 'F9', 0.8), k('F10', 'F10', 0.8), k('F11', 'F11', 0.8), k('F12', 'F12', 0.8), sp(0.3),
      k('Home', 'Home', 0.7, { cls: 'wide-label' }), k('End', 'End', 0.7, { cls: 'wide-label' }),
      k('Insert', 'Ins', 0.7, { cls: 'wide-label' }), k('Delete', 'Del', 0.7, { cls: 'wide-label' })
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
      k('CapsLock', 'Caps', 1.75, { cls: 'wide-label', toggle: 'cap' }),
      k('KeyA', 'A', 1, { ch: 'a' }), k('KeyS', 'S', 1, { ch: 's' }), k('KeyD', 'D', 1, { ch: 'd' }),
      k('KeyF', 'F', 1, { ch: 'f' }), k('KeyG', 'G', 1, { ch: 'g' }), k('KeyH', 'H', 1, { ch: 'h' }),
      k('KeyJ', 'J', 1, { ch: 'j' }), k('KeyK', 'K', 1, { ch: 'k' }), k('KeyL', 'L', 1, { ch: 'l' }),
      k('Semicolon', ';', 1, { sub: ':', ch: ';' }), k('Quote', "'", 1, { sub: '"', ch: "'" }),
      k('Enter', 'Enter', 2.25, { cls: 'wide-label', ch: '\n' })
    ]},
    { keys: [
      k('ShiftLeft', 'Shift', 2.25, { cls: 'wide-label' }),
      k('KeyZ', 'Z', 1, { ch: 'z' }), k('KeyX', 'X', 1, { ch: 'x' }), k('KeyC', 'C', 1, { ch: 'c' }),
      k('KeyV', 'V', 1, { ch: 'v' }), k('KeyB', 'B', 1, { ch: 'b' }), k('KeyN', 'N', 1, { ch: 'n' }),
      k('KeyM', 'M', 1, { ch: 'm' }),
      k('Comma', ',', 1, { sub: '<', ch: ',' }), k('Period', '.', 1, { sub: '>', ch: '.' }),
      k('Slash', '/', 1, { sub: '?', ch: '/' }),
      k('ShiftRight', 'Shift', 1.75, { cls: 'wide-label' }),
      k('ArrowUp', '▲', 1)
    ]},
    { keys: [
      k('Fn', 'Fn', 1, { cls: 'fn' }),
      k('ControlLeft', 'Ctrl', 1, { cls: 'wide-label' }),
      k('AltLeft', 'Alt', 1.25, { cls: 'wide-label' }),
      k('Space', '', 6.25, { ch: ' ' }),
      k('AltRight', 'Alt', 1.25, { cls: 'wide-label' }),
      k('ControlRight', 'Ctrl', 1.25, { cls: 'wide-label' }),
      k('ArrowLeft', '◀', 1), k('ArrowDown', '▼', 1), k('ArrowRight', '▶', 1)
    ]}
  ];

  var byCode = Object.create(null);

  function build(root, onKeyClick) {
    var frag = document.createDocumentFragment();

    ROWS.forEach(function (row) {
      var r = document.createElement('div');
      r.className = 'krow' + (row.cls ? ' ' + row.cls : '');
      row.keys.forEach(function (key) {
        var el = document.createElement(key.spacer ? 'div' : 'button');
        el.style.flex = key.w + ' 1 0';
        if (key.spacer) {
          el.className = 'key spacer';
          el.setAttribute('aria-hidden', 'true');
        } else {
          el.type = 'button';
          el.className = 'key' + (key.cls ? ' ' + key.cls : '');
          el.dataset.code = key.code;
          if (key.ch !== undefined) el.dataset.ch = key.ch;
          if (key.sub) {
            el.classList.add('dual');
            el.innerHTML = '<span class="sub"></span><span class="main"></span>';
            el.firstChild.textContent = key.sub;
            el.lastChild.textContent = key.label;
          } else {
            el.textContent = key.label;
          }
          el.tabIndex = -1;
          el.setAttribute('aria-label', key.label || 'Space');
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
  function tap(code, ms) {
    press(code);
    setTimeout(function () { release(code); }, ms || 90);
  }

  global.TPKeyboard = {
    build: build, press: press, release: release, releaseAll: releaseAll, tap: tap,
    el: function (code) { return byCode[code]; }
  };
})(window);
