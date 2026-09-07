/* ============================================================
   store.js — where the notes actually live
   One localStorage key per note plus a small index, so saving
   a keystroke rewrites one note instead of all of them. Knows
   nothing about the DOM.
   ============================================================ */
(function (global) {
  'use strict';
  var TP = global.TP = global.TP || {};

  var INDEX_KEY = 'thinkpad.index.v2';
  var NOTE_PREFIX = 'thinkpad.note.';
  var PREFS_KEY = 'thinkpad.prefs.v1';
  var LEGACY_KEY = 'thinkpad.notes.v1';
  var PREFIX = 'thinkpad.';

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
  function remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* nothing else to try */ }
  }
  function noteKey(id) { return NOTE_PREFIX + id; }
  function idsOf(db) { return db.notes.map(function (n) { return n.id; }); }

  function clean(n) {
    if (!n || typeof n.body !== 'string' || !n.id) return null;
    return {
      id: n.id,
      body: n.body,
      created: n.created || Date.now(),
      updated: n.updated || Date.now(),
      caret: n.caret || 0,
      deleted: n.deleted || undefined
    };
  }

  /* ---------- reading ---------- */
  function load() {
    var index = readJSON(INDEX_KEY, null);
    if (index && Array.isArray(index.ids)) {
      var notes = [];
      index.ids.forEach(function (id) {
        var note = clean(readJSON(noteKey(id), null));
        if (note) notes.push(note);
      });
      return { notes: notes, activeId: index.activeId || (notes[0] && notes[0].id) || null };
    }
    return migrate() || { notes: [], activeId: null };
  }

  /* One big blob was the old shape. Split it up, check it landed, and
     only then let go of the original. */
  function migrate() {
    var old = readJSON(LEGACY_KEY, null);
    if (!old || !Array.isArray(old.notes)) return null;

    var db = {
      notes: old.notes.map(clean).filter(Boolean),
      activeId: old.activeId || null
    };
    if (!saveAll(db)) return db;                 /* out of room: leave v1 alone */

    var check = readJSON(INDEX_KEY, null);
    if (check && check.ids && check.ids.length === db.notes.length) remove(LEGACY_KEY);
    return db;
  }

  function loadNote(id) { return clean(readJSON(noteKey(id), null)); }

  /* ---------- writing ---------- */
  function saveNote(note) {
    return writeJSON(noteKey(note.id), note);
  }
  function saveIndex(db) {
    return writeJSON(INDEX_KEY, { v: 2, activeId: db.activeId, ids: idsOf(db) });
  }
  function saveAll(db) {
    var ok = true;
    db.notes.forEach(function (n) { if (!saveNote(n)) ok = false; });
    return saveIndex(db) && ok;
  }
  function dropNote(id) { remove(noteKey(id)); }

  /* Forget everything this app has stored, notes and all. */
  function eraseNotes(db) {
    db.notes.forEach(function (n) { dropNote(n.id); });
    remove(INDEX_KEY);
    remove(LEGACY_KEY);
  }

  /* ---------- preferences ---------- */
  function loadPrefs() { return readJSON(PREFS_KEY, null); }
  function savePrefs(prefs) { return writeJSON(PREFS_KEY, prefs); }
  function clearPrefs() { remove(PREFS_KEY); }

  /* ---------- housekeeping ---------- */
  function bytes() {
    var total = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf(PREFIX) === 0) {
          total += key.length + (localStorage.getItem(key) || '').length;
        }
      }
    } catch (e) { return 0; }
    return total;
  }

  /* Everything we hold, as text, for the "it broke, give me my notes"
     button on the failure panel. */
  function dump() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf(PREFIX) === 0) {
          out.push(key + '\n' + localStorage.getItem(key) + '\n');
        }
      }
    } catch (e) { return 'localStorage is unavailable in this browser.'; }
    return out.length ? out.join('\n') : '(nothing stored)';
  }

  /* A storage event from another tab, classified. */
  function classify(event) {
    if (!event.key) return null;                       /* a wholesale clear */
    if (event.key === INDEX_KEY) {
      var index = null;
      try { index = JSON.parse(event.newValue); } catch (e) { return null; }
      return index && Array.isArray(index.ids) ? { kind: 'index', ids: index.ids } : null;
    }
    if (event.key.indexOf(NOTE_PREFIX) === 0) {
      var note = null;
      try { note = clean(JSON.parse(event.newValue)); } catch (e) { return null; }
      return note ? { kind: 'note', note: note } : null;
    }
    return null;
  }

  TP.store = {
    load: load, loadNote: loadNote,
    saveNote: saveNote, saveIndex: saveIndex, saveAll: saveAll,
    dropNote: dropNote, eraseNotes: eraseNotes,
    loadPrefs: loadPrefs, savePrefs: savePrefs, clearPrefs: clearPrefs,
    bytes: bytes, dump: dump, classify: classify,
    INDEX_KEY: INDEX_KEY, NOTE_PREFIX: NOTE_PREFIX, PREFS_KEY: PREFS_KEY, LEGACY_KEY: LEGACY_KEY
  };
})(window);
