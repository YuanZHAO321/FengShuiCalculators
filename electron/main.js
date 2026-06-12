/* =========================================================================
 * main.js — Electron main process.
 *
 * Besides the window shell, it hosts the AI HTTP proxy: the renderer talks
 * to OpenAI-compatible endpoints through IPC (ai:request / ai:stream), so
 * requests originate from the main process and are never subject to CORS.
 * ========================================================================= */
"use strict";

const { app, BrowserWindow, ipcMain, net, shell } = require("electron");
const path = require("path");

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 880,
    minWidth: 720,
    minHeight: 560,
    title: "风水计算器 Feng Shui Calculator",
    backgroundColor: "#f4ecdc",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "..", "app", "index.html"));
  // open external links (if any appear in AI answers) in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.on("closed", () => { mainWindow = null; });
}

/* ------------------------- AI HTTP proxy (IPC) ------------------------- */

function toFetchOpts(opts, signal) {
  return {
    method: opts.method || "GET",
    headers: opts.headers || {},
    body: opts.body || undefined,
    signal,
  };
}

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

/* ------------------------------ Lifecycle ------------------------------ */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(() => {
    createWindow();
    app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
}
