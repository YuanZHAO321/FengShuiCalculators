/* =========================================================================
 * preload.js — exposes the AI HTTP proxy to the renderer as window.aiBridge.
 * ai.js prefers this bridge over fetch() when present (desktop build),
 * which makes AI requests immune to CORS restrictions.
 * ========================================================================= */
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

let seq = 0;

contextBridge.exposeInMainWorld("aiBridge", {
  /* one-shot request → Promise<{ status, body }> */
  request: opts => ipcRenderer.invoke("ai:request", opts),

  /* streaming request; handlers = { onChunk, onEnd, onError }.
   * Returns { abort }. */
  stream: (opts, handlers) => {
    const id = (++seq) + "-" + Date.now();
    const ch = "ai:stream:" + id;
    const listener = (_e, msg) => {
      if (msg.type === "chunk") { handlers.onChunk(msg.data); return; }
      ipcRenderer.removeListener(ch, listener);
      if (msg.type === "end") handlers.onEnd(msg.status);
      else handlers.onError(msg.error);
    };
    ipcRenderer.on(ch, listener);
    ipcRenderer.send("ai:stream", { id, opts });
    return { abort: () => ipcRenderer.send("ai:stream-abort", id) };
  },
});
