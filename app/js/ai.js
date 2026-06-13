/* =========================================================================
 * ai.js — OpenAI-compatible AI integration:
 *   · multiple API sources (name / base URL / key / curated model list,
 *     auto-fetched via /models or hand-edited)
 *   · per-chat model picker + multi-model compare mode
 *   · one-click preset analysis & follow-up chat per calculator, streaming
 *     with non-stream fallback, reasoning_content (思考型模型) support
 *   · every answer is labelled with its API source + model
 *
 * HTTP goes through window.aiBridge (Electron IPC proxy, no CORS) when
 * present, otherwise plain fetch.
 * ========================================================================= */

const AI = (function () {
  "use strict";
  const $ = sel => document.querySelector(sel);

  /* ============================== Settings ============================== */

  const SETTINGS_KEY = "fsc-ai-settings";

  function newSourceId() { return "src-" + Date.now() + "-" + Math.floor(Math.random() * 1e4); }

  function guessName(baseUrl) {
    try {
      const h = new URL(baseUrl).hostname;
      if (/openai/.test(h)) return "OpenAI";
      if (/deepseek/.test(h)) return "DeepSeek";
      if (/moonshot/.test(h)) return "Kimi";
      if (/bigmodel/.test(h)) return "智谱";
      if (/dashscope|aliyun/.test(h)) return "通义";
      if (/openrouter/.test(h)) return "OpenRouter";
      if (/localhost|127\.0\.0\.1/.test(h)) return "本地";
      return h.split(".").slice(-2, -1)[0] || "API";
    } catch (e) { return "API"; }
  }

  /* v2 shape: { sources:[{id,name,baseUrl,apiKey,models[]}],
   *            current:{sourceId,model}, compare:[{sourceId,model}], temperature } */
  function loadSettings() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null"); } catch (e) { /* corrupt */ }
    if (!raw) return { sources: [], current: null, compare: [], temperature: 0.7 };
    if (Array.isArray(raw.sources)) {
      return { sources: raw.sources, current: raw.current || null, compare: raw.compare || [], temperature: raw.temperature == null ? 0.7 : raw.temperature };
    }
    // migrate v1 single-endpoint shape
    const out = { sources: [], current: null, compare: [], temperature: raw.temperature == null ? 0.7 : raw.temperature };
    if (raw.baseUrl) {
      const src = { id: newSourceId(), name: guessName(raw.baseUrl), baseUrl: raw.baseUrl, apiKey: raw.apiKey || "", models: raw.model ? [raw.model] : [] };
      out.sources.push(src);
      if (raw.model) out.current = { sourceId: src.id, model: raw.model };
    }
    return out;
  }
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* private mode */ }
  }
  let settings = loadSettings();

  const sourceById = id => settings.sources.find(s => s.id === id) || null;

  /* resolve {sourceId, model} → {source, model} or null */
  function resolveTarget(sel) {
    if (!sel) return null;
    const source = sourceById(sel.sourceId);
    if (!source || !sel.model) return null;
    return { source, model: sel.model };
  }

  /* primary + compare targets, deduped, primary first */
  function currentTargets() {
    const out = [];
    const seen = {};
    const push = sel => {
      const t = resolveTarget(sel);
      if (!t) return;
      const k = t.source.id + "::" + t.model;
      if (seen[k]) return;
      seen[k] = 1;
      out.push(t);
    };
    push(settings.current);
    (settings.compare || []).forEach(push);
    return out;
  }
  const configured = () => !!resolveTarget(settings.current);

  /* ============================ HTTP layer ============================== */

  const hasBridge = () => typeof window !== "undefined" && !!window.aiBridge;

  function endpointOf(source, path) { return source.baseUrl.replace(/\/+$/, "") + path; }
  function headersOf(source) {
    const h = { "Content-Type": "application/json" };
    if (source.apiKey) h["Authorization"] = "Bearer " + source.apiKey;
    return h;
  }

  async function httpJSON(url, opts) {
    opts = opts || {};
    let status, text;
    if (hasBridge()) {
      const r = await window.aiBridge.request({
        url, method: opts.method || "GET", headers: opts.headers || {}, body: opts.body || null,
      });
      status = r.status; text = r.body;
    } else {
      const res = await fetch(url, { method: opts.method || "GET", headers: opts.headers || {}, body: opts.body || null });
      status = res.status; text = await res.text();
    }
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* non-JSON body */ }
    return { status, text, json };
  }

  /* Streaming POST. Returns { promise, abort }. onChunk receives raw text. */
  function httpStream(url, opts, onChunk) {
    if (hasBridge()) {
      let resolve, reject;
      const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
      const handle = window.aiBridge.stream(
        { url, method: "POST", headers: opts.headers, body: opts.body },
        {
          onChunk,
          onEnd: status => (status >= 200 && status < 300) ? resolve() : reject(new Error("HTTP " + status)),
          onError: msg => reject(new Error(msg)),
        });
      return { promise, abort: handle.abort };
    }
    const ac = new AbortController();
    const promise = (async () => {
      const res = await fetch(url, { method: "POST", headers: opts.headers, body: opts.body, signal: ac.signal });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error("HTTP " + res.status + (body ? " — " + body.slice(0, 300) : ""));
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        onChunk(dec.decode(value, { stream: true }));
      }
    })();
    return { promise, abort: () => ac.abort() };
  }

  /* ========================= OpenAI-compatible API ====================== */

  async function listModels(source) {
    const r = await httpJSON(endpointOf(source, "/models"), { headers: headersOf(source) });
    if (r.status < 200 || r.status >= 300) {
      throw new Error("HTTP " + r.status + (r.json && r.json.error ? " — " + (r.json.error.message || JSON.stringify(r.json.error)) : ""));
    }
    const data = r.json && (Array.isArray(r.json.data) ? r.json.data : Array.isArray(r.json) ? r.json : null);
    if (!data) throw new Error("响应不是模型列表 (no data[])");
    return data.map(m => m.id || m.name || String(m)).filter(Boolean).sort();
  }

  /* Pull content / reasoning deltas + finish_reason from one chunk of a
   * chat-completions JSON (streamed delta or full message). Reasoning
   * models (DeepSeek-R1, Kimi, QwQ…) emit reasoning_content long before
   * any content — both must be surfaced or the UI looks stuck/empty. */
  function deltas(j) {
    const c = j && j.choices && j.choices[0];
    if (!c) return { content: "", reasoning: "", finish: null };
    const d = c.delta || c.message || c;
    let content = typeof d.content === "string" ? d.content : (typeof c.text === "string" ? c.text : "");
    const reasoning = (typeof d.reasoning_content === "string" && d.reasoning_content)
      || (typeof d.reasoning === "string" && d.reasoning) || "";
    return { content, reasoning, finish: c.finish_reason || null };
  }

  /* Streamed chat with automatic fallback for non-streaming providers.
   * onEvent(type, textPiece) — type: "content" | "reasoning".
   * Returns { promise:→{finish}, abort }. */
  function chat(target, messages, onEvent) {
    const url = endpointOf(target.source, "/chat/completions");
    const headers = headersOf(target.source);
    const base = { model: target.model, messages, temperature: Number(settings.temperature) };
    let gotAny = false;
    let finish = null;
    let sseBuf = "";

    function consumeSSE(chunk) {
      sseBuf += chunk;
      const lines = sseBuf.split("\n");
      sseBuf = lines.pop();                       // keep incomplete tail
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const d = deltas(JSON.parse(payload));
          if (d.finish) finish = d.finish;
          if (d.reasoning) { gotAny = true; onEvent("reasoning", d.reasoning); }
          if (d.content) { gotAny = true; onEvent("content", d.content); }
        } catch (e) { /* partial JSON line — wait for more */ }
      }
    }

    const inner = httpStream(url, {
      headers, body: JSON.stringify(Object.assign({ stream: true }, base)),
    }, consumeSSE);

    let aborted = false;
    const promise = inner.promise.then(() => ({ finish })).catch(async err => {
      if (aborted || gotAny) throw err;           // real failure mid-stream
      // streaming not supported / rejected — retry without stream
      const r = await httpJSON(url, { method: "POST", headers, body: JSON.stringify(base) });
      if (r.status < 200 || r.status >= 300) {
        const msg = r.json && r.json.error ? (r.json.error.message || JSON.stringify(r.json.error)) : r.text.slice(0, 300);
        throw new Error("HTTP " + r.status + " — " + msg);
      }
      const d = deltas(r.json);
      if (d.reasoning) onEvent("reasoning", d.reasoning);
      if (d.content) onEvent("content", d.content);
      return { finish: d.finish };
    });
    return { promise, abort: () => { aborted = true; inner.abort(); } };
  }

  /* ========================= Minimal Markdown =========================== */

  const escHtml = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function mdInline(s) {
    return escHtml(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>");
  }

  function mdToHtml(md) {
    const out = [];
    const lines = md.split("\n");
    let i = 0, list = null;                       // list: "ul" | "ol" | null
    const closeList = () => { if (list) { out.push("</" + list + ">"); list = null; } };
    while (i < lines.length) {
      const line = lines[i];
      if (/^\s*```/.test(line)) {                 // fenced code
        closeList();
        const buf = [];
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
        i++;
        out.push("<pre><code>" + escHtml(buf.join("\n")) + "</code></pre>");
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(line)) {          // pipe table
        closeList();
        const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
        const cells = r => r.trim().replace(/^\||\|$/g, "").split("|").map(c => mdInline(c.trim()));
        let html = "<table>";
        rows.forEach((r, ri) => {
          if (/^\s*\|[\s:|-]+\|\s*$/.test(r)) return;     // separator row
          const tag = ri === 0 ? "th" : "td";
          html += "<tr>" + cells(r).map(c => `<${tag}>${c}</${tag}>`).join("") + "</tr>";
        });
        out.push(html + "</table>");
        continue;
      }
      const h = line.match(/^(#{1,4})\s+(.*)/);
      if (h) { closeList(); out.push(`<h${h[1].length + 2}>${mdInline(h[2])}</h${h[1].length + 2}>`); i++; continue; }
      const ul = line.match(/^\s*[-*]\s+(.*)/);
      const ol = line.match(/^\s*\d+[.、)]\s+(.*)/);
      if (ul || ol) {
        const want = ul ? "ul" : "ol";
        if (list !== want) { closeList(); out.push("<" + want + ">"); list = want; }
        out.push("<li>" + mdInline((ul || ol)[1]) + "</li>");
        i++; continue;
      }
      closeList();
      if (line.trim() === "") { i++; continue; }
      out.push("<p>" + mdInline(line) + "</p>");
      i++;
    }
    closeList();
    return out.join("\n");
  }

  /* =========================== Chat sessions ============================ */

  const MODULES = ["bazi", "flyingstars", "tongshu", "qimen"];
  const state = {};
  MODULES.forEach(k => {
    state[k] = {
      payload: null,        // {result, input}
      chartId: 0,           // bumps on every new chart
      sentChartId: -1,      // chartId already included in the conversation
      messages: [],         // [{role,content,display?,source?,model?,reasoning?}]
      busy: null,           // array of {abort} while requests are running
      ui: null,
    };
  });

  /* listeners notified whenever charts/conversations change (persistence) */
  const changeListeners = [];
  function onChanged(cb) { changeListeners.push(cb); }
  function emitChanged() { changeListeners.forEach(cb => { try { cb(); } catch (e) { /* listener bug */ } }); }

  /* Called by app.js every time a calculator recomputes. */
  function setChart(key, result, input) {
    const st = state[key];
    if (!st) return;
    st.payload = { result, input: input || {} };
    st.chartId++;
    if (st.ui) {
      st.ui.presetBtn.disabled = false;
      if (st.messages.length && st.sentChartId !== st.chartId) {
        note(key, "盘面已更新 — 下一条消息将携带最新盘面数据。");
      }
    }
    emitChanged();
  }

  /* The user turn that follows a (re)cast chart carries the chart data. */
  function buildUserContent(key, question) {
    const st = state[key];
    if (st.sentChartId === st.chartId) return question;
    const ctx = AIContext.serialize(key, st.payload);
    const renewed = st.messages.length
      ? "（注意：用户重新起盘，以下为最新盘面数据，请以此为准；之前对话基于旧盘。）\n\n" : "";
    return renewed + ctx + "\n\n【用户问题】\n" + question;
  }

  function apiMessages(key) {
    return [{ role: "system", content: AIContext.systemPrompt(key) }]
      .concat(state[key].messages.map(m => ({ role: m.role, content: m.content })));
  }

  /* ============================== Chat UI =============================== */

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function note(key, text) {
    const ui = state[key].ui;
    if (!ui) return;
    const n = el("div", "ai-note", escHtml(text));
    ui.msgs.appendChild(n);
    ui.msgs.scrollTop = ui.msgs.scrollHeight;
  }

  /* meta: "源名 · model" label on assistant bubbles; compare flags it */
  function addBubble(key, role, mdText, meta, isCompare) {
    const ui = state[key].ui;
    const b = el("div", "ai-msg ai-" + role + (isCompare ? " ai-cmp" : ""));
    b.appendChild(el("div", "ai-role", role === "user" ? "问" : "AI"));
    const wrap = el("div", "ai-bodywrap");
    if (role === "assistant" && meta) {
      wrap.appendChild(el("div", "ai-meta",
        escHtml(meta) + (isCompare ? ' <span class="ai-cmp-tag">对比 · 不计入上下文</span>' : "")));
    }
    const body = el("div", "ai-body");
    body.innerHTML = role === "user" ? "<p>" + escHtml(mdText).replace(/\n/g, "<br>") + "</p>" : mdToHtml(mdText);
    wrap.appendChild(body);
    b.appendChild(wrap);
    if (role === "assistant") {
      const cp = el("button", "ai-copy", "复制");
      cp.type = "button";
      cp.addEventListener("click", () => {
        navigator.clipboard && navigator.clipboard.writeText(b.dataset.raw || "");
        cp.textContent = "已复制"; setTimeout(() => (cp.textContent = "复制"), 1200);
      });
      b.appendChild(cp);
    }
    ui.msgs.appendChild(b);
    ui.msgs.scrollTop = ui.msgs.scrollHeight;
    return b;
  }

  function setBusy(key, busy) {
    const ui = state[key].ui;
    ui.sendBtn.classList.toggle("hidden", !!busy);
    ui.stopBtn.classList.toggle("hidden", !busy);
    ui.presetBtn.disabled = !!busy || !state[key].payload;
    ui.input.disabled = !!busy;
  }

  /* Run one model against the conversation; paint into its own bubble. */
  function runOne(key, target, msgs, isPrimary) {
    const st = state[key];
    const meta = target.source.name + " · " + target.model;
    const bubble = addBubble(key, "assistant", "", meta, !isPrimary);
    const wrap = bubble.querySelector(".ai-bodywrap");
    const body = bubble.querySelector(".ai-body");
    body.innerHTML = '<p class="ai-thinking">等待响应…</p>';

    let accC = "", accR = "";
    let reasoningBox = null;
    let pending = false;
    let finalized = false;     // once the final state is painted, queued
                               // rAF repaints must not clobber it
    const paint = () => {
      pending = false;
      if (finalized) return;
      if (accR && !reasoningBox) {
        reasoningBox = el("details", "ai-reasoning",
          "<summary>思考过程 reasoning</summary><div class='ai-reasoning-body'></div>");
        wrap.insertBefore(reasoningBox, body);
      }
      if (reasoningBox) reasoningBox.querySelector(".ai-reasoning-body").innerHTML =
        escHtml(accR).replace(/\n/g, "<br>");
      body.innerHTML = accC ? mdToHtml(accC) : '<p class="ai-thinking">' + (accR ? "模型思考中…" : "等待响应…") + "</p>";
      bubble.dataset.raw = accC || accR;
      state[key].ui.msgs.scrollTop = state[key].ui.msgs.scrollHeight;
    };
    const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(paint); } };

    const req = chat(target, msgs, (type, piece) => {
      if (type === "content") accC += piece; else accR += piece;
      schedule();
    });
    st.busy.push(req);

    const done = req.promise.then(r => {
      paint();
      finalized = true;
      if (!accC) {
        body.innerHTML = `<p class="ai-empty">⚠ 模型未返回正文${r && r.finish ? "（finish_reason: " + escHtml(r.finish) + "）" : ""}${accR ? "，仅有思考过程（可能思考耗尽了输出额度，可换模型或追问『重新简要回答』）" : "，请检查模型名是否正确或更换模型"}。</p>`;
        return { ok: false, target };
      }
      if (isPrimary) {
        st.messages.push({ role: "assistant", content: accC, reasoning: accR || undefined, source: target.source.name, model: target.model });
      }
      return { ok: true, target };
    }).catch(err => {
      const aborted = /abort/i.test(String(err && err.name)) || /abort/i.test(String(err));
      if (accC) {
        paint();
        finalized = true;
        if (isPrimary) st.messages.push({ role: "assistant", content: accC, source: target.source.name, model: target.model });
        note(key, (aborted ? "已停止生成" : "生成中断: " + (err && err.message ? err.message : err)) + ` (${meta})`);
        return { ok: true, target };
      }
      finalized = true;
      body.innerHTML = `<p class="ai-empty">${aborted ? "已停止。" : "✗ 请求失败: " + escHtml(String(err && err.message ? err.message : err))}</p>`;
      return { ok: false, target };
    });
    return done;
  }

  async function send(key, question, isPreset) {
    const st = state[key];
    if (st.busy) return;
    if (!st.payload) { note(key, "请先在上方点击计算/起盘，再使用 AI 分析。"); return; }
    const targets = currentTargets();
    if (!targets.length) { openSettings(); return; }

    const content = buildUserContent(key, question);
    st.sentChartId = st.chartId;
    const display = isPreset ? "【一键分析】" + question.split("\n")[0] : question;
    st.messages.push({ role: "user", content, display });
    addBubble(key, "user", display);

    const msgs = apiMessages(key);
    st.busy = [];
    setBusy(key, true);
    const results = await Promise.all(targets.map((t, i) => runOne(key, t, msgs, i === 0)));
    st.busy = null;
    setBusy(key, false);

    const primaryOk = results.length && results[0].ok;
    if (!primaryOk) {
      // primary produced nothing usable — drop the user turn from history
      const idx = st.messages.lastIndexOf(st.messages.filter(m => m.role === "user").pop());
      if (idx >= 0 && st.messages[idx].content === content) st.messages.splice(idx, 1);
      st.sentChartId = -1;                        // resend context next time
      note(key, "主模型未能回复，本轮已不计入对话上下文，可调整设置后重试。");
    }
    emitChanged();
  }

  /* ----------------------- model picker & compare ----------------------- */

  const packTarget = sel => sel.sourceId + "::" + sel.model;
  const unpackTarget = v => { const i = v.indexOf("::"); return { sourceId: v.slice(0, i), model: v.slice(i + 2) }; };

  function fillModelPick(sel) {
    sel.innerHTML = "";
    if (!settings.sources.length) {
      sel.add(new Option("未配置 — 点击⚙设置", ""));
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
    settings.sources.forEach(src => {
      if (!src.models.length) return;
      const og = document.createElement("optgroup");
      og.label = src.name;
      src.models.forEach(m => {
        const o = new Option(src.name + " · " + m, packTarget({ sourceId: src.id, model: m }));
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
    if (!sel.options.length) { sel.add(new Option("源中无模型 — 点击⚙设置", "")); sel.disabled = true; return; }
    const cur = settings.current && resolveTarget(settings.current) ? packTarget(settings.current) : null;
    if (cur && Array.from(sel.options).some(o => o.value === cur)) sel.value = cur;
    else { settings.current = unpackTarget(sel.options[0].value); saveSettings(); }
  }

  function refreshModelPicks() {
    MODULES.forEach(k => {
      const ui = state[k].ui;
      if (!ui) return;
      fillModelPick(ui.modelPick);
      const n = (settings.compare || []).filter(c => resolveTarget(c)).length;
      ui.compareBtn.textContent = n ? `⚖ 对比×${n}` : "⚖ 对比";
      ui.compareBtn.classList.toggle("on", n > 0);
    });
  }

  function openComparePicker() {
    const combos = [];
    settings.sources.forEach(src => src.models.forEach(m => combos.push({ sourceId: src.id, model: m, label: src.name + " · " + m })));
    const curKey = settings.current ? packTarget(settings.current) : "";
    const wrap = el("div", "ai-modal");
    wrap.innerHTML = `<div class="ai-modal-card card">
      <div class="ai-modal-head"><b>对比输出 <small>同一问题发给多个模型</small></b><button type="button" class="ai-x">×</button></div>
      <div class="ai-modal-body">
        <p class="ai-modal-note">勾选要额外对比的模型（最多 3 个）。当前主模型的回复进入对话上下文；对比模型仅展示，不影响后续追问。</p>
        <div class="ai-cmp-list">${combos.map(c => {
          const k = packTarget(c);
          if (k === curKey) return `<label class="dim"><input type="checkbox" disabled checked> ${escHtml(c.label)}（主模型）</label>`;
          const on = (settings.compare || []).some(x => packTarget(x) === k);
          return `<label><input type="checkbox" value="${escHtml(k)}" ${on ? "checked" : ""}> ${escHtml(c.label)}</label>`;
        }).join("")}</div>
      </div>
      <div class="ai-modal-foot"><button type="button" class="ai-cmp-clear">全部取消</button><button type="button" class="primary ai-cmp-ok">确定</button></div>
    </div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.addEventListener("click", e => { if (e.target === wrap) close(); });
    wrap.querySelector(".ai-x").addEventListener("click", close);
    wrap.querySelector(".ai-cmp-clear").addEventListener("click", () => {
      wrap.querySelectorAll("input[value]").forEach(i => { i.checked = false; });
    });
    wrap.querySelector(".ai-cmp-ok").addEventListener("click", () => {
      const picked = Array.from(wrap.querySelectorAll("input[value]:checked")).map(i => unpackTarget(i.value)).slice(0, 3);
      settings.compare = picked;
      saveSettings();
      refreshModelPicks();
      close();
    });
  }

  function buildChatSection(key) {
    const panel = document.getElementById(key);
    if (!panel) return;
    const sec = el("section", "ai-section card");
    sec.innerHTML = `
      <div class="ai-head">
        <span class="ai-title"><span class="cn">AI 智能解读</span> <small>AI Analysis</small></span>
        <select class="ai-model-pick" title="选择 API 源与模型"></select>
        <button type="button" class="ai-compare-btn" title="多模型对比输出">⚖ 对比</button>
        <span class="ai-actions">
          <button type="button" class="ai-preset">✦ 一键分析</button>
          <button type="button" class="ai-clear" title="清空当前对话">清空</button>
          <button type="button" class="ai-cfg" title="AI 设置">⚙ 设置</button>
        </span>
      </div>
      <div class="ai-msgs" aria-live="polite"></div>
      <form class="ai-inputrow">
        <textarea rows="2" placeholder="基于当前盘面继续提问，例如：明年适合换工作吗？ (Enter 发送，Shift+Enter 换行)"></textarea>
        <button type="submit" class="ai-send">发送</button>
        <button type="button" class="ai-stop hidden">■ 停止</button>
      </form>`;
    panel.appendChild(sec);

    const ui = {
      section: sec,
      msgs: sec.querySelector(".ai-msgs"),
      input: sec.querySelector("textarea"),
      sendBtn: sec.querySelector(".ai-send"),
      stopBtn: sec.querySelector(".ai-stop"),
      presetBtn: sec.querySelector(".ai-preset"),
      modelPick: sec.querySelector(".ai-model-pick"),
      compareBtn: sec.querySelector(".ai-compare-btn"),
    };
    state[key].ui = ui;
    ui.presetBtn.disabled = !state[key].payload;

    ui.modelPick.addEventListener("change", () => {
      if (!ui.modelPick.value) return;
      settings.current = unpackTarget(ui.modelPick.value);
      saveSettings();
      refreshModelPicks();
    });
    ui.compareBtn.addEventListener("click", () => {
      if (!settings.sources.length) { openSettings(); return; }
      openComparePicker();
    });
    ui.presetBtn.addEventListener("click", () => send(key, AIContext.preset(key), true));
    sec.querySelector(".ai-clear").addEventListener("click", () => {
      state[key].messages = [];
      state[key].sentChartId = -1;
      ui.msgs.innerHTML = "";
      emitChanged();
    });
    sec.querySelector(".ai-cfg").addEventListener("click", openSettings);
    sec.querySelector(".ai-inputrow").addEventListener("submit", e => {
      e.preventDefault();
      const q = ui.input.value.trim();
      if (!q) return;
      ui.input.value = "";
      send(key, q, false);
    });
    ui.input.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sec.querySelector(".ai-inputrow").requestSubmit();
      }
    });
    ui.stopBtn.addEventListener("click", () => { (state[key].busy || []).forEach(r => r.abort()); });
  }

  /* ------------------- conversation export / import -------------------- */

  function exportChat(key) { return state[key].messages.slice(); }

  function importChat(key, messages) {
    const st = state[key];
    st.messages = (messages || []).slice();
    st.sentChartId = st.chartId;     // restored chart matches the conversation
    if (!st.ui) return;
    st.ui.msgs.innerHTML = "";
    st.messages.forEach(m => {
      if (m.role === "user") addBubble(key, "user", m.display || "【含盘面数据的提问】");
      else {
        const b = addBubble(key, "assistant", m.content, (m.source ? m.source + " · " : "") + (m.model || ""));
        b.dataset.raw = m.content;
      }
    });
    if (st.messages.length) note(key, "已恢复上次的对话。");
  }

  /* =========================== Settings modal =========================== */

  let modal = null;
  let draft = null;          // working copy of sources while the modal is open
  let draftIdx = 0;

  function blankSource() {
    return { id: newSourceId(), name: "", baseUrl: "", apiKey: "", models: [] };
  }

  function buildModal() {
    modal = el("div", "ai-modal hidden");
    modal.innerHTML = `
      <div class="ai-modal-card card" role="dialog" aria-modal="true" aria-label="AI 设置">
        <div class="ai-modal-head">
          <b>AI 设置 <small>OpenAI-Compatible API · 可配置多个源</small></b>
          <button type="button" class="ai-x" aria-label="关闭">×</button>
        </div>
        <div class="ai-modal-body">
          <label>API 源 <small>(每个源 = 一个服务商/端点)</small>
            <span class="ai-model-row">
              <select id="ai-src-select"></select>
              <button type="button" id="ai-src-add">＋ 新增源</button>
              <button type="button" id="ai-src-del">🗑 删除</button>
            </span>
          </label>
          <label>名称 <input id="ai-src-name" placeholder="如 DeepSeek / 本地Ollama" autocomplete="off"></label>
          <label>Base URL <small>(到 /v1 为止，如 https://api.openai.com/v1)</small>
            <input type="url" id="ai-baseurl" placeholder="https://api.openai.com/v1" autocomplete="off" spellcheck="false">
          </label>
          <label>API Key
            <input type="password" id="ai-apikey" placeholder="sk-…" autocomplete="off">
          </label>
          <label>模型列表 <small>(每行一个；聊天界面的模型下拉从这里读取，可手动增删)</small>
            <textarea id="ai-models" rows="5" placeholder="gpt-4o-mini&#10;deepseek-chat" spellcheck="false"></textarea>
            <span class="ai-model-row">
              <button type="button" id="ai-fetch-models">⇣ 拉取模型列表</button>
            </span>
          </label>
          <label>随机性 Temperature: <output id="ai-temp-out"></output>
            <input type="range" id="ai-temp" min="0" max="1.5" step="0.1">
          </label>
          <p class="ai-modal-msg" id="ai-modal-msg"></p>
          <p class="ai-modal-note">兼容任何 OpenAI 格式的服务：OpenAI、DeepSeek、Moonshot/Kimi、智谱、通义、Ollama (http://localhost:11434/v1)、LM Studio、OpenRouter 等。密钥仅保存在本机 (localStorage)。聊天窗口顶部可切换模型、勾选多模型对比输出。</p>
        </div>
        <div class="ai-modal-foot">
          <button type="button" id="ai-test">测试连接</button>
          <button type="button" id="ai-save" class="primary">保存全部</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const msg = (t, ok) => {
      const m = $("#ai-modal-msg");
      m.textContent = t || "";
      m.className = "ai-modal-msg" + (t ? (ok ? " ok" : " err") : "");
    };

    const readSrcForm = () => {
      const s = draft[draftIdx];
      s.name = $("#ai-src-name").value.trim() || guessName($("#ai-baseurl").value.trim());
      s.baseUrl = $("#ai-baseurl").value.trim();
      s.apiKey = $("#ai-apikey").value.trim();
      s.models = $("#ai-models").value.split("\n").map(x => x.trim()).filter(Boolean);
    };
    const writeSrcForm = () => {
      const s = draft[draftIdx];
      $("#ai-src-name").value = s.name;
      $("#ai-baseurl").value = s.baseUrl;
      $("#ai-apikey").value = s.apiKey;
      $("#ai-models").value = s.models.join("\n");
    };
    const refreshSrcSelect = () => {
      const sel = $("#ai-src-select");
      sel.innerHTML = "";
      draft.forEach((s, i) => sel.add(new Option(s.name || s.baseUrl || `源 ${i + 1}`, i)));
      sel.value = draftIdx;
    };

    modal.addEventListener("click", e => { if (e.target === modal) closeSettings(); });
    modal.querySelector(".ai-x").addEventListener("click", closeSettings);
    document.addEventListener("keydown", e => { if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) closeSettings(); });
    $("#ai-temp").addEventListener("input", () => { $("#ai-temp-out").textContent = $("#ai-temp").value; });

    $("#ai-src-select").addEventListener("change", () => {
      readSrcForm();
      draftIdx = +$("#ai-src-select").value;
      writeSrcForm();
      refreshSrcSelect();
      msg("");
    });
    $("#ai-src-add").addEventListener("click", () => {
      readSrcForm();
      draft.push(blankSource());
      draftIdx = draft.length - 1;
      writeSrcForm();
      refreshSrcSelect();
      $("#ai-src-name").focus();
    });
    $("#ai-src-del").addEventListener("click", () => {
      if (draft.length <= 1) { draft = [blankSource()]; draftIdx = 0; }
      else { draft.splice(draftIdx, 1); draftIdx = Math.max(0, draftIdx - 1); }
      writeSrcForm();
      refreshSrcSelect();
    });

    $("#ai-fetch-models").addEventListener("click", async () => {
      readSrcForm();
      const s = draft[draftIdx];
      if (!s.baseUrl) { msg("请先填写 Base URL", false); return; }
      const btn = $("#ai-fetch-models");
      btn.disabled = true; btn.textContent = "拉取中…";
      try {
        const models = await listModels(s);
        s.models = models;
        $("#ai-models").value = models.join("\n");
        msg(`已拉取 ${models.length} 个模型，可在上方文本框手动删减，保留常用的即可。`, true);
      } catch (err) {
        msg("拉取失败: " + err.message + "（也可以直接在文本框手动填写模型名）", false);
      } finally {
        btn.disabled = false; btn.textContent = "⇣ 拉取模型列表";
      }
    });

    $("#ai-test").addEventListener("click", async () => {
      readSrcForm();
      const s = draft[draftIdx];
      const model = s.models[0];
      const btn = $("#ai-test");
      btn.disabled = true; btn.textContent = "测试中…";
      try {
        if (!s.baseUrl || !model) throw new Error("请先填写 Base URL 和至少一个模型名");
        let out = "";
        await chat({ source: s, model }, [{ role: "user", content: "请只回复两个字：成功" }],
          (type, p) => { if (type === "content") out += p; }).promise;
        msg(`连接成功 (${model})，模型回复: ` + (out.slice(0, 60) || "（无正文，但请求成功）"), true);
      } catch (err) {
        msg("连接失败: " + err.message, false);
      } finally {
        btn.disabled = false; btn.textContent = "测试连接";
      }
    });

    $("#ai-save").addEventListener("click", () => {
      readSrcForm();
      settings.sources = draft.filter(s => s.baseUrl);
      settings.temperature = parseFloat($("#ai-temp").value);
      // drop selections that no longer resolve
      if (!resolveTarget(settings.current)) {
        settings.current = null;
        const first = settings.sources.find(s => s.models.length);
        if (first) settings.current = { sourceId: first.id, model: first.models[0] };
      }
      settings.compare = (settings.compare || []).filter(c => resolveTarget(c));
      saveSettings();
      refreshModelPicks();
      msg("已保存。", true);
      setTimeout(closeSettings, 350);
    });
  }

  function openSettings() {
    if (!modal) buildModal();
    draft = JSON.parse(JSON.stringify(settings.sources));
    if (!draft.length) draft = [blankSource()];
    draftIdx = 0;
    const sel = $("#ai-src-select");
    sel.innerHTML = "";
    draft.forEach((s, i) => sel.add(new Option(s.name || s.baseUrl || `源 ${i + 1}`, i)));
    sel.value = 0;
    $("#ai-src-name").value = draft[0].name;
    $("#ai-baseurl").value = draft[0].baseUrl;
    $("#ai-apikey").value = draft[0].apiKey;
    $("#ai-models").value = draft[0].models.join("\n");
    $("#ai-temp").value = settings.temperature;
    $("#ai-temp-out").textContent = settings.temperature;
    $("#ai-modal-msg").textContent = "";
    modal.classList.remove("hidden");
    $("#ai-baseurl").focus();
  }
  function closeSettings() { if (modal) modal.classList.add("hidden"); }

  /* ============================== Bootstrap ============================= */

  function init() {
    MODULES.forEach(buildChatSection);
    refreshModelPicks();
    const header = document.querySelector(".header-inner");
    if (header) {
      const btn = el("button", "ai-header-btn", "⚙ AI 设置");
      btn.type = "button";
      btn.addEventListener("click", openSettings);
      header.appendChild(btn);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return {
    setChart, openSettings, onChanged, exportChat, importChat,
    get settings() { return settings; },
  };
})();
