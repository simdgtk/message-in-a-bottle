import * as THREE from "three/webgpu";
import { color, fog, rangeFogFactor, uniform } from "three/tsl";
import gsap from "gsap";
import { WebGLApp } from "@/webgl/core/WebGLApp.js";
import { AssetLoader } from "@/webgl/core/AssetLoader.js";
import { OceanFloor } from "@/webgl/objects/OceanFloor.js";
import { Model } from "@/webgl/objects/Model.js";
import { applyPaintedShadow } from "@/webgl/materials/paintedShadow.js";
import { Letter } from "@/utils/Letter.js";
import { Debug } from "@/webgl/debug/Debug.js";

const HORIZON = 0xbfe3ff;
const ZENITH = 0x2f7fd6;
const DEFAULT_CAMERA_POS = new THREE.Vector3(96, 45, 30);
const LETTER_VIEW_MARGIN = 1.12;
const CAMERA_TWEEN = { duration: 1.2, ease: "power2.inOut" };
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 15, 0);

export class SceneApp extends WebGLApp {
  constructor(options) {
    super(options);

    this.assetLoader = new AssetLoader();
    this.ocean = null;
    this.letter = null;
    this.hemiLight = null;
    this.sun = null;
    this.pipeline = null;
    this.pane = null;
    this.width = 0;
    this.height = 0;

    this.letterWriting = new Letter();
    this.letterMesh = null;
    this.isWriting = false;
    this.isCameraAnimating = false;
    this.onLetterClick = null;

    this.letterWriting.pointerMapper = (x, y) => this.getLetterUV(x, y);
  }

  async load() {
    this.letter = new Model({
      modelUrl: "/models/letter.glb",
      scale: 60,
      customTexture: this.letterWriting.texture,
    });
    const letterGroup = await this.letter.load(this.assetLoader);
    this.scene.add(letterGroup);

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

  getLetterViewPose() {
    const mesh = this.letterMesh;
    mesh.updateWorldMatrix(true, false);

    const geometry = mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const localBox = geometry.boundingBox;
    const localSize = localBox.getSize(new THREE.Vector3());
    const scale = mesh.getWorldScale(new THREE.Vector3());
    const width = localSize.x * scale.x;
    const height = localSize.y * scale.y;

    const center = localBox
      .getCenter(new THREE.Vector3())
      .applyMatrix4(mesh.matrixWorld);
    const normal = new THREE.Vector3(0, 0, 1)
      .transformDirection(mesh.matrixWorld)
      .normalize();

    const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const distance =
      Math.max(
        height / 2 / tanHalfFov,
        width / 2 / (tanHalfFov * this.camera.aspect),
      ) * LETTER_VIEW_MARGIN;

    return {
      position: center.clone().addScaledVector(normal, distance),
      target: center,
    };
  }

  onClick = (event) => {
    // stop when click on tweakpane
    if (event.target?.closest?.(".tp-dfwv, .tp-rotv")) return;

    if (this.isWriting || !this.raycaster) return;
    this.setPointer(event.clientX, event.clientY);
    const allColliders = [...this.letter.colliders];
    const intersects = this.raycaster.intersectObjects(allColliders, false);
    const hitLetter = intersects.find((i) =>
      this.letter.colliders.includes(i.object),
    );
    if (hitLetter) {
      this.onLetterClick?.();
    }
    if (intersects.length > 0) {
      console.log(intersects[0].object);
    }
  };

  start() {
    // Background and fog share one color so the far ocean melts into the sky.
    this.uFogColor = uniform(color(HORIZON));
    this.uFogNear = uniform(80);
    this.uFogFar = uniform(320);
    this.scene.backgroundNode = this.uFogColor;
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

    this.camera.position.copy(DEFAULT_CAMERA_POS);
    if (this.controls) {
      this.controls.target.copy(DEFAULT_CAMERA_TARGET);
      this.controls.update();
    } else {
      this.camera.lookAt(DEFAULT_CAMERA_TARGET);
    }

    this.setupEventListeners();

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
    applyPaintedShadow(this.scene, this.sun);

    this.letter.group.rotation.y = Math.PI / 2;

    const urlSearchParams = new URLSearchParams(window.location.search);
    const isDebug =
      urlSearchParams.has("debug") ||
      window.location.hash.includes("debug") ||
      import.meta.env.DEV;

    if (isDebug) {
      this.debug = new Debug({ scene: this });
    }

    // this.pipeline = createPaintedPipeline(
    //   this.renderer,
    //   this.scene,
    //   this.camera,
    // );
  }

  render() {
    if (this.pipeline) this.pipeline.render();
    else super.render();
  }

  animateCamera(position, target, onComplete) {
    this.isCameraAnimating = true;
    gsap.killTweensOf(this.camera.position);
    if (this.controls) gsap.killTweensOf(this.controls.target);

    const lookTarget = this.controls
      ? this.controls.target
      : (this.lookTarget ??= DEFAULT_CAMERA_TARGET.clone());

    gsap.to(this.camera.position, {
      ...position,
      ...CAMERA_TWEEN,
      onUpdate: () => this.camera.lookAt(lookTarget),
      onComplete: () => {
        this.isCameraAnimating = false;
        onComplete?.();
      },
    });
    gsap.to(lookTarget, { ...target, ...CAMERA_TWEEN });
  }

  zoomToLetter() {
    if (!this.letterMesh) return;
    this.isWriting = true;
    if (this.controls) this.controls.enabled = false;

    const { position, target } = this.getLetterViewPose();
    this.animateCamera(
      { x: position.x, y: position.y, z: position.z },
      { x: target.x, y: target.y, z: target.z },
    );
  }

  resetCamera() {
    this.isWriting = false;
    this.animateCamera(
      {
        x: DEFAULT_CAMERA_POS.x,
        y: DEFAULT_CAMERA_POS.y,
        z: DEFAULT_CAMERA_POS.z,
      },
      {
        x: DEFAULT_CAMERA_TARGET.x,
        y: DEFAULT_CAMERA_TARGET.y,
        z: DEFAULT_CAMERA_TARGET.z,
      },
      () => {
        if (this.controls) {
          this.controls.enabled = true;
          this.controls.update();
        }
      },
    );
  }

  resize() {
    super.resize();
    // Keep the letter framed when the window is resized while writing.
    if (this.isWriting && !this.isCameraAnimating && this.letterMesh) {
      const { position, target } = this.getLetterViewPose();
      this.camera.position.copy(position);
      if (this.controls) this.controls.target.copy(target);
      this.camera.lookAt(target);
    }
  }

  destroy() {
    document.removeEventListener("pointerdown", this.onClick);
    gsap.killTweensOf(this.camera.position);
    if (this.controls) gsap.killTweensOf(this.controls.target);
    this.letterMesh = null;

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
  }
}
