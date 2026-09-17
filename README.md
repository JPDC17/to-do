# Task Sheet — Estimator & PM To-Do App

A single-page to-do board built for construction estimating and project management workflows. No build step, no backend — open `index.html` in a browser, or host the three files on any static server / GitHub Pages.

## What it does

- **Active Jobs** and **Jobs to Bid** columns, each drag-to-reorder so you can rank work by what needs attention first or by bid deadline.
- **Bidding jobs** automatically get a standard estimator checklist you can check back on as the bid progresses:
  - Review plans & specifications
  - Conduct pre-bid site walk
  - Submit RFIs for unclear scope
  - Complete quantity take-off
  - Send RFQs to subcontractors & suppliers
  - Follow up on outstanding sub/supplier quotes
  - Price labor & crew hours
  - Price materials & equipment
  - Apply overhead & profit margin
  - Confirm insurance & bonding requirements
  - Assemble bid proposal & exclusions
  - Internal review / management sign-off
  - Submit bid before deadline
  - Follow up with client after submission
  - Log win/loss outcome & lessons learned

  Items can be checked, added, or removed per job.
- **Active jobs** get a starter PM task list (contract/NTP, long-lead materials, subs, permits, client updates) that you customize per project.
- **Win / Loss workflow**: mark a bid "Won" to move it straight into Active Jobs (its task list is set up automatically), or "Lost" to send it to the Archive. Completed active jobs archive the same way.
- Each job tracks client, location, priority, a key date (bid due date or target completion), estimated/contract value, and notes.
- Progress bars, overdue/due-soon highlighting, and a top summary bar (active count, bids in progress, bids due in 7 days, overdue).
- Everything auto-saves to the browser's `localStorage` — no account, no server, no data leaves your machine.
- **Export / Import**: click **Export** (or press **Ctrl/Cmd+S** anywhere in the app) anytime to save a real `.json` backup file to your computer, and **Import** to load one back in (e.g. after clearing browser data, switching browsers, or to move your board onto another machine by copying the file over — a synced folder like Dropbox/Google Drive works well for that). A dismissible reminder banner appears if it's been 7+ days since your last export (it stays quiet if you're using Connect Save File below, since that's always current).
- **Connect Save File** (Chrome/Edge only): link an actual file on disk once, and the app automatically loads it on startup and writes to it on every change — no more clicking Export/Import by hand. See below.

## Running it

Just open `index.html` in a browser. To serve it (e.g. for testing on a phone on the same network, or to enable the installable-app feature below):

```bash
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Auto-loading your last saved session (Connect Save File)

By default the board remembers your data in the browser's storage automatically — reopen the same browser on the same computer and it's exactly as you left it. **Connect Save File** goes one step further: it links the app to a real `.json` file on your disk so that file itself always holds the current state, and the app reads it back automatically every time you open the page.

1. Click **🔗 Connect Save File** in the top bar.
2. Pick where to save it (or select an existing exported backup to pick up where it left off — you'll be asked before it overwrites what's on screen).
3. From then on, every change auto-writes to that file, and opening the app auto-loads from it — including if you move that file into a synced Dropbox/Google Drive/OneDrive folder, so a *second* machine pointed at the same synced file effectively sees the same board.

Notes:
- This uses the browser's File System Access API, currently **Chrome and Edge only** (desktop). Firefox and Safari will simply not show the button — use Export/Import instead.
- After a full browser restart, Chrome may ask you to confirm access again for security reasons — if so, the button changes to **🔗 Reconnect \<filename\>**; one click restores auto-sync.
- Disconnecting (click the button again while connected) just stops the auto-sync — nothing is deleted, and the file keeps whatever was last written to it.

## Installing it as a desktop app

The board is a PWA (Progressive Web App), so Chrome or Edge can install it as its own app with a desktop/dock icon and no browser bar around it.

**Important:** this only works when the page is loaded over `http://` or `https://` — double-clicking `index.html` directly (a `file://` URL) will not show the install option. Easiest ways to get an `http(s)` URL:

- **GitHub Pages (recommended — works from any machine, no server to run):**
  1. On GitHub: repo → **Settings** → **Pages**.
  2. Under "Build and deployment", set **Source** to "Deploy from a branch", pick this branch, and folder `/ (root)`.
  3. Save. GitHub gives you a URL like `https://<username>.github.io/<repo>/`.
  4. Open that URL in Chrome/Edge, click the **⤓ Install App** button in the top bar (or the install icon in the address bar).
- **Local server, same computer:** run `python3 -m http.server 8000` in this folder, visit `http://localhost:8000`, then click **Install App**.

Once installed, it opens like any other app on your computer and still saves to that browser profile's storage — use **Export**/**Import** (above) to move data between machines or browsers.

## Desktop app (.exe, not browser-based)

`desktop/` wraps the exact same app in [Electron](https://www.electronjs.org/) so it runs as a real Windows executable — its own window, its own icon, no browser involved at all. It loads the same `index.html`/`style.css`/`app.js` from the parent folder, so any change made to those files applies the next time you rebuild.

**Build it yourself** (needs [Node.js](https://nodejs.org) installed):

```bash
cd desktop
npm install
npm run dist:win
```

The finished executable lands at `desktop/dist/TaskSheet-Portable.exe` — a single **portable** file (no installer, nothing written to Program Files). Copy it anywhere and double-click to run; it carries its own copy of the app.

Notes:
- It's unsigned (no paid code-signing certificate), so Windows SmartScreen will likely show an "unknown publisher" warning the first time you run it — click **More info → Run anyway**. This is normal for small independent tools and not a sign anything is wrong.
- Data still saves via the same `localStorage` (and Connect Save File, Export/Import) as the browser version — those all work identically inside Electron's window, since it's the same Chromium engine under the hood.
- It's noticeably larger than the web files alone (~70MB) because Electron bundles its own copy of Chromium and Node.js so it needs no browser installed at all.
- To rebuild after changing the icon, regenerate `desktop/build/icon.ico` (any standard multi-resolution `.ico`, ideally including a 256×256 entry) before running `npm run dist:win`.

## Files

- `index.html` — page structure
- `style.css` — styling
- `app.js` — app logic and data model (vanilla JS, no dependencies)
- `manifest.json` / `sw.js` / `icons/` — PWA install support (app icon, offline caching)
- `desktop/` — Electron wrapper that packages the app as a standalone Windows `.exe`
