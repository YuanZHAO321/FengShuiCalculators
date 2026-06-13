/* =========================================================================
 * store.js — local persistence:
 *   · session: the four calculators' inputs + results + AI conversations
 *     are saved on every change / on exit and restored on next launch
 *   · archive (本地档案库): named saves per calculator — inputs only, or
 *     inputs together with the AI conversation — list / load / delete
 *
 * Everything lives in localStorage; nothing leaves the machine.
 * Loads after app.js + ai.js: forms exist and submit handlers are bound,
 * so restoring = fill fields → requestSubmit() → AI.importChat().
 * ========================================================================= */

(function () {
  "use strict";
  const $ = sel => document.querySelector(sel);

  const SESSION_KEY = "fsc-session-v1";
  const DB_KEY = "fsc-archive-v1";

  const MODULES = {
    bazi:        { label: "八字",     form: "#bazi-form",   result: "#bazi-result",
                   fields: ["bz-date", "bz-time", "bz-hourknown", "bz-gender", "bz-tz"] },
    flyingstars: { label: "玄空飞星", form: "#fs-form",     result: "#fs-result",
                   fields: ["fs-period", "fs-facing", "fs-year"] },
    tongshu:     { label: "通书",     form: "#ts-form",     result: "#tongshu-result",
                   fields: ["ts-date", "ts-time", "ts-tz"] },
    qimen:       { label: "奇门遁甲", form: "#qm-form",     result: "#qimen-result",
                   fields: ["qm-date", "qm-time", "qm-tz"] },
  };
  const KEYS = Object.keys(MODULES);

  /* --------------------------- form capture ---------------------------- */

  function captureForm(key) {
    const out = {};
    MODULES[key].fields.forEach(id => {
      const e = document.getElementById(id);
      if (!e) return;
      out[id] = e.type === "checkbox" ? e.checked : e.value;
    });
    return out;
  }
  function applyForm(key, data) {
    if (!data) return;
    MODULES[key].fields.forEach(id => {
      const e = document.getElementById(id);
      if (!e || !(id in data)) return;
      if (e.type === "checkbox") e.checked = !!data[id];
      else e.value = data[id];
    });
  }
  const hasResult = key => ($(MODULES[key].result) || { innerHTML: "" }).innerHTML !== "";
  const recast = key => { const f = $(MODULES[key].form); if (f) f.requestSubmit(); };

  /* describe the inputs for a default archive name, e.g. "八字 1990-01-01 12:00" */
  function describe(key, fields) {
    const f = fields || captureForm(key);
    if (key === "flyingstars") {
      return `${MODULES[key].label} ${f["fs-period"]}运 向${f["fs-facing"]}` + (f["fs-year"] && f["fs-year"] !== "0" ? ` 流年${f["fs-year"]}` : "");
    }
    const date = f[Object.keys(f).find(k => /-date$/.test(k))] || "";
    const time = f[Object.keys(f).find(k => /-time$/.test(k))] || "";
    const extra = key === "bazi" ? (f["bz-gender"] === "Female" ? " 女" : " 男") : "";
    return `${MODULES[key].label} ${date} ${time}${extra}`;
  }

  /* ----------------------------- session ------------------------------- */

  function saveSession() {
    const data = { savedAt: Date.now(), modules: {} };
    KEYS.forEach(key => {
      data.modules[key] = {
        fields: captureForm(key),
        hasResult: hasResult(key),
        messages: AI.exportChat(key),
      };
    });
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch (e) { /* quota/private */ }
  }

  function restoreSession() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (e) { /* corrupt */ }
    if (!data || !data.modules) return;
    KEYS.forEach(key => {
      const m = data.modules[key];
      if (!m) return;
      applyForm(key, m.fields);
      if (m.hasResult) recast(key);
      if (m.messages && m.messages.length) AI.importChat(key, m.messages);
    });
  }

  /* ----------------------------- archive ------------------------------- */

  function dbAll() {
    try { return JSON.parse(localStorage.getItem(DB_KEY) || "[]"); } catch (e) { return []; }
  }
  function dbWrite(list) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(list)); return true; }
    catch (e) { toast("保存失败：本地存储空间不足"); return false; }
  }

  function dbSave(key, name, withAI) {
    const entry = {
      id: "a-" + Date.now() + "-" + Math.floor(Math.random() * 1e4),
      name: name || describe(key),
      module: key,
      savedAt: Date.now(),
      fields: captureForm(key),
      withAI: !!withAI,
    };
    if (withAI) entry.messages = AI.exportChat(key);
    const list = dbAll();
    list.unshift(entry);
    if (dbWrite(list)) toast(`已存档「${entry.name}」`);
  }

  function dbLoad(id) {
    const entry = dbAll().find(x => x.id === id);
    if (!entry) return;
    applyForm(entry.module, entry.fields);
    recast(entry.module);
    if (entry.withAI && entry.messages) AI.importChat(entry.module, entry.messages);
    toast(`已加载「${entry.name}」`);
  }

  function dbDelete(id) {
    dbWrite(dbAll().filter(x => x.id !== id));
  }

  /* ------------------------------- UI ---------------------------------- */

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  const escHtml = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  let toastEl = null;
  function toast(text) {
    if (!toastEl) { toastEl = el("div", "db-toast hidden"); document.body.appendChild(toastEl); }
    toastEl.textContent = text;
    toastEl.classList.remove("hidden");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.add("hidden"), 2200);
  }

  function modalShell(title, bodyHtml, footHtml) {
    const wrap = el("div", "ai-modal");
    wrap.innerHTML = `<div class="ai-modal-card card">
      <div class="ai-modal-head"><b>${title}</b><button type="button" class="ai-x">×</button></div>
      <div class="ai-modal-body">${bodyHtml}</div>
      ${footHtml ? `<div class="ai-modal-foot">${footHtml}</div>` : ""}
    </div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.addEventListener("click", e => { if (e.target === wrap) close(); });
    wrap.querySelector(".ai-x").addEventListener("click", close);
    return { wrap, close };
  }

  function openSaveModal(key) {
    if (!hasResult(key)) { toast("请先计算/起盘，再存档。"); return; }
    const hasChat = AI.exportChat(key).length > 0;
    const { wrap, close } = modalShell(
      `存档 <small>${MODULES[key].label}</small>`,
      `<label>档案名称
         <input id="db-name" value="${escHtml(describe(key))}" autocomplete="off">
       </label>
       <label class="db-check"><input type="checkbox" id="db-withai" ${hasChat ? "checked" : "disabled"}>
         连同 AI 对话一起保存${hasChat ? "" : "（当前无对话）"}</label>
       <p class="ai-modal-note">仅保存输入参数${hasChat ? "或连带 AI 分析结果" : ""}；加载时自动重新起盘。数据保存在本机。</p>`,
      `<button type="button" class="primary" id="db-save-ok">保存</button>`);
    wrap.querySelector("#db-name").select();
    const doSave = () => {
      dbSave(key, wrap.querySelector("#db-name").value.trim(), wrap.querySelector("#db-withai").checked);
      close();
    };
    wrap.querySelector("#db-save-ok").addEventListener("click", doSave);
    wrap.querySelector("#db-name").addEventListener("keydown", e => { if (e.key === "Enter") doSave(); });
  }

  function openArchiveModal(key) {
    const render = () => {
      const list = dbAll().filter(x => x.module === key);
      if (!list.length) return `<p class="ai-modal-note">暂无档案。先在上方计算，然后点「💾 存档」。</p>`;
      return `<div class="db-list">` + list.map(x => {
        const d = new Date(x.savedAt);
        const pad = n => String(n).padStart(2, "0");
        const when = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        return `<div class="db-item" data-id="${x.id}">
          <div class="db-item-main"><b>${escHtml(x.name)}</b>
            <small>${when}${x.withAI ? ' · <span class="db-ai-badge">含AI对话</span>' : ""}</small></div>
          <span class="db-item-btns">
            <button type="button" class="primary db-load">加载</button>
            <button type="button" class="db-del">删除</button>
          </span>
        </div>`;
      }).join("") + `</div>`;
    };
    const { wrap, close } = modalShell(`档案库 <small>${MODULES[key].label}</small>`, render(), "");
    const body = wrap.querySelector(".ai-modal-body");
    body.addEventListener("click", e => {
      const item = e.target.closest(".db-item");
      if (!item) return;
      if (e.target.closest(".db-load")) { dbLoad(item.dataset.id); close(); }
      else if (e.target.closest(".db-del")) { dbDelete(item.dataset.id); body.innerHTML = render(); }
    });
  }

  function injectButtons() {
    KEYS.forEach(key => {
      const form = $(MODULES[key].form);
      if (!form) return;
      const save = el("button", "now-btn db-save-btn", "💾 存档");
      save.type = "button";
      save.title = "将当前输入(可选连同AI对话)命名保存到本地档案库";
      save.addEventListener("click", () => openSaveModal(key));
      const open = el("button", "now-btn db-open-btn", "📂 档案库");
      open.type = "button";
      open.title = "从本地档案库加载已保存的盘";
      open.addEventListener("click", () => openArchiveModal(key));
      form.appendChild(save);
      form.appendChild(open);
    });
  }

  /* ----------------------------- bootstrap ------------------------------ */

  let saveTimer = null;
  const scheduleSave = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveSession, 400); };

  function init() {
    injectButtons();
    restoreSession();
    AI.onChanged(scheduleSave);                       // charts & conversations
    Object.values(MODULES).forEach(m => {             // raw form edits
      const f = $(m.form);
      if (f) f.addEventListener("change", scheduleSave);
    });
    window.addEventListener("beforeunload", saveSession);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveSession();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.FscStore = { saveSession, dbAll };           // for tests/debugging
})();
