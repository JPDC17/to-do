const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("taskSheetDesktop", {
  loadJobs: () => ipcRenderer.invoke("tasksheet:load-jobs"),
  saveJobs: (jobs) => ipcRenderer.invoke("tasksheet:save-jobs", jobs),
  getSavePath: () => ipcRenderer.invoke("tasksheet:get-save-path"),
  appVersion: () => ipcRenderer.invoke("tasksheet:app-version"),
  checkUpdate: () => ipcRenderer.invoke("tasksheet:check-update"),
  installUpdate: () => ipcRenderer.invoke("tasksheet:install-update"),
  onUpdateProgress: (fn) => ipcRenderer.on("tasksheet:update-progress", (_e, p) => fn(p)),
});
