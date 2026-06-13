/* =========================================================================
 * main.js — Electron main process.
 *
 * Besides the window shell, it hosts the AI HTTP proxy: the renderer talks
 * to OpenAI-compatible endpoints through IPC (ai:request / ai:stream), so
 * requests originate from the main process and are never subject to CORS.
 * ========================================================================= */
"use strict";

const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const { registerAiProxy } = require("./ai-proxy");

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

registerAiProxy();

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
