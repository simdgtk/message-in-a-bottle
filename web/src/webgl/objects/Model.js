import * as THREE from "three/webgpu";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import gsap from "gsap";
import { AssetLoader } from "@/webgl/core/AssetLoader.js";

const LABEL_OFFSET = 4;

export class Model {
  constructor({
    modelUrl = "/models/letter.glb",
    scale = 60,
    customTexture = null,
    hover = null,
    alignBottom = true,
  } = {}) {
    this.alignBottom = alignBottom;
    this.hover = hover;
    this.hovered = false;
    this.model = null;
    this.lift = null;
    this.meshes = [];
    this.label = null;
    this.modelUrl = modelUrl;
    this.scale = scale;
    this.group = null;
    this.colliders = [];
    this.bottleContainers = [];
    this.customTexture = customTexture;
    // this.mixCustomMaterial = options.mixCustomMaterial
    // this.mixCustomMaterial = mixCustomMaterial;
  }

  async load(assetLoader) {
    const gltf = await assetLoader.loadGLTF(this.modelUrl);
    this.model = gltf.scene;

    this.model.traverse((child) => {
      if (!child.isMesh) return;

      if (child.name.includes("Bottles_Container")) {
        this.bottleContainers.push(child);
        child.material?.dispose();
        child.material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
        child.visible = false;
        return;
      } else if (child.name.includes("Collider")) {
        this.colliders.push(child);
      } else {
        this.meshes.push(child);
      }

      child.castShadow = true;
      child.receiveShadow = true;

      const childMaterial = child.material;
      child.userData.baseMap = childMaterial.map ?? null;
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

    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.z);

    if (maxDimension > 0) {
      this.model.scale.setScalar(this.scale / maxDimension);
    }

    box.setFromObject(this.model);
    const center = box.getCenter(new THREE.Vector3());
    this.model.position.set(
      -center.x,
      this.alignBottom ? -box.min.y : 0,
      -center.z,
    );

    this.lift = new THREE.Group();
    this.lift.add(this.model);
    this.group = new THREE.Group();
    this.group.add(this.lift);

    this.group.updateMatrixWorld(true);
    [...this.colliders, ...this.bottleContainers].forEach((obj) =>
      this.group.attach(obj),
    );
    this.hitTargets.forEach((object) => (object.userData.model = this));

    if (this.hover?.label) {
      const labelBox = this.colliders.length
        ? new THREE.Box3().setFromObject(this.colliders[0])
        : new THREE.Box3().setFromObject(this.model);
      this.createLabel(
        labelBox.getCenter(new THREE.Vector3()).setY(labelBox.max.y + LABEL_OFFSET),
      );
    }

    return this.group;
  }

  get hitTargets() {
    return this.colliders.length ? this.colliders : this.meshes;
  }

  get outlineMeshes() {
    if (!this.colliders.length) return this.meshes;
    const names = this.colliders.map((c) => c.name.replace(/_?Collider.*$/, ""));
    const matched = this.meshes.filter((m) => names.includes(m.name));
    return matched.length ? matched : this.meshes;
  }

  createLabel(position) {
    const element = document.createElement("div");
    element.className = "model-label";
    element.textContent = this.hover.label;
    this.label = new CSS2DObject(element);
    this.label.position.copy(position);
    this.lift.add(this.label);
  }

  setHovered(hovered) {
    if (!this.hover || this.hovered === hovered) return;
    this.hovered = hovered;

    gsap.to(this.lift.position, {
      y: hovered ? (this.hover.lift ?? 3) : 0,
      duration: 0.5,
      ease: "power3.out",
      overwrite: true,
    });

    this.label?.element.classList.toggle("is-visible", hovered);
  }

  destroy() {
    if (this.lift) gsap.killTweensOf(this.lift.position);
    if (this.label) {
      this.label.removeFromParent();
      this.label.element.remove();
      this.label = null;
    }
    if (this.group) {
      AssetLoader.disposeObject(this.group);
      this.group = null;
    }
  }
}
