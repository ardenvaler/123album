/*
 * Text utilities: tokenizing, light stemming, synonyms, fuzzy matching,
 * number formatting and HTML escaping.
 */
(function () {
  'use strict';
  var T = (Atlas.text = {});

  var STOP = (
    'a an and are as at be been being but by can could did do does doing done for from had has have having ' +
    'he her here hers him his how i if in into is it its itself just me my myself no nor not of off on once only ' +
    'or other our ours out over own same she should so some such than that the their theirs them then there these ' +
    'they this those through to too under until up very was we were what when where which while who whom why will ' +
    'with would you your yours yourself also about again all any each few more most much get got show find give ' +
    'tell list see let lets please pls want need know look looking anything something everything thing things ' +
    'whats what\'s whats\' there\'s im i\'m ive i\'ve via per'
  ).split(/\s+/);
  T.STOP = new Set(STOP);

  // Groups of words treated as equivalent during search. Stems are applied on load.
  var SYN_GROUPS = [
    ['cost', 'costs', 'spend', 'spending', 'expense', 'expenses', 'expenditure', 'outlay'],
    ['revenue', 'sales', 'income', 'turnover', 'earnings'],
    ['budget', 'allocation', 'funding'],
    ['profit', 'margin', 'gain'],
    ['meeting', 'call', 'sync', 'standup', 'catchup', 'catch-up'],
    ['bug', 'issue', 'defect', 'incident', 'problem', 'ticket'],
    ['deadline', 'due', 'cutoff'],
    ['launch', 'release', 'ship', 'shipped', 'rollout', 'deploy', 'deployment', 'go-live', 'golive'],
    ['client', 'customer', 'account', 'stakeholder'],
    ['hire', 'hiring', 'recruit', 'recruiting', 'candidate', 'interview'],
    ['doc', 'docs', 'document', 'documentation', 'report', 'writeup', 'write-up'],
    ['review', 'feedback', 'critique', 'approval', 'sign-off', 'signoff'],
    ['plan', 'roadmap', 'strategy', 'planning'],
    ['design', 'ui', 'ux', 'mockup', 'prototype', 'figma'],
    ['test', 'testing', 'qa', 'quality'],
    ['user', 'users', 'people', 'audience'],
    ['team', 'staff', 'headcount', 'crew'],
    ['hour', 'hours', 'time', 'effort'],
    ['invoice', 'bill', 'billing', 'payment'],
    ['contract', 'agreement', 'sow', 'msa'],
    ['vendor', 'supplier', 'partner'],
    ['research', 'study', 'analysis', 'survey'],
    ['website', 'site', 'web', 'webpage'],
    ['app', 'application', 'mobile'],
    ['data', 'dataset', 'numbers'],
    ['birthday', 'bday', 'anniversary'],
    ['renewal', 'renew', 'expiry', 'expire', 'expires', 'expiration']
  ];

  // Light English stemmer — deliberately conservative so prefixes still match.
  T.stem = function (w) {
    if (!w || w.length < 4 || /^\d/.test(w)) return w;
    if (/ies$/.test(w) && w.length > 4) return w.slice(0, -3) + 'y';
    if (/sses$/.test(w)) return w.slice(0, -2);
    if (/([^s])s$/.test(w) && !/(us|is|ss)$/.test(w)) w = w.slice(0, -1);
    if (/ing$/.test(w) && w.length > 5) {
      w = w.slice(0, -3);
      if (/(.)\1$/.test(w) && !/(ll|ss|zz)$/.test(w)) w = w.slice(0, -1);
      return w;
    }
    if (/ed$/.test(w) && w.length > 4) {
      w = w.slice(0, -2);
      if (/(.)\1$/.test(w) && !/(ll|ss|zz)$/.test(w)) w = w.slice(0, -1);
      return w;
    }
    if (/ly$/.test(w) && w.length > 5) return w.slice(0, -2);
    return w;
  };

  T.norm = function (s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[’‘]/g, "'");
  };

  // Raw lowercase words (no stopword removal)
  T.words = function (s) {
    return T.norm(s).match(/[a-z0-9][a-z0-9'\-\.]*[a-z0-9]|[a-z0-9]/g) || [];
  };

  // Content tokens: stopwords removed, stemmed
  T.tokens = function (s) {
    var out = [];
    T.words(s).forEach(function (w) {
      w = w.replace(/'s$/, '').replace(/'/g, '');
      if (!w || T.STOP.has(w)) return;
      // split hyphen/dot compounds but keep the compound too
      if (/[\-\.]/.test(w) && !/^\d[\d\.\-]*$/.test(w)) {
        out.push(T.stem(w.replace(/[\-\.]/g, '')));
        w.split(/[\-\.]/).forEach(function (p) { if (p && !T.STOP.has(p)) out.push(T.stem(p)); });
      } else out.push(T.stem(w));
    });
    return out;
  };

  var SYN = new Map();
  SYN_GROUPS.forEach(function (g) {
    var stems = g.map(function (w) { return T.stem(T.norm(w).replace(/[\-]/g, '')); });
    stems.forEach(function (s) {
      var set = SYN.get(s) || new Set();
      stems.forEach(function (o) { if (o !== s) set.add(o); });
      SYN.set(s, set);
    });
  });
  T.synonyms = function (stem) { return SYN.has(stem) ? Array.from(SYN.get(stem)) : []; };

  // Damerau-free Levenshtein with early exit
  T.lev = function (a, b, max) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = new Array(b.length + 1), cur = new Array(b.length + 1), i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i; var best = cur[0];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      var t = prev; prev = cur; cur = t;
    }
    return prev[b.length];
  };

  T.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  T.slug = function (s) {
    return T.norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'item';
  };

  T.cap = function (s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };

  T.plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); };

  // ---- numbers ----
  T.parseNum = function (v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (v == null) return null;
    var s = String(v).trim();
    if (!s) return null;
    var neg = /^\(.*\)$/.test(s) || /^-/.test(s);
    var m = s.replace(/[\s,]/g, '').match(/^[\(\-+]?[$€£¥]?[\(\-+]?(\d+(?:\.\d+)?|\.\d+)([kmb])?%?\)?$/i);
    if (!m) return null;
    var n = parseFloat(m[1]);
    var suf = (m[2] || '').toLowerCase();
    if (suf === 'k') n *= 1e3; else if (suf === 'm') n *= 1e6; else if (suf === 'b') n *= 1e9;
    return neg ? -n : n;
  };

  T.unitOf = function (v) {
    var s = String(v == null ? '' : v);
    if (/%\s*$/.test(s)) return '%';
    var m = s.match(/[$€£¥]/);
    return m ? m[0] : '';
  };

  T.fmt = function (n, unit, opts) {
    if (n == null || !isFinite(n)) return '—';
    opts = opts || {};
    var abs = Math.abs(n), s;
    if (opts.compact !== false && abs >= 1e9) s = trim(n / 1e9) + 'B';
    else if (opts.compact !== false && abs >= 1e6) s = trim(n / 1e6) + 'M';
    else if (opts.compact !== false && abs >= 1e4) s = trim(n / 1e3) + 'K';
    else s = n.toLocaleString('en-US', { maximumFractionDigits: abs < 10 ? 2 : abs < 1000 ? 1 : 0 });
    if (!unit) return s;
    if (unit === '%') return s + '%';
    if (/^[$€£¥]$/.test(unit)) return (n < 0 ? '−' + unit + s.replace('-', '') : unit + s);
    return s + ' ' + unit;
    function trim(x) { return (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(1)).replace(/\.0$/, ''); }
  };

  T.pct = function (p, signed) {
    if (p == null || !isFinite(p)) return '—';
    var s = (Math.abs(p) >= 10 ? Math.round(p) : Math.round(p * 10) / 10) + '%';
    return signed ? (p > 0 ? '+' : p < 0 ? '−' : '') + s.replace('-', '') : s;
  };
})();
