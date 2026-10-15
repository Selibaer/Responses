const state = { responses: [] };
const $ = selector => document.querySelector(selector);
const fields = [
  ["q1", "Assoziationen"], ["q2", "Farben, Formen & Bilder"], ["q3", "Wirkung der Gestaltung"],
  ["moodboards", "Moodboards"], ["corporateDesigns", "Corporate Designs"], ["logos", "Logoentwürfe"],
  ["q7", "Eindrücke nach Beispielen"], ["q8", "Beste Variante & Begründung"], ["q9", "Ideales Erscheinungsbild"]
];

function escapeHtml(value) { return String(value == null ? "" : value).replace(/[&<>\"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[char]); }
function textFor(response, key) {
  const answers = response.answers || {};
  const value = answers[key];
  if (key === "q8") return [answers.q8Choice ? `Ausgewählt: Variante ${answers.q8Choice}` : "", value].filter(Boolean).join("\n\n");
  if (value && typeof value === "object") return ["A", "B", "C"].map(letter => value[letter] ? `Variante ${letter}: ${value[letter]}` : "").filter(Boolean).join("\n\n");
  return value || "";
}
function answeredCount(response) { return fields.filter(([key]) => textFor(response, key).trim()).length; }
function formatDate(value) { if (!value) return "Ohne Datum"; const date = new Date(value); return Number.isNaN(date) ? String(value) : date.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" }); }
function addMessage(message) { $("#messages").innerHTML = message ? `<p class="message">${escapeHtml(message)}</p>` : ""; }

function render() {
  const hasResponses = state.responses.length > 0;
  $("#emptyState").hidden = hasResponses; $("#results").hidden = !hasResponses;
  if (!hasResponses) return;
  const complete = state.responses.filter(r => r.completedAt).length;
  const average = Math.round(state.responses.reduce((sum, r) => sum + answeredCount(r), 0) / state.responses.length);
  $("#responseCount").textContent = state.responses.length;
  $("#summary").innerHTML = `<div class="stat"><b>${complete}</b><span>abgeschlossen</span></div><div class="stat"><b>${average} / ${fields.length}</b><span>Antwortfelder im Schnitt</span></div><div class="stat"><b>${new Set(state.responses.map(r => r.id || r._file)).size}</b><span>eindeutige Teilnahmen</span></div>`;
  $("#responseList").innerHTML = state.responses.map((response, index) => {
    const answers = fields.map(([key, label]) => { const text = textFor(response, key); return `<section class="answer ${text ? "" : "answer--empty"}"><h3>${label}</h3><p>${escapeHtml(text || "Keine Angabe")}</p></section>`; }).join("");
    const date = response.completedAt || response.startedAt || (response.meta && response.meta.date);
    return `<details class="response" ${index === 0 ? "open" : ""}><summary><span class="response__id">${escapeHtml(response.id || response._file)}</span><span class="response__date">${escapeHtml(formatDate(date))}</span><span class="response__completion">${answeredCount(response)} von ${fields.length} beantwortet</span></summary><div class="answer-grid">${answers}</div></details>`;
  }).join("");
}

async function ingest(files) {
  const accepted = [], errors = [];
  for (const file of [...files]) {
    try { const data = JSON.parse(await file.text()); if (!data || typeof data !== "object" || !data.answers) throw new Error(); data._file = file.name; accepted.push(data); }
    catch { errors.push(file.name); }
  }
  const existing = new Set(state.responses.map(r => r.id || r._file));
  const fresh = accepted.filter(r => !existing.has(r.id || r._file));
  state.responses.push(...fresh);
  addMessage(errors.length ? `${errors.length} Datei(en) konnten nicht als Palmengarten-Antwort gelesen werden: ${errors.join(", ")}` : fresh.length ? `${fresh.length} Antwortdatei(en) hinzugefügt.` : "Diese Antwortdateien sind bereits in der Liste.");
  render();
}

function downloadSummary() {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), responseCount: state.responses.length, responses: state.responses }, null, 2)], { type: "application/json" });
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "palmengarten-antworten.json" }); link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

const dropzone = $("#dropzone");
$("#browseButton").onclick = () => $("#fileInput").click();
$("#fileInput").onchange = event => { ingest(event.target.files); event.target.value = ""; };
["dragenter", "dragover"].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.add("is-dragging"); }));
["dragleave", "drop"].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.remove("is-dragging"); }));
dropzone.addEventListener("drop", event => ingest(event.dataTransfer.files));
$("#clearButton").onclick = () => { state.responses = []; addMessage(""); render(); };
$("#exportButton").onclick = downloadSummary;
render();
