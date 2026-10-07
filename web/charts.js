/* Small hand-made SVG charts: a line chart with crosshair, a histogram and a bar pair.
   Every chart re-renders at its container's width so text never scales. */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const registry = new Map();

  function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs || {}) if (attrs[k] !== undefined && attrs[k] !== null) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }
  function text(parent, x, y, str, attrs) {
    const t = el("text", Object.assign({ x, y }, attrs || {}), parent);
    t.textContent = str;
    return t;
  }
  function scale(d0, d1, r0, r1) {
    const span = d1 - d0 || 1;
    return (v) => r0 + ((v - d0) * (r1 - r0)) / span;
  }
  function niceStep(span, count) {
    const raw = span / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const norm = raw / mag;
    return (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  }
  function ticks(min, max, count) {
    const step = niceStep(max - min, count);
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }
  function extent(arrays) {
    let lo = Infinity, hi = -Infinity;
    for (const a of arrays) for (const v of a) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (lo === hi) { lo -= 1; hi += 1; }
    return [lo, hi];
  }
  function bisect(arr, x) {
    let lo = 0, hi = arr.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (arr[mid] < x) lo = mid; else hi = mid; }
    return Math.abs(arr[lo] - x) <= Math.abs(arr[hi] - x) ? lo : hi;
  }
  const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const dateTimeFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", timeZone: "UTC" });
  const fmtDate = (s) => dateFmt.format(new Date(s * 1000));
  const fmtDateTime = (s) => dateTimeFmt.format(new Date(s * 1000)) + " UTC";

  function tipFor(container) {
    let tip = container.querySelector(".tip");
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "tip";
      tip.hidden = true;
      container.appendChild(tip);
    }
    return {
      show(x, y, html) {
        tip.innerHTML = html;
        tip.hidden = false;
        const w = container.clientWidth;
        const half = tip.offsetWidth / 2;
        tip.style.left = Math.min(Math.max(x, half), w - half) + "px";
        tip.style.top = y + "px";
      },
      hide() { tip.hidden = true; },
    };
  }

  function roundedTop(x, y, w, h, r) {
    if (h <= 0) return "";
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }
  function roundedEnd(x0, x1, y, h, r) {
    // horizontal bar from x0 (baseline) to x1, rounded at the data end only
    const w = Math.abs(x1 - x0);
    if (w < 0.5) return "";
    r = Math.min(r, w, h / 2);
    if (x1 >= x0) return `M${x0},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - r},${y + h}H${x0}Z`;
    return `M${x0},${y}H${x1 + r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 + r},${y + h}H${x0}Z`;
  }

  function mount(container, draw, opts) {
    registry.set(container, { draw, opts });
    draw(container, opts);
  }

  /* ---------- line chart ---------- */
  function drawLine(container, o) {
    container.querySelectorAll("svg").forEach((n) => n.remove());
    const W = Math.max(260, container.clientWidth || 600);
    const H = o.height || 220;
    const m = { l: 46, r: 12, t: o.topLabels ? 22 : 10, b: 24 };
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, "aria-hidden": "true" });
    container.insertBefore(svg, container.firstChild);
    const t = o.time;
    const n = t.length;
    if (!n) return;
    const x = scale(t[0], t[n - 1], m.l, W - m.r);
    const [lo0, hi0] = extent(o.lines.map((l) => l.values).concat(o.zero ? [[0]] : []));
    const pad = (hi0 - lo0) * 0.06;
    const lo = lo0 - pad, hi = hi0 + pad;
    const y = scale(lo, hi, H - m.b, m.t);

    if (o.split) {
      el("rect", { class: "unseen", x: x(o.split), y: m.t, width: W - m.r - x(o.split), height: H - m.b - m.t }, svg);
    }
    const g = el("g", { class: "grid" }, svg);
    const ax = el("g", { class: "axis" }, svg);
    for (const v of ticks(lo, hi, 4)) {
      el("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }, g);
      text(ax, m.l - 8, y(v) + 4, o.yFormat ? o.yFormat(v) : String(v), { "text-anchor": "end" });
    }
    const every = Math.max(1, Math.round((W - m.l - m.r) / 120));
    const span = t[n - 1] - t[0];
    for (let i = 0; i <= every; i++) {
      const tv = t[0] + (span * i) / every;
      const anchor = i === 0 ? "start" : i === every ? "end" : "middle";
      text(ax, x(tv), H - 6, fmtDate(tv), { "text-anchor": anchor });
    }
    if (o.zero && lo < 0 && hi > 0) el("line", { class: "zero", x1: m.l, x2: W - m.r, y1: y(0), y2: y(0) }, svg);
    if (o.spans) {
      const sg = el("g", {}, svg);
      for (const [a, b] of o.spans) {
        const xa = x(a), xb = x(b);
        el("rect", { class: "area", x: xa, y: m.t, width: Math.max(1, xb - xa), height: H - m.b - m.t }, sg);
      }
    }
    if (o.split) {
      const sx = x(o.split);
      el("line", { class: "split", x1: sx, x2: sx, y1: m.t - (o.topLabels ? 14 : 0), y2: H - m.b }, svg);
      if (o.topLabels) {
        text(svg, sx - 6, 12, o.topLabels[0], { class: "label", "text-anchor": "end" });
        text(svg, sx + 6, 12, o.topLabels[1], { class: "label strong", "text-anchor": "start" });
      }
    }
    for (const line of o.lines) {
      let d = "";
      line.values.forEach((v, i) => { d += (i ? "L" : "M") + x(t[i]).toFixed(1) + "," + y(v).toFixed(1); });
      el("path", { class: "line " + (line.cls || ""), d }, svg);
    }
    const last = o.lines[0].values[n - 1];
    el("circle", { class: "dot", cx: x(t[n - 1]), cy: y(last), r: 4 }, svg);

    // hover layer
    const tip = tipFor(container);
    const cross = el("line", { class: "cross", y1: m.t, y2: H - m.b, visibility: "hidden" }, svg);
    const dot = el("circle", { class: "dot", r: 4.5, visibility: "hidden" }, svg);
    const hit = el("rect", { x: m.l, y: 0, width: W - m.l - m.r, height: H, fill: "transparent" }, svg);
    const move = (ev) => {
      const box = svg.getBoundingClientRect();
      const px = ((ev.clientX - box.left) / box.width) * W;
      const tv = t[0] + ((px - m.l) / (W - m.l - m.r)) * span;
      const i = bisect(t, tv);
      const cx = x(t[i]), cy = y(o.lines[0].values[i]);
      cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("visibility", "visible");
      dot.setAttribute("cx", cx); dot.setAttribute("cy", cy); dot.setAttribute("visibility", "visible");
      tip.show((cx / W) * box.width, (cy / H) * box.height, o.tip(i));
    };
    const leave = () => { cross.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); tip.hide(); };
    hit.addEventListener("pointermove", move);
    hit.addEventListener("pointerdown", move);
    hit.addEventListener("pointerleave", leave);
  }

  /* ---------- histogram of random-timing copies ---------- */
  function drawHistogram(container, o) {
    container.querySelectorAll("svg").forEach((n) => n.remove());
    const W = Math.max(220, container.clientWidth || 300);
    const H = o.height || 130;
    const m = { l: 8, r: 8, t: 26, b: 22 };
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, "aria-hidden": "true" });
    container.insertBefore(svg, container.firstChild);
    const vals = o.values;
    if (!vals.length) return;
    let [lo, hi] = extent([vals, [o.marker, o.threshold]]);
    const pad = (hi - lo) * 0.05;
    lo -= pad; hi += pad;
    const x = scale(lo, hi, m.l, W - m.r);
    const bins = Math.max(10, Math.min(28, Math.floor((W - m.l - m.r) / 11)));
    const bw = (hi - lo) / bins;
    const counts = new Array(bins).fill(0);
    for (const v of vals) counts[Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / bw)))]++;
    const cmax = Math.max(...counts);
    const y = scale(0, cmax, H - m.b, m.t + 4);
    const tip = tipFor(container);
    const ax = el("g", { class: "axis" }, svg);
    for (const v of ticks(lo, hi, 4)) text(ax, x(v), H - 6, (Math.round(v * 10) / 10).toString(), { "text-anchor": "middle" });
    el("line", { class: "zero", x1: m.l, x2: W - m.r, y1: H - m.b + 0.5, y2: H - m.b + 0.5 }, svg);
    counts.forEach((c, i) => {
      const x0 = x(lo + i * bw) + 1, x1 = x(lo + (i + 1) * bw) - 1;
      if (!c) return;
      const p = el("path", { class: "bar", d: roundedTop(x0, y(c), Math.max(1, x1 - x0), H - m.b - y(c), 3) }, svg);
      const hitbox = el("rect", { x: x0 - 1, y: m.t, width: x1 - x0 + 2, height: H - m.b - m.t, fill: "transparent" }, svg);
      const a = lo + i * bw, b = a + bw;
      const show = () => {
        p.classList.add("hot");
        const box = svg.getBoundingClientRect();
        tip.show((((x0 + x1) / 2) / W) * box.width, (y(c) / H) * box.height,
          `<b>${c}</b> cop${c === 1 ? "y" : "ies"} scored ${a.toFixed(2)} to ${b.toFixed(2)}`);
      };
      hitbox.addEventListener("pointerenter", show);
      hitbox.addEventListener("pointerdown", show);
      hitbox.addEventListener("pointerleave", () => { p.classList.remove("hot"); tip.hide(); });
    });
    if (o.threshold !== undefined) {
      const tx = x(o.threshold);
      el("line", { class: "threshold", x1: tx, x2: tx, y1: m.t - 2, y2: H - m.b }, svg);
    }
    const mx = x(o.marker);
    el("line", { class: "marker", x1: mx, x2: mx, y1: m.t - 2, y2: H - m.b }, svg);
    el("circle", { class: "dot", cx: mx, cy: m.t - 2, r: 5 }, svg);
    const right = mx > W * 0.62;
    text(svg, mx + (right ? -9 : 9), m.t - 14 + 4, o.markerLabel, { class: "label strong", "text-anchor": right ? "end" : "start" });
  }

  /* ---------- two horizontal bars from zero ---------- */
  function drawBars(container, o) {
    container.querySelectorAll("svg").forEach((n) => n.remove());
    const W = Math.max(220, container.clientWidth || 300);
    const rowH = 30, gap = 10;
    const H = o.rows.length * (rowH + gap) + 18;
    const labelW = Math.min(110, W * 0.36);
    const anyNeg = o.rows.some((r) => r.value < 0);
    const anyPos = o.rows.some((r) => r.value > 0);
    const m = { l: labelW + (anyNeg ? 46 : 0), r: anyPos ? 46 : 12, t: 4 };
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, "aria-hidden": "true" });
    container.insertBefore(svg, container.firstChild);
    const vals = o.rows.map((r) => r.value).concat([0]);
    let [lo, hi] = extent([vals]);
    lo = Math.min(lo, 0); hi = Math.max(hi, 0);
    const x = scale(lo, hi, m.l, W - m.r);
    o.rows.forEach((r, i) => {
      const yy = m.t + i * (rowH + gap);
      text(svg, 0, yy + rowH / 2 + 4, r.label, { class: "label" });
      const barH = 18, by = yy + (rowH - barH) / 2;
      el("path", { class: r.cls, d: roundedEnd(x(0), x(r.value), by, barH, 4) }, svg);
      const neg = r.value < 0;
      text(svg, x(r.value) + (neg ? -6 : 6), yy + rowH / 2 + 4, r.valueLabel, { class: "label strong", "text-anchor": neg ? "end" : "start" });
    });
    const z = x(0);
    el("line", { class: "threshold", x1: z, x2: z, y1: 0, y2: H - 16 }, svg);
    text(svg, z, H - 3, "0", { class: "axis", "text-anchor": "middle" });
  }

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      for (const [c, { draw, opts }] of registry) if (c.isConnected) draw(c, opts);
    }, 120);
  });

  window.LCCharts = {
    line: (c, o) => mount(c, drawLine, o),
    histogram: (c, o) => mount(c, drawHistogram, o),
    bars: (c, o) => mount(c, drawBars, o),
    fmtDate,
    fmtDateTime,
  };
})();
