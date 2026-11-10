import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

export class AssetLoader {
  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  }

  loadGLTF(url) {
    return this.gltfLoader.loadAsync(url);
  }

  static disposeObject(object3D) {
    if (!object3D) return;

    object3D.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }

        const materials = [child.material].flat().filter(Boolean);
        for (const material of materials) {
          for (const key of Object.keys(material)) {
            const value = material[key];
            if (value && typeof value === "object" && value.isTexture) {
              value.dispose();
            }
          }
          material.dispose();
        }
      }
    });
  }

  destroy() {
    if (this.meshoptDecoder) {
      this.meshoptDecoder.dispose();
      this.meshoptDecoder = null;
    }
    this.gltfLoader = null;
  }
}
