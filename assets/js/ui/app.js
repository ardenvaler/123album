/*
 * App controller: landing (control center), search, results, detail sheet,
 * reminder banners, theme, ambient motion, CSV drop.
 */
(function () {
  'use strict';
  var T = Metis.text, D = Metis.dates, V = Metis.view, C = Metis.charts, S = Metis.store, R = Metis.reminders, I = Metis.insights;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = T.esc;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var el = {};
  var state = { query: '', run: null, filter: 'all', sheetFor: null, dismissed: new Set(), sugIdx: -1 };

  // ======================================================================
  // Boot
  // ======================================================================
  function boot() {
    ['q', 'searchForm', 'understood', 'suggest', 'quickChips', 'bento', 'stage', 'results', 'answer', 'resultGroups', 'greeting', 'todayLine', 'subhead',
      'sheet', 'sheetBody', 'sheetBackdrop', 'sheetClose', 'banners', 'drop', 'tip', 'clearBtn', 'themeBtn', 'browseBtn', 'footStats', 'hero', 'bellBtn', 'bellN']
      .forEach(function (id) { el[id] = document.getElementById(id); });

    try { S.build(); } catch (err) { console.error(err); }
    R.start();

    renderHeader();
    renderLanding();
    bindSearch();
    bindGlobal();
    bindAmbient();
    bindDrop();
    placeholderLoop();
    revealObserver();

    Metis.on('change', function () { renderHeader(); renderLanding(); if (state.query) runSearch(state.query, true); if (state.sheetFor) reopenSheet(); });
    Metis.on('reminders', function () { renderBanners(); if (!state.query) renderNextUp(); });

    setInterval(function () { renderHeader(); }, 60 * 1000);
    applyHash();
    window.addEventListener('hashchange', applyHash);
    requestAnimationFrame(function () { document.body.classList.add('ready'); });
  }

  // ======================================================================
  // Theme
  // ======================================================================
  function currentTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function setTheme(t, origin) {
    var applied = false;
    var apply = function () {
      if (applied) return; applied = true;
      document.documentElement.setAttribute('data-theme', t);
      try { localStorage.setItem('metis.theme', t); } catch (e) {}
    };
    if (!document.startViewTransition || reduceMotion) return apply();
    var x = origin ? origin.x : innerWidth / 2, y = origin ? origin.y : 0;
    var r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.documentElement.classList.add('theme-anim');
    var vt = document.startViewTransition(apply);
    vt.ready.catch(function () {});
    vt.ready.then(function () {
      document.documentElement.animate(
        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 650, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' });
    });
    var done = function () { document.documentElement.classList.remove('theme-anim'); };
    vt.finished.then(done, done);
    // Safety net: never leave the theme unapplied if the browser stalls the transition
    setTimeout(function () { if (!applied) { apply(); try { vt.skipTransition(); } catch (e) {} } }, 350);
    setTimeout(done, 1200);
  }
  Metis.setTheme = function (t) { setTheme(t === 'toggle' ? (currentTheme() === 'dark' ? 'light' : 'dark') : t); };

  // ======================================================================
  // Header / greeting
  // ======================================================================
  function renderHeader() {
    var n = D.now(), h = n.getHours();
    var greet = h < 5 ? 'Still up?' : h < 12 ? 'Good morning.' : h < 18 ? 'Good afternoon.' : h < 22 ? 'Good evening.' : 'Working late?';
    el.greeting.textContent = greet;
    el.todayLine.textContent = n.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + ' · ' + n.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    var s = I.summary(), bits = [];
    if (s.overdue) bits.push('<b>' + s.overdue + ' overdue</b>');
    if (s.today) bits.push('<b>' + s.today + '</b> due today');
    if (s.week) bits.push(s.week + ' coming up this week');
    if (!bits.length && s.activeProjects) bits.push(T.plural(s.activeProjects, 'active project') + ', all calm');
    el.subhead.innerHTML = bits.length ? bits.join(' · ') + '.' : 'Everything is quiet. Add data in <code>/data</code> to get started.';
    el.footStats.textContent = T.plural(s.total, 'entry', 'entries') + ' · ' + T.plural(s.projects, 'project') + ' · searched entirely in your browser';
  }

  // ======================================================================
  // Landing — control center bento
  // ======================================================================
  function renderLanding() {
    var s = I.summary();
    var tiles = [
      tile('next', 'tile-next', nextUpHTML()),
      tile('insight', 'tile-insight', insightHTML()),
      tile('week', 'tile-week', weekHTML(s)),
      tile('projects', 'tile-projects', projectsHTML()),
      tile('updates', 'tile-updates', updatesHTML()),
      tile('metrics', 'tile-metrics', metricsHTML()),
      tile('data', 'tile-data', dataHTML())
    ];
    var again = el.bento.children.length > 0;
    el.bento.innerHTML = tiles.join('');
    $$('.tile', el.bento).forEach(function (t, i) { t.style.setProperty('--i', i); if (again) t.classList.add('in', 'static'); });
    countUp(el.bento);
    startInsightRotation();
    renderQuickChips();
    revealObserver();
  }
  function tile(name, cls, inner) { return '<section class="tile ' + cls + '" data-tile="' + name + '">' + inner + '</section>'; }

  function nextUpHTML() {
    var all = R.all().filter(function (x) { return !x.done && x.state !== 'waiting' && x.state !== 'none'; });
    var urgent = all.filter(function (x) { return x.state === 'overdue' || x.state === 'now' || x.state === 'triggered'; });
    var next = R.next();
    var head = '<header class="tile-head"><span class="tile-label">' + V.icon('bell') + 'Next up</span>' +
      (urgent.length ? '<span class="badge-critical">' + urgent.length + ' need' + (urgent.length === 1 ? 's' : '') + ' you</span>' : '') + '</header>';
    if (!next && !urgent.length) return head + '<div class="empty-tile"><p class="big-quiet">Nothing scheduled.</p><p class="muted">Reminders you send me, or tell the assistant “remind me to … on Friday”.</p></div>';
    var feat = urgent[0] || next;
    var occ = feat.occ, days = feat.days;
    var ring = '';
    if (occ && days != null) {
      var frac = days <= 0 ? 1 : Math.max(0.06, 1 - days / Math.max(feat.entry.reminder.notify * 2, 14));
      ring = '<div class="countdown st-' + feat.state + '">' + C.ring(frac, { size: 132, stroke: 9, cls: 'cd' }) +
        '<div class="cd-in"><b>' + (days < 0 ? Math.abs(days) : days === 0 ? (feat.entry.reminder.time || 'Now') : days) + '</b><small>' +
        (days < 0 ? (Math.abs(days) === 1 ? 'day late' : 'days late') : days === 0 ? 'today' : days === 1 ? 'day left' : 'days left') + '</small></div></div>';
    } else ring = '<div class="countdown st-' + feat.state + '"><div class="cd-bolt">' + V.icon('bolt') + '</div></div>';
    var rest = all.filter(function (x) { return x.entry !== feat.entry; }).slice(0, 3);
    return head +
      '<div class="next-feature" data-open="' + esc(feat.entry.id) + '" tabindex="0">' + ring +
      '<div class="next-copy"><p class="next-state st-' + feat.state + '">' + esc(feat.label) + '</p><h3>' + esc(feat.entry.title) + '</h3>' +
      (feat.entry.text ? '<p class="muted clamp2">' + esc(feat.entry.text) + '</p>' : '') + '</div></div>' +
      (rest.length ? '<ul class="next-list">' + rest.map(function (x) {
        return '<li data-open="' + esc(x.entry.id) + '" tabindex="0"><span class="nl-dot st-' + x.state + '"></span><span class="nl-t">' + esc(x.entry.title) + '</span><span class="nl-d">' + esc(x.label) + '</span></li>';
      }).join('') + '</ul>' : '') +
      '<button class="tile-more" data-q="reminders next 30 days">All reminders ' + V.icon('arrow') + '</button>';
  }
  function renderNextUp() {
    var t = $('[data-tile="next"]', el.bento);
    if (t) t.innerHTML = nextUpHTML();
  }

  var insightList = [], insightIdx = 0, insightTimer = null;
  function insightHTML() {
    insightList = I.list();
    var head = '<header class="tile-head"><span class="tile-label"><span class="orb xs" aria-hidden="true"><i></i><i></i><i></i></span>Metis noticed</span>' +
      (insightList.length > 1 ? '<span class="dots" role="tablist">' + insightList.slice(0, 6).map(function (_, i) { return '<button class="dotbtn' + (i === 0 ? ' on' : '') + '" data-insight="' + i + '" aria-label="Insight ' + (i + 1) + '"></button>'; }).join('') + '</span>' : '') + '</header>';
    if (!insightList.length) return head + '<p class="muted">Add some data and I’ll point out what matters.</p>';
    return head + '<div class="insight-stage">' + insightCard(insightList[0]) + '</div>';
  }
  function insightCard(x) {
    return '<div class="insight tone-' + x.tone + '"' + (x.query ? ' data-q="' + esc(x.query) + '"' : x.open ? ' data-open="' + esc(x.open) + '"' : '') + ' tabindex="0">' +
      '<span class="insight-ic">' + V.icon(x.icon) + '</span><h3>' + esc(x.title) + '</h3><p>' + x.html + '</p>' +
      (x.query || x.open ? '<span class="insight-go">' + (x.query ? 'Show me' : 'Open') + ' ' + V.icon('arrow') + '</span>' : '') + '</div>';
  }
  function showInsight(i) {
    var stage = $('.insight-stage', el.bento); if (!stage || !insightList.length) return;
    insightIdx = (i + Math.min(insightList.length, 6)) % Math.min(insightList.length, 6);
    var old = stage.firstElementChild;
    var wrap = document.createElement('div'); wrap.innerHTML = insightCard(insightList[insightIdx]);
    var nu = wrap.firstElementChild; nu.classList.add('enter');
    if (old) { old.classList.add('leave'); setTimeout(function () { old.remove(); }, 450); }
    stage.appendChild(nu);
    requestAnimationFrame(function () { requestAnimationFrame(function () { nu.classList.remove('enter'); }); });
    $$('.dotbtn', el.bento).forEach(function (d, k) { d.classList.toggle('on', k === insightIdx); });
  }
  function startInsightRotation() {
    clearInterval(insightTimer);
    insightIdx = 0;
    if (reduceMotion || insightList.length < 2) return;
    insightTimer = setInterval(function () {
      var t = $('[data-tile="insight"]', el.bento);
      if (document.hidden || state.query || (t && t.matches(':hover'))) return;
      showInsight(insightIdx + 1);
    }, 6500);
  }

  function weekHTML(s) {
    var cells = [
      ['Updates', s.updatesWeek, 'updates this week'],
      ['Wins', s.doneWeek, 'done this week'],
      ['Due soon', s.week, 'reminders next 7 days'],
      ['Projects', s.activeProjects, 'projects']
    ];
    return '<header class="tile-head"><span class="tile-label">' + V.icon('calendar') + 'This week</span></header>' +
      '<div class="week-grid">' + cells.map(function (c) {
        return '<button class="wk" data-q="' + esc(c[2]) + '"><b data-count="' + c[1] + '">' + c[1] + '</b><small>' + c[0] + '</small></button>';
      }).join('') + '</div>';
  }

  function projectsHTML() {
    var ps = S.projects.slice(0, 5);
    var head = '<header class="tile-head"><span class="tile-label">' + V.icon('folder') + 'Projects</span><button class="tile-link" data-q="projects">See all</button></header>';
    if (!ps.length) return head + '<p class="muted">Projects appear here as soon as an update or reminder mentions one.</p>';
    return head + '<ul class="proj-list">' + ps.map(function (p) {
      var prog = p.progress != null ? Math.round(p.progress) : null;
      var st = p.status ? S.STATUS[p.status] : null;
      return '<li data-project="' + esc(p.key) + '" tabindex="0"><div class="pl-top"><span class="pl-name">' + esc(p.name) + '</span>' +
        (st ? '<span class="pill tone-' + st.tone + ' sm"><i class="pill-dot"></i>' + esc(st.label) + '</span>' : '') + '</div>' +
        '<div class="pl-bar"><i style="--w:' + (prog != null ? prog : 0) + '%" class="tone-' + (st ? st.tone : 'info') + '"></i></div>' +
        '<div class="pl-meta"><span>' + (prog != null ? prog + '%' : '') + '</span><span>' + (p.lastDate ? esc(D.relative(p.lastDate)) : '') + '</span></div></li>';
    }).join('') + '</ul>';
  }

  function updatesHTML() {
    var ups = S.entries.filter(function (e) { return e.type === 'update' || e.type === 'note'; }).sort(function (a, b) { return (b.date || 0) - (a.date || 0); }).slice(0, 4);
    var head = '<header class="tile-head"><span class="tile-label">' + V.icon('pulse') + 'Latest</span><button class="tile-link" data-q="recent updates">More</button></header>';
    if (!ups.length) return head + '<p class="muted">Status updates and notes on your work will appear here, newest first.</p>';
    return head + '<ol class="feed">' + ups.map(function (e) {
      var tone = e.status ? S.STATUS[e.status].tone : 'neutral';
      return '<li data-open="' + esc(e.id) + '" tabindex="0"><span class="feed-dot tone-' + tone + '"></span><div><p class="feed-t clamp2">' + esc(e.text || e.title) + '</p>' +
        '<p class="feed-m">' + (e.project ? esc(e.project) + ' · ' : '') + esc(D.relative(e.date)) + '</p></div></li>';
    }).join('') + '</ol>';
  }

  function metricsHTML() {
    var ms = S.entries.filter(function (e) { return e.type === 'metric'; }).sort(function (a, b) { return (b.pinned - a.pinned) || (b.date || 0) - (a.date || 0); }).slice(0, 4);
    var head = '<header class="tile-head"><span class="tile-label">' + V.icon('gauge') + 'Key numbers</span><button class="tile-link" data-q="metrics">All</button></header>';
    if (!ms.length) return head + '<p class="muted">Quick numbers and datapoints show here with their trend and target.</p>';
    return head + '<div class="metric-grid">' + ms.map(function (e) {
      var m = e.metric;
      return '<div class="mt" data-open="' + esc(e.id) + '" tabindex="0"><small>' + esc(e.title) + '</small>' +
        '<div class="mt-v"><b data-count="' + (m.value != null ? m.value : '') + '" data-unit="' + esc(m.unit || '') + '">' + T.fmt(m.value, m.unit) + '</b>' + V.delta(m) + '</div>' +
        (m.history.length > 1 ? '<div class="mt-spark s1">' + C.sparkline(m.history, { w: 160, h: 34 }) + '</div>' : '') +
        (m.target != null ? '<span class="mt-target">' + (m.onTarget ? V.tonePill('good', 'On target') : V.tonePill('serious', 'Off target')) + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  }

  function dataHTML() {
    var tables = S.entries.filter(function (e) { return e.type === 'table'; }).sort(function (a, b) { return (b.date || 0) - (a.date || 0); });
    var head = '<header class="tile-head"><span class="tile-label">' + V.icon('grid') + 'Data</span><button class="tile-link" data-q="tables">' + tables.length + ' table' + (tables.length === 1 ? '' : 's') + '</button></header>';
    if (!tables.length) return head + '<p class="muted">Tables get a quick analysis here. You can also drop a CSV file anywhere on the page.</p>';
    var e = tables[0], an = e.table.analysis, P = an.primaryIdx >= 0 ? an.columns[an.primaryIdx] : null;
    return head + '<div class="data-feature" data-open="' + esc(e.id) + '" tabindex="0"><h3>' + esc(e.title) + '</h3>' +
      (P ? '<div class="data-hero"><b data-count="' + (P.additive ? P.sum : P.mean) + '" data-unit="' + esc(P.unit || (P.money ? '$' : '')) + '">' + T.fmt(P.additive ? P.sum : P.mean, P.unit || (P.money ? '$' : '')) + '</b><small>' + (P.additive ? 'total ' : 'avg ') + esc(P.name.toLowerCase()) + '</small></div>' +
        '<div class="data-spark s1">' + C.sparkline(P.series, { w: 260, h: 56 }) + '</div>' : '') +
      '<p class="muted clamp2">' + (an.insights[2] || an.insights[1] || an.insights[0] || { text: '' }).text + '</p></div>' +
      (tables.length > 1 ? '<ul class="data-more">' + tables.slice(1, 3).map(function (t) { return '<li data-open="' + esc(t.id) + '" tabindex="0">' + V.icon('grid') + esc(t.title) + '</li>'; }).join('') + '</ul>' : '');
  }

  function renderQuickChips() {
    var tips = I.tips().slice(0, 5);
    el.quickChips.innerHTML = tips.map(function (t, i) { return '<button class="chip" data-q="' + esc(t.query) + '" style="--i:' + i + '">' + esc(t.text) + '</button>'; }).join('');
  }

  // ======================================================================
  // Search
  // ======================================================================
  var liveTimer = null;
  function bindSearch() {
    el.q.addEventListener('input', function () {
      var v = el.q.value;
      document.body.classList.toggle('has-query', !!v);
      renderUnderstood(v);
      renderSuggest(v);
      clearTimeout(liveTimer);
      if (v.trim().length >= 2) liveTimer = setTimeout(function () { runSearch(v, true); }, 220);
      else if (!v.trim()) goHome(true);
    });
    el.q.addEventListener('keydown', function (ev) {
      var items = $$('.sug', el.suggest);
      if (ev.key === 'ArrowDown' && items.length) { ev.preventDefault(); state.sugIdx = Math.min(items.length - 1, state.sugIdx + 1); markSug(items); }
      else if (ev.key === 'ArrowUp' && items.length) { ev.preventDefault(); state.sugIdx = Math.max(-1, state.sugIdx - 1); markSug(items); }
      else if (ev.key === 'Escape') { ev.preventDefault(); if (el.suggest.classList.contains('open')) closeSuggest(); else { el.q.value = ''; goHome(); el.q.blur(); } }
      else if (ev.key === 'Tab' && state.sugIdx >= 0 && items[state.sugIdx]) { ev.preventDefault(); el.q.value = items[state.sugIdx].dataset.sug; el.q.dispatchEvent(new Event('input')); }
    });
    el.searchForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var items = $$('.sug', el.suggest);
      if (state.sugIdx >= 0 && items[state.sugIdx]) el.q.value = items[state.sugIdx].dataset.sug;
      closeSuggest();
      commit(el.q.value);
    });
    el.q.addEventListener('focus', function () { document.body.classList.add('search-focus'); if (el.q.value) renderSuggest(el.q.value); });
    el.q.addEventListener('blur', function () { document.body.classList.remove('search-focus'); setTimeout(closeSuggest, 150); });
    el.clearBtn.addEventListener('click', function () { el.q.value = ''; goHome(); el.q.focus(); });
  }

  function markSug(items) { items.forEach(function (it, i) { it.classList.toggle('on', i === state.sugIdx); }); }
  function closeSuggest() { el.suggest.classList.remove('open'); state.sugIdx = -1; }

  function renderSuggest(v) {
    var list = Metis.query.suggest(v, 6);
    state.sugIdx = -1;
    if (!list.length) { closeSuggest(); el.suggest.innerHTML = ''; return; }
    var icons = { project: 'folder', table: 'grid', metric: 'gauge', reminder: 'bell', math: 'sparkle', keyword: 'tag', suggestion: 'sparkle' };
    el.suggest.innerHTML = list.map(function (p) {
      return '<button type="button" class="sug" data-sug="' + esc(p.text) + '">' + V.icon(icons[p.kind] || 'sparkle') + '<span>' + highlight(p.text, v) + '</span><small>' + esc(p.kind === 'math' ? 'calculate' : p.kind) + '</small></button>';
    }).join('');
    el.suggest.classList.add('open');
  }
  function highlight(text, q) {
    var i = T.norm(text).indexOf(T.norm(q).trim());
    if (i < 0 || !q.trim()) return esc(text);
    var n = q.trim().length;
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + n)) + '</mark>' + esc(text.slice(i + n));
  }

  function renderUnderstood(v) {
    if (!v.trim()) { el.understood.innerHTML = ''; return; }
    var it = Metis.query.parse(v);
    var chips = [];
    it.types.forEach(function (t) { chips.push(['type', t === 'project' ? 'Projects' : S.TYPES[t].plural]); });
    if (it.range) chips.push(['time', it.range.label]);
    it.status.forEach(function (s) { chips.push(['status', S.STATUS[s].label]); });
    it.projects.forEach(function (k) { var p = S.projectByKey.get(k); if (p) chips.push(['project', p.name]); });
    if (it.op) chips.push(['op', { sum: 'Total', avg: 'Average', max: it.n ? 'Top ' + it.n : 'Highest', min: it.n ? 'Bottom ' + it.n : 'Lowest', trend: 'Trend', median: 'Median' }[it.op]]);
    if (it.by) chips.push(['op', 'by ' + it.by]);
    if (it.count) chips.push(['op', 'Count']);
    el.understood.innerHTML = chips.map(function (c, i) { return '<span class="u-chip u-' + c[0] + '" style="--i:' + i + '">' + esc(c[1]) + '</span>'; }).join('');
  }

  function commit(q) {
    q = (q || '').trim();
    if (!q) { goHome(); return; }
    var h = '#q=' + encodeURIComponent(q);
    if (location.hash !== h) history.pushState(null, '', h);
    runSearch(q);
  }

  function withTransition(fn) {
    if (document.startViewTransition && !reduceMotion && !document.documentElement.classList.contains('theme-anim')) document.startViewTransition(fn);
    else fn();
  }

  function runSearch(q, live) {
    var res;
    try { res = Metis.query.run(q); } catch (err) { console.error(err); return; }
    var wasSearching = document.body.classList.contains('searching');
    state.query = q; state.run = res; state.filter = 'all';
    var draw = function () {
      document.body.classList.add('searching', 'has-query');
      el.stage.hidden = true; el.results.hidden = false;
      renderResults(res);
    };
    if (!wasSearching && !live) withTransition(draw); else draw();
    if (!live) closeSuggest();
    if (el.q.value !== q && !live) { el.q.value = q; renderUnderstood(q); }
  }
  Metis.search = function (q) { el.q.value = q; renderUnderstood(q); commit(q); window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); };

  function goHome(soft) {
    state.query = ''; state.run = null;
    if (!soft && location.hash) history.pushState(null, '', location.pathname + location.search);
    el.understood.innerHTML = ''; closeSuggest();
    if (!document.body.classList.contains('searching')) return;
    withTransition(function () {
      document.body.classList.remove('searching', 'has-query');
      el.results.hidden = true; el.stage.hidden = false;
      el.bento.innerHTML = '';
      renderLanding();
    });
  }

  function renderResults(res) {
    var a = res.answer || { html: '' };
    var chipsHTML = res.chips.filter(function (c) { return c.kind !== 'term'; }).map(function (c) { return '<span class="u-chip u-' + c.kind + '">' + esc(c.label) + '</span>'; }).join('');
    el.answer.innerHTML =
      '<div class="answer-card kind-' + a.kind + '"><span class="orb md" aria-hidden="true"><i></i><i></i><i></i></span><div class="answer-body">' +
      '<p class="answer-text">' + a.html + '</p>' +
      (res.didYouMean ? '<p class="dym">Did you mean <button class="link" data-q="' + esc(res.didYouMean) + '">' + esc(res.didYouMean) + '</button>?</p>' : '') +
      (res.agg ? '<div class="agg-vis">' + V.aggVisual(res.agg) + '</div>' : '') +
      (chipsHTML ? '<div class="answer-chips">' + chipsHTML + '</div>' : '') +
      (a.kind === 'empty' ? '<div class="answer-tips">' + I.tips().slice(0, 4).map(function (t) { return '<button class="chip sm" data-q="' + esc(t.query) + '">' + esc(t.text) + '</button>'; }).join('') + '</div>' : '') +
      '</div></div>';

    var items = res.items, counts = {};
    items.forEach(function (x) { counts[x.entry.type] = (counts[x.entry.type] || 0) + 1; });
    var types = Object.keys(counts);
    var h = '';
    if (res.projects.length) h += '<div class="group"><h3 class="group-title">Projects</h3><div class="grid">' + res.projects.map(V.projectCard).join('') + '</div></div>';
    if (items.length) {
      h += '<div class="group"><div class="group-head"><h3 class="group-title">' + (res.agg ? 'Source' : T.plural(items.length, 'result')) + '</h3>' +
        (types.length > 1 ? '<div class="seg" role="tablist"><button class="on" data-filter="all">All</button>' + types.map(function (t) {
          return '<button data-filter="' + t + '">' + esc(S.TYPES[t] ? S.TYPES[t].plural : t) + ' <small>' + counts[t] + '</small></button>';
        }).join('') + '</div>' : '') + '</div>' +
        '<div class="grid" id="resultGrid">' + items.slice(0, 60).map(function (x, i) { return V.card(x.entry, i); }).join('') + '</div></div>';
    }
    el.resultGroups.innerHTML = h;
    countUp(el.results);
  }

  function filterResults(type) {
    state.filter = type;
    $$('[data-filter]', el.resultGroups).forEach(function (b) { b.classList.toggle('on', b.dataset.filter === type); });
    var items = state.run.items.filter(function (x) { return type === 'all' || x.entry.type === type; });
    var g = $('#resultGrid'); if (g) g.innerHTML = items.slice(0, 60).map(function (x, i) { return V.card(x.entry, i); }).join('');
    countUp(el.results);
  }

  // ======================================================================
  // Sheet
  // ======================================================================
  function openSheet(html, key) {
    state.sheetFor = key;
    el.sheetBody.innerHTML = html;
    el.sheet.hidden = false; el.sheetBackdrop.hidden = false;
    el.sheet.scrollTop = 0;
    requestAnimationFrame(function () { document.body.classList.add('sheet-open'); });
    countUp(el.sheetBody);
    el.sheetClose.focus({ preventScroll: true });
  }
  function closeSheet() {
    document.body.classList.remove('sheet-open');
    state.sheetFor = null;
    setTimeout(function () { if (!document.body.classList.contains('sheet-open')) { el.sheet.hidden = true; el.sheetBackdrop.hidden = true; } }, reduceMotion ? 0 : 380);
    if (/^#open=/.test(location.hash)) history.pushState(null, '', state.query ? '#q=' + encodeURIComponent(state.query) : location.pathname + location.search);
  }
  function openEntry(id) {
    var e = S.byId.get(id); if (!e) return;
    openSheet(V.sheet(e), { entry: id });
  }
  function openProject(key) {
    var p = S.projectByKey.get(key); if (!p) return;
    openSheet(V.projectSheet(p), { project: key });
  }
  function reopenSheet() {
    var k = state.sheetFor; if (!k) return;
    if (k.entry && S.byId.get(k.entry)) el.sheetBody.innerHTML = V.sheet(S.byId.get(k.entry));
    else if (k.project && S.projectByKey.get(k.project)) el.sheetBody.innerHTML = V.projectSheet(S.projectByKey.get(k.project));
    else closeSheet();
  }
  Metis.open = openEntry;

  // ======================================================================
  // Reminder banners
  // ======================================================================
  var tuckTimer = null;
  function renderBanners() {
    var all = R.alerts();
    state.seen = state.seen || new Set();
    // A brand-new alert (e.g. a time just passed) pops out again even if the stack was tucked away
    if (all.some(function (x) { return !state.seen.has(x.key); })) state.tucked = false;
    all.forEach(function (x) { state.seen.add(x.key); });
    el.bellN.textContent = all.length || '';
    el.bellBtn.classList.toggle('has', all.length > 0);
    var alerts = all.filter(function (s) { return !state.dismissed.has(s.key) && !state.tucked; });
    var keep = new Set(alerts.slice(0, 3).map(function (s) { return s.key; }));
    $$('.banner', el.banners).forEach(function (b) { if (!keep.has(b.dataset.key)) dismissBanner(b); });
    alerts.slice(0, 3).forEach(function (s, i) {
      var existing = $('.banner[data-key="' + cssEsc(s.key) + '"]', el.banners);
      var html = bannerInner(s);
      if (existing) { if (existing.dataset.state !== s.state) { existing.innerHTML = html; existing.dataset.state = s.state; } return; }
      var b = document.createElement('div');
      b.className = 'banner st-' + s.state; b.dataset.key = s.key; b.dataset.state = s.state; b.dataset.id = s.entry.id;
      b.style.setProperty('--d', (i * 140) + 'ms');
      b.innerHTML = html;
      el.banners.appendChild(b);
      requestAnimationFrame(function () { requestAnimationFrame(function () { b.classList.add('in'); }); });
      scheduleTuck();
    });
    var more = alerts.length - 3, m = $('.banner-more', el.banners);
    if (more > 0) {
      if (!m) { m = document.createElement('button'); m.className = 'banner-more'; el.banners.appendChild(m); }
      m.textContent = '+' + more + ' more reminder' + (more === 1 ? '' : 's'); m.dataset.q = 'overdue reminders';
    } else if (m) m.remove();
  }
  // Banners slide into the bell after a while (like Notification Center); the bell brings them back
  function scheduleTuck() {
    clearTimeout(tuckTimer);
    tuckTimer = setTimeout(function () {
      if (el.banners.matches(':hover') || el.banners.contains(document.activeElement)) return scheduleTuck();
      var bs = $$('.banner:not(.toast)', el.banners);
      if (!bs.length) return;
      state.tucked = true;
      bs.forEach(function (b) { b.classList.add('tuck'); setTimeout(function () { b.remove(); }, 650); });
      var m = $('.banner-more', el.banners); if (m) m.remove();
      setTimeout(function () { el.bellBtn.classList.remove('ring'); void el.bellBtn.offsetWidth; el.bellBtn.classList.add('ring'); }, 450);
    }, innerWidth < 760 ? 5000 : 9000);
  }
  function showBanners() {
    state.tucked = false; state.dismissed.clear();
    renderBanners();
    if (!R.alerts().length) toast('No reminders need you right now.');
  }

  function bannerInner(s) {
    var e = s.entry;
    return '<div class="banner-ic st-' + s.state + '">' + V.icon(s.state === 'triggered' ? 'bolt' : 'bell') + '</div>' +
      '<div class="banner-body" data-open="' + esc(e.id) + '"><div class="banner-top"><span>Reminder</span><span>' + esc(s.label) + '</span></div>' +
      '<strong>' + esc(e.title) + '</strong>' + (s.state === 'triggered' && s.cond ? '<p>' + esc(s.cond.text) + '</p>' : e.text ? '<p>' + esc(e.text) + '</p>' : '') + '</div>' +
      '<div class="banner-actions"><button data-b-done="' + esc(e.id) + '">Done</button><button data-b-snooze="' + esc(e.id) + '">Later</button></div>' +
      '<button class="banner-x" data-b-close="' + esc(s.key) + '" aria-label="Dismiss">' + '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7 7 17"/></svg></button>';
  }
  function dismissBanner(b) {
    b.classList.remove('in'); b.classList.add('out');
    setTimeout(function () { b.remove(); }, 420);
  }
  function cssEsc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/"/g, '\\"'); }

  // ======================================================================
  // Global events (delegated)
  // ======================================================================
  function bindGlobal() {
    document.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-q],[data-open],[data-project],[data-filter],[data-insight],[data-chart-col],[data-sort],[data-rem-done],[data-rem-snooze],[data-rem-undo],[data-b-done],[data-b-snooze],[data-b-close],[data-remove],[data-keep],[data-action]');
      if (!t) return;
      var d = t.dataset;
      if (d.bDone) { R.markDone(S.byId.get(d.bDone)); return; }
      if (d.bSnooze) { R.snooze(S.byId.get(d.bSnooze), 24); return; }
      if (d.bClose) { state.dismissed.add(d.bClose); var b = t.closest('.banner'); if (b) dismissBanner(b); return; }
      if (d.remDone) { R.markDone(S.byId.get(d.remDone)); reopenSheet(); refreshAfterReminder(); return; }
      if (d.remSnooze) { R.snooze(S.byId.get(d.remSnooze), 24); reopenSheet(); refreshAfterReminder(); return; }
      if (d.remUndo) { R.undo(S.byId.get(d.remUndo), d.key); reopenSheet(); refreshAfterReminder(); return; }
      if (d.filter) { filterResults(d.filter); return; }
      if (d.insight != null) { showInsight(+d.insight); return; }
      if (d.chartCol != null) {
        var e = S.byId.get(state.sheetFor && state.sheetFor.entry); if (!e) return;
        $$('[data-chart-col]', el.sheetBody).forEach(function (x) { x.classList.toggle('on', x === t); });
        $('#sheetChart').innerHTML = V.tableChart(e, +d.chartCol); return;
      }
      if (d.sort != null) {
        var e2 = S.byId.get(state.sheetFor && state.sheetFor.entry); if (!e2) return;
        var wrap = t.closest('.dtable-wrap'); wrap.outerHTML = V.dataTable(e2.table, +d.sort, +d.dir); return;
      }
      if (d.remove) { S.removeLocal(d.remove); closeSheet(); return; }
      if (d.keep) { S.keepSession(d.keep); return; }
      if (d.action === 'home') { ev.preventDefault(); el.q.value = ''; goHome(); closeSheet(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      if (d.open) { ev.preventDefault(); openEntry(d.open); return; }
      if (d.project) { openProject(d.project); return; }
      if (d.q) { ev.preventDefault(); if (state.sheetFor) closeSheet(); Metis.search(d.q); return; }
    });
    document.addEventListener('keydown', function (ev) {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); el.q.focus(); el.q.select(); return; }
      if (ev.key === '/' && !/input|textarea/i.test(document.activeElement.tagName)) { ev.preventDefault(); el.q.focus(); return; }
      if (ev.key === 'Escape' && state.sheetFor) { closeSheet(); return; }
      if (ev.key === 'Enter' && document.activeElement && /^(LI|ARTICLE|DIV)$/.test(document.activeElement.tagName) && document.activeElement.matches('[data-open],[data-project],[data-q]')) {
        document.activeElement.click();
      }
    });
    el.sheetClose.addEventListener('click', closeSheet);
    el.sheetBackdrop.addEventListener('click', closeSheet);
    el.themeBtn.addEventListener('click', function (ev) {
      var r = el.themeBtn.getBoundingClientRect();
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark', { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    });
    el.browseBtn.addEventListener('click', function () { Metis.search('everything'); });
    el.bellBtn.addEventListener('click', function () { if (state.tucked || !$('.banner', el.banners)) showBanners(); else { state.tucked = true; $$('.banner', el.banners).forEach(dismissBanner); } });
    window.addEventListener('popstate', applyHash);

    // Tooltips
    document.addEventListener('pointerover', function (ev) {
      var t = ev.target.closest('[data-tip]'); if (!t) return;
      el.tip.innerHTML = t.getAttribute('data-tip'); el.tip.hidden = false; positionTip(ev);
    });
    document.addEventListener('pointermove', function (ev) { if (!el.tip.hidden) positionTip(ev); });
    document.addEventListener('pointerout', function (ev) {
      var t = ev.target.closest('[data-tip]'); if (t && !t.contains(ev.relatedTarget)) el.tip.hidden = true;
    });
  }
  function refreshAfterReminder() { renderHeader(); if (!state.query) renderLanding(); else runSearch(state.query, true); }
  function positionTip(ev) {
    var w = el.tip.offsetWidth, h = el.tip.offsetHeight;
    var x = Math.min(innerWidth - w - 12, Math.max(12, ev.clientX - w / 2)), y = ev.clientY - h - 14;
    if (y < 8) y = ev.clientY + 18;
    el.tip.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }

  function applyHash() {
    var h = decodeURIComponent(location.hash.slice(1));
    if (/^q=/.test(h)) { var q = h.slice(2); el.q.value = q; renderUnderstood(q); runSearch(q); }
    else if (/^open=/.test(h)) openEntry(h.slice(5));
    else if (state.query) { el.q.value = ''; goHome(true); }
  }

  // ======================================================================
  // Motion: ambient background, spotlight + tilt, reveal, count-up
  // ======================================================================
  function bindAmbient() {
    var raf = null, mx = 0.5, my = 0.3;
    window.addEventListener('pointermove', function (ev) {
      mx = ev.clientX / innerWidth; my = ev.clientY / innerHeight;
      if (!raf) raf = requestAnimationFrame(function () {
        raf = null;
        document.documentElement.style.setProperty('--mx', mx.toFixed(3));
        document.documentElement.style.setProperty('--my', my.toFixed(3));
      });
      var card = ev.target.closest && ev.target.closest('.tile, .card, .answer-card');
      if (card) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--px', ((ev.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        card.style.setProperty('--py', ((ev.clientY - r.top) / r.height * 100).toFixed(1) + '%');
        if (!reduceMotion && card.classList.contains('tile') && matchMedia('(hover:hover)').matches) {
          card.style.setProperty('--rx', (((ev.clientY - r.top) / r.height - 0.5) * -3).toFixed(2) + 'deg');
          card.style.setProperty('--ry', (((ev.clientX - r.left) / r.width - 0.5) * 3).toFixed(2) + 'deg');
        }
      }
    }, { passive: true });
    document.addEventListener('pointerleave', function () {}, { passive: true });
    document.addEventListener('pointerout', function (ev) {
      var card = ev.target.closest && ev.target.closest('.tile');
      if (card && !card.contains(ev.relatedTarget)) { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); }
    });
    var sraf = null;
    window.addEventListener('scroll', function () {
      if (sraf) return;
      sraf = requestAnimationFrame(function () {
        sraf = null;
        var y = Math.min(1, scrollY / 500);
        document.documentElement.style.setProperty('--scroll', y.toFixed(3));
        document.body.classList.toggle('scrolled', scrollY > 40);
      });
    }, { passive: true });
  }

  // Everything animates in on load (staggered by --i) so the page is complete without scrolling
  function revealObserver() {
    $$('.reveal:not(.in), .tile:not(.in)').forEach(function (n) { n.classList.add('in'); });
  }

  function countUp(root) {
    $$('[data-count]', root).forEach(function (n) {
      var target = parseFloat(n.dataset.count);
      if (!isFinite(target) || reduceMotion) return;
      var unit = n.dataset.unit || '', start = performance.now(), dur = 1100;
      var compact = !n.classList.contains('xl');
      var step = function (now) {
        var p = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - p, 4);
        var v = target * e;
        n.textContent = T.fmt(p < 1 && Number.isInteger(target) ? Math.round(v) : p < 1 ? v : target, unit, { compact: compact });
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // Typed placeholder that cycles through suggestions from your data
  function placeholderLoop() {
    var tips = I.tips().map(function (t) { return t.text; });
    if (!tips.length || reduceMotion) { el.q.placeholder = 'Ask anything…'; return; }
    var i = 0, ch = 0, dir = 1, hold = 0;
    setInterval(function () {
      if (document.activeElement === el.q || el.q.value) return;
      var full = tips[i % tips.length];
      if (hold > 0) { hold--; return; }
      ch += dir;
      if (ch >= full.length) { dir = -1; hold = 28; }
      if (ch <= 0) { dir = 1; i++; hold = 4; }
      el.q.placeholder = ch > 0 ? 'Try “' + full.slice(0, ch) + '”' : 'Ask anything…';
    }, 55);
  }

  // ======================================================================
  // CSV drop → instant analysis
  // ======================================================================
  function bindDrop() {
    var depth = 0;
    window.addEventListener('dragenter', function (ev) { if (!hasFiles(ev)) return; ev.preventDefault(); depth++; el.drop.hidden = false; requestAnimationFrame(function () { el.drop.classList.add('on'); }); });
    window.addEventListener('dragover', function (ev) { if (hasFiles(ev)) ev.preventDefault(); });
    window.addEventListener('dragleave', function () { depth = Math.max(0, depth - 1); if (!depth) hideDrop(); });
    window.addEventListener('drop', function (ev) {
      if (!hasFiles(ev)) return;
      ev.preventDefault(); depth = 0; hideDrop();
      var f = ev.dataTransfer.files[0]; if (!f) return;
      if (!/\.(csv|tsv|txt)$/i.test(f.name) && !/text|csv/.test(f.type)) { toast('Drop a .csv or .tsv file to analyze it.'); return; }
      var rd = new FileReader();
      rd.onload = function () {
        var e = S.addSession({ type: 'table', title: f.name.replace(/\.(csv|tsv|txt)$/i, '').replace(/[_\-]+/g, ' '), csv: String(rd.result), date: D.iso(D.today()), keywords: ['imported'] });
        if (e) openEntry(e.id);
      };
      rd.readAsText(f);
    });
    function hasFiles(ev) { return ev.dataTransfer && Array.prototype.indexOf.call(ev.dataTransfer.types || [], 'Files') >= 0; }
    function hideDrop() { el.drop.classList.remove('on'); setTimeout(function () { if (!el.drop.classList.contains('on')) el.drop.hidden = true; }, 250); }
  }

  function toast(msg) {
    var b = document.createElement('div');
    b.className = 'banner toast in'; b.innerHTML = '<div class="banner-body"><strong>' + esc(msg) + '</strong></div>';
    el.banners.appendChild(b); setTimeout(function () { dismissBanner(b); }, 3200);
  }
  Metis.toast = toast;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
