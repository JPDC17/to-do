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
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  Menu.setApplicationMenu(null);
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
