/* ============================================================
   settings.js — everything about the machine you can change
   A declarative spec, the period-correct form that renders it,
   and the defaults / migration for older saved preferences.
   ============================================================ */
(function (global) {
  'use strict';

  var DEFAULTS = {
    /* the machine */
    showCase: true, deck: false, tpButtons: true, leds: true,
    caseFinish: 'black', capStyle: 'tongue', desk: 'studio', aspect: '4:3',
    deckTilt: true, battery: true,
    night: false, glare: true, grain: true, sound: false, vol: 0.35,
    /* the screen */
    theme: 'classic', preset: 'period', uiFont: 'tahoma', monoFont: 'courier',
    fontSize: 13, lineHeight: 1.45, wrap: true, tabSize: 8,
    spellcheck: false, statusbar: true,
    /* the notes */
    list: true, listSide: 'left', listWidth: 176,
    sort: 'updated', dateFormat: 'relative', startup: 'last'
  };

  var UI_FONTS = {
    tahoma: 'Tahoma,"MS Sans Serif","Microsoft Sans Serif",Verdana,Geneva,sans-serif',
    verdana: 'Verdana,Geneva,Tahoma,sans-serif',
    sans: '"MS Sans Serif","Microsoft Sans Serif",Tahoma,Verdana,sans-serif',
    plex: '"IBM Plex Sans",Tahoma,Verdana,sans-serif',
    system: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'
  };
  var MONO_FONTS = {
    courier: '"Courier New","Lucida Console",monospace',
    lucida: '"Lucida Console","DejaVu Sans Mono","Courier New",monospace',
    andale: '"Andale Mono","Lucida Console","Courier New",monospace',
    consolas: 'Consolas,"Lucida Console","Courier New",monospace',
    plex: '"IBM Plex Mono","Courier New",monospace',
    system: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'
  };
  var MONO_NAMES = {
    courier: 'Courier New', lucida: 'Lucida Console', andale: 'Andale Mono',
    consolas: 'Consolas', plex: 'IBM Plex Mono', system: 'System mono'
  };

  var pct = function (v) { return Math.round(v * 100) + '%'; };
  var px = function (v) { return v + ' px'; };
  var two = function (v) { return (+v).toFixed(2); };

  var GROUPS = [
    { id: 'machine', label: 'Machine', items: [
      { k: 'showCase', t: 'check', label: 'Show the machine',
        hint: 'Off puts the notepad alone in the window' },
      { k: 'deck', t: 'check', label: 'Keyboard',
        hint: 'Folding it away gives the panel about 1024x768' },
      { k: 'tpButtons', t: 'check', label: 'TrackPoint buttons' },
      { k: 'leds', t: 'check', label: 'Indicator lights' },
      { k: 'caseFinish', t: 'select', label: 'Case finish', options: [
        ['black', 'Matte black'], ['graphite', 'Graphite'], ['titanium', 'Titanium'] ] },
      { k: 'capStyle', t: 'select', label: 'TrackPoint cap', options: [
        ['tongue', "Cat's tongue"], ['dome', 'Soft dome'], ['eraser', 'Eraser head'] ] },
      { k: 'desk', t: 'select', label: 'Desk', options: [
        ['studio', 'Studio dark'], ['office', 'Office grey'], ['void', 'Black'] ] },
      { k: 'aspect', t: 'select', label: 'Panel shape', options: [
        ['4:3', '4:3 — period correct'], ['16:10', '16:10'], ['fill', 'Fill the window'] ] },
      { k: 'deckTilt', t: 'check', label: 'Deck lies flat',
        hint: 'Tips the keyboard away from you, the way a real one sits' },
      { k: 'battery', t: 'check', label: 'Battery light is real',
        hint: 'The BAT light follows this laptop: amber when low, pulsing on charge' },
      { k: 'night', t: 'check', label: 'ThinkLight', hint: 'Alt+L' },
      { k: 'glare', t: 'check', label: 'Screen glare' },
      { k: 'grain', t: 'check', label: 'LCD grain' },
      { k: 'sound', t: 'check', label: 'Key click' },
      { k: 'vol', t: 'range', label: 'Click volume', min: 0.05, max: 1, step: 0.05, fmt: pct }
    ]},
    { id: 'screen', label: 'Screen', items: [
      { k: 'theme', t: 'select', label: 'Colours', options: [
        ['classic', 'Classic grey'], ['paper', 'Warm paper'], ['midnight', 'Midnight'],
        ['amber', 'Amber monochrome'], ['green', 'Green phosphor'] ] },
      { k: 'preset', t: 'select', label: 'Typeface', options: [
        ['period', 'Period correct — Tahoma / Courier New'],
        ['plex', 'IBM Plex — sixteen years early'],
        ['custom', 'Custom'] ] },
      { k: 'uiFont', t: 'select', label: 'Interface face', options: [
        ['tahoma', 'Tahoma'], ['verdana', 'Verdana'], ['sans', 'MS Sans Serif'],
        ['plex', 'IBM Plex Sans (2017)'], ['system', 'System sans'] ] },
      { k: 'monoFont', t: 'select', label: 'Note face', options: [
        ['courier', 'Courier New'], ['lucida', 'Lucida Console'], ['andale', 'Andale Mono'],
        ['consolas', 'Consolas (2006)'], ['plex', 'IBM Plex Mono (2017)'], ['system', 'System mono'] ] },
      { k: 'fontSize', t: 'range', label: 'Note size', min: 10, max: 20, step: 0.5, fmt: px },
      { k: 'lineHeight', t: 'range', label: 'Line spacing', min: 1.15, max: 1.9, step: 0.05, fmt: two },
      { k: 'wrap', t: 'check', label: 'Word wrap' },
      { k: 'tabSize', t: 'select', num: true, label: 'Tab width', options: [
        [2, '2'], [4, '4'], [8, '8 — period correct'] ] },
      { k: 'spellcheck', t: 'check', label: 'Spell check',
        hint: 'Nobody had this in 2001' },
      { k: 'statusbar', t: 'check', label: 'Status bar' }
    ]},
    { id: 'notes', label: 'Notes', items: [
      { k: 'list', t: 'check', label: 'Note list' },
      { k: 'listSide', t: 'select', label: 'List position', options: [
        ['left', 'Left'], ['right', 'Right'] ] },
      { k: 'listWidth', t: 'range', label: 'List width', min: 110, max: 340, step: 2, fmt: px },
      { k: 'sort', t: 'select', label: 'Sort by', options: [
        ['updated', 'Last edited'], ['created', 'Created'], ['title', 'Title A-Z'] ] },
      { k: 'dateFormat', t: 'select', label: 'Dates', options: [
        ['relative', 'Today / Yesterday'], ['iso', 'YYYY-MM-DD'] ] },
      { k: 'startup', t: 'select', label: 'On opening', options: [
        ['last', 'The note I had open'], ['new', 'A new blank note'] ] }
    ]}
  ];

  /* older saved preferences -> the shape above */
  function migrate(saved) {
    var p = {};
    var key;
    for (key in DEFAULTS) if (DEFAULTS.hasOwnProperty(key)) p[key] = DEFAULTS[key];
    if (!saved || typeof saved !== 'object') return p;

    for (key in saved) if (p.hasOwnProperty(key)) p[key] = saved[key];

    if (saved.font === 'plex' || saved.font === 'period') p.preset = saved.font;
    if (saved.preset === undefined && (saved.font === 'plex' || saved.font === 'period')) {
      p.uiFont = saved.font === 'plex' ? 'plex' : 'tahoma';
      p.monoFont = saved.font === 'plex' ? 'plex' : 'courier';
    }
    if (typeof saved.size === 'string' && saved.fontSize === undefined) {
      p.fontSize = { s: 11.5, m: 13, l: 15.5 }[saved.size] || DEFAULTS.fontSize;
    }
    if (typeof saved.keyboard === 'boolean' && saved.deck === undefined) p.deck = saved.keyboard;
    return p;
  }

  /* ---------- the form ---------- */
  function control(item, prefs, onChange) {
    var row = document.createElement('div');
    row.className = 'set-row';

    var label = document.createElement('label');
    label.className = 'set-label';
    label.textContent = item.label;
    var id = 'set-' + item.k;
    label.htmlFor = id;

    var field = document.createElement('div');
    field.className = 'set-field';
    var input;

    if (item.t === 'check') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'set-check';
      input.checked = !!prefs[item.k];
      input.addEventListener('change', function () { onChange(item.k, input.checked, item); });
      row.classList.add('is-check');
      field.appendChild(input);
    } else if (item.t === 'select') {
      input = document.createElement('select');
      input.className = 'set-select';
      item.options.forEach(function (opt) {
        var o = document.createElement('option');
        o.value = String(opt[0]);
        o.textContent = opt[1];
        if (String(prefs[item.k]) === String(opt[0])) o.selected = true;
        input.appendChild(o);
      });
      input.addEventListener('change', function () {
        onChange(item.k, item.num ? Number(input.value) : input.value, item);
      });
      field.appendChild(input);
    } else {
      input = document.createElement('input');
      input.type = 'range';
      input.className = 'set-range';
      input.min = item.min; input.max = item.max; input.step = item.step;
      input.value = prefs[item.k];
      var out = document.createElement('span');
      out.className = 'set-out';
      out.textContent = (item.fmt || String)(prefs[item.k]);
      input.addEventListener('input', function () {
        var v = Number(input.value);
        out.textContent = (item.fmt || String)(v);
        onChange(item.k, v, item);
      });
      field.appendChild(input);
      field.appendChild(out);
    }
    input.id = id;

    row.appendChild(label);
    row.appendChild(field);
    if (item.hint) {
      var hint = document.createElement('div');
      hint.className = 'set-hint';
      hint.textContent = item.hint;
      row.appendChild(hint);
    }
    return row;
  }

  /* Returns { node, refresh } — refresh re-reads prefs into the controls
     so that a change in one place (a preset, say) shows up in another. */
  function buildForm(prefs, onChange, actions) {
    var wrap = document.createElement('div');
    wrap.className = 'settings';

    var tabs = document.createElement('div');
    tabs.className = 'dlg-tabs';
    var panes = document.createElement('div');
    panes.className = 'set-panes';
    wrap.appendChild(tabs);
    wrap.appendChild(panes);

    var built = {};
    function show(id) {
      Array.prototype.forEach.call(tabs.children, function (t) {
        t.classList.toggle('on', t.dataset.tab === id);
      });
      Array.prototype.forEach.call(panes.children, function (p) {
        p.hidden = p.dataset.tab !== id;
      });
    }

    GROUPS.forEach(function (group, i) {
      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'dlg-tab' + (i === 0 ? ' on' : '');
      tab.dataset.tab = group.id;
      tab.textContent = group.label;
      tab.addEventListener('click', function () { show(group.id); });
      tabs.appendChild(tab);

      var pane = document.createElement('div');
      pane.className = 'set-pane';
      pane.dataset.tab = group.id;
      pane.hidden = i !== 0;
      group.items.forEach(function (item) {
        var row = control(item, prefs, onChange);
        built[item.k] = row;
        pane.appendChild(row);
      });
      panes.appendChild(pane);
    });

    /* data tab */
    var dataTab = document.createElement('button');
    dataTab.type = 'button';
    dataTab.className = 'dlg-tab';
    dataTab.dataset.tab = 'data';
    dataTab.textContent = 'Data';
    dataTab.addEventListener('click', function () { show('data'); });
    tabs.appendChild(dataTab);

    var dataPane = document.createElement('div');
    dataPane.className = 'set-pane';
    dataPane.dataset.tab = 'data';
    dataPane.hidden = true;
    var report = document.createElement('div');
    report.className = 'sunken';
    report.textContent = actions.report();
    dataPane.appendChild(report);
    [
      ['Back up everything (.json)', 'backup', 'Notes and settings in one file.'],
      ['Restore from a backup…', 'restore', 'Replaces everything currently on this machine.'],
      ['Empty the trash…', 'trash', 'Deleted notes are kept for 30 days before they go on their own.'],
      ['Reset settings', 'reset', 'Puts every switch on this page back to standard.'],
      ['Erase all notes…', 'erase', 'There is no wastebasket. Back up first.']
    ].forEach(function (spec) {
      var row = document.createElement('div');
      row.className = 'set-row is-action';
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.textContent = spec[0];
      b.addEventListener('click', function () { actions[spec[1]](); });
      var hint = document.createElement('div');
      hint.className = 'set-hint';
      hint.textContent = spec[2];
      row.appendChild(b);
      row.appendChild(hint);
      dataPane.appendChild(row);
    });
    panes.appendChild(dataPane);

    function refresh() {
      GROUPS.forEach(function (group) {
        group.items.forEach(function (item) {
          var row = built[item.k];
          if (!row) return;
          var input = row.querySelector('input,select');
          if (!input) return;
          if (item.t === 'check') input.checked = !!prefs[item.k];
          else input.value = String(prefs[item.k]);
          var out = row.querySelector('.set-out');
          if (out) out.textContent = (item.fmt || String)(prefs[item.k]);
        });
      });
      report.textContent = actions.report();
    }

    return { node: wrap, refresh: refresh };
  }

  global.TPSettings = {
    DEFAULTS: DEFAULTS, GROUPS: GROUPS, migrate: migrate, buildForm: buildForm,
    UI_FONTS: UI_FONTS, MONO_FONTS: MONO_FONTS, MONO_NAMES: MONO_NAMES
  };
})(window);
