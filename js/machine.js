/* ============================================================
   machine.js — the hardware
   Panel geometry, the indicator lights, the ThinkLight, standby,
   the TrackPoint, key click, the battery, and the deck itself.
   Knows about the case and the screen; knows nothing about notes.
   ============================================================ */
(function (global) {
  'use strict';
  var TP = global.TP = global.TP || {};

  var $ = function (s, r) { return (r || document).querySelector(s); };

  var deps = {};
  var body, desk, machineEl, screenEl, editor;
  var ledPwr, ledBat, ledSlp, ledHdd, ledCap, ledNum, batteryCell;
  var batteryRepaint = null;

  var ASPECTS = { '4:3': 4 / 3, '16:10': 1.6 };
  var MIN_FIT_WIDTH = 820;

  function prefs() { return deps.prefs(); }

  function init(options) {
    deps = options;
    body = document.body;
    desk = $('#desk');
    machineEl = $('#machine');
    screenEl = $('.screen');
    editor = options.editor;

    ledPwr = $('.led-pwr'); ledBat = $('.led-bat'); ledSlp = $('.led-slp');
    ledHdd = $('.led-hdd'); ledCap = $('.led-cap'); ledNum = $('.led-num');
    batteryCell = ledBat.parentNode;

    addLightCone();
    wireButtons();
    wireTrackPoint();
    wireKeyMirror();
    window.addEventListener('resize', scheduleFit);
  }

  /* ---------------------------------------------------------
     panel geometry — a 4:3 screen, and a case that fits the window

     Measure the machine with the panel filling the height, subtract the
     case from the space available, then hand the panel back a box of the
     right shape and the case a width to match.
     --------------------------------------------------------- */
  function fit() {
    body.classList.remove('fitted');
    machineEl.style.removeProperty('--machine-w');
    machineEl.style.removeProperty('--screen-h');
    var p = prefs();
    if (!p.showCase || p.aspect === 'fill') return;

    var ratio = ASPECTS[p.aspect] || ASPECTS['4:3'];
    var deskStyle = window.getComputedStyle(desk);
    var availW = desk.clientWidth -
      (parseFloat(deskStyle.paddingLeft) || 0) - (parseFloat(deskStyle.paddingRight) || 0);
    if (availW < MIN_FIT_WIDTH) return;          /* phone-shaped window: stay fluid */

    var availH = machineEl.clientHeight;         /* what the flex row grants the case */
    var pad = padOf(screenEl);                   /* the well the panel sits in */
    var chromeV = availH - screenEl.offsetHeight;
    var chromeH = machineEl.clientWidth - screenEl.offsetWidth;

    var lcdH = Math.max(180, availH - chromeV - pad);
    var lcdW = lcdH * ratio;

    if (lcdW + pad + chromeH > availW) {         /* short and wide: width decides */
      lcdW = availW - chromeH - pad;
      lcdH = lcdW / ratio;
    }

    machineEl.style.setProperty('--screen-h', Math.round(lcdH + pad) + 'px');
    machineEl.style.setProperty('--machine-w', Math.round(lcdW + pad + chromeH) + 'px');
    body.classList.add('fitted');
  }

  /* read the well's padding from the stylesheet rather than guessing it */
  function padOf(el) {
    var s = window.getComputedStyle(el);
    return (parseFloat(s.paddingTop) || 0) + (parseFloat(s.paddingBottom) || 0);
  }

  /* Coalesce with a frame where we can, but a background tab never gets
     one — so a timer races it and whichever arrives first does the work. */
  var fitPending = false;
  function scheduleFit() {
    if (fitPending) return;
    fitPending = true;
    var run = function () {
      if (!fitPending) return;
      fitPending = false;
      fit();
    };
    requestAnimationFrame(run);
    setTimeout(run, 150);
  }

  /* ---------------------------------------------------------
     what the preferences do to the case
     --------------------------------------------------------- */
  function apply() {
    var p = prefs();
    body.dataset.case = p.caseFinish;
    body.dataset.desk = p.desk;
    body.dataset.cap = p.capStyle;
    body.classList.toggle('no-case', !p.showCase);
    body.classList.toggle('no-keyboard', !p.deck);
    body.classList.toggle('no-tpb', !p.tpButtons);
    body.classList.toggle('no-leds', !p.leds);
    body.classList.toggle('no-glare', !p.glare);
    body.classList.toggle('no-grain', !p.grain);
    body.classList.toggle('muted', !p.sound);
    body.classList.toggle('deck-flat', !!p.deckTilt);
    desk.classList.toggle('night', !!p.night);
    if (batteryRepaint) batteryRepaint();
    if (p.deck) buildKeyboardOnce();
    fit();
  }

  /* ---------------------------------------------------------
     indicator lights
     --------------------------------------------------------- */
  function blink(led) {
    if (!led) return;
    led.classList.remove('blink');
    void led.offsetWidth;
    led.classList.add('blink');
  }
  function leds() {
    return { pwr: ledPwr, bat: ledBat, slp: ledSlp, hdd: ledHdd, cap: ledCap, num: ledNum };
  }

  /* The BAT light follows this laptop's actual battery where the browser
     will say (Chrome and Edge); everywhere else it stays plain green. */
  function paintBattery(b) {
    if (!prefs().battery) {
      ledBat.classList.remove('amber', 'pulse');
      ledBat.classList.add('on');
      batteryCell.removeAttribute('title');
      return;
    }
    var pct = Math.round(b.level * 100);
    var full = b.level >= 0.98;
    ledBat.classList.remove('amber', 'pulse', 'on');
    if (b.charging && !full) ledBat.classList.add('amber', 'pulse');   /* taking a charge */
    else if (!b.charging && b.level <= 0.2) ledBat.classList.add('amber');
    else ledBat.classList.add('on');                                   /* charged, or plenty */
    batteryCell.title = 'Battery ' + pct + '%' +
      (b.charging ? (full ? ' — charged' : ' — charging') : '');
  }
  function watchBattery() {
    if (!navigator.getBattery) return;
    navigator.getBattery().then(function (b) {
      batteryRepaint = function () { paintBattery(b); };
      batteryRepaint();
      b.addEventListener('levelchange', batteryRepaint);
      b.addEventListener('chargingchange', batteryRepaint);
    }, function () { /* refused: leave the light alone */ });
  }

  /* ---------------------------------------------------------
     sound — a synthesised buckling-spring-ish click
     --------------------------------------------------------- */
  var Sound = {
    ctx: null,
    ensure: function () {
      if (!this.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    click: function (down) {
      if (!prefs().sound) return;
      var ctx = this.ensure();
      if (!ctx) return;
      var now = ctx.currentTime;
      var len = Math.floor(ctx.sampleRate * 0.03);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
      var src = ctx.createBufferSource(); src.buffer = buf;
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = down ? 2600 : 3400;
      bp.Q.value = 1.1;
      var g = ctx.createGain();
      g.gain.setValueAtTime(prefs().vol * (down ? 0.9 : 0.5), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
      src.connect(bp); bp.connect(g); g.connect(ctx.destination);
      src.start(now); src.stop(now + 0.04);

      if (down) {                                  /* the plunger bottoming out */
        var osc = ctx.createOscillator(), og = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.03);
        og.gain.setValueAtTime(prefs().vol * 0.35, now);
        og.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        osc.connect(og); og.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.06);
      }
    },
    beep: function () {
      var ctx = this.ensure();
      if (!ctx || !prefs().sound) return;
      var now = ctx.currentTime;
      var osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'square'; osc.frequency.value = 880;
      g.gain.setValueAtTime(prefs().vol * 0.18, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.2);
    }
  };

  /* ---------------------------------------------------------
     standby, ThinkLight, volume
     --------------------------------------------------------- */
  function isAsleep() { return desk.classList.contains('standby'); }

  function setStandby(on) {
    desk.classList.toggle('standby', on);
    if (on) {
      if (deps.onSleep) deps.onSleep();
      editor.blur();
      ledPwr.classList.remove('on');
      ledSlp.classList.add('pulse');
      TPKeyboard.releaseAll();
      deps.setMsg('Standby');
    } else {
      ledPwr.classList.add('on');
      ledSlp.classList.remove('pulse');
      editor.focus();
      deps.setMsg('Resumed');
    }
  }

  function toggleThinkLight() {
    var p = prefs();
    p.night = !p.night;
    deps.onPrefsChanged();
    deps.setMsg(p.night ? 'ThinkLight on' : 'ThinkLight off');
  }

  function setVolume(delta) {
    var p = prefs();
    if (delta === 0) {
      p.sound = !p.sound;
      deps.onPrefsChanged();
      if (p.sound) Sound.click(true);
      deps.setMsg(p.sound ? 'Key click on' : 'Key click muted');
      return;
    }
    p.sound = true;
    p.vol = Math.max(0.05, Math.min(1, p.vol + delta));
    deps.onPrefsChanged();
    Sound.click(true);
    deps.setMsg('Key click ' + Math.round(p.vol * 100) + '%');
  }

  /* ---------------------------------------------------------
     the panel light, and the light it throws on the deck
     --------------------------------------------------------- */
  function addLightCone() {
    var base = $('.base');
    var spill = document.createElement('div');
    spill.className = 'screen-spill';
    spill.setAttribute('aria-hidden', 'true');
    var cone = document.createElement('div');
    cone.className = 'light-cone';
    cone.setAttribute('aria-hidden', 'true');
    base.appendChild(spill);
    base.appendChild(cone);
  }

  /* ---------------------------------------------------------
     buttons on the case
     --------------------------------------------------------- */
  function wireButtons() {
    $('#thinklightBtn').addEventListener('click', toggleThinkLight);
    $('#accessBtn').addEventListener('click', function () { deps.onAccess(); });
    $('#powerBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      setStandby(!isAsleep());
    });
    $('#volUp').addEventListener('click', function () { setVolume(0.15); });
    $('#volDown').addEventListener('click', function () { setVolume(-0.15); });
    $('#volMute').addEventListener('click', function () { setVolume(0); });
    $('#tpbLeft').addEventListener('click', function () { deps.onPrevNote(); });
    $('#tpbRight').addEventListener('click', function () { deps.onNextNote(); });
    $('#tpbCenter').addEventListener('click', function () {
      deps.setMsg('Hold the red nub and push to scroll');
    });

    /* any prod wakes it up, except the button that put it to sleep */
    desk.addEventListener('mousedown', function (e) {
      if (!isAsleep()) return;
      if (e.target.closest && e.target.closest('#powerBtn')) return;
      setStandby(false);
    }, true);
  }

  /* ---------------------------------------------------------
     TrackPoint: push to scroll, like the real thing
     --------------------------------------------------------- */
  function wireTrackPoint() {
    var nub = $('#trackpoint');
    var dragging = false, originY = 0, velocity = 0, raf = null;

    function loop() {
      if (!dragging) { raf = null; return; }
      if (Math.abs(velocity) > 0.4) editor.scrollTop += velocity;
      raf = requestAnimationFrame(loop);
    }
    nub.addEventListener('pointerdown', function (e) {
      dragging = true;
      originY = e.clientY;
      velocity = 0;
      nub.classList.add('dragging');
      nub.setPointerCapture(e.pointerId);
      e.preventDefault();
      if (!raf) raf = requestAnimationFrame(loop);
    });
    nub.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dy = e.clientY - originY;
      var dead = 2;
      velocity = Math.abs(dy) < dead ? 0 : (dy - Math.sign(dy) * dead) * 0.28;
      nub.style.transform = 'translate(-50%,-50%) translateY(' +
        Math.max(-2, Math.min(2, dy / 12)) + 'px)';
    });
    function stop(e) {
      if (!dragging) return;
      dragging = false;
      velocity = 0;
      nub.classList.remove('dragging');
      nub.style.transform = 'translate(-50%,-50%)';
      try { nub.releasePointerCapture(e.pointerId); } catch (err) { /* already gone */ }
    }
    nub.addEventListener('pointerup', stop);
    nub.addEventListener('pointercancel', stop);
    nub.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { editor.scrollTop += 40; e.preventDefault(); }
      if (e.key === 'ArrowUp') { editor.scrollTop -= 40; e.preventDefault(); }
    });
  }

  /* ---------------------------------------------------------
     the deck: built on first sight, then mirrors what you type
     --------------------------------------------------------- */
  var keyboardBuilt = false;
  function buildKeyboardOnce() {
    if (keyboardBuilt) return;
    keyboardBuilt = true;
    TPKeyboard.build($('#keyboard'), function (key, e) {
      Sound.click(true);
      if (isAsleep()) return;
      deps.onKeyCap(key, e);
    });
  }

  function wireKeyMirror() {
    window.addEventListener('keydown', function (e) {
      TPKeyboard.press(e.code);
      if (!e.repeat) Sound.click(true);
      if (e.getModifierState) {
        ledCap.classList.toggle('on', e.getModifierState('CapsLock'));
        ledNum.classList.toggle('on', e.getModifierState('NumLock'));
      }
    });
    window.addEventListener('keyup', function (e) {
      TPKeyboard.release(e.code);
      Sound.click(false);
    });
    window.addEventListener('blur', function () { TPKeyboard.releaseAll(); });
  }

  TP.machine = {
    init: init,
    apply: apply,
    fit: fit,
    scheduleFit: scheduleFit,
    blink: blink,
    leds: leds,
    sound: Sound,
    setStandby: setStandby,
    isAsleep: isAsleep,
    toggleThinkLight: toggleThinkLight,
    setVolume: setVolume,
    watchBattery: watchBattery,
    buildKeyboard: buildKeyboardOnce
  };
})(window);
