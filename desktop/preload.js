"use strict";
const { contextBridge, ipcRenderer } = require("electron");

// O site da Auryx Nexavória usa isto para saber que está no app de PC.
contextBridge.exposeInMainWorld("nexoraDesktop", {
  platform: process.platform,
  startAgent: () => ipcRenderer.invoke("agent:start"),
  stopAgent: () => ipcRenderer.invoke("agent:stop")
});
