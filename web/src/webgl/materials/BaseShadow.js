import * as THREE from "three/webgpu";
import { mix, shadow, uniform, vec3, vec4 } from "three/tsl";

export const shadowColor = uniform(new THREE.Color(0.45, 0.55, 0.65));

export function applyBaseShadow(root, light) {
  const tint = mix(shadowColor, vec3(1), shadow(light));

  root.traverse((obj) => {
    const mat = obj.material;
    if (!obj.isMesh || !obj.receiveShadow || !mat?.isMeshBasicNodeMaterial)
      return;

    const baseSetupOutput = mat.setupOutput;
    mat.setupOutput = function (builder, output) {
      return baseSetupOutput.call(
        this,
        builder,
        vec4(output.rgb.mul(tint), output.a),
      );
    };
    mat.needsUpdate = true;
  });
}
