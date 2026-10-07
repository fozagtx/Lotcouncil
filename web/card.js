/* The shareable verdict card: a 1200x630 image drawn on a canvas. */
(function () {
  "use strict";
  const W = 1200, H = 630;
  const C = {
    bg: "#f4f3ef", card: "#fcfcfb", ink: "#0b0b0b", ink2: "#52514e", muted: "#6f6e68", line: "#e1dfd8",
    pass: "#0ca30c", passInk: "#006300", passBg: "#e9f5e7", fail: "#d03b3b", failInk: "#b12a2a", failBg: "#fbecea",
    skip: "#8a8984", series: "#2a78d6", navy: "#17233a",
  };
  const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function wrap(ctx, str, maxWidth, maxLines) {
    const words = String(str || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
        if (lines.length === maxLines) break;
      } else line = test;
    }
    if (lines.length < maxLines && line) lines.push(line);
    if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
      let last = lines[maxLines - 1];
      while (ctx.measureText(last + "…").width > maxWidth && last.length) last = last.slice(0, -1);
      lines[maxLines - 1] = last.replace(/[\s,.;:]+$/, "") + "…";
    }
    return lines;
  }
  function mark(ctx, x, y, r, state) {
    ctx.fillStyle = state === "pass" ? C.pass : state === "fail" ? C.fail : C.skip;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 3.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    if (state === "pass") { ctx.moveTo(x - r * 0.42, y + r * 0.02); ctx.lineTo(x - r * 0.1, y + r * 0.34); ctx.lineTo(x + r * 0.45, y - r * 0.3); }
    else if (state === "fail") { ctx.moveTo(x - r * 0.36, y - r * 0.36); ctx.lineTo(x + r * 0.36, y + r * 0.36); ctx.moveTo(x + r * 0.36, y - r * 0.36); ctx.lineTo(x - r * 0.36, y + r * 0.36); }
    else { ctx.moveTo(x - r * 0.4, y); ctx.lineTo(x + r * 0.4, y); }
    ctx.stroke();
  }

  function draw(s) {
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    const pass = s.verdict === "PASS";
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    roundRect(ctx, 28, 28, W - 56, H - 56, 28);
    ctx.fillStyle = C.card; ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); roundRect(ctx, 28, 28, W - 56, H - 56, 28); ctx.clip();
    ctx.fillStyle = pass ? C.pass : C.fail; ctx.fillRect(28, 28, 12, H - 56);
    ctx.restore();

    // price sparkline, faint, behind the content
    if (s.close && s.close.length > 2) {
      const xs = 960, xe = W - 72, ys = 515, ye = 395;
      let lo = Infinity, hi = -Infinity;
      for (const v of s.close) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      ctx.strokeStyle = C.series; ctx.globalAlpha = 0.35; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
      ctx.beginPath();
      s.close.forEach((v, i) => {
        const px = xs + ((xe - xs) * i) / (s.close.length - 1);
        const py = ys + ((v - lo) / (hi - lo || 1)) * (ye - ys);
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.stroke(); ctx.globalAlpha = 1;
    }

    // brand
    roundRect(ctx, 72, 66, 40, 40, 11); ctx.fillStyle = C.navy; ctx.fill();
    ctx.strokeStyle = "#f4f3ef"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(81, 79); ctx.lineTo(103, 79); ctx.moveTo(92, 75); ctx.lineTo(92, 98); ctx.moveTo(85, 98); ctx.lineTo(99, 98); ctx.stroke();
    ctx.fillStyle = C.ink; ctx.font = `600 32px ${SERIF}`; ctx.textBaseline = "middle";
    ctx.fillText("Lotcouncil", 126, 87);
    ctx.font = `500 22px ${SANS}`; ctx.fillStyle = C.muted; ctx.textAlign = "right";
    ctx.fillText(s.dateLabel || "", W - 72, 87);
    ctx.textAlign = "left";

    // stamp
    ctx.save();
    ctx.translate(80 + 190, 230);
    ctx.rotate((-3 * Math.PI) / 180);
    roundRect(ctx, -190, -78, 380, 156, 22);
    ctx.fillStyle = pass ? C.passBg : C.failBg; ctx.fill();
    ctx.lineWidth = 7; ctx.strokeStyle = pass ? C.pass : C.fail; ctx.stroke();
    ctx.fillStyle = pass ? C.passInk : C.failInk;
    ctx.font = `850 118px ${SANS}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(s.verdict, 0, 8);
    ctx.restore();

    // headline + idea
    const tx = 510, tw = W - tx - 72;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = C.ink; ctx.font = `600 38px ${SERIF}`;
    let y = 190;
    for (const l of wrap(ctx, s.headline, tw, 2)) { ctx.fillText(l, tx, y); y += 46; }
    ctx.font = `400 25px ${SANS}`; ctx.fillStyle = C.ink2;
    y += 6;
    for (const l of wrap(ctx, s.idea ? `“${s.idea}”` : s.ruleText, tw, 3)) { ctx.fillText(l, tx, y); y += 34; }
    ctx.font = `500 20px ${SANS}`; ctx.fillStyle = C.muted;
    y = Math.max(y + 8, 320);
    for (const l of wrap(ctx, s.metaLabel || "", tw, 2)) { ctx.fillText(l, tx, y); y += 26; }

    // tests
    const rows = [
      ["A", "Unseen data", s.tests.A],
      ["B", "Random timing", s.tests.B],
      ["C", "Stress", s.tests.C],
    ];
    let ry = 420;
    for (const [k, name, t] of rows) {
      const state = !t ? "skip" : t.passed ? "pass" : "fail";
      mark(ctx, 92, ry - 8, 15, state);
      ctx.fillStyle = C.ink; ctx.font = `650 25px ${SANS}`;
      ctx.fillText(`${k}  ${name}`, 122, ry);
      ctx.font = `400 21px ${SANS}`; ctx.fillStyle = C.ink2;
      const detail = t ? t.short : "Not run: too few trades to judge";
      const lines = wrap(ctx, detail, 950 - 400 - 16, 1);
      ctx.fillText(lines[0] || "", 400, ry);
      ry += 50;
    }

    ctx.font = `400 18px ${SANS}`; ctx.fillStyle = C.muted;
    const foot = pass ? "Not obviously luck on this history. Not a prediction, not advice." : "Fixed-code verdict. Not advice.";
    ctx.fillText(foot, 72, H - 58);
    ctx.textAlign = "right";
    ctx.fillText(s.hash ? `data ${s.hash.slice(0, 19)}…` : "", W - 72, H - 58);
    return canvas;
  }

  async function share(s) {
    const canvas = draw(s);
    // Hand the clipboard a promise right away: Safari needs the write inside the tap.
    const blobPromise = new Promise((res) => canvas.toBlob(res, "image/png"));
    const name = `lotcouncil-${s.verdict.toLowerCase()}.png`;
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
        return "copied";
      }
    } catch (e) { /* fall through */ }
    const blob = await blobPromise;
    try {
      const file = new File([blob], name, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Lotcouncil ruling" });
        return "shared";
      }
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return "downloaded";
  }

  window.LCCard = { draw, share };
})();
