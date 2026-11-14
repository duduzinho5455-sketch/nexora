"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("auryxOverlay", {
  onState: cb => ipcRenderer.on("overlay:state", (_e, st) => cb(st)),
  size: h => ipcRenderer.send("overlay:size", h)
});
