<template>
  <div class="island-page">
    <button
      v-if="!isWriting && !readingBottle"
      type="button"
      class="logout-button"
      @click="logout"
    >
      Log out
    </button>
    <LetterOverlay
      v-if="isWriting"
      :letter="app?.letterWriting"
      @back="leaveLetterMode"
    />
    <ReadOverlay v-if="readingBottle" @back="leaveReadMode" />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import { router } from "@/router/index";
import { inbox, startBottles, stopBottles } from "@/composables/useBottles";
import { sceneApp as app } from "@/composables/useSceneApp";
import { fadeThrough } from "@/composables/useFade";
import LetterOverlay from "@/views/LetterOverlay.vue";
import ReadOverlay from "@/views/ReadOverlay.vue";

const isWriting = ref(false);
const readingBottle = ref(null);

watch(
  app,
  (sceneApp) => {
    if (!sceneApp) return;
    sceneApp.onBarrelClick = () => {
      fadeThrough(() => {
        sceneApp.enterLetter();
        isWriting.value = true;
      });
    };
    sceneApp.onBottleClick = openBottle;
  },
  { immediate: true },
);

watch(
  [app, () => inbox.value.length],
  ([sceneApp, count]) => sceneApp?.setBottleAvailable(count > 0),
  { immediate: true },
);

onMounted(() => {
  startBottles().catch((error) => console.warn(error));
});

onBeforeUnmount(() => {
  stopBottles();
  if (!app.value) return;
  app.value.onBarrelClick = null;
  app.value.onBottleClick = null;
  app.value.setBottleAvailable(false);
});

function openBottle() {
  const bottle = inbox.value[0];
  if (!bottle || !app.value) return;

  fadeThrough(async () => {
    await app.value.letterWriting.showReceived(bottle.image);
    app.value.enterLetter();
    readingBottle.value = bottle;
  });
}

function leaveReadMode() {
  fadeThrough(async () => {
    readingBottle.value = null;
    app.value?.leaveLetter();
    await app.value?.letterWriting.showReceived(null);
  });
}

function leaveLetterMode() {
  fadeThrough(() => {
    isWriting.value = false;
    app.value?.leaveLetter();
  });
}

function logout() {
  fadeThrough(() => {
    localStorage.removeItem("user_token");
    return router.push("/login");
  });
}
</script>

<style lang="scss" scoped>

.logout-button {
  position: fixed;
  top: 30px;
  left: 30px;
  z-index: 5;
  padding: 0.5rem 1rem;
  cursor: pointer;
}

</style>
