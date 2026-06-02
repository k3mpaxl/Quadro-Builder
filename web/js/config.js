// Globale Konstanten fuer den Quadro-Builder.

// Die 6 Achsen-Richtungen eines Wuerfel-Knotens (Three.js: y = oben).
export const DIRECTIONS = [
  { name: "+X", vec: [1, 0, 0] },
  { name: "-X", vec: [-1, 0, 0] },
  { name: "+Y", vec: [0, 1, 0] },
  { name: "-Y", vec: [0, -1, 0] },
  { name: "+Z", vec: [0, 0, 1] },
  { name: "-Z", vec: [0, 0, -1] },
];

// Schraege Rampen-/Dach-Richtungen. Projektvorgabe: alle Schraegen sind immer
// 45 Grad (eine waagerechte Achse kombiniert mit hoch/runter, normiert) -- auch
// wenn importierte QDF-Modelle andere Winkel angeben. 8 vertikale Diagonalen.
const S = Math.SQRT1_2; // 1/sqrt(2)  -> 45 Grad
export const DIAGONAL_DIRECTIONS = [
  { name: "+X+Y", vec: [S, S, 0] },
  { name: "+X-Y", vec: [S, -S, 0] },
  { name: "-X+Y", vec: [-S, S, 0] },
  { name: "-X-Y", vec: [-S, -S, 0] },
  { name: "+Z+Y", vec: [0, S, S] },
  { name: "+Z-Y", vec: [0, -S, S] },
  { name: "-Z+Y", vec: [0, S, -S] },
  { name: "-Z-Y", vec: [0, -S, -S] },
];

// Toleranz (cm), innerhalb der zwei Knoten als identisch gelten und verschmelzen.
export const MERGE_EPS = 0.5;

// Schluessel fuer den automatischen Zwischenspeicher.
export const AUTOSAVE_KEY = "quadro.autosave.v1";

// Aktuelles Speicherformat (fuer spaetere Migrationen).
export const FORMAT_VERSION = 1;
