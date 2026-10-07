/* Lotcouncil page logic: idea in, streamed ruling out. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const Charts = window.LCCharts;
  const EXAMPLE_IDEA = "buy when the 10 hour average crosses above the 40 hour average";
  const PRACTICE_FALLBACK = "PRACTICE-TREND";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const STEP_GAP = reduceMotion ? 0 : 170;

  const RULE_FIELDS = {
    ma_cross: [["fast", "Fast average", "h", 10], ["slow", "Slow average", "h", 40]],
    breakout: [["lookback", "Buy above high of", "h", 48], ["exit_lookback", "Sell below low of", "h", 24]],
    dip_buy: [["drop_pct", "Drop", "%", 1.5], ["lookback", "Below average of", "h", 24], ["max_hold", "Hold at most", "h", 48]],
  };
  const SOURCE_TAGS = { bitget: "Live Bitget prices", saved: "Saved Bitget prices", practice: "Practice prices" };

  const state = {
    markets: null,
    days: 90,
    current: null,
    understood: null,
    running: false,
    runId: 0,
    example: false,
  };

  /* ---------- formatting ---------- */
  const int = (n) => Number(n).toLocaleString("en-US");
  const minus = (s) => s.replace("-", "−");
  const score = (x) => minus(Number(x).toFixed(2));
  const signedPct = (x, d = 1) => (x > 0 ? "+" : "") + minus(Number(x).toFixed(Math.abs(x) < 1 ? 2 : d)) + "%";
  const pct = (x) => minus((Math.abs(x) >= 10 ? Number(x).toFixed(0) : Number(x).toFixed(1)).replace(/\.0$/, "")) + "%";
  const feeLabel = (f) => Number(f).toFixed(2) + "%";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
  const markHtml = (st) => `<span class="mark ${st}">${icon(st === "pass" ? "check" : st === "fail" ? "x" : "skip")}</span>`;

  /* ---------- setup ---------- */
  async function init() {
    wireTheme();
    wireDrawer();
    wireForm();
    try {
      const res = await fetch("api/markets");
      state.markets = await res.json();
    } catch (e) {
      showError("The court's server can't be reached. Check your connection and reload.");
      return;
    }
    fillControls();
    $("aiFoot").textContent = state.markets.ai_enabled
      ? `Ideas are read and explained by ${state.markets.ai_model} on Nebius AI Studio. Verdicts come only from fixed code.`
      : "AI is off on this server: a built-in keyword reader and summary are used. Verdicts come only from fixed code.";

    const q = new URLSearchParams(location.search);
    if (q.get("symbol") || q.get("rule") || q.get("idea")) {
      const rule = decodeRule(q.get("rule"));
      setControls(q.get("symbol"), q.get("days"), q.get("fee"));
      $("idea").value = q.get("idea") || "";
      run({ rule, idea: q.get("idea") || "", end: q.get("end") ? Number(q.get("end")) : null });
    } else {
      $("idea").value = EXAMPLE_IDEA;
      run({ idea: EXAMPLE_IDEA, example: true });
    }
  }

  function fillControls() {
    const m = state.markets;
    const sel = $("symbol");
    sel.innerHTML = "";
    const real = document.createElement("optgroup");
    real.label = "Bitget stock tokens";
    const practice = document.createElement("optgroup");
    practice.label = "Practice (made-up prices)";
    for (const t of m.tokens) {
      const o = document.createElement("option");
      o.value = t.symbol;
      o.textContent = t.practice ? t.label : `${t.label}${t.name ? " · " + t.name : ""}`;
      (t.practice ? practice : real).appendChild(o);
    }
    sel.append(real, practice);
    const seg = $("days");
    seg.innerHTML = "";
    for (const d of m.windows_days) {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "radio");
      b.dataset.days = d;
      b.textContent = d + "d";
      b.setAttribute("aria-label", `Last ${d} days`);
      b.addEventListener("click", () => selectDays(d));
      seg.appendChild(b);
    }
    selectDays(m.default_days);
    const fee = $("fee");
    fee.innerHTML = "";
    for (const f of m.fees_pct) {
      const o = document.createElement("option");
      o.value = f;
      o.textContent = feeLabel(f);
      fee.appendChild(o);
    }
    fee.value = String(m.default_fee_pct);
  }

  function selectDays(d) {
    state.days = Number(d);
    for (const b of $("days").children) b.setAttribute("aria-checked", String(Number(b.dataset.days) === state.days));
  }

  function setControls(symbol, days, fee) {
    if (symbol && [...$("symbol").options].some((o) => o.value === symbol)) $("symbol").value = symbol;
    if (days && state.markets.windows_days.includes(Number(days))) selectDays(Number(days));
    if (fee && [...$("fee").options].some((o) => Number(o.value) === Number(fee))) $("fee").value = [...$("fee").options].find((o) => Number(o.value) === Number(fee)).value;
  }

  function wireForm() {
    $("ideaForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const idea = $("idea").value.trim();
      if (!idea) { $("idea").focus(); return; }
      run({ idea, scroll: true });
    });
    $("idea").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("ideaForm").requestSubmit(); }
    });
    document.querySelectorAll(".chip").forEach((c) =>
      c.addEventListener("click", () => {
        $("idea").value = c.dataset.idea;
        run({ idea: c.dataset.idea, scroll: true });
      })
    );
    $("ruleType").addEventListener("change", () => renderRuleFields($("ruleType").value, null));
    $("editRule").addEventListener("click", () => {
      const form = $("ruleForm");
      form.hidden = !form.hidden;
      $("editRule").setAttribute("aria-expanded", String(!form.hidden));
      $("editRule").textContent = form.hidden ? "Edit numbers" : "Hide numbers";
      if (!form.hidden) { const first = form.querySelector("input"); if (first) first.focus(); }
    });
    $("ruleForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const rule = readRuleForm();
      const same = state.understood && JSON.stringify(state.understood.rule) === JSON.stringify(rule);
      run({ rule, idea: same ? $("idea").value.trim() : "", scroll: true, keepReading: true });
    });
    $("practiceBtn").addEventListener("click", () => {
      $("symbol").value = PRACTICE_FALLBACK;
      const last = state.lastArgs || {};
      run(Object.assign({}, last, { example: false, scroll: true }));
    });
    $("cardBtn").addEventListener("click", copyCard);
    $("linkBtn").addEventListener("click", copyLink);
    $("auditBtn").addEventListener("click", downloadAudit);
  }

  /* ---------- the understood rule ---------- */
  function renderReading(u) {
    state.understood = u;
    $("reading").hidden = false;
    $("ruleType").value = u.rule.type;
    renderRuleFields(u.rule.type, u.rule);
    $("ruleText").textContent = u.rule_text;
    $("readingSource").textContent = u.source === "ai" ? "Read by AI" : u.source === "keywords" ? "Keyword reader" : "Your numbers";
    // With AI off server-wide the footer says so once; per-run notices are for surprises.
    const notice = state.markets && state.markets.ai_enabled ? u.notice : null;
    $("readingNotice").hidden = !notice;
    $("readingNotice").textContent = notice || "";
  }

  function renderRuleFields(type, rule) {
    const box = $("ruleParams");
    box.innerHTML = "";
    for (const [key, label, unit, def] of RULE_FIELDS[type]) {
      const wrap = document.createElement("label");
      wrap.className = "param";
      const val = rule && rule[key] !== undefined ? rule[key] : def;
      wrap.innerHTML = `<span>${esc(label)}</span><input type="number" inputmode="decimal" min="${unit === "%" ? 0.1 : 1}" step="${unit === "%" ? 0.1 : 1}" name="${key}" value="${val}" required><span>${unit}</span>`;
      box.appendChild(wrap);
    }
  }

  function readRuleForm() {
    const rule = { type: $("ruleType").value };
    for (const input of $("ruleParams").querySelectorAll("input")) rule[input.name] = Number(input.value);
    return rule;
  }

  /* ---------- running the court ---------- */
  function setStep(step, st) {
    const li = $("progress").querySelector(`[data-step="${step}"]`);
    if (li) li.dataset.state = st;
  }
  function resetProgress(hasRule) {
    for (const li of $("progress").children) li.dataset.state = "";
    setStep("read", hasRule ? "done" : "active");
    if (hasRule) setStep("data", "active");
  }

  async function run(args) {
    const runId = ++state.runId;
    state.lastArgs = args;
    state.example = !!args.example;
    const symbol = $("symbol").value;
    const feePct = Number($("fee").value);
    const body = { symbol, days: state.days, fee_pct: feePct, idea: args.idea || "" };
    if (args.rule) body.rule = args.rule;
    if (args.end) body.end = args.end;

    state.running = true;
    $("trialBtn").disabled = true;
    $("ruling").setAttribute("aria-busy", "true");
    $("errorBox").hidden = true;
    $("verdict").dataset.state = "loading";
    $("verdict").hidden = false;
    $("exampleTag").hidden = !state.example;
    $("explainText").classList.add("loading");
    $("explainText").textContent = "";
    $("explainNotice").hidden = true;
    $("explainSource").textContent = "";
    resetProgress(!!args.rule);
    if (args.rule && !args.keepReading) renderReading({ rule: args.rule, rule_text: "", source: "user", notice: null });
    if (args.scroll) scrollToRuling();

    let res;
    try {
      res = await fetch("api/judge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch (e) {
      return fail(runId, "The court's server can't be reached. Check your connection and try again.", args, symbol);
    }
    if (!res.ok) {
      let msg = "Something went wrong. Try again.";
      try { msg = (await res.json()).error || msg; } catch (e) { /* keep default */ }
      return fail(runId, msg, args, symbol);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    const current = { request: null, ruling: null, ended: false };
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (runId !== state.runId) { reader.cancel(); return; }
        buf += decoder.decode(value || new Uint8Array(), { stream: !done });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.stage === "verdict" || ev.stage === "error") current.ended = true;
          const stop = await handle(ev, runId, args, symbol, current);
          if (stop) return;
        }
        if (done) break;
      }
    } catch (e) {
      if (!current.ended) return fail(runId, "The connection dropped before the ruling arrived. Try again.", args, symbol);
    }
    if (!current.ended) return fail(runId, "The ruling was cut off before it finished. Try again.", args, symbol);
    finish(runId);
  }

  async function handle(ev, runId, args, symbol, current) {
    if (runId !== state.runId) return true;
    switch (ev.stage) {
      case "understood":
        renderReading(ev);
        setStep("read", "done");
        setStep("data", "active");
        break;
      case "data":
        await sleep(STEP_GAP);
        setStep("data", "done");
        setStep("gate", "active");
        break;
      case "gate":
        await sleep(STEP_GAP);
        setStep("gate", ev.gate.passed ? "done" : "failed");
        if (ev.gate.passed) setStep("A", "active");
        else ["A", "B", "C"].forEach((k) => setStep(k, "skipped"));
        break;
      case "A":
      case "B":
      case "C":
        await sleep(STEP_GAP);
        setStep(ev.stage, ev.test.passed ? "done" : "failed");
        if (ev.stage !== "C") setStep(String.fromCharCode(ev.stage.charCodeAt(0) + 1), "active");
        break;
      case "verdict":
        await sleep(STEP_GAP);
        if (runId !== state.runId) return true;
        state.current = { ruling: ev.ruling, chart: ev.chart, market: ev.market, request: ev.request, idea: args.idea || "", explanation: null, fallbackNote: args.fallbackNote };
        if (!state.understood || ev.request.parsed_by === "user") {
          if (!args.keepReading) renderReading({ rule: ev.ruling.rule, rule_text: ev.ruling.rule_text, source: "user", notice: null });
        }
        $("ruleText").textContent = ev.ruling.rule_text;
        renderRuling(state.current);
        finish(runId);
        break;
      case "explanation":
        if (state.current) state.current.explanation = ev.explanation;
        renderExplanation(ev.explanation);
        break;
      case "error":
        fail(runId, ev.message, args, symbol);
        return true;
    }
    return false;
  }

  function finish(runId) {
    if (runId !== state.runId) return;
    state.running = false;
    $("trialBtn").disabled = false;
    $("ruling").setAttribute("aria-busy", "false");
  }

  function fail(runId, message, args, symbol) {
    if (runId !== state.runId) return;
    const isPractice = symbol.startsWith("PRACTICE");
    const looksLikeData = /prices|Bitget|candles/i.test(message);
    if (args.example && !isPractice && looksLikeData) {
      $("symbol").value = PRACTICE_FALLBACK;
      run(Object.assign({}, args, { fallbackNote: "Bitget prices couldn't be loaded on this server, so this example runs on a practice market." }));
      return;
    }
    finish(runId);
    for (const li of $("progress").children) if (li.dataset.state === "active") li.dataset.state = "failed";
    $("errorText").textContent = message;
    $("practiceBtn").hidden = !(looksLikeData && !isPractice);
    $("errorBox").hidden = false;
    $("verdict").hidden = true;
    ["testA", "testB", "testC"].forEach((id) => ($(id).innerHTML = ""));
    $("explain").hidden = true;
    $("pricePanel").hidden = true;
    $("actions").hidden = true;
    if (/read|idea|rule|average|breakout|dip/i.test(message)) setStep("read", "failed");
  }

  function showError(message) {
    $("errorText").textContent = message;
    $("errorBox").hidden = false;
    $("verdict").hidden = true;
  }

  function scrollToRuling() {
    const r = $("ruling").getBoundingClientRect();
    if (r.top > window.innerHeight * 0.5 || r.top < 0) {
      $("ruling").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }
  }

  /* ---------- rendering the ruling ---------- */
  function shortTest(key, t) {
    if (!t) return "Not run";
    if (key === "A") return `Score ${score(t.score_unseen)} on never-seen data (needs > ${t.threshold})`;
    if (key === "B") return `Beat ${pct(t.beat_share_pct)} of ${t.copies} random copies (needs ${pct(t.threshold_pct)})`;
    const wk = t.weekend_passed ? "weekends OK" : "weekend losses too big";
    return `Score ${score(t.score_stress)} at ${t.stress_fee_mult}x fees, ${wk}`;
  }

  function renderRuling(cur) {
    const { ruling, market, chart, request } = cur;
    const v = $("verdict");
    $("errorBox").hidden = true;
    v.hidden = false;
    v.dataset.state = ruling.verdict;
    $("stampWord").textContent = ruling.verdict;
    $("stamp").setAttribute("aria-label", "Verdict: " + ruling.verdict);
    $("headline").textContent = ruling.headline;
    const tests = ruling.tests || {};
    const failed = Object.values(tests).filter((t) => !t.passed).length;
    $("caveat").textContent = ruling.verdict === "PASS"
      ? "Passed all three tests. That means not obviously luck on this history. It is not a prediction."
      : !ruling.gate.passed
        ? `Not judged: ${ruling.gate.trades ? `it made ${ruling.gate.trades} trade${ruling.gate.trades === 1 ? "" : "s"}` : "it never traded"}, and the court needs at least ${ruling.gate.min_trades}.`
        : `Failed ${failed} of 3 tests. An idea must pass all three.`;
    $("ideaQuote").textContent = cur.idea || ruling.rule_text;
    const tag = SOURCE_TAGS[market.source] || market.source;
    $("meta").textContent = `${market.label} · ${market.days_available} days · ${int(market.candles)} hourly candles · fee ${feeLabel(100 * request.fee)} · ${tag}`;
    const notes = [];
    if (cur.fallbackNote) notes.push(cur.fallbackNote);
    if (market.source !== "bitget") notes.push(market.source_note);
    if (market.short_history) notes.push(`Only ${market.days_available} days of history exist for ${market.label}, so all of it was used.`);
    $("sourceNote").hidden = !notes.length;
    $("sourceNote").textContent = notes.join(" ");

    const strip = $("testStrip");
    strip.innerHTML = "";
    for (const key of ["A", "B", "C"]) {
      const t = tests[key];
      const st = !t ? "skip" : t.passed ? "pass" : "fail";
      const li = document.createElement("li");
      const name = state.markets.tests[key].name;
      li.innerHTML = `${markHtml(st)}<span><b>${key} · ${esc(name)}</b> ${!t ? "not run" : t.passed ? "passed" : "failed"}</span>`;
      li.title = t ? t.sentence : "Not run: too few trades to judge.";
      strip.appendChild(li);
    }

    renderTests(ruling, chart);
    renderPrice(ruling, chart, market);
    $("explain").hidden = false;
    $("pricePanel").hidden = false;
    $("actions").hidden = false;
  }

  function testShell(el, key, t, ruling) {
    const info = state.markets.tests[key];
    const st = !t ? "skip" : t.passed ? "pass" : "fail";
    const label = !t ? "Not run" : t.passed ? "Pass" : "Fail";
    el.className = "test" + (t ? "" : " skipped");
    el.innerHTML = `
      <div class="test-head">
        <span class="test-letter">${key}</span>
        <span class="test-name">${esc(info.name)}</span>
        <span class="pill ${st}">${markHtml(st)}${label}</span>
      </div>
      <p class="test-q">${esc(info.question)}</p>
      ${t ? '<div class="chart"></div><div class="figure"></div><div class="extra"></div>' : ""}
      <p class="test-sentence">${esc(t ? t.sentence : "Not run. " + ruling.gate.sentence)}</p>`;
    return el;
  }

  function renderTests(ruling, chart) {
    const tests = ruling.tests || {};
    const A = testShell($("testA"), "A", tests.A, ruling);
    const B = testShell($("testB"), "B", tests.B, ruling);
    const C = testShell($("testC"), "C", tests.C, ruling);
    if (!tests.A) return;

    // A: result over time, with the never-seen part shaded
    A.querySelector(".figure").innerHTML = `<span class="value">${score(tests.A.score_unseen)}</span><span class="label">score on never-seen data<br>needs above ${tests.A.threshold}</span>`;
    Charts.line(A.querySelector(".chart"), {
      time: chart.time,
      lines: [{ values: chart.equity_pct }],
      split: chart.split_time,
      topLabels: ["Seen", "Never seen"],
      zero: true,
      height: 140,
      yFormat: (v) => minus(Math.round(v) + "%"),
      tip: (i) => `${Charts.fmtDate(chart.time[i])}<br>Result after fees <b>${signedPct(chart.equity_pct[i])}</b>`,
    });

    // B: where the real idea lands among 500 shuffled copies
    B.querySelector(".figure").innerHTML = `<span class="value">${pct(tests.B.beat_share_pct)}</span><span class="label">of ${tests.B.copies} random copies beaten<br>needs ${pct(tests.B.threshold_pct)}</span>`;
    Charts.histogram(B.querySelector(".chart"), {
      values: chart.copy_scores,
      marker: tests.B.score_real,
      threshold: tests.B.copy_score_p95,
      markerLabel: `This idea ${score(tests.B.score_real)}`,
      height: 140,
    });
    B.querySelector(".extra").innerHTML = `<div class="legend"><span><i class="key key-copies"></i>Copies' scores</span><span><i class="key key-idea"></i>This idea</span><span><i class="key key-split"></i>Beats 95%</span></div>`;

    // C: score at normal vs tripled fees, then the weekend check
    const c = tests.C;
    C.querySelector(".figure").innerHTML = `<span class="value">${score(c.score_stress)}</span><span class="label">score at ${c.stress_fee_mult}x fees<br>needs above 0</span>`;
    Charts.bars(C.querySelector(".chart"), {
      rows: [
        { label: `Fee ${feeLabel(c.fee_pct)}`, value: c.score_base, valueLabel: score(c.score_base), cls: "bar-idea" },
        { label: `Fee ${feeLabel(c.stress_fee_pct)}`, value: c.score_stress, valueLabel: score(c.score_stress), cls: "bar-stress" },
      ],
    });
    let wkText, share = 0;
    if (c.weekend_result_pct >= 0) {
      wkText = `Weekend candles: ${signedPct(c.weekend_result_pct)}, no loss`;
    } else if (c.weekend_loss_share_pct === null) {
      wkText = `Weekend candles lost ${pct(-c.weekend_result_pct)}, with no overall profit`;
      share = 100;
    } else {
      share = c.weekend_loss_share_pct;
      wkText = `Weekend loss: ${pct(share)} of the result (limit ${c.weekend_loss_max_share_pct}%)`;
    }
    const lim = c.weekend_loss_max_share_pct;
    C.querySelector(".extra").innerHTML = `
      <div class="meter-row">
        <span>${esc(wkText)}</span>
        <div class="meter-wrap"><div class="meter ${c.weekend_passed ? "" : "bad"}" role="img" aria-label="${esc(wkText)}"><i style="width:${Math.min(100, share)}%"></i></div>
        <span class="meter-limit" style="left:${lim}%" title="Limit"></span></div>
      </div>`;
  }

  function renderPrice(ruling, chart, market) {
    const spans = chart.holding;
    const holdingAt = (t) => {
      let lo = 0, hi = spans.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (t < spans[mid][0]) hi = mid - 1;
        else if (t > spans[mid][1]) lo = mid + 1;
        else return true;
      }
      return false;
    };
    const lastPrice = chart.close[chart.close.length - 1];
    const dp = lastPrice >= 100 ? 2 : lastPrice >= 1 ? 3 : 5;
    Charts.line($("priceChart"), {
      time: chart.time,
      lines: [{ values: chart.close }],
      spans,
      split: chart.split_time,
      height: 240,
      yFormat: (v) => (v >= 1000 ? int(Math.round(v)) : v.toFixed(v >= 100 ? 0 : 2)),
      tip: (i) => `${Charts.fmtDateTime(chart.time[i])}<br><b>${chart.close[i].toFixed(dp)} USDT</b> · ${holdingAt(chart.time[i]) ? "holding" : "in cash"}`,
    });
    $("priceChart").setAttribute("aria-label", `${market.label} hourly prices with the rule's holding periods shaded.`);
    const s = ruling.stats;
    const items = [
      ["Trades", int(s.trades)],
      ["Time holding", pct(s.time_in_market_pct)],
      ["Result after fees", signedPct(s.total_return_pct)],
      ["Just holding", signedPct(s.buy_hold_return_pct)],
      ["Score", score(s.score)],
    ];
    $("stats").innerHTML = items.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  }

  function renderExplanation(ex) {
    $("explainText").classList.remove("loading");
    $("explainText").textContent = ex.text;
    $("explainSource").textContent = ex.source === "ai" ? `Written by AI from the court's numbers` : "Built-in summary";
    const notice = state.markets && state.markets.ai_enabled ? ex.notice : null;
    $("explainNotice").hidden = !notice;
    $("explainNotice").textContent = notice || "";
  }

  /* ---------- share, link, audit ---------- */
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (t.hidden = true), 3500);
  }

  function encodeRule(rule) {
    const keys = { ma_cross: ["fast", "slow"], breakout: ["lookback", "exit_lookback"], dip_buy: ["drop_pct", "lookback", "max_hold"] }[rule.type];
    return [rule.type].concat(keys.map((k) => rule[k])).join(",");
  }
  function decodeRule(str) {
    if (!str) return null;
    const [type, ...nums] = str.split(",");
    const keys = { ma_cross: ["fast", "slow"], breakout: ["lookback", "exit_lookback"], dip_buy: ["drop_pct", "lookback", "max_hold"] }[type];
    if (!keys) return null;
    const rule = { type };
    keys.forEach((k, i) => { if (nums[i] !== undefined && nums[i] !== "") rule[k] = Number(nums[i]); });
    return rule;
  }

  function shareUrl() {
    const c = state.current;
    const r = c.request;
    const q = new URLSearchParams({
      symbol: r.symbol, days: r.days, fee: (100 * r.fee).toFixed(2), rule: encodeRule(r.rule), end: Math.floor(r.end / 1000),
    });
    if (c.idea) q.set("idea", c.idea);
    return location.origin + location.pathname + "?" + q.toString();
  }

  async function copyLink() {
    if (!state.current) return;
    const url = shareUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied. It re-runs this exact ruling on the same candles.");
    } catch (e) {
      try { await navigator.share({ url, title: "Lotcouncil ruling" }); }
      catch (e2) { window.prompt("Copy this link:", url); }
    }
  }

  function cardState() {
    const c = state.current;
    const t = c.ruling.tests || {};
    const short = {};
    for (const k of ["A", "B", "C"]) if (t[k]) short[k] = { passed: t[k].passed, short: shortTest(k, t[k]) };
    const dateLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(c.market.end));
    return {
      verdict: c.ruling.verdict,
      headline: c.ruling.headline,
      idea: c.idea,
      ruleText: c.ruling.rule_text,
      metaLabel: `${c.market.label} · ${c.market.days_available} days of hourly candles · fee ${feeLabel(100 * c.request.fee)}${c.market.source === "practice" ? " · practice prices" : ""}`,
      tests: short,
      hash: c.market.hash,
      close: c.chart.close,
      dateLabel: "Ruled on data to " + dateLabel,
    };
  }

  async function copyCard() {
    if (!state.current) return;
    const how = await window.LCCard.share(cardState());
    if (how === "copied") toast("Verdict card copied as an image. Paste it anywhere.");
    else if (how === "shared") toast("Verdict card shared.");
    else if (how === "downloaded") toast("Verdict card saved as an image.");
  }

  async function downloadAudit() {
    const c = state.current;
    if (!c) return;
    const r = c.request;
    $("auditBtn").disabled = true;
    try {
      const res = await fetch("api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: r.symbol, days: r.days, end: Math.floor(r.end / 1000), rule: r.rule, fee_pct: 100 * r.fee,
          idea: c.idea, parsed_by: r.parsed_by, explanation: c.explanation,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `lotcouncil-${c.market.symbol.replace(/USDT$/, "")}-${c.ruling.verdict.toLowerCase()}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      toast("Audit file saved. Re-run it under How this works, or with python -m lotcouncil rerun.");
    } catch (e) {
      toast("The audit file couldn't be made: " + e.message);
    } finally {
      $("auditBtn").disabled = false;
    }
  }

  /* ---------- drawer and theme ---------- */
  function wireDrawer() {
    const d = $("how");
    $("howBtn").addEventListener("click", () => d.showModal());
    $("howClose").addEventListener("click", () => d.close());
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    $("auditFile").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      const out = $("rerunResult");
      out.className = "rerun-result";
      if (!file) return;
      out.textContent = "Re-running…";
      try {
        const text = await file.text();
        const res = await fetch("api/rerun", { method: "POST", headers: { "Content-Type": "application/json" }, body: text });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "failed");
        out.classList.add(data.same ? "ok" : "bad");
        out.textContent = data.same
          ? `Same ruling: ${data.verdict_now}. The candles match their fingerprint and every number matches.`
          : `Different: the file says ${data.verdict_in_file}, the re-run gives ${data.verdict_now}.${data.hash_ok ? "" : " The candles don't match their fingerprint."} ${data.differences.slice(0, 2).join("; ")}`;
      } catch (err) {
        out.classList.add("bad");
        out.textContent = "Couldn't re-run that file: " + err.message;
      }
      e.target.value = "";
    });
  }

  function wireTheme() {
    $("themeBtn").addEventListener("click", () => {
      const root = document.documentElement;
      const dark = root.dataset.theme ? root.dataset.theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.dataset.theme = dark ? "light" : "dark";
      try { localStorage.setItem("lc-theme", root.dataset.theme); } catch (e) { /* private mode */ }
    });
  }

  init();
})();
