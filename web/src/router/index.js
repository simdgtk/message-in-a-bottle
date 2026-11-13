// Composables
import { createRouter, createWebHistory } from "vue-router";

const SKIP_AUTH = false;

const routes = [
  {
    path: "/",
    ...(SKIP_AUTH
      ? { redirect: "/island" }
      : { component: () => import("@/views/Island.vue") }),
  },
  {
    path: "/island",
    component: () => import("@/views/Island.vue"),
  },
  {
    path: "/login",
    name: "login",
    component: () =>
      import(/* webpackChunkName: "login" */ "@/views/Login.vue"),
  },
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach((to) => {
  if (SKIP_AUTH) return;
  const isLoggedIn = localStorage.getItem("user_token") !== null;

  if (!isLoggedIn && to.name !== "login" && to.name !== "letter") return { name: "login" };
  if (isLoggedIn && to.name === "login") return { path: "/" };
});

export default router;
