/* ============================================================
   app.js — ThinkPad Notes
   Plain text, stored in this browser only.
   ============================================================ */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var NOTES_KEY = 'thinkpad.notes.v1';
  var PREFS_KEY = 'thinkpad.prefs.v1';
  var QUOTA_BUDGET = 5 * 1024 * 1024;   /* what browsers usually allow per origin */
  var TRASH_DAYS = 30;

  /* If anything throws before the app is running — a script that failed
     to load, a browser that refuses storage — the panel would otherwise
     just sit there grey. Show what happened and offer a way out. */
  var booted = false;
  var failureShown = false;

  function showBootFailure(err) {
    if (failureShown) return;
    failureShown = true;
    var host = document.getElementById('lcdInner') || document.body;
    host.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.setAttribute('style',
      'position:absolute;inset:0;overflow:auto;padding:22px;background:#d4d0c8;color:#111;' +
      'font:13px/1.5 Tahoma,Verdana,sans-serif');
    var h = document.createElement('h1');
    h.setAttribute('style', 'font:bold 15px Tahoma,sans-serif;margin:0 0 10px');
    h.textContent = 'ThinkPad Notes did not start';
    var p1 = document.createElement('p');
    p1.setAttribute('style', 'margin:0 0 10px');
    p1.textContent = 'Your notes are still in this browser. Nothing has been erased.';
    var pre = document.createElement('pre');
    pre.setAttribute('style',
      'white-space:pre-wrap;background:#fff;padding:8px;margin:0 0 12px;' +
      'font:12px/1.4 "Courier New",monospace;border:1px solid #808080');
    pre.textContent = String((err && (err.stack || err.message)) || err);

    var row = document.createElement('div');
    row.setAttribute('style', 'display:flex;gap:8px;flex-wrap:wrap');
    function button(label, act) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.setAttribute('style',
        'padding:4px 10px;font:13px Tahoma,sans-serif;background:#d4d0c8;' +
        'border:2px outset #f0f0f0;cursor:pointer');
      b.addEventListener('click', act);
      row.appendChild(b);
    }
    button('Reset settings and reload', function () {
      try { localStorage.removeItem(PREFS_KEY); } catch (e) { /* nothing else to try */ }
      window.location.reload();
    });
    button('Show my notes as text', function () {
      var ta = document.createElement('textarea');
      ta.setAttribute('style',
        'width:100%;height:40vh;margin-top:12px;font:12px "Courier New",monospace');
      try { ta.value = localStorage.getItem(NOTES_KEY) || '(nothing stored)'; }
      catch (e) { ta.value = 'localStorage is unavailable in this browser.'; }
      wrap.appendChild(ta);
      ta.select();
    });

    wrap.appendChild(h);
    wrap.appendChild(p1);
    wrap.appendChild(pre);
    wrap.appendChild(row);
    host.appendChild(wrap);
  }

  window.addEventListener('error', function (e) {
    if (!booted) showBootFailure(e.error || new Error(e.message));
  });

  /* ---------------------------------------------------------
     elements
     --------------------------------------------------------- */
  var desk = $('#desk'), body = document.body;
  var lcd = $('#lcd'), editor = $('#editor'), listbox = $('#listbox'), search = $('#search');
  var winTitle = $('#winTitle'), stMsg = $('#stMsg'), stPos = $('#stPos'),
      stCount = $('#stCount'), stFont = $('#stFont');
  var menubar = $('#menubar'), modalLayer = $('#modalLayer'), printSheet = $('#printSheet');
  var paneNotes = $('#paneNotes'), splitter = $('#splitter'), workspace = $('#workspace');
  var keyboardEl = $('#keyboard'), trackpoint = $('#trackpoint'), fileInput = $('#fileInput');
  var ledHdd = $('.led-hdd'), ledPwr = $('.led-pwr'), ledSlp = $('.led-slp'),
      ledCap = $('.led-cap'), ledNum = $('.led-num'), ledBat = $('.led-bat');

  /* ---------------------------------------------------------
     storage
     --------------------------------------------------------- */
  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  /* thinkpad-notes.html#reset starts with standard settings, for when a
     choice in here makes the app unusable. Notes are left alone. */
  if (window.location.hash === '#reset') {
    try { localStorage.removeItem(PREFS_KEY); } catch (e) { /* nothing else to try */ }
    try { window.history.replaceState(null, '', window.location.pathname); } catch (e) { /* fine */ }
  }

  var prefs = TPSettings.migrate(readJSON(PREFS_KEY, null));
  var db = readJSON(NOTES_KEY, null);
  if (!db || !Array.isArray(db.notes)) db = { notes: [], activeId: null };

  function savePrefs() { writeJSON(PREFS_KEY, prefs); }

  var saveTimer = null, diskFullWarned = false;
  function flushSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    var note = active();
    if (note) {
      note.body = editor.value;
      note.caret = editor.selectionStart;
    }
    var ok = writeJSON(NOTES_KEY, db);
    if (ok) {
      blink(ledHdd);
      checkQuota();
      setMsg('Saved ' + timeStamp(new Date()));
    } else {
      ledHdd.classList.add('amber');
      setMsg('Disk full — this note is NOT saved');
      if (!diskFullWarned) {
        diskFullWarned = true;
        dialog({
          title: 'ThinkPad Notes',
          bodyHTML: '<p><b>Local storage is full.</b></p><p>The browser refused to write. ' +
                    'Export a few long notes to .txt and delete them to free space.</p>'
        });
      }
    }
    return ok;
  }
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 400);
    setMsg('Editing…', true);
  }

  /* ---------------------------------------------------------
     notes model
     --------------------------------------------------------- */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function liveNotes() {
    return db.notes.filter(function (n) { return !n.deleted; });
  }
  function trashCount() {
    return db.notes.length - liveNotes().length;
  }
  function purgeTrash() {
    var cutoff = Date.now() - TRASH_DAYS * 864e5;
    var before = db.notes.length;
    db.notes = db.notes.filter(function (n) { return !n.deleted || n.deleted > cutoff; });
    return before - db.notes.length;
  }
  function noteById(id) {
    for (var i = 0; i < db.notes.length; i++) if (db.notes[i].id === id) return db.notes[i];
    return null;
  }
  function active() {
    for (var i = 0; i < db.notes.length; i++) if (db.notes[i].id === db.activeId) return db.notes[i];
    return null;
  }
  function firstLine(text) {
    var lines = String(text || '').split('\n');
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (t) return { text: t, index: i };
    }
    return { text: '', index: -1 };
  }
  function titleOf(note) {
    var f = firstLine(note.body).text;
    return f ? (f.length > 60 ? f.slice(0, 60) + '…' : f) : 'Untitled';
  }
  function previewOf(note) {
    var lines = String(note.body || '').split('\n');
    var head = firstLine(note.body).index;
    for (var i = head + 1; i < lines.length; i++) {
      var t = lines[i].trim();
      if (t) return t.length > 70 ? t.slice(0, 70) + '…' : t;
    }
    return '';
  }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function timeStamp(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function clockStamp(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function dateStamp(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function friendly(ts) {
    var d = new Date(ts), now = new Date();
    if (prefs.dateFormat === 'iso') return dateStamp(d) + ' ' + clockStamp(d);
    var sameDay = d.toDateString() === now.toDateString();
    var yest = new Date(now.getTime() - 864e5).toDateString() === d.toDateString();
    if (sameDay) return clockStamp(d);
    if (yest) return 'Yesterday ' + clockStamp(d);
    return dateStamp(d) + ' ' + clockStamp(d);
  }

  function newNote(seedText) {
    flushSave();
    var note = {
      id: uid(), body: seedText || '', created: Date.now(), updated: Date.now(), caret: 0
    };
    db.notes.unshift(note);
    db.activeId = note.id;
    editor.value = note.body;
    search.value = '';
    renderAll();
    flushSave();
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
    setMsg('New note');
    return note;
  }

  function selectNote(id, keepFocus) {
    if (id === db.activeId) return;
    flushSave();
    db.activeId = id;
    var note = active();
    editor.value = note ? note.body : '';
    renderAll();
    if (note && typeof note.caret === 'number') {
      var c = Math.min(note.caret, editor.value.length);
      editor.setSelectionRange(c, c);
    }
    if (keepFocus !== false) editor.focus();
    updatePos();
    writeJSON(NOTES_KEY, db);
  }

  function deleteNote() {
    var note = active();
    if (!note) return;
    dialog({
      title: 'Delete note',
      bodyHTML: '<p>Delete <b></b>?</p>' +
                '<p class="hint">It goes to the trash for ' + TRASH_DAYS + ' days. Undo from the ' +
                'status bar, or empty the trash yourself in Settings &gt; Data.</p>',
      onBuild: function (bodyEl) { $('b', bodyEl).textContent = titleOf(note); },
      buttons: [
        { label: 'Delete', primary: true, act: function () {
            var list = visibleNotes();
            var idx = list.indexOf(note);
            var next = list[idx + 1] || list[idx - 1] || null;
            var name = titleOf(note);

            flushSave();                       /* keep whatever is on screen */
            note.deleted = Date.now();
            note.updated = Date.now();
            if (next) {
              db.activeId = next.id;
              editor.value = next.body;
            }
            renderAll();
            writeJSON(NOTES_KEY, db);
            if (!liveNotes().length) newNote('');
            else editor.focus();

            setMsg('Deleted "' + name + '"', {
              action: { label: 'Undo', act: function () { undoDelete(note.id); } }
            });
          } },
        { label: 'Cancel' }
      ]
    });
  }

  function undoDelete(id) {
    var note = noteById(id);
    if (!note || !note.deleted) return;
    delete note.deleted;
    note.updated = Date.now();

    /* deleting the last note leaves a blank one behind; drop it again */
    var current = active();
    if (current && current.id !== id && !current.body.trim()) {
      db.notes.splice(db.notes.indexOf(current), 1);
    }
    db.activeId = id;
    editor.value = note.body;
    renderAll();
    writeJSON(NOTES_KEY, db);
    editor.focus();
    setMsg('Restored "' + titleOf(note) + '"');
  }

  function emptyTrash() {
    var n = trashCount();
    if (!n) { setMsg('The trash is already empty'); return; }
    dialog({
      title: 'Empty the trash',
      bodyHTML: '<p>Permanently remove <b></b> deleted note(s)?</p>' +
                '<p class="hint">This one really cannot be undone.</p>',
      onBuild: function (bodyEl) { $('b', bodyEl).textContent = String(n); },
      buttons: [
        { label: 'Empty', primary: true, act: function () {
            db.notes = liveNotes();
            writeJSON(NOTES_KEY, db);
            if (settingsForm) settingsForm.refresh();
            setMsg('Trash emptied');
          } },
        { label: 'Cancel' }
      ]
    });
  }

  function sortNotes(a, b) {
    if (prefs.sort === 'title') {
      return titleOf(a).toLowerCase().localeCompare(titleOf(b).toLowerCase());
    }
    if (prefs.sort === 'created') return b.created - a.created;
    return b.updated - a.updated;
  }
  function visibleNotes() {
    var q = search.value.trim().toLowerCase();
    var list = liveNotes().sort(sortNotes);
    if (!q) return list;
    return list.filter(function (n) {
      return String(n.body || '').toLowerCase().indexOf(q) !== -1;
    });
  }

  /* ---------------------------------------------------------
     rendering
     --------------------------------------------------------- */
  var msgTimer = null, msgExpiry = null;
  function setMsg(text, opts) {
    var o = (typeof opts === 'boolean') ? { quiet: opts } : (opts || {});
    stMsg.textContent = text;
    if (msgTimer) clearTimeout(msgTimer);
    if (msgExpiry) { clearTimeout(msgExpiry); msgExpiry = null; }

    if (o.action) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'st-action';
      b.textContent = o.action.label;
      b.addEventListener('click', o.action.act);
      stMsg.appendChild(document.createTextNode(' '));
      stMsg.appendChild(b);
      msgExpiry = setTimeout(function () { setMsg('Ready', true); }, o.expires || 30000);
    }
    if (!o.quiet) {
      stMsg.classList.add('flash');
      msgTimer = setTimeout(function () { stMsg.classList.remove('flash'); }, 700);
    }
  }
  function blink(led) {
    if (!led) return;
    led.classList.remove('blink');
    void led.offsetWidth;
    led.classList.add('blink');
  }

  function renderList() {
    var list = visibleNotes();
    listbox.textContent = '';
    if (!list.length) {
      var empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = search.value.trim() ? 'No notes match.' : 'No notes yet.';
      listbox.appendChild(empty);
      return;
    }
    list.forEach(function (note) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'note-item' + (note.id === db.activeId ? ' sel' : '');
      b.dataset.id = note.id;
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', note.id === db.activeId ? 'true' : 'false');

      var t = document.createElement('span'); t.className = 'nt'; t.textContent = titleOf(note);
      var p = document.createElement('span'); p.className = 'np'; p.textContent = previewOf(note) || ' ';
      var d = document.createElement('span'); d.className = 'nd'; d.textContent = friendly(note.updated);
      b.appendChild(t); b.appendChild(p); b.appendChild(d);
      listbox.appendChild(b);
    });
  }

  function renderTitle() {
    var note = active();
    winTitle.textContent = (note ? titleOf(note) : 'No note') + ' - ThinkPad Notes';
    document.title = (note ? titleOf(note) : 'ThinkPad Notes');
  }

  function updateCounts() {
    var text = editor.value;
    var words = text.trim() ? text.trim().split(/\s+/).length : 0;
    stCount.textContent = words + (words === 1 ? ' word' : ' words') + ', ' + text.length + ' ch';
  }
  function updatePos() {
    var upto = editor.value.slice(0, editor.selectionStart);
    var lines = upto.split('\n');
    stPos.textContent = 'Ln ' + lines.length + ', Col ' + (lines[lines.length - 1].length + 1);
  }
  function renderAll() {
    renderList();
    renderTitle();
    updateCounts();
    updatePos();
  }

  /* ---------------------------------------------------------
     panel geometry — a 4:3 screen, and a case that fits the window

     Measure the machine with the panel filling the height, subtract the
     case from the space available, then hand the panel back a 4:3 box
     and the case a width to match. Re-run whenever the window resizes
     or a part of the case appears or disappears.
     --------------------------------------------------------- */
  var machine = $('#machine'), screenEl = $('.screen'), MIN_FIT_WIDTH = 820;
  var ASPECTS = { '4:3': 4 / 3, '16:10': 1.6 };

  function fitScreen() {
    body.classList.remove('fitted');
    machine.style.removeProperty('--machine-w');
    machine.style.removeProperty('--screen-h');
    if (!prefs.showCase || prefs.aspect === 'fill') return;

    var ratio = ASPECTS[prefs.aspect] || ASPECTS['4:3'];
    var deskStyle = window.getComputedStyle(desk);
    var availW = desk.clientWidth -
      (parseFloat(deskStyle.paddingLeft) || 0) - (parseFloat(deskStyle.paddingRight) || 0);
    if (availW < MIN_FIT_WIDTH) return;         // phone-shaped window: stay fluid

    var availH = machine.clientHeight;          // what the flex row grants the case
    var pad = 6;                                // .screen padding, both sides
    var chromeV = availH - screenEl.offsetHeight;
    var chromeH = machine.clientWidth - screenEl.offsetWidth;

    var screenH = availH - chromeV;
    var lcdH = Math.max(180, screenH - pad);
    var lcdW = lcdH * ratio;

    if (lcdW + pad + chromeH > availW) {        // short and wide: width decides instead
      lcdW = availW - chromeH - pad;
      lcdH = lcdW / ratio;
    }

    machine.style.setProperty('--screen-h', Math.round(lcdH + pad) + 'px');
    machine.style.setProperty('--machine-w', Math.round(lcdW + pad + chromeH) + 'px');
    body.classList.add('fitted');
  }

  var fitPending = false;
  function scheduleFit() {
    if (fitPending) return;
    fitPending = true;
    requestAnimationFrame(function () { fitPending = false; fitScreen(); });
  }
  window.addEventListener('resize', scheduleFit);

  /* ---------------------------------------------------------
     preferences applied to the machine
     --------------------------------------------------------- */
  function applyPrefs() {
    /* the machine */
    body.dataset.case = prefs.caseFinish;
    body.dataset.desk = prefs.desk;
    body.dataset.cap = prefs.capStyle;
    body.classList.toggle('no-case', !prefs.showCase);
    body.classList.toggle('no-keyboard', !prefs.deck);
    body.classList.toggle('no-tpb', !prefs.tpButtons);
    body.classList.toggle('no-leds', !prefs.leds);
    body.classList.toggle('deck-flat', !!prefs.deckTilt);
    if (batteryRepaint) batteryRepaint();
    body.classList.toggle('no-glare', !prefs.glare);
    body.classList.toggle('no-grain', !prefs.grain);
    body.classList.toggle('muted', !prefs.sound);
    desk.classList.toggle('night', !!prefs.night);

    /* the screen */
    lcd.dataset.theme = prefs.theme;
    body.style.setProperty('--ui-font', TPSettings.UI_FONTS[prefs.uiFont] || TPSettings.UI_FONTS.tahoma);
    body.style.setProperty('--mono-font', TPSettings.MONO_FONTS[prefs.monoFont] || TPSettings.MONO_FONTS.courier);
    body.style.setProperty('--mono-size', prefs.fontSize + 'px');
    body.style.setProperty('--mono-lh', String(prefs.lineHeight));
    body.classList.toggle('no-wrap', !prefs.wrap);
    body.classList.toggle('no-status', !prefs.statusbar);
    editor.setAttribute('wrap', prefs.wrap ? 'soft' : 'off');
    editor.style.tabSize = String(prefs.tabSize);
    editor.spellcheck = !!prefs.spellcheck;

    /* the notes */
    body.classList.toggle('no-list', !prefs.list);
    body.classList.toggle('list-right', prefs.listSide === 'right');
    paneNotes.style.width = prefs.listWidth + 'px';

    stFont.textContent = TPSettings.MONO_NAMES[prefs.monoFont] || prefs.monoFont;
    stFont.title = prefs.preset === 'plex'
      ? 'IBM Plex Mono (2017) — click for the period-correct face'
      : 'Click to switch typeface — Settings for the rest';
    savePrefs();
    fitScreen();
  }

  function applyPreset(name) {
    if (name === 'period') { prefs.uiFont = 'tahoma'; prefs.monoFont = 'courier'; }
    else if (name === 'plex') { prefs.uiFont = 'plex'; prefs.monoFont = 'plex'; }
    prefs.preset = name;
  }
  function setFont(mode) {
    applyPreset(mode);
    applyPrefs();
    if (settingsForm) settingsForm.refresh();
    setMsg(mode === 'plex' ? 'Typeface: IBM Plex — sixteen years early' : 'Typeface: period correct');
  }
  function nudgeSize(dir) {
    prefs.fontSize = Math.max(10, Math.min(20, prefs.fontSize + dir));
    applyPrefs();
    if (settingsForm) settingsForm.refresh();
    setMsg('Note size ' + prefs.fontSize + ' px');
  }
  function toggler(key, msg) {
    return function () {
      prefs[key] = !prefs[key];
      applyPrefs();
      if (settingsForm) settingsForm.refresh();
      if (msg) setMsg(msg + (prefs[key] ? ' on' : ' off'));
    };
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
      if (!prefs.sound) return;
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
      g.gain.setValueAtTime(prefs.vol * (down ? 0.9 : 0.5), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
      src.connect(bp); bp.connect(g); g.connect(ctx.destination);
      src.start(now); src.stop(now + 0.04);

      if (down) { // the low thock of the plunger bottoming out
        var osc = ctx.createOscillator(), og = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.03);
        og.gain.setValueAtTime(prefs.vol * 0.35, now);
        og.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        osc.connect(og); og.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.06);
      }
    },
    beep: function () {
      var ctx = this.ensure();
      if (!ctx || !prefs.sound) return;
      var now = ctx.currentTime;
      var osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'square'; osc.frequency.value = 880;
      g.gain.setValueAtTime(prefs.vol * 0.18, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.2);
    }
  };

  /* ---------------------------------------------------------
     dialogs
     --------------------------------------------------------- */
  var openDialogEl = null, settingsForm = null;
  function dialog(opts) {
    closeDialog();
    var dlg = document.createElement('div');
    dlg.className = 'dlg' + (opts.wide ? ' wide' : '');
    dlg.setAttribute('role', 'dialog');
    dlg.setAttribute('aria-modal', 'true');

    var bar = document.createElement('div');
    bar.className = 'titlebar';
    bar.innerHTML = '<span class="app-icon"></span><span class="title"></span>' +
                    '<span class="tb-buttons"><button type="button" class="tb" aria-label="Close">' +
                    '<b class="g-close"></b></button></span>';
    $('.title', bar).textContent = opts.title || 'ThinkPad Notes';
    $('.tb', bar).addEventListener('click', closeDialog);

    var bodyEl = document.createElement('div');
    bodyEl.className = 'dlg-body';
    bodyEl.innerHTML = opts.bodyHTML || '';
    if (opts.onBuild) opts.onBuild(bodyEl);

    var foot = document.createElement('div');
    foot.className = 'dlg-foot';
    var buttons = opts.buttons || [{ label: 'OK', primary: true }];
    buttons.forEach(function (spec) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn' + (spec.primary ? ' primary' : '');
      b.textContent = spec.label;
      b.addEventListener('click', function () {
        closeDialog();
        if (spec.act) spec.act();
      });
      foot.appendChild(b);
    });

    dlg.appendChild(bar); dlg.appendChild(bodyEl); dlg.appendChild(foot);
    modalLayer.textContent = '';
    modalLayer.appendChild(dlg);
    modalLayer.hidden = false;
    body.classList.add('modal');
    openDialogEl = dlg;
    var firstBtn = $('.dlg-foot .btn', dlg);
    if (firstBtn) firstBtn.focus();
    return dlg;
  }
  function closeDialog() {
    if (!openDialogEl) return;
    settingsForm = null;
    modalLayer.hidden = true;
    modalLayer.textContent = '';
    body.classList.remove('modal');
    openDialogEl = null;
    if (!desk.classList.contains('standby')) editor.focus();
  }
  modalLayer.addEventListener('mousedown', function (e) {
    if (e.target === modalLayer) closeDialog();
  });

  /* ---------------------------------------------------------
     commands
     --------------------------------------------------------- */
  /* Handing the viewer a file. A local page can just click an anchor;
     a published copy has to ask its host, which shows its own prompt. */
  var hostSave = null;
  if (window.claude && typeof window.claude.use === 'function') {
    try {
      window.claude.use('downloads').then(
        function (d) { hostSave = d; },
        function () { hostSave = null; }
      );
    } catch (e) { hostSave = null; }
  }

  function saveFile(filename, text, mime) {
    if (hostSave) {
      hostSave.save({ filename: filename, data: text }).then(function (r) {
        setMsg((r && r.status === 'delivered' ? 'Sent ' : 'Saved ') + filename);
      }, function (err) {
        var code = err && err.code;
        setMsg(code === 'declined' ? 'Save cancelled'
          : 'Could not save ' + filename + (code ? ' — ' + code : ''));
      });
      return;
    }
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    setMsg('Exported ' + filename);
  }

  function saveNow() {
    if (flushSave()) setMsg('Saved to this browser · ' + timeStamp(new Date()));
  }

  function exportTxt() {
    var note = active();
    if (!note) return;
    flushSave();
    var name = titleOf(note).replace(/[\\/:*?"<>|]+/g, '-').replace(/…$/, '').trim() || 'note';
    saveFile(name + '.txt', note.body);
  }

  function exportAll() {
    flushSave();
    var out = liveNotes().sort(sortNotes)
      .map(function (n) {
        return '=== ' + titleOf(n) + ' === (' + friendly(n.updated) + ')\n\n' + n.body;
      }).join('\n\n\n');
    saveFile('thinkpad-notes-' + dateStamp(new Date()) + '.txt', out);
  }

  function importText(text, name) {
    var seed = text;
    if (name && !/^\s*\S/.test(text.split('\n')[0] || '')) seed = name + '\n' + text;
    newNote(seed);
    setMsg('Imported ' + (name || 'text'));
  }

  function printNote() {
    var note = active();
    if (!note) return;
    flushSave();
    printSheet.textContent = '';
    var h = document.createElement('h1'); h.textContent = titleOf(note);
    var m = document.createElement('p'); m.className = 'meta';
    m.textContent = 'Last edited ' + friendly(note.updated);
    var pre = document.createElement('div'); pre.textContent = note.body;
    printSheet.appendChild(h); printSheet.appendChild(m); printSheet.appendChild(pre);
    window.print();
  }

  function insertAtCaret(text) {
    var s = editor.selectionStart, e = editor.selectionEnd;
    editor.setRangeText(text, s, e, 'end');
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function insertDateTime() {
    var d = new Date();
    insertAtCaret(clockStamp(d) + ' ' + dateStamp(d));
    setMsg('Date/time stamped');
  }

  function cycleNote(dir) {
    var list = visibleNotes();
    if (list.length < 2) return;
    var i = 0;
    for (var j = 0; j < list.length; j++) if (list[j].id === db.activeId) i = j;
    var next = list[(i + dir + list.length) % list.length];
    selectNote(next.id);
    setMsg(titleOf(next));
  }

  function setStandby(on) {
    desk.classList.toggle('standby', on);
    if (on) {
      flushSave();
      editor.blur();
      ledPwr.classList.remove('on');
      ledSlp.classList.add('pulse');
      TPKeyboard.releaseAll();
      setMsg('Standby');
    } else {
      ledPwr.classList.add('on');
      ledSlp.classList.remove('pulse');
      editor.focus();
      setMsg('Resumed');
    }
  }
  function toggleThinkLight() {
    prefs.night = !prefs.night;
    applyPrefs();
    setMsg(prefs.night ? 'ThinkLight on' : 'ThinkLight off');
  }
  function setVolume(delta) {
    if (delta === 0) {
      prefs.sound = !prefs.sound;
      applyPrefs();
      if (prefs.sound) Sound.click(true);
      setMsg(prefs.sound ? 'Key click on' : 'Key click muted');
      return;
    }
    prefs.sound = true;
    prefs.vol = Math.max(0.05, Math.min(1, prefs.vol + delta));
    applyPrefs();
    Sound.click(true);
    setMsg('Key click ' + Math.round(prefs.vol * 100) + '%');
  }

  /* ---------------------------------------------------------
     help / about
     --------------------------------------------------------- */
  function storageBytes() {
    try {
      return (localStorage.getItem(NOTES_KEY) || '').length +
             (localStorage.getItem(PREFS_KEY) || '').length;
    } catch (e) { return 0; }
  }

  var quotaWarned = false;
  function checkQuota() {
    var ratio = storageBytes() / QUOTA_BUDGET;
    if (ratio > 0.8) {
      ledHdd.classList.add('amber');
      if (!quotaWarned) {
        quotaWarned = true;
        setMsg('Storage ' + Math.round(ratio * 100) + '% full — export a few notes and delete them');
      }
    } else if (quotaWarned) {
      quotaWarned = false;
      ledHdd.classList.remove('amber');
    }
  }

  function storageReport() {
    var live = liveNotes(), trash = trashCount(), bytes = storageBytes();
    var words = 0;
    live.forEach(function (n) {
      var t = String(n.body || '').trim();
      if (t) words += t.split(/\s+/).length;
    });
    return live.length + ' note' + (live.length === 1 ? '' : 's') + ' · ' +
           words + ' words · ' + (bytes / 1024).toFixed(1) + ' KB, ' +
           Math.round((bytes / QUOTA_BUDGET) * 100) + '% of the usual 5 MB' +
           (trash ? ' · ' + trash + ' in the trash' : '');
  }

  /* ---------------------------------------------------------
     settings
     --------------------------------------------------------- */
  function openSettings() {
    var actions = {
      report: storageReport,
      backup: backupAll,
      restore: function () { pickFile('json'); },
      reset: resetSettings,
      erase: eraseAllNotes,
      trash: emptyTrash
    };
    var form = TPSettings.buildForm(prefs, function (key, value, item) {
      prefs[key] = value;
      if (key === 'preset') applyPreset(value);
      if (key === 'uiFont' || key === 'monoFont') prefs.preset = 'custom';
      applyPrefs();
      if (item && item.t !== 'range') form.refresh();
    }, actions);

    dialog({
      title: 'Settings',
      wide: true,
      bodyHTML: '',
      onBuild: function (bodyEl) { bodyEl.appendChild(form.node); },
      buttons: [{ label: 'Close', primary: true }]
    });
    settingsForm = form;
  }

  function backupAll() {
    flushSave();
    var payload = {
      app: 'thinkpad-notes', version: 1,
      exported: new Date().toISOString(),
      prefs: prefs, notes: liveNotes()
    };
    saveFile('thinkpad-notes-backup-' + dateStamp(new Date()) + '.json',
             JSON.stringify(payload, null, 2), 'application/json');
  }

  function restoreFrom(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { data = null; }
    if (!data || !Array.isArray(data.notes)) {
      Sound.beep();
      dialog({ title: 'Restore', bodyHTML: '<p>That is not a ThinkPad Notes backup.</p>' });
      return;
    }
    dialog({
      title: 'Restore backup',
      bodyHTML: '<p>Replace everything on this machine with <b></b> note(s) from the backup?</p>' +
                '<p class="hint">What is here now is overwritten and cannot be recovered.</p>',
      onBuild: function (bodyEl) { $('b', bodyEl).textContent = String(data.notes.length); },
      buttons: [
        { label: 'Restore', primary: true, act: function () {
            db.notes = data.notes.filter(function (n) { return n && typeof n.body === 'string'; })
              .map(function (n) {
                return {
                  id: n.id || uid(), body: n.body,
                  created: n.created || Date.now(), updated: n.updated || Date.now(),
                  caret: n.caret || 0
                };
              });
            if (data.prefs) { prefs = TPSettings.migrate(data.prefs); }
            if (!db.notes.length) db.notes.push({ id: uid(), body: '', created: Date.now(), updated: Date.now() });
            db.activeId = db.notes[0].id;
            editor.value = db.notes[0].body;
            applyPrefs();
            renderAll();
            flushSave();
            setMsg('Restored ' + db.notes.length + ' notes');
          } },
        { label: 'Cancel' }
      ]
    });
  }

  function resetSettings() {
    dialog({
      title: 'Reset settings',
      bodyHTML: '<p>Put every switch back to standard? Your notes are not touched.</p>',
      buttons: [
        { label: 'Reset', primary: true, act: function () {
            prefs = TPSettings.migrate(null);
            applyPrefs();
            renderAll();
            setMsg('Settings reset');
          } },
        { label: 'Cancel' }
      ]
    });
  }

  function eraseAllNotes() {
    dialog({
      title: 'Erase all notes',
      bodyHTML: '<p>Delete <b></b> note(s) permanently, and empty the trash?</p>' +
                '<p class="hint">Back up first — this cannot be undone.</p>',
      onBuild: function (bodyEl) { $('b', bodyEl).textContent = String(liveNotes().length); },
      buttons: [
        { label: 'Erase', primary: true, act: function () {
            db.notes = [];
            db.activeId = null;
            editor.value = '';
            newNote('');
            setMsg('All notes erased');
          } },
        { label: 'Cancel' }
      ]
    });
  }

  function showHelp(tab) {
    var d = dialog({
      title: 'Access IBM',
      bodyHTML: '<div class="dlg-tabs">' +
          '<button type="button" class="dlg-tab" data-tab="about">About</button>' +
          '<button type="button" class="dlg-tab" data-tab="keys">Keyboard</button>' +
          '<button type="button" class="dlg-tab" data-tab="hw">Hardware</button>' +
        '</div><div class="tabpanes"></div>'
    });
    var panes = $('.tabpanes', d);
    var content = {
      about:
        '<p><b>ThinkPad Notes</b> — plain text, nothing else.</p>' +
        '<p>Every note lives in this browser&rsquo;s localStorage on this machine. ' +
        'Nothing is uploaded, there is no account, and clearing site data erases it, ' +
        'so export anything you would miss.</p>' +
        '<div class="sunken">' + storageReport() + '</div>' +
        '<p>Back up everything to a .json file from <b>Settings &gt; Data</b>, ' +
        'and drop that file back on the screen to restore it.</p>' +
        '<h4>Typeface</h4>' +
        '<p><b>Period correct</b> is Tahoma for the chrome and Courier New for the page — ' +
        'what a ThinkPad actually put on screen around 2001.<br>' +
        '<b>IBM Plex</b> is the anachronism: IBM did not draw it until 2017.</p>' +
        '<p class="hint">Unaffiliated homage. IBM, ThinkPad and TrackPoint belong to their owners.</p>',
      keys:
        '<dl>' +
        '<dt>Alt+N</dt><dd>New note</dd>' +
        '<dt>Ctrl+S</dt><dd>Save now (it also autosaves)</dd>' +
        '<dt>Ctrl+F / Alt+I</dt><dd>Find</dd>' +
        '<dt>Ctrl+D</dt><dd>Delete note</dd>' +
        '<dt>Ctrl+[ / ]</dt><dd>Previous / next note</dd>' +
        '<dt>Ctrl+E</dt><dd>Export .txt</dd>' +
        '<dt>Ctrl+P</dt><dd>Print</dd>' +
        '<dt>F5</dt><dd>Stamp the time and date</dd>' +
        '<dt>Alt+L</dt><dd>ThinkLight</dd>' +
        '<dt>Ctrl+,</dt><dd>Settings</dd>' +
        '<dt>Alt+= / Alt+-</dt><dd>Bigger / smaller text</dd>' +
        '<dt>Esc</dt><dd>Close menu or dialog</dd>' +
        '</dl>' +
        '<p class="hint">Alt+F, Alt+E, Alt+O, Alt+V, Alt+H open the menus.</p>',
      hw:
        '<h4>Things on the machine that work</h4>' +
        '<dl>' +
        '<dt>ThinkLight</dt><dd>The lamp above the screen. Dims the room and lights the keys.</dd>' +
        '<dt>TrackPoint</dt><dd>Push the red nub to scroll the page, like the real thing.</dd>' +
        '<dt>Mouse buttons</dt><dd>Left and right walk through your notes.</dd>' +
        '<dt>Access IBM</dt><dd>This window.</dd>' +
        '<dt>Volume</dt><dd>Key click volume. The dot lights when muted.</dd>' +
        '<dt>Power</dt><dd>Standby. Click anywhere to wake.</dd>' +
        '<dt>Battery light</dt><dd>Follows this laptop where the browser will say: ' +
        'amber below 20%, pulsing while charging.</dd>' +
        '<dt>Drive light</dt><dd>Flickers on every save, and sits amber when storage is nearly full.</dd>' +
        '<dt>Keyboard</dt><dd>Folded away by default. <b>View &gt; Keyboard</b> brings it back — ' +
        'it mirrors what you type, and you can click the caps to type with the mouse.</dd>' +
        '</dl>' +
        '<p class="hint">Everything here, plus case finish, panel shape, colours and ' +
        'typefaces, lives in <b>Settings</b> (Ctrl+,).</p>'
    };
    var tabs = $$('.dlg-tab', d);
    function show(name) {
      panes.innerHTML = content[name];
      tabs.forEach(function (t) { t.classList.toggle('on', t.dataset.tab === name); });
    }
    tabs.forEach(function (t) {
      t.addEventListener('click', function () { show(t.dataset.tab); });
    });
    show(tab || 'about');
  }

  /* ---------------------------------------------------------
     menus
     --------------------------------------------------------- */
  var SEP = { sep: true };
  var MENUS = [
    { id: 'file', label: 'File', key: 'f', items: [
      { label: 'New Note', accel: 'Alt+N', act: function () { newNote(''); } },
      { label: 'Open .txt…', act: function () { pickFile('txt'); } },
      SEP,
      { label: 'Save Now', accel: 'Ctrl+S', act: saveNow },
      { label: 'Export .txt', accel: 'Ctrl+E', act: exportTxt },
      { label: 'Export All Notes…', act: exportAll },
      { label: 'Back Up Everything…', act: backupAll },
      { label: 'Restore Backup…', act: function () { pickFile('json'); } },
      { label: 'Print…', accel: 'Ctrl+P', act: printNote },
      SEP,
      { label: 'Delete Note', accel: 'Ctrl+D', act: deleteNote }
    ]},
    { id: 'edit', label: 'Edit', key: 'e', items: [
      { label: 'Select All', accel: 'Ctrl+A', act: function () { editor.focus(); editor.select(); } },
      { label: 'Time/Date', accel: 'F5', act: function () { editor.focus(); insertDateTime(); } },
      SEP,
      { label: 'Find', accel: 'Ctrl+F', act: function () { search.focus(); search.select(); } },
      { label: 'Previous Note', accel: 'Ctrl+[', act: function () { cycleNote(-1); } },
      { label: 'Next Note', accel: 'Ctrl+]', act: function () { cycleNote(1); } }
    ]},
    { id: 'format', label: 'Format', key: 'o', items: [
      { label: 'Period Correct — Tahoma / Courier New', radio: 'preset', value: 'period',
        act: function () { setFont('period'); } },
      { label: 'IBM Plex — sixteen years early', radio: 'preset', value: 'plex',
        act: function () { setFont('plex'); } },
      SEP,
      { label: 'Larger Text', accel: 'Alt+=', act: function () { nudgeSize(1); } },
      { label: 'Smaller Text', accel: 'Alt+-', act: function () { nudgeSize(-1); } },
      { label: 'Word Wrap', check: 'wrap', act: toggler('wrap', 'Word wrap') },
      { label: 'Spell Check', check: 'spellcheck', act: toggler('spellcheck', 'Spell check') },
      SEP,
      { label: 'Settings…', accel: 'Ctrl+,', act: openSettings }
    ]},
    { id: 'view', label: 'View', key: 'v', items: [
      { label: 'Keyboard', check: 'deck', act: toggler('deck', 'Keyboard') },
      { label: 'Note List', check: 'list', act: toggler('list', 'Note list') },
      { label: 'Status Bar', check: 'statusbar', act: toggler('statusbar', 'Status bar') },
      { label: 'The Machine', check: 'showCase', act: toggler('showCase', 'Case') },
      SEP,
      { label: 'ThinkLight', accel: 'Alt+L', check: 'night', act: toggleThinkLight },
      { label: 'Screen Glare', check: 'glare', act: toggler('glare', 'Glare') },
      { label: 'LCD Grain', check: 'grain', act: toggler('grain', 'Grain') },
      { label: 'Key Click', check: 'sound', act: function () { setVolume(0); } },
      SEP,
      { label: 'Settings…', accel: 'Ctrl+,', act: openSettings },
      { label: 'Standby', act: function () { setStandby(true); } }
    ]},
    { id: 'help', label: 'Help', key: 'h', items: [
      { label: 'Keyboard Shortcuts', act: function () { showHelp('keys'); } },
      { label: 'The Hardware', act: function () { showHelp('hw'); } },
      SEP,
      { label: 'Settings…', accel: 'Ctrl+,', act: openSettings },
      { label: 'About ThinkPad Notes', act: function () { showHelp('about'); } }
    ]}
  ];

  var openMenu = null;
  function buildMenus() {
    MENUS.forEach(function (menu) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-top';
      btn.dataset.menu = menu.id;
      btn.setAttribute('role', 'menuitem');
      var i = menu.label.toLowerCase().indexOf(menu.key);
      btn.innerHTML = menu.label.slice(0, i) + '<u>' + menu.label.charAt(i) + '</u>' + menu.label.slice(i + 1);

      var dd = document.createElement('div');
      dd.className = 'dropdown';
      dd.hidden = true;
      dd.dataset.menu = menu.id;

      menu.items.forEach(function (item) {
        if (item.sep) {
          var s = document.createElement('div');
          s.className = 'msep';
          dd.appendChild(s);
          return;
        }
        var mi = document.createElement('button');
        mi.type = 'button';
        mi.className = 'mi' + (item.radio ? ' radio' : '');
        mi.dataset.label = item.label;
        if (item.check) mi.dataset.check = item.check;
        if (item.radio) { mi.dataset.radio = item.radio; mi.dataset.value = item.value; }
        var lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = item.label;
        mi.appendChild(lbl);
        if (item.accel) {
          var ac = document.createElement('span'); ac.className = 'accel'; ac.textContent = item.accel;
          mi.appendChild(ac);
        }
        mi.addEventListener('click', function () {
          closeMenu();
          if (item.act) item.act();
        });
        dd.appendChild(mi);
      });

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (openMenu === menu.id) closeMenu(); else showMenu(menu.id);
      });
      btn.addEventListener('mouseenter', function () {
        if (openMenu && openMenu !== menu.id) showMenu(menu.id);
      });

      menubar.appendChild(btn);
      menubar.appendChild(dd);
    });
  }

  function syncMenuState(dd) {
    $$('.mi', dd).forEach(function (mi) {
      if (mi.dataset.check) mi.classList.toggle('checked', !!prefs[mi.dataset.check]);
      if (mi.dataset.radio) mi.classList.toggle('checked', prefs[mi.dataset.radio] === mi.dataset.value);
    });
  }
  function showMenu(id) {
    closeMenu();
    var btn = $('.menu-top[data-menu="' + id + '"]', menubar);
    var dd = $('.dropdown[data-menu="' + id + '"]', menubar);
    if (!btn || !dd) return;
    btn.classList.add('open');
    syncMenuState(dd);
    dd.hidden = false;
    dd.style.left = btn.offsetLeft + 'px';
    var overflow = (btn.offsetLeft + dd.offsetWidth) - menubar.clientWidth;
    if (overflow > 0) dd.style.left = Math.max(0, btn.offsetLeft - overflow - 2) + 'px';
    openMenu = id;
  }
  function closeMenu() {
    if (!openMenu) return;
    $$('.menu-top', menubar).forEach(function (b) { b.classList.remove('open'); });
    $$('.dropdown', menubar).forEach(function (d) { d.hidden = true; });
    openMenu = null;
  }
  document.addEventListener('click', function (e) {
    if (openMenu && !menubar.contains(e.target)) closeMenu();
  });

  /* ---------------------------------------------------------
     editor + list wiring
     --------------------------------------------------------- */
  var listRenderTimer = null;
  editor.addEventListener('input', function () {
    var note = active();
    if (!note) { newNote(editor.value); return; }
    note.body = editor.value;
    note.updated = Date.now();
    updateCounts();
    updatePos();
    renderTitle();
    scheduleSave();
    if (listRenderTimer) clearTimeout(listRenderTimer);
    listRenderTimer = setTimeout(renderList, 500);
  });
  ['keyup', 'click', 'select', 'focus'].forEach(function (ev) {
    editor.addEventListener(ev, updatePos);
  });
  editor.addEventListener('blur', function () { if (saveTimer) flushSave(); });

  listbox.addEventListener('click', function (e) {
    var item = e.target.closest ? e.target.closest('.note-item') : null;
    if (item) selectNote(item.dataset.id);
  });
  listbox.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      cycleNote(e.key === 'ArrowDown' ? 1 : -1);
      listbox.focus();
    } else if (e.key === 'Enter') {
      editor.focus();
    }
  });

  var searchTimer = null;
  search.addEventListener('input', function () {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      renderList();
      var n = visibleNotes().length;
      setMsg(search.value.trim() ? n + ' of ' + db.notes.length + ' notes match' : 'Ready', true);
    }, 120);
  });
  search.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { search.value = ''; renderList(); editor.focus(); }
    if (e.key === 'Enter') {
      var first = $('.note-item', listbox);
      if (first) { selectNote(first.dataset.id); }
    }
  });

  $('#btnNew').addEventListener('click', function () { newNote(''); });
  $('#btnDelete').addEventListener('click', deleteNote);
  $('#tbMin').addEventListener('click', function () { setStandby(true); });
  $('#tbClose').addEventListener('click', function () { setStandby(true); });
  $('#tbMax').addEventListener('click', function () {
    prefs.list = !prefs.list; applyPrefs();
  });
  stFont.addEventListener('click', function () { setFont(prefs.font === 'plex' ? 'period' : 'plex'); });

  var fileMode = 'txt';
  function pickFile(mode) {
    fileMode = mode;
    fileInput.accept = mode === 'json' ? '.json,application/json' : '.txt,.md,text/plain';
    fileInput.click();
  }
  function readFile(f, mode) {
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result || '');
      if (mode === 'json' || /\.json$/i.test(f.name)) restoreFrom(text);
      else importText(text, f.name.replace(/\.[^.]+$/, ''));
    };
    reader.readAsText(f);
  }
  fileInput.addEventListener('change', function () {
    var f = fileInput.files && fileInput.files[0];
    if (f) readFile(f, fileMode);
    fileInput.value = '';
  });

  /* drag a .txt onto the screen */
  var dropzone = document.createElement('div');
  dropzone.className = 'dropzone';
  dropzone.innerHTML = '<span>Drop a .txt file to open it, or a .json backup to restore</span>';
  lcd.appendChild(dropzone);
  ['dragenter', 'dragover'].forEach(function (ev) {
    lcd.addEventListener(ev, function (e) {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1) {
        e.preventDefault();
        lcd.classList.add('dragging');
      }
    });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    lcd.addEventListener(ev, function (e) {
      if (ev === 'drop') e.preventDefault();
      if (ev === 'dragleave' && lcd.contains(e.relatedTarget)) return;
      lcd.classList.remove('dragging');
    });
  });
  lcd.addEventListener('drop', function (e) {
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) readFile(f, /\.json$/i.test(f.name) ? 'json' : 'txt');
  });

  /* ---------------------------------------------------------
     splitter
     --------------------------------------------------------- */
  (function () {
    var dragging = false;
    splitter.addEventListener('pointerdown', function (e) {
      dragging = true;
      splitter.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    splitter.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var rect = workspace.getBoundingClientRect();
      var w = Math.max(110, Math.min(rect.width * 0.6, e.clientX - rect.left));
      prefs.listWidth = Math.round(w);
      paneNotes.style.width = prefs.listWidth + 'px';
    });
    splitter.addEventListener('pointerup', function (e) {
      if (!dragging) return;
      dragging = false;
      splitter.releasePointerCapture(e.pointerId);
      savePrefs();
    });
  })();

  /* ---------------------------------------------------------
     hardware wiring
     --------------------------------------------------------- */
  $('#thinklightBtn').addEventListener('click', toggleThinkLight);
  $('#accessBtn').addEventListener('click', function () { showHelp('about'); });
  $('#powerBtn').addEventListener('click', function (e) {
    e.stopPropagation();
    setStandby(!desk.classList.contains('standby'));
  });
  $('#volUp').addEventListener('click', function () { setVolume(0.15); });
  $('#volDown').addEventListener('click', function () { setVolume(-0.15); });
  $('#volMute').addEventListener('click', function () { setVolume(0); });
  $('#tpbLeft').addEventListener('click', function () { cycleNote(-1); });
  $('#tpbRight').addEventListener('click', function () { cycleNote(1); });
  $('#tpbCenter').addEventListener('click', function () {
    setMsg('Hold the red nub and push to scroll');
  });

  /* wake from standby on any interaction */
  desk.addEventListener('mousedown', function (e) {
    if (!desk.classList.contains('standby')) return;
    if (e.target.closest && e.target.closest('#powerBtn')) return; // the button toggles it itself
    setStandby(false);
  }, true);

  /* The BAT light follows this laptop's actual battery where the browser
     will say (Chrome and Edge); everywhere else it stays the plain green
     it has always been. */
  var batteryCell = ledBat.parentNode;
  function paintBattery(b) {
    if (!prefs.battery) {
      ledBat.classList.remove('amber', 'pulse');
      ledBat.classList.add('on');
      batteryCell.removeAttribute('title');
      return;
    }
    var pct = Math.round(b.level * 100);
    var full = b.level >= 0.98;
    ledBat.classList.remove('amber', 'pulse', 'on');
    if (b.charging && !full) ledBat.classList.add('amber', 'pulse');  /* taking a charge */
    else if (!b.charging && b.level <= 0.2) ledBat.classList.add('amber');
    else ledBat.classList.add('on');                                  /* charged, or plenty left */
    batteryCell.title = 'Battery ' + pct + '%' +
      (b.charging ? (full ? ' — charged' : ' — charging') : '');
  }
  function wireBattery() {
    if (!navigator.getBattery) return;
    navigator.getBattery().then(function (b) {
      var paint = function () { paintBattery(b); };
      paint();
      b.addEventListener('levelchange', paint);
      b.addEventListener('chargingchange', paint);
      batteryRepaint = paint;
    }, function () { /* refused: leave the light alone */ });
  }
  var batteryRepaint = null;

  /* the light thrown by the ThinkLight */
  var cone = document.createElement('div');
  cone.className = 'light-cone';
  cone.setAttribute('aria-hidden', 'true');
  var spill = document.createElement('div');
  spill.className = 'screen-spill';
  spill.setAttribute('aria-hidden', 'true');
  $('.base').appendChild(spill);
  $('.base').appendChild(cone);

  /* --- TrackPoint: push to scroll --- */
  (function () {
    var dragging = false, originY = 0, velocity = 0, raf = null;
    function loop() {
      if (!dragging) { raf = null; return; }
      if (Math.abs(velocity) > 0.4) editor.scrollTop += velocity;
      raf = requestAnimationFrame(loop);
    }
    trackpoint.addEventListener('pointerdown', function (e) {
      dragging = true;
      originY = e.clientY;
      velocity = 0;
      trackpoint.classList.add('dragging');
      trackpoint.setPointerCapture(e.pointerId);
      e.preventDefault();
      if (!raf) raf = requestAnimationFrame(loop);
    });
    trackpoint.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dy = e.clientY - originY;
      var dead = 2;
      velocity = Math.abs(dy) < dead ? 0 : (dy - Math.sign(dy) * dead) * 0.28;
      trackpoint.style.transform = 'translate(-50%,-50%) translateY(' +
        Math.max(-2, Math.min(2, dy / 12)) + 'px)';
    });
    function stop(e) {
      if (!dragging) return;
      dragging = false;
      velocity = 0;
      trackpoint.classList.remove('dragging');
      trackpoint.style.transform = 'translate(-50%,-50%)';
      try { trackpoint.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    trackpoint.addEventListener('pointerup', stop);
    trackpoint.addEventListener('pointercancel', stop);
    trackpoint.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { editor.scrollTop += 40; e.preventDefault(); }
      if (e.key === 'ArrowUp') { editor.scrollTop -= 40; e.preventDefault(); }
    });
  })();

  /* --- build the keyboard --- */
  TPKeyboard.build(keyboardEl, function (key, e) {
    Sound.click(true);
    if (desk.classList.contains('standby')) return;
    if (key.code === 'Fn') { toggleThinkLight(); return; }
    if (key.code === 'CapsLock') { ledCap.classList.toggle('on'); return; }
    if (key.code === 'Escape') { closeMenu(); closeDialog(); return; }
    if (key.code === 'F5') { editor.focus(); insertDateTime(); return; }
    if (key.code === 'Backspace') {
      editor.focus();
      var s = editor.selectionStart, en = editor.selectionEnd;
      if (s === en && s > 0) editor.setRangeText('', s - 1, s, 'end');
      else editor.setRangeText('', s, en, 'end');
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    if (key.ch !== undefined) {
      editor.focus();
      var ch = key.ch;
      if (e.shiftKey || ledCap.classList.contains('on')) {
        ch = key.sub && e.shiftKey ? key.sub : ch.toUpperCase();
      }
      insertAtCaret(ch);
    }
  });

  /* Underlines under the menu hotkeys only show while Alt is held —
     which is exactly how they behaved. */
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Alt') body.classList.add('alt-held');
  });
  window.addEventListener('keyup', function (e) {
    if (e.key === 'Alt') body.classList.remove('alt-held');
  });
  window.addEventListener('blur', function () { body.classList.remove('alt-held'); });

  /* --- physical keys light up the caps --- */
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

  /* ---------------------------------------------------------
     global shortcuts
     --------------------------------------------------------- */
  window.addEventListener('keydown', function (e) {
    if (desk.classList.contains('standby')) {
      e.preventDefault();
      setStandby(false);
      return;
    }
    var mod = e.ctrlKey || e.metaKey;

    if (e.key === 'Escape') {
      if (openDialogEl) { closeDialog(); return; }
      if (openMenu) { closeMenu(); return; }
    }
    if (openDialogEl && e.key === 'Enter') {
      var b = $('.dlg-foot .btn', openDialogEl);
      if (b) { b.click(); e.preventDefault(); }
      return;
    }

    if (e.altKey && !mod) {
      var hit = null;
      MENUS.forEach(function (m) { if (m.key === e.key.toLowerCase()) hit = m.id; });
      if (hit) { e.preventDefault(); showMenu(hit); return; }
      if (e.key.toLowerCase() === 'n') { e.preventDefault(); newNote(''); return; }
      if (e.key.toLowerCase() === 'l') { e.preventDefault(); toggleThinkLight(); return; }
      if (e.key.toLowerCase() === 'i') { e.preventDefault(); search.focus(); search.select(); return; }
      if (e.key === '=' || e.key === '+') { e.preventDefault(); nudgeSize(1); return; }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); nudgeSize(-1); return; }
    }

    if (e.key === 'F5' && document.activeElement === editor) {
      e.preventDefault(); insertDateTime(); return;
    }

    if (!mod) return;
    var k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); saveNow(); }
    else if (k === 'd') { e.preventDefault(); deleteNote(); }
    else if (k === 'f') { e.preventDefault(); search.focus(); search.select(); }
    else if (k === 'e') { e.preventDefault(); exportTxt(); }
    else if (k === 'p') { e.preventDefault(); printNote(); }
    else if (k === ',') { e.preventDefault(); openSettings(); }
    else if (k === '[') { e.preventDefault(); cycleNote(-1); }
    else if (k === ']') { e.preventDefault(); cycleNote(1); }
  });

  /* ---------------------------------------------------------
     persistence safety nets
     --------------------------------------------------------- */
  /* Two tabs on the same notes used to mean the last one to save won and
     the other tab's work vanished. Merge instead: the newest edit of each
     note wins, and whatever is being typed here is never overwritten. */
  window.addEventListener('storage', function (e) {
    if (e.key !== NOTES_KEY || !e.newValue) return;
    var incoming;
    try { incoming = JSON.parse(e.newValue); } catch (err) { return; }
    if (!incoming || !Array.isArray(incoming.notes)) return;

    var typing = !!saveTimer;                 /* unsaved keystrokes in this tab */
    var changed = 0, activeChanged = false;

    incoming.notes.forEach(function (theirs) {
      var mine = noteById(theirs.id);
      if (!mine) {
        db.notes.push(theirs);
        changed++;
        return;
      }
      if ((theirs.updated || 0) <= (mine.updated || 0)) return;
      if (mine.id === db.activeId && typing) return;   /* keep what is being typed */
      mine.body = theirs.body;
      mine.updated = theirs.updated;
      mine.caret = theirs.caret;
      if (theirs.deleted) mine.deleted = theirs.deleted;
      else delete mine.deleted;
      changed++;
      if (mine.id === db.activeId) activeChanged = true;
    });

    if (!changed) return;
    if (activeChanged) {
      var note = active();
      if (note) editor.value = note.body;
    }
    if (!active() || active().deleted) {
      var next = liveNotes()[0];
      if (next) { db.activeId = next.id; editor.value = next.body; }
    }
    renderAll();
    setMsg(changed === 1 ? 'Updated from another tab' : changed + ' notes updated from another tab');
  });

  window.addEventListener('beforeunload', function () { if (saveTimer) flushSave(); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && saveTimer) flushSave();
  });

  /* ---------------------------------------------------------
     boot
     --------------------------------------------------------- */
  var WELCOME =
    'Notes\n' +
    '\n' +
    'This is a plain text notepad. The first line becomes the title.\n' +
    '\n' +
    'It saves as you type, into this browser only — no account, no server,\n' +
    'no sync. Export anything you would hate to lose (Ctrl+E).\n' +
    '\n' +
    'Things worth trying:\n' +
    '  * Settings — in the Format menu, or Ctrl and the comma key — holds\n' +
    '    the case finish, panel shape, screen colours and typefaces.\n' +
    '  * View > Keyboard unfolds the seven-row keyboard. It mirrors what\n' +
    '    you type, at the cost of some screen.\n' +
    '  * The lamp above the screen is the ThinkLight (Alt+L).\n' +
    '  * Push the red TrackPoint to scroll a long note.\n' +
    '  * Format menu: period-correct Courier New, or the anachronistic\n' +
    '    IBM Plex that IBM would not draw for another sixteen years.\n' +
    '  * F5 stamps the time, the way Notepad always has.\n' +
    '  * Access IBM (the blue button) explains the rest.\n';

  function boot() {
    buildMenus();
    lcd.appendChild(modalLayer);

    var purged = purgeTrash();

    if (!liveNotes().length) {
      db.notes.push({ id: uid(), body: WELCOME, created: Date.now(), updated: Date.now(), caret: 0 });
      db.activeId = db.notes[0].id;
      writeJSON(NOTES_KEY, db);
    } else if (purged) {
      writeJSON(NOTES_KEY, db);
    }
    if (!active() || active().deleted) db.activeId = liveNotes()[0].id;

    if (prefs.startup === 'new' && String((active() || {}).body || '').trim()) {
      db.notes.unshift({ id: uid(), body: '', created: Date.now(), updated: Date.now(), caret: 0 });
      db.activeId = db.notes[0].id;
    }

    var note = active();
    editor.value = note ? note.body : '';
    applyPrefs();
    fitScreen();
    renderAll();
    if (note && note.caret) {
      var c = Math.min(note.caret, editor.value.length);
      editor.setSelectionRange(c, c);
    }
    editor.focus();
    wireBattery();
    checkQuota();
    setMsg('Ready');
    booted = true;

    /* a browser that refuses localStorage entirely */
    try {
      localStorage.setItem('thinkpad.probe', '1');
      localStorage.removeItem('thinkpad.probe');
    } catch (e) {
      setMsg('No localStorage — notes will vanish when you close this tab');
      ledHdd.classList.add('amber');
    }
  }

  try {
    boot();
  } catch (err) {
    showBootFailure(err);
  }
})();
