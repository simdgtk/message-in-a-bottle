import * as THREE from "three/webgpu";

export class Viewport {
  constructor({ container, onResize } = {}) {
    this.container = container || null;
    this.onResizeCallback = onResize || null;

    this.width = 0;
    this.height = 0;
    this.aspectRatio = 1;
    this.dpr = 1;

    this.onResize = this.onResize.bind(this);
    this.init();
  }

  init() {
    this.update();
    window.addEventListener("resize", this.onResize);
  }

  update() {
    if (this.container && this.container.clientWidth && this.container.clientHeight) {
      this.width = this.container.clientWidth;
      this.height = this.container.clientHeight;
    } else {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
    }

    this.aspectRatio = this.width / Math.max(this.height, 1);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
  }

  onResize() {
    this.update();
    if (this.onResizeCallback) {
      this.onResizeCallback(this);
    }
  }

  destroy() {
    window.removeEventListener("resize", this.onResize);
    this.container = null;
    this.onResizeCallback = null;
  }
}

