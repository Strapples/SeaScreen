const { contextBridge, ipcRenderer } = require("electron");

// Expose ipcRenderer methods to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  invoke: (channel, data) => ipcRenderer.invoke(channel, data), // Async calls
  send: (channel, data) => ipcRenderer.send(channel, data),     // Fire-and-forget calls
});