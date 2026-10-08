/*
 * Metis — namespace and the public data API used by files in /data.
 *
 *   Metis.add({...}, {...})      add one or more entries (any type)
 *   Metis.project({...})         describe a project (optional; projects are also
 *                                discovered automatically from entries)
 *
 * Entries are kept raw here and normalized once, at boot (see store.js),
 * so data files can be loaded in any order.
 */
(function () {
  'use strict';
  var Metis = (window.Metis = window.Metis || {});

  Metis.version = '0.1.0';
  Metis._raw = [];
  Metis._projects = [];

  Metis.add = function () {
    for (var i = 0; i < arguments.length; i++) {
      var a = arguments[i];
      if (Array.isArray(a)) a.forEach(function (x) { Metis._raw.push(x); });
      else if (a && typeof a === 'object') Metis._raw.push(a);
    }
  };

  Metis.project = function () {
    for (var i = 0; i < arguments.length; i++) {
      var a = arguments[i];
      if (Array.isArray(a)) a.forEach(function (x) { Metis._projects.push(x); });
      else if (a && typeof a === 'object') Metis._projects.push(a);
    }
  };

  // Tiny pub/sub so UI pieces can react to data changes (local notes, CSV drops…)
  var listeners = {};
  Metis.on = function (evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); };
  Metis.emit = function (evt, payload) { (listeners[evt] || []).forEach(function (fn) { fn(payload); }); };

  // Safe localStorage wrapper — storage may be unavailable (private mode, file://)
  Metis.storage = {
    get: function (k, fallback) {
      try { var v = localStorage.getItem('metis.' + k); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set: function (k, v) {
      try { localStorage.setItem('metis.' + k, JSON.stringify(v)); } catch (e) {}
    },
    del: function (k) {
      try { localStorage.removeItem('metis.' + k); } catch (e) {}
    }
  };
})();
