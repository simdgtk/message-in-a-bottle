import { ref } from "vue";
import {
  appData,
  fetchBottle,
  hubSocketUrl,
  setupBottleSession,
} from "@/utils/bottle";

const RECONNECT_DELAY = 3000;

export const inbox = ref([]);

let isActive = false;
let session = null;
let socket = null;
let reconnectTimer = null;

function isBottleForMe(item) {
  const data = appData(item);
  return data?.type === "bottle" && data.to === session.me.id;
}

async function receive(name) {
  if (inbox.value.some((bottle) => bottle.name === name)) return;

  const { channel, messages } = await fetchBottle(name, session.me);
  if (messages.some((message) => message.user_id === session.me.id)) return;

  const letter = messages.find((message) => appData(message)?.type === "letter");
  if (!letter) return;

  inbox.value = [
    ...inbox.value,
    {
      name,
      channelId: channel.id,
      from: letter.user_id,
      letter,
      image: appData(letter).image,
    },
  ];
}

async function loadInbox() {
  const names = new Set();

  for (const channel of session.me.channels ?? []) {
    if (appData(channel)?.to === session.me.id) names.add(channel.name);
  }
  for (const message of session.hubMessages) {
    if (isBottleForMe(message)) names.add(appData(message).bottle);
  }

  for (const name of names) {
    await receive(name).catch((error) => console.warn(error));
  }
}

function onSocketMessage(event) {
  for (const line of event.data.split("\n")) {
    const payload = JSON.parse(line);
    if (payload.operation !== "message.created") continue;
    if (payload.channel_id !== session.hub.id) continue;
    if (!isBottleForMe(payload)) continue;
    receive(appData(payload).bottle).catch((error) => console.warn(error));
  }
}

function connect() {
  const current = new WebSocket(hubSocketUrl(session.hub.id));
  socket = current;
  current.addEventListener("message", onSocketMessage);
  current.addEventListener("close", () => {
    if (socket !== current) return;
    reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
  });
}

export async function startBottles() {
  if (isActive) return;
  isActive = true;

  let current;
  try {
    current = await setupBottleSession();
  } catch (error) {
    isActive = false;
    throw error;
  }
  if (!isActive) return;

  session = current;
  connect();
  await loadInbox();
}

export function stopBottles() {
  isActive = false;
  session = null;
  clearTimeout(reconnectTimer);
  socket?.close();
  socket = null;
  inbox.value = [];
}
