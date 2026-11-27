const { app, BrowserWindow, Menu, ipcMain, net, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");
const crypto = require("crypto");
const { spawn } = require("child_process");
const Updater = require("./updater");
const pkg = require("./package.json");

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

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, "build", "icon.ico"),
    backgroundColor: "#f4f4f3",
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

  win.on("closed", () => {
    win = undefined;
  });

  win.loadFile(resolveAppPath("index.html"));
}

// ---------- Updates ----------
// For testing, TASKSHEET_UPDATE_MANIFEST can point at a local test server.
const UPDATE_MANIFEST = process.env.TASKSHEET_UPDATE_MANIFEST || (pkg.updates && pkg.updates.manifest);
const EXTRA_TRUST = process.env.TASKSHEET_UPDATE_MANIFEST ? ["http://127.0.0.1:"] : [];
let pendingUpdate = null;
let installing = false;

// Remove update downloads left in the temp folder by earlier updates (over a day old).
async function cleanOldUpdates() {
  try {
    const tmp = app.getPath("temp");
    for (const name of await fsp.readdir(tmp)) {
      if (!name.startsWith("TaskSheet-update-")) continue;
      const dir = path.join(tmp, name);
      const st = await fsp.stat(dir);
      if (st.isDirectory() && Date.now() - st.mtimeMs > 24 * 3600 * 1000) await fsp.rm(dir, { recursive: true, force: true });
    }
  } catch {
    /* not important */
  }
}

