# Site Board — Estimator & PM To-Do App

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
- **Export / Import**: click **Export** anytime to save a real `.json` backup file to your computer, and **Import** to load one back in (e.g. after clearing browser data, switching browsers, or to move your board onto another machine by copying the file over — a synced folder like Dropbox/Google Drive works well for that).

## Running it

Just open `index.html` in a browser. To serve it (e.g. for testing on a phone on the same network):

```bash
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Files

- `index.html` — page structure
- `style.css` — styling
- `app.js` — app logic and data model (vanilla JS, no dependencies)
