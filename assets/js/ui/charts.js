/*
 * Lightweight SVG/HTML charts. Each returns an HTML string.
 * Hover tooltips use `data-tip` (wired once in app.js).
 * Colors come from CSS variables so light/dark mode just works.
 */
(function () {
  'use strict';
  var T = Atlas.text;
  var C = (Atlas.charts = {});
  var uid = 0;

  function tip(label, value) {
    return T.esc('<span class="tip-l">' + T.esc(label) + '</span><b>' + T.esc(value) + '</b>');
  }

  C.sparkline = function (values, opts) {
    opts = opts || {};
    var v = (values || []).filter(function (x) { return x != null && isFinite(x); });
    if (v.length < 2) return '';
    var w = opts.w || 120, h = opts.h || 36, pad = 4;
    var min = Math.min.apply(null, v), max = Math.max.apply(null, v), span = max - min || 1;
    var pts = v.map(function (y, i) { return [pad + (i * (w - pad * 2)) / (v.length - 1), pad + (1 - (y - min) / span) * (h - pad * 2)]; });
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var last = pts[pts.length - 1], id = 'sg' + (++uid);
    return '<span class="spark-wrap"><svg class="spark' + (opts.cls ? ' ' + opts.cls : '') + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".22"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + d + ' L' + last[0].toFixed(1) + ' ' + h + ' L' + pts[0][0].toFixed(1) + ' ' + h + 'Z" fill="url(#' + id + ')" stroke="none"/>' +
      '<path class="spark-line" d="' + d + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
      '</svg><i class="spark-dot" style="left:' + (last[0] / w * 100).toFixed(2) + '%;top:' + (last[1] / h * 100).toFixed(2) + '%"></i></span>';
  };

  // Horizontal bars: groups = [{ key, value }]
  C.bars = function (groups, opts) {
    opts = opts || {};
    if (!groups || !groups.length) return '';
    var max = Math.max.apply(null, groups.map(function (g) { return Math.abs(g.value) || 0; })) || 1;
    var total = groups.reduce(function (a, g) { return a + (g.value || 0); }, 0);
    return '<div class="hbars">' + groups.map(function (g, i) {
      var pct = Math.max(1.5, (Math.abs(g.value) / max) * 100);
      var val = T.fmt(g.value, opts.unit);
      var share = opts.share && total ? ' · ' + T.pct((g.value / total) * 100) : '';
      return '<div class="hbar" data-tip="' + tip(g.key, val + share) + '" style="--i:' + i + '">' +
        '<span class="hbar-k">' + T.esc(g.key) + '</span>' +
        '<span class="hbar-track"><span class="hbar-fill' + (i === 0 && opts.highlightTop ? ' top' : '') + '" style="--w:' + pct.toFixed(1) + '%"></span></span>' +
        '<span class="hbar-v">' + val + '</span></div>';
    }).join('') + '</div>';
  };

  function niceTicks(min, max, count) {
    if (min === max) { max = min + 1; }
    var span = max - min, step = Math.pow(10, Math.floor(Math.log10(span / count)));
    var err = (count * step) / span;
    if (err <= 0.15) step *= 10; else if (err <= 0.35) step *= 5; else if (err <= 0.75) step *= 2;
    var lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, out = [];
    for (var v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(10));
    return out;
  }

  /*
   * Vertical chart for a series = [{ label, v }]
   * kind: 'columns' | 'line' (auto: line when ordered and many points)
   */
  C.series = function (series, opts) {
    opts = opts || {};
    var s = (series || []).filter(function (p) { return p.v != null && isFinite(p.v); });
    if (!s.length) return '<p class="muted">No numbers to chart.</p>';
    var kind = opts.kind || (opts.ordered && s.length > 8 ? 'line' : 'columns');
    var W = 640, H = 240, L = 52, R = 16, Tp = 16, B = 34;
    var vals = s.map(function (p) { return p.v; });
    var minV = Math.min(0, Math.min.apply(null, vals)), maxV = Math.max.apply(null, vals);
    if (kind === 'line' && minV === 0 && Math.min.apply(null, vals) > maxV * 0.4) minV = Math.min.apply(null, vals) * 0.9;
    var ticks = niceTicks(minV, maxV, 4);
    var lo = ticks[0], hi = ticks[ticks.length - 1];
    var y = function (v) { return Tp + (1 - (v - lo) / (hi - lo || 1)) * (H - Tp - B); };
    var band = (W - L - R) / s.length;
    var x = function (i) { return L + band * i + band / 2; };
    var unit = opts.unit || '';
    var g = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + T.esc(opts.title || 'Chart') + '">';
    ticks.forEach(function (t) {
      g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(t).toFixed(1) + '" y2="' + y(t).toFixed(1) + '"/>' +
        '<text class="tick" x="' + (L - 8) + '" y="' + (y(t) + 4).toFixed(1) + '" text-anchor="end">' + T.esc(T.fmt(t, unit)) + '</text>';
    });
    var every = Math.ceil(s.length / 10);
    s.forEach(function (p, i) {
      if (i % every === 0 || i === s.length - 1) g += '<text class="tick" x="' + x(i).toFixed(1) + '" y="' + (H - 12) + '" text-anchor="middle">' + T.esc(shortLabel(p.label)) + '</text>';
    });
    var base = y(Math.max(lo, 0));
    if (kind === 'columns') {
      var bw = Math.min(24, band * 0.62);
      var maxI = vals.indexOf(Math.max.apply(null, vals));
      s.forEach(function (p, i) {
        var top = y(p.v), hgt = Math.max(1, base - top);
        g += '<g class="col-g" style="--i:' + i + '" data-tip="' + tip(p.label, T.fmt(p.v, unit)) + '">' +
          '<rect class="hit" x="' + (x(i) - band / 2).toFixed(1) + '" y="' + Tp + '" width="' + band.toFixed(1) + '" height="' + (H - Tp - B) + '"/>' +
          '<path class="col' + (i === maxI ? ' peak' : '') + '" d="' + roundTop(x(i) - bw / 2, top, bw, hgt, Math.min(4, hgt)) + '"/></g>';
      });
      // Label only the peak (selective direct labeling)
      g += '<text class="val-label" x="' + x(maxI).toFixed(1) + '" y="' + (y(vals[maxI]) - 7).toFixed(1) + '" text-anchor="middle">' + T.esc(T.fmt(vals[maxI], unit)) + '</text>';
    } else {
      var d = s.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1); }).join(' ');
      var id = 'ln' + (++uid);
      g += '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--series-1)" stop-opacity=".18"/><stop offset="1" stop-color="var(--series-1)" stop-opacity="0"/></linearGradient></defs>';
      g += '<path d="' + d + ' L' + x(s.length - 1).toFixed(1) + ' ' + base.toFixed(1) + ' L' + x(0).toFixed(1) + ' ' + base.toFixed(1) + 'Z" fill="url(#' + id + ')"/>';
      g += '<path class="line" d="' + d + '"/>';
      s.forEach(function (p, i) {
        g += '<g class="pt-g" data-tip="' + tip(p.label, T.fmt(p.v, unit)) + '">' +
          '<rect class="hit" x="' + (x(i) - band / 2).toFixed(1) + '" y="' + Tp + '" width="' + band.toFixed(1) + '" height="' + (H - Tp - B) + '"/>' +
          '<line class="xhair" x1="' + x(i).toFixed(1) + '" x2="' + x(i).toFixed(1) + '" y1="' + Tp + '" y2="' + (H - B) + '"/>' +
          '<circle class="pt' + (i === s.length - 1 ? ' end' : '') + '" cx="' + x(i).toFixed(1) + '" cy="' + y(p.v).toFixed(1) + '" r="4.5"/></g>';
      });
      var lv = s[s.length - 1].v;
      g += '<text class="val-label" x="' + (x(s.length - 1) - 8).toFixed(1) + '" y="' + (y(lv) - 10).toFixed(1) + '" text-anchor="end">' + T.esc(T.fmt(lv, unit)) + '</text>';
    }
    g += '<line class="axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + base.toFixed(1) + '" y2="' + base.toFixed(1) + '"/>';
    return g + '</svg>';
  };

  function roundTop(x, y, w, h, r) {
    return 'M' + x.toFixed(1) + ' ' + (y + h).toFixed(1) + ' V' + (y + r).toFixed(1) +
      ' Q' + x.toFixed(1) + ' ' + y.toFixed(1) + ' ' + (x + r).toFixed(1) + ' ' + y.toFixed(1) +
      ' H' + (x + w - r).toFixed(1) + ' Q' + (x + w).toFixed(1) + ' ' + y.toFixed(1) + ' ' + (x + w).toFixed(1) + ' ' + (y + r).toFixed(1) +
      ' V' + (y + h).toFixed(1) + ' Z';
  }
  function shortLabel(l) {
    l = String(l == null ? '' : l);
    var m = l.match(/^([A-Za-z]{3})[a-z]*\.? (\d{4})$/); if (m) return m[1];
    m = l.match(/^sprint\s*(\d+)$/i); if (m) return 'S' + m[1];
    return l.length > 9 ? l.slice(0, 8) + '…' : l;
  }

  // Progress ring
  C.ring = function (frac, opts) {
    opts = opts || {};
    var size = opts.size || 64, sw = opts.stroke || 6, r = (size - sw) / 2, c = 2 * Math.PI * r;
    var f = Math.max(0, Math.min(1, frac || 0));
    return '<svg class="ring' + (opts.cls ? ' ' + opts.cls : '') + '" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" aria-hidden="true">' +
      '<circle class="ring-track" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="' + sw + '"/>' +
      '<circle class="ring-fill" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="' + sw + '" stroke-dasharray="' + c.toFixed(2) + '" style="--off:' + (c * (1 - f)).toFixed(2) + ';--len:' + c.toFixed(2) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg>';
  };

  // Meter: value vs target (fill carries severity)
  C.meter = function (value, target, higherIsBetter) {
    if (value == null || target == null || !target) return '';
    var frac = higherIsBetter ? value / target : target / value;
    var w = Math.max(3, Math.min(100, (value / Math.max(value, target)) * 100));
    var tone = frac >= 1 ? 'good' : frac >= 0.85 ? 'warning' : 'critical';
    var tpos = Math.min(100, (target / Math.max(value, target)) * 100);
    return '<div class="meter ' + tone + '"><span class="meter-fill" style="--w:' + w.toFixed(1) + '%"></span><span class="meter-target" style="left:' + tpos.toFixed(1) + '%"></span></div>';
  };
})();
