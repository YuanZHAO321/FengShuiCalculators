/* Smoke test: launch the real app in Electron, collect renderer console
 * errors, exercise the AI bridge + chat UI, and save screenshots.
 * Run: npx electron app/test/e2e-capture.cjs */
"use strict";
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const outDir = path.join(__dirname, "..", "..", "dist");
const errors = [];

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

  // bridge exposed? chat UI mounted? preset button enabled after auto-cast?
  const probe = await win.webContents.executeJavaScript(`({
    bridge: !!window.aiBridge,
    sections: document.querySelectorAll('.ai-section').length,
    qmPresetEnabled: !document.querySelector('#qimen .ai-preset').disabled,
    bzPresetDisabled: document.querySelector('#bazi .ai-preset').disabled,
  })`);

  // open settings modal and screenshot it too
  await win.webContents.executeJavaScript(`document.querySelector('.ai-header-btn').click(); true`);
  await new Promise(r => setTimeout(r, 400));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "smoke-settings.png"), (await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript(`document.querySelector('.ai-x').click(); true`);

  // cast a Ba Zi chart, then screenshot the panel incl. AI section
  await win.webContents.executeJavaScript(`
    document.querySelector('[data-tab="bazi"]').click();
    document.querySelector('#bazi-form').requestSubmit(); true`);
  await new Promise(r => setTimeout(r, 600));
  const probe2 = await win.webContents.executeJavaScript(`({
    bzPresetEnabled: !document.querySelector('#bazi .ai-preset').disabled,
    bzResultLen: document.querySelector('#bazi-result').innerHTML.length,
  })`);
  await win.webContents.executeJavaScript(`document.querySelector('#bazi .ai-section').scrollIntoView(); true`);
  await new Promise(r => setTimeout(r, 300));
  fs.writeFileSync(path.join(outDir, "smoke-bazi.png"), (await win.webContents.capturePage()).toPNG());

  console.log("PROBE", JSON.stringify(Object.assign(probe, probe2)));
  if (errors.length) { console.log("RENDERER ERRORS:\n" + errors.join("\n")); app.exit(1); }
  else { console.log("SMOKE OK"); app.exit(0); }
});
