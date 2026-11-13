<template>
  <Scene :mode="sceneMode" />
  <router-view />
  <div :ref="setFadeElement" class="fade"></div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import Scene from "@/components/Scene.vue";
import { setFadeElement } from "@/composables/useFade";

const route = useRoute();
const sceneMode = computed(() => (route.name === "login" ? "login" : "island"));
</script>

<style lang="scss" scoped>
.fade {
  position: fixed;
  inset: 0;
  z-index: 10;
  background: #000;
  opacity: 0;
  visibility: hidden;
}
</style>
