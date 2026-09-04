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

  var DEFAULT_PREFS = {
    font: 'period', size: 'm', wrap: true, list: true, keyboard: true,
    night: false, glare: true, grain: true, sound: false, vol: 0.35, listWidth: 210
  };

  var prefs = Object.assign({}, DEFAULT_PREFS, readJSON(PREFS_KEY, {}));
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
      setMsg('Saved ' + timeStamp(new Date()));
    } else {
      ledBat.classList.add('amber');
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
      bodyHTML: '<p>Delete <b></b> permanently?</p><p class="hint">This cannot be undone — ' +
                'there is no wastebasket on this machine.</p>',
      onBuild: function (bodyEl) { $('b', bodyEl).textContent = titleOf(note); },
      buttons: [
        { label: 'Delete', primary: true, act: function () {
            var idx = db.notes.indexOf(note);
            db.notes.splice(idx, 1);
            var next = db.notes[idx] || db.notes[idx - 1] || null;
            db.activeId = next ? next.id : null;
            if (!db.notes.length) { newNote(''); return; }
            editor.value = next ? next.body : '';
            renderAll();
            flushSave();
            editor.focus();
            setMsg('Deleted');
          } },
        { label: 'Cancel' }
      ]
    });
  }

  function visibleNotes() {
    var q = search.value.trim().toLowerCase();
    var list = db.notes.slice().sort(function (a, b) { return b.updated - a.updated; });
    if (!q) return list;
    return list.filter(function (n) {
      return String(n.body || '').toLowerCase().indexOf(q) !== -1;
    });
  }

  /* ---------------------------------------------------------
     rendering
     --------------------------------------------------------- */
  var msgTimer = null;
  function setMsg(text, quiet) {
    stMsg.textContent = text;
    if (msgTimer) clearTimeout(msgTimer);
    if (!quiet) {
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
     preferences applied to the machine
     --------------------------------------------------------- */
  function applyPrefs() {
    body.classList.toggle('font-plex', prefs.font === 'plex');
    body.classList.toggle('font-period', prefs.font !== 'plex');
    body.classList.remove('fs-s', 'fs-m', 'fs-l');
    body.classList.add('fs-' + prefs.size);
    body.classList.toggle('no-wrap', !prefs.wrap);
    body.classList.toggle('no-list', !prefs.list);
    body.classList.toggle('no-keyboard', !prefs.keyboard);
    body.classList.toggle('no-glare', !prefs.glare);
    body.classList.toggle('no-grain', !prefs.grain);
    body.classList.toggle('muted', !prefs.sound);
    desk.classList.toggle('night', !!prefs.night);
    editor.setAttribute('wrap', prefs.wrap ? 'soft' : 'off');
    paneNotes.style.width = prefs.listWidth + 'px';
    stFont.textContent = prefs.font === 'plex' ? 'IBM Plex Mono' : 'Courier New';
    stFont.title = prefs.font === 'plex'
      ? 'IBM Plex Mono (2017) — click for the period-correct face'
      : 'Courier New / Tahoma (period correct) — click for IBM Plex';
    savePrefs();
  }
  function setFont(mode) {
    prefs.font = mode;
    applyPrefs();
    setMsg(mode === 'plex' ? 'Typeface: IBM Plex — fifteen years early' : 'Typeface: period correct');
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
  var openDialogEl = null;
  function dialog(opts) {
    closeDialog();
    var dlg = document.createElement('div');
    dlg.className = 'dlg';
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
    openDialogEl = dlg;
    var firstBtn = $('.dlg-foot .btn', dlg);
    if (firstBtn) firstBtn.focus();
    return dlg;
  }
  function closeDialog() {
    if (!openDialogEl) return;
    modalLayer.hidden = true;
    modalLayer.textContent = '';
    openDialogEl = null;
    if (!desk.classList.contains('standby')) editor.focus();
  }
  modalLayer.addEventListener('mousedown', function (e) {
    if (e.target === modalLayer) closeDialog();
  });

  /* ---------------------------------------------------------
     commands
     --------------------------------------------------------- */
  function saveNow() {
    if (flushSave()) setMsg('Saved to this browser · ' + timeStamp(new Date()));
  }

  function exportTxt() {
    var note = active();
    if (!note) return;
    flushSave();
    var name = titleOf(note).replace(/[\\/:*?"<>|]+/g, '-').replace(/…$/, '').trim() || 'note';
    var blob = new Blob([note.body], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name + '.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    setMsg('Exported ' + name + '.txt');
  }

  function exportAll() {
    flushSave();
    var out = db.notes.slice().sort(function (a, b) { return b.updated - a.updated; })
      .map(function (n) {
        return '=== ' + titleOf(n) + ' === (' + friendly(n.updated) + ')\n\n' + n.body;
      }).join('\n\n\n');
    var blob = new Blob([out], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'thinkpad-notes-' + dateStamp(new Date()) + '.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    setMsg('Exported ' + db.notes.length + ' notes');
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
  function storageReport() {
    var bytes = 0;
    try { bytes = (localStorage.getItem(NOTES_KEY) || '').length; } catch (e) {}
    var kb = (bytes / 1024).toFixed(1);
    return db.notes.length + ' note' + (db.notes.length === 1 ? '' : 's') + ' · ' + kb + ' KB of localStorage';
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
        '<dt>Keyboard</dt><dd>Mirrors what you type; click the caps to type with the mouse.</dd>' +
        '</dl>'
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
      { label: 'Open .txt…', act: function () { fileInput.click(); } },
      SEP,
      { label: 'Save Now', accel: 'Ctrl+S', act: saveNow },
      { label: 'Export .txt', accel: 'Ctrl+E', act: exportTxt },
      { label: 'Export All Notes…', act: exportAll },
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
      { label: 'Period Correct (Courier New)', radio: 'font', value: 'period',
        act: function () { setFont('period'); } },
      { label: 'IBM Plex (anachronistic)', radio: 'font', value: 'plex',
        act: function () { setFont('plex'); } },
      SEP,
      { label: 'Small', radio: 'size', value: 's', act: function () { prefs.size = 's'; applyPrefs(); } },
      { label: 'Medium', radio: 'size', value: 'm', act: function () { prefs.size = 'm'; applyPrefs(); } },
      { label: 'Large', radio: 'size', value: 'l', act: function () { prefs.size = 'l'; applyPrefs(); } },
      SEP,
      { label: 'Word Wrap', check: 'wrap', act: function () { prefs.wrap = !prefs.wrap; applyPrefs(); } }
    ]},
    { id: 'view', label: 'View', key: 'v', items: [
      { label: 'Note List', check: 'list', act: function () { prefs.list = !prefs.list; applyPrefs(); } },
      { label: 'Keyboard', check: 'keyboard', act: function () { prefs.keyboard = !prefs.keyboard; applyPrefs(); } },
      SEP,
      { label: 'ThinkLight', accel: 'Alt+L', check: 'night', act: toggleThinkLight },
      { label: 'Screen Glare', check: 'glare', act: function () { prefs.glare = !prefs.glare; applyPrefs(); } },
      { label: 'LCD Grain', check: 'grain', act: function () { prefs.grain = !prefs.grain; applyPrefs(); } },
      { label: 'Key Click', check: 'sound', act: function () { setVolume(0); } },
      SEP,
      { label: 'Standby', act: function () { setStandby(true); } }
    ]},
    { id: 'help', label: 'Help', key: 'h', items: [
      { label: 'Keyboard Shortcuts', act: function () { showHelp('keys'); } },
      { label: 'The Hardware', act: function () { showHelp('hw'); } },
      SEP,
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

  fileInput.addEventListener('change', function () {
    var f = fileInput.files && fileInput.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      importText(String(reader.result || ''), f.name.replace(/\.[^.]+$/, ''));
    };
    reader.readAsText(f);
    fileInput.value = '';
  });

  /* drag a .txt onto the screen */
  var dropzone = document.createElement('div');
  dropzone.className = 'dropzone';
  dropzone.innerHTML = '<span>Drop a .txt file to open it</span>';
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
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      importText(String(reader.result || ''), f.name.replace(/\.[^.]+$/, ''));
    };
    reader.readAsText(f);
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
    else if (k === '[') { e.preventDefault(); cycleNote(-1); }
    else if (k === ']') { e.preventDefault(); cycleNote(1); }
  });

  /* ---------------------------------------------------------
     persistence safety nets
     --------------------------------------------------------- */
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
    '  * The lamp above the screen is the ThinkLight (Alt+L).\n' +
    '  * Push the red TrackPoint to scroll a long note.\n' +
    '  * Format menu: period-correct Courier New, or the anachronistic\n' +
    '    IBM Plex that IBM would not draw for another sixteen years.\n' +
    '  * F5 stamps the time, the way Notepad always has.\n' +
    '  * Access IBM (the blue button) explains the rest.\n';

  function boot() {
    buildMenus();
    lcd.appendChild(modalLayer);

    if (!db.notes.length) {
      db.notes.push({ id: uid(), body: WELCOME, created: Date.now(), updated: Date.now(), caret: 0 });
      db.activeId = db.notes[0].id;
      writeJSON(NOTES_KEY, db);
    }
    if (!active()) db.activeId = db.notes[0].id;

    var note = active();
    editor.value = note ? note.body : '';
    applyPrefs();
    renderAll();
    if (note && note.caret) {
      var c = Math.min(note.caret, editor.value.length);
      editor.setSelectionRange(c, c);
    }
    editor.focus();
    setMsg('Ready');

    /* a browser that refuses localStorage entirely */
    try {
      localStorage.setItem('thinkpad.probe', '1');
      localStorage.removeItem('thinkpad.probe');
    } catch (e) {
      setMsg('No localStorage — notes will vanish when you close this tab');
      ledBat.classList.add('amber');
    }
  }

  boot();
})();
