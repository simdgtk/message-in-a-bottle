// from Bruno Simon
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  color,
  float,
  mix,
  mx_noise_float,
  mx_worley_noise_float,
  parallaxUV,
  time,
  uniform,
  uv,
  vec3,
} from "three/tsl";

export class OceanMaterial extends MeshBasicNodeMaterial {
  constructor({
    depth = 0.06,
    causticsScale = 22,
    causticsSpeed = 0.1,
    deepColor = 0x1e5f92,
    causticsColor = 0x55b0d8,
    foamScale = 15,
    foamSpeed = 0.03,
    foamWidth = 0.07,
    foamColor = 0xdde8ee,
    foamOpacity = 0.8,
  } = {}) {
    super();

    this.uDepth = uniform(depth);
    this.uCausticsScale = uniform(causticsScale);
    this.uCausticsSpeed = uniform(causticsSpeed);
    this.uDeepColor = uniform(color(deepColor));
    this.uCausticsColor = uniform(color(causticsColor));
    this.uFoamScale = uniform(foamScale);
    this.uFoamSpeed = uniform(foamSpeed);
    this.uFoamWidth = uniform(foamWidth);
    this.uFoamColor = uniform(color(foamColor));
    this.uFoamOpacity = uniform(foamOpacity);

    const depthUv = parallaxUV(uv(), this.uDepth).xy;
    const causticsUv = vec3(
      depthUv.mul(this.uCausticsScale),
      time.mul(this.uCausticsSpeed),
    );
    const causticsNoise = mx_worley_noise_float(causticsUv).pow(3);
    const depthColor = mix(this.uDeepColor, this.uCausticsColor, causticsNoise);

    const foamInput = uv().mul(this.uFoamScale);
    const foamNoise = mx_noise_float(
      vec3(foamInput, time.mul(this.uFoamSpeed)),
    );
    const foamMask = foamNoise.abs().step(this.uFoamWidth).oneMinus();
    const finalFoamFactor = foamMask.mul(this.uFoamOpacity);

    this.colorNode = mix(depthColor, this.uFoamColor, finalFoamFactor);
    this.opacityNode = float(1);
  }
}
