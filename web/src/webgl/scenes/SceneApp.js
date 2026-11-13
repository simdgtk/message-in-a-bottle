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
import { SkyMaterial } from "@/webgl/materials/Sky";
import { AudioManager } from "@/webgl/core/AudioManager";
import { Cloud } from "@/webgl/objects/Cloud.js";
import { damp } from "@/utils/maths.js";

const HORIZON = 0xa3cbe4;
const DEFAULT_CAMERA_POS = new THREE.Vector3(-85.5, 28, 19);
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(8, 12, 12);
const ISLAND_POS = new THREE.Vector3(0, 1, 0);
const ISLAND_SCALE = 120;
const ISLAND_ROTATION = new THREE.Vector3(0, -29, 0);
const LOGIN_ISLAND_POS = new THREE.Vector3(130, 1.8, 60);
const LOGIN_ISLAND_SCALE = 0.6;
const LOGIN_ISLAND_ROTATION = new THREE.Vector3(0, 0, 0);
const LOGIN_CAMERA_POS = new THREE.Vector3(0, 37.5, 0);
const LOGIN_CAMERA_TARGET = new THREE.Vector3(150, 28, 20);
const LETTER_CAMERA_POS = new THREE.Vector3(-0.5, 22.5, -1.8);
const LETTER_CAMERA_ROTATION = new THREE.Vector3(-6, -8, 0);
const LETTER_POS = new THREE.Vector3(0.5, 21.4, -11);
const LETTER_SCALE = 0.084;
const DARK_BACKGROUND_POS = new THREE.Vector3(1.36, 19.98, -11.95);
const DARK_BACKGROUND_OPACITY = 0.85;
const BOTTLE_POS = new THREE.Vector3(-30, -3, 45);
const BOTTLE_SCALE = 6;
const BOTTLE_FLOATING_AMPLITUDE = 0.6;
const BOTTLE_FLOATING_SPEED = 1.2;
const BOTTLE_MIN_SPACING = 12;
const LETTER_STACK_GAP = 7.6;
const CLOUDS_CONFIG = [
  { x: 180, y: 60, z: -180, scale: 50, speed: 3.5, textureIndex: 0 },
  { x: 220, y: 90, z: -70, scale: 65, speed: 2.2, textureIndex: 1 },
  { x: 160, y: 45, z: -300, scale: 42, speed: 4.2, textureIndex: 2 },
  { x: 240, y: 100, z: 130, scale: 58, speed: 2.8, textureIndex: 0 },
  { x: 195, y: 80, z: 220, scale: 48, speed: 3.1, textureIndex: 1 },
];

export class SceneApp extends WebGLApp {
  constructor({ mode = "island", ...options } = {}) {
    super(options);
    this.mode = mode;
    this.isReady = false;
    this.islandBasePosition = new THREE.Vector3();
    this.islandBaseScale = 1;

    this.assetLoader = new AssetLoader();
    this.ocean = null;
    this.clouds = [];
    this.letter = null;
    this.backLetter = null;
    this.showBackLetter = false;
    this.island = null;
    this.bottles = new Map();
    this.pendingBottles = [];
    this.isDestroyed = false;
    this.spawnRaycaster = new THREE.Raycaster();
    this.hemiLight = null;
    this.sun = null;
    this.pipeline = null;
    this.pane = null;
    this.width = 0;
    this.height = 0;

    this.letterWriting = new Letter();
    this.topLetterWriting = new Letter();
    this.letterMesh = null;
    this.stackOffset = 0;
    this.isWriting = false;
    this.onBarrelClick = null;
    this.onBottleClick = null;
    this.darkBackgroundPlane = null;

    this.parallaxPointer = new THREE.Vector2();
    this.parallax = new THREE.Vector2();
    this.parallaxOffset = new THREE.Vector3();
    this.parallaxBasePosition = new THREE.Vector3();
    this.parallaxBaseQuaternion = new THREE.Quaternion();

    this.params = {
      cameraPosition: DEFAULT_CAMERA_POS.clone(),
      cameraTarget: DEFAULT_CAMERA_TARGET.clone(),
      loginCameraPosition: LOGIN_CAMERA_POS.clone(),
      loginCameraTarget: LOGIN_CAMERA_TARGET.clone(),
      islandPosition: ISLAND_POS.clone(),
      islandScale: 1,
      islandRotation: ISLAND_ROTATION.clone(),
      loginIslandPosition: LOGIN_ISLAND_POS.clone(),
      loginIslandScale: LOGIN_ISLAND_SCALE,
      loginIslandRotation: LOGIN_ISLAND_ROTATION.clone(),
      bottlePosition: BOTTLE_POS.clone(),
      bottleScale: 1,
      bottleFloatingAmplitude: BOTTLE_FLOATING_AMPLITUDE,
      bottleFloatingSpeed: BOTTLE_FLOATING_SPEED,
      barrelCameraPosition: LETTER_CAMERA_POS.clone(),
      barrelCameraRotation: LETTER_CAMERA_ROTATION.clone(),
      letterPosition: LETTER_POS.clone(),
      letterScale: LETTER_SCALE,
      overlayPosition: DARK_BACKGROUND_POS.clone(),
      overlayOpacity: DARK_BACKGROUND_OPACITY,
      outlineStrength: 3,
      parallaxStrength: 2.5,
      parallaxSmoothing: 0.06,
    };

    this.labelRenderer = null;
    this.hoverables = [];
    this.hovered = null;
    this.pointerClient = null;

    this.letterWriting.pointerMapper = (x, y) => this.getLetterUV(x, y);

    this.audioManager = new AudioManager();
    this.letterWriting.onSound = (name, action = "play") => {
      if (action === "stop") this.audioManager.stop(name);
      else this.audioManager.play(name);
    };
  }

