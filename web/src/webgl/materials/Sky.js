import {
  color,
  mix,
  positionWorldDirection
} from "three/tsl";
import * as THREE from "three/webgpu";
import { MeshBasicNodeMaterial } from "three/webgpu";

const cloudTexture = new THREE.TextureLoader().load("/images/cloud1.webp");

export class SkyMaterial extends MeshBasicNodeMaterial {
  constructor() {
    super();

    this.uHorizon = color(0xa3cbe4);

    this.uZenith = color(0x2377ca);

    this.colorNode = mix(
      this.uHorizon,
      this.uZenith,
      positionWorldDirection.y.clamp(0, 1).smoothstep(0, 0.2),
    );
  }
}
