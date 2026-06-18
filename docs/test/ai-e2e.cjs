/* AI pipeline e2e: a mock OpenAI-compatible server (SSE streaming with
 * reasoning_content, plus a model that returns no content) drives the real
 * chat UI through the Electron IPC bridge — verifies reasoning display,
 * empty-reply diagnostics, compare mode and source·model labels.
 * Run: npx electron docs/test/ai-e2e.cjs */
"use strict";
const { app, BrowserWindow } = require("electron");
const { registerAiProxy } = require("../../electron/ai-proxy");
const path = require("path");
const fs = require("fs");
const http = require("http");

const errors = [];

function sse(res, obj) { res.write("data: " + JSON.stringify(obj) + "\n\n"); }

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", c => (body += c));
  req.on("end", () => {
    if (req.url.endsWith("/models")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: [{ id: "mock-r1" }, { id: "mock-empty" }] }));
      return;
    }
    if (req.url.endsWith("/chat/completions")) {
      const j = JSON.parse(body);
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      if (j.model === "mock-empty") {            // reasoning only, no content
        sse(res, { choices: [{ delta: { reasoning_content: "我在思考但是不会回答……" } }] });
        sse(res, { choices: [{ delta: {}, finish_reason: "length" }] });
      } else {                                   // reasoning then real answer
        sse(res, { choices: [{ delta: { reasoning_content: "推理第一步；" } }] });
        sse(res, { choices: [{ delta: { reasoning_content: "推理第二步。" } }] });
        sse(res, { choices: [{ delta: { content: "**总评**：此盘" } }] });
        sse(res, { choices: [{ delta: { content: "五行流通，日主得令。" } }] });
        sse(res, { choices: [{ delta: {}, finish_reason: "stop" }] });
      }
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }
    res.writeHead(404); res.end();
  });
});

registerAiProxy();
app.whenReady().then(() => server.listen(0, "127.0.0.1", async () => {
  const base = `http://127.0.0.1:${server.address().port}/v1`;
  const win = new BrowserWindow({
    width: 1180, height: 1400, show: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "..", "electron", "preload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  });
  win.webContents.on("console-message", (_e, level, message) => { if (level >= 3) errors.push(message); });
  await win.loadFile(path.join(__dirname, "..", "index.html"));
  win.showInactive();
  await new Promise(r => setTimeout(r, 1500));

  // configure two models on one mock source, compare = mock-empty
  // (also wipe in-memory chats — the beforeunload save-on-exit would
  //  otherwise write them back right after the clear)
  await win.webContents.executeJavaScript(`
    localStorage.clear();
    ['bazi','flyingstars','tongshu','qimen'].forEach(k => AI.importChat(k, []));
    localStorage.setItem('fsc-ai-settings', JSON.stringify({
      sources: [{ id: 'src-mock', name: 'Mock源', baseUrl: ${JSON.stringify(base)}, apiKey: 'k', models: ['mock-r1', 'mock-empty'] }],
      current: { sourceId: 'src-mock', model: 'mock-r1' },
      compare: [{ sourceId: 'src-mock', model: 'mock-empty' }],
      temperature: 0.7,
    })); true`);
  await win.webContents.reload();
  await new Promise(r => setTimeout(r, 1800));

  // cast bazi chart + one-click analysis
  await win.webContents.executeJavaScript(`
    document.querySelector('[data-tab="bazi"]').click();
    document.querySelector('#bazi-form').requestSubmit();
    document.querySelector('#bazi .ai-preset').click(); true`);
  await new Promise(r => setTimeout(r, 2500));

  const probe = await win.webContents.executeJavaScript(`(() => {
    const msgs = document.querySelector('#bazi .ai-msgs');
    const asst = msgs.querySelectorAll('.ai-msg.ai-assistant');
    const first = asst[0], second = asst[1];
    return {
      sectionCount: document.querySelectorAll('#bazi .ai-section').length,
      allMetas: Array.from(asst).map(a => (a.querySelector('.ai-meta')||{textContent:''}).textContent),
      allBodies: Array.from(asst).map(a => a.querySelector('.ai-body').textContent.slice(0, 30)),
      pickValue: document.querySelector('#bazi .ai-model-pick').value,
      compareLabel: document.querySelector('#bazi .ai-compare-btn').textContent,
      bubbles: asst.length,
      meta1: first ? first.querySelector('.ai-meta').textContent : "",
      hasReasoning1: !!(first && first.querySelector('.ai-reasoning')),
      content1: first ? first.querySelector('.ai-body').textContent : "",
      meta2: second ? second.querySelector('.ai-meta').textContent : "",
      isCmp2: !!(second && second.classList.contains('ai-cmp')),
      emptyWarn2: second ? (second.querySelector('.ai-empty') || {textContent:""}).textContent : "",
    };
  })()`);

  await win.webContents.executeJavaScript(`document.querySelector('#bazi .ai-section').scrollIntoView(); true`);
  await new Promise(r => setTimeout(r, 300));
  fs.mkdirSync(path.join(__dirname, "..", "..", "dist"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "..", "..", "dist", "smoke-ai.png"),
    (await win.webContents.capturePage()).toPNG());

  console.log("PROBE", JSON.stringify(probe, null, 1));
  const bad = [];
  if (probe.bubbles !== 2) bad.push("expected 2 assistant bubbles");
  if (!/Mock源 · mock-r1/.test(probe.meta1)) bad.push("primary label");
  if (!probe.hasReasoning1) bad.push("reasoning panel missing");
  if (!/五行流通/.test(probe.content1)) bad.push("streamed content missing");
  if (!/mock-empty/.test(probe.meta2) || !probe.isCmp2) bad.push("compare bubble");
  if (!/未返回正文/.test(probe.emptyWarn2) || !/finish_reason: length/.test(probe.emptyWarn2)) bad.push("empty diagnostics");
  if (errors.length) { console.log("RENDERER ERRORS:\n" + errors.join("\n")); bad.push("console errors"); }
  console.log(bad.length ? "AI-E2E FAIL: " + bad.join(", ") : "AI-E2E OK");
  server.close();
  app.exit(bad.length ? 1 : 0);
}));
