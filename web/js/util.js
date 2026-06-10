// Kleine, von allen Modulen geteilte Hilfsfunktionen (geometriefrei, ohne
// Abhaengigkeiten) -- vermeidet die mehrfache Definition von round2() in
// model.js, builder.js, bom.js und qdfimport.js.

// Rundet auf 2 Nachkommastellen (cm-Werte fuer Speicherung/Vergleich).
export function round2(v) {
  return Math.round(v * 100) / 100;
}
