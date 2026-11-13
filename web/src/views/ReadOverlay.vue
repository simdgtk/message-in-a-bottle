<template>
  <div class="read-overlay">
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

    <button
      v-if="bottle?.images?.length > 1"
      type="button"
      class="switch-button"
      :class="{ 'is-down': activeIndex === 1 }"
      aria-label="Changer de lettre"
      @pointerdown.stop
      @click="emit('switch')"
    >
      <img class="arrow" src="/images/up-arrow.webp" alt="" draggable="false" />
    </button>

    <button
      v-if="!bottle?.readOnly"
      type="button"
      class="reply-button"
      aria-label="Répondre à la lettre"
      @pointerdown.stop
      @click="emit('reply')"
    >
      <img
        v-for="state in 2"
        :key="state"
        :class="`state state-${state}`"
        :src="`/images/write${state}.webp`"
        alt=""
        draggable="false"
      />
    </button>
  </div>
</template>

<script setup>
import { sceneApp } from "@/composables/useSceneApp";

defineProps({
  bottle: Object,
  activeIndex: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(["back", "reply", "switch"]);

function backToIsland() {
  sceneApp.value?.audioManager?.play("uiInteraction");
  emit("back");
}
</script>

<style scoped lang="scss">
.read-overlay {
  position: fixed;
  inset: 0;
  z-index: 5;

  .back-island {
    all: unset;
    position: absolute;
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
      .state-2 {
        opacity: 0.5;
      }
    }
  }

  .switch-button {
    all: unset;
    position: absolute;
    z-index: 1;
    cursor: pointer;
    transition:
      transform 0.2s ease,
      opacity 0.2s ease;
    top: 50%;
    right: 2%;
    height: 120px;
    transform: translateX(-50%) rotate(90deg);
    width: 120px;
    
    &.is-down{
      transform: translateX(-50%) rotate(-90deg);
    }

    .arrow {
      width: 100%;
      height: 100%;
      object-fit: contain;
      pointer-events: none;
      user-select: none;
      transition: transform 0.3s ease;
    }
  }

  .reply-button {
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

    &:hover {
      .state-2 {
        opacity: 1;
      }
    }
  }
}
</style>
