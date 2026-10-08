/*
 * Natural-language query engine.
 *
 *   Metis.query.parse("total cost by team in Q3 budget")  -> intent
 *   Metis.query.run("what's due this week")               -> { intent, items, answer, agg, chips }
 *   Metis.query.suggest("rev")                            -> autocomplete phrases
 *
 * It understands: kinds of entries, time ranges, statuses, projects, people,
 * "how many" questions, table math (total / average / highest / lowest / trend,
 * "by <column>", "top 5"), and free keywords with synonyms + typo tolerance.
 */
(function () {
  'use strict';
  var T = Metis.text, D = Metis.dates, A = Metis.analyze;
  var Q = (Metis.query = {});

  var TYPE_RX = [
    ['reminder', /\b(reminders?|remind(?:ers)?|deadlines?|due(?: dates?)?|to-?dos?|appointments?|events?)\b/],
    ['update', /\b(status updates?|updates?|progress|news|changelog|what happened|happenings?|activity|log entries)\b/],
    ['table', /\b(tables?|data ?sets?|spreadsheets?|sheets?|csvs?)\b/],
    ['metric', /\b(metrics?|kpis?|stats?|statistics|figures|data ?points?|measures?|numbers)\b/],
    ['note', /\b(notes?|ideas?|memos?|thoughts?)\b/],
    ['link', /\b(links?|bookmarks?|urls?|resources?)\b/],
    ['project', /\b(projects?|workstreams?|initiatives?)\b/]
  ];
  var STATUS_RX = [
    ['risk', /\b(off target|below target|missing target|under target|off track)\b/],
    ['done', /\b(on target|on track|hitting target|met target)\b/],
    ['done', /\b(done|completed?|finish(?:ed)?|shipped|closed|delivered|launched|resolved|wrapped up|accomplish(?:ed)?|achieved|wins?)\b/],
    ['blocked', /\b(blocked|stuck|on hold|waiting)\b/],
    ['risk', /\b(at risk|delayed|behind|slipping)\b/],
    ['active', /\b(in progress|ongoing|active|wip|open|current(?:ly)?|working on)\b/],
    ['planned', /\b(planned|pending|backlog|not started|scheduled)\b/]
  ];
  var OP_RX = [
    ['median', /\bmedian\b/],
    ['avg', /\b(average|avg|mean|typical)\b/],
    ['sum', /\b(total|sum|overall|altogether|combined)\b/],
    ['trend', /\b(trend(?:ing)?|over time|growth|trajectory|evolution|how did .* change|changed?)\b/],
    ['max', /\b(highest|max(?:imum)?|biggest|largest|most|top|peak|best|greatest|leading)\b/],
    ['min', /\b(lowest|min(?:imum)?|smallest|least|bottom|worst|fewest)\b/]
  ];
  var FILLER = new Set(('show find search list give display what whats which any item items entry entries stuff about related regarding re ' +
    'status info information detail details happening going everything all from in on for of me my i do does did is are was were the ' +
    'have has had there summary summarize summarise overview tell please quick update').split(' '));

  function mask(s, start, end) { return s.slice(0, start) + ' '.repeat(end - start) + s.slice(end); }
  function take(s, rx, cb) {
    var m = s.match(rx);
    if (!m) return s;
    cb(m);
    return mask(s, m.index, m.index + m[0].length);
  }

  Q.parse = function (raw) {
    var s = ' ' + T.norm(raw).replace(/[?!,;:"“”()]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
    var it = { raw: raw, types: [], status: [], projects: [], terms: [], op: null, n: null, by: null, count: false, sort: null, range: null, all: false, ticket: null };

    if (/^\s*(help|\?|what can you do|how does this work|tips?)\s*$/.test(s)) { it.help = true; return it; }

    s = take(s, /\bhow many\b|\bcount of\b|\bnumber of\b|\bhow much\b/, function (m) { it.count = m[0] !== 'how much'; if (m[0] === 'how much') it.op = 'sum'; });
    s = take(s, /\b(most recent|latest|newest|last few)\b/, function () { it.sort = 'recent'; });
    s = take(s, /\b(everything|all entries|all items|show all|browse)\b/, function () { it.all = true; });
    s = take(s, /\b(?:ticket|tkt)s?\s*#?\s*(?:t-?)?0*(\d{1,4})\b|\bt-0*(\d{1,4})\b|#0*(\d{1,4})\b/, function (m) { it.ticket = +(m[1] || m[2] || m[3]); });

    var rg = D.findRange(s);
    if (rg) {
      it.range = rg; s = mask(s, rg.spans[0][0], rg.spans[0][1]);
      if (rg.kind === 'recent') { it.sort = 'recent'; it.range = null; }
    }

    TYPE_RX.forEach(function (p) { s = take(s, p[1], function () { if (it.types.indexOf(p[0]) < 0) it.types.push(p[0]); }); });
    // a second mention, e.g. "updates and notes"
    TYPE_RX.forEach(function (p) { s = take(s, p[1], function () { if (it.types.indexOf(p[0]) < 0) it.types.push(p[0]); }); });
    STATUS_RX.forEach(function (p) { s = take(s, p[1], function () { if (it.status.indexOf(p[0]) < 0) it.status.push(p[0]); }); });

    s = take(s, /\b(?:top|bottom|best|worst|first) (\d+)\b|\b(\d+) (?:highest|lowest|largest|biggest|smallest|best|worst)\b/, function (m) {
      it.n = +(m[1] || m[2]); it.op = /bottom|worst|lowest|smallest/.test(m[0]) ? 'min' : 'max';
    });
    if (!it.op) OP_RX.forEach(function (p) { if (!it.op) s = take(s, p[1], function () { it.op = p[0]; }); });

    s = take(s, /\b(?:by|per|for each|each|grouped by|split by|broken down by) ([a-z0-9][a-z0-9 \-]{0,30}?)(?= in | from | for | of |\s*$)/, function (m) { it.by = m[1].trim(); });

    // Projects — full name or alias, longest first
    Metis.store.projects.slice().sort(function (a, b) { return b.name.length - a.name.length; }).forEach(function (p) {
      [p.name].concat(p.aliases).forEach(function (nm) {
        var n = T.norm(nm).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
        if (!n) return;
        var rx = new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
        s = take(s, rx, function () { if (it.projects.indexOf(p.key) < 0) it.projects.push(p.key); });
      });
    });

    it.terms = T.tokens(s).filter(function (t) { return !FILLER.has(t) && t.length > 1; });
    it.rest = s.trim().replace(/\s+/g, ' ');
    return it;
  };

  // ---------- term expansion (synonyms, prefixes, typos) ----------
  function expand(term) {
    var S = Metis.store, out = [[term, 1]];
    T.synonyms(term).forEach(function (s) { out.push([s, 0.8]); });
    if (term.length >= 3) S.vocab.forEach(function (v) {
      if (v === term || v.length <= term.length) return;
      if (v.indexOf(term) === 0) out.push([v, 0.72]);
    });
    if (term.length >= 4) S.vocab.forEach(function (v) {
      if (Math.abs(v.length - term.length) > 2 || v === term) return;
      var d = T.lev(term, v, term.length >= 7 ? 2 : 1);
      if (d <= (term.length >= 7 ? 2 : 1)) out.push([v, d === 1 ? 0.55 : 0.4]);
    });
    return out;
  }

  function scoreEntry(e, expansions) {
    var S = Metis.store, total = 0, hit = 0;
    expansions.forEach(function (ex) {
      var best = 0;
      ex.forEach(function (p) {
        var w = e._idx[p[0]];
        if (w) { var idf = Math.log(1 + S.N / (S.df.get(p[0]) || 1)); best = Math.max(best, w * p[1] * idf); }
      });
      if (best) { total += best; hit++; }
    });
    return { score: total, coverage: expansions.length ? hit / expansions.length : 1 };
  }

  function entryDate(e) {
    if (e.type === 'reminder') { var s = Metis.reminders.state(e); return s && s.occ ? s.occ : e.date; }
    return e.date;
  }

  function inRange(e, rg) {
    if (!rg) return true;
    if (rg.kind === 'overdue') {
      if (e.type === 'reminder') return Metis.reminders.state(e).state === 'overdue';
      return e.status === 'risk' || e.status === 'blocked';
    }
    var d = entryDate(e);
    if (!d) return false;
    if (rg.kind === 'upcoming') return d >= rg.from && d < rg.to;
    return d >= rg.from && d < rg.to;
  }

  function statusOk(e, list) {
    if (!list.length) return true;
    if (e.type === 'reminder') {
      var st = Metis.reminders.state(e);
      return list.some(function (k) { return k === 'done' ? st.done : k === 'planned' || k === 'active' ? !st.done : false; });
    }
    if (e.type === 'metric' && e.metric.target != null) {
      return list.some(function (k) { return k === 'done' ? e.metric.onTarget : k === 'risk' ? !e.metric.onTarget : false; });
    }
    return list.indexOf(e.status) >= 0;
  }

  // ---------- table math ----------
  function colTokens(name) { return T.tokens(name); }
  function resolveTable(it) {
    var S = Metis.store;
    var tables = S.entries.filter(function (e) { return e.type === 'table' && (!it.projects.length || it.projects.indexOf(e.projectKey) >= 0); });
    if (!tables.length) return null;
    // Match columns against the raw words too: "completed", "done", "top" can be column names
    var rawTerms = T.tokens(it.raw).filter(function (t) { return !FILLER.has(t); });
    var exact = new Set(rawTerms);
    var termSet = new Set(rawTerms.concat(rawTerms.reduce(function (a, t) { return a.concat(T.synonyms(t)); }, [])));
    var w = function (t, full) { return exact.has(t) ? full : termSet.has(t) ? full * 0.6 : 0; };
    var byToks = it.by ? T.tokens(it.by) : [];
    var best = null;
    tables.forEach(function (e) {
      var an = e.table.analysis, sc = 0, col = -1, colScore = 0, by = -1, byScore = 0;
      new Set(T.tokens(e.title + ' ' + e.keywords.join(' '))).forEach(function (t) { sc += w(t, 2); });
      an.columns.forEach(function (c, i) {
        var ct = colTokens(c.name), cs = 0;
        ct.forEach(function (t) { if (termSet.has(t)) cs += w(t, 3); else if (Array.from(termSet).some(function (q) { return q.length > 3 && t.indexOf(q) === 0; })) cs += 2; });
        if (c.type === 'number' && cs > colScore) { colScore = cs; col = i; }
        if (byToks.length) {
          var bs = 0; ct.forEach(function (t) { if (byToks.indexOf(t) >= 0 || byToks.some(function (b) { return t.indexOf(b) === 0 || b.indexOf(t) === 0; })) bs++; });
          if (bs > byScore) { byScore = bs; by = i; }
        }
      });
      // "top 3 teams by spend": the "by" names the value, the free word names the grouping
      if (by >= 0 && an.columns[by].type === 'number') {
        var grp = -1;
        an.columns.forEach(function (c, i) { if (c.type === 'text' && colTokens(c.name).some(function (t) { return termSet.has(t); })) grp = i; });
        if (grp >= 0) { col = by; colScore = Math.max(colScore, 3); by = grp; }
        else if (col < 0 || col === by) { col = by; colScore = Math.max(colScore, 3); by = -1; }
      }
      var total = sc + colScore + byScore * 3 - (byToks.length && by < 0 ? 3 : 0);
      if (!best || total > best.total) best = { entry: e, total: total, col: col, by: by, colScore: colScore, titleScore: sc };
    });
    if (!best) return null;
    if (best.total === 0 && tables.length > 1) return null;
    if (best.col < 0) best.col = best.entry.table.analysis.primaryIdx;
    return best;
  }

  // ---------- run ----------
  Q.run = function (raw) {
    var S = Metis.store;
    var it = Q.parse(raw);
    var out = { intent: it, items: [], projects: [], agg: null, chips: chips(it) };
    if (it.help) { out.answer = { kind: 'help', html: helpHTML() }; return out; }

    // Table math first, when the question asks for it
    var tableIntent = it.op || it.by || (it.count && it.types.indexOf('table') >= 0);
    if (tableIntent && (!it.types.length || it.types.indexOf('table') >= 0 || it.types.indexOf('metric') >= 0)) {
      var tb = resolveTable(it);
      var onlyTableAsked = !it.terms.length && it.types.indexOf('table') >= 0 && S.entries.filter(function (e) { return e.type === 'table'; }).length === 1;
      if (tb && (tb.colScore > 0 || tb.titleScore > 0 || (it.by && tb.by >= 0) || onlyTableAsked)) {
        var op = it.op || (it.by && tb.col >= 0 && tb.colScore > 0 ? 'sum' : 'count');
        out.agg = A.aggregate(tb.entry, op, op === 'count' && !it.by ? -1 : tb.col, tb.by, it.n);
        out.agg.colIdx = tb.col; out.agg.byIdx = tb.by;
      }
    }
    // Metric extremes: "highest metric", "which kpis are off target"
    if (!out.agg && it.op && (it.types.indexOf('metric') >= 0)) {
      out.metricOp = it.op;
    }

    if (it.range && it.range.kind === 'overdue' && !it.types.length) it.types.push('reminder');
    var types = it.types.filter(function (t) { return t !== 'project'; });
    var wantsProjects = it.types.indexOf('project') >= 0;
    var expansions = out.agg ? [] : it.terms.map(expand);
    var minCov = expansions.length >= 3 ? 0.6 : expansions.length === 2 ? 0.5 : 1;

    var scored = [];
    if (out.agg) {
      scored.push({ entry: out.agg.entry, score: 1, coverage: 1, date: out.agg.entry.date });
    } else S.entries.forEach(function (e) {
      if (types.length && types.indexOf(e.type) < 0) return;
      if (it.projects.length && it.projects.indexOf(e.projectKey) < 0) return;
      if (it.ticket != null && e.ticketNum !== it.ticket) return;
      if (!statusOk(e, it.status)) return;
      if (!inRange(e, it.range)) return;
      var sc = scoreEntry(e, expansions);
      if (expansions.length && (sc.score === 0 || sc.coverage < minCov)) return;
      var d = entryDate(e), age = d ? Math.abs(D.diffDays(d, D.today())) : 365;
      var final = sc.score * (0.5 + sc.coverage) + (expansions.length ? Math.max(0, 1 - age / 120) * 0.6 : 0) + (e.pinned ? 0.5 : 0);
      scored.push({ entry: e, score: final, coverage: sc.coverage, date: d });
    });

    var upcomingSort = it.range && (it.range.kind === 'upcoming' || (it.range.from && it.range.from >= D.today())) || (types.length === 1 && types[0] === 'reminder');
    scored.sort(function (a, b) {
      if (expansions.length && !it.sort) return b.score - a.score;
      if (upcomingSort && !it.sort) return (a.date || Infinity) - (b.date || Infinity);
      return (b.date || 0) - (a.date || 0);
    });
    if (out.metricOp) {
      scored.sort(function (a, b) {
        var x = a.entry.metric && a.entry.metric.delta || 0, y = b.entry.metric && b.entry.metric.delta || 0;
        return out.metricOp === 'min' ? x - y : y - x;
      });
    }
    out.items = scored;

    // Projects as results
    var projTerms = expansions;
    S.projects.forEach(function (p) {
      var match = it.projects.indexOf(p.key) >= 0;
      if (!match && projTerms.length) match = projTerms.every(function (ex) { return ex.some(function (x) { return p.tokens.indexOf(x[0]) >= 0; }); });
      if (!match && wantsProjects && !projTerms.length) match = !it.status.length || it.status.indexOf(p.status) >= 0;
      if (match) out.projects.push(p);
    });
    if (wantsProjects && !types.length) out.items = it.projects.length || projTerms.length ? out.items : [];

    out.answer = compose(it, out);
    if (!out.items.length && !out.projects.length && !out.agg) out.didYouMean = didYouMean(it);
    return out;
  };

  // ---------- natural-language answer ----------
  function compose(it, out) {
    var R = Metis.reminders, n = out.items.length;
    var where = [];
    if (it.projects.length) where.push('in ' + it.projects.map(function (k) { return '<b>' + T.esc(Metis.store.projectByKey.get(k).name) + '</b>'; }).join(' & '));
    if (it.range) where.push(it.range.kind === 'overdue' ? '' : it.range.kind === 'upcoming' ? 'coming up' : rangePhrase(it.range));
    var whereTxt = where.filter(Boolean).join(' ');

    if (out.agg) {
      return { kind: 'agg', html: out.agg.text + '<span class="ans-src"> — from <a href="#" data-open="' + T.esc(out.agg.entry.id) + '">' + T.esc(out.agg.entry.title) + '</a></span>' };
    }
    var typeWord = it.types.length === 1 && it.types[0] !== 'project' ? Metis.store.TYPES[it.types[0]] : null;
    var noun = function (k) { return typeWord ? (k === 1 ? typeWord.label.toLowerCase() : typeWord.plural.toLowerCase()) : (k === 1 ? 'result' : 'results'); };
    var isMetric = it.types.length === 1 && it.types[0] === 'metric';
    var statusTxt = it.status.length ? (isMetric ? ' <b>' : ' marked <b>') + it.status.map(function (s) {
      return isMetric ? (s === 'done' ? 'on target' : 'off target') : Metis.store.STATUS[s].label.toLowerCase();
    }).join(' or ') + '</b>' : '';

    if (it.types.length === 1 && it.types[0] === 'project' && !n) {
      var ps = out.projects;
      if (!ps.length) return { kind: 'empty', html: 'No projects match that.' };
      var act = ps.filter(function (p) { return p.status !== 'done'; }).length;
      return { kind: 'list', html: '<b>' + T.plural(ps.length, 'project') + '</b>' + statusTxt + (act && act !== ps.length ? ' — ' + act + ' still open' : '') + '. Most recent activity: <b>' + T.esc(ps[0].name) + '</b>' + (ps[0].lastDate ? ' (' + D.relative(ps[0].lastDate) + ')' : '') + '.' };
    }
    if (!n && !out.projects.length) {
      return { kind: 'empty', html: 'Nothing matched' + (whereTxt ? ' ' + whereTxt : '') + '. Try fewer words, or ask “help”.' };
    }
    if (!n && out.projects.length) {
      var p = out.projects[0];
      return { kind: 'project', html: projectSentence(p) };
    }
    if (it.count) {
      return { kind: 'count', html: 'You have <b>' + n + '</b> ' + noun(n) + statusTxt + (whereTxt ? ' ' + whereTxt : '') + '.' + breakdown(out.items) };
    }
    var top = out.items[0].entry;
    if (it.range && it.range.kind === 'overdue') {
      return { kind: 'list', html: '<b>' + n + '</b> ' + noun(n) + ' overdue. Oldest: <b>' + T.esc(oldest(out.items).title) + '</b>, due ' + D.relative(oldest(out.items).date) + '.' };
    }
    if (typeWord && it.types[0] === 'reminder') {
      var states = out.items.map(function (x) { return R.state(x.entry); }).filter(function (s) { return !s.done; });
      var first = states.filter(function (s) { return s.days != null && s.days >= 0; })[0] || states[0];
      return { kind: 'list', html: '<b>' + n + '</b> ' + noun(n) + (whereTxt ? ' ' + whereTxt : '') + '.' + (first ? ' Next: <b>' + T.esc(first.entry.title) + '</b> — ' + T.esc(first.state === 'later' ? first.label : first.label.toLowerCase()) + '.' : '') };
    }
    if (it.projects.length === 1 && !it.terms.length && !typeWord) {
      return { kind: 'project', html: projectSentence(Metis.store.projectByKey.get(it.projects[0])) + (it.range || it.status.length ? ' <b>' + n + '</b> ' + noun(n) + statusTxt + (it.range ? ' ' + rangePhrase(it.range) : '') + '.' : '') };
    }
    var lead = '<b>' + n + '</b> ' + noun(n) + statusTxt + (whereTxt ? ' ' + whereTxt : '') + (it.terms.length ? ' for “' + T.esc(it.rest || it.raw) + '”' : '') + '.';
    var detail = top.type === 'update' ? ' Latest: <b>' + T.esc(latest(out.items).title) + '</b> (' + D.relative(latest(out.items).date) + ').'
      : top.type === 'table' ? ' Top match: <b>' + T.esc(top.title) + '</b> — ' + top.table.analysis.headline
      : top.type === 'metric' ? ' Top match: <b>' + T.esc(top.title) + '</b> at <b>' + T.fmt(top.metric.value, top.metric.unit) + '</b>.'
      : ' Top match: <b>' + T.esc(top.title) + '</b>.';
    return { kind: 'list', html: lead + detail + (n > 3 && !typeWord ? breakdown(out.items) : '') };
  }

  function latest(items) { return items.filter(function (x) { return x.entry.date; }).sort(function (a, b) { return b.entry.date - a.entry.date; }).map(function (x) { return x.entry; })[0] || items[0].entry; }
  function oldest(items) { return items.filter(function (x) { return x.date; }).sort(function (a, b) { return a.date - b.date; }).map(function (x) { return x.entry; })[0] || items[0].entry; }
  function breakdown(items) {
    var c = {}; items.forEach(function (x) { c[x.entry.type] = (c[x.entry.type] || 0) + 1; });
    var k = Object.keys(c); if (k.length < 2) return '';
    return ' <span class="ans-mute">(' + k.map(function (t) { var ty = Metis.store.TYPES[t]; return c[t] + ' ' + (ty ? (c[t] === 1 ? ty.label : ty.plural).toLowerCase() : t); }).join(', ') + ')</span>';
  }
  function rangePhrase(r) {
    var l = r.label || '';
    if (/^(today|tomorrow|yesterday)$/i.test(l)) return l.toLowerCase();
    if (/^(this|next|last|past) /i.test(l)) return l.toLowerCase();
    if (/^(since|before) /i.test(l)) return l.charAt(0).toLowerCase() + l.slice(1);
    return (/^\w{3}, /.test(l) || /\d{1,2}(, \d{4})?$/.test(l) && !/^q/i.test(l) && !/^\d{4}$/.test(l) ? 'on ' : 'in ') + l;
  }
  function projectSentence(p) {
    if (!p) return '';
    var st = p.status ? Metis.store.STATUS[p.status].label.toLowerCase() : 'active';
    return '<b>' + T.esc(p.name) + '</b> is ' + st + (p.progress != null ? ' at <b>' + Math.round(p.progress) + '%</b>' : '') +
      (p.last ? '. Last update ' + D.relative(p.lastDate) + ': “' + T.esc(p.last.title) + '”' : '') + '.';
  }

  function didYouMean(it) {
    var S = Metis.store;
    if (!it.terms.length) return null;
    var changed = false;
    var fixed = it.terms.map(function (t) {
      if (S.df.has(t)) return t;
      var best = null, bd = 3;
      S.vocab.forEach(function (v) { var d = T.lev(t, v, 2); if (d < bd) { bd = d; best = v; } });
      if (best && bd <= 2) { changed = true; return best; }
      return t;
    });
    return changed ? fixed.join(' ') : null;
  }

  function chips(it) {
    var c = [];
    it.types.forEach(function (t) { c.push({ kind: 'type', label: t === 'project' ? 'Projects' : Metis.store.TYPES[t].plural }); });
    if (it.range) c.push({ kind: 'time', label: it.range.label });
    it.status.forEach(function (s) { c.push({ kind: 'status', label: Metis.store.STATUS[s].label }); });
    it.projects.forEach(function (k) { var p = Metis.store.projectByKey.get(k); if (p) c.push({ kind: 'project', label: p.name }); });
    if (it.op) c.push({ kind: 'op', label: { sum: 'Total', avg: 'Average', max: it.n ? 'Top ' + it.n : 'Highest', min: it.n ? 'Bottom ' + it.n : 'Lowest', trend: 'Trend', median: 'Median' }[it.op] });
    if (it.count) c.push({ kind: 'op', label: 'Count' });
    if (it.by) c.push({ kind: 'op', label: 'By ' + it.by });
    if (it.ticket != null) c.push({ kind: 'type', label: 'Ticket T-' + ('00' + it.ticket).slice(-3) });
    if (it.sort === 'recent') c.push({ kind: 'time', label: 'Most recent' });
    it.terms.forEach(function (t) { c.push({ kind: 'term', label: t }); });
    return c;
  }

  function helpHTML() {
    return 'I search everything on this dashboard and do quick math on your tables. Try:' +
      '<ul class="help-list">' +
      '<li><b>Time</b> — “updates last week”, “what’s due tomorrow”, “done in September”, “Q3”, “overdue”</li>' +
      '<li><b>Projects & status</b> — “Apollo progress”, “blocked projects”, “what did I finish this month”</li>' +
      '<li><b>Table math</b> — “total revenue”, “average hours by team”, “top 3 regions by sales”, “cost trend”</li>' +
      '<li><b>Counts</b> — “how many reminders this month”</li>' +
      '<li><b>In the assistant</b> — “remind me to send invoice on Friday at 9am”, “note: call Dana re: contract”</li>' +
      '</ul>';
  }

  // ---------- autocomplete ----------
  Q.phrases = function () {
    var S = Metis.store, out = [], seen = new Set();
    function add(text, kind, weight) { var k = T.norm(text); if (!k || seen.has(k)) return; seen.add(k); out.push({ text: text, kind: kind, w: weight || 1 }); }
    ['what’s due this week', 'what’s overdue', 'updates this week', 'what did I finish last week', 'reminders next 7 days', 'metrics off target', 'recent notes', 'blocked projects']
      .forEach(function (t) { add(t, 'suggestion', 1.2); });
    S.projects.forEach(function (p) { add(p.name, 'project', 2); add(p.name + ' updates', 'suggestion', 1); });
    S.entries.forEach(function (e) {
      if (e.type === 'table') {
        add(e.title, 'table', 1.6);
        var an = e.table.analysis;
        if (an.primaryIdx >= 0) {
          var col = an.columns[an.primaryIdx].name.toLowerCase();
          add((an.columns[an.primaryIdx].additive ? 'total ' : 'average ') + col, 'math', 1.3);
          if (an.catIdx.length) add(col + ' by ' + an.columns[an.catIdx[0]].name.toLowerCase(), 'math', 1.3);
          add('highest ' + col, 'math', 1.1);
          if (an.ordered) add(col + ' trend', 'math', 1.1);
        }
      } else if (e.type === 'metric' || e.type === 'reminder') add(e.title, e.type, 1.2);
      e.keywords.forEach(function (k) { add(k, 'keyword', 1.4); });
      e.autoKeywords.slice(0, 4).forEach(function (k) { add(k, 'keyword', 0.8); });
    });
    return out;
  };

  Q.suggest = function (input, limit) {
    var q = T.norm(input).trim();
    if (!q) return [];
    var list = Q._phrases || (Q._phrases = Q.phrases());
    var last = q.split(/\s+/).pop();
    return list.map(function (p) {
      var n = T.norm(p.text), s = 0;
      if (n.indexOf(q) === 0) s = 3;
      else if (n.indexOf(' ' + q) >= 0) s = 2.2;
      else if (n.indexOf(q) >= 0) s = 1.6;
      else if (last.length >= 2 && n.split(/\s+/).some(function (w) { return w.indexOf(last) === 0; }) && q.split(/\s+/).length > 1) s = 0.9;
      return { p: p, s: s * p.w };
    }).filter(function (x) { return x.s > 0 && T.norm(x.p.text) !== q; })
      .sort(function (a, b) { return b.s - a.s || a.p.text.length - b.p.text.length; })
      .slice(0, limit || 6).map(function (x) { return x.p; });
  };
  Metis.on('build', function () { Q._phrases = null; });
})();