  async load() {
    this.letter = new Model({
      modelUrl: "/models/letter.glb",
      scale: 60,
      customTexture: this.letterWriting.texture,
      alignBottom: false,
    });
    this.backLetter = new Model({
      modelUrl: "/models/letter.glb",
      scale: 60,
      customTexture: this.topLetterWriting.texture,
      alignBottom: false,
    });
    this.island = new Model({
      modelUrl: "/models/full_island.glb",
      scale: ISLAND_SCALE,
      alignBottom: false,
      hover: { label: "Écrire une lettre", lift: 0 },
    });
    const [letterGroup, backLetterGroup, islandGroup] = await Promise.all([
      this.letter.load(this.assetLoader),
      this.backLetter.load(this.assetLoader),
      this.island.load(this.assetLoader),
    ]);
    letterGroup.visible = false;
    this.scene.add(letterGroup);
    backLetterGroup.visible = false;
    this.scene.add(backLetterGroup);
    islandGroup.position.copy(this.params.islandPosition);
    this.scene.add(islandGroup);
    this.islandBasePosition.copy(islandGroup.position);
    this.islandBaseScale = islandGroup.scale.x;

    letterGroup.traverse((child) => {
      if (!child.isMesh) return;
      if (!child.name.includes("Collider")) {
        this.letterMesh ??= child;
      }
    });

    const baseImage = this.letterMesh?.userData.baseMap?.image;
    if (baseImage) {
      this.letterWriting.setBackground(baseImage);
      this.topLetterWriting.setBackground(baseImage);
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
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(
      this.camera.quaternion,
    );
    this.letter.group.position
      .copy(this.params.letterPosition)
      .addScaledVector(camUp, this.stackOffset);
    this.letter.group.scale.setScalar(this.params.letterScale);
    if (this.backLetter?.group) {
      this.backLetter.group.scale.setScalar(this.params.letterScale);
      this.backLetter.group.position
        .copy(this.params.letterPosition)
        .addScaledVector(camUp, this.stackOffset + LETTER_STACK_GAP);
    }
    this.darkBackgroundPlane.position.copy(this.params.overlayPosition);
  }

  onClick = (event) => {
    // stop when click on tweakpane
    if (event.target?.closest?.(".tp-dfwv, .tp-rotv")) return;

    if (this.isWriting || !this.raycaster) return;
    this.pointerClient = { x: event.clientX, y: event.clientY };
    this.updateHover();
    if (this.hovered === this.island) {
      this.audioManager.play("barrelClick");
      this.onBarrelClick?.();
    } else if (this.hovered?.bottleData) {
      this.audioManager.play("bottleClick");
      this.onBottleClick?.(this.hovered.bottleData);
    }
  };

  onPointerMove = (event) => {
    this.pointerClient = { x: event.clientX, y: event.clientY };
  };

  onPointerLeave = () => {
    this.pointerClient = null;
  };

  onWindowPointerMove = (event) => {
    this.parallaxPointer.set(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1,
    );
  };

  onWindowPointerOut = (event) => {
    if (!event.relatedTarget) this.parallaxPointer.set(0, 0);
  };

  updateParallax(delta) {
    const goal = this.isWriting ? 0 : 1;
    const smoothing = this.params.parallaxSmoothing;
    const dt = delta * 1000;
    this.parallax.x = damp(
      this.parallax.x,
      this.parallaxPointer.x * goal,
      smoothing,
      dt,
    );
    this.parallax.y = damp(
      this.parallax.y,
      this.parallaxPointer.y * goal,
      smoothing,
      dt,
    );
  }

  applyParallax() {
    if (this.isWriting) return false;
    const target = this.viewPose[1];
    const strength = this.params.parallaxStrength;
    this.parallaxBasePosition.copy(this.camera.position);
    this.parallaxBaseQuaternion.copy(this.camera.quaternion);
    this.parallaxOffset
      .set(this.parallax.x * strength, this.parallax.y * strength * 0.6, 0)
      .applyQuaternion(this.camera.quaternion);
    this.camera.position.add(this.parallaxOffset);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
    return true;
  }

  restoreParallax() {
    this.camera.position.copy(this.parallaxBasePosition);
    this.camera.quaternion.copy(this.parallaxBaseQuaternion);
    this.camera.updateMatrixWorld();
  }

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
    this.updateParallax(delta);

    const { bottleFloatingSpeed: speed, bottleFloatingAmplitude: amp } =
      this.params;
    for (const entry of this.bottles.values()) {
      const group = entry.model?.group;
      if (!group) continue;
      group.rotation.y = entry.baseRotY + Math.sin(elapsed * 0.2 + entry.phase);
      group.position.y =
        entry.basePos.y + Math.sin(elapsed * speed + entry.phase) * amp;
    }

    for (const cloud of this.clouds) {
      cloud.update(delta, this.camera.quaternion);
    }

    this.letterWriting?.update(delta * 1000);

    if (this.isWriting) {
      const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(
        this.camera.quaternion,
      );
      this.letter.group.position
        .copy(this.params.letterPosition)
        .addScaledVector(camUp, this.stackOffset);
      this.letter.group.quaternion.copy(this.camera.quaternion);
      if (this.showBackLetter && this.backLetter?.group) {
        this.backLetter.group.position
          .copy(this.params.letterPosition)
          .addScaledVector(camUp, this.stackOffset + LETTER_STACK_GAP);
        this.backLetter.group.quaternion.copy(this.camera.quaternion);
      }
      this.darkBackgroundPlane.quaternion.copy(this.camera.quaternion);
    }
  }

