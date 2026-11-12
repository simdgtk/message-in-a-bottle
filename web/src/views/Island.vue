<template>
  <div class="island-page">
    <div ref="container" class="canvas-3d"></div>
    <LetterOverlay
      v-if="isWriting"
      :letter="app?.letterWriting"
      @back="leaveLetterMode"
    />
    <div ref="fade" class="fade"></div>
  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onBeforeUnmount, nextTick } from "vue";
import gsap from "gsap";
import { SceneApp } from "@/webgl";
import LetterOverlay from "@/views/LetterOverlay.vue";

const isWriting = ref(false);
const container = ref(null);
const fade = ref(null);
let isTransitioning = false;
const app = shallowRef(null);

onMounted(async () => {
  const sceneApp = new SceneApp({ container: container.value });
  app.value = sceneApp;

  sceneApp.onBarrelClick = () => {
    transition(() => {
      sceneApp.enterLetter();
      isWriting.value = true;
    });
  };

  await sceneApp.init();
});

onBeforeUnmount(() => {
  gsap.killTweensOf(fade.value);
  app.value?.destroy();
  app.value = null;
});

async function transition(changeMode) {
  if (isTransitioning) return;
  isTransitioning = true;
  await gsap.to(fade.value, { autoAlpha: 1, duration: 0.6, ease: "sine.inOut" });
  changeMode();
  await nextTick();
  await gsap.to(fade.value, {
    autoAlpha: 0,
    duration: 0.8,
    ease: "sine.inOut",
  });
  isTransitioning = false;
}

function leaveLetterMode() {
  transition(() => {
    isWriting.value = false;
    app.value?.leaveLetter();
  });
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

.fade {
  position: fixed;
  inset: 0;
  z-index: 10;
  background: #000;
  opacity: 0;
  visibility: hidden;
}

.canvas-3d :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
