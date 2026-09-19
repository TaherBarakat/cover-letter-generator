// ---------------------------------------------------------------------------
// Cover Letter Generator — fully static (works on GitHub Pages and file://)
// Data: one array of applications saved in the browser (localStorage).
// Back up with "Export db.json" and restore with "Import".
// ---------------------------------------------------------------------------

const DATA_KEY = "cover-letter-db:v1";
const PROFILE_KEY = "cover-letter-profile:v1";

// Fallback seed (mirrors db.json in the repo) — used if nothing is stored yet
// and db.json cannot be fetched (e.g. opening index.html from file://).
const SEED_DB = [
  {
    id: "1",
    name: "Zahnarztpraxis Muster",
    website: "https://www.example-praxis.de",
    consignee: "z. Hd. Dr. Anna Mustermann",
    location: "Musterstraße 1, 47051 Duisburg",
    text: "hiermit bewerbe ich mich bei Ihnen als Zahnärztin.\n\nNach meinem Studium der Zahnmedizin an der Tishreen Universität und mehrjähriger Berufserfahrung als Zahnärztin bringe ich umfassende klinische Erfahrung mit. Ich arbeite sorgfältig, patientenorientiert und sehr gerne im Team.\n\nÜber die Einladung zu einem persönlichen Vorstellungsgespräch freue ich mich sehr.",
    createdAt: "2026-09-18T08:00:00.000Z",
    updatedAt: "2026-09-18T08:00:00.000Z",
  },
];

const state = {
  db: [],
  currentId: null,
  filter: "",
  dirty: false,
};

const $ = (id) => document.getElementById(id);
const listEl = $("list");
const editorPane = $("editor");
const emptyEl = $("empty");
const menuBtn = $("menu-btn");
const backdrop = $("backdrop");
const searchInput = $("search");
const importInput = $("import-file");

const MobileQuery = window.matchMedia("(max-width: 768px)");
const isMobile = () => MobileQuery.matches;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function toggleSidebar() {
  if (isMobile()) {
    document.body.classList.toggle("sidebar-open");
  } else {
    document.body.classList.toggle("sidebar-collapsed");
  }
}

function closeSidebar() {
  document.body.classList.remove("sidebar-open");
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function persistDB() {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(state.db));
  } catch (e) {
    setStatus("Could not save: " + e.message, true);
  }
}

async function loadDB() {
  // 1. stored data wins
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        state.db = normalize(parsed);
        persistDB();
        return;
      }
    }
  } catch (e) {
    /* ignore corrupt storage */
  }
  // 2. seed file from the server (db.json)
  try {
    const res = await fetch("db.json");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        state.db = normalize(data);
        persistDB();
        return;
      }
    }
  } catch (e) {
    /* file:// fetch may fail — fall through to embedded seed */
  }
  // 3. embedded fallback
  state.db = normalize(SEED_DB);
  persistDB();
}

function normalize(arr) {
  const seen = new Set();
  return arr
    .filter((x) => x && x.name)
    .map((x) => {
      let id = String(x.id || uid());
      while (seen.has(id)) id = uid();
      seen.add(id);
      return {
        id,
        name: String(x.name),
        website: String(x.website || ""),
        consignee: String(x.consignee || ""),
        location: String(x.location || ""),
        text: String(x.text || ""),
        createdAt: x.createdAt || new Date().toISOString(),
        updatedAt: x.updatedAt || new Date().toISOString(),
      };
    });
}

