<template>
  <section class="login">
    <div class="board">
      <div class="paper">
        <div class="intro-content">
          <p class="intro-text">
            Ce projet a été réalisé en 2 semaines, à Gobelins, en M1 ECNI. Le
            backend était hébergé et l'utilisateur pouvait envoyer, recevoir et
            répondre à des messages. Nous avons décidé, après le projet, de
            ne simplement héberger que la partie front.
          </p>
          <p class="intro-text">
            Vous pouvez voir ici à quoi peut ressembler l'île d'un utilisateur
            qui a envoyé une lettre et reçu un message.
          </p>
          <p class="intro-text">
            Créa :
            <a
              href="https://www.linkedin.com/in/elina-su-858233337/"
              target="_blank"
              rel="noopener noreferrer"
              >Elina Su</a
            >
            &
            <a
              href="https://www.linkedin.com/in/mathis-boulard-6907b71a1/"
              target="_blank"
              rel="noopener noreferrer"
              >Mathis Boulard</a
            ><br />
            Développement :
            <a
              href="https://simondaguetkargl.fr/"
              target="_blank"
              rel="noopener noreferrer"
              >Simon Daguet-Kargl</a
            >
          </p>
          <p class="intro-text">
            Back :
            <a
              href="https://github.com/TheLazyHase/chat-server-gobelin"
              target="_blank"
              rel="noopener noreferrer"
              >TheLazyHase</a
            >
          </p>
          <p class="intro-text">
            Merci à
            <a
              href="https://leomouraire.com/"
              target="_blank"
              rel="noopener noreferrer"
              >Léo Mouraire</a
            >
            &
            <a
              href="https://github.com/TheLazyHase/chat-server-gobelin"
              target="_blank"
              rel="noopener noreferrer"
              >TheLazyHase</a
            >,
            pour leurs conseils et accompagnements en dev.
          </p>
        </div>
        <button
          class="button confirm-button"
          type="button"
          :disabled="leaving"
          @click="onConfirm"
        >
          Voir l'île
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

const leaving = ref(false);

async function onConfirm() {
  if (leaving.value) return;
  leaving.value = true;
  sceneApp.value?.audioManager?.play("uiInteraction");

  try {
    localStorage.setItem(INTRO_SEEN_KEY, "true");
  } catch {}

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
    display: flex;
    align-items: center;
    justify-content: center;
    background: url("/images/login/wood_background.webp") center / 100% 100%;
  }

  .paper {
    width: 95%;
    display: flex;
    margin: 20px;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 15% 8% 8%;
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

    p {
      text-wrap: balance;
    }

    a {
      color: hsl(7, 43%, 45%);
    }
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
