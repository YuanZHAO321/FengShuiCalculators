/* =========================================================================
 * ai-proxy.js — main-process HTTP proxy for the AI client.
 * The renderer talks to OpenAI-compatible endpoints through these IPC
 * channels (ai:request / ai:stream), so requests originate from the main
 * process and are never subject to CORS. Shared by main.js and the tests.
 * ========================================================================= */
"use strict";

const { ipcMain, net } = require("electron");

function toFetchOpts(opts, signal) {
  return {
    method: opts.method || "GET",
    headers: opts.headers || {},
    body: opts.body || undefined,
    signal,
  };
}

function registerAiProxy() {
  /* one-shot request → { status, body } */
  ipcMain.handle("ai:request", async (_e, opts) => {
    const res = await net.fetch(opts.url, toFetchOpts(opts));
    return { status: res.status, body: await res.text() };
  });

  /* streaming request: chunks pushed over a per-request channel */
  const liveStreams = new Map();

  ipcMain.on("ai:stream", async (e, { id, opts }) => {
    const ch = "ai:stream:" + id;
    const ac = new AbortController();
    liveStreams.set(id, ac);
    const send = msg => { if (!e.sender.isDestroyed()) e.sender.send(ch, msg); };
    try {
      const res = await net.fetch(opts.url, toFetchOpts(opts, ac.signal));
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        send({ type: "error", error: "HTTP " + res.status + (text ? " — " + text.slice(0, 300) : "") });
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (e.sender.isDestroyed()) { ac.abort(); return; }
        send({ type: "chunk", data: dec.decode(value, { stream: true }) });
      }
      send({ type: "end", status: res.status });
    } catch (err) {
      send({ type: "error", error: String((err && err.message) || err) });
    } finally {
      liveStreams.delete(id);
    }
  });

  ipcMain.on("ai:stream-abort", (_e, id) => {
    const ac = liveStreams.get(id);
    if (ac) ac.abort();
  });
}

module.exports = { registerAiProxy };
