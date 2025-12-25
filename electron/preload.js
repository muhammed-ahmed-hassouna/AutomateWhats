const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getChats: () => ipcRenderer.invoke("wa:getChats"),
  getMessages: (chatId) => ipcRenderer.invoke("wa:getMessages", chatId),
  downloadMessage: (chatId, messageId) =>
  ipcRenderer.invoke("wa:downloadMessage", chatId, messageId),
  downloadMedia: (chatId, type) =>
    ipcRenderer.invoke("wa:downloadMedia", chatId, type),
  openFolder: (folderPath) => ipcRenderer.invoke("wa:openFolder", folderPath),
  onProgress: (cb) => ipcRenderer.on("wa:progress", (e, data) => cb(data)),
  onNewMessage: (cb) => ipcRenderer.on("wa:newMessage", (e, data) => cb(data)),
});
