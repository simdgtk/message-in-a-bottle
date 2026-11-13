<template>
  <section class="transfer">
    <div class="container">
      <h1>Hello {{ name }}</h1>
      <button type="button">Envoyer un message</button>
      <div class="users">
        <h2>List of users</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>ID</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in users" :key="item.id">
              <td>{{ item.username }}</td>
              <td>{{ item.id }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script>
import { api } from "@/utils/api";
import { router } from "@/router/index";

export default {
  data() {
    return {
      users: [],
      transfers: [],
      name: "placeholder",
      balance: 0,
      loading: false,
      error: "",
      destination: 0,
      amount: 0,
    };
  },

  methods: {
    fetchAllUsers: function () {
      let token = localStorage.getItem("user_token");
      api
        .get("/users", {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((resp) => {
          this.users = [];
          resp.data.forEach((x) => this.users.push(x));
          this.destination = resp.data[0].id;
        })
        .catch(() => {
          console.log("error users");
        });
    },

    fetchMe: function () {
      let token = localStorage.getItem("user_token");
      api
        .get("/me", {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((resp) => {
          this.name = resp.data.username;
          this.balance = resp.data.balance;
        })
        .catch((error) => {
          console.log("error me");
          if (error.response?.status === 401) {
            this.error = "Unauthorized";
            localStorage.removeItem("user_token");
            router.push("/login");
          }
        });
    },
  },
  beforeMount() {
    this.fetchAllUsers();
    this.fetchMe();
  },
};
</script>

<style lang="scss" scoped>
.transfer {
  min-height: 100vh;
  padding: 1.5rem;

  @media (min-width: 640px) {
    padding: 3rem;
  }

  .container {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    max-width: 64rem;
    margin: 0 auto;
    padding: 2rem;
  }

  .users {
    padding-top: 1.5rem;

    h2 {
      margin-bottom: 1rem;
    }
  }

  .table {
    width: 100%;

    th,
    td {
      padding: 0.5rem 0;
    }
  }
}
</style>
