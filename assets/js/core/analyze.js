/*
 * Table parsing + quick analysis.
 *
 * Metis.analyze.parseCSV(text)        -> { columns, rows }
 * Metis.analyze.table(columns, rows)  -> analysis object (column profiles, insights)
 * Metis.analyze.aggregate(table, op, colIdx, byIdx, n)
 */
(function () {
  'use strict';
  var T = Metis.text, D = Metis.dates;
  var A = (Metis.analyze = {});

  A.parseCSV = function (text) {
    text = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
    if (!text) return { columns: [], rows: [] };
    var first = text.split('\n')[0];
    var delim = [',', '\t', ';', '|'].reduce(function (best, d) {
      return first.split(d).length > first.split(best).length ? d : best;
    }, ',');
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"' && cell === '') q = true;
      else if (c === delim) { row.push(cell.trim()); cell = ''; }
      else if (c === '\n') { row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    row.push(cell.trim()); rows.push(row);
    rows = rows.filter(function (r) { return r.some(function (c) { return c !== ''; }); });
    var columns = rows.shift() || [];
    return { columns: columns, rows: rows };
  };

  var MONEY_RX = /cost|revenue|price|budget|amount|spend|sales|income|fee|salary|value|profit|invoice|payment|usd|eur|gbp/i;

  function profile(name, values) {
    var nonEmpty = values.filter(function (v) { return v !== '' && v != null; });
    var nums = [], units = {}, dates = 0;
    nonEmpty.forEach(function (v) {
      var n = T.parseNum(v);
      if (n != null) { nums.push(n); var u = T.unitOf(v); if (u) units[u] = (units[u] || 0) + 1; }
      if (typeof v === 'string' && /^\d{4}-\d{1,2}(-\d{1,2})?$|^[a-z]{3,9}\.? \d{4}$/i.test(v.trim()) && D.parse(v)) dates++;
    });
    var p = { name: String(name), count: nonEmpty.length, empty: values.length - nonEmpty.length };
    if (dates && dates >= nonEmpty.length * 0.8) {
      p.type = 'date';
    } else if (nums.length && nums.length >= nonEmpty.length * 0.8 && !/(^|\b)(id|code|zip|phone|year)(\b|$)/i.test(name)) {
      p.type = 'number';
      var unit = Object.keys(units).sort(function (a, b) { return units[b] - units[a]; })[0] || '';
      if (!unit && /%|percent|rate|share|ratio/i.test(name)) unit = '%';
      p.unit = unit;
      p.money = /^[$€£¥]$/.test(unit) || (!unit && MONEY_RX.test(name));
      var sorted = nums.slice().sort(function (a, b) { return a - b; });
      var sum = nums.reduce(function (a, b) { return a + b; }, 0);
      var mean = sum / nums.length;
      var sd = Math.sqrt(nums.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / nums.length);
      p.sum = sum; p.mean = mean; p.sd = sd;
      p.min = sorted[0]; p.max = sorted[sorted.length - 1];
      p.median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
      p.additive = p.unit !== '%' && !/rate|avg|average|mean|score|rating|index|ratio|percent|nps|temp/i.test(name);
    } else {
      p.type = 'text';
      var freq = {};
      nonEmpty.forEach(function (v) { var k = String(v); freq[k] = (freq[k] || 0) + 1; });
      p.distinct = Object.keys(freq).length;
      p.top = Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a]; }).slice(0, 6).map(function (k) { return [k, freq[k]]; });
      p.categorical = p.distinct <= Math.max(6, values.length * 0.5) && p.distinct < values.length;
    }
    return p;
  }

  A.table = function (columns, rows) {
    var cols = columns.map(function (name, i) {
      return profile(name, rows.map(function (r) { return r[i]; }));
    });
    var labelIdx = cols.findIndex(function (c) { return c.type === 'date'; });
    if (labelIdx < 0) labelIdx = cols.findIndex(function (c) { return c.type === 'text' && !c.categorical; });
    if (labelIdx < 0) labelIdx = cols.findIndex(function (c) { return c.type === 'text'; });
    var numIdx = cols.map(function (c, i) { return c.type === 'number' ? i : -1; }).filter(function (i) { return i >= 0; });
    var catIdx = cols.map(function (c, i) { return c.type === 'text' && c.categorical && i !== labelIdx ? i : -1; }).filter(function (i) { return i >= 0; });
    var ordered = labelIdx >= 0 && (cols[labelIdx].type === 'date' || looksOrdinal(rows.map(function (r) { return r[labelIdx]; })));

    var res = {
      rows: rows.length, cols: cols.length, columns: cols,
      labelIdx: labelIdx, numIdx: numIdx, catIdx: catIdx, ordered: ordered,
      primaryIdx: pickPrimary(cols, numIdx),
      insights: []
    };

    // Per numeric column: extremes + change
    numIdx.forEach(function (ci) {
      var c = cols[ci], vals = rows.map(function (r) { return T.parseNum(r[ci]); });
      var maxRow = vals.indexOf(c.max), minRow = vals.indexOf(c.min);
      c.maxLabel = labelIdx >= 0 && rows[maxRow] ? rows[maxRow][labelIdx] : null;
      c.minLabel = labelIdx >= 0 && rows[minRow] ? rows[minRow][labelIdx] : null;
      c.series = vals;
      var firstV = firstDefined(vals), lastV = firstDefined(vals.slice().reverse());
      if (ordered && firstV != null && lastV != null && firstV !== 0) c.change = ((lastV - firstV) / Math.abs(firstV)) * 100;
      c.outliers = c.sd > 0 && vals.length >= 6 ? vals.map(function (v, i) { return v != null && Math.abs(v - c.mean) / c.sd > 2.2 ? i : -1; }).filter(function (i) { return i >= 0; }) : [];
    });

    // Insights (plain sentences, most useful first)
    var P = res.primaryIdx >= 0 ? cols[res.primaryIdx] : null;
    var lbl = labelIdx >= 0 ? cols[labelIdx].name : 'row';
    if (P) {
      if (P.additive) res.insights.push({ kind: 'total', text: '<b>' + T.esc(P.name) + '</b> totals <b>' + fmt(P.sum, P) + '</b> across ' + T.plural(rows.length, 'row') + '.' });
      else res.insights.push({ kind: 'avg', text: '<b>' + T.esc(P.name) + '</b> averages <b>' + fmt(P.mean, P) + '</b> (range ' + fmt(P.min, P) + '–' + fmt(P.max, P) + ').' });
      if (P.maxLabel != null) res.insights.push({ kind: 'peak', text: 'Highest ' + T.esc(P.name.toLowerCase()) + ': <b>' + T.esc(P.maxLabel) + '</b> at ' + fmt(P.max, P) + (P.minLabel != null ? '; lowest: ' + T.esc(P.minLabel) + ' at ' + fmt(P.min, P) : '') + '.' });
      if (P.change != null && isFinite(P.change)) res.insights.push({ kind: 'trend', value: P.change, text: T.esc(P.name) + ' ' + (P.change >= 0 ? 'rose' : 'fell') + ' <b>' + T.pct(Math.abs(P.change)) + '</b> from first to last ' + T.esc(lbl.toLowerCase()) + '.' });
    }
    // Category share for the primary metric
    if (P && P.additive && catIdx.length) {
      var g = A.groupBy({ columns: columns, rows: rows }, catIdx[0], res.primaryIdx, 'sum');
      if (g.length > 1 && P.sum) {
        var share = (g[0].value / P.sum) * 100;
        res.insights.push({ kind: 'share', text: '<b>' + T.esc(g[0].key) + '</b> accounts for ' + T.pct(share) + ' of ' + T.esc(P.name.toLowerCase()) + ' (by ' + T.esc(cols[catIdx[0]].name.toLowerCase()) + ').' });
      }
    } else if (catIdx.length) {
      var c0 = cols[catIdx[0]];
      if (c0.top && c0.top.length) res.insights.push({ kind: 'mix', text: 'Most common ' + T.esc(c0.name.toLowerCase()) + ': <b>' + T.esc(c0.top[0][0]) + '</b> (' + c0.top[0][1] + ' of ' + rows.length + ').' });
    }
    // Other numeric columns — one line each for the biggest movers
    numIdx.filter(function (i) { return i !== res.primaryIdx && cols[i].change != null && Math.abs(cols[i].change) >= 10; })
      .sort(function (a, b) { return Math.abs(cols[b].change) - Math.abs(cols[a].change); }).slice(0, 2)
      .forEach(function (i) {
        var c = cols[i];
        res.insights.push({ kind: 'trend', value: c.change, text: T.esc(c.name) + ' ' + (c.change >= 0 ? 'up' : 'down') + ' ' + T.pct(Math.abs(c.change)) + ' over the period.' });
      });
    numIdx.forEach(function (i) {
      var c = cols[i];
      if (c.outliers.length && c.outliers.length <= 2 && labelIdx >= 0)
        res.insights.push({ kind: 'outlier', text: 'Unusual ' + T.esc(c.name.toLowerCase()) + ' at ' + c.outliers.map(function (r) { return '<b>' + T.esc(rows[r][labelIdx]) + '</b>'; }).join(', ') + '.' });
    });
    var empties = cols.filter(function (c) { return c.empty; });
    if (empties.length) res.insights.push({ kind: 'gaps', text: T.plural(empties.reduce(function (a, c) { return a + c.empty; }, 0), 'empty cell') + ' in ' + empties.map(function (c) { return T.esc(c.name); }).join(', ') + '.' });

    res.headline = res.insights.length ? res.insights[0].text : T.plural(rows.length, 'row') + ' × ' + T.plural(cols.length, 'column');
    return res;

    function fmt(n, c) { return T.fmt(n, c.unit || (c.money ? '$' : '')); }
  };

  function pickPrimary(cols, numIdx) {
    if (!numIdx.length) return -1;
    var pref = numIdx.find(function (i) { return /revenue|sales|total|amount|cost|spend|value|completed|actual|done|hours|budget|count/i.test(cols[i].name); });
    return pref != null ? pref : numIdx[numIdx.length > 1 && cols[numIdx[0]].additive === false ? 1 : 0];
  }
  function firstDefined(a) { for (var i = 0; i < a.length; i++) if (a[i] != null) return a[i]; return null; }
  function looksOrdinal(vals) {
    var months = 0, nums = 0, weeks = 0;
    vals.forEach(function (v) {
      v = String(v || '').toLowerCase().trim();
      if (D.monthIndex(v) >= 0 && /^[a-z]{3,9}\.?( \d{2,4})?$/.test(v)) months++;
      if (/^(w|wk|week|sprint|q|quarter|phase|day|month)\s*\d+/.test(v)) weeks++;
      if (/^\d{4}$/.test(v)) nums++;
    });
    return Math.max(months, weeks, nums) >= vals.length * 0.7;
  }

  A.groupBy = function (tbl, keyIdx, valIdx, op) {
    var map = new Map();
    tbl.rows.forEach(function (r) {
      var k = r[keyIdx] == null || r[keyIdx] === '' ? '(blank)' : String(r[keyIdx]);
      var v = valIdx >= 0 ? T.parseNum(r[valIdx]) : 1;
      var g = map.get(k) || { key: k, sum: 0, n: 0, max: -Infinity, min: Infinity };
      if (v != null) { g.sum += v; g.n++; g.max = Math.max(g.max, v); g.min = Math.min(g.min, v); }
      map.set(k, g);
    });
    return Array.from(map.values()).map(function (g) {
      g.value = op === 'avg' ? g.sum / (g.n || 1) : op === 'count' ? g.n : op === 'max' ? g.max : op === 'min' ? g.min : g.sum;
      return g;
    }).sort(function (a, b) { return b.value - a.value; });
  };

  /*
   * One-shot aggregate used by the query engine.
   * op: sum | avg | max | min | count | median | trend
   */
  A.aggregate = function (entry, op, colIdx, byIdx, n) {
    var tbl = entry.table, an = tbl.analysis, rows = tbl.rows;
    var col = colIdx >= 0 ? an.columns[colIdx] : null;
    var unit = col ? (col.unit || (col.money ? '$' : '')) : '';
    var lbl = an.labelIdx;
    var out = { op: op, column: col ? col.name : null, unit: unit, entry: entry };

    if (byIdx >= 0) {
      var aggOp = op === 'avg' ? 'avg' : op === 'count' ? 'count' : op === 'min' ? 'min' : op === 'max' && !(col && col.additive) ? 'max' : 'sum';
      var g = A.groupBy(tbl, byIdx, colIdx, aggOp);
      if (op === 'min') g.reverse();
      out.by = an.columns[byIdx].name;
      out.groups = g.slice(0, n || 12);
      out.value = g.length ? g[0].value : null;
      out.label = g.length ? g[0].key : null;
      var opWord = { avg: 'Average ', count: 'Count of ', min: 'Lowest ', max: 'Highest ', sum: 'Total ' }[aggOp] || '';
      var what = col && aggOp !== 'count' ? col.name.toLowerCase() : 'rows';
      out.text = g.length
        ? opWord + T.esc(what) + ' by ' + T.esc(out.by.toLowerCase()) + ' — ' + (op === 'min' ? 'lowest' : 'highest') + ': <b>' + T.esc(out.label) + '</b> (' + T.fmt(out.value, aggOp === 'count' ? '' : unit) + ')' +
          (aggOp === 'sum' && col && col.sum && g.length > 1 ? ', ' + T.pct(g[0].value / col.sum * 100) + ' of the total' : '')
        : 'No groups found.';
      return out;
    }

    if (!col) { out.value = rows.length; out.text = T.esc(entry.title) + ' has <b>' + T.plural(rows.length, 'row') + '</b>.'; return out; }

    var pairs = rows.map(function (r) { return { label: lbl >= 0 ? r[lbl] : '', v: T.parseNum(r[colIdx]) }; }).filter(function (p) { return p.v != null; });
    if (op === 'max' || op === 'min') {
      var sorted = pairs.slice().sort(function (a, b) { return op === 'max' ? b.v - a.v : a.v - b.v; });
      out.groups = sorted.slice(0, n || (sorted.length > 12 ? 5 : sorted.length)).map(function (p) { return { key: p.label, value: p.v }; });
      out.value = sorted.length ? sorted[0].v : null; out.label = sorted.length ? sorted[0].label : null;
      out.text = (op === 'max' ? 'Highest ' : 'Lowest ') + T.esc(col.name.toLowerCase()) + ': <b>' + T.fmt(out.value, unit) + '</b>' + (out.label ? ' — ' + T.esc(out.label) : '');
      if (n && n > 1) out.text = (op === 'max' ? 'Top ' : 'Bottom ') + n + ' by ' + T.esc(col.name.toLowerCase()) + ' — led by <b>' + T.esc(out.label) + '</b> (' + T.fmt(out.value, unit) + ')';
    } else if (op === 'avg') {
      out.value = col.mean; out.text = 'Average ' + T.esc(col.name.toLowerCase()) + ': <b>' + T.fmt(col.mean, unit) + '</b> across ' + T.plural(col.count, 'row') + ' (median ' + T.fmt(col.median, unit) + ')';
    } else if (op === 'median') {
      out.value = col.median; out.text = 'Median ' + T.esc(col.name.toLowerCase()) + ': <b>' + T.fmt(col.median, unit) + '</b>';
    } else if (op === 'count') {
      out.value = col.count; out.text = T.esc(col.name) + ' has <b>' + col.count + '</b> values';
    } else if (op === 'trend') {
      out.value = col.change; out.series = pairs;
      out.text = col.change != null
        ? T.esc(col.name) + ' ' + (col.change >= 0 ? 'rose' : 'fell') + ' <b>' + T.pct(Math.abs(col.change)) + '</b>, from ' + T.fmt(pairs[0].v, unit) + ' to ' + T.fmt(pairs[pairs.length - 1].v, unit)
        : T.esc(col.name) + ' ranges ' + T.fmt(col.min, unit) + '–' + T.fmt(col.max, unit);
    } else {
      out.value = col.sum;
      out.text = (col.additive ? 'Total ' : 'Sum of ') + T.esc(col.name.toLowerCase()) + ': <b>' + T.fmt(col.sum, unit) + '</b> across ' + T.plural(col.count, 'row');
    }
    if (!out.groups && op !== 'trend') out.series = pairs;
    return out;
  };
})();
