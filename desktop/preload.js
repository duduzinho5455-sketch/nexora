"use strict";
const { contextBridge, ipcRenderer } = require("electron");

// O site da Auryx Nexos usa isto para saber que está no app de PC.
contextBridge.exposeInMainWorld("nexoraDesktop", {
  platform: process.platform,
  winBuild: process.platform === "win32" ? Number((process.getSystemVersion ? process.getSystemVersion() : "").split(".")[2]) || 0 : 0,
  startAgent: () => ipcRenderer.invoke("agent:start"),
  overlay: st => ipcRenderer.send("overlay:state", st),
  stopAgent: () => ipcRenderer.invoke("agent:stop")
});
