import * as THREE from "three/webgpu";
import { Viewport } from "./Viewport.js";
import { Inspector } from "three/examples/jsm/inspector/Inspector.js";

export class WebGLApp {
  constructor({
    container,
    antialias = true,
    alpha = false,
  } = {}) {
    this.container = container;
    this.viewport = new Viewport({
      container: this.container,
      onResize: () => this.resize(),
    });
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      50,
      this.viewport.aspectRatio,
      0.1,
      1000,
    );

    this.renderer = new THREE.WebGPURenderer({
      antialias,
      alpha,
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setPixelRatio(this.viewport.dpr);
    this.renderer.setSize(this.viewport.width, this.viewport.height);
    this.container.appendChild(this.renderer.domElement);

    const urlSearchParams = new URLSearchParams(window.location.search);
    this.isDebug =
      urlSearchParams.has("debug") ||
      window.location.hash.includes("debug") ||
      import.meta.env.IS_DEBUG === "true";

    this.inspector = null;
    if (this.isDebug) {
      this.inspector = new Inspector();
      this.renderer.inspector = this.inspector;
    }

    this.timer = new THREE.Timer();
    this.timer.connect(document);

    this.loop = this.loop.bind(this);
    this.isRunning = false;
    this.isDestroyed = false;
  }

  async init() {
    await this.renderer.init();
    if (this.isDestroyed) return;

    await this.load();
    if (this.isDestroyed) return;

    this.start();
    this.play();
  }

  async load() {}

  start() {}

  play() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer.reset();
    this.renderer.setAnimationLoop(this.loop);
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.renderer.setAnimationLoop(null);
  }

  loop(timeMs) {
    this.timer.update(timeMs);
    const elapsed = this.timer.getElapsed();
    const delta = this.timer.getDelta();

    this.update({ timeMs, elapsed, delta });
    this.render();
  }

  update({ timeMs, elapsed, delta }) {}

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    this.camera.aspect = this.viewport.aspectRatio;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.viewport.width, this.viewport.height);
    this.renderer.setPixelRatio(this.viewport.dpr);
  }

  destroy() {
    this.isDestroyed = true;
    this.stop();

    if (this.timer) {
      this.timer.dispose();
      this.timer = null;
    }

    if (this.viewport) {
      this.viewport.destroy();
      this.viewport = null;
    }

    if (this.inspector) {
      this.inspector.domElement.remove();
      this.inspector.dispose();
      this.inspector = null;
    }

    if (this.renderer) {
      if (this.renderer.domElement && this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(
          this.renderer.domElement,
        );
      }
      this.renderer.dispose();
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.container = null;
  }
}
