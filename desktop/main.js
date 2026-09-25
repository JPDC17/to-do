const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

function resolveAppPath(...segments) {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, "app")
    : path.join(__dirname, "..");
  return path.join(base, ...segments);
}

function getSaveFilePath() {
  return path.join(app.getPath("userData"), "task-sheet-data.json");
}

ipcMain.handle("tasksheet:load-jobs", () => {
  const filePath = getSaveFilePath();
  try {
    if (!fs.existsSync(filePath)) return null; // no file yet -> renderer should seed
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
});

ipcMain.handle("tasksheet:save-jobs", (event, jobs) => {
  try {
    fs.writeFileSync(getSaveFilePath(), JSON.stringify(jobs, null, 2), "utf8");
    return true;
  } catch (e) {
    return false;
  }
});

ipcMain.handle("tasksheet:get-save-path", () => getSaveFilePath());

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, "build", "icon.ico"),
    backgroundColor: "#e8dcc0",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  Menu.setApplicationMenu(null);

  // Windows sometimes refuses to hand a newly-launched app real keyboard/mouse
  // focus (its foreground-lock focus-stealing prevention). Without this, the
  // window can appear fully rendered but not accept any clicks or typing.
  win.once("ready-to-show", () => {
    win.show();
    win.focus();
    win.webContents.focus();
    if (process.platform === "win32") {
      win.setAlwaysOnTop(true);
      win.setAlwaysOnTop(false);
    }
  });

  win.on("focus", () => {
    win.webContents.focus();
  });

  win.loadFile(resolveAppPath("index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
