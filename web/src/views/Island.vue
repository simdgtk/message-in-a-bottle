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
      :reply-to="replyingToBottle"
      @back="leaveLetterMode"
    />
    <ReadOverlay
      v-if="readingBottle"
      :bottle="readingBottle"
      :active-index="activeLetterIndex"
      @back="leaveReadMode"
      @reply="replyToBottle"
      @switch="switchLetter"
    />
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
const replyingToBottle = ref(null);
const activeLetterIndex = ref(0);

watch(
  app,
  (sceneApp) => {
    if (!sceneApp) return;
    sceneApp.onBarrelClick = () => {
      fadeThrough(async () => {
        replyingToBottle.value = null;
        await sceneApp.setTopLetterImage(null);
        sceneApp.enterLetter({ stacked: false });
        isWriting.value = true;
      });
    };
    sceneApp.onBottleClick = openBottle;
  },
  { immediate: true },
);

watch(
  [app, inbox],
  ([sceneApp, list]) => sceneApp?.setBottles(list ?? []),
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
  app.value.setBottles([]);
});

function openBottle(bottle = inbox.value[0]) {
  if (!bottle || !app.value) return;

  fadeThrough(async () => {
    activeLetterIndex.value = 0;
    const images = bottle.images ?? [bottle.image];
    await app.value.letterWriting.showReceived(images[0]);
    await app.value.setTopLetterImage(images.length > 1 ? images[1] : null);
    app.value.enterLetter({ stacked: images.length > 1 });
    readingBottle.value = bottle;
  });
}

function switchLetter() {
  const bottle = readingBottle.value;
  if (!bottle?.images || bottle.images.length < 2 || !app.value) return;
  const nextIndex = activeLetterIndex.value === 0 ? 1 : 0;
  activeLetterIndex.value = nextIndex;
  app.value.focusStackedLetter(nextIndex);
}

function replyToBottle() {
  const bottle = readingBottle.value;
  if (!bottle || !app.value) return;

  fadeThrough(async () => {
    readingBottle.value = null;
    replyingToBottle.value = bottle;
    const originalImage = bottle.images?.[0] ?? bottle.image;
    app.value.letterWriting.clear();
    await app.value.letterWriting.showReceived(null);
    await app.value.setTopLetterImage(originalImage);
    isWriting.value = true;
  });
}

function leaveReadMode() {
  fadeThrough(async () => {
    readingBottle.value = null;
    app.value?.leaveLetter();
    await app.value?.letterWriting.showReceived(null);
    await app.value?.setTopLetterImage(null);
  });
}

function leaveLetterMode() {
  fadeThrough(async () => {
    isWriting.value = false;
    replyingToBottle.value = null;
    app.value?.leaveLetter();
    await app.value?.setTopLetterImage(null);
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
