<template>
  <div ref="overlayRef" class="letter-overlay">
    <div
      class="letter-zone"
      :class="[`is-tool-${tool}`, { 'is-over-letter': isOverLetter }]"
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
      <img
        v-for="state in 2"
        :key="state"
        :class="`state state-${state}`"
        :src="`/images/back-arrow${state}.webp`"
        alt=""
        draggable="false"
      />
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
          :class="`state state-${state}`"
          :src="`/images/toolbar/${item.icon}${state}.webp`"
          alt=""
          draggable="false"
        />
      </button>
    </div>

    <button
      type="button"
      class="write-button"
      aria-label="Envoi désactivé (mode démo)"
      aria-disabled="true"
      disabled
      @pointerdown.stop
    >
      <img
        v-for="state in 2"
        :key="state"
        :class="`state state-${state}`"
        :src="`/images/send${state}.webp`"
        alt=""
        draggable="false"
      />
    </button>

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
import { sceneApp } from "@/composables/useSceneApp";

const props = defineProps({
  letter: Object,
  replyTo: Object,
});

const emit = defineEmits(["back"]);

const overlayRef = ref(null);
const imageInputRef = ref(null);
const isFontReady = ref(false);
const tool = ref(props.letter?.tool ?? "text");
const isOverLetter = ref(false);

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
  if (tool.value === "text" && !isFontReady.value) return;
  props.letter?.handlePointerDown(e);
}
function onPointerMove(e) {
  props.letter?.handlePointerMove(e);
  isOverLetter.value = tool.value === "text" && !!props.letter?.cursorTarget;
}
function onPointerUp(e) {
  props.letter?.handlePointerUp(e);
}

function backToIsland() {
  sceneApp.value?.audioManager?.play("uiInteraction");
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

  if (import.meta.env.DEV) {
    window.exportLetter = (filename = "letter.webp") => {
      const dataUrl = props.letter?.exportImage();
      if (!dataUrl) {
        console.warn("Impossible d'exporter la lettre");
        return null;
      }
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = filename;
      link.click();
      console.info(`Lettre exportée : ${filename}`);
      return dataUrl;
    };
  }

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  isFontReady.value = true;
  props.letter?.render();
  focusInput();
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onWindowKeyDown);
  if (import.meta.env.DEV && "exportLetter" in window) {
    delete window.exportLetter;
  }
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
    cursor: default;

    &.is-tool-text.is-over-letter {
      cursor: none;
    }

    &.is-tool-draw,
    &.is-tool-erase,
    &.is-tool-photo {
      cursor: crosshair;
    }
  }

  .back-island {
    all: unset;
    position: absolute;
    z-index: 1;
    top: 30px;
    left: 30px;
    width: 96px;
    height: 56px;
    cursor: pointer;

    .state {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.26);
      max-width: none;
      pointer-events: none;
      user-select: none;
    }

    .state-2 {
      opacity: 0;
    }

    &:hover {
      .state-1 {
        opacity: 1;
      }
      .state-2 {
        opacity: 0.5;
      }
    }
  }

  .write-button {
    all: unset;
    position: absolute;
    z-index: 1;
    right: 30px;
    bottom: 30px;
    width: 110px;
    height: 110px;
    cursor: pointer;
    
    .state {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      user-select: none;
    }
    
    .state-2 {
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    &:hover:not(:disabled) {
      .state-2 {
        opacity: 1;
      }
    }

    &:disabled {
      cursor: not-allowed;
      filter: grayscale(1);
      opacity: 0.45;
    }
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

    @media (max-width: 768px) {
      left: 50%;
      top: clamp(125px, 19%, 190px);
      flex-direction: column-reverse;
      transform: translate(-50%, -50%) rotate(90deg) scale(0.7);
      transform-origin: center;
    }
  }

  .tool {
    all: unset;
    position: relative;
    width: 80px;
    height: 80px;
    cursor: pointer;

    @media (max-width: 768px) {
      transform: rotate(-90deg);
    }

    .state {
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

    .state-1 {
      opacity: 1;
    }

    &:hover:not(.is-active) {
      .state-1 {
        opacity: 0;
      }
      .state-2 {
        opacity: 1;
      }
    }

    &.is-active {
      .state-1 {
        opacity: 0;
      }
      .state-3 {
        opacity: 1;
      }
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
