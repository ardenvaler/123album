/*
 * Date helpers + natural-language date-range parsing.
 * All dates are local-time, day precision unless a time is given.
 */
(function () {
  'use strict';
  var D = (Metis.dates = {});
  var DAY = 864e5;

  D.MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  D.MON3 = D.MONTHS.map(function (m) { return m.slice(0, 3); });
  D.WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  // "now" can be overridden for testing: ?today=2026-10-08
  D.now = function () {
    var o = D._override;
    if (o) { var n = new Date(); return new Date(o.getFullYear(), o.getMonth(), o.getDate(), n.getHours(), n.getMinutes()); }
    return new Date();
  };
  try {
    var qp = new URLSearchParams(location.search).get('today');
    if (qp) D._override = parse(qp);
  } catch (e) {}

  D.today = function () { var n = D.now(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  D.startOfDay = function (d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  D.addDays = function (d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); };
  D.addMonths = function (d, n) {
    var t = new Date(d.getFullYear(), d.getMonth() + n, 1);
    var last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), last));
  };
  D.diffDays = function (a, b) { return Math.round((D.startOfDay(b) - D.startOfDay(a)) / DAY); };
  D.iso = function (d) {
    if (!d) return '';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // Accepts: Date, "2026-10-08", "2026-10-08T14:00", "2026/10/08", "Oct 8 2026", "8 October 2026", "10/08/2026"
  function parse(v) {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    if (typeof v === 'number') return new Date(v);
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{4})[\-\/\.](\d{1,2})[\-\/\.](\d{1,2})(?:[T\s](\d{1,2}):(\d{2}))?/)))
      return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
    if ((m = s.match(/^(\d{4})[\-\/](\d{1,2})$/))) return new Date(+m[1], +m[2] - 1, 1);
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return new Date(+m[3], +m[1] - 1, +m[2]); // US m/d/y
    var low = s.toLowerCase();
    if ((m = low.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/)) && mon(m[1]) >= 0) return new Date(+m[3], mon(m[1]), +m[2]);
    if ((m = low.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?,?\s+(\d{4})$/)) && mon(m[2]) >= 0) return new Date(+m[3], mon(m[2]), +m[1]);
    if ((m = low.match(/^([a-z]{3,9})\.?\s+(\d{4})$/)) && mon(m[1]) >= 0) return new Date(+m[2], mon(m[1]), 1);
    var d = new Date(s);
    return isNaN(d) ? null : d;
  }
  D.parse = parse;

  function mon(w) {
    w = String(w).toLowerCase().slice(0, 3);
    if (w === 'sep') return 8;
    return D.MON3.indexOf(w);
  }
  D.monthIndex = mon;

  D.fmt = function (d, style) {
    if (!d) return '';
    var t = D.today(), y = d.getFullYear() !== t.getFullYear();
    if (style === 'long') return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: y ? 'numeric' : undefined });
    if (style === 'day') return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: y ? 'numeric' : undefined });
  };

  // "today", "tomorrow", "in 3 days", "2 weeks ago", "Fri, Oct 10"
  D.relative = function (d) {
    if (!d) return '';
    var n = D.diffDays(D.today(), d);
    if (n === 0) return 'today';
    if (n === 1) return 'tomorrow';
    if (n === -1) return 'yesterday';
    if (n > 1 && n < 7) return 'in ' + n + ' days · ' + D.WEEKDAYS[d.getDay()].slice(0, 3).replace(/^./, function (c) { return c.toUpperCase(); });
    if (n >= 7 && n < 45) return 'in ' + Math.round(n / 7) + (Math.round(n / 7) === 1 ? ' week' : ' weeks');
    if (n < -1 && n > -7) return -n + ' days ago';
    if (n <= -7 && n > -45) return Math.round(-n / 7) + (Math.round(-n / 7) === 1 ? ' week ago' : ' weeks ago');
    return D.fmt(d);
  };

  D.weekStart = function (d) { var x = D.startOfDay(d); var wd = (x.getDay() + 6) % 7; return D.addDays(x, -wd); }; // Monday
  D.quarter = function (d) { return Math.floor(d.getMonth() / 3) + 1; };

  // Facet words for a date, used as automatic keywords.
  D.facets = function (d) {
    if (!d) return [];
    return [D.MONTHS[d.getMonth()], String(d.getFullYear()), 'q' + D.quarter(d), D.WEEKDAYS[d.getDay()]];
  };

  /*
   * Find a date range in free text. Returns { from, to, label, spans:[[start,end]], kind }
   * `to` is exclusive. kind: 'range' | 'overdue' | 'upcoming' | 'recent'
   * Matched text spans are reported so the query parser can remove them.
   */
  D.findRange = function (q) {
    var t = D.today(), y = t.getFullYear(), m;
    var rules = [
      [/\boverdue\b|\bpast due\b|\bmissed\b|\blate\b/, function () { return { kind: 'overdue', label: 'Overdue' }; }],
      [/\b(?:upcoming|coming up|ahead|soon|next up|future)\b/, function () { return { kind: 'upcoming', label: 'Upcoming', from: t, to: D.addDays(t, 31) }; }],
      [/\b(?:recent(?:ly)?|latest|newest|lately)\b/, function () { return { kind: 'recent', label: 'Recent' }; }],
      [/\btoday\b|\btonight\b|\bthis (?:morning|afternoon|evening)\b/, function () { return r(t, D.addDays(t, 1), 'Today'); }],
      [/\btomorrow\b/, function () { return r(D.addDays(t, 1), D.addDays(t, 2), 'Tomorrow'); }],
      [/\byesterday\b/, function () { return r(D.addDays(t, -1), t, 'Yesterday'); }],
      [/\b(?:in the )?(?:next|coming|upcoming|following) (\d+|a|one|two|three|four|five|six|seven|ten|fourteen|thirty) (day|week|month)s?\b/, function (mm) {
        var n = num(mm[1]), u = mm[2]; return r(t, u === 'day' ? D.addDays(t, n + 1) : u === 'week' ? D.addDays(t, n * 7 + 1) : D.addMonths(t, n), 'Next ' + n + ' ' + u + (n > 1 ? 's' : ''));
      }],
      [/\b(?:in the )?(?:last|past|previous) (\d+|a|one|two|three|four|five|six|seven|ten|fourteen|thirty) (day|week|month)s?\b/, function (mm) {
        var n = num(mm[1]), u = mm[2]; return r(u === 'day' ? D.addDays(t, -n) : u === 'week' ? D.addDays(t, -n * 7) : D.addMonths(t, -n), D.addDays(t, 1), 'Past ' + n + ' ' + u + (n > 1 ? 's' : ''));
      }],
      [/\bthis week(?:end)?\b/, function () { var s = D.weekStart(t); return r(s, D.addDays(s, 7), 'This week'); }],
      [/\bnext week\b/, function () { var s = D.addDays(D.weekStart(t), 7); return r(s, D.addDays(s, 7), 'Next week'); }],
      [/\blast week\b|\bprevious week\b/, function () { var s = D.addDays(D.weekStart(t), -7); return r(s, D.addDays(s, 7), 'Last week'); }],
      [/\bthis month\b/, function () { return r(new Date(y, t.getMonth(), 1), new Date(y, t.getMonth() + 1, 1), 'This month'); }],
      [/\bnext month\b/, function () { return r(new Date(y, t.getMonth() + 1, 1), new Date(y, t.getMonth() + 2, 1), 'Next month'); }],
      [/\blast month\b|\bprevious month\b/, function () { return r(new Date(y, t.getMonth() - 1, 1), new Date(y, t.getMonth(), 1), 'Last month'); }],
      [/\bthis quarter\b/, function () { var q = D.quarter(t) - 1; return r(new Date(y, q * 3, 1), new Date(y, q * 3 + 3, 1), 'Q' + (q + 1) + ' ' + y); }],
      [/\blast quarter\b/, function () { var q = D.quarter(t) - 2; return r(new Date(y, q * 3, 1), new Date(y, q * 3 + 3, 1), 'Last quarter'); }],
      [/\bthis year\b|\bytd\b|\byear to date\b/, function () { return r(new Date(y, 0, 1), new Date(y + 1, 0, 1), String(y)); }],
      [/\blast year\b/, function () { return r(new Date(y - 1, 0, 1), new Date(y, 0, 1), String(y - 1)); }],
      [/\bq([1-4])(?:\s*(?:of\s*)?(\d{4}))?\b/, function (mm) { var yy = mm[2] ? +mm[2] : y, q = +mm[1] - 1; return r(new Date(yy, q * 3, 1), new Date(yy, q * 3 + 3, 1), 'Q' + mm[1] + ' ' + yy); }],
      [/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/, function (mm) { var d = new Date(+mm[1], +mm[2] - 1, +mm[3]); return r(d, D.addDays(d, 1), D.fmt(d)); }],
      [/\b(since|after|from) (jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?(?: (\d{4}))?\b/, function (mm) {
        var mi = mon(mm[2]), yy = mm[3] ? +mm[3] : (mi > t.getMonth() ? y - 1 : y);
        var from = mm[1] === 'after' ? new Date(yy, mi + 1, 1) : new Date(yy, mi, 1);
        return r(from, new Date(9999, 0, 1), 'Since ' + D.fmt(from));
      }],
      [/\b(before|until|till) (jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?(?: (\d{4}))?\b/, function (mm) {
        var mi = mon(mm[2]), yy = mm[3] ? +mm[3] : y;
        return r(new Date(1970, 0, 1), new Date(yy, mi, 1), 'Before ' + D.MONTHS[mi].replace(/^./, function (c) { return c.toUpperCase(); }));
      }],
      [/\b(?:on |by )?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.? (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?\b/, function (mm) {
        var mi = mon(mm[1]), yy = mm[3] ? +mm[3] : y, d = new Date(yy, mi, +mm[2]); return r(d, D.addDays(d, 1), D.fmt(d));
      }],
      [/\b(?:in |during |for )?(january|february|march|april|may|june|july|august|september|sept|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b(?: (\d{4}))?/, function (mm) {
        if (mm[1] === 'may' && !mm[2] && !/\bin may\b|\bduring may\b/.test(q)) return null; // "may" the verb
        var mi = mon(mm[1]), yy = mm[2] ? +mm[2] : y;
        return r(new Date(yy, mi, 1), new Date(yy, mi + 1, 1), D.MONTHS[mi].replace(/^./, function (c) { return c.toUpperCase(); }) + (mm[2] ? ' ' + yy : ''));
      }],
      [/\b(?:on |this |next )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/, function (mm) {
        var wd = D.WEEKDAYS.indexOf(mm[1]), add = (wd - t.getDay() + 7) % 7;
        if (/next /.test(mm[0]) && add < 7) add += add === 0 ? 7 : 0;
        var d = D.addDays(t, add); return r(d, D.addDays(d, 1), D.fmt(d, 'day'));
      }],
      [/\b(?:in |during )?(20\d{2})\b/, function (mm) { var yy = +mm[1]; return r(new Date(yy, 0, 1), new Date(yy + 1, 0, 1), String(yy)); }]
    ];
    for (var i = 0; i < rules.length; i++) {
      m = q.match(rules[i][0]);
      if (m) {
        var res = rules[i][1](m);
        if (!res) continue;
        res.spans = [[m.index, m.index + m[0].length]];
        res.kind = res.kind || 'range';
        return res;
      }
    }
    return null;

    function r(from, to, label) { return { from: from, to: to, label: label }; }
    function num(w) {
      var map = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10, fourteen: 14, thirty: 30 };
      return map[w] || parseInt(w, 10) || 1;
    }
  };

  /*
   * Parse a single target date from casual text, for "remind me … on Friday".
   * Returns { date, time, spans } or null.
   */
  D.findWhen = function (q) {
    var t = D.today(), m, date = null, span = null, time = null;
    if ((m = q.match(/\b(?:at )?(\d{1,2})(?::(\d{2}))? ?(am|pm)\b|\bat (\d{1,2}):(\d{2})\b/))) {
      var h = +(m[1] || m[4]), mi = +(m[2] || m[5] || 0);
      if (m[3] === 'pm' && h < 12) h += 12; if (m[3] === 'am' && h === 12) h = 0;
      time = pad(h) + ':' + pad(mi);
      q = q.slice(0, m.index) + ' '.repeat(m[0].length) + q.slice(m.index + m[0].length);
      span = [m.index, m.index + m[0].length];
    }
    if ((m = q.match(/\bin (\d+|a|an|one|two|three) (day|week|month)s?\b/))) {
      var n = { a: 1, an: 1, one: 1, two: 2, three: 3 }[m[1]] || +m[1];
      date = m[2] === 'day' ? D.addDays(t, n) : m[2] === 'week' ? D.addDays(t, n * 7) : D.addMonths(t, n);
    } else {
      var rg = D.findRange(q);
      if (rg && rg.from && rg.kind === 'range') { date = rg.from; m = { index: rg.spans[0][0], 0: q.slice(rg.spans[0][0], rg.spans[0][1]) }; }
      else m = null;
    }
    if (!date && !time) return null;
    var spans = [];
    if (m) spans.push([m.index, m.index + m[0].length]);
    if (span) spans.push(span);
    return { date: date || t, time: time, spans: spans };
  };
})();
