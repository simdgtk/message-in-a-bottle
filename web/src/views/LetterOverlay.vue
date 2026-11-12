<template>
  <div ref="overlayRef" class="letter-overlay">

    <div
      class="letter-zone"
      :class="`is-tool-${tool}`"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    ></div>

    <button
      type="button"
      class="back-island"
      @pointerdown.stop
      @click="backToIsland"
    >
      retour à l'île
    </button>

    <div class="toolbar" @pointerdown.stop>
      <button
        v-for="item in TOOLBAR"
        :key="item.tool"
        type="button"
        class="tool"
        :class="{ 'is-active': tool === item.tool }"
        :aria-label="item.label"
        :aria-pressed="tool === item.tool"
        @click="selectTool(item.tool)"
      >
        <img
          v-for="state in 3"
          :key="state"
          :class="`tool__state tool__state--${state}`"
          :src="`/images/toolbar/${item.icon}${state}.webp`"
          alt=""
          draggable="false"
        />
      </button>
    </div>

    <input
      ref="imageInputRef"
      type="file"
      id="image"
      name="image"
      accept="image/*"
      hidden
      @change="onImageChange"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";

const props = defineProps({
  letter: Object,
});

const emit = defineEmits(["back"]);

const overlayRef = ref(null);
const imageInputRef = ref(null);
const isFontReady = ref(false);
const tool = ref(props.letter?.tool ?? "text");

const TOOLBAR = [
  { tool: "text", icon: "feather", label: "Écrire" },
  { tool: "draw", icon: "brush", label: "Dessiner" },
  { tool: "erase", icon: "eraser", label: "Gommer" },
  { tool: "photo", icon: "photo", label: "Ajouter une image" },
];

function selectTool(next) {
  if (next === "photo") {
    imageInputRef.value?.click();
    return;
  }
  props.letter?.setTool(next);
}

function onImageChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    props.letter?.prepareImage(e.target.result);
  };
  reader.readAsDataURL(file);
  e.target.value = "";
}

function focusInput() {
  if (!isFontReady.value) return;
  props.letter?.focusInput();
}

function onPointerDown(e) {
  if (props.letter?.imageAddingMode) {
    props.letter.handlePointerDown(e);
    focusInput();
    return;
  }
  if (tool.value === "text") {
    e.preventDefault();
    focusInput();
    return;
  }
  props.letter?.handlePointerDown(e);
}
function onPointerMove(e) {
  props.letter?.handlePointerMove(e);
}
function onPointerUp(e) {
  props.letter?.handlePointerUp(e);
}

function backToIsland() {
  emit("back");
}

function onWindowKeyDown(e) {
  if (e.key === "Escape" && props.letter?.imageAddingMode) {
    props.letter.cancelImage();
    return;
  }
  if (!isFontReady.value) return;
  if (e.target?.closest?.(".tp-dfwv, .tp-rotv")) return;
  focusInput();
}

onMounted(async () => {
  if (props.letter) {
    props.letter.textContainer = overlayRef.value;
    props.letter.onToolChange = (next) => (tool.value = next);
  }
  window.addEventListener("keydown", onWindowKeyDown);

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  isFontReady.value = true;
  props.letter?.render();
  focusInput();
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onWindowKeyDown);
  if (props.letter) {
    props.letter.onToolChange = null;
    props.letter.removeTextarea();
    props.letter.textContainer = null;
  }
});
</script>

<style scoped lang="scss">
.letter-overlay {
  position: fixed;
  inset: 0;
  z-index: 5;

  .letter-zone {
    position: absolute;
    inset: 0;
    touch-action: none;
    cursor: text;

    &.is-tool-draw,
    &.is-tool-erase,
    &.is-tool-photo {
      cursor: crosshair;
    }
  }

  .back-island {
    position: absolute;
    z-index: 1;
    top: 30px;
    left: 30px;
  }

  .toolbar {
    position: absolute;
    z-index: 1;
    left: 30px;
    top: 50%;
    transform: translateY(-50%);
    width: 96px;
    aspect-ratio: 367 / 1582;
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    align-items: center;
    background: url("/images/toolbar/bar.webp") center / 100% 100% no-repeat;
  }

  .tool {
    all: unset;
    position: relative;
    width: 80px;
    height: 80px;
    cursor: pointer;
  }

  .tool__state {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.32);
    max-width: none;
    pointer-events: none;
    user-select: none;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .tool__state--1 {
    opacity: 1;
  }

  .tool:hover:not(.is-active) {
    .tool__state--1 {
      opacity: 0;
    }
    .tool__state--2 {
      opacity: 1;
    }
  }

  .tool.is-active {
    .tool__state--1 {
      opacity: 0;
    }
    .tool__state--3 {
      opacity: 1;
    }
  }

  .history {
    position: absolute;
    z-index: 1;
    left: 30px;
    bottom: 30px;
    display: flex;
    gap: 8px;
  }

  .letter-input {
    position: absolute;
    top: 0;
    left: 0;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
    resize: none;
  }
}
</style>
