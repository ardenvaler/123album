/*
 * Atlas — namespace and the public data API used by files in /data.
 *
 *   Atlas.add({...}, {...})      add one or more entries (any type)
 *   Atlas.project({...})         describe a project (optional; projects are also
 *                                discovered automatically from entries)
 *
 * Entries are kept raw here and normalized once, at boot (see store.js),
 * so data files can be loaded in any order.
 */
(function () {
  'use strict';
  var Atlas = (window.Atlas = window.Atlas || {});

  Atlas.version = '0.1.0';
  Atlas._raw = [];
  Atlas._projects = [];

  Atlas.add = function () {
    for (var i = 0; i < arguments.length; i++) {
      var a = arguments[i];
      if (Array.isArray(a)) a.forEach(function (x) { Atlas._raw.push(x); });
      else if (a && typeof a === 'object') Atlas._raw.push(a);
    }
  };

  Atlas.project = function () {
    for (var i = 0; i < arguments.length; i++) {
      var a = arguments[i];
      if (Array.isArray(a)) a.forEach(function (x) { Atlas._projects.push(x); });
      else if (a && typeof a === 'object') Atlas._projects.push(a);
    }
  };

  // Tiny pub/sub so UI pieces can react to data changes (local notes, CSV drops…)
  var listeners = {};
  Atlas.on = function (evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); };
  Atlas.emit = function (evt, payload) { (listeners[evt] || []).forEach(function (fn) { fn(payload); }); };

  // Safe localStorage wrapper — storage may be unavailable (private mode, file://)
  Atlas.storage = {
    get: function (k, fallback) {
      try { var v = localStorage.getItem('atlas.' + k); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set: function (k, v) {
      try { localStorage.setItem('atlas.' + k, JSON.stringify(v)); } catch (e) {}
    },
    del: function (k) {
      try { localStorage.removeItem('atlas.' + k); } catch (e) {}
    }
  };
})();