function getLetter(id) {
  return state.db.find((l) => l.id === id) || null;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

function renderList() {
  const filter = state.filter.trim().toLowerCase();
  listEl.innerHTML = "";
  let count = 0;
  for (const l of state.db) {
    if (filter && !l.name.toLowerCase().includes(filter)) continue;
    count++;
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = l.name;
    btn.className = "list-item";
    if (l.id === state.currentId) btn.classList.add("active");
    btn.addEventListener("click", () => select(l.id));
    li.appendChild(btn);
    listEl.appendChild(li);
  }
  if (count === 0) {
    const li = document.createElement("li");
    const div = document.createElement("div");
    div.className = "no-results";
    div.textContent = state.db.length === 0 ? "No letters yet" : "No matches";
    li.appendChild(div);
    listEl.appendChild(li);
  }
}

// ---------------------------------------------------------------------------
// Select / Save / Create / Delete
// ---------------------------------------------------------------------------

function loadIntoUI(l) {
  state.currentId = l.id;
  state.dirty = false;
  $("company").value = l.name;
  $("website").value = l.website || "";
  $("consignee").value = l.consignee || "";
  $("location").value = l.location || "";
  $("text").value = l.text || "";
  $("preview-wrap").hidden = true;
  $("preview-frame").srcdoc = "";
  editorPane.hidden = false;
  emptyEl.hidden = true;
  setStatus("");
  renderList();
}

function select(id) {
  const l = getLetter(id);
  if (!l) return;
  if (state.currentId && state.dirty) {
    if (!confirm(`Discard unsaved changes to "${state.current.name}"?`)) {
      renderList();
      return;
    }
  }
  loadIntoUI(l);
  searchInput.value = "";
  state.filter = "";
  closeSidebar();
  renderList();
}

function save() {
  if (!state.currentId) {
    setStatus("No letter selected", true);
    return;
  }
  const l = getLetter(state.currentId);
  if (!l) return;
  const name = $("company").value.trim();
  if (!name) {
    setStatus("The company name cannot be empty", true);
    return;
  }
  const dup = state.db.find(
    (x) => x.id !== l.id && x.name.toLowerCase() === name.toLowerCase()
  );
  if (dup) {
    setStatus("A letter with this name already exists", true);
    return;
  }
  l.name = name;
  l.website = $("website").value.trim();
  l.consignee = $("consignee").value.trim();
  l.location = $("location").value.trim();
  l.text = $("text").value;
  l.updatedAt = new Date().toISOString();
  state.dirty = false;
  persistDB();
  setStatus("Saved");
  renderList();
}

function saveIfDirty() {
  if (state.dirty && state.currentId) save();
}

function createNew() {
  $("n-company").value = "";
  $("n-consignee").value = "";
  $("n-location").value = "";
  $("new-modal").hidden = false;
}

function closeNewModal() {
  $("new-modal").hidden = true;
}

function confirmNew() {
  const name = $("n-company").value.trim();
  if (!name) {
    setStatus("The company name cannot be empty", true);
    return;
  }
  if (state.db.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
    setStatus("A letter with this name already exists", true);
    return;
  }
  const now = new Date().toISOString();
  const l = {
    id: uid(),
    name,
    website: "",
    consignee: $("n-consignee").value.trim(),
    location: $("n-location").value.trim(),
    text: "",
    createdAt: now,
    updatedAt: now,
  };
  state.db.push(l);
  persistDB();
  closeNewModal();
  loadIntoUI(l);
  setStatus("New letter created");
}

function remove() {
  if (!state.currentId) return;
  const l = getLetter(state.currentId);
  if (!confirm(`Really delete "${l.name}"?`)) return;
  state.db = state.db.filter((x) => x.id !== l.id);
  persistDB();
  state.currentId = null;
  state.dirty = false;
  editorPane.hidden = true;
  emptyEl.hidden = false;
  renderList();
  setStatus(`"${l.name}" deleted`);
}

// ---------------------------------------------------------------------------
// Export / Import
// ---------------------------------------------------------------------------

function exportDB() {
  const blob = new Blob([JSON.stringify(state.db, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "db.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  setStatus("db.json downloaded (backup saved)");
}

function importDB(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error("db.json must be an array");
      state.db = normalize(data);
      state.currentId = null;
      state.dirty = false;
      persistDB();
      editorPane.hidden = true;
      emptyEl.hidden = false;
      renderList();
      setStatus(`Imported ${state.db.length} letters`);
    } catch (e) {
      setStatus("Import failed: " + e.message, true);
    }
  };
  reader.readAsText(file);
}

// ---------------------------------------------------------------------------
// Preview / PDF
// ---------------------------------------------------------------------------

function preview() {
  if (!state.currentId) return;
  saveIfDirty();
  const l = getLetter(state.currentId);
  const frame = $("preview-frame");
  frame.onload = () => {
    try {
      const doc = frame.contentDocument || frame.contentWindow.document;
      const h = Math.max(
        doc.documentElement.scrollHeight,
        doc.body.scrollHeight
      );
      frame.style.height = Math.max(300, h + 8) + "px";
    } catch (e) {
      /* ignore */
    }
  };
  frame.srcdoc = renderLetter(l, "preview");
  $("preview-wrap").hidden = false;
}

function generatePDF() {
  if (!state.currentId) return;
  saveIfDirty();
  const l = getLetter(state.currentId);
  const w = window.open("", "_blank");
  if (!w) {
    setStatus("Popup blocked — allow popups for this site", true);
    return;
  }
  w.document.write(renderLetter(l, "print"));
  w.document.close();
  w.focus();
  setStatus("Print window opened — choose \"Save as PDF\"");
}

// ---------------------------------------------------------------------------
// Profile (sender details)
// ---------------------------------------------------------------------------

function openProfile() {
  const p = getProfile();
  $("p-name").value = p.name || "";
  $("p-email").value = p.email || "";
  $("p-phone").value = p.phone || "";
  $("p-street").value = p.street || "";
  $("p-postal").value = p.postal || "";
  $("p-city").value = p.city || "";
  $("p-title").value = p.title || "";
  pendingPhoto = p.photo || "";
  updatePhotoPreview();
  $("profile-modal").hidden = false;
}

function closeProfile() {
  $("profile-modal").hidden = true;
}

let pendingPhoto = "";

function updatePhotoPreview() {
  const prev = $("p-photo-preview");
  if (pendingPhoto) {
    prev.src = pendingPhoto;
    prev.hidden = false;
    $("p-photo-remove").hidden = false;
  } else {
    prev.removeAttribute("src");
    prev.hidden = true;
    $("p-photo-remove").hidden = true;
  }
}

function readPhoto() {
  const file = $("p-photo").files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setStatus("Choose an image file", true);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 400;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      pendingPhoto = canvas.toDataURL("image/jpeg", 0.85);
      updatePhotoPreview();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function saveProfile() {
  const name = $("p-name").value.trim();
  if (!name) {
    setStatus("The name cannot be empty", true);
    return;
  }
  setProfile({
    name,
    email: $("p-email").value.trim(),
    phone: $("p-phone").value.trim(),
    street: $("p-street").value.trim(),
    postal: $("p-postal").value.trim(),
    city: $("p-city").value.trim(),
    title: $("p-title").value.trim() || "Bewerbung",
    photo: pendingPhoto,
  });
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(getProfile()));
  } catch (e) {
    setStatus("Could not save profile: " + e.message, true);
  }
  closeProfile();
  setStatus("Profile saved");
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setProfile(parsed);
      }
    }
  } catch (e) {
    /* keep defaults */
  }
}

