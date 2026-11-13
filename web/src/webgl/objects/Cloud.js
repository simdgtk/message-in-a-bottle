import * as THREE from "three/webgpu";
import texture1 from "/images/cloud1.webp";
import texture2 from "/images/cloud2.webp";
import texture3 from "/images/cloud3.webp";

const loader = new THREE.TextureLoader();
const CLOUD_TEXTURES = [texture1, texture2, texture3].map((url) => {
  const tex = loader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
});

export class Cloud {
  constructor({
    x = 0,
    y = 70,
    z = 0,
    scale = 45,
    speed = 3,
    minZ = -300,
    maxZ = 300,
    textureIndex = 0,
  } = {}) {
    this.speed = speed;
    this.minZ = minZ;
    this.maxZ = maxZ;

    const texture = CLOUD_TEXTURES[textureIndex % CLOUD_TEXTURES.length];

    const geometry = new THREE.PlaneGeometry(2 * scale, scale);
    const material = new THREE.MeshBasicNodeMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    material.fog = false;

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(x, y, z);
    this.mesh.rotation.y = -Math.PI / 2;
  }

  update(delta, cameraQuaternion) {
    this.mesh.position.z += this.speed * delta;
    if (this.mesh.position.z > this.maxZ) {
      this.mesh.position.z = this.minZ;
    }
    this.mesh.quaternion.copy(cameraQuaternion);
  }

  destroy() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
  }
}
