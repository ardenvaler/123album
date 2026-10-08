/*
 * Assistant: a conversational front end to the same search engine,
 * plus briefings, tips, and quick capture ("remind me…", "note:…", "log:…").
 * Everything runs locally — no network calls.
 */
(function () {
  'use strict';
  var T = Metis.text, D = Metis.dates, S = Metis.store, I = Metis.insights, V;
  var esc = T.esc;
  var A = (Metis.assistant = {});
  var el = {}, greeted = false, asked = new Set();

  function init() {
    V = Metis.view;
    ['assistant', 'assistantBtn', 'assistantClose', 'assistantLog', 'assistantForm', 'assistantQ'].forEach(function (id) { el[id] = document.getElementById(id); });
    el.assistantBtn.addEventListener('click', function () { A.toggle(); });
    el.assistantClose.addEventListener('click', function () { A.close(); });
    el.assistantForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var v = el.assistantQ.value.trim(); if (!v) return;
      el.assistantQ.value = '';
      A.ask(v);
    });
    el.assistantLog.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-ask],[data-dash],[data-undo-local],[data-copy],[data-notify]');
      if (!t) return;
      ev.stopPropagation();
      if (t.dataset.ask) A.ask(t.dataset.ask);
      else if (t.dataset.dash) { Metis.search(t.dataset.dash); if (innerWidth < 760) A.close(); }
      else if (t.dataset.undoLocal) { S.removeLocal(t.dataset.undoLocal); t.closest('.msg').querySelector('.msg-body').insertAdjacentHTML('beforeend', '<p class="muted">Removed.</p>'); t.remove(); }
      else if (t.dataset.copy != null) {
        var pre = t.closest('.msg').querySelector('pre');
        if (navigator.clipboard) navigator.clipboard.writeText(pre.textContent).then(function () { t.textContent = 'Copied'; });
      } else if (t.dataset.notify != null) enableNotifications();
    }, true);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !el.assistant.hidden && document.activeElement && el.assistant.contains(document.activeElement)) A.close();
      if ((ev.metaKey || ev.ctrlKey) && ev.key === 'j') { ev.preventDefault(); A.toggle(); }
    });
  }

  A.open = function (prefill) {
    el.assistant.hidden = false;
    requestAnimationFrame(function () { document.body.classList.add('assistant-open'); });
    if (!greeted) { greeted = true; greet(); }
    if (prefill) el.assistantQ.value = prefill;
    setTimeout(function () { el.assistantQ.focus(); }, 280);
  };
  A.close = function () {
    document.body.classList.remove('assistant-open');
    setTimeout(function () { if (!document.body.classList.contains('assistant-open')) el.assistant.hidden = true; }, 420);
  };
  A.toggle = function () { if (document.body.classList.contains('assistant-open')) A.close(); else A.open(); };

  // ---------- messages ----------
  function push(role, html, opts) {
    var m = document.createElement('div');
    m.className = 'msg ' + role + (opts && opts.cls ? ' ' + opts.cls : '');
    m.innerHTML = role === 'bot' ? '<span class="orb xs" aria-hidden="true"><i></i><i></i><i></i></span><div class="msg-body">' + html + '</div>' : '<div class="msg-body">' + html + '</div>';
    el.assistantLog.appendChild(m);
    requestAnimationFrame(function () { m.classList.add('in'); });
    el.assistantLog.scrollTo({ top: el.assistantLog.scrollHeight, behavior: 'smooth' });
    return m;
  }
  function thinking() {
    var m = push('bot', '<span class="typing"><i></i><i></i><i></i></span>', { cls: 'thinking' });
    return m;
  }
  function reply(html, delay) {
    var t = thinking();
    setTimeout(function () {
      t.classList.remove('thinking');
      t.querySelector('.msg-body').innerHTML = html;
      el.assistantLog.scrollTo({ top: el.assistantLog.scrollHeight, behavior: 'smooth' });
    }, delay == null ? 380 + Math.random() * 260 : delay);
  }
  function chips(list) {
    list = list.filter(function (x) { return !asked.has(T.norm(x)); }).slice(0, 4);
    if (!list.length) return '';
    return '<div class="msg-chips">' + list.map(function (q) { return '<button class="chip sm" data-ask="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') + '</div>';
  }

  function greet() {
    var s = I.summary(), ins = I.list().slice(0, 3);
    var h = D.now().getHours(), hello = h < 12 ? 'Morning!' : h < 18 ? 'Hi!' : 'Evening!';
    var lead = hello + ' I’ve read your ' + T.plural(s.total, 'entry', 'entries') + ' across ' + T.plural(s.projects, 'project') + '.';
    var html = '<p>' + lead + (ins.length ? ' Here’s what stands out:' : '') + '</p>' +
      (ins.length ? '<ul class="msg-ins">' + ins.map(function (x) {
        return '<li class="tone-' + x.tone + '"' + (x.query ? ' data-ask="' + esc(x.query) + '"' : '') + '><b>' + esc(x.title) + '</b><span>' + x.html + '</span></li>';
      }).join('') + '</ul>' : '') +
      '<p class="muted">Ask me anything in plain words, or capture something: “remind me to send the deck on Friday at 9am”.</p>' +
      chips(I.tips().map(function (t) { return t.query; }));
    reply(html, 500);
  }

  // ---------- commands ----------
  A.ask = function (text) {
    asked.add(T.norm(text));
    push('me', esc(text));
    var n = T.norm(text).trim();
    var m;

    if (/^(help|\?|what can you do|how do (i|you) (use|work)( this)?|tips?)\b/.test(n)) return reply(helpReply());
    if (/^(brief me|briefing|summary|summari[sz]e|what('?s| is) important|what needs (my )?attention|status report|morning brief|anything i should know)/.test(n)) return reply(briefing());
    if (/^(dark|light)( mode| theme)?$|^(switch|change) to (dark|light)/.test(n)) {
      var th = /dark/.test(n) ? 'dark' : 'light'; Metis.setTheme(th);
      return reply('<p>Switched to ' + th + ' mode.</p>', 200);
    }
    if (/^(enable|turn on|allow) (desktop |system )?notifications?/.test(n)) { enableNotifications(); return; }
    if (/^export\b|^(show|copy) (my )?(local|saved)/.test(n)) return reply(exportReply());

    if ((m = text.match(/^\s*(?:remind me(?: to)?|reminder:?|add (?:a )?reminder(?: to)?|don'?t let me forget(?: to)?)\s+(.+)$/i))) return reply(captureReminder(m[1]));
    if ((m = text.match(/^\s*(?:note|jot(?: down)?|remember(?: that)?|idea):?\s+(.+)$/i))) return reply(captureNote(m[1], 'note'));
    if ((m = text.match(/^\s*(?:log|update|status|done|finished|completed|shipped):?\s+(.+)$/i))) {
      var prefix = text.trim().split(/[\s:]/)[0].toLowerCase();
      return reply(captureNote(m[1], 'update', /done|finished|completed|shipped/.test(prefix) ? 'done' : null));
    }
    return reply(searchReply(text));
  };

  function searchReply(q) {
    var res = Metis.query.run(q);
    if (res.answer && res.answer.kind === 'help') return helpReply();
    var h = '<p>' + (res.answer ? res.answer.html : '') + '</p>';
    if (res.didYouMean) h += '<p class="muted">Did you mean <button class="link" data-ask="' + esc(res.didYouMean) + '">' + esc(res.didYouMean) + '</button>?</p>';
    if (res.agg) h += '<div class="msg-vis">' + V.aggVisual(res.agg) + '</div>';
    var rows = res.items.slice(0, res.agg ? 0 : 4);
    if (res.projects.length && !rows.length) rows = [];
    if (res.projects.length) h += '<ul class="msg-list">' + res.projects.slice(0, 3).map(function (p) {
      return '<li data-project="' + esc(p.key) + '">' + V.icon('folder') + '<span>' + esc(p.name) + '</span><small>' + (p.progress != null ? Math.round(p.progress) + '%' : '') + '</small></li>';
    }).join('') + '</ul>';
    if (rows.length) h += '<ul class="msg-list">' + rows.map(function (x) {
      var e = x.entry, sub = e.type === 'reminder' ? Metis.reminders.state(e).label : e.type === 'metric' ? T.fmt(e.metric.value, e.metric.unit) : e.date ? D.relative(e.date) : '';
      return '<li data-open="' + esc(e.id) + '">' + V.typeIcon(e.type) + '<span>' + esc(e.title) + '</span><small>' + esc(sub) + '</small></li>';
    }).join('') + '</ul>';
    if (res.items.length > 4 || res.agg) h += '<button class="msg-cta" data-dash="' + esc(q) + '">Show ' + (res.agg ? 'it' : 'all ' + res.items.length) + ' on the dashboard ' + V.icon('arrow') + '</button>';
    h += chips(followUps(res));
    return h;
  }

  function followUps(res) {
    var it = res.intent, out = [];
    if (res.agg) {
      var an = res.agg.entry.table.analysis;
      if (res.agg.op !== 'trend' && an.ordered && res.agg.column) out.push(res.agg.column.toLowerCase() + ' trend');
      if (an.catIdx.length && res.agg.byIdx < 0 && res.agg.column) out.push(res.agg.column.toLowerCase() + ' by ' + an.columns[an.catIdx[0]].name.toLowerCase());
      if (res.agg.op !== 'avg' && res.agg.column) out.push('average ' + res.agg.column.toLowerCase());
    }
    if (it.projects.length) { var p = S.projectByKey.get(it.projects[0]); if (p) { out.push(p.name + ' reminders'); out.push(p.name + ' blocked'); } }
    if (it.types.indexOf('reminder') >= 0) out.push('what’s overdue', 'reminders next month');
    if (it.types.indexOf('update') >= 0) out.push('done this week', 'blocked updates');
    return out.concat(I.tips().map(function (t) { return t.query; }));
  }

  function helpReply() {
    return '<p>Here’s what I can do — all on your device:</p><ul class="help-list">' +
      '<li><b>Find</b> — “Apollo updates last week”, “anything about invoices”, “Dana”</li>' +
      '<li><b>Dates</b> — “what’s due tomorrow”, “reminders next 14 days”, “done in September”, “overdue”</li>' +
      '<li><b>Math on tables</b> — “total revenue”, “spend by team”, “top 3 sprints by bugs”, “revenue trend”</li>' +
      '<li><b>Briefing</b> — “brief me”, “what needs my attention”</li>' +
      '<li><b>Capture</b> — “remind me to renew the domain on Nov 3”, “note: idea for onboarding”, “done: sent the Q3 deck”</li>' +
      '<li><b>Other</b> — “dark mode”, “enable notifications”, “export” (copy what you captured here so it can go into /data)</li></ul>' +
      chips(I.tips().map(function (t) { return t.query; }));
  }

  function briefing() {
    var ins = I.list();
    if (!ins.length) return '<p>All quiet — nothing urgent, nothing off target.</p>';
    return '<p>Here’s your briefing:</p><ul class="msg-ins">' + ins.slice(0, 7).map(function (x) {
      return '<li class="tone-' + x.tone + '"' + (x.query ? ' data-ask="' + esc(x.query) + '"' : '') + '><b>' + esc(x.title) + '</b><span>' + x.html + '</span></li>';
    }).join('') + '</ul>' + chips(['what’s due this week', 'what did I finish last week']);
  }

  function captureReminder(body) {
    var low = T.norm(body);
    var when = D.findWhen(low);
    var title = body;
    if (when) {
      // remove the date/time words from the title (spans are positions in `low`, same length as body)
      var chars = body.split('');
      when.spans.forEach(function (sp) { for (var i = sp[0]; i < sp[1]; i++) chars[i] = ' '; });
      title = chars.join('').replace(/\s+(on|at|by|in|for|this|next)\s*$/i, '').replace(/\s+/g, ' ').trim();
    }
    title = title.replace(/^to\s+/i, '').replace(/[.\s]+$/, '');
    title = T.cap(title);
    if (!when) {
      return '<p>When should I remind you about “' + esc(title) + '”? Try adding a date — for example:</p>' +
        chips(['remind me to ' + title.toLowerCase() + ' tomorrow at 9am', 'remind me to ' + title.toLowerCase() + ' on Friday', 'remind me to ' + title.toLowerCase() + ' in 2 weeks']);
    }
    var proj = detectProject(body);
    var raw = { type: 'reminder', title: title, due: D.iso(when.date), notify: 1, keywords: ['captured'] };
    if (when.time) raw.time = when.time;
    if (proj) raw.project = proj.name;
    var e = S.addLocal(raw);
    return '<p>Got it — I’ll remind you to <b>' + esc(title.charAt(0).toLowerCase() + title.slice(1)) + '</b> ' + esc(D.relative(when.date)) +
      (when.time ? ' at ' + esc(when.time) : '') + ' (' + esc(D.fmt(when.date, 'day')) + ').</p>' +
      '<p class="muted">Saved in this browser. Say “export” to copy it into your data files.</p>' +
      '<div class="msg-actions"><button class="btn sm ghost" data-open="' + esc(e.id) + '">Open</button><button class="btn sm ghost" data-undo-local="' + esc(e.id) + '">Undo</button></div>';
  }

  function captureNote(body, type, status) {
    var proj = detectProject(body);
    var raw = { type: type, text: body.trim(), date: D.iso(D.today()), keywords: ['captured'] };
    if (proj) raw.project = proj.name;
    if (status) raw.status = status;
    var e = S.addLocal(raw);
    return '<p>' + (type === 'update' ? 'Logged' : 'Noted') + (proj ? ' under <b>' + esc(proj.name) + '</b>' : '') + ': “' + esc(e.title) + '”.' +
      (e.status ? ' Status: ' + V.status(e.status) : '') + '</p>' +
      (e.autoKeywords.length ? '<p class="muted">Keywords I picked up: ' + e.autoKeywords.slice(0, 5).map(esc).join(', ') + '</p>' : '') +
      '<div class="msg-actions"><button class="btn sm ghost" data-open="' + esc(e.id) + '">Open</button><button class="btn sm ghost" data-undo-local="' + esc(e.id) + '">Undo</button></div>';
  }

  function detectProject(text) {
    var n = ' ' + T.norm(text) + ' ';
    return S.projects.slice().sort(function (a, b) { return b.name.length - a.name.length; }).find(function (p) {
      return [p.name].concat(p.aliases).some(function (a) { return a && n.indexOf(' ' + T.norm(a) + ' ') >= 0 || n.indexOf(' ' + T.norm(a) + ',') >= 0 || n.indexOf(' ' + T.norm(a) + '.') >= 0; });
    }) || null;
  }

  function exportReply() {
    var list = Metis.storage.get('local', []);
    if (!list.length) return '<p>Nothing captured in this browser yet. Things you add with “remind me…”, “note:…” or “log:…” land here.</p>';
    var js = 'Metis.add(\n' + list.map(function (r) {
      var c = {}; Object.keys(r).forEach(function (k) { if (k !== 'id' && k !== 'created') c[k] = r[k]; });
      return '  ' + JSON.stringify(c);
    }).join(',\n') + '\n);';
    return '<p>' + T.plural(list.length, 'item') + ' captured here. Paste this into a file in <code>/data</code> (or hand it to Claude) to make it permanent:</p>' +
      '<pre class="code">' + esc(js) + '</pre><div class="msg-actions"><button class="btn sm" data-copy>Copy</button></div>';
  }

  function enableNotifications() {
    if (!('Notification' in window)) { push('bot', '<p>This browser doesn’t support system notifications — the in-page banners will still pop up.</p>'); return; }
    Notification.requestPermission().then(function (p) {
      push('bot', p === 'granted' ? '<p>Notifications are on. Reminders will also appear as system notifications while this tab is open.</p>' : '<p>Notifications weren’t allowed. In-page banners will still show.</p>');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
