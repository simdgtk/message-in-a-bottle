import * as THREE from "three/webgpu";
import { color, mix, normalWorld, time, sin, positionLocal } from "three/tsl";
import { AssetLoader } from "@/webgl/core/AssetLoader.js";

export class ShaderCube {
  constructor({ size = 1.4 } = {}) {
    this.size = size;
    this.mesh = null;
    this.init();
  }

  init() {
    const geometry = new THREE.BoxGeometry(this.size, this.size, this.size);

    const material = new THREE.MeshStandardNodeMaterial();
    const t = sin(time.add(positionLocal.y.mul(3))).mul(0.5).add(0.5);
    material.colorNode = mix(color(0x4f46e5), color(0x22d3ee), t).add(
      normalWorld.mul(0.15)
    );
    material.roughness = 0.4;

    this.mesh = new THREE.Mesh(geometry, material);
  }

  update({ elapsed }) {
    if (!this.mesh) return;
    this.mesh.rotation.x = elapsed * 0.5;
    this.mesh.rotation.y = elapsed * 0.8;
  }

  destroy() {
    if (this.mesh) {
      AssetLoader.disposeObject(this.mesh);
      this.mesh = null;
    }
  }
}

