/* =========================================================================
 * ai.js — OpenAI-compatible AI integration:
 *   · settings panel (base URL / API key / model, auto-fetched or manual)
 *   · one-click preset analysis per calculator
 *   · follow-up chat per calculator, streaming with non-stream fallback
 *
 * HTTP goes through window.aiBridge (Electron IPC proxy, no CORS) when
 * present, otherwise plain fetch (works in browsers against providers
 * that send CORS headers, e.g. api.openai.com).
 * ========================================================================= */

const AI = (function () {
  "use strict";
  const $ = sel => document.querySelector(sel);

  /* ============================== Settings ============================== */

  const SETTINGS_KEY = "fsc-ai-settings";
  const DEFAULTS = { baseUrl: "", apiKey: "", model: "", temperature: 0.7 };

  function loadSettings() {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); }
    catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function saveSettings(s) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
  }
  let settings = loadSettings();
  const configured = () => !!(settings.baseUrl && settings.model);

  /* base may be given with or without trailing slash; endpoints appended */
  function endpoint(path) {
    return settings.baseUrl.replace(/\/+$/, "") + path;
  }
  function authHeaders() {
    const h = { "Content-Type": "application/json" };
    if (settings.apiKey) h["Authorization"] = "Bearer " + settings.apiKey;
    return h;
  }

  /* ============================ HTTP layer ============================== */

  const hasBridge = () => typeof window !== "undefined" && !!window.aiBridge;

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

  async function listModels() {
    const r = await httpJSON(endpoint("/models"), { headers: authHeaders() });
    if (r.status < 200 || r.status >= 300) {
      throw new Error("HTTP " + r.status + (r.json && r.json.error ? " — " + (r.json.error.message || JSON.stringify(r.json.error)) : ""));
    }
    const data = r.json && (Array.isArray(r.json.data) ? r.json.data : Array.isArray(r.json) ? r.json : null);
    if (!data) throw new Error("响应不是模型列表 (no data[])");
    return data.map(m => m.id || m.name || String(m)).filter(Boolean).sort();
  }

  /* Extract assistant text from a (possibly partial) chat-completions JSON. */
  function deltaText(j) {
    const c = j && j.choices && j.choices[0];
    if (!c) return "";
    if (c.delta && typeof c.delta.content === "string") return c.delta.content;
    if (c.message && typeof c.message.content === "string") return c.message.content;
    if (typeof c.text === "string") return c.text;
    return "";
  }

  /* Streamed chat with automatic fallback to non-streaming providers.
   * onDelta(textPiece). Returns { promise, abort }. */
  function chat(messages, onDelta) {
    const url = endpoint("/chat/completions");
    const base = { model: settings.model, messages, temperature: Number(settings.temperature) };
    let gotAny = false;
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
          const piece = deltaText(JSON.parse(payload));
          if (piece) { gotAny = true; onDelta(piece); }
        } catch (e) { /* partial JSON line — wait for more */ }
      }
    }

    let inner = httpStream(url, {
      headers: authHeaders(),
      body: JSON.stringify(Object.assign({ stream: true }, base)),
    }, consumeSSE);

    let aborted = false;
    const promise = inner.promise.catch(async err => {
      if (aborted || gotAny) throw err;           // real failure mid-stream
      // streaming not supported / rejected — retry without stream
      const r = await httpJSON(url, { method: "POST", headers: authHeaders(), body: JSON.stringify(base) });
      if (r.status < 200 || r.status >= 300) {
        const msg = r.json && r.json.error ? (r.json.error.message || JSON.stringify(r.json.error)) : r.text.slice(0, 300);
        throw new Error("HTTP " + r.status + " — " + msg);
      }
      const piece = deltaText(r.json);
      if (!piece) throw new Error("响应中没有内容 (empty completion)");
      onDelta(piece);
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

  /* Per-module state: latest chart payload + conversation. */
  const MODULES = ["bazi", "flyingstars", "tongshu", "qimen"];
  const state = {};
  MODULES.forEach(k => {
    state[k] = {
      payload: null,        // {result, input}
      chartId: 0,           // bumps on every new chart
      sentChartId: -1,      // chartId included in the conversation so far
      messages: [],         // conversation without the system message
      busy: null,           // {abort} while a request is running
      ui: null,
    };
  });

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
  }

  /* Build the message list for the API: system + history, where the user
   * turn that follows a (re)cast chart carries the serialized chart data. */
  function buildUserContent(key, question) {
    const st = state[key];
    if (st.sentChartId === st.chartId) return question;
    const ctx = AIContext.serialize(key, st.payload);
    const renewed = st.messages.length
      ? "（注意：用户重新起盘，以下为最新盘面数据，请以此为准；之前对话基于旧盘。）\n\n" : "";
    return renewed + ctx + "\n\n【用户问题】\n" + question;
  }

  function apiMessages(key) {
    return [{ role: "system", content: AIContext.systemPrompt(key) }].concat(state[key].messages);
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
    const n = el("div", "ai-note", escHtml(text));
    ui.msgs.appendChild(n);
    ui.msgs.scrollTop = ui.msgs.scrollHeight;
  }

  function addBubble(key, role, mdText) {
    const ui = state[key].ui;
    const b = el("div", "ai-msg ai-" + role);
    const label = role === "user" ? "问" : "AI";
    b.appendChild(el("div", "ai-role", label));
    const body = el("div", "ai-body");
    body.innerHTML = role === "user" ? "<p>" + escHtml(mdText).replace(/\n/g, "<br>") + "</p>" : mdToHtml(mdText);
    b.appendChild(body);
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

  async function send(key, question, isPreset) {
    const st = state[key];
    if (st.busy) return;
    if (!st.payload) { note(key, "请先在上方点击计算/起盘，再使用 AI 分析。"); return; }
    if (!configured()) { openSettings(); return; }

    const content = buildUserContent(key, question);
    st.sentChartId = st.chartId;
    st.messages.push({ role: "user", content });
    addBubble(key, "user", isPreset ? "【一键分析】" + question.split("\n")[0] : question);

    const bubble = addBubble(key, "assistant", "");
    const body = bubble.querySelector(".ai-body");
    body.innerHTML = '<p class="ai-thinking">思考中…</p>';
    let acc = "";
    let pending = false;
    const paint = () => {
      pending = false;
      body.innerHTML = mdToHtml(acc);
      bubble.dataset.raw = acc;
      state[key].ui.msgs.scrollTop = state[key].ui.msgs.scrollHeight;
    };

    const req = chat(apiMessages(key), piece => {
      acc += piece;
      if (!pending) { pending = true; requestAnimationFrame(paint); }
    });
    st.busy = req;
    setBusy(key, true);
    try {
      await req.promise;
      paint();
      st.messages.push({ role: "assistant", content: acc });
    } catch (err) {
      const aborted = /abort/i.test(String(err && err.name)) || /abort/i.test(String(err));
      if (acc) {                                  // keep the partial answer
        paint();
        st.messages.push({ role: "assistant", content: acc });
        note(key, aborted ? "已停止生成。" : "生成中断: " + (err && err.message ? err.message : err));
      } else {
        st.messages.pop();                        // drop the failed user turn
        st.sentChartId = -1;                      // resend context next time
        bubble.remove();
        note(key, aborted ? "已停止生成。"
          : "请求失败: " + (err && err.message ? err.message : err) + " — 请检查 AI 设置(Base URL / API Key / 模型)。");
      }
    } finally {
      st.busy = null;
      setBusy(key, false);
    }
  }

  function buildChatSection(key) {
    const panel = document.getElementById(key);
    if (!panel) return;
    const sec = el("section", "ai-section card");
    sec.innerHTML = `
      <div class="ai-head">
        <span class="ai-title"><span class="cn">AI 智能解读</span> <small>AI Analysis</small></span>
        <span class="ai-status" title="AI 配置状态"></span>
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
      status: sec.querySelector(".ai-status"),
    };
    state[key].ui = ui;
    ui.presetBtn.disabled = !state[key].payload;

    ui.presetBtn.addEventListener("click", () => send(key, AIContext.preset(key), true));
    sec.querySelector(".ai-clear").addEventListener("click", () => {
      state[key].messages = [];
      state[key].sentChartId = -1;
      ui.msgs.innerHTML = "";
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
    ui.stopBtn.addEventListener("click", () => { if (state[key].busy) state[key].busy.abort(); });
    refreshStatus();
  }

  function refreshStatus() {
    MODULES.forEach(k => {
      const ui = state[k].ui;
      if (!ui) return;
      ui.status.textContent = configured() ? "● " + settings.model : "○ 未配置";
      ui.status.classList.toggle("ok", configured());
    });
  }

  /* =========================== Settings modal =========================== */

  let modal = null;

  function buildModal() {
    modal = el("div", "ai-modal hidden");
    modal.innerHTML = `
      <div class="ai-modal-card card" role="dialog" aria-modal="true" aria-label="AI 设置">
        <div class="ai-modal-head">
          <b>AI 设置 <small>OpenAI-Compatible API</small></b>
          <button type="button" class="ai-x" aria-label="关闭">×</button>
        </div>
        <div class="ai-modal-body">
          <label>Base URL <small>(到 /v1 为止，如 https://api.openai.com/v1)</small>
            <input type="url" id="ai-baseurl" placeholder="https://api.openai.com/v1" autocomplete="off" spellcheck="false">
          </label>
          <label>API Key
            <input type="password" id="ai-apikey" placeholder="sk-…" autocomplete="off">
          </label>
          <label>模型 Model <small>(可点击「拉取模型」自动获取，或直接手动填写)</small>
            <span class="ai-model-row">
              <input id="ai-model" list="ai-model-list" placeholder="gpt-4o-mini / deepseek-chat / …" autocomplete="off" spellcheck="false">
              <datalist id="ai-model-list"></datalist>
              <button type="button" id="ai-fetch-models">⇣ 拉取模型</button>
            </span>
          </label>
          <label>随机性 Temperature: <output id="ai-temp-out"></output>
            <input type="range" id="ai-temp" min="0" max="1.5" step="0.1">
          </label>
          <p class="ai-modal-msg" id="ai-modal-msg"></p>
          <p class="ai-modal-note">兼容任何 OpenAI 格式的服务：OpenAI、DeepSeek、Moonshot/Kimi、智谱、通义、Ollama (http://localhost:11434/v1)、LM Studio、OpenRouter 等。密钥仅保存在本机 (localStorage)。浏览器直接打开时部分服务可能受 CORS 限制，桌面版无此问题。</p>
        </div>
        <div class="ai-modal-foot">
          <button type="button" id="ai-test">测试连接</button>
          <button type="button" id="ai-save" class="primary">保存</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const msg = (t, ok) => {
      const m = $("#ai-modal-msg");
      m.textContent = t || "";
      m.className = "ai-modal-msg" + (t ? (ok ? " ok" : " err") : "");
    };
    const readForm = () => ({
      baseUrl: $("#ai-baseurl").value.trim(),
      apiKey: $("#ai-apikey").value.trim(),
      model: $("#ai-model").value.trim(),
      temperature: parseFloat($("#ai-temp").value),
    });

    modal.addEventListener("click", e => { if (e.target === modal) closeSettings(); });
    modal.querySelector(".ai-x").addEventListener("click", closeSettings);
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.classList.contains("hidden")) closeSettings(); });
    $("#ai-temp").addEventListener("input", () => { $("#ai-temp-out").textContent = $("#ai-temp").value; });

    $("#ai-fetch-models").addEventListener("click", async () => {
      const prev = settings;
      settings = Object.assign({}, settings, readForm());   // use the form values for this call
      const btn = $("#ai-fetch-models");
      btn.disabled = true; btn.textContent = "拉取中…";
      try {
        const models = await listModels();
        const dl = $("#ai-model-list");
        dl.innerHTML = models.map(m => `<option value="${escHtml(m)}">`).join("");
        if (!$("#ai-model").value && models.length) $("#ai-model").value = models[0];
        msg(`已获取 ${models.length} 个模型，输入框可下拉选择。`, true);
      } catch (err) {
        msg("拉取失败: " + err.message + "（也可以直接手动填写模型名）", false);
      } finally {
        settings = prev;
        btn.disabled = false; btn.textContent = "⇣ 拉取模型";
      }
    });

    $("#ai-test").addEventListener("click", async () => {
      const prev = settings;
      settings = Object.assign({}, settings, readForm());
      const btn = $("#ai-test");
      btn.disabled = true; btn.textContent = "测试中…";
      try {
        if (!settings.baseUrl || !settings.model) throw new Error("请先填写 Base URL 和模型名");
        let out = "";
        await chat([{ role: "user", content: "请只回复两个字：成功" }], p => { out += p; }).promise;
        msg("连接成功，模型回复: " + out.slice(0, 60), true);
      } catch (err) {
        msg("连接失败: " + err.message, false);
      } finally {
        settings = prev;
        btn.disabled = false; btn.textContent = "测试连接";
      }
    });

    $("#ai-save").addEventListener("click", () => {
      settings = Object.assign({}, settings, readForm());
      saveSettings(settings);
      refreshStatus();
      msg("已保存。", true);
      setTimeout(closeSettings, 350);
    });
  }

  function openSettings() {
    if (!modal) buildModal();
    $("#ai-baseurl").value = settings.baseUrl;
    $("#ai-apikey").value = settings.apiKey;
    $("#ai-model").value = settings.model;
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
    // global settings entry in the header
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

  return { setChart, openSettings, get settings() { return settings; } };
})();
