/* Minimal aiBridge stream diagnostic against an in-process mock server. */
"use strict";
const { app, BrowserWindow } = require("electron");
const { registerAiProxy } = require("../../electron/ai-proxy");
const path = require("path");
const http = require("http");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  res.write('data: {"choices":[{"delta":{"content":"hello"}}]}\n\n');
  res.write("data: [DONE]\n\n");
  res.end();
});

registerAiProxy();
app.whenReady().then(() => server.listen(0, "127.0.0.1", async () => {
  const url = `http://127.0.0.1:${server.address().port}/v1/chat/completions`;
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "..", "electron", "preload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  });
  await win.loadFile(path.join(__dirname, "..", "index.html"));
  const out = await win.webContents.executeJavaScript(`
    new Promise(resolve => {
      const chunks = [];
      const t = setTimeout(() => resolve({ timeout: true, chunks }), 4000);
      window.aiBridge.stream(
        { url: ${JSON.stringify(url)}, method: "POST", headers: {"Content-Type":"application/json"}, body: "{}" },
        { onChunk: c => chunks.push(c),
          onEnd: s => { clearTimeout(t); resolve({ end: s, chunks }); },
          onError: e => { clearTimeout(t); resolve({ error: e, chunks }); } });
    })`, true);
  console.log("BRIDGE", JSON.stringify(out));
  server.close();
  app.exit(0);
}));
