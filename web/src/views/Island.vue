<template>
  <div class="island-page">
    <div ref="container" class="canvas-3d"></div>
    <LetterOverlay
      v-if="isWriting"
      :letter="app?.letterWriting"
      @back="leaveLetterMode"
    />
  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onBeforeUnmount } from "vue";
import { SceneApp } from "@/webgl";
import LetterOverlay from "@/views/LetterOverlay.vue";

const isWriting = ref(false);
const container = ref(null);
const app = shallowRef(null);

onMounted(async () => {
  const sceneApp = new SceneApp({ container: container.value });
  app.value = sceneApp;

  sceneApp.onLetterClick = () => {
    isWriting.value = true;
    sceneApp.zoomToLetter();
  };

  await sceneApp.init();
});

onBeforeUnmount(() => {
  app.value?.destroy();
  app.value = null;
});

function leaveLetterMode() {
  isWriting.value = false;
  app.value?.resetCamera();
}
</script>

<style lang="scss" scoped>
.island-page,
.canvas-3d {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.canvas-3d :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
