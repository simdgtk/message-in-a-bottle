<template>
  <div ref="container" class="scene"></div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { SceneApp } from "@/webgl/scenes/SceneApp.js";
import { sceneApp } from "@/composables/useSceneApp";
import { router } from "@/router/index";

const props = defineProps({ mode: { type: String, default: "island" } });
const container = ref(null);
let app = null;

onMounted(async () => {
  await router.isReady();
  if (!container.value) return;
  app = new SceneApp({ container: container.value, mode: props.mode });
  sceneApp.value = app;
  await app.init();
});

watch(
  () => props.mode,
  (mode) => app?.setMode(mode),
);

onBeforeUnmount(() => {
  sceneApp.value = null;
  app?.destroy();
  app = null;
});
</script>

<style lang="scss" scoped>
.scene {
  position: fixed;
  inset: 0;
  z-index: -1;
}
</style>
