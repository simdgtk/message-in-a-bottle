import * as THREE from "three/webgpu";
import {
  color,
  fog,
  rangeFogFactor,
  uniform,
  mix,
  normalWorld,
  time,
  sin,
  positionLocal,
  positionWorldDirection,
} from "three/tsl";
import gsap from "gsap";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { WebGLApp } from "@/webgl/core/WebGLApp.js";
import { AssetLoader } from "@/webgl/core/AssetLoader.js";
import { OceanFloor } from "@/webgl/objects/OceanFloor.js";
import { Model } from "@/webgl/objects/Model.js";
import { applyBaseShadow } from "@/webgl/materials/BaseShadow.js";
import { Letter } from "@/utils/Letter.js";
import { Debug } from "@/webgl/debug/Debug.js";
import { createOutlinePipeline } from "@/webgl/postprocessing/OutlinePass.js";
import { SkyMaterial } from "../materials/Sky";

const HORIZON = 0xa3cbe4;
const ZENITH = 0x2377ca;
const DEFAULT_CAMERA_POS = new THREE.Vector3(96, 45, 30);
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 15, 0);
const ISLAND_SCALE = 120;
const LETTER_CAMERA_POS = new THREE.Vector3(-1.5, 21, -46.5);
const LETTER_CAMERA_ROTATION = new THREE.Vector3(0, 180, 0);
const LETTER_POS = new THREE.Vector3(-1.5, 20.9, -38.5);
const LETTER_SCALE = 0.084;
const DARK_BACKGROUND_POS = new THREE.Vector3(-1.5, 20.9, -37.5);
const DARK_BACKGROUND_OPACITY = 0.8;
// Bouteille qui flotte à droite de l'île, côté caméra
const BOTTLE_POS = new THREE.Vector3(42, 0, -21);
const BOTTLE_SCALE = 4; // largeur en unités monde (Model met à l'échelle sur x/z), ~12 de haut
const BOTTLE_BOB = { amplitude: 0.6, speed: 1.2 }; // flottement vertical en sin()

export class SceneApp extends WebGLApp {
  constructor(options) {
    super(options);

    this.assetLoader = new AssetLoader();
    this.ocean = null;
    this.letter = null;
    this.island = null;
    this.bottle = null;
    this.hemiLight = null;
    this.sun = null;
    this.pipeline = null;
    this.pane = null;
    this.width = 0;
    this.height = 0;

    this.letterWriting = new Letter();
    this.letterMesh = null;
    this.isWriting = false;
    this.onBarrelClick = null;
    this.onBottleClick = null;
    this.darkBackgroundPlane = null;

    // Tweakable from the debug pane
    this.params = {
      cameraPosition: DEFAULT_CAMERA_POS.clone(),
      cameraTarget: DEFAULT_CAMERA_TARGET.clone(),
      barrelCameraPosition: LETTER_CAMERA_POS.clone(),
      barrelCameraRotation: LETTER_CAMERA_ROTATION.clone(),
      letterPosition: LETTER_POS.clone(),
      letterScale: LETTER_SCALE,
      overlayPosition: DARK_BACKGROUND_POS.clone(),
      overlayOpacity: DARK_BACKGROUND_OPACITY,
      outlineStrength: 3,
    };

    this.labelRenderer = null;
    this.hoverables = [];
    this.hovered = null;
    this.pointerClient = null;

    this.letterWriting.pointerMapper = (x, y) => this.getLetterUV(x, y);
  }

