/*
 * Insights: short, data-driven observations + suggested questions.
 * Used by the control center and the assistant.
 *
 *   Metis.insights.list()    -> [{ tone, icon, title, html, query, weight }]
 *   Metis.insights.tips()    -> [{ text, query }]  suggested things to ask
 *   Metis.insights.summary() -> numbers for the landing page
 */
(function () {
  'use strict';
  var T = Metis.text, D = Metis.dates;
  var I = (Metis.insights = {});

  I.summary = function () {
    var S = Metis.store, R = Metis.reminders, t = D.today();
    var weekAgo = D.addDays(t, -7);
    var rem = R.all();
    var updates = S.entries.filter(function (e) { return e.type === 'update'; });
    return {
      total: S.entries.length,
      projects: S.projects.length,
      activeProjects: S.projects.filter(function (p) { return p.status !== 'done'; }).length,
      overdue: rem.filter(function (s) { return s.state === 'overdue'; }).length,
      today: rem.filter(function (s) { return s.state === 'today' || s.state === 'now'; }).length,
      week: rem.filter(function (s) { return !s.done && s.days != null && s.days >= 0 && s.days <= 7; }).length,
      alerts: rem.filter(function (s) { return s.alert; }).length,
      updatesWeek: updates.filter(function (e) { return e.date && e.date >= weekAgo && e.date <= D.addDays(t, 1); }).length,
      doneWeek: updates.filter(function (e) { return e.status === 'done' && e.date && e.date >= weekAgo; }).length,
      counts: S.entries.reduce(function (a, e) { a[e.type] = (a[e.type] || 0) + 1; return a; }, {})
    };
  };

  I.list = function () {
    var S = Metis.store, R = Metis.reminders, t = D.today(), out = [];
    var rem = R.all();

    var overdue = rem.filter(function (s) { return s.state === 'overdue'; });
    if (overdue.length) out.push({ tone: 'critical', icon: 'bell', weight: 10, title: T.plural(overdue.length, 'overdue reminder'),
      html: '<b>' + T.esc(overdue[0].entry.title) + '</b> was due ' + D.relative(overdue[0].occ) + '.', query: 'overdue reminders' });

    var today = rem.filter(function (s) { return s.state === 'today' || s.state === 'now'; });
    if (today.length) out.push({ tone: 'warning', icon: 'bell', weight: 9, title: T.plural(today.length, 'thing') + ' due today',
      html: today.slice(0, 2).map(function (s) { return '<b>' + T.esc(s.entry.title) + '</b>'; }).join(' and ') + (today.length > 2 ? ' and more' : '') + '.', query: 'due today' });

    var trig = rem.filter(function (s) { return s.state === 'triggered'; });
    trig.forEach(function (s) { out.push({ tone: 'warning', icon: 'bolt', weight: 8.5, title: 'Condition met', html: '<b>' + T.esc(s.entry.title) + '</b> — ' + T.esc(s.cond.text) + '.', open: s.entry.id }); });

    var week = rem.filter(function (s) { return !s.done && s.days != null && s.days > 0 && s.days <= 7; });
    if (week.length) out.push({ tone: 'info', icon: 'calendar', weight: 6, title: T.plural(week.length, 'reminder') + ' in the next 7 days',
      html: 'Next: <b>' + T.esc(week[0].entry.title) + '</b>, ' + D.relative(week[0].occ) + '.', query: 'reminders next 7 days' });

    // Metrics
    var metrics = S.entries.filter(function (e) { return e.type === 'metric' && e.metric.value != null; });
    var off = metrics.filter(function (e) { return e.metric.target != null && !e.metric.onTarget; });
    if (off.length) out.push({ tone: 'serious', icon: 'gauge', weight: 7, title: T.plural(off.length, 'metric') + ' off target',
      html: off.slice(0, 2).map(function (e) { return '<b>' + T.esc(e.title) + '</b> ' + T.fmt(e.metric.value, e.metric.unit) + ' vs ' + T.fmt(e.metric.target, e.metric.unit); }).join('; ') + '.', query: 'metrics off target' });
    var movers = metrics.filter(function (e) { return e.metric.delta != null && Math.abs(e.metric.delta) >= 8; })
      .sort(function (a, b) { return Math.abs(b.metric.delta) - Math.abs(a.metric.delta); });
    if (movers.length) {
      var m = movers[0], good = (m.metric.delta > 0) === m.metric.higherIsBetter;
      out.push({ tone: good ? 'good' : 'serious', icon: 'trend', weight: 5.5, title: 'Biggest mover',
        html: '<b>' + T.esc(m.title) + '</b> ' + (m.metric.delta > 0 ? 'up ' : 'down ') + T.pct(Math.abs(m.metric.delta)) + ' to ' + T.fmt(m.metric.value, m.metric.unit) + '.', open: m.id });
    }

    // Projects
    var blocked = S.projects.filter(function (p) { return p.status === 'blocked' || p.status === 'risk'; });
    if (blocked.length) out.push({ tone: 'critical', icon: 'alert', weight: 8, title: T.plural(blocked.length, 'project') + (blocked.length === 1 ? ' needs' : ' need') + ' attention',
      html: blocked.map(function (p) { return '<b>' + T.esc(p.name) + '</b> (' + S.STATUS[p.status].label.toLowerCase() + ')'; }).join(', ') + '.', query: 'blocked or at risk projects' });
    var stale = S.projects.filter(function (p) { return p.status !== 'done' && p.lastDate && D.diffDays(p.lastDate, t) >= 14; });
    if (stale.length) out.push({ tone: 'info', icon: 'clock', weight: 4, title: 'Quiet for a while',
      html: stale.slice(0, 2).map(function (p) { return '<b>' + T.esc(p.name) + '</b> — last update ' + D.relative(p.lastDate); }).join('; ') + '.', query: stale[0].name });

    var doneWeek = S.entries.filter(function (e) { return e.type === 'update' && e.status === 'done' && e.date && D.diffDays(e.date, t) <= 7 && D.diffDays(e.date, t) >= 0; });
    if (doneWeek.length) out.push({ tone: 'good', icon: 'check', weight: 5, title: T.plural(doneWeek.length, 'win') + ' this week',
      html: doneWeek.slice(0, 2).map(function (e) { return '<b>' + T.esc(e.title) + '</b>'; }).join(', ') + '.', query: 'done this week' });

    // Tables — headline of the most recent dataset
    var tables = S.entries.filter(function (e) { return e.type === 'table'; }).sort(function (a, b) { return (b.date || 0) - (a.date || 0); });
    tables.slice(0, 2).forEach(function (e, i) {
      var trend = e.table.analysis.insights.find(function (x) { return x.kind === 'trend' || x.kind === 'share'; }) || e.table.analysis.insights[0];
      if (trend) out.push({ tone: 'info', icon: 'grid', weight: 4.5 - i, title: e.title, html: trend.text, open: e.id });
    });

    // Hygiene: entries without your own keywords
    var noKw = S.entries.filter(function (e) { return !e.keywords.length && e.source !== 'session'; });
    if (noKw.length && noKw.length >= S.entries.length * 0.3)
      out.push({ tone: 'neutral', icon: 'tag', weight: 1, title: 'Keywords',
        html: T.plural(noKw.length, 'entry', 'entries') + ' had no keywords — I derived ' + noKw.reduce(function (a, e) { return a + e.autoKeywords.length; }, 0) + ' automatically from their content.' });

    return out.sort(function (a, b) { return b.weight - a.weight; });
  };

  I.tips = function () {
    var S = Metis.store, tips = [], seen = new Set();
    function add(text) { if (!seen.has(text)) { seen.add(text); tips.push({ text: text, query: text }); } }
    var s = I.summary();
    if (s.overdue) add('what’s overdue');
    if (s.week) add('what’s due this week');
    var tables = S.entries.filter(function (e) { return e.type === 'table'; });
    tables.slice(0, 2).forEach(function (e) {
      var an = e.table.analysis; if (an.primaryIdx < 0) return;
      var c = an.columns[an.primaryIdx].name.toLowerCase();
      if (an.catIdx.length) add(c + ' by ' + an.columns[an.catIdx[0]].name.toLowerCase());
      else add((an.columns[an.primaryIdx].additive ? 'total ' : 'average ') + c);
      if (an.ordered) add(c + ' trend');
    });
    S.projects.slice(0, 2).forEach(function (p) { add(p.name + ' updates'); });
    add('what did I finish last week');
    if (s.counts.metric) add('metrics off target');
    add('how many updates this month');
    return tips.slice(0, 8);
  };
})();
