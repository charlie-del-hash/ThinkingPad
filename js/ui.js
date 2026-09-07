/* ============================================================
   ui.js — the window furniture
   Dialogs, menus and the status bar: the period-correct bits
   that know nothing about notes. Keyboard-navigable, because
   a menu you cannot reach with the arrow keys is a picture of
   a menu.
   ============================================================ */
(function (global) {
  'use strict';
  var TP = global.TP = global.TP || {};

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var deps = {};
  var menuSpec = [];
  var openMenu = null;
  var openDialogEl = null;
  var returnFocusTo = null;

  function init(options) {
    deps = options;
    document.addEventListener('click', function (e) {
      if (openMenu && !deps.menubar.contains(e.target)) closeMenu();
    });
    deps.modalLayer.addEventListener('mousedown', function (e) {
      if (e.target === deps.modalLayer) closeDialog();
    });
    document.addEventListener('keydown', onKeydown, true);

    /* Underlines under the menu hotkeys only show while Alt is held —
       which is exactly how they behaved. */
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Alt') document.body.classList.add('alt-held');
    });
    window.addEventListener('keyup', function (e) {
      if (e.key === 'Alt') document.body.classList.remove('alt-held');
    });
    window.addEventListener('blur', function () { document.body.classList.remove('alt-held'); });
  }

  /* ---------------------------------------------------------
     status bar
     --------------------------------------------------------- */
  var msgTimer = null, msgExpiry = null;

  function setMsg(text, opts) {
    var o = (typeof opts === 'boolean') ? { quiet: opts } : (opts || {});
    var cell = deps.statusCell;
    cell.textContent = text;
    if (msgTimer) clearTimeout(msgTimer);
    if (msgExpiry) { clearTimeout(msgExpiry); msgExpiry = null; }

    if (o.action) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'st-action';
      b.textContent = o.action.label;
      b.addEventListener('click', o.action.act);
      cell.appendChild(document.createTextNode(' '));
      cell.appendChild(b);
      msgExpiry = setTimeout(function () { setMsg('Ready', true); }, o.expires || 30000);
    }
    if (!o.quiet) {
      cell.classList.add('flash');
      msgTimer = setTimeout(function () { cell.classList.remove('flash'); }, 700);
    }
  }

  /* ---------------------------------------------------------
     dialogs
     --------------------------------------------------------- */
  function focusable(root) {
    return $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', root)
      .filter(function (el) { return !el.disabled && el.offsetParent !== null; });
  }

  function dialog(opts) {
    closeDialog();
    returnFocusTo = document.activeElement;

    var dlg = document.createElement('div');
    dlg.className = 'dlg' + (opts.wide ? ' wide' : '');
    dlg.setAttribute('role', 'dialog');
    dlg.setAttribute('aria-modal', 'true');
    dlg.setAttribute('aria-label', opts.title || 'ThinkPad Notes');

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
    (opts.buttons || [{ label: 'OK', primary: true }]).forEach(function (spec) {
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

    dlg.appendChild(bar);
    dlg.appendChild(bodyEl);
    dlg.appendChild(foot);
    deps.modalLayer.textContent = '';
    deps.modalLayer.appendChild(dlg);
    deps.modalLayer.hidden = false;
    document.body.classList.add('modal');
    openDialogEl = dlg;

    var first = $('.dlg-foot .btn', dlg);
    if (first) first.focus();
    return dlg;
  }

  function closeDialog() {
    if (!openDialogEl) return;
    deps.modalLayer.hidden = true;
    deps.modalLayer.textContent = '';
    document.body.classList.remove('modal');
    openDialogEl = null;
    if (deps.onDialogClose) deps.onDialogClose();

    if (returnFocusTo && document.contains(returnFocusTo) && returnFocusTo.offsetParent !== null) {
      returnFocusTo.focus();
    } else if (deps.refocus) {
      deps.refocus();
    }
    returnFocusTo = null;
  }

  /* the three-line confirmation this app kept rewriting */
  function confirm(opts) {
    return dialog({
      title: opts.title,
      bodyHTML: opts.bodyHTML,
      onBuild: opts.onBuild,
      buttons: [
        { label: opts.confirmLabel || 'OK', primary: true, act: opts.act },
        { label: opts.cancelLabel || 'Cancel' }
      ]
    });
  }

  /* ---------------------------------------------------------
     menus
     --------------------------------------------------------- */
  function buildMenus(spec) {
    menuSpec = spec;
    var menubar = deps.menubar;

    spec.forEach(function (menu) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-top';
      btn.dataset.menu = menu.id;
      btn.setAttribute('role', 'menuitem');
      btn.setAttribute('aria-haspopup', 'true');
      btn.setAttribute('aria-expanded', 'false');
      var i = menu.label.toLowerCase().indexOf(menu.key);
      btn.innerHTML = menu.label.slice(0, i) + '<u>' + menu.label.charAt(i) + '</u>' +
                      menu.label.slice(i + 1);

      var dd = document.createElement('div');
      dd.className = 'dropdown';
      dd.hidden = true;
      dd.dataset.menu = menu.id;
      dd.setAttribute('role', 'menu');

      menu.items.forEach(function (item) {
        if (item.sep) {
          var sep = document.createElement('div');
          sep.className = 'msep';
          sep.setAttribute('role', 'separator');
          dd.appendChild(sep);
          return;
        }
        var mi = document.createElement('button');
        mi.type = 'button';
        mi.className = 'mi' + (item.radio ? ' radio' : '');
        mi.setAttribute('role', item.check || item.radio ? 'menuitemcheckbox' : 'menuitem');
        mi.tabIndex = -1;
        if (item.check) mi.dataset.check = item.check;
        if (item.radio) { mi.dataset.radio = item.radio; mi.dataset.value = item.value; }

        var label = document.createElement('span');
        label.className = 'lbl';
        label.textContent = item.label;
        mi.appendChild(label);
        if (item.accel) {
          var accel = document.createElement('span');
          accel.className = 'accel';
          accel.textContent = item.accel;
          mi.appendChild(accel);
        }
        mi.addEventListener('click', function () {
          closeMenu();
          if (item.act) item.act();
        });
        mi.addEventListener('mouseenter', function () { focusItem(mi); });
        dd.appendChild(mi);
      });

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (openMenu === menu.id) closeMenu();
        else showMenu(menu.id);
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
      var on = false;
      if (mi.dataset.check) on = !!deps.stateFor(mi.dataset.check);
      if (mi.dataset.radio) on = String(deps.stateFor(mi.dataset.radio)) === mi.dataset.value;
      mi.classList.toggle('checked', on);
      if (mi.dataset.check || mi.dataset.radio) mi.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  function showMenu(id) {
    closeMenu();
    var menubar = deps.menubar;
    var btn = $('.menu-top[data-menu="' + id + '"]', menubar);
    var dd = $('.dropdown[data-menu="' + id + '"]', menubar);
    if (!btn || !dd) return;
    btn.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    syncMenuState(dd);
    dd.hidden = false;
    dd.style.left = btn.offsetLeft + 'px';
    var overflow = (btn.offsetLeft + dd.offsetWidth) - menubar.clientWidth;
    if (overflow > 0) dd.style.left = Math.max(0, btn.offsetLeft - overflow - 2) + 'px';
    openMenu = id;
  }

  function closeMenu() {
    if (!openMenu) return;
    $$('.menu-top', deps.menubar).forEach(function (b) {
      b.classList.remove('open');
      b.setAttribute('aria-expanded', 'false');
    });
    $$('.dropdown', deps.menubar).forEach(function (d) { d.hidden = true; });
    $$('.mi.focus', deps.menubar).forEach(function (m) { m.classList.remove('focus'); });
    openMenu = null;
  }

  function items() {
    if (!openMenu) return [];
    return $$('.dropdown[data-menu="' + openMenu + '"] .mi:not(.disabled)', deps.menubar);
  }
  function focusItem(mi) {
    $$('.mi.focus', deps.menubar).forEach(function (m) { m.classList.remove('focus'); });
    if (mi) mi.classList.add('focus');
  }
  function moveFocus(step) {
    var list = items();
    if (!list.length) return;
    var current = list.indexOf($('.mi.focus', deps.menubar));
    var next = current < 0
      ? (step > 0 ? 0 : list.length - 1)
      : (current + step + list.length) % list.length;
    focusItem(list[next]);
  }
  function siblingMenu(step) {
    var ids = menuSpec.map(function (m) { return m.id; });
    var i = ids.indexOf(openMenu);
    if (i < 0) return;
    showMenu(ids[(i + step + ids.length) % ids.length]);
  }

  /* ---------------------------------------------------------
     keyboard: menus first, then the dialog trap
     --------------------------------------------------------- */
  function onKeydown(e) {
    if (openMenu) {
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); moveFocus(1); return;
        case 'ArrowUp': e.preventDefault(); moveFocus(-1); return;
        case 'ArrowRight': e.preventDefault(); siblingMenu(1); return;
        case 'ArrowLeft': e.preventDefault(); siblingMenu(-1); return;
        case 'Home': e.preventDefault(); focusItem(items()[0]); return;
        case 'End': e.preventDefault(); focusItem(items()[items().length - 1]); return;
        case 'Enter':
        case ' ': {
          var focused = $('.mi.focus', deps.menubar);
          if (focused) { e.preventDefault(); focused.click(); }
          return;
        }
        case 'Escape': e.preventDefault(); closeMenu(); if (deps.refocus) deps.refocus(); return;
        default: break;
      }
    }

    if (!openDialogEl) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeDialog();
      return;
    }
    if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SELECT') {
      var primary = $('.dlg-foot .btn', openDialogEl);
      if (primary) { e.preventDefault(); primary.click(); }
      return;
    }
    if (e.key === 'Tab') {
      var stops = focusable(openDialogEl);
      if (!stops.length) return;
      var first = stops[0], last = stops[stops.length - 1];
      if (e.shiftKey && (document.activeElement === first || !openDialogEl.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  TP.ui = {
    init: init,
    setMsg: setMsg,
    dialog: dialog,
    closeDialog: closeDialog,
    confirm: confirm,
    buildMenus: buildMenus,
    showMenu: showMenu,
    closeMenu: closeMenu,
    menuIsOpen: function () { return !!openMenu; },
    dialogEl: function () { return openDialogEl; }
  };
})(window);
