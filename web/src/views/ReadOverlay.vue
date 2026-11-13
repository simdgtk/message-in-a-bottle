<template>
  <div class="read-overlay">
    <button
      type="button"
      class="back-island"
      @pointerdown.stop
      @click="emit('back')"
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
  </div>
</template>

<script setup>
const emit = defineEmits(["back"]);
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
}
</style>
