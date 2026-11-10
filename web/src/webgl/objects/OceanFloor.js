import * as THREE from "three/webgpu";
import { AssetLoader } from "@/webgl/core/AssetLoader.js";
import { OceanMaterial } from "@/webgl/materials/OceanMaterial.js";

export class OceanFloor {
  constructor({
    size = 600,
    colorHex,
    deepColorDark = "#0e4f80",
    deepColor = colorHex ?? "#1a7fc1",
    foamColor = "#d4f6ff",
    speed = 0.05,
    scale = 10,
    voronoiScale = 1,
  } = {}) {
    this.size = size;
    this.mesh = null;
    this.material = null;
    this.init({
      deepColorDark,
      deepColor,
      foamColor,
      speed,
      scale,
      voronoiScale,
    });
  }

  init({ deepColorDark, deepColor, foamColor, speed, scale, voronoiScale }) {
    const geometry = new THREE.PlaneGeometry(this.size, this.size);
    // Tangents give a stable tangent space for the foam parallax.
    geometry.computeTangents();
    this.material = new OceanMaterial();

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.receiveShadow = true;
    this.mesh.userData.paintedShape = false;
  }

  destroy() {
    if (this.mesh) {
      AssetLoader.disposeObject(this.mesh);
      this.mesh = null;
      this.material = null;
    }
  }
}
