const { contextBridge, ipcRenderer } = require("electron");

console.log("✅ preload.js loaded. Exposing API...");

contextBridge.exposeInMainWorld("electronAPI", {
  send: (channel, data) => {
    console.log(`📤 IPC SEND: ${channel}`, data);
    ipcRenderer.send(channel, data);
  },
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
});