async function fetchManifest() {
  if (!UPDATE_MANIFEST) throw new Error("Updates are not set up for this copy of the app.");
  const res = await net.fetch(`${UPDATE_MANIFEST}?t=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`The update server answered ${res.status}.`);
  return Updater.validateManifest(await res.json(), EXTRA_TRUST);
}

ipcMain.handle("tasksheet:app-version", () => app.getVersion());

async function checkForUpdate() {
  const m = await fetchManifest();
  const available = Updater.compareVersions(m.version, app.getVersion()) > 0;
  pendingUpdate = available ? m : null;
  return { m, available };
}

ipcMain.handle("tasksheet:check-update", async () => {
  try {
    const { m } = await checkForUpdate();
    const available = !!pendingUpdate;
    return { current: app.getVersion(), latest: m.version, available, notes: m.notes, size: updateFileFor(m).size };
  } catch (err) {
    const offline = /fetch|network|net::|ERR_|ENOTFOUND|ECONN|abort|timed? ?out/i.test(String(err && (err.message || err)));
    throw new Error(offline ? "Could not reach the update server. Check your internet connection and try again." : err.message);
  }
});

// Download the new exe, check it, then swap it in and restart (portable exe only).
ipcMain.handle("tasksheet:install-update", async () => {
  const m = pendingUpdate;
  if (!m) throw new Error("No update is waiting. Check for updates first.");
  if (installing) throw new Error("The update is already downloading.");
  installing = true;
  try {
    return await installUpdate(m);
  } finally {
    installing = false;
  }
});

// How this copy runs: the portable exe, installed with the installer, or from source.
const portableExe = () => process.env.PORTABLE_EXECUTABLE_FILE || "";
const isInstalled = () => !portableExe() && app.isPackaged && process.platform === "win32";
// The file an update downloads for this copy: the installer for an installed copy (when
// the release has one), else the portable exe.
const updateFileFor = m => (isInstalled() && m.setup ? m.setup : m);

// Download a file, checking its size and SHA-256, with progress sent to the window.
async function downloadVerified(f) {
  const res = await net.fetch(f.url, { cache: "no-store" });
  if (!res.ok || !res.body) throw new Error(`The download failed (${res.status}).`);
  const hash = crypto.createHash("sha256");
  const chunks = [];
  let received = 0, lastSent = 0;
  for await (const chunk of res.body) {
    const buf = Buffer.from(chunk);
    chunks.push(buf); hash.update(buf); received += buf.length;
    if (received > f.size) throw new Error("The download is larger than expected, so it was not used.");
    if (win && Date.now() - lastSent > 150) { lastSent = Date.now(); win.webContents.send("tasksheet:update-progress", { received, total: f.size }); }
  }
  if (received !== f.size) throw new Error("The download was incomplete. Please try again.");
  if (hash.digest("hex") !== f.sha256) throw new Error("The download did not match its checksum, so it was not used. If an update was published in the last few minutes, GitHub may still be updating its copy; please try again shortly.");
  if (win) win.webContents.send("tasksheet:update-progress", { received, total: f.size });
  return Buffer.concat(chunks);
}

async function installUpdate(m) {
  const installed = isInstalled() && !!m.setup;
  if (!portableExe() && !installed) {
    // From source, or an installed copy and a release without an installer: open the download.
    await shell.openExternal(m.url);
    return { manual: true };
  }
  const data = await downloadVerified(updateFileFor(m));
  const dir = await fsp.mkdtemp(path.join(app.getPath("temp"), "TaskSheet-update-"));
  const newExe = path.join(dir, installed ? `TaskSheet-Setup-${m.version}.exe` : `TaskSheet-Portable-${m.version}.exe`);
  await fsp.writeFile(newExe, data);
  try {
    // Windows PowerShell rebuilds its own module path; one inherited from PowerShell 7
    // (if the app was started from a PowerShell 7 window) can stop it loading its commands.
    const env = { ...process.env };
    delete env.PSModulePath;
    // A PowerShell started as a detached, console-less process can exit at once. So start
    // a short-lived PowerShell normally and wait for it: it launches the swap as its own
    // hidden process (which carries on after the app closes) and exits with 0 once that
    // has started. Portable: swap the exe once the app has closed. Installed: run the new
    // installer silently once the app has closed; it starts the new version when it's done.
    const command = installed ? Updater.launchInstallCommand(newExe, process.pid, app.getPath("exe")) : Updater.launchCommand(newExe, portableExe());
    const launcher = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", command], { stdio: "ignore", windowsHide: true, env });
    const code = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { launcher.kill(); reject(new Error("timed out")); }, 30000);
      launcher.once("error", err => { clearTimeout(timer); reject(err); });
      launcher.once("exit", c => { clearTimeout(timer); resolve(c); });
    });
    if (code !== 0) throw new Error(`launcher exited with ${code}`);
  } catch {
    // Couldn't start the helper: leave the new version where it is and show it.
    shell.showItemInFolder(newExe);
    return { manual: true, file: newExe };
  }
  setTimeout(() => app.quit(), 400);
  return { restarting: true, version: m.version };
}

// Test switches for the end-to-end update test on Windows (see scripts/e2e-update-windows.ps1
// and scripts/e2e-install-windows.ps1). They do nothing unless these environment variables
// are set.
async function e2eHooks() {
  const marker = process.env.TASKSHEET_E2E_MARKER;
  const note = async text => { if (marker) await fsp.appendFile(marker, `${new Date().toISOString()} ${app.getVersion()} ${text}\n`).catch(() => {}); };
  await note(`started (exe ${portableExe() || "-"}; running ${app.getPath("exe")}; ${isInstalled() ? "installed" : portableExe() ? "portable" : "source"})`);
  if (win) {
    const ready = () => note("window ready");
    if (win.webContents.isLoading()) win.webContents.once("did-finish-load", ready); else ready();
  }
  if (process.env.TASKSHEET_E2E_AUTOUPDATE !== "1") return;
  try {
    const { m, available } = await checkForUpdate();
    await note(`checked: latest ${m.version}, update ${available ? "available" : "not needed"}`);
    if (available) await note(`install: ${JSON.stringify(await installUpdate(m))}`);
  } catch (err) {
    await note(`update error: ${err.message}`);
  }
}

app.whenReady().then(() => {
  cleanOldUpdates();
  createWindow();
  if (process.env.TASKSHEET_E2E_MARKER) e2eHooks();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
