<template>
  <div ref="container" class="scene"></div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from "vue";
import { LoginSceneApp } from "@/webgl";

const container = ref(null);
let app = null;

onMounted(async () => {
  if (!container.value) return;
  app = new LoginSceneApp({ container: container.value });
  await app.init();
});

onBeforeUnmount(() => {
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
