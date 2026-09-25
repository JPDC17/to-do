const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("taskSheetDesktop", {
  loadJobs: () => ipcRenderer.invoke("tasksheet:load-jobs"),
  saveJobs: (jobs) => ipcRenderer.invoke("tasksheet:save-jobs", jobs),
  getSavePath: () => ipcRenderer.invoke("tasksheet:get-save-path"),
});
