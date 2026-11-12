import * as THREE from "three/webgpu";
import { pass, uniform, color } from "three/tsl";
import { outline } from "three/addons/tsl/display/OutlineNode.js";

export function createOutlinePipeline(renderer, scene, camera) {
  const postProcessing = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera);

  const edgeStrength = uniform(0);
  const edgeThickness = uniform(6);
  const edgeGlow = uniform(3);
  const visibleColor = uniform(color(0xffe9a8));
  const hiddenColor = uniform(color(0x59461b));

  const outlinePass = outline(scene, camera, {
    selectedObjects: [],
    edgeThickness,
  });

  const { visibleEdge, hiddenEdge } = outlinePass;
  const outlineColor = visibleEdge
    .mul(visibleColor)
    .add(hiddenEdge.mul(hiddenColor))
    .mul(edgeStrength);

  postProcessing.outputNode = scenePass.add(outlineColor);

  return {
    params: {
      strength: edgeStrength,
      thickness: edgeThickness,
      glow: edgeGlow,
      visibleColor,
      hiddenColor,
    },
    setSelection: (objects) => {
      outlinePass.selectedObjects = objects;
    },
    render: () => postProcessing.render(),
    dispose: () => {
      postProcessing.dispose();
      scenePass.dispose();
      outlinePass.dispose();
    },
  };
}
