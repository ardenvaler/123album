/*
 * Store: normalizes raw entries, derives automatic keywords, builds the
 * search index and the project registry.
 *
 * Entry types: update · table · metric · reminder · note · link
 * (unknown types are kept and shown as generic cards)
 */
(function () {
  'use strict';
  var T = Metis.text, D = Metis.dates, A = Metis.analyze;
  var S = (Metis.store = { entries: [], byId: new Map(), projects: [], projectByKey: new Map() });

  var TYPE_ALIASES = {
    update: 'update', status: 'update', progress: 'update', log: 'update', news: 'update', done: 'update',
    table: 'table', data: 'table', dataset: 'table', csv: 'table', sheet: 'table', spreadsheet: 'table',
    metric: 'metric', kpi: 'metric', datapoint: 'metric', number: 'metric', stat: 'metric', figure: 'metric',
    reminder: 'reminder', todo: 'reminder', deadline: 'reminder', event: 'reminder', date: 'reminder',
    note: 'note', idea: 'note', memo: 'note', thought: 'note',
    link: 'link', bookmark: 'link', url: 'link', resource: 'link'
  };
  S.TYPES = {
    update:   { label: 'Update',   plural: 'Updates',   icon: 'pulse' },
    table:    { label: 'Table',    plural: 'Tables',    icon: 'grid' },
    metric:   { label: 'Metric',   plural: 'Metrics',   icon: 'gauge' },
    reminder: { label: 'Reminder', plural: 'Reminders', icon: 'bell' },
    note:     { label: 'Note',     plural: 'Notes',     icon: 'note' },
    link:     { label: 'Link',     plural: 'Links',     icon: 'link' }
  };

  var STATUS = {
    done:    { label: 'Done',        tone: 'good',     words: ['done', 'complete', 'completed', 'finished', 'shipped', 'closed', 'delivered', 'launched', 'resolved', 'released', 'approved', 'signed'] },
    active:  { label: 'In progress', tone: 'info',     words: ['in progress', 'in-progress', 'ongoing', 'active', 'wip', 'working', 'started', 'underway', 'running', 'open'] },
    blocked: { label: 'Blocked',     tone: 'critical', words: ['blocked', 'stuck', 'on hold', 'on-hold', 'waiting', 'paused', 'halted'] },
    risk:    { label: 'At risk',     tone: 'serious',  words: ['at risk', 'at-risk', 'delayed', 'late', 'behind', 'slipping', 'overdue'] },
    planned: { label: 'Planned',     tone: 'neutral',  words: ['planned', 'todo', 'to do', 'to-do', 'pending', 'not started', 'backlog', 'upcoming', 'scheduled', 'queued'] }
  };
  S.STATUS = STATUS;

  S.statusKey = function (s) {
    if (!s) return null;
    var n = T.norm(s).trim();
    for (var k in STATUS) if (k === n || STATUS[k].words.indexOf(n) >= 0) return k;
    return null;
  };

  function inferStatus(text) {
    var n = ' ' + T.norm(text) + ' ';
    if (/\b(blocked|stuck|waiting on|on hold)\b/.test(n)) return 'blocked';
    if (/\b(delayed|slipp(ed|ing)|behind schedule|at risk)\b/.test(n)) return 'risk';
    if (/\b(completed?|finished|shipped|launched|delivered|done|wrapped up|closed out|signed off|resolved|went live)\b/.test(n)) return 'done';
    if (/\b(started|kicked off|working on|in progress|underway|drafting|ongoing)\b/.test(n)) return 'active';
    return null;
  }

  function arr(v) {
    if (v == null || v === '') return [];
    if (Array.isArray(v)) return v.filter(Boolean).map(String);
    return String(v).split(/\s*[,;]\s*/).filter(Boolean);
  }

  function firstSentence(s) {
    s = String(s || '').trim();
    var m = s.match(/^(.{8,90}?[.!?])(\s|$)/);
    return m ? m[1].replace(/[.!?]$/, '') : s.length > 70 ? s.slice(0, 68).replace(/\s\S*$/, '') + '…' : s;
  }

  function inferType(r) {
    if (r.csv || r.rows || r.columns) return 'table';
    if (r.due || r.when || r.remind) return 'reminder';
    if (r.value != null) return 'metric';
    if (r.url) return 'link';
    if (r.status || r.project) return 'update';
    return 'note';
  }

  function tableFrom(r) {
    var columns, rows;
    if (r.csv) { var p = A.parseCSV(r.csv); columns = p.columns; rows = p.rows; }
    else {
      rows = r.rows || [];
      if (rows.length && !Array.isArray(rows[0]) && typeof rows[0] === 'object') {
        columns = r.columns || Object.keys(rows[0]);
        rows = rows.map(function (o) { return columns.map(function (c) { return o[c] == null ? '' : o[c]; }); });
      } else columns = r.columns || (rows[0] || []).map(function (_, i) { return 'Column ' + (i + 1); });
    }
    rows = rows.map(function (row) { return row.map(function (c) { return c == null ? '' : typeof c === 'number' ? c : String(c); }); });
    return { columns: columns.map(String), rows: rows, analysis: A.table(columns, rows) };
  }

  function metricFrom(r) {
    var hist = (r.history || r.trend || []).map(T.parseNum).filter(function (v) { return v != null; });
    var value = T.parseNum(r.value);
    if (value == null && hist.length) value = hist[hist.length - 1];
    var prev = r.previous != null ? T.parseNum(r.previous) : hist.length > 1 ? hist[hist.length - 2] : null;
    var unit = r.unit != null ? r.unit : T.unitOf(r.value);
    var m = {
      value: value, unit: unit, previous: prev, history: hist,
      target: r.target != null ? T.parseNum(r.target) : null,
      higherIsBetter: r.higherIsBetter !== false && r.better !== 'lower',
      period: r.period || (r.compare ? r.compare : 'previous')
    };
    if (prev != null && prev !== 0 && value != null) m.delta = ((value - prev) / Math.abs(prev)) * 100;
    if (m.target != null && value != null) {
      m.onTarget = m.higherIsBetter ? value >= m.target : value <= m.target;
      m.progress = m.higherIsBetter ? value / m.target : m.target / value;
    }
    return m;
  }

  function reminderFrom(r) {
    var due = D.parse(r.due || r.when || r.date);
    return {
      due: due,
      time: r.time || (typeof r.due === 'string' && /T\d{2}:\d{2}/.test(r.due) ? r.due.slice(11, 16) : null),
      repeat: (r.repeat || r.every || 'none').toLowerCase(),
      notify: r.notify != null ? +r.notify : r.leadDays != null ? +r.leadDays : 3,
      condition: r.condition || r.when_metric || null,
      priority: r.priority || 'normal'
    };
  }

  function normalize(raw, source) {
    var type = TYPE_ALIASES[T.norm(raw.type || '')] || (raw.type ? T.norm(raw.type) : inferType(raw));
    var text = raw.text || raw.body || raw.summary || raw.description || raw.note || '';
    var e = {
      raw: raw, type: type, source: source || 'data',
      title: raw.title || raw.name || firstSentence(text) || (S.TYPES[type] ? S.TYPES[type].label : 'Entry'),
      text: String(text),
      project: raw.project ? String(raw.project) : null,
      keywords: arr(raw.keywords || raw.tags),
      people: arr(raw.people || raw.owner || raw.with || raw.who),
      url: raw.url || raw.link || null,
      pinned: !!raw.pinned,
      ticket: raw.ticket ? String(raw.ticket).toUpperCase() : null
    };
    e.date = D.parse(raw.date || raw.updated || raw.created || (type === 'reminder' ? null : raw.due));
    e.status = S.statusKey(raw.status) || (type === 'update' ? inferStatus(e.title + '. ' + e.text) : null);
    if (raw.progress != null) e.progress = Math.max(0, Math.min(100, T.parseNum(raw.progress)));
    if (type === 'table') { e.table = tableFrom(raw); }
    if (type === 'metric') { e.metric = metricFrom(raw); }
    if (type === 'reminder') { e.reminder = reminderFrom(raw); if (!e.date) e.date = e.reminder.due; }
    if (type !== 'reminder') e.ticket = null;
    if (e.ticket) e.ticketNum = parseInt(e.ticket.replace(/\D/g, ''), 10) || null;
    return e;
  }

  // ---------- automatic keywords ----------
  var COMMON_CAPS = new Set(('the a an i we it this that our my in on at for to of and but or new next last first today tomorrow yesterday ' +
    'monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december ' +
    'jan feb mar apr jun jul aug sep sept oct nov dec q1 q2 q3 q4 ok also still then after before during done note update team please').split(' '));

  function properNouns(text) {
    var out = [];
    String(text || '').split(/(?<=[.!?:;])\s+|\n+/).forEach(function (sentence) {
      var words = sentence.split(/\s+/);
      for (var i = 1; i < words.length; i++) {
        var w = words[i].replace(/^[("'“]+|[)"'”.,!?:;]+$/g, '').replace(/'s$/, '');
        if (/^[A-Z][a-z]{2,}$/.test(w) && !COMMON_CAPS.has(w.toLowerCase())) out.push(w);
        else if (/^[A-Z][A-Z0-9]{1,5}$/.test(w) && !/^Q[1-4]$/.test(w)) out.push(w);
      }
    });
    return out;
  }

  // Words too generic to be useful as automatic keywords
  var AUTO_STOP = new Set(('both one two three four five six seven eight nine ten first second third new now still need needs set sent made make ' +
    'got using used likely final finished started collected done complete completed found all also near across around today yesterday ' +
    'week month year day days time ago soon next last so far') .split(' ').map(function (w) { return T.stem(w); }));

  function hashtags(text) { return (String(text || '').match(/#[\w\-]+/g) || []).map(function (h) { return h.slice(1); }); }

  // ---------- indexing ----------
  var WEIGHTS = { title: 3, kw: 3, auto: 1.6, project: 2.4, people: 2.2, status: 1.6, type: 1.2, text: 1, cells: 0.7, facets: 0.8 };

  function indexEntry(e) {
    var f = {};
    function put(field, list) { list.forEach(function (t) { if (t) f[t] = Math.max(f[t] || 0, WEIGHTS[field]); }); }
    put('title', T.tokens(e.title));
    put('kw', T.tokens(e.keywords.join(' ')));
    if (e.ticket) put('title', T.tokens(e.ticket));
    put('project', T.tokens(e.project || ''));
    put('people', T.tokens(e.people.join(' ')));
    put('text', T.tokens(e.text));
    put('type', [e.type, T.stem(e.type)]);
    if (e.status) put('status', T.tokens(STATUS[e.status].label + ' ' + e.status));
    if (e.table) {
      put('title', T.tokens(e.table.columns.join(' ')));
      var cells = [];
      e.table.analysis.columns.forEach(function (c, i) {
        if (c.type === 'text') e.table.rows.slice(0, 400).forEach(function (r) { cells.push(r[i]); });
      });
      put('cells', T.tokens(cells.join(' ')));
    }
    if (e.metric && e.metric.unit) put('auto', T.tokens(e.metric.unit));
    put('facets', D.facets(e.date));
    if (e.reminder && e.reminder.repeat !== 'none') put('facets', T.tokens(e.reminder.repeat + ' recurring'));
    e._idx = f;
    e._content = T.tokens([e.title, e.text, e.keywords.join(' ')].join(' '));
  }

  S.build = function () {
    var raws = Metis._raw.map(function (r) { return [r, 'data']; })
      .concat(Metis.storage.get('local', []).map(function (r) { return [r, 'local']; }))
      .concat((S._session || []).map(function (r) { return [r, 'session']; }));

    var seen = {};
    S.entries = raws.map(function (p) {
      var e;
      try { e = normalize(p[0], p[1]); }
      catch (err) { console.warn('[Metis] Skipped an entry that could not be read:', p[0], err); return null; }
      var base = p[0].id || e.type + '-' + T.slug(e.title);
      e.id = seen[base] ? base + '-' + (++seen[base]) : base;
      seen[base] = seen[base] || 1;
      return e;
    }).filter(Boolean);

    S.byId = new Map(S.entries.map(function (e) { return [e.id, e]; }));
    S.entries.forEach(indexEntry);

    // Document frequency for IDF + TF-IDF auto keywords
    var df = new Map();
    S.entries.forEach(function (e) { Object.keys(e._idx).forEach(function (t) { df.set(t, (df.get(t) || 0) + 1); }); });
    S.df = df; S.N = S.entries.length || 1;

    // Display forms for stems (most frequent surface word)
    var forms = new Map();
    S.entries.forEach(function (e) {
      T.words([e.title, e.text].join(' ')).forEach(function (w) {
        var s = T.stem(w.replace(/'s$/, '').replace(/'/g, ''));
        var m = forms.get(s) || {}; m[w] = (m[w] || 0) + 1; forms.set(s, m);
      });
    });
    function display(stem) {
      var m = forms.get(stem); if (!m) return stem;
      return Object.keys(m).sort(function (a, b) { return m[b] - m[a] || a.length - b.length; })[0];
    }

    S.entries.forEach(function (e) {
      var auto = [];
      // 1. hashtags + proper nouns (people, products, clients, acronyms)
      hashtags(e.text).forEach(function (h) { auto.push(h); });
      properNouns(e.title + '. ' + e.text).forEach(function (n) { auto.push(n); });
      // 2. table structure
      if (e.table) {
        e.table.columns.forEach(function (c) { auto.push(c); });
        e.table.analysis.columns.forEach(function (c) { if (c.categorical && c.top) c.top.slice(0, 3).forEach(function (t) { auto.push(t[0]); }); });
      }
      // 3. TF-IDF content terms
      var tf = {};
      var titleToks = new Set(T.tokens(e.title));
      e._content.forEach(function (t) {
        if (t.length > 2 && !/^\d+$/.test(t) && !AUTO_STOP.has(t) && forms.has(t)) tf[t] = (tf[t] || 0) + (titleToks.has(t) ? 1.5 : 1);
      });
      Object.keys(tf).map(function (t) { return [t, tf[t] * Math.log(1 + S.N / (df.get(t) || 1))]; })
        .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5)
        .forEach(function (p) { auto.push(display(p[0])); });
      // 4. facets: status, time
      if (e.status) auto.push(STATUS[e.status].label.toLowerCase());
      if (e.date) auto.push(D.MONTHS[e.date.getMonth()] + ' ' + e.date.getFullYear(), 'q' + D.quarter(e.date));
      if (e.reminder && e.reminder.repeat !== 'none') auto.push(e.reminder.repeat);
      if (e.metric && e.metric.target != null) auto.push(e.metric.onTarget ? 'on target' : 'off target');

      // Skip anything that duplicates the user's own keywords or the project name (compared by stem)
      var userStems = new Set(T.tokens(e.keywords.join(' ') + ' ' + (e.project || '')));
      var dedup = new Set();
      e.autoKeywords = auto.map(String).filter(function (k) {
        var n = T.norm(k).trim(), st = T.tokens(k).join(' ');
        if (!n || n.length < 2 || dedup.has(st || n)) return false;
        if (st && T.tokens(k).every(function (t) { return userStems.has(t); })) return false;
        dedup.add(st || n); return true;
      }).slice(0, 10);
      // auto keywords are searchable too
      T.tokens(e.autoKeywords.join(' ')).forEach(function (t) { e._idx[t] = Math.max(e._idx[t] || 0, WEIGHTS.auto); });
    });

    S.vocab = Array.from(new Set(S.entries.reduce(function (a, e) { return a.concat(Object.keys(e._idx)); }, [])));
    buildProjects();
    Metis.emit('build', S);
    return S;
  };

  function buildProjects() {
    var map = new Map();
    function key(n) { return T.slug(n); }
    Metis._projects.forEach(function (p, i) {
      if (!p || !p.name) return;
      map.set(key(p.name), {
        name: p.name, key: key(p.name), description: p.description || '', status: S.statusKey(p.status),
        owner: p.owner || null, due: D.parse(p.due), aliases: arr(p.aliases), progress: p.progress != null ? +p.progress : null,
        order: i, entries: []
      });
    });
    S.entries.forEach(function (e) {
      if (!e.project) return;
      var k = key(e.project), p = map.get(k);
      if (!p) { p = { name: e.project, key: k, description: '', status: null, aliases: [], progress: null, order: 999, entries: [] }; map.set(k, p); }
      p.entries.push(e);
      e.projectKey = k;
    });
    S.projects = Array.from(map.values()).map(function (p) {
      var dated = p.entries.filter(function (e) { return e.date && e.type !== 'reminder'; }).sort(function (a, b) { return b.date - a.date; });
      p.last = dated[0] || null;
      p.lastDate = p.last ? p.last.date : null;
      var withProg = dated.find(function (e) { return e.progress != null; });
      if (p.progress == null && withProg) p.progress = withProg.progress;
      if (!p.status) {
        var st = dated.find(function (e) { return e.status; });
        p.status = st ? st.status : 'active';
      }
      if (p.status === 'done' && p.progress == null) p.progress = 100;
      p.counts = {}; p.entries.forEach(function (e) { p.counts[e.type] = (p.counts[e.type] || 0) + 1; });
      p.tokens = T.tokens(p.name + ' ' + p.aliases.join(' '));
      return p;
    }).sort(function (a, b) { return (b.lastDate || 0) - (a.lastDate || 0) || a.order - b.order; });
    S.projectByKey = new Map(S.projects.map(function (p) { return [p.key, p]; }));
  }

  // ---------- local (browser-saved) entries ----------
  S.addLocal = function (raw) {
    var list = Metis.storage.get('local', []);
    raw.id = raw.id || 'local-' + Date.now().toString(36);
    raw.created = raw.created || D.iso(D.today());
    list.push(raw);
    Metis.storage.set('local', list);
    S.build(); Metis.emit('change', { added: raw.id });
    return S.byId.get(raw.id);
  };
  S.removeLocal = function (id) {
    Metis.storage.set('local', Metis.storage.get('local', []).filter(function (r) { return r.id !== id; }));
    S.build(); Metis.emit('change', { removed: id });
  };
  S.addSession = function (raw) {
    S._session = S._session || [];
    raw.id = raw.id || 'session-' + Date.now().toString(36);
    S._session.push(raw);
    S.build(); Metis.emit('change', { added: raw.id });
    return S.byId.get(raw.id);
  };
  S.keepSession = function (id) {
    var raw = (S._session || []).find(function (r) { return r.id === id; });
    if (!raw) return;
    S._session = S._session.filter(function (r) { return r !== raw; });
    raw.id = raw.id.replace(/^session-/, 'local-');
    var list = Metis.storage.get('local', []); list.push(raw); Metis.storage.set('local', list);
    S.build(); Metis.emit('change', {});
  };
})();