  async load() {
    this.letter = new Model({
      modelUrl: "/models/letter.glb",
      scale: 60,
      customTexture: this.letterWriting.texture,
      alignBottom: false,
    });
    this.island = new Model({
      modelUrl: "/models/island_full.glb",
      scale: ISLAND_SCALE,
      alignBottom: false,
      hover: { label: "Écrire une lettre", lift: 0 },
    });
    this.bottle = new Model({
      modelUrl: "/models/bottle.glb",
      scale: BOTTLE_SCALE,
      hover: { label: "Ouvrir la bouteille" },
    });
    const [letterGroup, islandGroup, bottleGroup] = await Promise.all([
      this.letter.load(this.assetLoader),
      this.island.load(this.assetLoader),
      this.bottle.load(this.assetLoader),
    ]);
    letterGroup.visible = false;
    this.scene.add(letterGroup);
    this.scene.add(islandGroup);
    bottleGroup.position.copy(BOTTLE_POS);
    this.scene.add(bottleGroup);

    letterGroup.traverse((child) => {
      if (!child.isMesh) return;
      if (!child.name.includes("Collider")) {
        this.letterMesh ??= child;
      }
    });

    const baseImage = this.letterMesh?.userData.baseMap?.image;
    if (baseImage) this.letterWriting.setBackground(baseImage);

    const uv = this.letterMesh?.geometry.attributes.uv;
    if (uv) {
      let uMin = 1,
        uMax = 0,
        vMin = 1,
        vMax = 0;
      for (let i = 0; i < uv.count; i++) {
        uMin = Math.min(uMin, uv.getX(i));
        uMax = Math.max(uMax, uv.getX(i));
        vMin = Math.min(vMin, uv.getY(i));
        vMax = Math.max(vMax, uv.getY(i));
      }
      this.letterWriting.setContentUV({ uMin, uMax, vMin, vMax });
    }
  }

