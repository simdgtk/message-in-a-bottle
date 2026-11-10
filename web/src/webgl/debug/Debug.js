import { Pane } from "tweakpane";
import * as THREE from "three/webgpu";
import { EASINGS } from "@/utils/easings.js";

const STORAGE_KEY = "webgl_debug_preset";

export class Debug {
  constructor({ scene }) {
    this.scene = scene;
    this.pane = new Pane({ title: "Debug" });
    this.defaultPreset = null;

    this.createDebug();
    this.setupPresetManagement();
  }

  createDebug() {
    this.createRendererDebug();
    this.createFogDebug();
    this.createOceanDebug();
    this.createLetterDebug();
  }

  setupPresetManagement() {
    this.defaultPreset = this.pane.exportState();

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        this.pane.importState(JSON.parse(saved));
        this.refreshBindings();
      } catch (err) {
        console.warn(
          "Impossible de charger les réglages de debug depuis le localStorage:",
          err,
        );
      }
    }

    this.pane.on("change", () => {
      try {
        const state = this.pane.exportState();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (err) {
        console.warn("Erreur lors de la sauvegarde dans le localStorage:", err);
      }
    });

    const folderActions = this.pane.addFolder({
      title: "Presets & Storage",
      expanded: false,
    });

    folderActions.addButton({ title: "Reset to default" }).on("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      if (this.defaultPreset) {
        this.pane.importState(this.defaultPreset);
        this.refreshBindings();
      }
    });

    folderActions
      .addButton({ title: "Export preset (Copy JSON)" })
      .on("click", async () => {
        const state = this.pane.exportState();
        const json = JSON.stringify(state, null, 2);
        try {
          await navigator.clipboard.writeText(json);
          console.log("Preset exporté dans le presse-papier :", json);
          alert("Configuration copiée dans le presse-papier !");
        } catch {
          console.log("Preset exporté :", json);
          prompt("Copiez la configuration ci-dessous :", json);
        }
      });

    folderActions
      .addButton({ title: "Import preset (Paste JSON)" })
      .on("click", () => {
        const input = prompt("Collez le preset JSON ici :");
        if (!input) return;

        try {
          const parsed = JSON.parse(input);
          this.pane.importState(parsed);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          this.refreshBindings();
        } catch (err) {
          alert("Format JSON invalide.");
          console.error("Erreur parsing JSON preset:", err);
        }
      });
  }

  refreshBindings() {
    this.scene.renderer && (this.scene.renderer.needsUpdate = true);
    this.scene.letterWriting?.render();
  }

  createRendererDebug() {
    const renderer = this.scene.renderer;
    if (!renderer) return;

    const folderRenderer = this.pane.addFolder({
      title: "Renderer",
      expanded: false,
    });

    folderRenderer
      .addBinding(renderer, "toneMapping", {
        label: "Tone Mapping",
        options: {
          None: THREE.NoToneMapping,
          Linear: THREE.LinearToneMapping,
          Reinhard: THREE.ReinhardToneMapping,
          Cineon: THREE.CineonToneMapping,
          ACESFilmic: THREE.ACESFilmicToneMapping,
          AgX: THREE.AgXToneMapping,
          Neutral: THREE.NeutralToneMapping,
        },
      })
      .on("change", () => {
        renderer.needsUpdate = true;
      });

    folderRenderer.addBinding(renderer, "toneMappingExposure", {
      label: "Tone Mapping Exposure",
      min: 0,
      max: 5,
      step: 0.05,
    });
  }

  createFogDebug() {
    const { uFogColor, uFogNear, uFogFar } = this.scene;
    if (!uFogColor) return;

    const folderFog = this.pane.addFolder({ title: "Fog", expanded: false });
    folderFog.addBinding(uFogColor, "value", {
      label: "Couleur (+ fond)",
      color: { type: "float" },
    });
    folderFog.addBinding(uFogNear, "value", {
      label: "Début",
      min: 0,
      max: 500,
      step: 1,
    });
    folderFog.addBinding(uFogFar, "value", {
      label: "Fin",
      min: 0,
      max: 1000,
      step: 1,
    });
  }

  createOceanDebug() {
    const ocean = this.scene.ocean;
    if (!ocean?.material) return;

    const mat = ocean.material;
    const folderOcean = this.pane.addFolder({
      title: "Océan Material",
      expanded: true,
    });
    const colorOpt = { color: { type: "float" } };

    const folderCaustics = folderOcean.addFolder({
      title: "Caustiques & Profondeur",
    });
    if (mat.uDepth)
      folderCaustics.addBinding(mat.uDepth, "value", {
        label: "Depth",
        min: 0,
        max: 0.3,
        step: 0.005,
      });
    if (mat.uCausticsScale)
      folderCaustics.addBinding(mat.uCausticsScale, "value", {
        label: "Échelle",
        min: 1,
        max: 80,
        step: 1,
      });
    if (mat.uCausticsSpeed)
      folderCaustics.addBinding(mat.uCausticsSpeed, "value", {
        label: "Vitesse",
        min: 0,
        max: 1,
        step: 0.01,
      });
    if (mat.uDeepColor)
      folderCaustics.addBinding(mat.uDeepColor, "value", {
        label: "Couleur Profonde",
        ...colorOpt,
      });
    if (mat.uCausticsColor)
      folderCaustics.addBinding(mat.uCausticsColor, "value", {
        label: "Couleur Caustiques",
        ...colorOpt,
      });

    const folderFoam = folderOcean.addFolder({ title: "Écume (Foam)" });
    if (mat.uFoamScale)
      folderFoam.addBinding(mat.uFoamScale, "value", {
        label: "Échelle",
        min: 1,
        max: 50,
        step: 1,
      });
    if (mat.uFoamSpeed)
      folderFoam.addBinding(mat.uFoamSpeed, "value", {
        label: "Vitesse",
        min: 0,
        max: 0.5,
        step: 0.005,
      });
    if (mat.uFoamWidth)
      folderFoam.addBinding(mat.uFoamWidth, "value", {
        label: "Largeur",
        min: 0.01,
        max: 0.5,
        step: 0.005,
      });
    if (mat.uFoamOpacity)
      folderFoam.addBinding(mat.uFoamOpacity, "value", {
        label: "Opacité",
        min: 0,
        max: 1,
        step: 0.01,
      });
    if (mat.uFoamColor)
      folderFoam.addBinding(mat.uFoamColor, "value", {
        label: "Couleur",
        ...colorOpt,
      });
  }

  createLetterDebug() {
    const letter = this.scene.letterWriting;
    if (!letter) return;

    const fLetter = this.pane.addFolder({
      title: "Feuille & Dessin",
      expanded: false,
    });

    if (letter.drawingOptions) {
      const folderDraw = fLetter.addFolder({ title: "Tracé (Pinceau)" });
      folderDraw.addBinding(letter.drawingOptions, "size", {
        min: 1,
        max: 50,
        step: 1,
        label: "Taille",
      });
      folderDraw.addBinding(letter.drawingOptions, "thinning", {
        min: -1,
        max: 1,
        step: 0.05,
        label: "Amincissement",
      });
      folderDraw.addBinding(letter.drawingOptions, "streamline", {
        min: 0,
        max: 1,
        step: 0.05,
        label: "Streamline",
      });
      folderDraw.addBinding(letter.drawingOptions, "smoothing", {
        min: 0,
        max: 1,
        step: 0.05,
        label: "Douceur",
      });
      folderDraw.addBinding(letter.drawingOptions, "simulatePressure", {
        label: "Simuler Pression",
      });

      // Tweakpane can't bind functions: bind the easing name, map it back.
      const easingName =
        Object.keys(EASINGS).find(
          (name) => EASINGS[name] === letter.drawingOptions.easing,
        ) ?? "linear";
      folderDraw
        .addBinding({ easing: easingName }, "easing", {
          label: "Easing",
          options: Object.fromEntries(
            Object.keys(EASINGS).map((name) => [name, name]),
          ),
        })
        .on("change", ({ value }) => {
          letter.drawingOptions.easing = EASINGS[value];
        });
    }

    if (letter.erasingOptions) {
      const fErase = fLetter.addFolder({ title: "Gomme", expanded: false });
      fErase.addBinding(letter.erasingOptions, "size", {
        min: 5,
        max: 100,
        step: 1,
        label: "Taille",
      });
    }

    const folderText = fLetter.addFolder({ title: "Texte & Papier" });
    folderText
      .addBinding(letter, "fontSize", {
        min: 12,
        max: 72,
        step: 1,
        label: "Taille police",
      })
      .on("change", ({ value }) => {
        letter.lineHeight = Math.round(value * 1.2);
        letter.render();
      });
    folderText
      .addBinding(letter, "padding", {
        min: 0,
        max: 200,
        step: 5,
        label: "Marge",
      })
      .on("change", () => {
        letter.render();
      });
    folderText
      .addBinding(letter, "fontColor", { label: "Couleur texte" })
      .on("change", () => {
        letter.render();
      });
  }

  destroy() {
    this.pane?.dispose();
    this.pane = null;
  }
}
