/*
 * HTML templates: icons, cards, project tiles, detail sheets.
 */
(function () {
  'use strict';
  var T = Metis.text, D = Metis.dates, C = Metis.charts;
  var V = (Metis.view = {});
  var esc = T.esc;

  var ICONS = {
    pulse: '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
    grid: '<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M3.5 15h17M9.5 9.5V20"/>',
    gauge: '<path d="M4.5 17a8.5 8.5 0 1 1 15 0"/><path d="m12 13 4-4.5"/><circle cx="12" cy="13.5" r="1.2"/>',
    bell: '<path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    note: '<path d="M6 3.5h9l4 4V20a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 6 20z"/><path d="M15 3.5V8h4M9 12.5h6M9 16h4"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    alert: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17v.2"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    trend: '<path d="m3.5 16.5 6-6 4 4 7-7.5"/><path d="M15 7h5.5v5.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0z"/><circle cx="8" cy="8" r="1.4"/>',
    bolt: '<path d="M13 2.5 4.5 13.5H12L11 21.5l8.5-11H12z"/>',
    folder: '<path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4.5l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    sparkle: '<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/>',
    box: '<rect x="4" y="4" width="16" height="16" rx="3"/>'
  };
  V.icon = function (name, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || ICONS.box) + '</svg>';
  };
  V.typeIcon = function (type) { var t = Metis.store.TYPES[type]; return V.icon(t ? t.icon : 'box'); };

  var TONE_ICON = { good: 'check', info: 'pulse', critical: 'alert', serious: 'alert', warning: 'clock', neutral: 'box' };
  V.status = function (key) {
    var s = Metis.store.STATUS[key];
    if (!s) return '';
    return '<span class="pill tone-' + s.tone + '"><i class="pill-dot"></i>' + esc(s.label) + '</span>';
  };
  V.tonePill = function (tone, label) { return '<span class="pill tone-' + tone + '"><i class="pill-dot"></i>' + esc(label) + '</span>'; };

  // Subtle ticket tag for reminders / to-dos, e.g. T-001
  V.ticket = function (e) { return e && e.ticket ? '<span class="tkt" title="Ticket number">' + esc(e.ticket) + '</span>' : ''; };

  V.kw = function (e, max) {
    var user = e.keywords.slice(0, max || 4).map(function (k) { return '<button class="kw" data-q="' + esc(k) + '">' + esc(k) + '</button>'; });
    return user.length ? '<div class="kws">' + user.join('') + '</div>' : '';
  };

  function delta(m) {
    if (m.delta == null) return '';
    var up = m.delta > 0, good = up === m.higherIsBetter;
    return '<span class="delta ' + (m.delta === 0 ? 'flat' : good ? 'good' : 'bad') + '">' +
      '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="' + (up ? 'M6 2.5 10 8H2z' : 'M6 9.5 10 4H2z') + '"/></svg>' +
      T.pct(Math.abs(m.delta)) + '</span>';
  }
  V.delta = delta;

  function meta(e) {
    var bits = [];
    if (e.project) bits.push('<button class="meta-proj" data-q="' + esc(e.project) + '">' + esc(e.project) + '</button>');
    if (e.date && e.type !== 'reminder') bits.push('<time datetime="' + D.iso(e.date) + '">' + esc(D.relative(e.date)) + '</time>');
    if (e.source === 'local') bits.push('<span class="src">Saved here</span>');
    if (e.source === 'session') bits.push('<span class="src">Dropped file</span>');
    return bits.join('<span class="dot-sep">·</span>');
  }

  // ---------- result cards ----------
  V.card = function (e, i) {
    var body = '', cls = 'card card-' + e.type;
    switch (e.type) {
      case 'update':
        body = '<p class="card-text">' + esc(e.text || e.title) + '</p>' +
          '<div class="card-foot">' + (e.status ? V.status(e.status) : '') + (e.progress != null ? '<span class="mini-prog"><i style="--w:' + e.progress + '%"></i></span><small>' + Math.round(e.progress) + '%</small>' : '') + '</div>';
        break;
      case 'table':
        var an = e.table.analysis, P = an.primaryIdx >= 0 ? an.columns[an.primaryIdx] : null;
        body = '<h3 class="card-title">' + esc(e.title) + '</h3>' +
          '<p class="card-sub">' + an.rows + ' rows · ' + an.cols + ' columns</p>' +
          (P && P.series && an.ordered ? '<div class="card-spark s1">' + C.sparkline(P.series, { w: 240, h: 48 }) + '</div>' : '') +
          '<p class="card-insight">' + an.headline + '</p>';
        break;
      case 'metric':
        var m = e.metric;
        body = '<h3 class="card-title sm">' + esc(e.title) + '</h3>' +
          '<div class="metric-row"><span class="metric-v" data-count="' + (m.value != null ? m.value : '') + '" data-unit="' + esc(m.unit || '') + '">' + T.fmt(m.value, m.unit) + '</span>' + delta(m) + '</div>' +
          (m.history.length > 1 ? '<div class="card-spark s1">' + C.sparkline(m.history, { w: 240, h: 44 }) + '</div>' : '') +
          (m.target != null ? '<div class="target-line">' + C.meter(m.value, m.target, m.higherIsBetter) + '<small>Target ' + T.fmt(m.target, m.unit) + '</small></div>' : '');
        break;
      case 'reminder':
        var s = Metis.reminders.state(e), d = s.occ;
        cls += ' st-' + s.state;
        body = '<div class="rem-row">' +
          (d ? '<div class="cal"><span>' + D.MON3[d.getMonth()].toUpperCase() + '</span><b>' + d.getDate() + '</b></div>' : '<div class="cal cond">' + V.icon('bolt') + '</div>') +
          '<div><h3 class="card-title sm">' + esc(e.title) + '</h3><p class="rem-state">' + esc(s.label) + '</p></div></div>' +
          (e.text ? '<p class="card-text sm">' + esc(e.text) + '</p>' : '');
        break;
      case 'link':
        body = '<h3 class="card-title sm">' + esc(e.title) + '</h3>' + (e.text ? '<p class="card-text sm">' + esc(e.text) + '</p>' : '') +
          (e.url ? '<a class="card-url" href="' + esc(e.url) + '" target="_blank" rel="noopener">' + esc(e.url.replace(/^https?:\/\//, '').slice(0, 42)) + ' ' + V.icon('arrow') + '</a>' : '');
        break;
      default:
        body = '<h3 class="card-title sm">' + esc(e.title) + '</h3>' + (e.text && e.text !== e.title ? '<p class="card-text">' + esc(e.text) + '</p>' : '');
    }
    var typeLabel = Metis.store.TYPES[e.type] ? Metis.store.TYPES[e.type].label : T.cap(e.type);
    return '<article class="' + cls + '" tabindex="0" data-open="' + esc(e.id) + '" style="--i:' + (i || 0) + '">' +
      '<header class="card-head"><span class="type type-' + esc(e.type) + '">' + V.typeIcon(e.type) + typeLabel + '</span><span class="card-meta">' + (e.ticket ? V.ticket(e) + ' ' : '') + meta(e) + '</span></header>' +
      body + V.kw(e, 3) + '</article>';
  };

  V.projectCard = function (p, i) {
    var prog = p.progress != null ? Math.round(p.progress) : null;
    return '<article class="card card-project" tabindex="0" data-project="' + esc(p.key) + '" style="--i:' + (i || 0) + '">' +
      '<header class="card-head"><span class="type type-project">' + V.icon('folder') + 'Project</span>' + (p.status ? V.status(p.status) : '') + '</header>' +
      '<div class="proj-row">' + (prog != null ? '<div class="proj-ring">' + C.ring(prog / 100, { size: 58, stroke: 6 }) + '<b>' + prog + '<small>%</small></b></div>' : '') +
      '<div><h3 class="card-title">' + esc(p.name) + '</h3>' + (p.description ? '<p class="card-sub">' + esc(p.description) + '</p>' : '') + '</div></div>' +
      (p.last ? '<p class="card-text sm"><span class="muted">Latest · ' + esc(D.relative(p.lastDate)) + '</span><br>' + esc(p.last.title) + '</p>' : '') +
      '<div class="proj-counts">' + Object.keys(p.counts).map(function (t) { var ty = Metis.store.TYPES[t]; return '<span>' + p.counts[t] + ' ' + (ty ? (p.counts[t] === 1 ? ty.label : ty.plural).toLowerCase() : t) + '</span>'; }).join('') + '</div>' +
      '</article>';
  };

  // ---------- aggregate visual (search answers) ----------
  V.aggVisual = function (agg) {
    if (!agg) return '';
    if (agg.groups && agg.groups.length > 1) return C.bars(agg.groups.map(function (g) { return { key: g.key, value: g.value }; }), { unit: agg.op === 'count' ? '' : agg.unit, share: agg.op === 'sum' || (agg.byIdx >= 0 && agg.op !== 'avg'), highlightTop: true });
    if (agg.series && agg.series.length > 1) {
      var an = agg.entry.table.analysis;
      return '<div class="s1">' + C.series(agg.series.map(function (p) { return { label: p.label, v: p.v }; }), { unit: agg.unit, ordered: an.ordered, kind: agg.op === 'trend' ? 'line' : null, title: agg.column }) + '</div>';
    }
    return '';
  };

  // ---------- detail sheets ----------
  V.sheet = function (e) {
    var typeLabel = Metis.store.TYPES[e.type] ? Metis.store.TYPES[e.type].label : T.cap(e.type);
    var h = '<header class="sheet-head"><span class="type type-' + esc(e.type) + '">' + V.typeIcon(e.type) + typeLabel + '</span>' + (e.ticket ? ' ' + V.ticket(e) : '') +
      '<h2 id="sheetTitle">' + esc(e.title) + '</h2><p class="sheet-meta">' + meta(e) + (e.date && e.type !== 'reminder' ? '<span class="dot-sep">·</span>' + esc(D.fmt(e.date, 'long')) : '') + '</p></header>';
    if (e.type === 'table') h += tableSheet(e);
    else if (e.type === 'metric') h += metricSheet(e);
    else if (e.type === 'reminder') h += reminderSheet(e);
    else {
      if (e.text && e.text !== e.title) h += '<p class="sheet-text">' + esc(e.text) + '</p>';
      if (e.status) h += '<p>' + V.status(e.status) + (e.progress != null ? ' <span class="muted">· ' + Math.round(e.progress) + '% complete</span>' : '') + '</p>';
      if (e.url) h += '<p><a class="btn" href="' + esc(e.url) + '" target="_blank" rel="noopener">Open link ' + V.icon('arrow') + '</a></p>';
      h += genericFields(e);
    }
    if (e.people.length) h += '<p class="sheet-people">With ' + e.people.map(function (p) { return '<button class="kw" data-q="' + esc(p) + '">' + esc(p) + '</button>'; }).join(' ') + '</p>';
    h += keywordBlock(e);
    if (e.projectKey) h += relatedBlock(e);
    if (e.source === 'local') h += '<p class="sheet-actions"><button class="btn ghost danger" data-remove="' + esc(e.id) + '">Delete from this browser</button></p>';
    if (e.source === 'session') h += '<p class="sheet-actions"><button class="btn" data-keep="' + esc(e.id) + '">Keep this table in this browser</button></p>';
    return h;
  };

  function keywordBlock(e) {
    var user = e.keywords.map(function (k) { return '<button class="kw" data-q="' + esc(k) + '">' + esc(k) + '</button>'; }).join('');
    var auto = e.autoKeywords.map(function (k) { return '<button class="kw auto" data-q="' + esc(k) + '">' + esc(k) + '</button>'; }).join('');
    if (!user && !auto) return '';
    return '<section class="sheet-sec"><h4>Keywords</h4><div class="kws wrap">' + user + auto + '</div>' +
      (auto ? '<p class="fine">' + V.icon('sparkle') + ' Lighter chips were derived automatically from the content.</p>' : '') + '</section>';
  }

  function relatedBlock(e) {
    var p = Metis.store.projectByKey.get(e.projectKey);
    if (!p) return '';
    var rel = p.entries.filter(function (x) { return x !== e; }).sort(function (a, b) { return (b.date || 0) - (a.date || 0); }).slice(0, 6);
    if (!rel.length) return '';
    return '<section class="sheet-sec"><h4>More in ' + esc(p.name) + '</h4><ol class="timeline">' + rel.map(function (x) {
      return '<li data-open="' + esc(x.id) + '" tabindex="0"><span class="tl-dot tone-' + (x.status ? Metis.store.STATUS[x.status].tone : 'neutral') + '"></span>' +
        '<span class="tl-date">' + esc(x.date ? D.fmt(x.date) : '') + '</span><span class="tl-t">' + esc(x.title) + '</span></li>';
    }).join('') + '</ol></section>';
  }

  function genericFields(e) {
    var skip = { type: 1, title: 1, name: 1, text: 1, body: 1, summary: 1, description: 1, date: 1, project: 1, keywords: 1, tags: 1, id: 1, status: 1, progress: 1, url: 1, people: 1, owner: 1, created: 1, pinned: 1 };
    var rows = Object.keys(e.raw).filter(function (k) { return !skip[k] && e.raw[k] != null && typeof e.raw[k] !== 'object'; });
    if (!rows.length) return '';
    return '<dl class="fields">' + rows.map(function (k) { return '<dt>' + esc(T.cap(k)) + '</dt><dd>' + esc(e.raw[k]) + '</dd>'; }).join('') + '</dl>';
  }

  function tableSheet(e) {
    var tb = e.table, an = tb.analysis, h = '';
    if (e.text) h += '<p class="sheet-text">' + esc(e.text) + '</p>';
    h += '<section class="sheet-sec"><h4>Quick analysis</h4><ul class="insights">' + an.insights.map(function (x) {
      return '<li class="ins-' + x.kind + '">' + V.icon({ total: 'sparkle', avg: 'sparkle', peak: 'trend', trend: 'trend', share: 'grid', mix: 'grid', outlier: 'alert', gaps: 'box' }[x.kind] || 'sparkle') + '<span>' + x.text + '</span></li>';
    }).join('') + '</ul></section>';

    if (an.numIdx.length) {
      h += '<section class="sheet-sec"><div class="stat-tiles">' + an.numIdx.slice(0, 4).map(function (ci) {
        var c = an.columns[ci], u = c.unit || (c.money ? '$' : '');
        return '<div class="stat"><small>' + esc(c.name) + '</small><b>' + T.fmt(c.additive ? c.sum : c.mean, u) + '</b>' +
          '<span class="muted">' + (c.additive ? 'total' : 'average') + ' · ' + T.fmt(c.min, u) + '–' + T.fmt(c.max, u) + '</span>' +
          (c.change != null && isFinite(c.change) ? '<span class="delta ' + (c.change >= 0 ? 'good' : 'bad') + ' neutral-dir">' + (c.change >= 0 ? '▲ ' : '▼ ') + T.pct(Math.abs(c.change)) + '</span>' : '') + '</div>';
      }).join('') + '</div></section>';

      var cur = an.primaryIdx;
      h += '<section class="sheet-sec"><div class="sec-head"><h4>Chart</h4><div class="seg" role="tablist">' + an.numIdx.map(function (ci) {
        return '<button role="tab" class="' + (ci === cur ? 'on' : '') + '" data-chart-col="' + ci + '">' + esc(an.columns[ci].name) + '</button>';
      }).join('') + '</div></div><div class="chart-box s1" id="sheetChart">' + V.tableChart(e, cur) + '</div></section>';

      if (an.catIdx.length && an.columns[cur].additive) {
        var ci0 = an.catIdx[0];
        h += '<section class="sheet-sec"><h4>' + esc(an.columns[cur].name) + ' by ' + esc(an.columns[ci0].name.toLowerCase()) + '</h4>' +
          C.bars(Metis.analyze.groupBy(tb, ci0, cur, 'sum').map(function (g) { return { key: g.key, value: g.value }; }), { unit: an.columns[cur].unit || (an.columns[cur].money ? '$' : ''), share: true, highlightTop: true }) + '</section>';
      }
    }
    h += '<section class="sheet-sec"><div class="sec-head"><h4>Data</h4><span class="muted">' + an.rows + ' rows · click a header to sort</span></div>' + V.dataTable(tb) + '</section>';
    return h;
  }

  V.tableChart = function (e, ci) {
    var tb = e.table, an = tb.analysis, c = an.columns[ci];
    var series = tb.rows.map(function (r, i) { return { label: an.labelIdx >= 0 ? r[an.labelIdx] : '#' + (i + 1), v: T.parseNum(r[ci]) }; });
    // When there is a category column and no ordering, aggregate so the chart stays readable
    if (!an.ordered && an.labelIdx >= 0 && an.columns[an.labelIdx].type === 'text' && new Set(series.map(function (s) { return s.label; })).size < series.length) {
      series = Metis.analyze.groupBy(tb, an.labelIdx, ci, c.additive ? 'sum' : 'avg').map(function (g) { return { label: g.key, v: g.value }; });
    }
    return C.series(series, { unit: c.unit || (c.money ? '$' : ''), ordered: an.ordered, title: c.name });
  };

  V.dataTable = function (tb, sortCol, dir) {
    var an = tb.analysis, rows = tb.rows.slice();
    if (sortCol != null && sortCol >= 0) {
      var num = an.columns[sortCol].type === 'number';
      rows.sort(function (a, b) {
        var x = num ? T.parseNum(a[sortCol]) : String(a[sortCol]), y = num ? T.parseNum(b[sortCol]) : String(b[sortCol]);
        if (x == null) return 1; if (y == null) return -1;
        return (x > y ? 1 : x < y ? -1 : 0) * (dir || 1);
      });
    }
    return '<div class="dtable-wrap"><table class="dtable"><thead><tr>' + tb.columns.map(function (c, i) {
      return '<th class="' + (an.columns[i].type === 'number' ? 'num' : '') + (sortCol === i ? ' sorted' : '') + '" data-sort="' + i + '" data-dir="' + (sortCol === i ? -(dir || 1) : -1) + '">' + esc(c) + (sortCol === i ? (dir > 0 ? ' ↑' : ' ↓') : '') + '</th>';
    }).join('') + '</tr></thead><tbody>' + rows.map(function (r) {
      return '<tr>' + r.map(function (v, i) { return '<td class="' + (an.columns[i].type === 'number' ? 'num' : '') + (v === '' ? ' empty' : '') + '">' + (v === '' ? '—' : esc(v)) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table></div>';
  };

  function metricSheet(e) {
    var m = e.metric, h = '<div class="hero-metric"><span class="metric-v xl" data-count="' + (m.value != null ? m.value : '') + '" data-unit="' + esc(m.unit || '') + '">' + T.fmt(m.value, m.unit, { compact: false }) + '</span>' + delta(m) +
      (m.delta != null ? '<span class="muted">vs previous</span>' : '') + '</div>';
    if (e.text) h += '<p class="sheet-text">' + esc(e.text) + '</p>';
    if (m.target != null) h += '<section class="sheet-sec"><h4>Target</h4>' + C.meter(m.value, m.target, m.higherIsBetter) +
      '<p class="muted">' + (m.onTarget ? V.tonePill('good', 'On target') : V.tonePill('serious', 'Off target')) + ' Target ' + T.fmt(m.target, m.unit) + ' · ' + (m.higherIsBetter ? 'higher' : 'lower') + ' is better</p></section>';
    if (m.history.length > 1) h += '<section class="sheet-sec"><h4>History</h4><div class="chart-box s1">' +
      C.series(m.history.map(function (v, i) { return { label: i === m.history.length - 1 ? 'Now' : '−' + (m.history.length - 1 - i), v: v }; }), { unit: m.unit, ordered: true, kind: 'line', title: e.title }) + '</div></section>';
    var watchers = Metis.store.entries.filter(function (x) { return x.type === 'reminder' && x.reminder.condition && (x.reminder.condition.metric === e.id || T.norm(x.reminder.condition.metric) === T.norm(e.title)); });
    if (watchers.length) h += '<section class="sheet-sec"><h4>Watched by</h4>' + watchers.map(function (w) { return V.card(w, 0); }).join('') + '</section>';
    return h;
  }

  function reminderSheet(e) {
    var s = Metis.reminders.state(e), r = e.reminder, h = '';
    h += '<div class="rem-hero st-' + s.state + '">' + (s.occ ? '<div class="cal lg"><span>' + D.MON3[s.occ.getMonth()].toUpperCase() + '</span><b>' + s.occ.getDate() + '</b></div>' : '<div class="cal lg cond">' + V.icon('bolt') + '</div>') +
      '<div><p class="rem-state lg">' + esc(s.label) + '</p>' + (s.occ ? '<p class="muted">' + esc(D.fmt(s.occ, 'long')) + (r.time ? ' at ' + esc(r.time) : '') + '</p>' : '') + '</div></div>';
    if (e.text) h += '<p class="sheet-text">' + esc(e.text) + '</p>';
    var facts = [];
    if (r.repeat && r.repeat !== 'none') facts.push(['Repeats', T.cap(r.repeat)]);
    if (s.occ) facts.push(['Shows up', r.notify + ' day' + (r.notify === 1 ? '' : 's') + ' before']);
    if (s.cond) facts.push(['Condition', s.cond.text || 'Metric not found']);
    if (r.priority && r.priority !== 'normal') facts.push(['Priority', T.cap(r.priority)]);
    if (facts.length) h += '<dl class="fields">' + facts.map(function (f) { return '<dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd>'; }).join('') + '</dl>';
    h += '<p class="sheet-actions">' + (s.done
      ? '<button class="btn ghost" data-rem-undo="' + esc(e.id) + '" data-key="' + esc(s.key) + '">Mark as not done</button>'
      : '<button class="btn" data-rem-done="' + esc(e.id) + '">' + V.icon('check') + ' Done</button><button class="btn ghost" data-rem-snooze="' + esc(e.id) + '">Snooze 1 day</button>') + '</p>';
    return h;
  }

  V.projectSheet = function (p) {
    var h = '<header class="sheet-head"><span class="type type-project">' + V.icon('folder') + 'Project</span><h2 id="sheetTitle">' + esc(p.name) + '</h2>' +
      '<p class="sheet-meta">' + (p.status ? V.status(p.status) : '') + (p.owner ? '<span class="dot-sep">·</span>' + esc(p.owner) : '') + (p.lastDate ? '<span class="dot-sep">·</span>Updated ' + esc(D.relative(p.lastDate)) : '') + '</p></header>';
    if (p.description) h += '<p class="sheet-text">' + esc(p.description) + '</p>';
    if (p.progress != null) h += '<div class="proj-hero">' + C.ring(p.progress / 100, { size: 120, stroke: 10, cls: 'big' }) + '<b>' + Math.round(p.progress) + '<small>%</small></b></div>';
    var list = p.entries.slice().sort(function (a, b) { return (b.date || 0) - (a.date || 0); });
    h += '<section class="sheet-sec"><h4>Timeline</h4><ol class="timeline">' + list.map(function (x) {
      return '<li data-open="' + esc(x.id) + '" tabindex="0"><span class="tl-dot tone-' + (x.status ? Metis.store.STATUS[x.status].tone : 'neutral') + '"></span>' +
        '<span class="tl-date">' + esc(x.date ? D.fmt(x.date) : '') + '</span><span class="tl-t">' + V.typeIcon(x.type) + esc(x.title) + '</span></li>';
    }).join('') + '</ol></section>';
    return h;
  };
})();
