import { api } from "@/utils/api";

const NAMESPACE = import.meta.env.VITE_API_NAMESPACE;
const HUB_NAME = `${NAMESPACE}-hub`;

function auth() {
  return {
    headers: { Authorization: `Bearer ${localStorage.getItem("user_token")}` },
  };
}

export function appData(item) {
  return item?.metadata?.[NAMESPACE] ?? null;
}

export async function fetchMe() {
  const { data } = await api.get("/me", auth());
  return data;
}

export async function fetchMessages(channelId) {
  const { data } = await api.get("/channel/message", {
    params: { channel: channelId },
    ...auth(),
  });
  return data ?? [];
}

async function postMessage(channelId, content, metadata) {
  const { data } = await api.post(
    "/channel/message",
    { channel: channelId, content, metadata },
    auth(),
  );
  return data;
}

async function joinHub(me) {
  const joined = me.channels?.find((channel) => channel.name === HUB_NAME);
  if (joined) return joined;

  try {
    const { data } = await api.post("/channel/enter", { channel: HUB_NAME }, auth());
    return data;
  } catch {
    const { data } = await api.post(
      "/channel",
      { name: HUB_NAME, metadata: { type: "hub" } },
      auth(),
    );
    return data;
  }
}

export async function setupBottleSession() {
  const me = await fetchMe();
  const hub = await joinHub(me);
  const hubMessages = await fetchMessages(hub.id);

  if (!hubMessages.some((message) => message.user_id === me.id)) {
    const joinMessage = await postMessage(hub.id, "join", { type: "join" });
    hubMessages.unshift(joinMessage);
  }

  return { me, hub, hubMessages };
}

export async function fetchBottle(name, me) {
  let channel = me.channels?.find((joined) => joined.name === name);

  if (!channel) {
    const { data } = await api.post("/channel/enter", { channel: name }, auth());
    channel = data;
    me.channels = [...(me.channels ?? []), channel];
  }

  const messages = await fetchMessages(channel.id);
  return { channel, messages: messages.reverse() };
}

export function hubSocketUrl(hubId) {
  const url = new URL("/channel/socket", import.meta.env.VITE_API_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("channel", hubId);
  url.searchParams.set("authorization", localStorage.getItem("user_token"));
  url.searchParams.set("namespace", NAMESPACE);
  return url.toString();
}

function pickRecipient(myId, hubMessages) {
  const ids = [...new Set(hubMessages.map((message) => message.user_id))].filter(
    (id) => id !== myId,
  );
  return ids[Math.floor(Math.random() * ids.length)] ?? null;
}

export async function sendBottle(image) {
  const { me, hub, hubMessages } = await setupBottleSession();

  const recipientId = pickRecipient(me.id, hubMessages);
  if (!recipientId) throw new Error("NO_RECIPIENT");

  const { data: bottle } = await api.post(
    "/channel",
    {
      name: `bottle-${crypto.randomUUID()}`,
      metadata: { type: "bottle", from: me.id, to: recipientId },
    },
    auth(),
  );

  const letter = await postMessage(bottle.id, "letter", { type: "letter", image });

  await postMessage(hub.id, "bottle", {
    type: "bottle",
    to: recipientId,
    bottle: bottle.name,
  });

  return { bottle, letter, recipientId };
}

export async function replyBottle(bottle, image) {
  const { me, hub } = await setupBottleSession();

  const reply = await postMessage(bottle.channelId, "reply", {
    type: "reply",
    image,
  });

  await postMessage(hub.id, "bottle-reply", {
    type: "bottle-reply",
    to: bottle.from,
    bottle: bottle.name,
  });

  return { bottle, reply, recipientId: bottle.from, from: me.id };
}
