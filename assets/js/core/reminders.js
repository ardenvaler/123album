/*
 * Reminder engine.
 *
 * A reminder pops up when its condition is met:
 *   - date: from `notify` days before `due` (default 3), on the day, and while overdue
 *   - repeat: weekly | monthly | yearly | daily — the next occurrence is used
 *   - condition: { metric: "<metric id or title>", above: N } / below / equals
 *     (with no due date it fires whenever the condition holds)
 *
 * "Done" and "Snooze" are remembered in this browser per occurrence.
 */
(function () {
  'use strict';
  var D = Metis.dates, T = Metis.text;
  var R = (Metis.reminders = {});

  function occurrence(e) {
    var r = e.reminder, due = r.due;
    if (!due) return null;
    if (r.repeat === 'none' || !r.repeat) return due;
    var t = D.today(), d = D.startOfDay(due), guard = 0;
    var step = { daily: [1, 'd'], day: [1, 'd'], weekly: [7, 'd'], week: [7, 'd'], biweekly: [14, 'd'], monthly: [1, 'm'], month: [1, 'm'], quarterly: [3, 'm'], yearly: [12, 'm'], annual: [12, 'm'], annually: [12, 'm'], year: [12, 'm'] }[r.repeat];
    if (!step) return due;
    var k = 0, base = d;
    while (d < t && guard++ < 5000) {
      k++;
      d = step[1] === 'd' ? D.addDays(base, step[0] * k) : D.addMonths(base, step[0] * k);
    }
    // A recurring item missed yesterday stays "overdue" until acknowledged
    var prev = k > 0 ? (step[1] === 'd' ? D.addDays(base, step[0] * (k - 1)) : D.addMonths(base, step[0] * (k - 1))) : null;
    if (prev && D.diffDays(prev, t) <= 2 && D.diffDays(prev, t) > 0 && !isDone(e, prev)) return prev;
    return d;
  }

  function conditionMet(e) {
    var c = e.reminder.condition;
    if (!c || !c.metric) return null;
    var S = Metis.store, target = S.byId.get(c.metric) ||
      S.entries.find(function (x) { return x.type === 'metric' && T.norm(x.title) === T.norm(c.metric); });
    if (!target || !target.metric || target.metric.value == null) return { met: false, missing: true };
    var v = target.metric.value, met = false, desc = '';
    if (c.above != null) { met = v > c.above; desc = 'above ' + T.fmt(c.above, target.metric.unit); }
    else if (c.below != null) { met = v < c.below; desc = 'below ' + T.fmt(c.below, target.metric.unit); }
    else if (c.equals != null) { met = v === c.equals; desc = 'equal to ' + T.fmt(c.equals, target.metric.unit); }
    return { met: met, metric: target, value: v, text: target.title + ' is ' + T.fmt(v, target.metric.unit) + (met ? ' — ' : ', not yet ') + desc };
  }

  function key(e, occ) { return e.id + '@' + (occ ? D.iso(occ) : 'cond'); }
  function isDone(e, occ) {
    if (e.status === 'done' && (!e.reminder.repeat || e.reminder.repeat === 'none')) return true;
    return !!Metis.storage.get('acks', {})[key(e, occ)];
  }

  R.state = function (e) {
    if (!e || !e.reminder) return null;
    var occ = occurrence(e), t = D.today(), cond = conditionMet(e);
    var s = { entry: e, occ: occ, key: key(e, occ), cond: cond };
    s.done = isDone(e, occ);
    var snoozes = Metis.storage.get('snooze', {});
    s.snoozed = snoozes[s.key] && snoozes[s.key] > Date.now();
    s.days = occ ? D.diffDays(t, occ) : null;

    if (s.done) s.state = 'done';
    else if (cond && !occ) s.state = cond.met ? 'triggered' : 'waiting';
    else if (cond && occ && !cond.met) s.state = 'waiting';
    else if (s.days == null) s.state = 'none';
    else if (s.days < 0) s.state = 'overdue';
    else if (s.days === 0) s.state = 'today';
    else if (s.days <= e.reminder.notify) s.state = 'soon';
    else s.state = 'later';

    // A time-of-day reminder due today becomes "now" once the time passes
    if (s.state === 'today' && e.reminder.time) {
      var hm = e.reminder.time.split(':'), n = D.now();
      s.at = new Date(occ.getFullYear(), occ.getMonth(), occ.getDate(), +hm[0], +hm[1] || 0);
      if (n >= s.at) s.state = 'now';
    }
    s.alert = !s.done && !s.snoozed && ['overdue', 'today', 'now', 'soon', 'triggered'].indexOf(s.state) >= 0;
    s.label = label(s);
    return s;
  };

  function label(s) {
    switch (s.state) {
      case 'overdue': return 'Overdue · ' + D.relative(s.occ);
      case 'today': return 'Today' + (s.entry.reminder.time ? ' · ' + s.entry.reminder.time : '');
      case 'now': return 'Now · ' + s.entry.reminder.time;
      case 'soon': return 'Due ' + D.relative(s.occ);
      case 'later': return D.fmt(s.occ, 'day');
      case 'triggered': return 'Condition met';
      case 'waiting': return s.cond && s.cond.missing ? 'Waiting · metric not found' : 'Watching';
      case 'done': return 'Done';
      default: return 'No date';
    }
  }

  R.all = function () {
    var rank = { now: 0, overdue: 1, triggered: 2, today: 3, soon: 4, later: 5, waiting: 6, none: 7, done: 8 };
    return Metis.store.entries.filter(function (e) { return e.type === 'reminder'; }).map(R.state)
      .sort(function (a, b) { return rank[a.state] - rank[b.state] || (a.occ || 0) - (b.occ || 0); });
  };
  R.alerts = function () { return R.all().filter(function (s) { return s.alert; }); };
  R.next = function () {
    return R.all().filter(function (s) { return !s.done && s.occ && s.days >= 0; }).sort(function (a, b) { return a.occ - b.occ; })[0] || null;
  };

  R.markDone = function (e) {
    var s = R.state(e), acks = Metis.storage.get('acks', {});
    acks[s.key] = D.iso(D.today()); Metis.storage.set('acks', acks);
    Metis.emit('reminders', {});
  };
  R.undo = function (e, occKey) {
    var acks = Metis.storage.get('acks', {});
    delete acks[occKey || R.state(e).key]; Metis.storage.set('acks', acks);
    Metis.emit('reminders', {});
  };
  R.snooze = function (e, hours) {
    var s = R.state(e), sn = Metis.storage.get('snooze', {});
    sn[s.key] = Date.now() + (hours || 24) * 36e5; Metis.storage.set('snooze', sn);
    Metis.emit('reminders', {});
  };

  // System notifications (opt-in) — one per occurrence per day
  R.notifySystem = function (s) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var sent = Metis.storage.get('notified', {}), k = s.key + '#' + D.iso(D.today());
    if (sent[k]) return;
    sent[k] = 1; Metis.storage.set('notified', sent);
    try { new Notification(s.entry.title, { body: s.label + (s.entry.text ? ' — ' + s.entry.text : ''), tag: s.key }); } catch (e) {}
  };

  // Periodic check; fires `Metis.emit('reminders')` each minute so the UI refreshes
  R.start = function () {
    var tick = function () {
      R.alerts().forEach(R.notifySystem);
      Metis.emit('reminders', { tick: true });
    };
    setTimeout(tick, 1200);
    setInterval(tick, 60 * 1000);
  };
})();
