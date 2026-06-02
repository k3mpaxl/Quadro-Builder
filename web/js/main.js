// Einstiegspunkt: Katalog laden, Szene/Modell/Builder/UI aufsetzen, Autosave.

import { loadCatalog } from "./catalog.js";
import { BuildModel } from "./model.js";
import { SceneManager } from "./scene.js";
import { Builder } from "./builder.js";
import { initUI } from "./ui.js";
import { autosave, loadAutosave } from "./storage.js";
import { t } from "./i18n.js";

async function boot() {
  try {
    await loadCatalog();
  } catch (e) {
    document.getElementById("status").textContent =
      e.message + " — " + t("catalog_load_fail_hint");
    return;
  }

  const scene = new SceneManager(document.getElementById("canvas"));
  const model = new BuildModel();

  // Letzten Stand wiederherstellen
  const saved = loadAutosave();
  if (saved) model.loadJSON(saved);

  const builder = new Builder(scene, model, { onChange: () => {} });
  const ui = initUI({ scene, model, builder });

  builder.onChange = () => {
    ui.update();
    autosave(model.toJSON());
  };
  builder.refresh();
}

boot();
