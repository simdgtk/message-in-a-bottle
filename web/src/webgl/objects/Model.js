import * as THREE from "three/webgpu";
import { AssetLoader } from "@/webgl/core/AssetLoader.js";

export class Model {
  constructor({
    modelUrl = "/models/letter.glb",
    scale = 60,
    customTexture = null,
  } = {}) {
    this.modelUrl = modelUrl;
    this.scale = scale;
    this.group = null;
    this.colliders = [];
    this.customTexture = customTexture;
    // this.mixCustomMaterial = options.mixCustomMaterial
    // this.mixCustomMaterial = mixCustomMaterial;
  }

  async load(assetLoader) {
    const gltf = await assetLoader.loadGLTF(this.modelUrl);
    this.group = gltf.scene;

    this.group.traverse((child) => {
      if (!child.isMesh) return;

      if (child.name.includes("Collider")) {
        this.colliders.push(child);
      }

      child.castShadow = true;
      child.receiveShadow = true;

      const childMaterial = child.material;
      // Keep the baked texture around (the letter paints on top of it).
      child.userData.baseMap = childMaterial.map ?? null;
      // const childMaterial = this.customMaterial;
      child.material = new THREE.MeshBasicNodeMaterial({
        map: this.customTexture || childMaterial.map,
        color: childMaterial.map ? 0xffffff : childMaterial.color,
        side: childMaterial.side,
      });
      childMaterial.dispose();
    });

    this.colliders.forEach((collider) => {
      collider.visible = false;
    });

    const box = new THREE.Box3().setFromObject(this.group);
    const size = box.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.z);

    if (maxDimension > 0) {
      this.group.scale.setScalar(this.scale / maxDimension);
    }

    box.setFromObject(this.group);
    const center = box.getCenter(new THREE.Vector3());
    this.group.position.set(-center.x, -box.min.y, -center.z);

    return this.group;
  }

  destroy() {
    if (this.group) {
      AssetLoader.disposeObject(this.group);
      this.group = null;
    }
  }
}
