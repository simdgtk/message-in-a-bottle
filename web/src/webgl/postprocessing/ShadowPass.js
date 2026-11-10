import * as THREE from "three/webgpu";
import { pass, uniform, vec4 } from "three/tsl";

export const shadowParams = {
  factor: uniform(0.5),
};

export function createShadowPipeline(
  renderer,
  scene,
  camera,
  { factor = shadowParams.factor } = {},
) {
  const postProcessing = new THREE.PostProcessing(renderer);

  const scenePass = pass(scene, camera);

  // const darkenedColor = scenePass.rgb.mul(factor);
  const darkenedColor = scenePass.rgb;
  postProcessing.outputNode = vec4(darkenedColor, scenePass.a);

  return {
    postProcessing,
    factor: factor,
    render() {
      postProcessing.render();
    },
    dispose() {
      postProcessing.dispose();
      scenePass.dispose();
    },
  };
}

export const createShadowPass = createShadowPipeline;
