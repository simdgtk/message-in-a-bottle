import * as THREE from "three/webgpu";
import { WebGLApp } from "@/webgl/core/WebGLApp.js";
import { ShaderCube } from "@/webgl/objects/ShaderCube.js";

export class LoginSceneApp extends WebGLApp {
  constructor(options) {
    super(options);

    this.cube = null;
    this.ambientLight = null;
    this.dirLight = null;
  }

  start() {
    this.scene.background = new THREE.Color(0x0b0d17);

    this.camera.fov = 50;
    this.camera.near = 0.1;
    this.camera.far = 100;
    this.camera.position.set(0, 0, 4);
    this.camera.updateProjectionMatrix();

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    this.dirLight.position.set(3, 4, 5);
    this.scene.add(this.dirLight);

    this.cube = new ShaderCube({ size: 1.4 });
    this.scene.add(this.cube.mesh);
  }

  update({ elapsed, delta }) {
    if (this.cube) {
      this.cube.update({ elapsed, delta });
    }
  }

  destroy() {
    if (this.cube) {
      this.scene.remove(this.cube.mesh);
      this.cube.destroy();
      this.cube = null;
    }

    if (this.ambientLight) {
      this.scene.remove(this.ambientLight);
      this.ambientLight.dispose();
      this.ambientLight = null;
    }

    if (this.dirLight) {
      this.scene.remove(this.dirLight);
      this.dirLight.dispose();
      this.dirLight = null;
    }

    super.destroy();
  }
}

