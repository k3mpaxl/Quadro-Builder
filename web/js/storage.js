// Speicher-Layer: Offline-Persistenz via localStorage + Datei Export/Import.
// Bewusst gekapselt: ein spaeteres Django-Backend ersetzt nur dieses Modul
// (z. B. saveNamed -> POST /api/designs, listNames -> GET /api/designs).

import { AUTOSAVE_KEY } from "./config.js";

const INDEX_KEY = "quadro.designs.index.v1";
const PREFIX = "quadro.design.v1.";

// Wird geworfen, wenn localStorage voll ist (QuotaExceededError o.ae.).
// Eigene Klasse statt der DOMException, damit Aufrufer (UI-Schicht) den Fall
// unabhaengig vom Browser sauber erkennen und uebersetzen koennen, ohne dass
// dieses Modul i18n importieren muss.
export class QuotaError extends Error {
  constructor(cause) {
    super("Storage quota exceeded");
    this.name = "QuotaError";
    this.cause = cause;
  }
}

function isQuotaError(e) {
  return e instanceof DOMException &&
    (e.code === 22 || e.code === 1014 || e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED");
}

export function autosave(data) {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn("Autosave fehlgeschlagen:", e);
    return false;
  }
}

export function loadAutosave() {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function listNames() {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveNamed(name, data) {
  name = (name || "").trim();
  if (!name) throw new Error("Bitte einen Namen angeben");
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify(data));
  } catch (e) {
    if (isQuotaError(e)) throw new QuotaError(e);
    throw e;
  }
  const names = listNames();
  if (!names.includes(name)) {
    names.push(name);
    names.sort((a, b) => a.localeCompare(b, "de"));
    try {
      localStorage.setItem(INDEX_KEY, JSON.stringify(names));
    } catch (e) {
      if (isQuotaError(e)) throw new QuotaError(e);
      throw e;
    }
  }
  return true;
}

export function loadNamed(name) {
  const raw = localStorage.getItem(PREFIX + name);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function deleteNamed(name) {
  localStorage.removeItem(PREFIX + name);
  const names = listNames().filter((n) => n !== name);
  localStorage.setItem(INDEX_KEY, JSON.stringify(names));
}

// --- Datei Export/Import (echte Offline-Sicherung) ----------------------
export function exportFile(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "quadro-entwurf.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result)); }
      catch (e) { reject(new Error("Datei ist kein gueltiges JSON")); }
    };
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    reader.readAsText(file);
  });
}
