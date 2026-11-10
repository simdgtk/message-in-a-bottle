<template>
  <Scene />
  <section class="login">
    <div class="login__modal">
      <h1>Sign in or create an account</h1>
      <form class="login__form" action="#" @submit.prevent="onSubmit">
        <div class="login__field">
          <label for="username">Your username</label>
          <input
            type="text"
            name="username"
            id="username"
            v-model="username"
            @input="needsSignup = false"
            placeholder="Your username"
            required=""
          />
        </div>
        <div class="login__field">
          <label for="password">Password</label>
          <input
            type="password"
            name="password"
            id="password"
            v-model="password"
            placeholder="••••••••"
            required=""
          />
        </div>
        <div class="login__row">
          <div class="login__remember">
            <input id="remember" aria-describedby="remember" type="checkbox" />
            <label for="remember">Remember me</label>
          </div>
          <a href="#">Forgot password?</a>
        </div>
        <p v-if="error">{{ error }}</p>
        <template v-if="needsSignup">
          <p>No account named “{{ username }}”. Create it with this password?</p>
          <button type="button" :disabled="loading" @click="onSignup">
            Sign up
          </button>
        </template>
        <button v-else type="submit" :disabled="loading">Continue</button>
      </form>
    </div>
  </section>
</template>

<script>
import axios from "axios";
import Scene from "@/components/Scene.vue";
import { router } from "@/router/index";

const API_URL = "http://localhost:4000";

export default {
  components: { Scene },
  data() {
    return {
      username: "",
      password: "",
      loading: false,
      error: "",
      needsSignup: false,
    };
  },
  methods: {
    login() {
      return axios
        .post(`${API_URL}/login`, {
          username: this.username,
          password: this.password,
        })
        .then((response) => {
          localStorage.setItem("user_token", response.data);
          router.push("/");
        });
    },

    onSubmit() {
      this.loading = true;
      this.error = "";

      this.login()
        .catch((error) => {
          const status = error.response?.status;
          if (status === 404) {
            this.needsSignup = true;
          } else if (status === 401) {
            this.error = "Wrong password";
          } else {
            this.error = "Internal Server Error";
          }
        })
        .finally(() => {
          this.loading = false;
        });
    },

    onSignup() {
      this.loading = true;
      this.error = "";

      axios
        .post(`${API_URL}/user`, {
          username: this.username,
          password: this.password,
        })
        .then(() => this.login())
        .catch(() => {
          this.error = "Could not create the account";
        })
        .finally(() => {
          this.loading = false;
        });
    },
  },
};
</script>

<style lang="scss" scoped>
.login {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem 1.5rem;

  &__modal {
    width: 100%;
    max-width: 28rem;
    padding: 3rem;
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin-top: 1.5rem;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__remember {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
}
</style>
