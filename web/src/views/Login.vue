<template>
  <section class="login">
    <div class="board">
      <div class="paper">
        <div class="intro-content">
          <h1 class="intro-title">{{ INTRO_TITLE }}</h1>
          <p v-for="(paragraph, index) in INTRO_PARAGRAPHS" :key="index" class="intro-text">
            {{ paragraph }}
          </p>
        </div>

        <button
          class="button confirm-button"
          type="button"
          :disabled="leaving"
          @click="onConfirm"
        >
          Compris
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from "vue";
import { router, INTRO_SEEN_KEY } from "@/router/index";
import { fadeThrough } from "@/composables/useFade";
import { sceneApp } from "@/composables/useSceneApp";

const INTRO_TITLE = "Message in a Bottle";
const INTRO_PARAGRAPHS = [
  "Bienvenue sur la version portfolio de ce projet. Pour faciliter la visite sans serveur ni inscription, l'envoi et la réponse aux bouteilles sont désactivés.",
  "Tu peux explorer l'île, ouvrir la bouteille reçue ainsi que la réponse déjà arrivée, et tester l'écriture, le dessin et l'ajout de photos sur la lettre.",
];

const leaving = ref(false);

async function onConfirm() {
  if (leaving.value) return;
  leaving.value = true;
  sceneApp.value?.audioManager?.play("uiInteraction");

  try {
    localStorage.setItem(INTRO_SEEN_KEY, "true");
  } catch {
  }

  try {
    await fadeThrough(() => router.push({ name: "island" }));
  } finally {
    leaving.value = false;
  }
}
</script>

<style lang="scss" scoped>
.login {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding-left: 7vw;
  pointer-events: none;

  @media (max-width: 768px) {
    justify-content: center;
    padding-left: 0;
  }

  .board {
    pointer-events: auto;
    width: min(30rem, 90vw);
    aspect-ratio: 1031 / 1250;
    display: flex;
    align-items: center;
    justify-content: center;
    background: url("/images/login/wood_background.webp") center / 100% 100%;
  }

  .paper {
    width: 95%;
    aspect-ratio: 957 / 1179;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 15% 13% 13%;
    box-sizing: border-box;
    background: url("/images/login/paper.webp") center / 100% 100% no-repeat;
    font-family: var(--font-primary);
    color: #5a2a24;
  }

  .intro-content {
    width: 100%;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    text-align: center;
  }

  .intro-title {
    margin: 0;
    font-size: clamp(20px, 2vw, 26px);
    font-weight: 700;
    line-height: 1.25;
  }

  .intro-text {
    margin: 0;
    font-size: clamp(14px, 1.4vw, 18px);
    line-height: 1.45;
  }

  .button {
    flex-shrink: 0;
    border: none;
    background: center / 100% 100% no-repeat;
    color: #fdebc8;
    font-family: var(--font-primary);
    font-size: clamp(16px, 1.5vw, 20px);
    cursor: pointer;
    transition:
      scale 0.15s ease,
      filter 0.15s ease;

    &:hover:not(:disabled) {
      scale: 1.05;
      filter: brightness(1.1);
    }

    &:active:not(:disabled) {
      scale: 0.95;
    }

    &:disabled {
      cursor: default;
      opacity: 0.6;
    }

    &.confirm-button {
      width: 44%;
      aspect-ratio: 341 / 98;
      background-image: url("/images/login/login_button.webp");
    }
  }
}
</style>
