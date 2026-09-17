const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");

function resolveAppPath(...segments) {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, "app")
    : path.join(__dirname, "..");
  return path.join(base, ...segments);
}

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