function profileFromModal(e) {
  if (e.key !== "Escape") return;
  if (!$("new-modal").hidden) {
    closeNewModal();
  } else if (!$("profile-modal").hidden) {
    closeProfile();
  }
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

let statusTimer = null;
function setStatus(msg, isError = false) {
  const el = $("status");
  el.textContent = msg;
  el.style.color = isError ? "#c0392b" : "#27ae60";
  clearTimeout(statusTimer);
  if (msg) {
    statusTimer = setTimeout(() => {
      if (el.textContent === msg) el.textContent = "";
    }, 4000);
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", function init() {
  menuBtn.addEventListener("click", toggleSidebar);
  backdrop.addEventListener("click", closeSidebar);

  searchInput.addEventListener("input", () => {
    state.filter = searchInput.value;
    renderList();
  });

  $("new-btn").addEventListener("click", createNew);
  $("empty-new").addEventListener("click", createNew);
  $("n-close").addEventListener("click", closeNewModal);
  $("n-cancel").addEventListener("click", closeNewModal);
  $("n-create").addEventListener("click", confirmNew);
  $("new-modal").addEventListener("click", (e) => {
    if (e.target === $("new-modal")) closeNewModal();
  });
  $("n-company").addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirmNew();
  });
  $("profile-btn").addEventListener("click", openProfile);
  $("p-close").addEventListener("click", closeProfile);
  $("p-cancel").addEventListener("click", closeProfile);
  $("p-save").addEventListener("click", saveProfile);
  $("p-photo-btn").addEventListener("click", () => $("p-photo").click());
  $("p-photo").addEventListener("change", () => {
    readPhoto();
    $("p-photo").value = "";
  });
  $("p-photo-remove").addEventListener("click", () => {
    pendingPhoto = "";
    updatePhotoPreview();
  });
  $("profile-modal").addEventListener("click", (e) => {
    if (e.target === $("profile-modal")) closeProfile();
  });
  document.addEventListener("keydown", profileFromModal);
  $("save-btn").addEventListener("click", save);
  $("pdf-btn").addEventListener("click", generatePDF);
  $("preview-btn").addEventListener("click", preview);
  $("delete-btn").addEventListener("click", remove);
  $("export-btn").addEventListener("click", exportDB);
  $("import-btn").addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", () => {
    importDB(importInput.files[0]);
    importInput.value = "";
  });
  $("close-preview").addEventListener("click", () => {
    $("preview-wrap").hidden = true;
    $("preview-frame").srcdoc = "";
  });
  $("open-site-btn").addEventListener("click", () => {
    const raw = $("website").value.trim();
    if (!raw) {
      setStatus("Enter a website first", true);
      return;
    }
    const url = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
    window.open(url, "_blank", "noopener");
  });

  ["company", "website", "consignee", "location", "text"].forEach((id) => {
    $(id).addEventListener("input", () => {
      state.dirty = true;
    });
  });

  loadProfile();
  loadDB().then(() => {
    renderList();
  });
});