  setPointer(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.mouse, this.camera);
  }

  getLetterUV(clientX, clientY) {
    if (!this.letterMesh) return null;
    this.setPointer(clientX, clientY);
    const hit = this.raycaster.intersectObject(this.letterMesh, false)[0];
    return hit?.uv ?? null;
  }

  applyLetterCamera() {
    const { barrelCameraPosition: p, barrelCameraRotation: r } = this.params;
    this.camera.position.copy(p);
    this.camera.rotation.set(
      THREE.MathUtils.degToRad(r.x),
      THREE.MathUtils.degToRad(r.y),
      THREE.MathUtils.degToRad(r.z),
      "YXZ",
    );
  }

  applyLetterLayout() {
    this.letter.group.position.copy(this.params.letterPosition);
    this.letter.group.scale.setScalar(this.params.letterScale);
    this.darkBackgroundPlane.position.copy(this.params.overlayPosition);
  }

  onClick = (event) => {
    // stop when click on tweakpane
    if (event.target?.closest?.(".tp-dfwv, .tp-rotv")) return;

    if (this.isWriting || !this.raycaster) return;
    this.pointerClient = { x: event.clientX, y: event.clientY };
    this.updateHover();
    if (this.hovered === this.island) {
      this.onBarrelClick?.();
    } else if (this.hovered === this.bottle) {
      this.onBottleClick?.();
    }
  };

  onPointerMove = (event) => {
    this.pointerClient = { x: event.clientX, y: event.clientY };
  };

  onPointerLeave = () => {
    this.pointerClient = null;
  };

  updateHover() {
    let model = null;
    if (this.pointerClient && !this.isWriting && this.raycaster) {
      this.setPointer(this.pointerClient.x, this.pointerClient.y);
      const targets = this.hoverables.flatMap((m) => m.hitTargets);
      const hit = this.raycaster.intersectObjects(targets, false)[0];
      model = hit?.object.userData.model ?? null;
    }
    this.setHovered(model);
  }

  update({ elapsed, delta }) {
    this.updateHover();

    // Flottement de la bouteille. Sur le group : lift reste libre pour l'animation de survol
    if (this.bottle?.group) {
      const { amplitude, speed } = BOTTLE_BOB;
      this.bottle.group.position.y =
        BOTTLE_POS.y + Math.sin(elapsed * speed) * amplitude;
    }
    // Ne redessine le canvas de la lettre que quand elle est affichée (inLetterMode)
    this.letterWriting?.update(delta * 1000);

    if (this.isWriting) {
      this.letter.group.quaternion.copy(this.camera.quaternion);
      this.darkBackgroundPlane.quaternion.copy(this.camera.quaternion);
    }
  }

  start() {
    this.uFogColor = uniform(color(HORIZON));
    this.uFogNear = uniform(80);
    this.uFogFar = uniform(320);

    // const materialSky = new THREE.MeshBasicNodeMaterial();
    // materialSky.colorNode = mix(color(HORIZON), color(ZENITH), 0.4);
    // this.scene.backgroundNode = mix(
    //   this.uFogColor,
    //   color(ZENITH),
    //   positionWorldDirection.y.clamp(0, 1).smoothstep(0, 0.2),
    // );
    this.sky = new SkyMaterial();
    this.scene.backgroundNode = this.sky.colorNode;
    this.scene.fogNode = fog(
      this.uFogColor,
      rangeFogFactor(this.uFogNear, this.uFogFar),
    );
  

    this.camera.fov = 55;
    this.camera.near = 0.1;
    this.camera.far = 1000;
    this.camera.updateProjectionMatrix();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(1, 1);

    this.camera.position.copy(this.params.cameraPosition);
    if (this.controls) {
      this.controls.target.copy(this.params.cameraTarget);
      this.controls.update();
    } else {
      this.camera.lookAt(this.params.cameraTarget);
    }

    this.setupEventListeners();

    const darkBackgroundMaterial = new THREE.MeshBasicNodeMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    darkBackgroundMaterial.fog = false;
    this.darkBackgroundPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(5000, 5000),
      darkBackgroundMaterial,
    );
    this.darkBackgroundPlane.visible = false;
    this.scene.add(this.darkBackgroundPlane);

    this.ocean = new OceanFloor({ size: 600 });
    this.scene.add(this.ocean.mesh);

    this.hemiLight = new THREE.HemisphereLight(HORIZON, 0x444444, 0.6);
    this.scene.add(this.hemiLight);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.position.set(110, 120, 50);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);

    const shadowCam = this.sun.shadow.camera;
    shadowCam.left = -80;
    shadowCam.right = 80;
    shadowCam.top = 80;
    shadowCam.bottom = -80;
    shadowCam.near = 1;
    shadowCam.far = 500;
    shadowCam.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 4;
    this.scene.add(this.sun);
    applyBaseShadow(this.scene, this.sun);

    this.hoverables = [this.island, this.bottle].filter((m) => m?.hover);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(this.viewport.width, this.viewport.height);
    Object.assign(this.labelRenderer.domElement.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
    });
    this.container.appendChild(this.labelRenderer.domElement);

    this.pipeline = createOutlinePipeline(
      this.renderer,
      this.scene,
      this.camera,
    );

    const urlSearchParams = new URLSearchParams(window.location.search);
    const isDebug =
      urlSearchParams.has("debug") ||
      window.location.hash.includes("debug") ||
      import.meta.env.DEV;

    if (isDebug) {
      this.debug = new Debug({ scene: this });
    }
  }

  setHovered(model) {
    if (model === this.hovered) return;
    this.hovered?.setHovered(false);
    model?.setHovered(true);
    this.hovered = model;
    this.renderer.domElement.style.cursor = model ? "pointer" : "";

    if (!this.pipeline) return;
    if (model) this.pipeline.setSelection(model.outlineMeshes);
    gsap.to(this.pipeline.params.strength, {
      value: model ? this.params.outlineStrength : 0,
      duration: 0.25,
      ease: "power2.out",
      overwrite: true,
      onComplete: () => {
        if (!this.hovered) this.pipeline?.setSelection([]);
      },
    });
  }

  render() {
    if (this.pipeline) this.pipeline.render();
    else super.render();
    this.labelRenderer?.render(this.scene, this.camera);
  }

  setCameraPose(position, target) {
    this.camera.position.copy(position);
    if (this.controls) this.controls.target.copy(target);
    this.camera.lookAt(target);
  }

  enterLetter() {
    if (!this.letterMesh) return;
    this.isWriting = true;
    this.letterWriting.inLetterMode = true;
    this.setHovered(null);
    if (this.controls) this.controls.enabled = false;

    this.applyLetterCamera();
    this.applyLetterLayout();
    this.letter.group.visible = true;

    const material = this.darkBackgroundPlane.material;
    gsap.killTweensOf(material);
    material.opacity = 0;
    this.darkBackgroundPlane.visible = true;
    gsap.to(material, {
      opacity: this.params.overlayOpacity,
      duration: 0.6,
      ease: "power2.out",
    });
  }

  refreshView() {
    if (this.isWriting) {
      this.applyLetterCamera();
      this.applyLetterLayout();
      const material = this.darkBackgroundPlane.material;
      gsap.killTweensOf(material);
      material.opacity = this.params.overlayOpacity;
    } else {
      this.setCameraPose(this.params.cameraPosition, this.params.cameraTarget);
      this.controls?.update();
    }
  }

  leaveLetter() {
    this.isWriting = false;
    this.letterWriting.inLetterMode = false;
    this.letterWriting.cancelImage();
    this.letter.group.visible = false;
    gsap.killTweensOf(this.darkBackgroundPlane.material);
    this.darkBackgroundPlane.visible = false;

    this.setCameraPose(this.params.cameraPosition, this.params.cameraTarget);
    if (this.controls) {
      this.controls.enabled = true;
      this.controls.update();
    }
  }

  resize() {
    super.resize();
    this.labelRenderer?.setSize(this.viewport.width, this.viewport.height);
  }

  destroy() {
    document.removeEventListener("pointerdown", this.onClick);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    if (this.pipeline) gsap.killTweensOf(this.pipeline.params.strength);
    this.hovered = null;
    this.hoverables = [];

    if (this.labelRenderer) {
      this.labelRenderer.domElement.remove();
      this.labelRenderer = null;
    }
    this.letterMesh = null;

    if (this.darkBackgroundPlane) {
      gsap.killTweensOf(this.darkBackgroundPlane.material);
      this.scene.remove(this.darkBackgroundPlane);
      this.darkBackgroundPlane.geometry.dispose();
      this.darkBackgroundPlane.material.dispose();
      this.darkBackgroundPlane = null;
    }

    if (this.pane) {
      this.pane.dispose();
      this.pane = null;
    }

    if (this.pipeline) {
      this.pipeline.dispose();
      this.pipeline = null;
    }

    if (this.ocean) {
      this.scene.remove(this.ocean.mesh);
      this.ocean.destroy();
      this.ocean = null;
    }

    if (this.letter) {
      if (this.letter.group) {
        this.scene.remove(this.letter.group);
      }
      this.letter.destroy();
      this.letter = null;
    }

    if (this.island) {
      if (this.island.group) {
        this.scene.remove(this.island.group);
      }
      this.island.destroy();
      this.island = null;
    }

    if (this.bottle) {
      if (this.bottle.group) this.scene.remove(this.bottle.group);
      this.bottle.destroy();
      this.bottle = null;
    }

    if (this.assetLoader) {
      this.assetLoader.destroy();
      this.assetLoader = null;
    }

    if (this.hemiLight) {
      this.scene.remove(this.hemiLight);
      this.hemiLight.dispose();
      this.hemiLight = null;
    }

    if (this.sun) {
      this.scene.remove(this.sun);
      this.sun.dispose();
      this.sun = null;
    }

    if (this.debug) {
      this.debug.destroy();
      this.debug = null;
    }

    super.destroy();
  }
  setupEventListeners() {
    document.addEventListener("pointerdown", this.onClick);
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
  }
}
