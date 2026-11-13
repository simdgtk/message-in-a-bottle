<template>
  <section class="login" ref="loginRef">
    <div class="board">
      <form class="paper" @submit.prevent="onSubmit">
        <input
          class="field username"
          type="text"
          name="username"
          id="username"
          v-model="username"
          @input="error = ''"
          placeholder="Username"
          autocomplete="username"
          required
        />
        <input
          class="field password"
          type="password"
          name="password"
          id="password"
          v-model="password"
          placeholder="Password"
          autocomplete="current-password"
          required
        />

        <p v-if="error" class="error" role="alert">{{ error }}</p>

        <button class="button submit-login" type="submit" :disabled="loading">
          Log in
        </button>

        <button
          class="button submit-signup"
          type="button"
          :disabled="loading"
          @click="onSignup"
        >
          Create an account
        </button>
      </form>
    </div>
  </section>
</template>

<script setup>
import { ref } from "vue";
import { api } from "@/utils/api";
import { router } from "@/router/index";
import { fadeThrough } from "@/composables/useFade";

const username = ref("");
const password = ref("");
const loading = ref(false);
const error = ref("");

const loginRef = ref(null);

async function login() {
  const response = await api.post("/login", {
    username: username.value,
    password: password.value,
  });
  localStorage.setItem("user_token", response.data);
  await fadeThrough(() => router.push("/island"));
}

async function onSubmit() {
  loading.value = true;
  error.value = "";

  try {
    await login();
  } catch (err) {
    const status = err.response?.status;
    if (status === 404) {
      error.value = "Aucun compte avec ce nom, créez-en un ci-dessous";
    } else if (status === 401) {
      error.value = "Mauvais mot de passe";
    } else {
      error.value = "Erreur serveur";
    }
  } finally {
    loading.value = false;
  }
}

async function onSignup() {
  if (!username.value || !password.value) {
    error.value = "Remplissez un nom d'utilisateur et un mot de passe";
    return;
  }
  loading.value = true;
  error.value = "";

  try {
    await api.post("/user", {
      username: username.value,
      password: password.value,
    });
    await login();
  } catch {
    error.value = "Impossible de créer le compte";
  } finally {
    loading.value = false;
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
    position: relative;
    width: 95%;
    aspect-ratio: 957 / 1179;
    background: url("/images/login/paper.webp") center / 100% 100% no-repeat;
  }

  .field,
  .button,
  .error {
    position: absolute;
    left: 50%;
    translate: -50% 0;
    font-family: var(--font-primary);
    font-size: 20px;
  }

  .field {
    top: 20%;
    width: 75%;
    aspect-ratio: 737 / 148;
    padding: 24px;
    border: none;
    outline: none;
    background: url("/images/login/frame.webp") center / 100% 100% no-repeat;
    color: #5a2a24;
    font-size: 20px;

    &::placeholder {
      color: rgba(90, 42, 36, 0.45);
    }

    &.password {
      top: 40%;
    }
  }

  .error {
    top: 55%;
    width: 80%;
    margin: 0;
    text-align: center;
    color: #a8433a;
    font-size: 20px;
  }

  .button {
    border: none;
    background: center / 100% 100% no-repeat;
    color: #fdebc8;
    font-size: 20px;
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

    &.submit-login {
      top: 64%;
      width: 36%;
      aspect-ratio: 341 / 98;
      background-image: url("/images/login/login_button.webp");
    }

    &.submit-signup {
      top: 80%;
      width: 60%;
      aspect-ratio: 541 / 104;
      background-image: url("/images/login/signin_button.webp");
    }
  }
}
</style>