  start() {
    this.uFogColor = uniform(color(HORIZON));
    this.uFogNear = uniform(283);
    this.uFogFar = uniform(391);

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

    this.clouds = CLOUDS_CONFIG.map((cloudConfig) => {
      const cloud = new Cloud(cloudConfig);
      this.scene.add(cloud.mesh);
      return cloud;
    });

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

    if (this.isDebug) {
      this.debug = new Debug({ scene: this });
    }

    this.applyMode();
    this.isReady = true;
    if (this.pendingBottles.length) {
      this.setBottles(this.pendingBottles);
    }
  }

  setMode(mode) {
    this.mode = mode;
    if (this.isReady) this.applyMode();
  }

  applyMode() {
    this.setHovered(null);
    const [cameraPosition, cameraTarget] = this.viewPose;
    this.setCameraPose(cameraPosition, cameraTarget);
    this.applyIslandTransform();
    this.applyBottleTransform();
    this.updateBottles();
  }

  findBottleSpawnPosition() {
    this.island?.group?.updateMatrixWorld(true);
    const containers = this.island?.bottleContainers;
    if (!containers?.length) {
      return this.params.bottlePosition.clone();
    }

    const box = new THREE.Box3();
    for (const container of containers) {
      box.expandByObject(container);
    }

    const existingPositions = [...this.bottles.values()]
      .map((entry) => entry.basePos)
      .filter(Boolean);

    const y = this.params.bottlePosition.y;
    const origin = new THREE.Vector3();
    const down = new THREE.Vector3(0, -1, 0);
    let bestCandidate = null;
    let bestMinDist = -1;

    for (let attempt = 0; attempt < 150; attempt++) {
      const x = box.min.x + Math.random() * (box.max.x - box.min.x);
      const z = box.min.z + Math.random() * (box.max.z - box.min.z);

      origin.set(x, box.max.y + 50, z);
      this.spawnRaycaster.set(origin, down);
      if (
        this.spawnRaycaster.intersectObjects(containers, false).length === 0
      ) {
        continue;
      }

      const minDist = existingPositions.length
        ? Math.min(
            ...existingPositions.map((pos) => Math.hypot(x - pos.x, z - pos.z)),
          )
        : Infinity;

      if (minDist >= BOTTLE_MIN_SPACING) {
        return new THREE.Vector3(x, y, z);
      }

      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestCandidate = new THREE.Vector3(x, y, z);
      }
    }

