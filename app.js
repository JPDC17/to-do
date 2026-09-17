(function () {
  "use strict";

  const STORAGE_KEY = "site_board_jobs_v1";

  const BID_CHECKLIST_TEMPLATE = [
    "Review plans & specifications",
    "Conduct pre-bid site walk",
    "Submit RFIs for unclear scope",
    "Complete quantity take-off",
    "Send RFQs to subcontractors & suppliers",
    "Follow up on outstanding sub/supplier quotes",
    "Price labor & crew hours",
    "Price materials & equipment",
    "Apply overhead & profit margin",
    "Confirm insurance & bonding requirements",
    "Assemble bid proposal & exclusions",
    "Internal review / management sign-off",
    "Submit bid before deadline",
    "Follow up with client after submission",
    "Log win/loss outcome & lessons learned",
  ];

  const ACTIVE_STARTER_TASKS = [
    "Confirm signed contract / notice to proceed",
    "Order long-lead materials",
    "Schedule subcontractors",
    "Pull permits & schedule inspections",
    "Send weekly client progress update",
  ];

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  const todayStr = () => new Date().toISOString().slice(0, 10);

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const today = new Date(todayStr() + "T00:00:00");
    const target = new Date(dateStr + "T00:00:00");
    return Math.round((target - today) / 86400000);
  }

  function fmtDate(dateStr) {
    if (!dateStr) return "No date set";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function fmtMoney(n) {
    if (n === null || n === undefined || n === "") return "";
    const num = Number(n);
    if (Number.isNaN(num)) return "";
    return num.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function makeChecklist(items) {
    return items.map((text) => ({ id: uid(), text, done: false }));
  }

  // ---------------- State ----------------

  function seedData() {
    const now = Date.now();
    return [
      {
        id: uid(), type: "active", archived: false, archivedReason: null,
        name: "Maple St. Duplex Remodel", client: "Harmon Family",
        location: "412 Maple St", priority: "high",
        keyDate: new Date(now + 5 * 86400000).toISOString().slice(0, 10),
        value: 186000, notes: "Framing inspection scheduled; waiting on window delivery.",
        order: 0, tasks: makeChecklist(ACTIVE_STARTER_TASKS),
        checklist: makeChecklist(BID_CHECKLIST_TEMPLATE),
      },
      {
        id: uid(), type: "bidding", archived: false, archivedReason: null,
        name: "Riverside Office Tenant Improvement", client: "Kestrel Properties",
        location: "88 Riverside Pkwy, Ste 200", priority: "high",
        keyDate: new Date(now + 4 * 86400000).toISOString().slice(0, 10),
        value: 412000, notes: "Design-build; GC pre-qual already submitted.",
        order: 0, tasks: makeChecklist(ACTIVE_STARTER_TASKS),
        checklist: makeChecklist(BID_CHECKLIST_TEMPLATE),
      },
      {
        id: uid(), type: "bidding", archived: false, archivedReason: null,
        name: "Cedar Ridge Elementary Roof Replacement", client: "County School District",
        location: "900 Cedar Ridge Rd", priority: "medium",
        keyDate: new Date(now + 12 * 86400000).toISOString().slice(0, 10),
        value: 950000, notes: "Public bid — bond & prevailing wage required.",
        order: 1, tasks: makeChecklist(ACTIVE_STARTER_TASKS),
        checklist: makeChecklist(BID_CHECKLIST_TEMPLATE),
      },
    ];
  }

  function loadJobs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return seedData();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return seedData();
      return parsed;
    } catch (e) {
      return seedData();
    }
  }

  let jobs = loadJobs();
  let archiveVisible = false;
  let activeModalJobId = null;

  const saveStatusEl = document.getElementById("save-status");
  let saveStatusTimer = null;

  function saveJobs() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
    if (saveStatusEl) {
      const now = new Date();
      saveStatusEl.textContent = `Saved to this browser at ${now.toLocaleTimeString()}`;
      clearTimeout(saveStatusTimer);
      saveStatusTimer = setTimeout(() => {
        saveStatusEl.textContent = "";
      }, 4000);
    }
  }

  function getJob(id) {
    return jobs.find((j) => j.id === id);
  }

  // ---------------- Rendering ----------------

  const activeListEl = document.getElementById("active-list");
  const biddingListEl = document.getElementById("bidding-list");
  const archiveListEl = document.getElementById("archive-list");
  const statsEl = document.getElementById("stats");
  const archivePanel = document.getElementById("archive-panel");
  const archiveToggleBtn = document.getElementById("archive-toggle-btn");

  function itemsFor(job) {
    return job.type === "bidding" ? job.checklist : job.tasks;
  }

  function progressOf(job) {
    const items = itemsFor(job) || [];
    if (items.length === 0) return { done: 0, total: 0, pct: 0 };
    const done = items.filter((i) => i.done).length;
    return { done, total: items.length, pct: Math.round((done / items.length) * 100) };
  }

  function dueInfo(job) {
    const d = daysUntil(job.keyDate);
    if (d === null) return { cls: "", text: "No date set" };
    const label = job.type === "bidding" ? "Bid due" : "Target";
    if (d < 0) return { cls: "overdue", text: `${label}: ${fmtDate(job.keyDate)} (overdue)` };
    if (d <= 3) return { cls: "soon", text: `${label}: ${fmtDate(job.keyDate)} (${d === 0 ? "today" : d + "d"})` };
    return { cls: "", text: `${label}: ${fmtDate(job.keyDate)}` };
  }

  function renderJobCard(job) {
    const card = document.createElement("div");
    card.className = `job-card priority-${job.priority}`;
    card.draggable = !job.archived;
    card.dataset.id = job.id;

    const prog = progressOf(job);
    const due = dueInfo(job);

    let tagHtml = "";
    if (job.archived) {
      const label = job.archivedReason === "won" ? "Won" : job.archivedReason === "lost" ? "Lost" : "Completed";
      tagHtml = `<span class="archive-tag ${job.archivedReason}">${label}</span>`;
    }

    card.innerHTML = `
      <div class="job-card-top">
        ${job.archived ? "" : '<span class="drag-handle" title="Drag to reorder">⠿</span>'}
        <div style="flex:1">
          <p class="job-name">${escapeHtml(job.name)}</p>
          <p class="job-client">${escapeHtml(job.client || "No client set")}</p>
        </div>
        ${tagHtml || `<span class="badge badge-${job.priority}">${job.priority}</span>`}
      </div>
      <div class="job-meta-row">
        <span class="due ${due.cls}">${due.text}</span>
        <span class="job-value">${fmtMoney(job.value)}</span>
      </div>
      <div class="progress-track"><div class="progress-fill${prog.pct === 100 ? " complete" : ""}" style="width:${prog.pct}%"></div></div>
      <div class="progress-label">${prog.done}/${prog.total} ${job.type === "bidding" ? "checklist items" : "tasks"} complete</div>
    `;

    card.addEventListener("click", () => openModal(job.id));

    if (!job.archived) {
      card.addEventListener("dragstart", (e) => {
        card.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", job.id);
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
    }

    return card;
  }

  function renderList(container, list) {
    container.innerHTML = "";
    if (list.length === 0) {
      const hint = document.createElement("div");
      hint.className = "empty-hint";
      hint.textContent = "No jobs here yet.";
      container.appendChild(hint);
      return;
    }
    list.forEach((job) => container.appendChild(renderJobCard(job)));
  }

  function renderStats() {
    const activeJobs = jobs.filter((j) => j.type === "active" && !j.archived);
    const biddingJobs = jobs.filter((j) => j.type === "bidding" && !j.archived);
    const dueSoon = biddingJobs.filter((j) => {
      const d = daysUntil(j.keyDate);
      return d !== null && d >= 0 && d <= 7;
    });
    const overdue = jobs.filter((j) => !j.archived && daysUntil(j.keyDate) !== null && daysUntil(j.keyDate) < 0);

    statsEl.innerHTML = `
      <span class="stat-pill"><strong>${activeJobs.length}</strong> active</span>
      <span class="stat-pill"><strong>${biddingJobs.length}</strong> bidding</span>
      <span class="stat-pill ${dueSoon.length ? "warn" : ""}"><strong>${dueSoon.length}</strong> bids due in 7d</span>
      ${overdue.length ? `<span class="stat-pill danger"><strong>${overdue.length}</strong> overdue</span>` : ""}
    `;
  }

  function render() {
    const activeJobs = jobs.filter((j) => j.type === "active" && !j.archived).sort((a, b) => a.order - b.order);
    const biddingJobs = jobs.filter((j) => j.type === "bidding" && !j.archived).sort((a, b) => a.order - b.order);
    const archivedJobs = jobs.filter((j) => j.archived).sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));

    renderList(activeListEl, activeJobs);
    renderList(biddingListEl, biddingJobs);
    renderList(archiveListEl, archivedJobs);

    document.getElementById("active-count").textContent = activeJobs.length;
    document.getElementById("bidding-count").textContent = biddingJobs.length;
    document.getElementById("archive-count").textContent = archivedJobs.length;

    renderStats();

    if (activeModalJobId) {
      const job = getJob(activeModalJobId);
      if (job) renderModalBody(job);
      else closeModal();
    }
  }

  // ---------------- Drag & drop reorder ----------------

  [activeListEl, biddingListEl].forEach((listEl) => {
    listEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = listEl.querySelector(".dragging");
      if (!dragging) return;
      const afterEl = getDragAfterElement(listEl, e.clientY);
      if (afterEl == null) {
        listEl.appendChild(dragging);
      } else {
        listEl.insertBefore(dragging, afterEl);
      }
    });

    listEl.addEventListener("drop", (e) => {
      e.preventDefault();
      const type = listEl.dataset.list;
      const idsInOrder = Array.from(listEl.querySelectorAll(".job-card")).map((el) => el.dataset.id);
      idsInOrder.forEach((id, index) => {
        const job = getJob(id);
        if (job) {
          job.order = index;
          job.type = type; // allows moving between the two live columns if ever dragged across
        }
      });
      saveJobs();
      render();
    });
  });

  function getDragAfterElement(container, y) {
    const cards = [...container.querySelectorAll(".job-card:not(.dragging)")];
    return cards.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        }
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
  }

  // ---------------- Add job ----------------

  document.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.add;
      const job = {
        id: uid(),
        type,
        archived: false,
        archivedReason: null,
        name: "",
        client: "",
        location: "",
        priority: "medium",
        keyDate: "",
        value: "",
        notes: "",
        order: jobs.filter((j) => j.type === type && !j.archived).length,
        tasks: type === "active" ? makeChecklist(ACTIVE_STARTER_TASKS) : [],
        checklist: type === "bidding" ? makeChecklist(BID_CHECKLIST_TEMPLATE) : [],
      };
      jobs.push(job);
      saveJobs();
      render();
      openModal(job.id, { focusName: true });
    });
  });

  // ---------------- Archive toggle ----------------

  archiveToggleBtn.addEventListener("click", () => {
    archiveVisible = !archiveVisible;
    archivePanel.classList.toggle("hidden", !archiveVisible);
    archiveToggleBtn.textContent = archiveVisible ? "Hide Archive" : "Archive";
    if (archiveVisible) archivePanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ---------------- Export / Import (real file on disk) ----------------

  document.getElementById("export-btn").addEventListener("click", () => {
    const dataStr = JSON.stringify(jobs, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = todayStr();
    a.href = url;
    a.download = `site-board-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  const importBtn = document.getElementById("import-btn");
  const importFileInput = document.getElementById("import-file-input");

  importBtn.addEventListener("click", () => {
    importFileInput.value = "";
    importFileInput.click();
  });

  importFileInput.addEventListener("change", () => {
    const file = importFileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (e) {
        alert("That file isn't valid JSON. Nothing was changed.");
        return;
      }
      if (!Array.isArray(parsed)) {
        alert("That file doesn't look like a Site Board export. Nothing was changed.");
        return;
      }
      const confirmMsg =
        `Import ${parsed.length} job(s) from "${file.name}"?\n\n` +
        `This will replace everything currently on this board. ` +
        `Consider clicking Export first if you want to keep a backup of what's here now.`;
      if (!confirm(confirmMsg)) return;
      jobs = parsed;
      closeModal();
      archiveVisible = false;
      archivePanel.classList.add("hidden");
      archiveToggleBtn.textContent = "Archive";
      saveJobs();
      render();
      alert(`Imported ${parsed.length} job(s) successfully.`);
    };
    reader.readAsText(file);
  });

  // ---------------- Modal ----------------

  const backdrop = document.getElementById("modal-backdrop");
  const modalBody = document.getElementById("modal-body");
  document.getElementById("modal-close").addEventListener("click", closeModal);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && activeModalJobId) closeModal();
  });

  function openModal(id, opts) {
    activeModalJobId = id;
    const job = getJob(id);
    renderModalBody(job);
    backdrop.classList.remove("hidden");
    if (opts && opts.focusName) {
      setTimeout(() => {
        const el = document.getElementById("field-name");
        if (el) el.focus();
      }, 30);
    }
  }

  function closeModal() {
    activeModalJobId = null;
    backdrop.classList.add("hidden");
    modalBody.innerHTML = "";
  }

  function renderModalBody(job) {
    const isBid = job.type === "bidding";
    const items = itemsFor(job);
    const prog = progressOf(job);
    const cursorPos = modalBody.querySelector("input:focus, textarea:focus");
    const focusedField = cursorPos ? cursorPos.id : null;
    const selectionStart = cursorPos ? cursorPos.selectionStart : null;

    modalBody.innerHTML = `
      <h2>${escapeHtml(job.name) || "Untitled Job"}</h2>
      <p class="modal-subtitle">${isBid ? "Bid checklist" : "Job task list"} — ${prog.done}/${prog.total} complete</p>

      <div class="field-grid">
        <div class="field full">
          <label for="field-name">Job / Project Name</label>
          <input id="field-name" type="text" value="${escapeHtml(job.name)}" placeholder="e.g. Maple St. Duplex Remodel" />
        </div>
        <div class="field">
          <label for="field-client">Client</label>
          <input id="field-client" type="text" value="${escapeHtml(job.client)}" placeholder="Owner / GC name" />
        </div>
        <div class="field">
          <label for="field-location">Location</label>
          <input id="field-location" type="text" value="${escapeHtml(job.location)}" placeholder="Address / area" />
        </div>
        <div class="field">
          <label for="field-priority">Priority</label>
          <select id="field-priority">
            <option value="high" ${job.priority === "high" ? "selected" : ""}>High</option>
            <option value="medium" ${job.priority === "medium" ? "selected" : ""}>Medium</option>
            <option value="low" ${job.priority === "low" ? "selected" : ""}>Low</option>
          </select>
        </div>
        <div class="field">
          <label for="field-date">${isBid ? "Bid Due Date" : "Target Completion"}</label>
          <input id="field-date" type="date" value="${job.keyDate || ""}" />
        </div>
        <div class="field">
          <label for="field-value">${isBid ? "Estimated Bid Value ($)" : "Contract Value ($)"}</label>
          <input id="field-value" type="number" min="0" step="1000" value="${job.value === "" || job.value == null ? "" : job.value}" />
        </div>
        <div class="field full">
          <label for="field-notes">Notes</label>
          <textarea id="field-notes" placeholder="Scope notes, blockers, reminders...">${escapeHtml(job.notes)}</textarea>
        </div>
      </div>

      <div class="section-title">
        <span>${isBid ? "Estimator Checklist" : "Task List"}</span>
        <small>${prog.done}/${prog.total} done</small>
      </div>
      <ul class="checklist" id="checklist-el"></ul>
      <div class="add-item-row">
        <input type="text" id="new-item-input" placeholder="${isBid ? "Add a checklist item..." : "Add a task..."}" />
        <button class="btn btn-secondary btn-small" id="add-item-btn">Add</button>
      </div>

      <div class="modal-actions">
        <div class="left">
          ${
            job.archived
              ? ""
              : isBid
              ? `<button class="btn btn-primary btn-small" id="mark-won">✓ Won — Move to Active</button>
                 <button class="btn btn-secondary btn-small" id="mark-lost">Mark Lost</button>`
              : `<button class="btn btn-primary btn-small" id="mark-complete">✓ Mark Complete</button>`
          }
        </div>
        <div class="right">
          <button class="btn btn-danger-text btn-small" id="delete-job">Delete Job</button>
        </div>
      </div>
    `;

    // Field bindings
    bindField("field-name", "name");
    bindField("field-client", "client");
    bindField("field-location", "location");
    bindField("field-notes", "notes");
    bindField("field-date", "keyDate");
    document.getElementById("field-priority").addEventListener("change", (e) => {
      job.priority = e.target.value;
      saveJobs();
      render();
    });
    document.getElementById("field-value").addEventListener("input", (e) => {
      job.value = e.target.value === "" ? "" : Number(e.target.value);
      saveJobs();
      renderStats();
      updateCardsOnly();
    });

    function bindField(elId, prop) {
      const el = document.getElementById(elId);
      el.addEventListener("input", (e) => {
        job[prop] = e.target.value;
        saveJobs();
        updateCardsOnly();
        const h2 = modalBody.querySelector("h2");
        if (prop === "name") h2.textContent = job.name || "Untitled Job";
      });
    }

    // Checklist rendering
    const checklistEl = document.getElementById("checklist-el");
    function renderChecklist() {
      checklistEl.innerHTML = "";
      items.forEach((item) => {
        const li = document.createElement("li");
        li.className = "checklist-item" + (item.done ? " done" : "");
        li.innerHTML = `
          <input type="checkbox" ${item.done ? "checked" : ""} />
          <span class="item-text">${escapeHtml(item.text)}</span>
          <button class="item-remove" title="Remove">✕</button>
        `;
        li.querySelector('input[type="checkbox"]').addEventListener("change", (e) => {
          item.done = e.target.checked;
          saveJobs();
          li.classList.toggle("done", item.done);
          updateProgressLabels();
          updateCardsOnly();
        });
        li.querySelector(".item-remove").addEventListener("click", () => {
          const idx = items.indexOf(item);
          if (idx > -1) items.splice(idx, 1);
          saveJobs();
          renderChecklist();
          updateProgressLabels();
          updateCardsOnly();
        });
        checklistEl.appendChild(li);
      });
    }
    renderChecklist();

    function updateProgressLabels() {
      const p = progressOf(job);
      modalBody.querySelector(".modal-subtitle").textContent = `${isBid ? "Bid checklist" : "Job task list"} — ${p.done}/${p.total} complete`;
      modalBody.querySelector(".section-title small").textContent = `${p.done}/${p.total} done`;
    }

    document.getElementById("add-item-btn").addEventListener("click", addNewItem);
    document.getElementById("new-item-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") addNewItem();
    });
    function addNewItem() {
      const input = document.getElementById("new-item-input");
      const text = input.value.trim();
      if (!text) return;
      items.push({ id: uid(), text, done: false });
      input.value = "";
      saveJobs();
      renderChecklist();
      updateProgressLabels();
      updateCardsOnly();
      document.getElementById("new-item-input").focus();
    }

    // Action buttons
    const deleteBtn = document.getElementById("delete-job");
    deleteBtn.addEventListener("click", () => {
      if (confirm(`Delete "${job.name || "this job"}"? This cannot be undone.`)) {
        jobs = jobs.filter((j) => j.id !== job.id);
        saveJobs();
        closeModal();
        render();
      }
    });

    const wonBtn = document.getElementById("mark-won");
    if (wonBtn) {
      wonBtn.addEventListener("click", () => {
        job.type = "active";
        job.tasks = job.tasks && job.tasks.length ? job.tasks : makeChecklist(ACTIVE_STARTER_TASKS);
        job.order = jobs.filter((j) => j.type === "active" && !j.archived).length;
        saveJobs();
        closeModal();
        render();
      });
    }

    const lostBtn = document.getElementById("mark-lost");
    if (lostBtn) {
      lostBtn.addEventListener("click", () => {
        job.archived = true;
        job.archivedReason = "lost";
        job.archivedAt = Date.now();
        saveJobs();
        closeModal();
        render();
      });
    }

    const completeBtn = document.getElementById("mark-complete");
    if (completeBtn) {
      completeBtn.addEventListener("click", () => {
        job.archived = true;
        job.archivedReason = "completed";
        job.archivedAt = Date.now();
        saveJobs();
        closeModal();
        render();
      });
    }

    // Restore focus if a text field was being edited when a background re-render happened
    if (focusedField) {
      const el = document.getElementById(focusedField);
      if (el) {
        el.focus();
        if (selectionStart != null && el.setSelectionRange) {
          try { el.setSelectionRange(selectionStart, selectionStart); } catch (e) {}
        }
      }
    }
  }

  function updateCardsOnly() {
    // Lightweight re-render of just the board cards (not the modal) to reflect edits live.
    const activeJobs = jobs.filter((j) => j.type === "active" && !j.archived).sort((a, b) => a.order - b.order);
    const biddingJobs = jobs.filter((j) => j.type === "bidding" && !j.archived).sort((a, b) => a.order - b.order);
    const archivedJobs = jobs.filter((j) => j.archived).sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
    renderList(activeListEl, activeJobs);
    renderList(biddingListEl, biddingJobs);
    renderList(archiveListEl, archivedJobs);
    renderStats();
  }

  // ---------------- PWA install + offline support ----------------

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  let deferredInstallPrompt = null;
  const installBtn = document.getElementById("install-btn");

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installBtn.classList.remove("hidden");
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    installBtn.disabled = true;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.classList.add("hidden");
    installBtn.disabled = false;
  });

  window.addEventListener("appinstalled", () => {
    installBtn.classList.add("hidden");
    deferredInstallPrompt = null;
  });

  // ---------------- Init ----------------
  render();
})();
