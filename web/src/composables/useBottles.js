import { ref } from "vue";
import { DEMO_BOTTLES } from "@/data/demoBottles";

export const inbox = ref([]);

export function removeBottle(name) {
  inbox.value = inbox.value.filter((bottle) => bottle.name !== name);
}

export async function startBottles() {
  inbox.value = [...DEMO_BOTTLES];
}

export function stopBottles() {
  inbox.value = [];
}
