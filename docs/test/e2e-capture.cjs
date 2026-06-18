/* Smoke test: launch the real app in Electron, collect renderer console
 * errors, exercise the AI bridge + chat UI + persistence, save screenshots.
 * Run: npx electron docs/test/e2e-capture.cjs */
"use strict";
const { app, BrowserWindow } = require("electron");
const { registerAiProxy } = require("../../electron/ai-proxy");
const path = require("path");
const fs = require("fs");

const outDir = path.join(__dirname, "..", "..", "dist");
const errors = [];

registerAiProxy();
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1180, height: 1400, show: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "..", "electron", "preload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  });
  win.webContents.on("console-message", (_e, level, message) => {
    if (level >= 3) errors.push(message);
  });
  await win.loadFile(path.join(__dirname, "..", "index.html"));
  win.showInactive();
  await new Promise(r => setTimeout(r, 2500));

  // fresh state for a deterministic run
  await win.webContents.executeJavaScript(`localStorage.clear(); true`);
  await win.webContents.reload();
  await new Promise(r => setTimeout(r, 2000));

  const probe = await win.webContents.executeJavaScript(`({
    bridge: !!window.aiBridge,
    sections: document.querySelectorAll('.ai-section').length,
    modelPicks: document.querySelectorAll('.ai-model-pick').length,
    compareBtns: document.querySelectorAll('.ai-compare-btn').length,
    dbSaveBtns: document.querySelectorAll('.db-save-btn').length,
    dbOpenBtns: document.querySelectorAll('.db-open-btn').length,
    qmPresetEnabled: !document.querySelector('#qimen .ai-preset').disabled,
  })`);

  // settings modal screenshot
  await win.webContents.executeJavaScript(`document.querySelector('.ai-header-btn').click(); true`);
  await new Promise(r => setTimeout(r, 400));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "smoke-settings.png"), (await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript(`document.querySelector('.ai-x').click(); true`);

  // cast a Ba Zi chart with a custom date, persist, then reload → must restore
  await win.webContents.executeJavaScript(`
    document.querySelector('[data-tab="bazi"]').click();
    document.getElementById('bz-date').value = '1995-05-05';
    document.querySelector('#bazi-form').requestSubmit();
    window.FscStore.saveSession(); true`);
  await new Promise(r => setTimeout(r, 400));
  await win.webContents.executeJavaScript(`document.querySelector('#bazi .ai-section').scrollIntoView(); true`);
  await new Promise(r => setTimeout(r, 300));
  fs.writeFileSync(path.join(outDir, "smoke-bazi.png"), (await win.webContents.capturePage()).toPNG());

  await win.webContents.reload();
  await new Promise(r => setTimeout(r, 2000));
  const probe2 = await win.webContents.executeJavaScript(`({
    restoredDate: document.getElementById('bz-date').value,
    restoredResult: document.querySelector('#bazi-result').innerHTML.length > 100,
    bzPresetEnabled: !document.querySelector('#bazi .ai-preset').disabled,
  })`);

  console.log("PROBE", JSON.stringify(Object.assign(probe, probe2)));
  const bad = [];
  if (!probe.bridge) bad.push("no aiBridge");
  if (probe.sections !== 4 || probe.modelPicks !== 4 || probe.dbSaveBtns !== 4) bad.push("ui mounts");
  if (probe2.restoredDate !== "1995-05-05" || !probe2.restoredResult) bad.push("session restore");
  if (errors.length) { console.log("RENDERER ERRORS:\n" + errors.join("\n")); bad.push("console errors"); }
  if (bad.length) { console.log("SMOKE FAIL: " + bad.join(", ")); app.exit(1); }
  else { console.log("SMOKE OK"); app.exit(0); }
});