    return bestCandidate ?? this.params.bottlePosition.clone();
  }

  async setBottles(bottlesData = []) {
    this.pendingBottles = bottlesData;
    if (!this.isReady) return;

    const nextByName = new Map(bottlesData.map((b) => [b.name, b]));

    for (const [name, entry] of this.bottles.entries()) {
      if (nextByName.has(name)) {
        entry.data = nextByName.get(name);
        if (entry.model) entry.model.bottleData = entry.data;
        continue;
      }
      if (entry.model && this.hovered === entry.model) this.setHovered(null);
      if (entry.model?.group) this.scene.remove(entry.model.group);
      entry.model?.destroy();
      this.bottles.delete(name);
    }

    const toAdd = bottlesData.filter((b) => !this.bottles.has(b.name));
    for (const bottleData of toAdd) {
      const placeholder = {
        data: bottleData,
        model: null,
        basePos: this.findBottleSpawnPosition(),
        phase: Math.random() * Math.PI * 2,
        baseRotY: Math.random() * Math.PI * 2,
        tiltX: (Math.random() - 0.5) * 0.25,
        tiltZ: Math.PI / 8 + (Math.random() - 0.5) * 0.25,
      };
      this.bottles.set(bottleData.name, placeholder);

      const model = new Model({
        modelUrl: "/models/bottle.glb",
        scale: BOTTLE_SCALE,
        hover: {
          label: bottleData.readOnly
            ? "Lire la réponse"
            : "Ouvrir la bouteille",
        },
      });
      const group = await model.load(this.assetLoader);
      if (
        this.isDestroyed ||
        this.bottles.get(bottleData.name) !== placeholder
      ) {
        model.destroy();
        continue;
      }

      model.bottleData = bottleData;
      group.position.copy(placeholder.basePos);
      group.rotation.x = placeholder.tiltX;
      group.rotation.z = placeholder.tiltZ;
      group.scale.setScalar(this.params.bottleScale);
      if (this.sun) applyBaseShadow(group, this.sun);
      this.scene.add(group);
      placeholder.model = model;
    }

    this.updateBottles();
  }

  updateBottles() {
    const visible = !this.isLogin;
    const activeModels = [];

    for (const entry of this.bottles.values()) {
      const model = entry.model;
      if (!model?.group) continue;
      model.group.visible = visible;
      if (!visible && this.hovered === model) this.setHovered(null);
      if (visible && model.hover) activeModels.push(model);
    }

    this.hoverables = this.isLogin
      ? []
      : [this.island, ...activeModels].filter((m) => m?.hover);
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
    const hasParallax = this.applyParallax();
    if (this.pipeline) this.pipeline.render();
    else super.render();
    this.labelRenderer?.render(this.scene, this.camera);
    if (hasParallax) this.restoreParallax();
  }

  get isLogin() {
    return this.mode === "login";
  }

  get viewPose() {
    const p = this.params;
    return this.isLogin
      ? [p.loginCameraPosition, p.loginCameraTarget]
      : [p.cameraPosition, p.cameraTarget];
  }

  setCameraPose(position, target) {
    this.camera.position.copy(position);
    this.camera.lookAt(target);
  }

  endDarkBackgroundPlaneTransition() {
    if (!this.darkBackgroundPlane) return;
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

  enterLetter({ stacked = false } = {}) {
    if (!this.letterMesh) return;
    gsap.killTweensOf(this);
    this.stackOffset = 0;
    this.isWriting = true;
    this.showBackLetter = stacked;
    this.letterWriting.inLetterMode = true;
    this.audioManager.setLetterMode(true);
    this.setHovered(null);

    for (const cloud of this.clouds) {
      if (cloud.mesh) cloud.mesh.visible = false;
    }

    this.applyLetterCamera();
    this.applyLetterLayout();
    this.letter.group.visible = true;
    if (this.backLetter?.group) {
      this.backLetter.group.visible = stacked;
    }
    this.endDarkBackgroundPlaneTransition();
  }

  async setTopLetterImage(src) {
    if (!src) {
      await this.topLetterWriting.showReceived(null);
      this.setBackLetterVisible(false);
      return;
    }
    await this.topLetterWriting.showReceived(src);
    this.topLetterWriting.render();
    this.setBackLetterVisible(true);
  }

  setBackLetterVisible(visible) {
    this.showBackLetter = visible;
    if (this.backLetter?.group) {
      this.backLetter.group.visible = visible;
    }
  }

  focusStackedLetter(index) {
    gsap.killTweensOf(this);
    gsap.to(this, {
      stackOffset: index === 1 ? -LETTER_STACK_GAP : 0,
      duration: 0.55,
      ease: "power3.inOut",
    });
  }

  applyIslandTransform() {
    if (!this.island?.group) return;
    const p = this.params;
    this.island.group.position.copy(
      this.isLogin ? p.loginIslandPosition : p.islandPosition,
    );
    this.island.group.scale.setScalar(
      this.isLogin ? p.loginIslandScale : p.islandScale,
    );
    const r = this.isLogin ? p.loginIslandRotation : p.islandRotation;
    this.island.group.rotation.set(
      THREE.MathUtils.degToRad(r.x),
      THREE.MathUtils.degToRad(r.y),
      THREE.MathUtils.degToRad(r.z),
    );
  }

  applyBottleTransform() {
    for (const entry of this.bottles.values()) {
      entry.model?.group?.scale.setScalar(this.params.bottleScale);
    }
  }

  refreshView() {
    this.applyIslandTransform();
    this.applyBottleTransform();
    if (this.isWriting) {
      this.applyLetterCamera();
      this.applyLetterLayout();
      const material = this.darkBackgroundPlane.material;
      gsap.killTweensOf(material);
      material.opacity = this.params.overlayOpacity;
    } else {
      this.setCameraPose(...this.viewPose);
    }
  }

  leaveLetter() {
    gsap.killTweensOf(this);
    this.stackOffset = 0;
    this.isWriting = false;
    this.showBackLetter = false;
    this.letterWriting.inLetterMode = false;
    this.audioManager.setLetterMode(false);
    this.audioManager.stop("eraserRub");
    this.letterWriting.cancelImage();
    this.letter.group.visible = false;
    if (this.backLetter?.group) this.backLetter.group.visible = false;
    gsap.killTweensOf(this.darkBackgroundPlane.material);
    this.darkBackgroundPlane.visible = false;

    for (const cloud of this.clouds) {
      if (cloud.mesh) cloud.mesh.visible = true;
    }

    this.setCameraPose(this.params.cameraPosition, this.params.cameraTarget);
  }

  resize() {
    super.resize();
    this.labelRenderer?.setSize(this.viewport.width, this.viewport.height);
  }

  destroy() {
    this.isDestroyed = true;
    gsap.killTweensOf(this);
    document.removeEventListener("pointerdown", this.onClick);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    window.removeEventListener("pointermove", this.onWindowPointerMove);
    document.removeEventListener("pointerout", this.onWindowPointerOut);
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

    for (const cloud of this.clouds) {
      if (cloud.mesh) this.scene.remove(cloud.mesh);
      cloud.destroy();
    }
    this.clouds = [];

    if (this.letter) {
      if (this.letter.group) {
        gsap.killTweensOf(this.letter.group.scale);
        this.scene.remove(this.letter.group);
      }
      this.letter.destroy();
      this.letter = null;
    }

    if (this.backLetter) {
      if (this.backLetter.group) {
        this.scene.remove(this.backLetter.group);
      }
      this.backLetter.destroy();
      this.backLetter = null;
    }

    if (this.island) {
      if (this.island.group) {
        this.scene.remove(this.island.group);
      }
      this.island.destroy();
      this.island = null;
    }

    for (const entry of this.bottles.values()) {
      if (entry.model?.group) this.scene.remove(entry.model.group);
      entry.model?.destroy();
    }
    this.bottles.clear();
    this.pendingBottles = [];

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

    this.letterWriting.onSound = null;
    this.topLetterWriting?.destroy();
    this.topLetterWriting = null;
    this.audioManager?.destroy();
    this.audioManager = null;

    super.destroy();
  }
  setupEventListeners() {
    document.addEventListener("pointerdown", this.onClick);
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    window.addEventListener("pointermove", this.onWindowPointerMove);
    document.addEventListener("pointerout", this.onWindowPointerOut);
  }
}
