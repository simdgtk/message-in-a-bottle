import { createRouter, createWebHistory } from "vue-router";

export const INTRO_SEEN_KEY = "folio_intro_seen";

function hasSeenIntro() {
  try {
    return localStorage.getItem(INTRO_SEEN_KEY) === "true";
  } catch {
    return false;
  }
}

const routes = [
  {
    path: "/",
    redirect: "/island",
  },
  {
    path: "/island",
    name: "island",
    component: () => import("@/views/Island.vue"),
  },
  {
    path: "/intro",
    name: "intro",
    component: () => import("@/views/Login.vue"),
  },
  {
    path: "/:pathMatch(.*)*",
    redirect: "/island",
  },
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach((to) => {
  const seen = hasSeenIntro();

  if (!seen && to.name !== "intro") return { name: "intro" };
  if (seen && to.name === "intro") return { name: "island" };
});

export default router;
