<template>
  <div class="letter-overlay">
    <textarea
      id="text"
      ref="inputRef"
      v-model="text"
      :disabled="!isFontReady"
      class="letter-input"
      @input="onTextInput"
    ></textarea>

    <div
      class="letter-zone"
      :class="{ 'is-drawing-mode': drawingMode }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    ></div>

    <div class="commands" @pointerdown.stop>
      <button id="back-island" @click="backToIsland">retour à l'île</button>

      <button id="erase" :class="{ active: erasingMode }" @click="toggleErasing">
        {{ erasingMode ? "crayon" : "gommer" }}
      </button>
      <button id="clear" @click="clear">clear</button>
      <button id="back" @click="back">retour</button>

      <button id="drawing-mode" :class="{ active: drawingMode }" @click="toggleDrawing">
        {{ drawingMode ? "texte" : "dessiner" }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";

const props = defineProps({
  letter: Object,
});

const emit = defineEmits(["back"]);

const inputRef = ref(null);
const isFontReady = ref(false);
const text = ref(props.letter?.text ?? "");
const drawingMode = ref(props.letter?.drawingMode ?? false);
const erasingMode = ref(props.letter?.erasingMode ?? false);

function focusInput() {
  if (drawingMode.value || !isFontReady.value) return;
  inputRef.value?.focus({ preventScroll: true });
}

function onTextInput() {
  if (!isFontReady.value) return;
  props.letter?.setText(text.value);
}

function onPointerDown(e) {
  if (!drawingMode.value) {
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

function toggleDrawing() {
  drawingMode.value = props.letter?.toggleDrawingMode() ?? false;
  focusInput();
}
function toggleErasing() {
  erasingMode.value = props.letter?.toggleErasingMode() ?? false;
}
function back() {
  props.letter?.back();
}
function clear() {
  text.value = "";
  props.letter?.clear();
  focusInput();
}
function backToIsland() {
  emit("back");
}

function onWindowKeyDown() {
  if (!isFontReady.value) return;
  if (document.activeElement !== inputRef.value) focusInput();
}

onMounted(async () => {
  if (props.letter) props.letter.inputRef = inputRef;
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

    &.is-drawing-mode {
      cursor: crosshair;
    }
  }

  .commands {
    position: absolute;
    z-index: 1;
    left: 30px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: #fff;
    padding: 16px;
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
