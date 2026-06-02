// 3D-Szene + Rendering (Three.js). Kennt das Modell nur zum Zeichnen.

import * as THREE from "three";
import { OrbitControls } from "../vendor/three/OrbitControls.js";
import { geometry, colorHex, connectorColor } from "./catalog.js";

const UP = new THREE.Vector3(0, 1, 0);

// Hintergrundfarben fuer die Beschriftung nach Kategorie (Aufbaumodus-Hervorhebung).
const LABEL_BG = {
  tube75: "rgba(139,61,245,0.94)",  // 75er Rohre - violett
  flaeche: "rgba(20,160,110,0.95)", // Flaechenkupplungen - gruen
  raum: "rgba(26,140,255,0.95)",    // Raumkupplungen - blau
};

export class SceneManager {
  constructor(container) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xeef1f5);

    this.camera = new THREE.PerspectiveCamera(
      55, container.clientWidth / container.clientHeight, 1, 100000
    );
    this._defaultCam = { pos: [140, 120, 180], target: [0, 30, 0] };
    this.resetCamera();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(...this._defaultCam.target);

    // Licht
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8090a0, 1.0));
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(120, 200, 80);
    this.scene.add(dir);

    // Boden-Raster (20 cm Zellen)
    const grid = new THREE.GridHelper(800, 40, 0xb8c0cc, 0xd6dce4);
    grid.position.y = 0;
    this.scene.add(grid);

    // Gruppen
    this.buildGroup = new THREE.Group();
    this.handleGroup = new THREE.Group();
    this.labelGroup = new THREE.Group();
    this.scene.add(this.buildGroup);
    this.scene.add(this.handleGroup);
    this.scene.add(this.labelGroup);

    // Pick-Listen
    this.pickNodes = [];
    this.pickTubes = [];
    this.pickPanels = [];
    this.pickClamps = [];
    this.handleMeshes = [];
    this.labelMeshes = [];

    // Wiederverwendbare Ressourcen
    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
    this._hover = null;

    this._connGeo = null;     // lazy (braucht Katalog-Geometrie)
    this._clampGeo = null;    // lazy (Klemmen-Ring)
    this._clampRingGeo = null; // lazy (ein Ring der "8")
    this._c45Geo = null;      // lazy (45-Grad-Adapter-Koerper, Box)
    this._c45StubGeo = null;  // lazy (Diagonal-Stutzen des Adapters)
    this._materials = {};

    window.addEventListener("resize", () => this.onResize());
    // Container-Größe verfolgen: Layout der Sidebar steht beim Konstruieren
    // evtl. noch nicht final -> sonst überlappen Canvas und Panel bis zum
    // ersten Resize. ResizeObserver gleicht das automatisch ab.
    if (typeof ResizeObserver !== "undefined") {
      this._resizeObserver = new ResizeObserver(() => this.onResize());
      this._resizeObserver.observe(container);
    }
    this._animate = this._animate.bind(this);
    this._animate();
  }

  resetCamera() {
    this.camera.position.set(...this._defaultCam.pos);
    this.camera.lookAt(...this._defaultCam.target);
    if (this.controls) {
      this.controls.target.set(...this._defaultCam.target);
      this.controls.update();
    }
  }

  onResize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // Auf die nächste Achse gerundete horizontale Blickrichtung (für Pfeiltasten).
  getHorizontalAxes() {
    const f = new THREE.Vector3();
    this.camera.getWorldDirection(f);
    f.y = 0;
    if (f.lengthSq() < 1e-6) f.set(0, 0, -1);
    f.normalize();
    const forward = Math.abs(f.x) >= Math.abs(f.z)
      ? [Math.sign(f.x) || 1, 0, 0]
      : [0, 0, Math.sign(f.z) || 1];
    const right = [-forward[2], 0, forward[0]];
    return { forward, right };
  }

  _connGeometry() {
    if (!this._connGeo) {
      const s = geometry().connectorSize;
      this._connGeo = new THREE.BoxGeometry(s, s, s);
    }
    return this._connGeo;
  }

  // Geometrie fuer eine Klemme/Doppelrohrverbinder: kurzer dicker Ring.
  _clampGeometry() {
    if (!this._clampGeo) {
      const r = geometry().tubeRadius;
      this._clampGeo = new THREE.TorusGeometry(r * 1.7, r * 0.7, 10, 18);
    }
    return this._clampGeo;
  }

  // Ein Ring der "8": Loch genau so gross, dass eine Tube hindurchpasst.
  // Zwei davon nebeneinander ergeben den Doppelrohrverbinder.
  _clampRingGeometry() {
    if (!this._clampRingGeo) {
      const r = geometry().tubeRadius;
      this._clampRingGeo = new THREE.TorusGeometry(r + 0.45, 0.5, 10, 22);
    }
    return this._clampRingGeo;
  }

  _clampMaterial() {
    if (!this._materials["clamp"]) {
      this._materials["clamp"] = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x33373d), roughness: 0.5, metalness: 0.4,
      });
    }
    return this._materials["clamp"];
  }

  // Geometrie fuer den 45-Grad-Adapter-Koerper: kleiner Wuerfel,
  // der in einen Arm der Basiskupplung gesteckt wird.
  _c45Geometry() {
    if (!this._c45Geo) {
      const s = geometry().connectorSize * 0.82;
      this._c45Geo = new THREE.BoxGeometry(s, s, s);
    }
    return this._c45Geo;
  }

  // Geometrie fuer den Diagonal-Stutzen des Adapters (Arm, der ins Rohr greift).
  // Echtes Mass: Arm ~42 mm Durchmesser (armRadius) -> duenner als das Rohr
  // (49 mm), damit er sichtbar IN die Tube einsteckt.
  _c45StubGeometry() {
    if (!this._c45StubGeo) {
      const ar = geometry().armRadius;
      const cs = geometry().connectorSize;
      this._c45StubGeo = new THREE.CylinderGeometry(ar, ar, cs * 0.75, 14);
    }
    return this._c45StubGeo;
  }

  _c45Material() {
    if (!this._materials["c45"]) {
      this._materials["c45"] = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xe8a33d), roughness: 0.5, metalness: 0.3,
        emissive: new THREE.Color(0x3a2400),
      });
    }
    return this._materials["c45"];
  }

  // Nicht-achsparallele Richtungen der Rohre an einem Knoten.
  // Achsparallel = eine Komponente >= 0.90, alle anderen klein.
  // Alles darunter (echte Diagonalen: 45°, oder leicht davon abweichend durch
  // Snap auf reale Kupplungspositionen) wird als Adapter-Richtung zurueckgegeben.
  _diagonalDirsAt(model, node) {
    const out = [];
    for (const t of model.tubes.values()) {
      let other = null;
      if (t.a === node.id) other = model.nodes.get(t.b);
      else if (t.b === node.id) other = model.nodes.get(t.a);
      if (!other) continue;
      const dx = other.x - node.x, dy = other.y - node.y, dz = other.z - node.z;
      const L = Math.hypot(dx, dy, dz) || 1;
      const d = [dx / L, dy / L, dz / L];
      // Achsparallele Rohre (groesste Komponente >= 0.90) brauchen keinen Adapter.
      const mx = Math.max(Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2]));
      if (mx < 0.90) out.push(d);
    }
    return out;
  }

  // Bestimmt die Achse, in die der c45-Adapter gesteckt wird:
  // die axiale Tube-Richtung an diesem Knoten mit dem groessten positiven
  // Skalarprodukt zur Diagonalrichtung.
  // Physikalisch: der Adapter sitzt auf dem Arm, der der Diagonale am
  // naechsten liegt (z.B. Arm nach oben fuer eine Diagonale oben-rechts).
  _c45ArmDirAt(model, node, diagDir) {
    let bestDot = -Infinity, bestAxis = null;
    for (const t of model.tubes.values()) {
      let other = null;
      if (t.a === node.id) other = model.nodes.get(t.b);
      else if (t.b === node.id) other = model.nodes.get(t.a);
      if (!other) continue;
      const dx = other.x - node.x, dy = other.y - node.y, dz = other.z - node.z;
      const L = Math.hypot(dx, dy, dz) || 1;
      const nx = dx / L, ny = dy / L, nz = dz / L;
      // Nur achsparallele Rohre: groesste Komponente >= 0.90
      if (Math.max(Math.abs(nx), Math.abs(ny), Math.abs(nz)) < 0.90) continue;
      const dot = nx * diagDir[0] + ny * diagDir[1] + nz * diagDir[2];
      if (dot > bestDot) {
        bestDot = dot;
        if (Math.abs(nx) >= 0.90) bestAxis = new THREE.Vector3(Math.sign(nx), 0, 0);
        else if (Math.abs(ny) >= 0.90) bestAxis = new THREE.Vector3(0, Math.sign(ny), 0);
        else bestAxis = new THREE.Vector3(0, 0, Math.sign(nz));
      }
    }
    // Fallback falls kein axiales Rohr vorhanden: dominante Komponente der Diagonale
    if (!bestAxis || bestDot <= 0) {
      const ax = Math.abs(diagDir[0]), ay = Math.abs(diagDir[1]), az = Math.abs(diagDir[2]);
      if (ax >= ay && ax >= az) bestAxis = new THREE.Vector3(Math.sign(diagDir[0]), 0, 0);
      else if (ay >= ax && ay >= az) bestAxis = new THREE.Vector3(0, Math.sign(diagDir[1]), 0);
      else bestAxis = new THREE.Vector3(0, 0, Math.sign(diagDir[2]));
    }
    return bestAxis;
  }

  // Geometrie des importierten C45-Adapters. n ist der Adapter-Koerper am
  // Diagonal-Fuss. Liefert die Huelse (von der Basiskupplung G KARDINAL weg),
  // die Koerperposition (Knick) und den 45°-Arm (in die Tube). Die kardinale
  // Huelsenachse kommt aus n.c45axis (QDF); sonst wird sie aus der Geometrie
  // hergeleitet (jene aktive Diagonal-Achse, die einen positiven Armarm ergibt).
  _c45AdapterGeo(model, n) {
    let G = null, foot = null;
    for (const t of model.tubes.values()) {
      const other = t.a === n.id ? model.nodes.get(t.b) : t.b === n.id ? model.nodes.get(t.a) : null;
      if (!other) continue;
      if (t.arm) G = other; else if (!foot) foot = other;
    }
    if (!G || !foot) return null;
    const d = new THREE.Vector3(foot.x - n.x, foot.y - n.y, foot.z - n.z).normalize();
    const v = new THREE.Vector3(n.x - G.x, n.y - G.y, n.z - G.z); // Basis -> Fuss
    // 45°-Arm-Laenge a so waehlen, dass (Fuss - d*a) - G kardinal liegt (Huelse).
    const active = [];
    for (let k = 0; k < 3; k++) if (Math.abs(d.getComponent(k)) > 0.3) active.push(k);
    let a = 0;
    const ci = n.c45axis ? (Math.abs(n.c45axis[0]) > 0.5 ? 0 : Math.abs(n.c45axis[1]) > 0.5 ? 1 : 2) : -1;
    if (ci >= 0) {
      const m = active.find((k) => k !== ci);
      if (m != null) a = v.getComponent(m) / d.getComponent(m);
    }
    if (!(a > 0.01)) {
      for (const m of active) { const aa = v.getComponent(m) / d.getComponent(m); if (aa > 0.01) { a = aa; break; } }
    }
    const bodyPos = new THREE.Vector3(n.x - d.x * a, n.y - d.y * a, n.z - d.z * a);
    const sleeveVec = new THREE.Vector3().subVectors(bodyPos, G);
    const sleeveLen = sleeveVec.length();
    if (sleeveLen < 0.5) return null;
    return {
      bodyPos,
      sleeveDir: sleeveVec.clone().normalize(),
      sleeveLen,
      sleeveMid: new THREE.Vector3().addVectors(G, bodyPos).multiplyScalar(0.5),
      armDir: d,
      armLen: a,
      armMid: new THREE.Vector3((bodyPos.x + n.x) / 2, (bodyPos.y + n.y) / 2, (bodyPos.z + n.z) / 2),
    };
  }

  // Drehachse eines Schräg-Konnektors: hat der Knoten ein Diagonalrohr, liegt es
  // in einer Achsenebene; die Kupplung ist um 45° um die dazu senkrechte Achse
  // gedreht. Liefert diese Achse (THREE.Vector3) oder null (keine Schräge).
  _slopeRotationAxis(model, n) {
    if (n.c45 || n.c45body) return null;
    for (const t of model.tubes.values()) {
      if (t.arm || t.link) continue;
      const o = t.a === n.id ? model.nodes.get(t.b) : t.b === n.id ? model.nodes.get(t.a) : null;
      if (!o) continue;
      const v = [o.x - n.x, o.y - n.y, o.z - n.z], L = Math.hypot(...v) || 1, u = v.map((c) => c / L);
      if (Math.max(...u.map(Math.abs)) >= 0.99) continue; // kardinal
      const act = [0, 1, 2].filter((a) => Math.abs(u[a]) > 0.3);
      if (act.length !== 2) continue;
      const k = [0, 1, 2].find((a) => !act.includes(a));
      return new THREE.Vector3(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0);
    }
    return null;
  }

  _tubeMaterial(colorId) {
    const key = "tube:" + colorId;
    if (!this._materials[key]) {
      this._materials[key] = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex(colorId)),
        roughness: 0.55,
        metalness: 0.05,
      });
    }
    return this._materials[key];
  }

  // Verstaerkungsprofil-Stab (Bauen-Modus): dunkles Alu-Metallic.
  _rodMaterial() {
    if (!this._materials["rod"]) {
      this._materials["rod"] = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x7a8794), roughness: 0.3, metalness: 0.85,
      });
    }
    return this._materials["rod"];
  }

  // Material fuer vorgeschlagene Verstaerkungsrohre (Hinweis-Modus): orange.
  _tubeSuggest() {
    if (!this._materials["tubeSuggest"]) {
      this._materials["tubeSuggest"] = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xff8c1a), roughness: 0.4, metalness: 0.1,
        emissive: new THREE.Color(0x5a3000),
      });
    }
    return this._materials["tubeSuggest"];
  }

  // Reinforce-Modus: neutrale graue Rohre.
  _tubeGray() {
    if (!this._materials["tubeGray"]) {
      this._materials["tubeGray"] = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xa0aab5), roughness: 0.7, metalness: 0.05,
      });
    }
    return this._materials["tubeGray"];
  }

  // Reinforce-Modus: Rohre, die bereits verstärkt sind (blau-metallic).
  _tubeReinforceActive() {
    if (!this._materials["tubeReinforceActive"]) {
      this._materials["tubeReinforceActive"] = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x1a8cff), roughness: 0.2, metalness: 0.8,
        emissive: new THREE.Color(0x00213a),
      });
    }
    return this._materials["tubeReinforceActive"];
  }

  _connMaterial(selected) {
    const key = selected ? "conn:sel" : "conn:base";
    if (!this._materials[key]) {
      this._materials[key] = new THREE.MeshStandardMaterial({
        color: new THREE.Color(selected ? 0xff8c1a : connectorColor().hex),
        roughness: 0.6, metalness: 0.1,
        emissive: new THREE.Color(selected ? 0x612f00 : 0x000000),
      });
    }
    return this._materials[key];
  }

  // Halbtransparentes "Geist"-Material fuer noch nicht gebaute Teile (Aufbaumodus).
  _ghostMaterial() {
    if (!this._materials["ghost"]) {
      this._materials["ghost"] = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x9aa6b4), roughness: 0.9, metalness: 0,
        transparent: true, opacity: 0.14, depthWrite: false,
      });
    }
    return this._materials["ghost"];
  }

  // Hervorhebung der im aktuellen Aufbau-Schritt hinzukommenden Rohre.
  _tubeHighlight(colorId) {
    const key = "tubehl:" + colorId;
    if (!this._materials[key]) {
      this._materials[key] = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex(colorId)), roughness: 0.4, metalness: 0.05,
        emissive: new THREE.Color(0x3a2400),
      });
    }
    return this._materials[key];
  }

  // Textmarke (Sprite mit Canvas-Textur) ueber einer Kupplung.
  _makeLabelSprite(text, current, category) {
    const dpr = 2;
    const pad = 10 * dpr, fs = 30 * dpr;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = `bold ${fs}px -apple-system, "Segoe UI", Arial, sans-serif`;
    const tw = ctx.measureText(text).width;
    canvas.width = Math.ceil(tw + pad * 2);
    canvas.height = Math.ceil(fs + pad * 1.4);
    ctx.font = `bold ${fs}px -apple-system, "Segoe UI", Arial, sans-serif`;
    ctx.textBaseline = "middle";
    const r = 12 * dpr;
    ctx.fillStyle = LABEL_BG[category] || (current ? "rgba(255,140,26,0.96)" : "rgba(31,38,48,0.92)");
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(canvas.width, 0, canvas.width, canvas.height, r);
    ctx.arcTo(canvas.width, canvas.height, 0, canvas.height, r);
    ctx.arcTo(0, canvas.height, 0, 0, r);
    ctx.arcTo(0, 0, canvas.width, 0, r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, pad, canvas.height / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    const worldH = 7; // cm Hoehe der Beschriftung
    sprite.scale.set(worldH * (canvas.width / canvas.height), worldH, 1);
    sprite.renderOrder = 1000;
    return sprite;
  }

  _disposeLabels() {
    for (let i = this.labelGroup.children.length - 1; i >= 0; i--) {
      const c = this.labelGroup.children[i];
      if (c.material) {
        if (c.material.map) c.material.map.dispose();
        c.material.dispose();
      }
      this.labelGroup.remove(c);
    }
    this.labelMeshes = [];
  }

  // Baut die Szene aus dem Modell neu auf.
  // opts.labelFor(node) -> string|null  : Beschriftung an der Kupplung.
  // opts.assembly { done:Set, current:Set } : Aufbaumodus (fertig/aktuell/kuenftig).
  renderModel(model, selectedNodeId, opts = {}) {
    this._disposeGroup(this.buildGroup);
    this._disposeLabels();
    this.pickNodes = [];
    this.pickTubes = [];
    this.pickPanels = [];
    this.pickClamps = [];

    const tubeRadius = geometry().tubeRadius;
    const armRadius = geometry().armRadius; // C45-Arm: ~42 mm, duenner als das Rohr
    const asm = opts.assembly || null;
    const labelFor = opts.labelFor || null;
    const suggest = opts.suggest || null;
    const reinforce = opts.reinforce || false;
    const cs = geometry().connectorSize;

    // Zustand eines Teils im Aufbaumodus: "done" | "current" | "future".
    const stateOf = (id) => {
      if (!asm) return "done";
      if (asm.current.has(id)) return "current";
      if (asm.done.has(id)) return "done";
      return "future";
    };

    // Kupplungen (Wuerfel)
    for (const n of model.nodes.values()) {
      const st = stateOf(n.id);
      let mat;
      if (st === "future") mat = this._ghostMaterial();
      else if (st === "current") mat = this._connMaterial(true);
      else mat = this._connMaterial(n.id === selectedNodeId);
      // Adapter-Koerper (importierte C45, n.c45body) sind keine eigenstaendige
      // Kupplung -> kein dunkler Wuerfel; sie werden unten in Adapter-Farbe
      // gezeichnet (Huelse + Koerper + 45°-Arm).
      if (!n.c45body) {
        const mesh = new THREE.Mesh(this._connGeometry(), mat);
        mesh.position.set(n.x, n.y, n.z);
        // Schräg-Konnektor: liegt auf einer Schräge -> Wuerfel um 45° um die
        // Drehachse der Schräge drehen (passt zur gedrehten 90°-Kupplung).
        const sa = this._slopeRotationAxis(model, n);
        if (sa) mesh.quaternion.setFromAxisAngle(sa, Math.PI / 4);
        mesh.userData = { kind: "node", id: n.id };
        this.buildGroup.add(mesh);
        if (st !== "future") this.pickNodes.push(mesh);
      }

      // 45-Grad-Winkelkupplung (C45). Echtes Teil: eine Huelse wird auf einen
      // KARDINALEN Arm der Basiskupplung gesteckt, davon zweigt ein 45°-Arm ab,
      // der in die Tube greift.
      if (n.c45 && st !== "future") {
        if (n.c45body) {
          // Import: n ist der Adapter-Koerper am Diagonal-Fuss; die Basis sitzt
          // am anderen Ende der Arm-Kante. Huelse laeuft kardinal von der Basis.
          const ad = this._c45AdapterGeo(model, n);
          if (ad) {
            const sleeve = new THREE.Mesh(
              new THREE.CylinderGeometry(tubeRadius * 1.05, tubeRadius * 1.05, ad.sleeveLen, 14),
              this._c45Material());
            sleeve.position.copy(ad.sleeveMid);
            sleeve.quaternion.setFromUnitVectors(UP, ad.sleeveDir);
            sleeve.userData = { kind: "node", id: n.id };
            this.buildGroup.add(sleeve);
            if (st !== "future") this.pickNodes.push(sleeve);

            const body = new THREE.Mesh(this._c45Geometry(), this._c45Material());
            body.position.copy(ad.bodyPos);
            body.userData = { kind: "node", id: n.id };
            this.buildGroup.add(body);

            if (ad.armLen > 0.5) {
              const arm = new THREE.Mesh(
                new THREE.CylinderGeometry(armRadius, armRadius, ad.armLen, 14),
                this._c45Material());
              arm.position.copy(ad.armMid);
              arm.quaternion.setFromUnitVectors(UP, ad.armDir);
              arm.userData = { kind: "node", id: n.id };
              this.buildGroup.add(arm);
            }
          }
        } else {
          // Manuell gebaut: Knoten ist die Basiskupplung, Adapter sitzt auf dem
          // zur Diagonale naechsten Achsarm (kleiner Versatz von cs).
          for (const d of this._diagonalDirsAt(model, n)) {
            const dv = new THREE.Vector3(d[0], d[1], d[2]).normalize();
            const cv = this._c45ArmDirAt(model, n, d);
            const bx = n.x + cv.x * cs, by = n.y + cv.y * cs, bz = n.z + cv.z * cs;
            const body = new THREE.Mesh(this._c45Geometry(), this._c45Material());
            body.position.set(bx, by, bz);
            body.userData = { kind: "node", id: n.id };
            this.buildGroup.add(body);
            const stub = new THREE.Mesh(this._c45StubGeometry(), this._c45Material());
            const stubOff = cs * 0.75;
            stub.position.set(bx + dv.x * stubOff, by + dv.y * stubOff, bz + dv.z * stubOff);
            stub.quaternion.setFromUnitVectors(UP, dv);
            stub.userData = { kind: "node", id: n.id };
            this.buildGroup.add(stub);
          }
        }
      }

      // Beschriftung: im Aufbaumodus nur die aktuelle Ebene, sonst alle sichtbaren.
      const showLabel = labelFor && (asm ? st === "current" : st !== "future");
      if (showLabel) {
        const info = labelFor(n);
        const text = typeof info === "string" ? info : info && info.text;
        if (text) {
          const category = info && typeof info === "object" ? info.category : null;
          const sprite = this._makeLabelSprite(text, st === "current", category);
          sprite.position.set(n.x, n.y + cs / 2 + 6, n.z);
          this.labelGroup.add(sprite);
          this.labelMeshes.push(sprite);
        }
      }
    }

    // Rohre (Zylinder zwischen zwei Knoten)
    for (const t of model.tubes.values()) {
      const a = model.nodes.get(t.a), b = model.nodes.get(t.b);
      if (!a || !b) continue;
      const st = stateOf(t.id);
      // Reine Konnektivitaets-Kanten (Daten): C45-Adapter-Arm wird als Huelse am
      // c45body-Knoten gezeichnet, die Doppelrohr-Verbindung als "8"-Klemme --
      // beide nicht hier als Rohr.
      if (t.arm || t.link) continue;
      const va = new THREE.Vector3(a.x, a.y, a.z);
      const vb = new THREE.Vector3(b.x, b.y, b.z);
      const mid = va.clone().add(vb).multiplyScalar(0.5);
      const len = va.distanceTo(vb);
      const geo = new THREE.CylinderGeometry(tubeRadius, tubeRadius, len, 16);
      const isReinforceActive = reinforce && t.reinforced;
      const effectiveRadius = isReinforceActive ? tubeRadius * 1.08 : tubeRadius;
      const geo2 = isReinforceActive
        ? new THREE.CylinderGeometry(effectiveRadius, effectiveRadius, len, 16)
        : geo;
      const mat = st === "future" ? this._ghostMaterial()
        : st === "current" ? this._tubeHighlight(t.color)
        : isReinforceActive ? this._tubeReinforceActive()
        : (suggest && suggest.has(t.id)) ? this._tubeSuggest()
        : reinforce ? this._tubeGray()
        : this._tubeMaterial(t.color);
      const mesh = new THREE.Mesh(isReinforceActive ? geo2 : geo, mat);
      mesh.position.copy(mid);
      const dir = vb.clone().sub(va).normalize();
      mesh.quaternion.setFromUnitVectors(UP, dir);
      mesh.userData = { kind: "tube", id: t.id };
      this.buildGroup.add(mesh);
      if (st !== "future") this.pickTubes.push(mesh);

      // Verstaerkungsprofil: dünner Alu-Innenstab im Bauen-Modus sichtbar.
      // Das Profil (ca. 2,5 cm) liegt im hohlen Rohr (5 cm Außen-Ø) und ragt
      // durch die Kupplungen hindurch – deshalb volle Rohrlänge.
      if (t.reinforced && !reinforce && st !== "future") {
        // Verstaerkungsprofil: ~30 mm Durchmesser (gemessen), passt in das hohle
        // Rohr (49 mm aussen, 3 mm Wandstaerke -> 43 mm Innen-Durchmesser).
        const rodRadius = 1.5;  // 15 mm Radius = 30 mm Durchmesser in cm
        const rodGeo = new THREE.CylinderGeometry(rodRadius, rodRadius, len, 8);
        const rodMesh = new THREE.Mesh(rodGeo, this._rodMaterial());
        rodMesh.position.copy(mid);
        rodMesh.quaternion.copy(mesh.quaternion);
        this.buildGroup.add(rodMesh);
      }

      // Laengen-Beschriftung: gleiche Sichtbarkeitsregel wie die Kupplungs-Namen.
      const showTubeLabel = labelFor && (asm ? st === "current" : st !== "future");
      if (showTubeLabel) {
        const cm = t.length != null ? t.length : Math.round(len - cs);
        const category = t.tubeId === "T75" ? "tube75" : null;
        const sprite = this._makeLabelSprite(`${cm} cm`, st === "current", category);
        sprite.position.set(mid.x, mid.y + tubeRadius + 4, mid.z);
        this.labelGroup.add(sprite);
        this.labelMeshes.push(sprite);
      }
    }

    // Platten (flache Box in der Feld-Ebene) – im Reinforce-Modus ausgeblendet.
    const thickness = geometry().panelThickness || 1.6;
    for (const p of model.panels.values()) {
      if (reinforce) continue;
      const ns = p.nodes.map((id) => model.nodes.get(id));
      if (ns.some((n) => !n)) continue;
      const st = stateOf(p.id);
      const [A, B, , D] = ns;
      const va = new THREE.Vector3(A.x, A.y, A.z);
      const u = new THREE.Vector3(B.x, B.y, B.z).sub(va);
      const w = new THREE.Vector3(D.x, D.y, D.z).sub(va);
      const center = ns
        .reduce((acc, n) => acc.add(new THREE.Vector3(n.x, n.y, n.z)), new THREE.Vector3())
        .multiplyScalar(0.25);
      const xAxis = u.clone().normalize();
      const zAxis = w.clone().normalize();
      const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
      const geo = new THREE.BoxGeometry(u.length(), thickness, w.length());
      const mat = st === "future" ? this._ghostMaterial() : new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex(p.color)), roughness: 0.7, metalness: 0.05,
        side: THREE.DoubleSide,
        emissive: new THREE.Color(st === "current" ? 0x3a2400 : 0x000000),
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
      mesh.position.copy(center);
      mesh.userData = { kind: "panel", id: p.id };
      this.buildGroup.add(mesh);
      if (st !== "future") this.pickPanels.push(mesh);
    }

    // Doppelrohrverbinder: "8" = zwei Ringe nebeneinander, durch jeden laeuft
    // eine Tube. Ringachse = Tube-Richtung (c.dir), die beiden Ringe sind um den
    // Versatz c.off (~5 cm) versetzt. Ohne Paar (manuell) -> ein Ring.
    const ringGeo = this._clampRingGeometry();
    for (const c of (model.clamps ? model.clamps.values() : [])) {
      const st = stateOf(c.id);
      const mat = st === "future" ? this._ghostMaterial() : this._clampMaterial();
      const dir = c.dir ? new THREE.Vector3(c.dir[0], c.dir[1], c.dir[2]).normalize() : new THREE.Vector3(1, 0, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      const h = c.off ? [c.off[0] / 2, c.off[1] / 2, c.off[2] / 2] : null;
      const centers = h
        ? [[c.x - h[0], c.y - h[1], c.z - h[2]], [c.x + h[0], c.y + h[1], c.z + h[2]]]
        : [[c.x, c.y, c.z]];
      for (const [px, py, pz] of centers) {
        const mesh = new THREE.Mesh(ringGeo, mat);
        mesh.position.set(px, py, pz);
        mesh.quaternion.copy(q);
        mesh.userData = { kind: "clamp", id: c.id };
        this.buildGroup.add(mesh);
        if (st !== "future") this.pickClamps.push(mesh);
      }
    }
  }

  // --- Handles (Bau-Anfasser) --------------------------------------------
  clearHandles() {
    this._disposeGroup(this.handleGroup);
    this.handleMeshes = [];
  }

  addHandle(position, userData, kind = "dir") {
    const isOrigin = kind === "origin";
    const isDiag = kind === "diag";
    const geo = isOrigin
      ? new THREE.BoxGeometry(geometry().connectorSize, geometry().connectorSize, geometry().connectorSize)
      : new THREE.SphereGeometry(2.4, 16, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: isOrigin ? 0x1a8cff : isDiag ? 0x8b3df5 : 0x18a558,
      transparent: true, opacity: isOrigin ? 0.45 : 0.85,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.userData = Object.assign({ kind: "handle" }, userData);
    mesh.renderOrder = 999;
    this.handleGroup.add(mesh);
    this.handleMeshes.push(mesh);
    return mesh;
  }

  // Anklickbares Kandidaten-Feld fuer eine Platte (Quad aus 4 Eckpunkten).
  addPanelHandle(corners, userData) {
    const cx = (corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4;
    const cy = (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4;
    const cz = (corners[0][2] + corners[1][2] + corners[2][2] + corners[3][2]) / 4;
    const local = corners.map((c) => [c[0] - cx, c[1] - cy, c[2] - cz]);
    const tri = [0, 1, 2, 0, 2, 3];
    const pos = new Float32Array(18);
    for (let k = 0; k < 6; k++) {
      const p = local[tri[k]];
      pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = p[2];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({
      color: 0x1a8cff, transparent: true, opacity: 0.35,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, cy, cz);
    mesh.userData = Object.assign({ kind: "handle", panelCell: true }, userData);
    mesh.renderOrder = 998;
    this.handleGroup.add(mesh);
    this.handleMeshes.push(mesh);
    return mesh;
  }

  // --- Raycasting ---------------------------------------------------------
  _setMouse(clientX, clientY) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this._mouse.x = ((clientX - r.left) / r.width) * 2 - 1;
    this._mouse.y = -((clientY - r.top) / r.height) * 2 + 1;
    this._raycaster.setFromCamera(this._mouse, this.camera);
  }

  raycastObjects(clientX, clientY, objects) {
    this._setMouse(clientX, clientY);
    const hits = this._raycaster.intersectObjects(objects, false);
    return hits.length ? hits[0] : null;
  }

  pickHandle(clientX, clientY) {
    const hit = this.raycastObjects(clientX, clientY, this.handleMeshes);
    return hit ? { object: hit.object, data: hit.object.userData } : null;
  }

  pickBuild(clientX, clientY) {
    const hit = this.raycastObjects(
      clientX, clientY, [...this.pickNodes, ...this.pickTubes, ...this.pickPanels, ...this.pickClamps]
    );
    return hit ? { object: hit.object, data: hit.object.userData, point: hit.point } : null;
  }

  setHover(object) {
    if (this._hover === object) return;
    if (this._hover && this._hover.userData.kind === "handle") {
      if (this._hover.userData.panelCell) this._hover.material.opacity = 0.35;
      else this._hover.scale.setScalar(1);
    }
    this._hover = object;
    if (object && object.userData.kind === "handle") {
      if (object.userData.panelCell) object.material.opacity = 0.65;
      else object.scale.setScalar(1.6);
    }
    this.container.style.cursor = object ? "pointer" : "default";
  }

  _disposeGroup(group) {
    for (let i = group.children.length - 1; i >= 0; i--) {
      const c = group.children[i];
      if (c.geometry && c.geometry !== this._connGeo && c.geometry !== this._clampGeo && c.geometry !== this._clampRingGeo && c.geometry !== this._c45Geo && c.geometry !== this._c45StubGeo) c.geometry.dispose();
      group.remove(c);
    }
  }

  _animate() {
    requestAnimationFrame(this._animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
