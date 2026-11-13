import { Pane } from "tweakpane";
import * as THREE from "three/webgpu";
import { EASINGS } from "@/utils/easings.js";
import { shadowColor } from "@/webgl/materials/BaseShadow.js";

const STORAGE_KEY = "webgl_debug_preset";

export class Debug {
  constructor({ scene }) {
    this.scene = scene;
    this.pane = new Pane({ title: "Debug" });
    // Keep the pane above every overlay (letter zone, fades, toolbar…)
    this.pane.element.parentElement.style.zIndex = "10000";
    this.defaultPreset = null;

    this.createDebug();
    this.setupPresetManagement();
  }

  createDebug() {
    this.createRendererDebug();
    this.createLightsDebug();
    this.createFogDebug();
    this.createOceanDebug();
    this.createLetterDebug();
    this.createCameraDebug();
    this.createIslandDebug();
    this.createBottleDebug();
    this.createLetterViewDebug();
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
    this.scene.refreshView?.();
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

  createLightsDebug() {
    const { sun, hemiLight } = this.scene;
    if (!sun && !hemiLight) return;

    const folder = this.pane.addFolder({
      title: "Lumières & Ombres",
      expanded: false,
    });
    const colorOpt = { color: { type: "float" } };
    const point = { x: { step: 1 }, y: { step: 1 }, z: { step: 1 } };

    if (sun) {
      const folderSun = folder.addFolder({ title: "Soleil" });
      folderSun.addBinding(sun, "position", { label: "Position", ...point });
      folderSun.addBinding(sun, "intensity", {
        label: "Intensité",
        min: 0,
        max: 10,
        step: 0.1,
      });
      folderSun.addBinding(sun, "color", { label: "Couleur", ...colorOpt });

      if (sun.shadow) {
        const folderShadow = folder.addFolder({ title: "Ombres" });
        folderShadow.addBinding(shadowColor, "value", {
          label: "Teinte ombre",
          ...colorOpt,
        });
        folderShadow.addBinding(sun.shadow, "bias", {
          label: "Bias",
          min: -0.01,
          max: 0.01,
          step: 0.0001,
        });
        folderShadow.addBinding(sun.shadow, "normalBias", {
          label: "Normal Bias",
          min: -0.1,
          max: 0.2,
          step: 0.005,
        });
        folderShadow.addBinding(sun.shadow, "radius", {
          label: "Rayon (flou)",
          min: 0,
          max: 20,
          step: 0.5,
        });
      }
    }

    if (hemiLight) {
      const folderHemisphere = folder.addFolder({ title: "Hémisphère" });
      folderHemisphere.addBinding(hemiLight, "intensity", {
        label: "Intensité",
        min: 0,
        max: 5,
        step: 0.05,
      });
      folderHemisphere.addBinding(hemiLight, "color", {
        label: "Couleur ciel",
        ...colorOpt,
      });
      folderHemisphere.addBinding(hemiLight, "groundColor", {
        label: "Couleur sol",
        ...colorOpt,
      });
    }
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

    const s = this.scene;
    if (!s.uSkyZenith) return;
    const colorOpt = { color: { type: "float" } };
    const folderSky = this.pane.addFolder({ title: "Ciel", expanded: false });
    folderSky.addBinding(s.uSkyMid, "value", { label: "Milieu", ...colorOpt });
    folderSky.addBinding(s.uSkyZenith, "value", {
      label: "Zénith",
      ...colorOpt,
    });
    folderSky.addBinding(s.uSkyMidHeight, "value", {
      label: "Hauteur milieu",
      min: 0.02,
      max: 0.9,
      step: 0.01,
    });
    folderSky.addBinding(s.uSunColor, "value", {
      label: "Halo soleil",
      ...colorOpt,
    });
    folderSky.addBinding(s.uSunHalo, "value", {
      label: "Intensité halo",
      min: 0,
      max: 1,
      step: 0.01,
    });
    folderSky.addBinding(s.uSunSize, "value", {
      label: "Taille halo (inv.)",
      min: 1,
      max: 64,
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

    const folderFoam = folderOcean.addFolder({ title: "Écume" });
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

  createCameraDebug() {
    const params = this.scene.params;
    if (!params) return;

    const folder = this.pane.addFolder({ title: "Caméra", expanded: false });
    const onChange = () => this.scene.refreshView();
    const point = { x: { step: 0.5 }, y: { step: 0.5 }, z: { step: 0.5 } };
    const angle = { x: { step: 0.5 }, y: { step: 0.5 }, z: { step: 0.5 } };

    folder
      .addBinding(params, "cameraPosition", { label: "Île position", ...point })
      .on("change", onChange);
    folder
      .addBinding(params, "cameraTarget", { label: "Île cible", ...point })
      .on("change", onChange);
    folder
      .addBinding(params, "loginCameraPosition", { label: "Login position", ...point })
      .on("change", onChange);
    folder
      .addBinding(params, "loginCameraTarget", { label: "Login cible", ...point })
      .on("change", onChange);
    folder
      .addBinding(params, "barrelCameraPosition", {
        label: "Lettre position",
        ...point,
      })
      .on("change", onChange);
    folder
      .addBinding(params, "barrelCameraRotation", {
        label: "Lettre rotation (°)",
        ...angle,
      })
      .on("change", onChange);
    folder.addBinding(params, "parallaxStrength", {
      label: "Parallaxe force",
      min: 0,
      max: 10,
      step: 0.1,
    });
    folder.addBinding(params, "parallaxSmoothing", {
      label: "Parallaxe douceur",
      min: 0.01,
      max: 0.2,
      step: 0.005,
    });
  }

  createIslandDebug() {
    const params = this.scene.params;
    if (!params) return;

    const folder = this.pane.addFolder({ title: "Île", expanded: false });
    const onChange = () => this.scene.refreshView();
    const point = { x: { step: 0.5 }, y: { step: 0.5 }, z: { step: 0.5 } };
    const angle = {
      x: { min: -180, max: 180, step: 1 },
      y: { min: -180, max: 180, step: 1 },
      z: { min: -180, max: 180, step: 1 },
    };

    folder
      .addBinding(params, "islandPosition", { label: "Position", ...point })
      .on("change", onChange);
    folder
      .addBinding(params, "islandScale", {
        label: "Échelle",
        min: 0.1,
        max: 5,
        step: 0.05,
      })
      .on("change", onChange);
    folder
      .addBinding(params, "islandRotation", { label: "Rotation (°)", ...angle })
      .on("change", onChange);
    folder
      .addBinding(params, "loginIslandPosition", {
        label: "Login position",
        ...point,
      })
      .on("change", onChange);
    folder
      .addBinding(params, "loginIslandScale", {
        label: "Login échelle",
        min: 0.1,
        max: 5,
        step: 0.05,
      })
      .on("change", onChange);
    folder
      .addBinding(params, "loginIslandRotation", {
        label: "Login rotation (°)",
        ...angle,
      })
      .on("change", onChange);
  }

  createBottleDebug() {
    const params = this.scene.params;
    if (!params) return;

    const folder = this.pane.addFolder({ title: "Bouteille", expanded: false });
    const onChange = () => this.scene.refreshView();
    const point = { x: { step: 0.5 }, y: { step: 0.2 }, z: { step: 0.5 } };

    folder
      .addBinding(params, "bottlePosition", { label: "Position", ...point })
      .on("change", onChange);
    folder
      .addBinding(params, "bottleScale", {
        label: "Échelle",
        min: 0.05,
        max: 3,
        step: 0.05,
      })
      .on("change", onChange);
    folder.addBinding(params, "bottleFloatingAmplitude", {
      label: "Flottaison amp.",
      min: 0,
      max: 5,
      step: 0.05,
    });
    folder.addBinding(params, "bottleFloatingSpeed", {
      label: "Flottaison vit.",
      min: 0,
      max: 5,
      step: 0.05,
    });
  }

  createLetterViewDebug() {
    const params = this.scene.params;
    if (!params) return;

    const folder = this.pane.addFolder({ title: "Vue lettre", expanded: false });
    const onChange = () => this.scene.refreshView();
    const point = { x: { step: 0.1 }, y: { step: 0.1 }, z: { step: 0.1 } };

    folder
      .addBinding(params, "letterPosition", { label: "Lettre position", ...point })
      .on("change", onChange);
    folder
      .addBinding(params, "letterScale", {
        label: "Lettre échelle",
        min: 0.01,
        max: 2,
        step: 0.005,
      })
      .on("change", onChange);
    folder
      .addBinding(params, "overlayPosition", {
        label: "Overlay · position",
        ...point,
      })
      .on("change", onChange);
    folder
      .addBinding(params, "overlayOpacity", {
        label: "Overlay · opacité",
        min: 0,
        max: 1,
        step: 0.01,
      })
      .on("change", onChange);
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
      const folderErase = fLetter.addFolder({ title: "Gomme", expanded: false });
      folderErase.addBinding(letter.erasingOptions, "size", {
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
