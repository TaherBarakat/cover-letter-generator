// Cover letter renderer — replaces Handlebars + server-side rendering.
// Profile (sender info) defaults live here; the app can override them
// with getProfile()/setProfile() and saves changes to localStorage.

const PROFILE_DEFAULTS = {
  name: "pink guy",
  street: "pink guy street",
  postal: "007007",
  city: "new york",
  phone: "(+963) 099999999999999",
  email: "pink.guy@gmail.com",
  title: "Bewerbung",
  photo: "",
};

let profile = { ...PROFILE_DEFAULTS };

function getProfile() {
  return profile;
}

function setProfile(p) {
  profile = { ...PROFILE_DEFAULTS, ...(p || {}) };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function germanDate() {
  return new Date().toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// Blank line separated -> <p> paragraphs
function paragraphs(text) {
  const t = String(text || "").replace(/\r\n/g, "\n");
  return t
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => "<p>" + escapeHtml(p) + "</p>")
    .join("\n");
}

// ---------------------------------------------------------------------------
// Letter CSS
// ---------------------------------------------------------------------------

const LETTER_CSS = `
  @import url("https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&display=swap");
  * { box-sizing: border-box; }
  body {
    font-family: "Crimson Pro", serif;
    font-size: 11.5pt;
    line-height: 1.45;
    color: #000;
    width: 210mm;
    margin: 0 auto;
    padding: 20mm 25mm;
  }
  .sender { font-size: 9.5pt; color: #333; }
  .sender .name { font-weight: 700; font-size: 11pt; color: #000; }
  .spacer { height: 12mm; }
  .recipient { width: 78mm; }
  .recipient .clinic { font-weight: 700; }
  .recipient .sub-line { font-size: 9.5pt; }
  .date { text-align: right; margin: 8mm 0; }
  .subject {
    font-weight: 700;
    font-size: 12.5pt;
    margin: 2mm 0 6mm;
    border-bottom: 1.5px solid #000;
    padding-bottom: 2mm;
  }
  .body p { margin: 0 0 4mm; text-align: justify; }
  .closing { margin-top: 8mm; margin-bottom: 0; }
  .signature { margin-top: 14mm; font-weight: 700; }
  .signature .signature-photo {
    display: block;
    width: 26mm;
    height: auto;
    border-radius: 2mm;
    object-fit: cover;
    margin-bottom: 6mm;
  }
`;

const PREVIEW_CSS = `
  html, body { margin: 0 !important; background: #d9dde3 !important; }
`;

const PRINT_CSS = `
  @media print {
    @page { size: A4; margin: 20mm; }
    html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
    body { width: auto !important; }
  }
`;

// ---------------------------------------------------------------------------
// Fit-to-width script (preview only)
// ---------------------------------------------------------------------------

const FIT_SCRIPT =
  "<script>" +
  "(function () {\n" +
  "  var body = document.body;\n" +
  "  function fit() {\n" +
  "    var avail = document.documentElement.clientWidth || window.innerWidth;\n" +
  "    if (!avail) return;\n" +
  "    body.style.zoom = '1';\n" +
  "    var natural = body.getBoundingClientRect().width;\n" +
  "    if (!natural) return;\n" +
  "    var s = natural > avail ? avail / natural : 1;\n" +
  "    body.style.zoom = String(s);\n" +
  "    body.style.margin = '0 auto';\n" +
  "    if (s < 1) body.style.marginLeft = Math.max(0, (avail - natural * s) / 2) + 'px';\n" +
  "  }\n" +
  "  window.addEventListener('resize', fit);\n" +
  "  window.addEventListener('load', function () { setTimeout(fit, 100); });\n" +
  "  fit();\n" +
  "})();\n" +
  "</scr" +
  "ipt>";

// Auto-print for the "Save as PDF" window
const PRINT_SCRIPT =
  "<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 300); });</scr" +
  "ipt>";

// ---------------------------------------------------------------------------
// Render a letter as a full HTML document
// mode: "preview" (fit to screen) or "print" (A4, auto print dialog)
// ---------------------------------------------------------------------------

function renderLetter(letter, mode) {
  const p = profile;
  const name = String(letter.name || "").trim();
  const consignee = String(letter.consignee || "").trim();
  const location = String(letter.location || "").trim();
  const isPreview = mode === "preview";

  const body =
    '<div class="sender">' +
    '<div class="name">' +
    escapeHtml(p.name) +
    "</div>" +
    (p.street ? "<div>" + escapeHtml(p.street) + "</div>" : "") +
    (p.postal
      ? "<div>" + escapeHtml(p.postal) + " " + escapeHtml(p.city) + "</div>"
      : "") +
    (p.phone ? "<div>Tel.: " + escapeHtml(p.phone) + "</div>" : "") +
    (p.email ? "<div>" + escapeHtml(p.email) + "</div>" : "") +
    "</div>" +
    '<div class="spacer"></div>' +
    '<div class="recipient">' +
    '<div class="clinic">' +
    escapeHtml(name) +
    "</div>" +
    (consignee
      ? '<div class="sub-line">' + escapeHtml(consignee) + "</div>"
      : "") +
    (location
      ? '<div class="sub-line">' + escapeHtml(location) + "</div>"
      : "") +
    "</div>" +
    '<div class="date">' +
    escapeHtml(p.city) +
    ", " +
    escapeHtml(germanDate()) +
    "</div>" +
    '<div class="subject">' + escapeHtml(p.title || "Bewerbung") + "</div>" +
    '<div class="body">' +
    paragraphs(letter.text) +
    "</div>" +
    '<p class="closing">Mit freundlichen Grüßen</p>' +
    '<div class="signature">' +
    (p.photo
      ? '<img class="signature-photo" src="' +
        escapeHtml(p.photo) +
        '" alt="" />'
      : "") +
    escapeHtml(p.name) +
    "</div>";

  const css = LETTER_CSS + (isPreview ? PREVIEW_CSS : PRINT_CSS);

  const scripts = isPreview ? FIT_SCRIPT : PRINT_SCRIPT;

  return (
    "<!DOCTYPE html>\n" +
    '<html lang="de">\n<head>\n<meta charset="UTF-8" />\n' +
    "<title>" +
    escapeHtml(name) +
    " – " +
    escapeHtml(p.title || "Bewerbung") +
    "</title>\n" +
    "<style>\n" +
    css +
    "\n</style>\n</head>\n<body>\n" +
    body +
    "\n" +
    scripts +
    "\n</body>\n</html>"
  );
}
